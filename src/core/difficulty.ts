export const DIFFICULTIES = ["easy", "normal", "hard", "hardcore", "custom"] as const;

/** Preset difficulties shown in the 2×2 picker (excludes Custom). */
export const PRESET_DIFFICULTIES = ["easy", "normal", "hard", "hardcore"] as const;

export type Difficulty = (typeof DIFFICULTIES)[number];
export type PresetDifficulty = (typeof PRESET_DIFFICULTIES)[number];

export const DEFAULT_DIFFICULTY: Difficulty = "normal";

/** Smallest / largest times-table numbers available in Custom mode. */
export const CUSTOM_TABLE_MIN = 2;
export const CUSTOM_TABLE_MAX = 20;
/** Visible chip page ends: start at 2–10, then unlock to 15, then 20. */
export const CUSTOM_TABLE_PAGE_ENDS = [10, 15, 20] as const;

/** All pickable Custom table numbers (2…20). */
export const CUSTOM_TABLE_NUMBERS = Array.from(
  { length: CUSTOM_TABLE_MAX - CUSTOM_TABLE_MIN + 1 },
  (_, i) => CUSTOM_TABLE_MIN + i,
);

export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === "string" && (DIFFICULTIES as readonly string[]).includes(value);
}

export function isPresetDifficulty(value: unknown): value is PresetDifficulty {
  return typeof value === "string" && (PRESET_DIFFICULTIES as readonly string[]).includes(value);
}

/** Lowest page end that covers every selected table (at least 10). */
export function customTableVisibleMax(tables: readonly number[]): number {
  const peak = tables.reduce((m, n) => Math.max(m, n), CUSTOM_TABLE_PAGE_ENDS[0]);
  for (const end of CUSTOM_TABLE_PAGE_ENDS) {
    if (peak <= end) return end;
  }
  return CUSTOM_TABLE_MAX;
}
