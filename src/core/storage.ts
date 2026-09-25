import { STORAGE_PREFIX } from "../config";

export interface GameProgress {
  /** Highest level reached (1-based). */
  level: number;
}

const DEFAULT_PROGRESS: GameProgress = { level: 1 };

function key(gameId: string): string {
  return `${STORAGE_PREFIX}:${gameId}`;
}

export function loadProgress(gameId: string): GameProgress {
  try {
    const raw = localStorage.getItem(key(gameId));
    if (!raw) return { ...DEFAULT_PROGRESS };
    const parsed = JSON.parse(raw) as Partial<GameProgress>;
    const level = Number(parsed.level);
    return { level: Number.isInteger(level) && level >= 1 ? level : 1 };
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

export function saveProgress(gameId: string, progress: GameProgress): void {
  try {
    localStorage.setItem(key(gameId), JSON.stringify(progress));
  } catch {
    // Storage can be unavailable (private mode, quota); progress just won't persist.
  }
}
