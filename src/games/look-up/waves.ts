import type { Difficulty } from "../../core/difficulty";
import type { Rng } from "../../core/math/rng";
import { pickComposite } from "./math";

export interface WaveConfig {
  wave: number;
  /** How many inbound asteroids to spawn this wave. */
  count: number;
  minValue: number;
  maxValue: number;
  /** Units per second toward the station. */
  speed: number;
  /** Chance (0..1) to include a shield bonus target in the wave. */
  bonusChance: number;
  /**
   * Max live inbound asteroids (not counting split fragments mid-clear).
   * Easy/Normal low waves = 1 (serial); harder / later = more, still capped.
   */
  maxConcurrent: number;
  /** Seconds to wait between releasing another inbound when under the concurrent cap. */
  spawnGap: number;
}

const DIFF_SCALE: Record<Exclude<Difficulty, "custom">, { speed: number; size: number; lives: number }> = {
  easy: { speed: 0.7, size: 0.85, lives: 5 },
  normal: { speed: 1, size: 1, lives: 3 },
  hard: { speed: 1.2, size: 1.15, lives: 3 },
  hardcore: { speed: 1.4, size: 1.3, lives: 2 },
};

/**
 * Easy, Normal, and Hard show four divisor buttons.
 * Hardcore is an open number field; Fire and Enter submit it.
 */
export function answerMode(difficulty: Difficulty): "choices" | "entry" {
  return difficulty === "hardcore" ? "entry" : "choices";
}

export function startingLives(difficulty: Difficulty): number {
  if (difficulty === "custom") return DIFF_SCALE.normal.lives;
  return DIFF_SCALE[difficulty].lives;
}

/** Concurrent inbound cap — serial early on Easy/Normal; ramps later / on hard modes. */
export function maxConcurrent(wave: number, difficulty: Difficulty): number {
  const w = Math.max(1, Math.floor(wave));
  const d = difficulty === "custom" ? "normal" : difficulty;
  if (d === "easy") {
    if (w <= 4) return 1;
    if (w <= 8) return 2;
    return 3;
  }
  if (d === "normal") {
    if (w <= 3) return 1;
    if (w <= 7) return 2;
    return 3;
  }
  if (d === "hard") {
    if (w <= 2) return 2;
    if (w <= 5) return 3;
    return 4;
  }
  // hardcore
  if (w <= 2) return 2;
  if (w <= 4) return 3;
  return Math.min(5, 3 + Math.floor((w - 4) / 3));
}

/** Gap between releases when concurrent > 1 (serial mode ignores this and waits for a clear). */
export function spawnGapSeconds(wave: number, difficulty: Difficulty): number {
  const w = Math.max(1, Math.floor(wave));
  const d = difficulty === "custom" ? "normal" : difficulty;
  if (d === "easy") return Math.max(0.9, 1.6 - w * 0.05);
  if (d === "normal") return Math.max(0.7, 1.35 - w * 0.05);
  if (d === "hard") return Math.max(0.45, 1.0 - w * 0.04);
  return Math.max(0.35, 0.85 - w * 0.04);
}

export function waveConfig(wave: number, difficulty: Difficulty): WaveConfig {
  const w = Math.max(1, Math.floor(wave));
  const scale = difficulty === "custom" ? DIFF_SCALE.normal : DIFF_SCALE[difficulty];
  const minValue = Math.min(4 + Math.floor((w - 1) * 1.5 * scale.size), 40);
  // Floor the ceiling so wave 1 already includes 8, 12, 16, 18, 20, and 24 —
  // numbers with both a one-shot burn and a split that leaves shards.
  const maxValue = Math.min(Math.max(24, 10 + Math.floor(w * 4 * scale.size)), 120);
  const count = Math.min(3 + Math.floor((w - 1) * 0.6), 8);
  // Slow early waves, but fast enough that horizon-edge spawns enter within ~1–2s.
  const speed = (0.38 + (w - 1) * 0.04) * scale.speed;
  const bonusChance = w >= 2 ? Math.min(0.15 + w * 0.03, 0.45) : 0;
  return {
    wave: w,
    count,
    minValue,
    maxValue,
    speed,
    bonusChance,
    maxConcurrent: maxConcurrent(w, difficulty),
    spawnGap: spawnGapSeconds(w, difficulty),
  };
}

export function spawnValues(cfg: WaveConfig, rng: Rng): number[] {
  return Array.from({ length: cfg.count }, () => pickComposite(rng, cfg.minValue, cfg.maxValue));
}

export function shouldSpawnBonus(cfg: WaveConfig, rng: Rng): boolean {
  return cfg.bonusChance > 0 && rng.chance(cfg.bonusChance);
}

/**
 * Most lives the player may hold on this wave.
 * 1–3 → 3, 4–6 → 4, 7–9 → 5, then round(level / 2).
 */
export function lifeCap(wave: number): number {
  const lvl = Math.max(1, Math.floor(wave));
  if (lvl <= 3) return 3;
  if (lvl <= 6) return 4;
  if (lvl <= 9) return 5;
  return Math.max(5, Math.round(lvl / 2));
}

/** Asteroids in play. A seventh hazard is not released until some are gone. */
export const HAZARD_CAP = 6;

export function hazardSpawnBlocked(onScreen: number): boolean {
  return onScreen >= HAZARD_CAP;
}
