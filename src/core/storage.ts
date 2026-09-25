import { STORAGE_PREFIX } from "../config";
import { DEFAULT_DIFFICULTY, DIFFICULTIES, isDifficulty, type Difficulty } from "./difficulty";

export interface GameProgress {
  /** Last selected difficulty. */
  difficulty: Difficulty;
  /** Highest level reached (1-based) per difficulty. */
  levels: Record<Difficulty, number>;
}

function defaults(): GameProgress {
  return {
    difficulty: DEFAULT_DIFFICULTY,
    levels: Object.fromEntries(DIFFICULTIES.map((d) => [d, 1])) as Record<Difficulty, number>,
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
    const parsed = JSON.parse(raw) as { difficulty?: unknown; levels?: Record<string, unknown>; level?: unknown };
    if (isDifficulty(parsed.difficulty)) progress.difficulty = parsed.difficulty;
    for (const d of DIFFICULTIES) progress.levels[d] = validLevel(parsed.levels?.[d]) ?? 1;
    // Saves from before difficulties existed were played on what is now "easy".
    const legacy = validLevel(parsed.level);
    if (legacy && !parsed.levels) progress.levels.easy = legacy;
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
