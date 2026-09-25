import type { Difficulty } from "../../core/difficulty";

export interface LevelConfig {
  level: number;
  /** Maze size in cells (the tile grid is 2n+1). */
  cellsWide: number;
  cellsHigh: number;
  /** Chance to knock out an extra wall, creating loops. */
  loopChance: number;
  /** Candle fuel lost per second (fuel is 0..1). */
  burnPerSecond: number;
  /** Index into core/math TIERS. */
  mathTier: number;
  /** Fuel gained for a correct answer. */
  fuelPerCorrect: number;
  /** Fuel lost for a wrong answer, as a multiple of the "fair" penalty. */
  penaltyScale: number;
  /** Multiplier for the candle light radius. */
  lightScale: number;
}

interface DifficultyTuning {
  burn: number;
  fuel: number;
  penalty: number;
  light: number;
  extraCells: number;
  /** Math tier at level 1. */
  firstTier: number;
  /** Levels needed to reach the next math tier. */
  levelsPerTier: number;
}

const TUNING: Record<Difficulty, DifficultyTuning> = {
  easy: { burn: 1, fuel: 1, penalty: 1, light: 1, extraCells: 0, firstTier: 0, levelsPerTier: 2 },
  // firstTier: 1 = numbers up to 10, 2 = up to 15, 3 = up to 20 with three options (see core/math/tiers.ts).
  normal: { burn: 1.5, fuel: 0.9, penalty: 1, light: 0.95, extraCells: 1, firstTier: 1, levelsPerTier: 1 },
  hard: { burn: 2, fuel: 0.8, penalty: 1.25, light: 0.85, extraCells: 2, firstTier: 2, levelsPerTier: 1 },
  hardcore: { burn: 3, fuel: 0.7, penalty: 1.5, light: 0.72, extraCells: 3, firstTier: 3, levelsPerTier: 1 },
};

export function levelConfig(level: number, difficulty: Difficulty): LevelConfig {
  const n = Math.max(1, Math.floor(level));
  const d = TUNING[difficulty];
  // Seconds a full candle lasts without answering on easy: 60s at level 1 down to 20s.
  const fullCandleSeconds = Math.max(20, 62 - n * 2.5);
  return {
    level: n,
    cellsWide: Math.min(5 + n + d.extraCells, 24),
    cellsHigh: Math.min(4 + n + d.extraCells, 18),
    loopChance: Math.min(0.02 + n * 0.01, 0.12),
    burnPerSecond: d.burn / fullCandleSeconds,
    mathTier: d.firstTier + Math.floor((n - 1) / d.levelsPerTier),
    fuelPerCorrect: d.fuel * Math.max(0.18, 0.3 - n * 0.008),
    penaltyScale: d.penalty,
    lightScale: d.light,
  };
}
