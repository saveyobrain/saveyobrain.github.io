export type TaskKind =
  | "add"
  | "sub"
  | "mul"
  | "div"
  | "percent"
  | "equation"
  | "twoStep";

export interface Tier {
  /** Max operand for + and -. */
  addMax: number;
  /** Max factor for x and / (times tables). */
  mulMax: number;
  /** Weighted kinds of tasks for this tier. */
  kinds: Partial<Record<TaskKind, number>>;
  options: 2 | 3 | 4;
}

export const TIERS: readonly Tier[] = [
  // 1: numbers up to 6, all four operations
  { addMax: 6, mulMax: 6, options: 2, kinds: { add: 3, sub: 3, mul: 2, div: 2 } },
  // 2: numbers up to 10
  { addMax: 10, mulMax: 10, options: 2, kinds: { add: 3, sub: 3, mul: 2, div: 2 } },
  // 3: numbers up to 15
  { addMax: 15, mulMax: 10, options: 2, kinds: { add: 3, sub: 3, mul: 2, div: 2 } },
  // 4: up to 20, times tables to 10, three options
  { addMax: 20, mulMax: 10, options: 3, kinds: { add: 3, sub: 3, mul: 3, div: 3 } },
  // 5: up to 100, times tables to 12
  { addMax: 100, mulMax: 12, options: 3, kinds: { add: 3, sub: 3, mul: 3, div: 3 } },
  // 6: percentages join, four options
  { addMax: 100, mulMax: 12, options: 4, kinds: { add: 2, sub: 2, mul: 2, div: 2, percent: 4 } },
  // 7: simple equations
  { addMax: 100, mulMax: 12, options: 4, kinds: { add: 1, sub: 1, mul: 2, div: 2, percent: 3, equation: 4 } },
  // 8: everything, including two-step expressions
  { addMax: 200, mulMax: 15, options: 4, kinds: { add: 1, sub: 1, mul: 2, div: 2, percent: 3, equation: 3, twoStep: 4 } },
];

/** Tier index (0-based) is clamped to the available tiers. */
export function getTier(index: number): Tier {
  return TIERS[Math.max(0, Math.min(TIERS.length - 1, index))];
}
