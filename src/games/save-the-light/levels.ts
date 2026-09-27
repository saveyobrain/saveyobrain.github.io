import type { Difficulty } from "../../core/difficulty";

export interface LevelConfig {
  level: number;
  /** Maze size in cells (the tile grid is 2n+1). */
  cellsWide: number;
  cellsHigh: number;
  /** Chance to knock out an extra wall, creating loops. */
  loopChance: number;
  /** Candle fuel lost per second while idle (fuel is 0..1). */
  burnPerSecond: number;
  /** Candle fuel lost per second while moving (fuel is 0..1). */
  moveBurnPerSecond: number;
  /** Index into core/math TIERS. */
  mathTier: number;
  /** Fuel gained for a correct answer. */
  fuelPerCorrect: number;
  /** Fuel lost for a wrong answer, as a multiple of the "fair" penalty. */
  penaltyScale: number;
  /** Multiplier for the candle light radius. */
  lightScale: number;
  /** Correct answers needed before the map appears (`ceil(level * coef)`). */
  mapUnlockAt: number;
  /** After decrypt: reveal the maze (easy/normal) or show an exit arrow (hard+). */
  mapRevealsFog: boolean;
}

interface DifficultyTuning {
  /** Idle burn multiplier vs fullCandleSeconds. */
  burn: number;
  /** Moving burn multiplier vs fullCandleSeconds. */
  moveBurn: number;
  /** Multiplier on the shared candle lifetime curve (1 = full length). */
  lifeScale: number;
  fuel: number;
  penalty: number;
  light: number;
  extraCells: number;
  /** Math tier at level 1. */
  firstTier: number;
  /** Levels needed to reach the next math tier. */
  levelsPerTier: number;
  /** Multiplier for map unlock: ceil(level * mapSpawnCoef) correct answers. */
  mapSpawnCoef: number;
  /** Decrypt reveals fog-of-war instead of only an exit arrow (kept off for now — full reveal removes candle tension). */
  mapRevealsFog: boolean;
}

const TUNING: Record<Difficulty, DifficultyTuning> = {
  // Easy: discourage sprinting; Normal+: block a clean L1 shortest-path sprint.
  easy: { burn: 0.6, moveBurn: 5, lifeScale: 0.7, fuel: 1, penalty: 1, light: 1, extraCells: 0, firstTier: 0, levelsPerTier: 2, mapSpawnCoef: 1, mapRevealsFog: false },
  // firstTier: 1 = numbers up to 10, 2 = up to 15, 3 = up to 20 with three options (see core/math/tiers.ts).
  normal: { burn: 0.75, moveBurn: 7, lifeScale: 0.6, fuel: 0.9, penalty: 1, light: 0.95, extraCells: 1, firstTier: 1, levelsPerTier: 1, mapSpawnCoef: 2, mapRevealsFog: false },
  hard: { burn: 0.8, moveBurn: 10, lifeScale: 0.5, fuel: 0.8, penalty: 1.25, light: 0.85, extraCells: 2, firstTier: 2, levelsPerTier: 1, mapSpawnCoef: 2.5, mapRevealsFog: false },
  hardcore: { burn: 0.9, moveBurn: 13, lifeScale: 0.5, fuel: 0.7, penalty: 1.5, light: 0.72, extraCells: 3, firstTier: 3, levelsPerTier: 1, mapSpawnCoef: 3, mapRevealsFog: false },
};

export function levelConfig(level: number, difficulty: Difficulty): LevelConfig {
  const n = Math.max(1, Math.floor(level));
  const d = TUNING[difficulty];
  // Base lifetime curve (~60s at level 1 down to 20s), then scaled per difficulty.
  const fullCandleSeconds = Math.max(20, 62 - n * 2.5) * d.lifeScale;
  return {
    level: n,
    cellsWide: Math.min(5 + n + d.extraCells, 24),
    cellsHigh: Math.min(4 + n + d.extraCells, 18),
    loopChance: Math.min(0.02 + n * 0.01, 0.12),
    burnPerSecond: d.burn / fullCandleSeconds,
    moveBurnPerSecond: d.moveBurn / fullCandleSeconds,
    mathTier: d.firstTier + Math.floor((n - 1) / d.levelsPerTier),
    fuelPerCorrect: d.fuel * Math.max(0.18, 0.3 - n * 0.008),
    penaltyScale: d.penalty,
    lightScale: d.light,
    mapUnlockAt: Math.max(3, Math.ceil(n * d.mapSpawnCoef)),
    mapRevealsFog: d.mapRevealsFog,
  };
}
