import type { Scene } from "@babylonjs/core/scene";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { TargetCamera } from "@babylonjs/core/Cameras/targetCamera";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { PostProcess } from "@babylonjs/core/PostProcesses/postProcess";
import { Character } from "./character";
import { Door } from "./door";
import { isWall, type Maze, type Tile } from "./maze";
import { LIGHT_SHADER, LIGHT_UNIFORMS } from "./lightShader";

/** Smaller screen side always shows this many tiles (fewer in portrait for bigger tap targets). */
const MIN_VISIBLE_TILES = 12;
const MIN_VISIBLE_TILES_PORTRAIT = 10;

export interface Palette {
  floorA: string;
  floorB: string;
  wallTop: string;
  wallSide: string;
  shadow: string;
  fog: string;
}

/** Bright pastel palette; wall hue changes per level for variety. */
export function paletteFor(level: number): Palette {
  const hue = (200 + level * 47) % 360;
  return {
    floorA: "#fff6e3",
    floorB: "#fcecc9",
    wallTop: `hsl(${hue}, 62%, 78%)`,
    wallSide: `hsl(${hue}, 45%, 60%)`,
    shadow: "rgba(120, 90, 40, 0.14)",
    fog: "#e4e1dc",
  };
}

/** The camera may scroll this far past the maze edge so the HUD never covers the player. */
const EDGE_PADDING = 1.5;

function clampAxis(p: number, size: number, view: number): number {
  if (size + EDGE_PADDING * 2 <= view) return (size - 1) / 2;
  return Math.max(view / 2 - 0.5 - EDGE_PADDING, Math.min(size - 0.5 - view / 2 + EDGE_PADDING, p));
}

export interface FrameState {
  player: { x: number; y: number };
  moving: boolean;
  /** -1 left, 1 right, 0 keep current. */
  facing: number;
  /** Light radius in tiles. */
  radius: number;
  warmth: number;
  time: number;
}

/** Top-down orthographic view of the maze, player, exit and the candle-light post-process. */
export class MazeView {
  readonly camera: TargetCamera;
  private floor: Mesh | null = null;
  private floorTexture: DynamicTexture | null = null;
  private readonly character: Character;
  private readonly door: Door;
  private fog = Color3.FromHexString("#e4e1dc");
  private maze: Maze | null = null;
  private cam = { x: 0, y: 0, viewW: MIN_VISIBLE_TILES, viewH: MIN_VISIBLE_TILES };
  private snapCamera = true;
  private light = { x: 0, y: 0, radius: 0, warmth: 0, time: 0 };

  constructor(private readonly scene: Scene) {
    this.camera = new TargetCamera("camera", new Vector3(0, 0, -10), scene);
    this.camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
    this.camera.minZ = 0.1;
    this.camera.maxZ = 50;

    this.door = new Door(scene);
    this.character = new Character(scene);

    const post = new PostProcess("candleLight", LIGHT_SHADER, LIGHT_UNIFORMS, null, 1.0, this.camera);
    post.onApply = (effect) => {
      const engine = this.scene.getEngine();
      const w = engine.getRenderWidth();
      const h = engine.getRenderHeight();
      const { viewW, viewH, x: cx, y: cy } = this.cam;
      effect.setFloat2("uPlayer", ((this.light.x - cx) / viewW + 0.5) * w, ((cy - this.light.y) / viewH + 0.5) * h);
      effect.setFloat("uRadius", (this.light.radius * h) / viewH);
      effect.setColor3("uFog", this.fog);
      effect.setFloat("uTime", this.light.time);
      effect.setFloat("uWarmth", this.light.warmth);
    };
  }

