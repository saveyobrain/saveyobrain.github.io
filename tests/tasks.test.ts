import { describe, expect, it } from "vitest";
import { createRng } from "../src/core/math/rng";
import { generateTask } from "../src/core/math/tasks";
import { TIERS } from "../src/core/math/tiers";

/** Evaluates the displayed task text independently of the generator. */
function solve(text: string): number {
  const expr = text.replace(/\u2212/g, "-").replace(/\u00d7/g, "*").replace(/\u00f7/g, "/");
  const pct = expr.match(/^(\d+)% of (\d+)$/);
  if (pct) return (Number(pct[1]) * Number(pct[2])) / 100;
  if (expr.includes("=")) {
    const [lhs, rhs] = expr.split("=");
    for (let x = 0; x <= 10000; x++) {
      const value = Function(`"use strict"; return (${lhs.replace(/(\d)x/g, "$1*x").replace(/x/g, String(x))});`)();
      if (value === Number(rhs)) return x;
    }
    throw new Error(`no solution for ${text}`);
  }
  return Function(`"use strict"; return (${expr});`)();
}

describe("generateTask", () => {
  TIERS.forEach((tier, tierIndex) => {
    it(`tier ${tierIndex + 1}: correct answer, ${tier.options} unique non-negative integer options`, () => {
      const rng = createRng(1234 + tierIndex);
      for (let i = 0; i < 2000; i++) {
        const task = generateTask(tierIndex, rng);
        expect(solve(task.text), task.text).toBe(task.answer);
        expect(task.options).toHaveLength(tier.options);
        expect(new Set(task.options).size).toBe(tier.options);
        expect(task.options.filter((o) => o === task.answer)).toHaveLength(1);
        for (const o of task.options) {
          expect(Number.isInteger(o), `${task.text}: ${o}`).toBe(true);
          expect(o).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  it("tier 1 only uses numbers up to 6 as operands", () => {
    const rng = createRng(7);
    for (let i = 0; i < 2000; i++) {
      const task = generateTask(0, rng);
      const [a, b] = task.text.split(/ [^\d] /).map(Number);
      if (task.kind === "div") {
        expect(b).toBeLessThanOrEqual(6);
        expect(task.answer).toBeLessThanOrEqual(6);
      } else {
        expect(a).toBeLessThanOrEqual(6);
        expect(b).toBeLessThanOrEqual(6);
      }
    }
  });

  it("subtraction never subtracts a number from itself", () => {
    for (let tierIndex = 0; tierIndex < TIERS.length; tierIndex++) {
      const rng = createRng(42 + tierIndex);
      for (let i = 0; i < 2000; i++) {
        const task = generateTask(tierIndex, rng);
        if (task.kind !== "sub") continue;
        const [a, b] = task.text.split(/ [^\d] /).map(Number);
        expect(a, task.text).toBeGreaterThan(b);
        expect(task.answer, task.text).toBeGreaterThan(0);
      }
    }
  });

  it("without allowTrivial, avoids ±1, ×1, and n÷n style tasks", () => {
    for (let tierIndex = 0; tierIndex < TIERS.length; tierIndex++) {
      const rng = createRng(99 + tierIndex);
      for (let i = 0; i < 2000; i++) {
        const task = generateTask(tierIndex, rng);
        if (task.kind === "add" || task.kind === "sub" || task.kind === "mul") {
          const [a, b] = task.text.split(/ [^\d] /).map(Number);
          expect(a, task.text).toBeGreaterThanOrEqual(2);
          expect(b, task.text).toBeGreaterThanOrEqual(2);
        }
        if (task.kind === "div") {
          const [, b] = task.text.split(/ [^\d] /).map(Number);
          expect(b, task.text).toBeGreaterThanOrEqual(2);
          expect(task.answer, task.text).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it("is reproducible with the same seed", () => {
    const a = createRng(99);
    const b = createRng(99);
    for (let i = 0; i < 50; i++) expect(generateTask(4, a)).toEqual(generateTask(4, b));
  });

  it("custom mul: one factor from tables, other from 1…otherMax", () => {
    const tables = [2, 5, 10];
    const otherMax = 3;
    const rng = createRng(11);
    for (let i = 0; i < 500; i++) {
      const task = generateTask(0, rng, undefined, { tables, otherMax, kinds: { mul: 1 } });
      expect(task.kind).toBe("mul");
      expect(task.options).toHaveLength(2);
      const [a, b] = task.text.split(/ [^\d] /).map(Number);
      expect(tables.includes(a) || tables.includes(b), task.text).toBe(true);
      // Complementary factor is always ≤ otherMax (may also be in the tables set).
      expect(a <= otherMax || b <= otherMax, task.text).toBe(true);
      expect(solve(task.text)).toBe(task.answer);
    }
  });

  it("custom div: divisor from tables, quotient from 1…otherMax", () => {
    const tables = [3, 7];
    const otherMax = 5;
    const rng = createRng(22);
    for (let i = 0; i < 500; i++) {
      const task = generateTask(0, rng, undefined, { tables, otherMax, kinds: { div: 1 } });
      expect(task.kind).toBe("div");
      expect(task.options).toHaveLength(2);
      const [, b] = task.text.split(/ [^\d] /).map(Number);
      expect(tables, task.text).toContain(b);
      expect(task.answer, task.text).toBeGreaterThanOrEqual(1);
      expect(task.answer, task.text).toBeLessThanOrEqual(otherMax);
      expect(solve(task.text)).toBe(task.answer);
    }
  });
});
