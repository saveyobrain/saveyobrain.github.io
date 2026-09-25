import { Color4 } from "@babylonjs/core/Maths/math.color";
import { createBabylon } from "../../core/engine";
import type { GameContext, GameInstance, GameRuntime, StartOptions } from "../../core/game";
import { createKeyboard, type InputEvent } from "../../core/input";
import { createRng } from "../../core/math/rng";
import { generateTask, type MathTask } from "../../core/math/tasks";
import { loadProgress, saveProgress } from "../../core/storage";
import { h } from "../../core/ui/dom";
import { createHud } from "../../core/ui/hud";
import { showModal, type Modal } from "../../core/ui/modal";
import { createTaskPanel } from "../../core/ui/taskPanel";
import { strings } from "../../strings";
import { Candle } from "./candle";
import { levelConfig, type LevelConfig } from "./levels";
import { findPath, generateMaze, isWall, type Maze, type Tile } from "./maze";
import { Player } from "./player";
import { MazeView, paletteFor } from "./render";

const GAME_ID = "save-the-light";
const FEEDBACK_CORRECT_SECONDS = 0.45;
const FEEDBACK_WRONG_SECONDS = 1.2;

type State = "intro" | "playing" | "paused" | "won" | "lost";

function start(ctx: GameContext, options: StartOptions): GameInstance {
  const t = strings.stl;
  const canvas = h("canvas", { class: "game-canvas", "aria-label": t.title });
  const stage = h("div", { class: "stage" }, canvas);
  ctx.root.append(stage);

  const babylon = createBabylon(canvas, new Color4(0.89, 0.88, 0.86, 1));
  const view = new MazeView(babylon.scene);
  const rng = createRng();

  let state: State = "intro";
  let modal: Modal | null = null;
  let level = options.level ?? loadProgress(GAME_ID).level;
  let cfg: LevelConfig = levelConfig(level);
  let maze: Maze;
  let player: Player;
  let candle = new Candle();
  let task: MathTask | undefined;
  let feedbackTimer = 0;
  let solved = 0;
  let attempted = 0;
  let time = 0;

  const hud = createHud("\u{1F56F}\uFE0F", () => togglePause());
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

  function nextTask(): void {
    task = generateTask(cfg.mathTier, rng, task);
    panel.show(task);
    panel.setEnabled(state === "playing");
  }

  function setupLevel(): void {
    cfg = levelConfig(level);
    maze = generateMaze(cfg.cellsWide, cfg.cellsHigh, cfg.loopChance, rng);
    player = new Player(maze);
    candle = new Candle();
    solved = 0;
    attempted = 0;
    feedbackTimer = 0;
    view.setMaze(maze, paletteFor(level));
    hud.setLevel(level);
    hud.setMeter(candle.fuel);
    hud.setInfo("");
    state = "intro";
    nextTask();
    panel.setEnabled(false);

    const lines = [t.introGoal, t.exitHint];
    if (level === 1 || !sessionStorage.getItem("stl-controls-seen")) lines.push(t.controls);
    sessionStorage.setItem("stl-controls-seen", "1");
    openModal({
      title: strings.level(level),
      lines,
      buttons: [
        { label: strings.start, primary: true, onClick: play },
        { label: strings.backToGames, onClick: ctx.exit },
      ],
    });
  }

  function play(): void {
    closeModal();
    state = "playing";
    panel.setEnabled(feedbackTimer <= 0);
  }

  function togglePause(): void {
    if (state === "playing") {
      state = "paused";
      panel.setEnabled(false);
      openModal({
        title: strings.paused,
        buttons: [
          { label: strings.resume, primary: true, onClick: play },
          { label: strings.restartLevel, onClick: setupLevel },
          { label: strings.backToGames, onClick: ctx.exit },
        ],
      });
    } else if (state === "paused") {
      play();
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
    } else {
      // Guessing at random should never pay off: the penalty balances the odds.
      candle.add(-cfg.fuelPerCorrect / (task.options.length - 1));
    }
    hud.setInfo(`\u2714 ${solved}`);
    panel.showResult(index, correctIndex);
    panel.setEnabled(false);
    feedbackTimer = correct ? FEEDBACK_CORRECT_SECONDS : FEEDBACK_WRONG_SECONDS;
  }

  function win(): void {
    state = "won";
    panel.setEnabled(false);
    const progress = loadProgress(GAME_ID);
    if (level + 1 > progress.level) saveProgress(GAME_ID, { level: level + 1 });
    openModal({
      title: t.levelComplete,
      lines: attempted > 0 ? [strings.solved(solved, attempted)] : [],
      buttons: [
        {
          label: strings.nextLevel,
          primary: true,
          onClick: () => {
            level++;
            setupLevel();
          },
        },
        { label: strings.backToGames, onClick: ctx.exit },
      ],
    });
  }

  function lose(): void {
    state = "lost";
    panel.setEnabled(false);
    openModal({
      title: t.candleOut,
      lines: [t.candleOutHint],
      buttons: [
        { label: strings.tryAgain, primary: true, onClick: setupLevel },
        { label: strings.backToGames, onClick: ctx.exit },
      ],
    });
  }

  function isLit(x: number, y: number, radius: number): boolean {
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
        if (state !== "playing") modal?.confirm();
        break;
      case "answer":
        answer(e.index);
        break;
      case "move":
        if (state === "playing") player.queue(e.dir);
        break;
    }
  });

  function update(dt: number): void {
    time += dt;
    if (state === "playing") {
      if (feedbackTimer > 0) {
        feedbackTimer -= dt;
        if (feedbackTimer <= 0) nextTask();
      }
      candle.burn(dt, cfg.burnPerSecond);
      player.update(dt, keyboard.heldDirection(), (tile) => {
        if (tile.x === maze.exit.x && tile.y === maze.exit.y) {
          win();
          return true;
        }
        return false;
      });
      hud.setMeter(candle.fuel);
      if (state === "playing" && candle.isOut) lose();
    }
    currentRadius = candle.radius(state === "playing" ? dt : 0, time);
    view.update(dt, { player: player.pos, radius: currentRadius, warmth: candle.flare, time });
  }

  setupLevel();
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
      ctx.root.replaceChildren();
    },
  };
}

export const runtime: GameRuntime = { start };
