import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/math/rng";
import {
  allDivisors,
  applySplit,
  burnsHarmlessly,
  choiceOptions,
  isValidSplit,
  pickComposite,
  splitDivisors,
} from "../src/games/look-up/math";

describe("look-up math", () => {
  it("lists divisors and proper split divisors", () => {
    expect(allDivisors(12)).toEqual([1, 2, 3, 4, 6, 12]);
    expect(splitDivisors(12)).toEqual([2, 3, 4, 6]);
    expect(splitDivisors(9)).toEqual([3]);
    expect(splitDivisors(15)).toEqual([3, 5]);
    expect(splitDivisors(7)).toEqual([]);
    expect(splitDivisors(2)).toEqual([]);
    expect(splitDivisors(4)).toEqual([2]);
  });

  it("burns odd primes and 2 (nothing left but 1 or self)", () => {
    expect(burnsHarmlessly(2)).toBe(true);
    expect(burnsHarmlessly(3)).toBe(true);
    expect(burnsHarmlessly(5)).toBe(true);
    expect(burnsHarmlessly(11)).toBe(true);
    expect(burnsHarmlessly(9)).toBe(false);
    expect(burnsHarmlessly(15)).toBe(false);
    expect(burnsHarmlessly(4)).toBe(false);
    expect(burnsHarmlessly(1)).toBe(false);
  });

  it("accepts valid splits and rejects 1 / self / non-divisors", () => {
    expect(isValidSplit(12, 2)).toBe(true);
    expect(isValidSplit(12, 1)).toBe(false);
    expect(isValidSplit(12, 12)).toBe(false);
    expect(isValidSplit(12, 5)).toBe(false);
    expect(isValidSplit(9, 3)).toBe(true);
  });

  it("splits into D children labeled N/D and never emits 1", () => {
    expect(applySplit(12, 3)).toEqual({ ok: true, children: [4, 4, 4] });
    expect(applySplit(12, 2)).toEqual({ ok: true, children: [6, 6] });
    expect(applySplit(9, 3)).toEqual({ ok: true, children: [3, 3, 3] });
    expect(applySplit(15, 5)).toEqual({ ok: true, children: [3, 3, 3, 3, 3] });
    expect(applySplit(12, 5)).toEqual({ ok: false, reason: "invalid" });
    expect(applySplit(12, 1)).toEqual({ ok: false, reason: "invalid" });
    expect(applySplit(12, 12)).toEqual({ ok: false, reason: "invalid" });

    for (const d of splitDivisors(30)) {
      const result = applySplit(30, d);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.children).toHaveLength(d);
        expect(result.children.every((c) => c === 30 / d && c >= 2)).toBe(true);
      }
    }
  });

  it("builds 4-choice options without 1 or N, including real divisors", () => {
    const rng = createRng(42);
    const opts = choiceOptions(12, 4, rng);
    expect(opts).toHaveLength(4);
    expect(opts.includes(1)).toBe(false);
    expect(opts.includes(12)).toBe(false);
    for (const d of splitDivisors(12)) expect(opts.includes(d)).toBe(true);

    const primeOpts = choiceOptions(7, 4, rng);
    expect(primeOpts).toEqual([]);
  });

  it("picks composites that can still be split", () => {
    const rng = createRng(7);
    for (let i = 0; i < 30; i++) {
      const n = pickComposite(rng, 4, 40);
      expect(splitDivisors(n).length).toBeGreaterThan(0);
      expect(n).toBeGreaterThanOrEqual(4);
      expect(n).toBeLessThanOrEqual(40);
    }
  });

  it("lets odd composites keep splitting until primes burn", () => {
    const first = applySplit(45, 5);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.children).toEqual([9, 9, 9, 9, 9]);
    const second = applySplit(9, 3);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.children.every((c) => c === 3 && burnsHarmlessly(c))).toBe(true);
  });
});
