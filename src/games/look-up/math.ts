import type { Rng } from "../../core/math/rng";

/** All positive divisors of n, ascending. */
export function allDivisors(n: number): number[] {
  if (!Number.isInteger(n) || n < 1) return [];
  const small: number[] = [];
  const large: number[] = [];
  for (let d = 1; d * d <= n; d++) {
    if (n % d !== 0) continue;
    small.push(d);
    if (d * d !== n) large.push(n / d);
  }
  return small.concat(large.reverse());
}

/**
 * Proper split divisors for Look UP: greater than 1 and less than N.
 * Never includes 1 (trivial) or N (self-divide that would label children 1).
 */
export function splitDivisors(n: number): number[] {
  return allDivisors(n).filter((d) => d > 1 && d < n);
}

/** True when the body cannot be split further and burns with no damage. */
export function burnsHarmlessly(n: number): boolean {
  return Number.isInteger(n) && n >= 2 && splitDivisors(n).length === 0;
}

/** Valid player pick: D divides N, D > 1, D < N. */
export function isValidSplit(n: number, d: number): boolean {
  return Number.isInteger(n) && Number.isInteger(d) && d > 1 && d < n && n % d === 0;
}

export type SplitResult =
  | { ok: false; reason: "invalid" }
  | { ok: true; children: number[] };

/**
 * On a valid hit: split into D children each labeled N/D.
 * Child labels are always ≥ 2 when the split is valid.
 */
export function applySplit(n: number, d: number): SplitResult {
  if (!isValidSplit(n, d)) return { ok: false, reason: "invalid" };
  const label = n / d;
  return { ok: true, children: Array.from({ length: d }, () => label) };
}

/** Score for clearing a fragment that burns harmlessly. */
export function burnScore(n: number): number {
  return Math.max(1, Math.floor(n / 2));
}

/** Score for a successful split (scales with how many pieces you create). */
export function splitScore(n: number, d: number): number {
  return Math.max(1, d + Math.floor(Math.log2(Math.max(2, n))));
}

/**
 * Build `count` multiple-choice options that always include every real split divisor
 * when there are ≤ count of them, plus decoys that do not divide N.
 * Never includes 1 or N.
 */
export function choiceOptions(n: number, count: number, rng: Rng): number[] {
  const real = splitDivisors(n);
  if (real.length === 0 || count < 1) return [];

  const options = [...real];
  const used = new Set(options);
  used.add(1);
  used.add(n);

  // Prefer plausible near-misses around the real divisors and around √n.
  const decoyPool: number[] = [];
  for (const d of real) {
    for (const delta of [-2, -1, 1, 2, 3]) {
      const v = d + delta;
      if (v > 1 && v < n && !used.has(v) && n % v !== 0) decoyPool.push(v);
    }
  }
  const root = Math.max(2, Math.floor(Math.sqrt(n)));
  for (let v = root - 3; v <= root + 4; v++) {
    if (v > 1 && v < n && !used.has(v) && n % v !== 0) decoyPool.push(v);
  }
  for (let v = 2; v < n && decoyPool.length < count * 4; v++) {
    if (!used.has(v) && n % v !== 0) decoyPool.push(v);
  }

  rng.shuffle(decoyPool);
  for (const decoy of decoyPool) {
    if (options.length >= count) break;
    if (used.has(decoy)) continue;
    used.add(decoy);
    options.push(decoy);
  }

  // If still short (tiny N), pad with unused integers in (1, N), then nearby outsiders.
  for (let v = 2; v < n && options.length < count; v++) {
    if (used.has(v)) continue;
    used.add(v);
    options.push(v);
  }
  for (let v = n + 1; options.length < count && v < n + 20; v++) {
    if (used.has(v)) continue;
    used.add(v);
    options.push(v);
  }

  return rng.shuffle(options.slice(0, Math.min(count, options.length)));
}

/** Composite spawn values in [min, max] that still have at least one split divisor. */
export function pickComposite(rng: Rng, min: number, max: number): number {
  const lo = Math.max(4, min);
  const hi = Math.max(lo, max);
  for (let attempt = 0; attempt < 40; attempt++) {
    const n = rng.int(lo, hi);
    if (splitDivisors(n).length > 0) return n;
  }
  // Fallback: a known easy composite near the range.
  const fallbacks = [4, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20, 21, 22, 24, 25, 27, 28, 30];
  const inRange = fallbacks.filter((n) => n >= lo && n <= hi);
  return rng.pick(inRange.length ? inRange : fallbacks);
}
