import { STORAGE_PREFIX } from "../config";
import {
  CUSTOM_TABLE_NUMBERS,
  DEFAULT_DIFFICULTY,
  DIFFICULTIES,
  isDifficulty,
  type Difficulty,
} from "./difficulty";

export interface CustomMathSettings {
  mul: boolean;
  div: boolean;
  /** Subset of pickable Custom table numbers (2…20). */
  tables: number[];
}

export interface GameProgress {
  /** Last selected difficulty. */
  difficulty: Difficulty;
  /** Highest level reached (1-based) per difficulty. */
  levels: Record<Difficulty, number>;
  /** Last Custom times-table practice settings. */
  customMath?: CustomMathSettings;
}

const DEFAULT_CUSTOM_MATH: CustomMathSettings = {
  mul: true,
  div: false,
  tables: [2, 3, 4, 5],
};

const TABLE_SET = new Set<number>(CUSTOM_TABLE_NUMBERS);

export function defaultCustomMath(): CustomMathSettings {
  return { ...DEFAULT_CUSTOM_MATH, tables: [...DEFAULT_CUSTOM_MATH.tables] };
}

export function sanitizeCustomMath(value: unknown): CustomMathSettings {
  const fallback = defaultCustomMath();
  if (!value || typeof value !== "object") return fallback;
  const raw = value as Partial<CustomMathSettings>;
  const mul = raw.mul === true;
  const div = raw.div === true;
  const tables = Array.isArray(raw.tables)
    ? [...new Set(raw.tables.map(Number).filter((n) => TABLE_SET.has(n)))].sort((a, b) => a - b)
    : [];
  if ((!mul && !div) || tables.length === 0) return fallback;
  return { mul, div, tables };
}

function defaults(): GameProgress {
  return {
    difficulty: DEFAULT_DIFFICULTY,
    levels: Object.fromEntries(DIFFICULTIES.map((d) => [d, 1])) as Record<Difficulty, number>,
    customMath: defaultCustomMath(),
  };
}

function key(gameId: string): string {
  return `${STORAGE_PREFIX}:${gameId}`;
}

function validLevel(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

export function loadProgress(gameId: string): GameProgress {
  const progress = defaults();
  try {
    const raw = localStorage.getItem(key(gameId));
    if (!raw) return progress;
    const parsed = JSON.parse(raw) as {
      difficulty?: unknown;
      levels?: Record<string, unknown>;
      level?: unknown;
      customMath?: unknown;
    };
    if (isDifficulty(parsed.difficulty)) progress.difficulty = parsed.difficulty;
    for (const d of DIFFICULTIES) progress.levels[d] = validLevel(parsed.levels?.[d]) ?? 1;
    // Saves from before difficulties existed were played on what is now "easy".
    const legacy = validLevel(parsed.level);
    if (legacy && !parsed.levels) progress.levels.easy = legacy;
    if (parsed.customMath !== undefined) progress.customMath = sanitizeCustomMath(parsed.customMath);
  } catch {
    // Corrupt or unavailable storage: start fresh.
  }
  return progress;
}

export function saveProgress(gameId: string, progress: GameProgress): void {
  try {
    localStorage.setItem(key(gameId), JSON.stringify(progress));
  } catch {
    // Storage can be unavailable (private mode, quota); progress just won't persist.
  }
}

export function updateProgress(gameId: string, change: (progress: GameProgress) => void): GameProgress {
  const progress = loadProgress(gameId);
  change(progress);
  saveProgress(gameId, progress);
  return progress;
}
