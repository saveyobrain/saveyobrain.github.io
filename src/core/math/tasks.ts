import type { Rng } from "./rng";
import { getTier, type TaskKind, type Tier } from "./tiers";

export interface MathTask {
  kind: TaskKind;
  /** Question as shown to the player, e.g. "7 + 5" or "x + 7 = 12". */
  text: string;
  answer: number;
  /** Shuffled answer options; always contains `answer` exactly once. */
  options: number[];
}

interface RawTask {
  text: string;
  answer: number;
  /** Plausible wrong answers (common mistakes). */
  near: number[];
}

const PLUS = "+";
const MINUS = "\u2212";
const TIMES = "\u00d7";
const DIVIDE = "\u00f7";

function lowBound(max: number): number {
  return max >= 20 ? Math.ceil(max / 10) : 1;
}

/** Off-by-ten mistakes only make sense once numbers have two digits. */
function tens(t: Tier, v: number): number[] {
  return t.addMax >= 20 ? [v + 10, v - 10] : [];
}

function add(t: Tier, r: Rng): RawTask {
  const lo = lowBound(t.addMax);
  const a = r.int(lo, t.addMax);
  const b = r.int(lo, t.addMax);
  const s = a + b;
  return { text: `${a} ${PLUS} ${b}`, answer: s, near: [s + 1, s - 1, s + 2, s - 2, ...tens(t, s), Math.abs(a - b)] };
}

function sub(t: Tier, r: Rng): RawTask {
  const lo = lowBound(t.addMax);
  const a = r.int(Math.max(2, lo), t.addMax);
  const b = r.int(1, a);
  const d = a - b;
  return { text: `${a} ${MINUS} ${b}`, answer: d, near: [d + 1, d - 1, d + 2, d - 2, ...tens(t, d), a + b] };
}

function mul(t: Tier, r: Rng): RawTask {
  const lo = t.mulMax >= 10 ? 2 : 1;
  const a = r.int(lo, t.mulMax);
  const b = r.int(lo, t.mulMax);
  const p = a * b;
  return { text: `${a} ${TIMES} ${b}`, answer: p, near: [p + a, p - a, p + b, p - b, a + b, p + 1, p - 1] };
}

function div(t: Tier, r: Rng): RawTask {
  const lo = t.mulMax >= 10 ? 2 : 1;
  const b = r.int(lo, t.mulMax);
  const q = r.int(lo, t.mulMax);
  const a = b * q;
  return { text: `${a} ${DIVIDE} ${b}`, answer: q, near: [q + 1, q - 1, q + 2, q - 2, a - b, b] };
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function percent(t: Tier, r: Rng): RawTask {
  const ps = t.addMax > 100 ? [5, 10, 15, 20, 25, 30, 40, 50, 60, 75] : [10, 20, 25, 50, 75];
  const p = r.pick(ps);
  const unit = 100 / gcd(p, 100);
  const maxK = Math.floor((t.addMax > 100 ? 400 : 200) / unit);
  const base = unit * r.int(Math.max(1, Math.ceil(10 / unit)), maxK);
  const ans = (p * base) / 100;
  const tenth = base / 10;
  return {
    text: `${p}% of ${base}`,
    answer: ans,
    near: [base - ans, ans * 2, ans / 2, ans + tenth, ans - tenth, (p * base) / 1000, ans + 5, ans - 5, ans + 1],
  };
}

function equation(t: Tier, r: Rng): RawTask {
  const xMax = t.addMax > 100 ? 50 : 20;
  const x = r.int(1, xMax);
  switch (r.int(0, 3)) {
    case 0: {
      const b = r.int(1, t.addMax > 100 ? 50 : 20);
      const c = x + b;
      return { text: `x ${PLUS} ${b} = ${c}`, answer: x, near: [c + b, x + 1, x - 1, c, x + 2] };
    }
    case 1: {
      const b = r.int(1, 20);
      const ans = x + b;
      return { text: `x ${MINUS} ${b} = ${x}`, answer: ans, near: [x - b, ans + 1, ans - 1, x, ans + 10] };
    }
    case 2: {
      const a = r.int(2, t.mulMax);
      const xs = r.int(1, t.mulMax);
      const c = a * xs;
      return { text: `${a}x = ${c}`, answer: xs, near: [c - a, xs + 1, xs - 1, c, xs + 2] };
    }
    default: {
      const a = r.int(2, 9);
      const xs = r.int(1, t.mulMax);
      return { text: `x ${DIVIDE} ${a} = ${xs}`, answer: a * xs, near: [xs, a * xs + a, a * xs - a, a + xs, a * xs + 1] };
    }
  }
}

function twoStep(_t: Tier, r: Rng): RawTask {
  const a = r.int(2, 12);
  const b = r.int(2, 12);
  const c = r.int(2, 9);
  switch (r.int(0, 3)) {
    case 0: {
      const v = (a + b) * c;
      return { text: `(${a} ${PLUS} ${b}) ${TIMES} ${c}`, answer: v, near: [a + b * c, v + c, v - c, v + 10, v - 10] };
    }
    case 1: {
      const v = a + b * c;
      return { text: `${a} ${PLUS} ${b} ${TIMES} ${c}`, answer: v, near: [(a + b) * c, v + 1, v - 1, v + b, v - b] };
    }
    case 2: {
      const v = a * b + c;
      return { text: `${a} ${TIMES} ${b} ${PLUS} ${c}`, answer: v, near: [a * (b + c), v + a, v - a, v + 1, v - 1] };
    }
    default: {
      const big = a * b;
      const cc = Math.min(c, big);
      const v = big - cc;
      return { text: `${a} ${TIMES} ${b} ${MINUS} ${cc}`, answer: v, near: [a * (b - cc), v + a, v - a, v + 1, v - 1] };
    }
  }
}

const GENERATORS: Record<TaskKind, (t: Tier, r: Rng) => RawTask> = {
  add,
  sub,
  mul,
  div,
  percent,
  equation,
  twoStep,
};

function pickKind(tier: Tier, r: Rng): TaskKind {
  const entries = Object.entries(tier.kinds) as [TaskKind, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = r.next() * total;
  for (const [kind, w] of entries) {
    roll -= w;
    if (roll < 0) return kind;
  }
  return entries[entries.length - 1][0];
}

function isValidOption(v: number): boolean {
  return Number.isInteger(v) && v >= 0;
}

function buildOptions(raw: RawTask, count: number, r: Rng): number[] {
  const wrong = new Set<number>();
  for (const v of r.shuffle(raw.near.slice())) {
    if (wrong.size >= count - 1) break;
    if (isValidOption(v) && v !== raw.answer) wrong.add(v);
  }
  let spread = 3;
  while (wrong.size < count - 1) {
    const v = raw.answer + r.int(-spread, spread);
    if (isValidOption(v) && v !== raw.answer) wrong.add(v);
    spread++;
  }
  return r.shuffle([raw.answer, ...wrong]);
}

export function generateTask(tierIndex: number, rng: Rng, previous?: MathTask): MathTask {
  const tier = getTier(tierIndex);
  for (let attempt = 0; ; attempt++) {
    const kind = pickKind(tier, rng);
    const raw = GENERATORS[kind](tier, rng);
    if (attempt < 10 && previous && previous.text === raw.text) continue;
    return { kind, text: raw.text, answer: raw.answer, options: buildOptions(raw, tier.options, rng) };
  }
}
