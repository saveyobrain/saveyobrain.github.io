import { beforeEach, describe, expect, it } from "vitest";
import { loadProgress, updateProgress } from "../src/core/storage";

const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage;

describe("progress storage", () => {
  beforeEach(() => store.clear());

  it("defaults to normal difficulty at level 1", () => {
    const p = loadProgress("game");
    expect(p.difficulty).toBe("normal");
    expect(p.levels).toEqual({ easy: 1, normal: 1, hard: 1, hardcore: 1, custom: 1 });
    expect(p.customMath).toEqual({ mul: true, div: false, tables: [2, 3, 4, 5] });
  });

  it("persists and sanitizes customMath", () => {
    updateProgress("game", (p) => {
      p.difficulty = "custom";
      p.customMath = { mul: false, div: true, tables: [2, 7, 7, 99, 10, 15, 20] };
    });
    const p = loadProgress("game");
    expect(p.difficulty).toBe("custom");
    expect(p.customMath).toEqual({ mul: false, div: true, tables: [2, 7, 10, 15, 20] });
  });

  it("falls back when customMath is invalid", () => {
    store.set(
      "saveyobrain:v1:game",
      JSON.stringify({ difficulty: "custom", levels: { custom: 3 }, customMath: { mul: false, div: false, tables: [] } }),
    );
    expect(loadProgress("game").customMath).toEqual({ mul: true, div: false, tables: [2, 3, 4, 5] });
  });

  it("keeps levels per difficulty", () => {
    updateProgress("game", (p) => {
      p.difficulty = "hard";
      p.levels.hard = 4;
    });
    const p = loadProgress("game");
    expect(p.difficulty).toBe("hard");
    expect(p.levels.hard).toBe(4);
    expect(p.levels.normal).toBe(1);
  });

  it("moves saves from before difficulties to easy", () => {
    store.set("saveyobrain:v1:game", JSON.stringify({ level: 7 }));
    const p = loadProgress("game");
    expect(p.levels.easy).toBe(7);
    expect(p.levels.normal).toBe(1);
    expect(p.difficulty).toBe("normal");
  });

  it("ignores corrupt data", () => {
    store.set("saveyobrain:v1:game", "{not json");
    expect(loadProgress("game").levels.normal).toBe(1);
  });
});
