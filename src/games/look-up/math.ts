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

/** The pieces from this divisor all burn (each label is prime or 2). */
export function clearsWithoutShards(n: number, d: number): boolean {
  return isValidSplit(n, d) && burnsHarmlessly(n / d);
}

/** The pieces from this divisor are still composite, so shards remain. */
export function leavesShards(n: number, d: number): boolean {
  return isValidSplit(n, d) && !burnsHarmlessly(n / d);
}

/**
 * True when N has both a one-shot burn divisor and a divisor that leaves shards.
 * Those are the numbers the choice buttons are built for.
 */
export function hasChoiceMix(n: number): boolean {
  const real = splitDivisors(n);
  return real.some((d) => burnsHarmlessly(n / d)) && real.some((d) => !burnsHarmlessly(n / d));
}

/**
 * Four choices for Easy, Normal, and Hard: exactly one divisor that burns the
 * pieces in one shot, one or two divisors that leave smaller shards, and one
 * or two non-divisors. Never includes 1 or N.
 *
 * A number with no shard-leaving divisor still gets one clean break and the
 * rest wrong, so the panel can fill. Spawns use `hasChoiceMix` and avoid that.
 */
export function choiceOptions(n: number, count: number, rng: Rng): number[] {
  const real = splitDivisors(n);
  const clean = real.filter((d) => burnsHarmlessly(n / d));
  const shards = real.filter((d) => !burnsHarmlessly(n / d));
  if (clean.length === 0 || count < 1) return [];

  const used = new Set<number>([1, n]);
  const options: number[] = [];
  const cleanPick = rng.pick(clean);
  options.push(cleanPick);
  used.add(cleanPick);

  // Leave at least one slot for a wrong answer whenever the set has room.
  const roomForShards = Math.max(0, count - 2);
  let shardTake = 0;
  if (shards.length > 0 && roomForShards > 0) {
    const wantTwo = shards.length >= 2 && roomForShards >= 2 && rng.chance(0.5);
    shardTake = Math.min(shards.length, wantTwo ? 2 : 1, roomForShards);
  }
  for (const d of rng.shuffle([...shards]).slice(0, shardTake)) {
    options.push(d);
    used.add(d);
  }

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
  for (let v = 2; v < n && decoyPool.length < count * 6; v++) {
    if (!used.has(v) && n % v !== 0) decoyPool.push(v);
  }

  rng.shuffle(decoyPool);
  for (const decoy of decoyPool) {
    if (options.length >= count) break;
    if (used.has(decoy)) continue;
    used.add(decoy);
    options.push(decoy);
  }
  for (let v = 2; v < n && options.length < count; v++) {
    if (used.has(v) || n % v === 0) continue;
    used.add(v);
    options.push(v);
  }
  for (let v = n + 1; options.length < count && v < n + 24; v++) {
    if (used.has(v)) continue;
    used.add(v);
    options.push(v);
  }

  return rng.shuffle(options.slice(0, count));
}

/**
 * What collecting a life or shield adds.
 * A shield always counts. A life at the cap is removed and adds nothing.
 * No split score: that is only for a solved asteroid.
 */
export function pickupReward(
  kind: "life" | "shield",
  lives: number,
  maxLives: number,
): { lives: number; shields: number; score: number } {
  if (kind === "shield") return { lives, shields: 1, score: 25 };
  if (lives < maxLives) return { lives: lives + 1, shields: 0, score: 15 };
  return { lives, shields: 0, score: 0 };
}

/** Spawn values that have a clean break and at least one shard-leaving split. */
export function pickComposite(rng: Rng, min: number, max: number): number {
  const lo = Math.max(4, min);
  const hi = Math.max(lo, max);
  for (let attempt = 0; attempt < 80; attempt++) {
    const n = rng.int(lo, hi);
    if (hasChoiceMix(n)) return n;
  }
  const fallbacks = [8, 12, 16, 18, 20, 24, 27, 28, 30, 32, 36, 40, 42, 44, 45, 48, 50, 54, 56, 60, 63, 64, 72, 75, 80, 81, 84, 90, 96, 100, 108, 120];
  const inRange = fallbacks.filter((n) => n >= lo && n <= hi);
  if (inRange.length > 0) return rng.pick(inRange);
  const above = fallbacks.find((n) => n >= lo);
  return above ?? fallbacks[fallbacks.length - 1];
}
