import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { createBabylon } from "../../core/engine";
import type { GameContext, GameInstance, GameRuntime, StartOptions } from "../../core/game";
import { createKeyboard, type InputEvent } from "../../core/input";
import { createRng } from "../../core/math/rng";
import type { MathTask } from "../../core/math/tasks";
import { PRESET_DIFFICULTIES, type Difficulty } from "../../core/difficulty";
import { loadProgress, updateProgress } from "../../core/storage";
import { track } from "../../analytics";
import { SUPPORT_PAGE_PATH } from "../../config";
import { h } from "../../core/ui/dom";
import { showModal, type Modal, type ModalButton } from "../../core/ui/modal";
import { createTaskPanel } from "../../core/ui/taskPanel";
import { localizePath } from "../../i18n/locales";
import { getActiveLocale, getStrings } from "../../i18n/strings";
import { createLookUpHud } from "./hud";
import {
  applySplit,
  burnScore,
  burnsHarmlessly,
  choiceOptions,
  pickComposite,
  splitDivisors,
  splitScore,
} from "./math";
import { tierForWave } from "./art";
import {
  IMPACT_Y,
  SpaceView,
  approachSpeedScale,
  pickSeparatedApproach,
  placeAroundBreak,
  splitRingOffsets,
  type BodyVisual,
  type ShotVisual,
} from "./render";
import {
  hazardSpawnBlocked,
  lifeCap,
  shouldSpawnBonus,
  spawnValues,
  startingLives,
  waveConfig,
  type WaveConfig,
} from "./waves";

const GAME_ID = "look-up";
const CHOICE_COUNT = 4;
const FEEDBACK_OK = 0.35;
const FEEDBACK_BAD = 0.85;
const BURN_LIFE = 0.55;

type State = "intro" | "playing" | "paused" | "won" | "lost" | "waveClear";

interface Body {
  id: string;
  kind: "asteroid" | "shield" | "life";
  label: number;
  /** Set once a correct divisor has granted this shield or life. */
  collected?: boolean;
  x: number;
  y: number;
  z: number;
  /** Deck aim X — drifts toward (targetX, IMPACT_Y). */
  targetX: number;
  speed: number;
  burning: boolean;
  burnTimer: number;
  hitFlash: number;
  /** Counts against wave concurrent cap (false for split shards). */
  inbound: boolean;
}

interface Shot {
  id: string;
  from: Vector3;
  to: Vector3;
  life: number;
  maxLife: number;
  success: boolean;
}

function feedbackButton(): ModalButton {
  const locale = getActiveLocale();
  return {
    label: getStrings(locale).shareFeedback,
    href: `${import.meta.env.BASE_URL}${localizePath("feedback/", locale)}`,
    external: false,
  };
}

function supportButton(): ModalButton {
  const locale = getActiveLocale();
  return {
    label: getStrings(locale).support,
    href: `${import.meta.env.BASE_URL}${localizePath(SUPPORT_PAGE_PATH, locale)}`,
    external: false,
  };
}

