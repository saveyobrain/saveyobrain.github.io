import { Color4 } from "@babylonjs/core/Maths/math.color";
import { createBabylon } from "../../core/engine";
import type { GameContext, GameInstance, GameRuntime, StartOptions } from "../../core/game";
import { createKeyboard, type InputEvent } from "../../core/input";
import { createRng } from "../../core/math/rng";
import { generateTask, type MathTask } from "../../core/math/tasks";
import { DIFFICULTIES, type Difficulty } from "../../core/difficulty";
import { loadProgress, updateProgress } from "../../core/storage";
import { track } from "../../analytics";
import { SUPPORT_PAGE_PATH } from "../../config";
import { h } from "../../core/ui/dom";
import { createCoach, loadCoachFlags, markCoachFlag } from "../../core/ui/coach";
import { createHud, type MapProgressPhase } from "../../core/ui/hud";
import { showModal, type Modal, type ModalButton } from "../../core/ui/modal";
import { createTaskPanel } from "../../core/ui/taskPanel";
import { localizePath } from "../../i18n/locales";
import { getActiveLocale, getStrings } from "../../i18n/strings";
import { Candle } from "./candle";
import { levelConfig, type LevelConfig } from "./levels";
import { findPath, generateMaze, isWall, type Maze, type Tile } from "./maze";
import { Player } from "./player";
import { MazeView, paletteFor } from "./render";

const GAME_ID = "save-the-light";
const FEEDBACK_CORRECT_SECONDS = 0.45;
const FEEDBACK_WRONG_SECONDS = 1.2;
/** Fuel fraction that triggers critical light/HUD pulse. */
const CRITICAL_FUEL = 0.25;
/** First-run coach: nudge to solve once fuel drops this far with 0 solves. */
const COACH_SOLVE_FUEL = 0.5;
const DECRYPT_TOAST_SECONDS = 2.5;
/** World tiles above the player for the decrypt toast. */
const TOAST_OFFSET_TILES = 1.1;

