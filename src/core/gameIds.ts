/** Static game ids used by the Vite content plugin and hub (keep in sync with registry). */
export const GAME_IDS = ["save-the-light", "look-up"] as const;

export type GameId = (typeof GAME_IDS)[number];
