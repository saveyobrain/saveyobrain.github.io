import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/math/rng";
import { distancesFrom, findPath, generateMaze, isWall } from "../src/games/save-the-light/maze";
import { levelConfig } from "../src/games/save-the-light/levels";
import { DIFFICULTIES } from "../src/core/difficulty";

describe("generateMaze", () => {
  for (const [level, difficulty] of [[1, "easy"], [2, "normal"], [5, "hard"], [10, "hardcore"], [20, "normal"], [40, "hardcore"]] as const) {
    it(`level ${level} (${difficulty}): correct size, every cell reachable, exit far from start`, () => {
      const cfg = levelConfig(level, difficulty);
      for (let seed = 0; seed < 20; seed++) {
        const maze = generateMaze(cfg.cellsWide, cfg.cellsHigh, cfg.loopChance, createRng(seed));
        expect(maze.width).toBe(cfg.cellsWide * 2 + 1);
        expect(maze.height).toBe(cfg.cellsHigh * 2 + 1);

        for (let x = 0; x < maze.width; x++) {
          expect(isWall(maze, x, 0)).toBe(true);
          expect(isWall(maze, x, maze.height - 1)).toBe(true);
        }

        const dist = distancesFrom(maze, maze.start);
        for (let cy = 0; cy < cfg.cellsHigh; cy++) {
          for (let cx = 0; cx < cfg.cellsWide; cx++) {
            expect(dist[(cy * 2 + 1) * maze.width + cx * 2 + 1]).toBeGreaterThanOrEqual(0);
          }
        }
        const exitDist = dist[maze.exit.y * maze.width + maze.exit.x];
        expect(exitDist).toBeGreaterThanOrEqual(cfg.cellsWide + cfg.cellsHigh - 2);
      }
    });
  }

  it("findPath returns a contiguous walkable path", () => {
    const maze = generateMaze(8, 8, 0.05, createRng(3));
    const path = findPath(maze, maze.start, maze.exit)!;
    expect(path).not.toBeNull();
    let prev = maze.start;
    for (const t of path) {
      expect(isWall(maze, t.x, t.y)).toBe(false);
      expect(Math.abs(t.x - prev.x) + Math.abs(t.y - prev.y)).toBe(1);
      prev = t;
    }
    expect(prev).toEqual(maze.exit);
  });

  it("findPath respects canEnter", () => {
    const maze = generateMaze(8, 8, 0, createRng(4));
    expect(findPath(maze, maze.start, maze.exit, () => false)).toBeNull();
  });
});

describe("levelConfig", () => {
  it("gets harder with levels", () => {
    const a = levelConfig(1, "normal");
    const b = levelConfig(12, "normal");
    expect(b.cellsWide).toBeGreaterThan(a.cellsWide);
    expect(b.burnPerSecond).toBeGreaterThan(a.burnPerSecond);
    expect(b.mathTier).toBeGreaterThan(a.mathTier);
  });

  it("each difficulty is harder than the previous one", () => {
    for (const level of [1, 5, 10]) {
      const configs = DIFFICULTIES.map((d) => levelConfig(level, d));
      for (let i = 1; i < configs.length; i++) {
        const [prev, cur] = [configs[i - 1], configs[i]];
        expect(cur.burnPerSecond).toBeGreaterThan(prev.burnPerSecond);
        expect(cur.fuelPerCorrect).toBeLessThan(prev.fuelPerCorrect);
        expect(cur.cellsWide).toBeGreaterThanOrEqual(prev.cellsWide);
        expect(cur.mathTier).toBeGreaterThanOrEqual(prev.mathTier);
        expect(cur.lightScale).toBeLessThanOrEqual(prev.lightScale);
      }
    }
  });

  it("level 1 on easy and normal starts with the simplest math", () => {
    expect(levelConfig(1, "easy").mathTier).toBe(0);
    expect(levelConfig(1, "normal").mathTier).toBe(0);
  });
});
