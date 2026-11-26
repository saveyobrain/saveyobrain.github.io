import type { GameModule } from "./game";

export const GAMES: readonly Omit<GameModule, "title" | "description">[] = [
  {
    id: "save-the-light",
    icon: "\u{1F56F}\uFE0F",
    color: "#ffb84d",
    load: () => import("../games/save-the-light/index").then((m) => m.runtime),
  },
  {
    id: "look-up",
    icon: "\u{1F6F0}\uFE0F",
    color: "#5ec8ff",
    load: () => import("../games/look-up/index").then((m) => m.runtime),
  },
];

export function findGame(id: string): (typeof GAMES)[number] | undefined {
  return GAMES.find((g) => g.id === id);
}