/** After completing these levels (and every 3rd level from 15 onward), offer Support. */
function showSupportAfterLevel(n: number): boolean {
  if (n === 3 || n === 7 || n === 10) return true;
  return n >= 15 && (n - 15) % 3 === 0;
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

type State = "intro" | "playing" | "paused" | "won" | "lost";
type MapPhase = "none" | "found" | "decrypted";

function start(ctx: GameContext, options: StartOptions): GameInstance {
  const strings = getStrings();
  const t = strings.stl;
  const canvas = h("canvas", { class: "game-canvas", "aria-label": t.title });
  const stage = h("div", { class: "stage" }, canvas);
  ctx.root.append(stage);

  const babylon = createBabylon(canvas, new Color4(0.89, 0.88, 0.86, 1));
  const view = new MazeView(babylon.scene);
  const rng = createRng();

  let state: State = "intro";
  let modal: Modal | null = null;
  const saved = loadProgress(GAME_ID);
  let difficulty: Difficulty = saved.difficulty;
  let level = options.level ?? saved.levels[difficulty];
  let cfg: LevelConfig = levelConfig(level, difficulty);
  let maze: Maze;
  let player: Player;
  let candle = new Candle();
  let task: MathTask | undefined;
  let feedbackTimer = 0;
  let solved = 0;
  let attempted = 0;
  let time = 0;
  let winTimeout = 0;
  let mapPhase: MapPhase = "none";

  const hud = createHud("\u{1F56F}\uFE0F", () => togglePause());
  const toast = h("div", { class: "hud-toast", role: "status" });
  stage.append(hud.el, toast);
  let toastTimer = 0;

  const panel = createTaskPanel((i) => answer(i));
  ctx.root.append(panel.el);

  const coach = createCoach();
  const coachFlags = loadCoachFlags();
  let needSolveCoach = !coachFlags.solve;
  let needMeterCoach = !coachFlags.meter;
  let pendingMeterCoach = false;

  function mapHudPhase(): MapProgressPhase {
    if (mapPhase === "decrypted") return "done";
    if (mapPhase === "found") return "ready";
    return "filling";
  }

  function syncStatusHud(): void {
    hud.setSolved(solved);
    hud.setMapProgress(solved, cfg.mapUnlockAt, mapHudPhase());
  }

  function showDecryptToast(): void {
    toast.textContent = t.mapDecryptedToast;
    toast.classList.add("visible");
    toastTimer = DECRYPT_TOAST_SECONDS;
  }

  function positionToast(): void {
    if (toastTimer <= 0) return;
    const { u, v } = view.worldToScreen(player.pos.x, player.pos.y - TOAST_OFFSET_TILES);
    toast.style.left = `${u * 100}%`;
    toast.style.top = `${v * 100}%`;
  }

  function endCoachAndPlay(): void {
    state = "playing";
    panel.setEnabled(feedbackTimer <= 0);
  }

  function showSolveCoach(): void {
    if (!needSolveCoach || coach.active) return;
    needSolveCoach = false;
    state = "paused";
    panel.setEnabled(false);
    closeModal();
    coach.show({
      root: ctx.root,
      focus: "task",
      message: t.coachSolveHint,
      buttonLabel: t.coachSolveButton,
      spotlight: panel.el,
      onDone: () => {
        markCoachFlag("solve");
        endCoachAndPlay();
      },
    });
  }

  function showMeterCoach(): void {
    if (!needMeterCoach || coach.active) return;
    needMeterCoach = false;
    pendingMeterCoach = false;
    state = "paused";
    panel.setEnabled(false);
    closeModal();
    coach.show({
      root: ctx.root,
      focus: "fuel",
      message: t.coachMeterHint,
      buttonLabel: strings.ok,
      spotlight: hud.fuelMeter,
      onDone: () => {
        markCoachFlag("meter");
        endCoachAndPlay();
      },
    });
  }

  function openModal(options: Parameters<typeof showModal>[1]): void {
    modal?.close();
    modal = showModal(ctx.root, options);
  }

  function closeModal(): void {
    modal?.close();
    modal = null;
  }

  function nextTask(): void {
    task = generateTask(cfg.mathTier, rng, task, {
      allowTrivial: level === 1 && difficulty === "easy",
    });
    panel.show(task);
    panel.setEnabled(state === "playing");
  }

  function isOnExit(): boolean {
    return player.tile.x === maze.exit.x && player.tile.y === maze.exit.y;
  }

  function setupLevel(withIntro = true): void {
    cfg = levelConfig(level, difficulty);
    maze = generateMaze(cfg.cellsWide, cfg.cellsHigh, cfg.loopChance, rng);
    player = new Player(maze);
    candle = new Candle(cfg.lightScale);
    solved = 0;
    attempted = 0;
    feedbackTimer = 0;
    mapPhase = "none";
    view.setMaze(maze, paletteFor(level));
    hud.setLevel(strings.levelWithDifficulty(level, strings.difficulty[difficulty]));
    hud.setMeter(candle.fuel);
    syncStatusHud();
    toast.classList.remove("visible");
    toastTimer = 0;
    state = "intro";
    task = undefined;
    nextTask();
    panel.setEnabled(false);
    if (withIntro) showIntro();
    else play();
  }

  function showIntro(): void {
    const lines = [strings.difficultyLine(strings.difficulty[difficulty]), t.introGoal, t.exitHint];
    if (level === 1 || !sessionStorage.getItem("stl-controls-seen")) lines.push(t.controls);
    sessionStorage.setItem("stl-controls-seen", "1");
    openModal({
      title: strings.level(level),
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
      choices: DIFFICULTIES.map((d) => ({
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
    level = updateProgress(GAME_ID, (p) => {
      p.difficulty = next;
    }).levels[next];
    setupLevel();
  }

  function play(): void {
    // Resume / info-dismiss also call play(); only count intro → playing as a start.
    const starting = state === "intro";
    closeModal();
    if (pendingMeterCoach) {
      showMeterCoach();
      if (starting) track("game_start", { game_id: GAME_ID, level, difficulty });
      return;
    }
    state = "playing";
    panel.setEnabled(feedbackTimer <= 0);
    if (starting) track("game_start", { game_id: GAME_ID, level, difficulty });
  }

  function pauseForInfo(title: string, lines: string[]): void {
    state = "paused";
    panel.setEnabled(false);
    openModal({
      title,
      lines,
      buttons: [{ label: strings.ok, primary: true, onClick: play }],
    });
  }

  function showExitGate(): void {
    pauseForInfo(t.exitLocked, [t.exitLockedHint]);
  }

  function showMapFound(): void {
    pauseForInfo(t.mapFound, [t.mapFoundHint]);
  }

  function togglePause(): void {
    if (coach.active) {
      coach.confirm();
      return;
    }
    if (state === "playing") {
      state = "paused";
      panel.setEnabled(false);
      openModal({
        title: strings.menu,
        lines: [strings.paused],
        buttons: [
          { label: strings.resume, primary: true, onClick: play },
          { label: strings.restartLevel, onClick: setupLevel },
          feedbackButton(),
          { label: strings.backToGames, onClick: ctx.exit },
        ],
      });
    } else if (state === "paused") {
      play();
    }
  }

  function advanceMapOnSolve(): void {
    if (mapPhase === "found") {
      mapPhase = "decrypted";
      showDecryptToast();
      return;
    }
    if (mapPhase === "none" && solved >= cfg.mapUnlockAt) {
      mapPhase = "found";
      showMapFound();
    }
  }

  function answer(index: number): void {
    if (state !== "playing" || feedbackTimer > 0 || !task || index >= task.options.length) return;
    const correctIndex = task.options.indexOf(task.answer);
    const correct = index === correctIndex;
    attempted++;
    if (correct) {
      solved++;
      candle.add(cfg.fuelPerCorrect);
      if (isOnExit()) {
        win();
        return;
      }
      advanceMapOnSolve();
      if (needMeterCoach) pendingMeterCoach = true;
    } else {
      // Guessing at random should never pay off: the penalty balances the odds.
      candle.add((-cfg.fuelPerCorrect / (task.options.length - 1)) * cfg.penaltyScale);
    }
    syncStatusHud();
    panel.showResult(index, correctIndex);
    panel.setEnabled(false);
    feedbackTimer = correct ? FEEDBACK_CORRECT_SECONDS : FEEDBACK_WRONG_SECONDS;
    // Meter tip after the first correct answer (wait if a map modal just opened).
    if (correct && pendingMeterCoach && state === "playing") showMeterCoach();
  }

  function win(): void {
    state = "won";
    panel.setEnabled(false);
    view.openDoor();
    track("level_complete", { game_id: GAME_ID, level, difficulty });
    updateProgress(GAME_ID, (p) => {
      p.difficulty = difficulty;
      p.levels[difficulty] = Math.max(p.levels[difficulty], level + 1);
    });
    winTimeout = window.setTimeout(showWinCard, 700);
  }

  function showWinCard(): void {
    const buttons: ModalButton[] = [
      {
        label: strings.nextLevel,
        primary: true,
        onClick: () => {
          level++;
          setupLevel(false);
        },
      },
      feedbackButton(),
    ];
    if (showSupportAfterLevel(level)) buttons.push(supportButton());
    buttons.push({ label: strings.backToGames, onClick: ctx.exit });

    openModal({
      title: t.levelComplete,
      lines: attempted > 0 ? [strings.solved(solved, attempted)] : [],
      buttons,
    });
  }

  function lose(): void {
    state = "lost";
    panel.setEnabled(false);
    track("level_fail", { game_id: GAME_ID, level, difficulty });
    openModal({
      title: t.candleOut,
      lines: [t.candleOutHint],
      buttons: [
        { label: strings.tryAgain, primary: true, onClick: setupLevel },
        feedbackButton(),
        { label: strings.backToGames, onClick: ctx.exit },
      ],
    });
  }

  function isLit(x: number, y: number, radius: number): boolean {
    if (mapPhase === "decrypted" && cfg.mapRevealsFog) return true;
    const dx = x - player.pos.x;
    const dy = y - player.pos.y;
    return dx * dx + dy * dy <= radius * radius;
  }

  let currentRadius = 0;

  function onPointerDown(e: PointerEvent): void {
    if (state !== "playing") return;
    const target: Tile = view.tileAt(canvas, e.clientX, e.clientY);
    const reach = currentRadius * 0.9;
    if (isWall(maze, target.x, target.y) || !isLit(target.x, target.y, reach)) return;
    const path = findPath(maze, player.tile, target, (x, y) => isLit(x, y, reach));
    if (path) player.followPath(path);
  }
  canvas.addEventListener("pointerdown", onPointerDown);

  const keyboard = createKeyboard((e: InputEvent) => {
    switch (e.type) {
      case "pause":
        togglePause();
        break;
      case "confirm":
        if (coach.active) coach.confirm();
        else if (state !== "playing") modal?.confirm();
        break;
      case "answer":
        if (!coach.active) answer(e.index);
        break;
      case "move":
        if (state === "playing" && !coach.active) player.queue(e.dir);
        break;
    }
  });

  function update(dt: number): void {
    time += dt;
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) toast.classList.remove("visible");
    }
    if (state === "playing") {
      if (feedbackTimer > 0) {
        feedbackTimer -= dt;
        if (feedbackTimer <= 0) nextTask();
      }
      player.update(dt, keyboard.heldDirection(), (tile) => {
        if (tile.x === maze.exit.x && tile.y === maze.exit.y) {
          if (solved < 1) {
            showExitGate();
            return true;
          }
          win();
          return true;
        }
        return false;
      });
      candle.burn(dt, player.isMoving ? cfg.moveBurnPerSecond : cfg.burnPerSecond);
      hud.setMeter(candle.fuel);
      if (state === "playing" && candle.isOut) lose();
      else if (needSolveCoach && solved === 0 && candle.fuel <= COACH_SOLVE_FUEL) showSolveCoach();
    }
    currentRadius = candle.radius(state === "playing" ? dt : 0, time);
    const criticalFuel = candle.fuel > 0 && candle.fuel < CRITICAL_FUEL;
    view.update(dt, {
      player: player.pos,
      moving: state === "playing" && player.isMoving,
      facing: player.facing,
      radius: currentRadius,
      warmth: candle.flare,
      time,
      showExitPath: mapPhase === "decrypted" && !cfg.mapRevealsFog,
      pathFrom: player.tile,
      revealMap: mapPhase === "decrypted" && cfg.mapRevealsFog,
      criticalFuel,
      fuel: candle.fuel,
    });
    positionToast();
  }

  setupLevel();
  babylon.engine.runRenderLoop(() => {
    const dt = Math.min(0.1, babylon.engine.getDeltaTime() / 1000);
    update(dt);
    babylon.scene.render();
  });

  const onVisibility = () => {
    if (document.hidden && state === "playing" && !coach.active) togglePause();
  };
  document.addEventListener("visibilitychange", onVisibility);

  return {
    dispose() {
      window.clearTimeout(winTimeout);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onPointerDown);
      keyboard.dispose();
      coach.hide();
      babylon.dispose();
      ctx.root.replaceChildren();
    },
  };
}

export const runtime: GameRuntime = { start };