  setMaze(maze: Maze, palette: Palette): void {
    this.maze = maze;
    this.fog = Color3.FromHexString(palette.fog);
    this.scene.clearColor.set(this.fog.r, this.fog.g, this.fog.b, 1);
    this.floor?.dispose(false, true);
    this.floorTexture?.dispose();

    const tilePx = Math.min(48, Math.floor(4096 / Math.max(maze.width, maze.height)));
    const tex = new DynamicTexture(
      "maze-texture",
      { width: maze.width * tilePx, height: maze.height * tilePx },
      this.scene,
      false,
      Texture.BILINEAR_SAMPLINGMODE,
    );
    tex.wrapU = Texture.CLAMP_ADDRESSMODE;
    tex.wrapV = Texture.CLAMP_ADDRESSMODE;
    drawMaze(tex.getContext() as unknown as CanvasRenderingContext2D, maze, palette, tilePx);
    tex.update();

    const floor = CreatePlane("floor", { width: maze.width, height: maze.height }, this.scene);
    const mat = new StandardMaterial("floor-mat", this.scene);
    mat.disableLighting = true;
    mat.emissiveTexture = tex;
    mat.backFaceCulling = false;
    floor.material = mat;
    floor.position.set((maze.width - 1) / 2, -(maze.height - 1) / 2, 1);
    floor.isPickable = false;

    this.floor = floor;
    this.floorTexture = tex;
    this.door.setPosition(maze.exit.x, -maze.exit.y);
    this.snapCamera = true;
  }

  openDoor(): void {
    this.door.open();
  }

  update(dt: number, frame: FrameState): void {
    if (!this.maze) return;
    const engine = this.scene.getEngine();
    const aspect = engine.getRenderWidth() / Math.max(1, engine.getRenderHeight());
    const viewH = aspect >= 1 ? MIN_VISIBLE_TILES : MIN_VISIBLE_TILES_PORTRAIT / aspect;
    const viewW = viewH * aspect;

    const tx = clampAxis(frame.player.x, this.maze.width, viewW);
    const ty = clampAxis(frame.player.y, this.maze.height, viewH);
    const k = this.snapCamera ? 1 : Math.min(1, dt * 8);
    this.snapCamera = false;
    this.cam = { x: this.cam.x + (tx - this.cam.x) * k, y: this.cam.y + (ty - this.cam.y) * k, viewW, viewH };

    this.camera.position.x = this.cam.x;
    this.camera.position.y = -this.cam.y;
    this.camera.orthoLeft = -viewW / 2;
    this.camera.orthoRight = viewW / 2;
    this.camera.orthoTop = viewH / 2;
    this.camera.orthoBottom = -viewH / 2;

    this.character.root.position.set(frame.player.x, -frame.player.y, 0);
    this.character.update(dt, frame.time, frame.moving, frame.facing, frame.warmth);
    this.door.update(dt, frame.time);

    this.light = { x: frame.player.x, y: frame.player.y, radius: frame.radius, warmth: frame.warmth, time: frame.time };
  }

  /** Tile under a screen point (client coordinates of `canvas`). */
  tileAt(canvas: HTMLCanvasElement, clientX: number, clientY: number): Tile {
    const rect = canvas.getBoundingClientRect();
    const u = (clientX - rect.left) / rect.width;
    const v = (clientY - rect.top) / rect.height;
    return {
      x: Math.round(this.cam.x + (u - 0.5) * this.cam.viewW),
      y: Math.round(this.cam.y + (v - 0.5) * this.cam.viewH),
    };
  }
}

function drawMaze(ctx: CanvasRenderingContext2D, maze: Maze, palette: Palette, t: number): void {
  const side = Math.round(t * 0.24);
  for (let y = 0; y < maze.height; y++) {
    for (let x = 0; x < maze.width; x++) {
      const px = x * t;
      const py = y * t;
      if (isWall(maze, x, y)) {
        ctx.fillStyle = palette.wallTop;
        ctx.fillRect(px, py, t, t);
        continue;
      }
      ctx.fillStyle = (x + y) % 2 === 0 ? palette.floorA : palette.floorB;
      ctx.fillRect(px, py, t, t);
      if (isWall(maze, x, y - 1)) {
        ctx.fillStyle = palette.shadow;
        ctx.fillRect(px, py, t, side * 0.8);
      }
      if (isWall(maze, x - 1, y)) {
        ctx.fillStyle = palette.shadow;
        ctx.fillRect(px, py, side * 0.5, t);
      }
    }
  }
  // Front faces of walls that sit above a floor tile give a soft "raised block" look.
  for (let y = 0; y < maze.height; y++) {
    for (let x = 0; x < maze.width; x++) {
      if (isWall(maze, x, y) && !isWall(maze, x, y + 1)) {
        ctx.fillStyle = palette.wallSide;
        ctx.fillRect(x * t, (y + 1) * t - side, t, side);
      }
    }
  }
}
