import type { Rng } from "../../core/math/rng";

export interface Tile {
  x: number;
  y: number;
}

export interface Maze {
  /** Tile grid size (walls are tiles too). */
  width: number;
  height: number;
  /** walls[y * width + x] */
  walls: boolean[];
  start: Tile;
  exit: Tile;
}

export function isWall(maze: Maze, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= maze.width || y >= maze.height) return true;
  return maze.walls[y * maze.width + x];
}

const STEPS: readonly Tile[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

/** Breadth-first distances from `from` over floor tiles (-1 = unreachable). */
export function distancesFrom(maze: Maze, from: Tile, canEnter?: (x: number, y: number) => boolean): Int32Array {
  const dist = new Int32Array(maze.width * maze.height).fill(-1);
  const queue: number[] = [from.y * maze.width + from.x];
  dist[queue[0]] = 0;
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    const cx = cur % maze.width;
    const cy = (cur - cx) / maze.width;
    for (const s of STEPS) {
      const nx = cx + s.x;
      const ny = cy + s.y;
      if (isWall(maze, nx, ny)) continue;
      const ni = ny * maze.width + nx;
      if (dist[ni] >= 0 || (canEnter && !canEnter(nx, ny))) continue;
      dist[ni] = dist[cur] + 1;
      queue.push(ni);
    }
  }
  return dist;
}

/** Shortest path from `from` to `to` (excluding `from`), or null if unreachable. */
export function findPath(maze: Maze, from: Tile, to: Tile, canEnter?: (x: number, y: number) => boolean): Tile[] | null {
  const dist = distancesFrom(maze, to, canEnter);
  if (dist[from.y * maze.width + from.x] < 0) return null;
  const path: Tile[] = [];
  let cur = from;
  while (cur.x !== to.x || cur.y !== to.y) {
    const d = dist[cur.y * maze.width + cur.x];
    const next = STEPS.map((s) => ({ x: cur.x + s.x, y: cur.y + s.y })).find(
      (t) => !isWall(maze, t.x, t.y) && dist[t.y * maze.width + t.x] === d - 1,
    );
    if (!next) return null;
    path.push(next);
    cur = next;
  }
  return path;
}

/** Recursive-backtracker maze with optional extra openings (loops). Exit is the farthest tile from the start. */
export function generateMaze(cellsWide: number, cellsHigh: number, loopChance: number, rng: Rng): Maze {
  const width = cellsWide * 2 + 1;
  const height = cellsHigh * 2 + 1;
  const walls = new Array<boolean>(width * height).fill(true);
  const open = (x: number, y: number) => {
    walls[y * width + x] = false;
  };

  const visited = new Uint8Array(cellsWide * cellsHigh);
  const stack: Tile[] = [{ x: 0, y: 0 }];
  visited[0] = 1;
  open(1, 1);
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const options = STEPS.map((s) => ({ x: cur.x + s.x, y: cur.y + s.y })).filter(
      (c) => c.x >= 0 && c.y >= 0 && c.x < cellsWide && c.y < cellsHigh && !visited[c.y * cellsWide + c.x],
    );
    if (!options.length) {
      stack.pop();
      continue;
    }
    const next = rng.pick(options);
    visited[next.y * cellsWide + next.x] = 1;
    open(cur.x + next.x + 1, cur.y + next.y + 1);
    open(next.x * 2 + 1, next.y * 2 + 1);
    stack.push(next);
  }

  // Knock out some interior walls that sit between two floor cells.
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (!walls[y * width + x]) continue;
      const horizontal = x % 2 === 0 && y % 2 === 1;
      const vertical = x % 2 === 1 && y % 2 === 0;
      if ((horizontal || vertical) && rng.chance(loopChance)) open(x, y);
    }
  }

  const maze: Maze = { width, height, walls, start: { x: 1, y: 1 }, exit: { x: 1, y: 1 } };
  const dist = distancesFrom(maze, maze.start);
  let best = 0;
  for (let i = 0; i < dist.length; i++) if (dist[i] > dist[best]) best = i;
  maze.exit = { x: best % width, y: Math.floor(best / width) };
  return maze;
}
