import type { GameModule } from "./game";
import { strings } from "../strings";

export const GAMES: readonly GameModule[] = [
  {
    id: "save-the-light",
    title: strings.stl.title,
    description: strings.stl.description,
    icon: "\u{1F56F}\uFE0F",
    color: "#ffb84d",
    load: () => import("../games/save-the-light/index").then((m) => m.runtime),
  },
];

export function findGame(id: string): GameModule | undefined {
  return GAMES.find((g) => g.id === id);
}
