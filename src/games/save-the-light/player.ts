import type { Direction } from "../../core/input";
import { isWall, type Maze, type Tile } from "./maze";

const DELTAS: Record<Direction, Tile> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const TILES_PER_SECOND = 6.5;

/** Tile-based movement with smooth interpolation between tiles. */
export class Player {
  tile: Tile;
  /** Interpolated position in tile units. */
  pos: { x: number; y: number };
  /** Last horizontal direction: -1 left, 1 right. */
  facing = 1;
  private from: Tile | null = null;
  private progress = 0;
  private queued: Direction | null = null;
  private path: Tile[] = [];

  constructor(private maze: Maze) {
    this.tile = { ...maze.start };
    this.pos = { ...maze.start };
  }

  get isMoving(): boolean {
    return this.from !== null;
  }

  /** A single key press: remembered so quick taps are never lost. */
  queue(dir: Direction): void {
    this.queued = dir;
    this.path = [];
  }

  followPath(path: Tile[]): void {
    this.queued = null;
    this.path = path;
  }

  /** Advances movement. `onArrive` runs on each reached tile; returning true stops the player there. */
  update(dt: number, held: Direction | null, onArrive: (tile: Tile) => boolean): void {
    let carry = 0;
    let stop = false;
    if (this.from) {
      this.progress += dt * TILES_PER_SECOND;
      if (this.progress >= 1) {
        carry = Math.min(this.progress - 1, 0.5);
        this.from = null;
        this.progress = 0;
        stop = onArrive(this.tile);
      }
    }

    if (!this.from && !stop) {
      const dir = this.queued ?? held;
      this.queued = null;
      if (dir) {
        this.path = [];
        this.step(DELTAS[dir]);
      } else if (this.path.length) {
        const next = this.path.shift()!;
        this.step({ x: next.x - this.tile.x, y: next.y - this.tile.y });
      }
      if (this.from) this.progress = carry;
    }

    if (this.from) {
      const t = this.progress;
      this.pos.x = this.from.x + (this.tile.x - this.from.x) * t;
      this.pos.y = this.from.y + (this.tile.y - this.from.y) * t;
    } else {
      this.pos.x = this.tile.x;
      this.pos.y = this.tile.y;
    }
  }

  private step(d: Tile): void {
    if (Math.abs(d.x) + Math.abs(d.y) !== 1) {
      this.path = [];
      return;
    }
    const nx = this.tile.x + d.x;
    const ny = this.tile.y + d.y;
    if (isWall(this.maze, nx, ny)) {
      this.path = [];
      return;
    }
    if (d.x !== 0) this.facing = d.x;
    this.from = { ...this.tile };
    this.tile = { x: nx, y: ny };
    this.progress = 0;
  }
}