function start(ctx: GameContext, options: StartOptions): GameInstance {
  const strings = getStrings();
  const t = strings.lookUp;
  const canvas = h("canvas", { class: "game-canvas", "aria-label": t.title });
  const stage = h("div", { class: "stage" }, canvas);
  ctx.root.classList.add("look-up");
  ctx.root.append(stage);

  const babylon = createBabylon(canvas, new Color4(0.02, 0.04, 0.1, 1));
  const view = new SpaceView(babylon.scene);
  const rng = createRng();

  let state: State = "intro";
  let modal: Modal | null = null;
  const saved = loadProgress(GAME_ID);
  let difficulty: Difficulty = saved.difficulty === "custom" ? "normal" : saved.difficulty;
  let wave = options.level ?? saved.levels[difficulty];
  let lives = startingLives(difficulty);
  let maxLives = lives;
  let shields = 0;
  let score = 0;
  let selectedId: string | null = null;
  /** Player tapped or cycled a rock; auto-aim must not steal it. */
  let aimLock = false;
  /** Body id the current choice buttons were built for. Wrong answers reuse them. */
  let taskForId: string | null = null;
  let task: MathTask | undefined;
  let feedbackTimer = 0;
  let bodies: Body[] = [];
  let shots: Shot[] = [];
  let nextId = 1;
  let waveClearTimer = 0;
  let time = 0;
  let activeCfg: WaveConfig = waveConfig(1, difficulty);
  let pendingLabels: number[] = [];
  let pendingBonus = false;
  let pendingLife = false;
  let spawnCooldown = 0;
  let lifeCooldown = 0;

  const hud = createLookUpHud(() => togglePause());
  stage.append(hud.el);

  const panel = createTaskPanel((i) => answer(i));
  ctx.root.append(panel.el);

  function openModal(options: Parameters<typeof showModal>[1]): void {
    modal?.close();
    modal = showModal(ctx.root, options);
  }

  function closeModal(): void {
    modal?.close();
    modal = null;
  }

  function syncHud(): void {
    hud.setWave(wave);
    hud.setScore(score);
    hud.setLives(lives, maxLives);
    hud.setShields(shields);
    hud.setDifficulty(strings.difficultyLine(strings.difficulty[difficulty]));
  }

  function activeThreats(): Body[] {
    return bodies.filter((b) => b.kind === "asteroid" && !b.burning);
  }

  /** Rocks plus pickups the player can aim at. */
  function aimable(): Body[] {
    return bodies.filter((b) => !b.burning);
  }

  function hazardCount(): number {
    return activeThreats().length;
  }

  function pickupInFlight(kind: "shield" | "life"): boolean {
    return bodies.some((b) => b.kind === kind && !b.burning);
  }

  function distToImpact(b: Body): number {
    const dx = b.targetX - b.x;
    const dy = IMPACT_Y - b.y;
    return Math.hypot(dx, dy);
  }

  function pickDefaultTarget(): void {
    const threats = activeThreats();
    const pool = threats.length > 0 ? threats : aimable();
    if (pool.length === 0) {
      selectedId = null;
      return;
    }
    // Prefer the rock closest to impact. A pickup is the default only when no rock is left.
    pool.sort((a, b) => distToImpact(a) - distToImpact(b) || a.y - b.y);
    selectedId = pool[0].id;
  }

  function inboundAlive(): number {
    return bodies.filter((b) => b.kind === "asteroid" && b.inbound && !b.burning).length;
  }

  function occupiedSpots() {
    return bodies
      .filter((b) => !b.burning)
      .map((b) => ({ x: b.x, y: b.y, targetX: b.targetX }));
  }

  function releaseInbound(label: number): void {
    const p = pickSeparatedApproach(rng, view.playFrustum(), occupiedSpots());
    bodies.push({
      id: String(nextId++),
      kind: "asteroid",
      label,
      x: p.x,
      y: p.y,
      z: p.z,
      targetX: p.targetX,
      speed: activeCfg.speed * (0.92 + rng.next() * 0.16),
      burning: false,
      burnTimer: 0,
      hitFlash: 0,
      inbound: true,
    });
  }

  function releasePickup(kind: "shield" | "life"): void {
    const p = pickSeparatedApproach(rng, view.playFrustum(), occupiedSpots());
    bodies.push({
      id: String(nextId++),
      kind,
      label: pickComposite(rng, activeCfg.minValue, activeCfg.maxValue),
      x: p.x,
      y: Math.max(p.y, 6),
      z: p.z,
      targetX: p.targetX * 0.5,
      speed: activeCfg.speed * 0.75,
      burning: false,
      burnTimer: 0,
      hitFlash: 0,
      inbound: false,
    });
  }

  /** Keep a life in flight while the player is under 3 and under the wave cap. */
  function ensureLifePickup(): void {
    if (lifeCooldown > 0 || lives >= 3 || lives >= maxLives) return;
    if (pickupInFlight("life") || pendingLife) return;
    // Don't chain a new life after the last rock is gone, or the wave never clears.
    if (pendingLabels.length === 0 && activeThreats().length === 0) return;
    pendingLife = true;
  }

  /** True when another inbound may enter (serial = wait for clear; else under cap + gap). */
  function canReleaseInbound(): boolean {
    if (hazardSpawnBlocked(hazardCount())) return false;
    const live = inboundAlive();
    if (live >= activeCfg.maxConcurrent) return false;
    if (activeCfg.maxConcurrent <= 1) return live === 0;
    return spawnCooldown <= 0;
  }

  function tryReleaseFromQueue(): void {
    if (pendingLabels.length > 0 && canReleaseInbound()) {
      const label = pendingLabels.shift();
      if (label !== undefined) {
        releaseInbound(label);
        spawnCooldown = activeCfg.maxConcurrent <= 1 ? 0 : activeCfg.spawnGap;
        if (!selectedId) {
          pickDefaultTarget();
          showTaskForSelection();
        }
      }
    }
    // Pickups are not hazards, so a full screen of rocks does not block them.
    ensureLifePickup();
    if (pendingLife && lifeCooldown <= 0 && !pickupInFlight("life")) {
      pendingLife = false;
      releasePickup("life");
      lifeCooldown = 1.2;
    }
    if (pendingBonus && spawnCooldown <= 0 && !pickupInFlight("shield")) {
      pendingBonus = false;
      // Already at 3 but under the wave cap: this bonus is the extra life.
      if (lives >= 3 && lives < maxLives && !pickupInFlight("life")) releasePickup("life");
      else releasePickup("shield");
      spawnCooldown = Math.max(spawnCooldown, activeCfg.spawnGap);
    }
  }

  function selectedBody(): Body | undefined {
    return bodies.find((b) => b.id === selectedId && !b.burning);
  }

  function promptFor(body: Body): string {
    if (body.kind === "life") return t.lifePrompt(body.label);
    if (body.kind === "shield") return t.shieldPrompt(body.label);
    return t.taskPrompt(body.label);
  }

  function showTaskForSelection(): void {
    const body = selectedBody();
    if (!body) {
      task = undefined;
      panel.el.classList.add("lup-idle");
      panel.show({ kind: "div", text: t.pickTarget, answer: -1, options: [2, 3, 4, 5] });
      panel.setEnabled(false);
      return;
    }
    panel.el.classList.remove("lup-idle");
    if (!(task && taskForId === body.id)) {
      taskForId = body.id;
      const options = choiceOptions(body.label, CHOICE_COUNT, rng);
      // answer field unused for validation — we check isValidSplit on pick.
      task = {
        kind: "div",
        text: promptFor(body),
        answer: options.find((d) => splitDivisors(body.label).includes(d)) ?? options[0],
        options,
      };
    }
    panel.show(task);
    panel.setEnabled(state === "playing" && feedbackTimer <= 0);
  }

  function spawnWave(): void {
    activeCfg = waveConfig(wave, difficulty);
    // Stub upgrade path: swap deck/turret kits by wave until economy exists.
    view.setStationTier(tierForWave(wave));
    bodies = [];
    shots = [];
    selectedId = null;
    aimLock = false;
    taskForId = null;
    task = undefined;
    maxLives = lifeCap(wave);
    pendingLabels = rng.shuffle(spawnValues(activeCfg, rng));
    pendingBonus = shouldSpawnBonus(activeCfg, rng);
    pendingLife = false;
    spawnCooldown = 0;
    lifeCooldown = 0;
    ensureLifePickup();
    // Release the first inbound immediately so play starts with something on screen.
    tryReleaseFromQueue();
    pickDefaultTarget();
    showTaskForSelection();
    syncHud();
  }

  function setupRun(withIntro = true): void {
    maxLives = lifeCap(wave);
    lives = Math.min(startingLives(difficulty), maxLives);
    shields = 0;
    score = 0;
    feedbackTimer = 0;
    waveClearTimer = 0;
    updateProgress(GAME_ID, (p) => {
      p.difficulty = difficulty;
      p.levels[difficulty] = Math.max(1, wave);
    });
    syncHud();
    spawnWave();
    state = "intro";
    panel.setEnabled(false);
    if (withIntro) showIntro();
    else play();
  }

  function showIntro(): void {
    const lines = [
      strings.difficultyLine(strings.difficulty[difficulty]),
      t.introGoal,
      t.introRules,
    ];
    if (wave === 1 || !sessionStorage.getItem("lup-controls-seen")) lines.push(t.controls);
    sessionStorage.setItem("lup-controls-seen", "1");
    openModal({
      title: t.wave(wave),
      lines,
      buttons: [
        { label: strings.start, primary: true, onClick: play },
        { label: strings.selectDifficulty, onClick: showDifficultyPicker },
        { label: strings.backToGames, onClick: ctx.exit },
      ],
    });
  }

  function showDifficultyPicker(): void {
    openModal({
      title: strings.selectDifficulty,
      choices: PRESET_DIFFICULTIES.map((d) => ({
        label: strings.difficulty[d],
        hint: t.difficultyHints[d],
        selected: d === difficulty,
        onClick: () => chooseDifficulty(d),
      })),
      buttons: [{ label: strings.back, primary: true, onClick: showIntro }],
    });
  }

  function chooseDifficulty(next: Difficulty): void {
    if (next === difficulty) {
      showIntro();
      return;
    }
    difficulty = next;
    wave = updateProgress(GAME_ID, (p) => {
      p.difficulty = next;
    }).levels[next];
    setupRun();
  }

  function play(): void {
    const starting = state === "intro" || state === "waveClear";
    closeModal();
    state = "playing";
    panel.setEnabled(feedbackTimer <= 0 && !!selectedBody());
    showTaskForSelection();
    if (starting) track("game_start", { game_id: GAME_ID, level: wave, difficulty });
  }

  function togglePause(): void {
    if (state === "playing") {
      state = "paused";
      panel.setEnabled(false);
      openModal({
        title: strings.menu,
        lines: [strings.paused, t.score(score), t.wave(wave)],
        buttons: [
          { label: strings.resume, primary: true, onClick: play },
          { label: strings.restartLevel, onClick: () => setupRun() },
          feedbackButton(),
          { label: strings.backToGames, onClick: ctx.exit },
        ],
      });
    } else if (state === "paused") {
      play();
    }
  }

  function fireShot(to: Body, success: boolean): void {
    const from = view.cannonMuzzle(to.x);
    const flight = Math.max(0.28, Math.min(0.55, (to.y - from.y) * 0.04));
    shots.push({
      id: String(nextId++),
      from,
      to: new Vector3(to.x, to.y, to.z),
      life: flight,
      maxLife: flight,
      success,
    });
  }

  function answer(index: number): void {
    if (state !== "playing" || feedbackTimer > 0 || !task || index >= task.options.length) return;
    const body = selectedBody();
    if (!body) return;

    const pick = task.options[index];
    const correctIndex = task.options.findIndex((d) => splitDivisors(body.label).includes(d));
    const result = applySplit(body.label, pick);
    const correct = result.ok;
    const pickup = body.kind === "shield" || body.kind === "life";

    if (correct && result.ok) {
      fireShot(body, true);
      score += splitScore(body.label, pick);
      if (pickup) {
        // A proper divisor collects the numbered life or shield. It does not split into rocks.
        collectPickup(body);
      } else {
        // Replace the hit body with children on a spaced ring around the parent.
        body.burning = true;
        body.burnTimer = BURN_LIFE * 0.35;
        const children = result.children;
        const ring = splitRingOffsets(children.length, rng);
        const placed = bodies.filter((b) => !b.burning).map((b) => ({ x: b.x, y: b.y }));
        placed.push({ x: body.x, y: body.y });
        children.forEach((label, i) => {
          const off = ring[i] ?? { dx: 0, dy: 1.4, dz: 0 };
          const p = placeAroundBreak(body, off, placed);
          placed.push({ x: p.x, y: p.y });
          const child: Body = {
            id: String(nextId++),
            kind: "asteroid",
            label,
            x: p.x,
            y: p.y,
            z: p.z,
            targetX: Math.max(-5.2, Math.min(5.2, p.x * 0.7)),
            speed: body.speed * 1.02,
            burning: burnsHarmlessly(label),
            burnTimer: burnsHarmlessly(label) ? BURN_LIFE : 0,
            hitFlash: 0.6,
            inbound: false,
          };
          if (child.burning) score += burnScore(label);
          bodies.push(child);
        });
      }
      panel.showResult(index, index);
    } else {
      fireShot(body, false);
      body.hitFlash = 1;
      // Keep this rock and these buttons. A miss must not reshuffle or retarget.
      aimLock = true;
      panel.showResult(index, correctIndex >= 0 ? correctIndex : index);
    }

    syncHud();
    panel.setEnabled(false);
    feedbackTimer = correct ? FEEDBACK_OK : FEEDBACK_BAD;
  }

  function collectPickup(body: Body): void {
    if (body.collected) return;
    body.collected = true;
    body.burning = true;
    body.burnTimer = BURN_LIFE;
    if (body.kind === "shield") {
      shields += 1;
      score += 25;
    } else if (body.kind === "life" && lives < maxLives) {
      lives += 1;
      score += 15;
    }
    syncHud();
    ensureLifePickup();
  }

  function impact(body: Body): void {
    body.burning = true;
    body.burnTimer = BURN_LIFE * 0.5;
    if (body.kind === "shield" || body.kind === "life") {
      // Reaching the deck without a divisor does not grant the life or shield.
      return;
    }
    if (shields > 0) {
      shields -= 1;
      syncHud();
      return;
    }
    lives -= 1;
    syncHud();
    ensureLifePickup();
    if (lives <= 0) lose();
  }

  function lose(): void {
    state = "lost";
    panel.setEnabled(false);
    track("level_fail", { game_id: GAME_ID, level: wave, difficulty });
    openModal({
      title: t.stationHit,
      lines: [t.stationHitHint, t.score(score)],
      buttons: [
        { label: strings.tryAgain, primary: true, onClick: () => setupRun() },
        feedbackButton(),
        { label: strings.backToGames, onClick: ctx.exit },
      ],
    });
  }

  function clearWave(): void {
    state = "waveClear";
    panel.setEnabled(false);
    track("level_complete", { game_id: GAME_ID, level: wave, difficulty });
    updateProgress(GAME_ID, (p) => {
      p.difficulty = difficulty;
      p.levels[difficulty] = Math.max(p.levels[difficulty], wave + 1);
    });
    const buttons: ModalButton[] = [
      {
        label: t.nextWave,
        primary: true,
        onClick: () => {
          wave += 1;
          spawnWave();
          play();
        },
      },
      feedbackButton(),
    ];
    if (wave === 3 || wave === 7 || (wave >= 10 && wave % 3 === 0)) buttons.push(supportButton());
    buttons.push({ label: strings.backToGames, onClick: ctx.exit });
    openModal({
      title: t.waveClear,
      lines: [t.score(score), t.waveClearHint],
      buttons,
    });
  }

  function onPointerDown(e: PointerEvent): void {
    if (state !== "playing") return;
    const id = view.pickBody(canvas, e.clientX, e.clientY);
    if (!id) return;
    const body = bodies.find((b) => b.id === id && !b.burning);
    if (!body) return;
    selectedId = body.id;
    aimLock = true;
    showTaskForSelection();
  }
  canvas.addEventListener("pointerdown", onPointerDown);

  const keyboard = createKeyboard((e: InputEvent) => {
    switch (e.type) {
      case "pause":
        togglePause();
        break;
      case "confirm":
        if (state !== "playing") modal?.confirm();
        break;
      case "answer":
        answer(e.index);
        break;
      case "move": {
        if (state !== "playing") break;
        // Cycle among threats sorted by closeness to the station (lowest Y first).
        const threats = aimable().sort((a, b) => distToImpact(a) - distToImpact(b) || a.y - b.y);
        if (threats.length === 0) break;
        const idx = Math.max(0, threats.findIndex((b) => b.id === selectedId));
        const next =
          e.dir === "left" || e.dir === "up"
            ? threats[(idx - 1 + threats.length) % threats.length]
            : threats[(idx + 1) % threats.length];
        selectedId = next.id;
        aimLock = true;
        showTaskForSelection();
        break;
      }
    }
  });

  function updateBodies(dt: number): void {
    for (const body of bodies) {
      if (body.hitFlash > 0) body.hitFlash = Math.max(0, body.hitFlash - dt * 2.5);
      if (body.burning) {
        body.burnTimer -= dt;
        continue;
      }
      const dx = body.targetX - body.x;
      const dy = IMPACT_Y - body.y;
      const dist = Math.hypot(dx, dy);
      if (body.y <= IMPACT_Y + 0.04 || dist < 0.2) {
        impact(body);
        continue;
      }
      // Faster while still far (off-screen or just entering); slower near the deck.
      const step = Math.min(body.speed * approachSpeedScale(dist) * dt, dist);
      body.x += (dx / dist) * step;
      body.y += (dy / dist) * step;
      body.z *= 0.985;
    }
    bodies = bodies.filter((b) => !(b.burning && b.burnTimer <= 0));
    const current = selectedBody();
    if (!current) {
      aimLock = false;
      pickDefaultTarget();
      if (feedbackTimer <= 0) showTaskForSelection();
      return;
    }
    if (aimLock || feedbackTimer > 0) return;
    // No manual target: keep auto-aim on the rock closest to impact.
    const closest = activeThreats().sort((a, b) => distToImpact(a) - distToImpact(b) || a.y - b.y)[0];
    if (!closest || closest.id === selectedId) return;
    const unlockedPickup = current.kind !== "asteroid";
    if (unlockedPickup || distToImpact(current) > distToImpact(closest) + 0.05) {
      selectedId = closest.id;
      showTaskForSelection();
    }
  }

  function update(dt: number): void {
    time += dt;
    if (state === "playing") {
      if (spawnCooldown > 0) spawnCooldown -= dt;
      if (lifeCooldown > 0) lifeCooldown -= dt;
      tryReleaseFromQueue();
      if (feedbackTimer > 0) {
        feedbackTimer -= dt;
        if (feedbackTimer <= 0) {
          if (!selectedBody()) {
            aimLock = false;
            pickDefaultTarget();
          }
          showTaskForSelection();
        }
      }
      updateBodies(dt);
      for (const shot of shots) shot.life -= dt;
      shots = shots.filter((s) => s.life > 0);

      const pickupFlying = bodies.some((b) => b.kind !== "asteroid" && !b.burning);
      const queueEmpty = pendingLabels.length === 0 && !pendingBonus && !pendingLife && !pickupFlying;
      if (
        queueEmpty &&
        activeThreats().length === 0 &&
        bodies.every((b) => b.kind !== "asteroid" || b.burning)
      ) {
        if (bodies.filter((b) => b.kind === "asteroid").length === 0) {
          waveClearTimer += dt;
          if (waveClearTimer > 0.35) {
            waveClearTimer = 0;
            clearWave();
          }
        }
      } else {
        waveClearTimer = 0;
      }
    }

    const visuals: BodyVisual[] = bodies.map((b) => ({
      id: b.id,
      kind: b.kind,
      label: b.label,
      x: b.x,
      y: b.y,
      z: b.z,
      selected: b.id === selectedId,
      burning: b.burning,
      hitFlash: b.hitFlash,
    }));
    view.syncBodies(visuals);

    const shotVisuals: ShotVisual[] = shots.map((s) => ({
      id: s.id,
      from: s.from,
      to: s.to,
      life: s.life,
      maxLife: s.maxLife,
      success: s.success,
    }));
    view.syncShots(shotVisuals);
    const aim = selectedBody();
    view.setAimTarget(aim ? { x: aim.x, y: aim.y, z: aim.z } : null);
    view.update(dt, shields);
  }

  // Start from saved wave (level param maps to wave).
  setupRun();
  babylon.engine.runRenderLoop(() => {
    const dt = Math.min(0.1, babylon.engine.getDeltaTime() / 1000);
    update(dt);
    babylon.scene.render();
  });

  const onVisibility = () => {
    if (document.hidden && state === "playing") togglePause();
  };
  document.addEventListener("visibilitychange", onVisibility);

  return {
    dispose() {
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onPointerDown);
      keyboard.dispose();
      babylon.dispose();
      ctx.root.classList.remove("look-up");
      ctx.root.replaceChildren();
    },
  };
}

export const runtime: GameRuntime = { start };
