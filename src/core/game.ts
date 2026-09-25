export interface GameContext {
  /** Element the game renders into; it is emptied when the game is disposed. */
  root: HTMLElement;
  /** Leave the game and return to the hub. */
  exit(): void;
}

export interface StartOptions {
  /** Start from this level instead of the saved one. */
  level?: number;
}

export interface GameInstance {
  dispose(): void;
}

export interface GameRuntime {
  start(ctx: GameContext, options: StartOptions): GameInstance;
}

export interface GameModule {
  id: string;
  title: string;
  description: string;
  /** Emoji or short text used as the card icon. */
  icon: string;
  /** Card accent color. */
  color: string;
  /** Lazy-loads the game code (and Babylon.js) only when the game is opened. */
  load(): Promise<GameRuntime>;
}
