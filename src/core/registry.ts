import type { GameModule } from "./game";

export const GAMES: readonly Omit<GameModule, "title" | "description">[] = [
  {
    id: "save-the-light",
    icon: "\u{1F56F}\uFE0F",
    color: "#ffb84d",
    load: () => import("../games/save-the-light/index").then((m) => m.runtime),
  },
];

export function findGame(id: string): (typeof GAMES)[number] | undefined {
  return GAMES.find((g) => g.id === id);
}
