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

  it("is reproducible with the same seed", () => {
    const a = createRng(99);
    const b = createRng(99);
    for (let i = 0; i < 50; i++) expect(generateTask(4, a)).toEqual(generateTask(4, b));
  });
});
