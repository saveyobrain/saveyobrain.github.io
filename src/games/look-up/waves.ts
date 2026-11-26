import type { Difficulty } from "../../core/difficulty";
import type { Rng } from "../../core/math/rng";
import { pickComposite } from "./math";

export interface WaveConfig {
  wave: number;
  /** How many inbound asteroids to spawn this wave. */
  count: number;
  minValue: number;
  maxValue: number;
  /** Units per second falling toward the station (world Y). */
  speed: number;
  /** Chance (0..1) to include a shield bonus target in the wave. */
  bonusChance: number;
}

const DIFF_SCALE: Record<Exclude<Difficulty, "custom">, { speed: number; size: number; lives: number }> = {
  easy: { speed: 0.7, size: 0.85, lives: 5 },
  normal: { speed: 1, size: 1, lives: 3 },
  hard: { speed: 1.2, size: 1.15, lives: 3 },
  hardcore: { speed: 1.4, size: 1.3, lives: 2 },
};

export function startingLives(difficulty: Difficulty): number {
  if (difficulty === "custom") return DIFF_SCALE.normal.lives;
  return DIFF_SCALE[difficulty].lives;
}

export function waveConfig(wave: number, difficulty: Difficulty): WaveConfig {
  const w = Math.max(1, Math.floor(wave));
  const scale = difficulty === "custom" ? DIFF_SCALE.normal : DIFF_SCALE[difficulty];
  const minValue = Math.min(4 + Math.floor((w - 1) * 1.5 * scale.size), 40);
  const maxValue = Math.min(10 + Math.floor(w * 4 * scale.size), 120);
  const count = Math.min(3 + Math.floor((w - 1) * 0.6), 8);
  // Slow early waves, but fast enough that motion is obvious within a few seconds.
  // Wave 1 normal ≈ 0.22 u/s → ~45s from top of frame to the deck.
  const speed = (0.22 + (w - 1) * 0.035) * scale.speed;
  const bonusChance = w >= 2 ? Math.min(0.15 + w * 0.03, 0.45) : 0;
  return { wave: w, count, minValue, maxValue, speed, bonusChance };
}

export function spawnValues(cfg: WaveConfig, rng: Rng): number[] {
  return Array.from({ length: cfg.count }, () => pickComposite(rng, cfg.minValue, cfg.maxValue));
}

export function shouldSpawnBonus(cfg: WaveConfig, rng: Rng): boolean {
  return cfg.bonusChance > 0 && rng.chance(cfg.bonusChance);
}
