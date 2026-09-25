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
}

export function levelConfig(level: number): LevelConfig {
  const n = Math.max(1, Math.floor(level));
  // Seconds a full candle lasts without answering: 60s at level 1 down to 20s.
  const fullCandleSeconds = Math.max(20, 62 - n * 2.5);
  return {
    level: n,
    cellsWide: Math.min(5 + n, 24),
    cellsHigh: Math.min(4 + n, 18),
    loopChance: Math.min(0.02 + n * 0.01, 0.12),
    burnPerSecond: 1 / fullCandleSeconds,
    mathTier: Math.floor((n - 1) / 2),
    fuelPerCorrect: Math.max(0.18, 0.3 - n * 0.008),
  };
}
