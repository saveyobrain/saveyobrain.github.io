import { GAMES } from "../core/registry";
import { loadProgress } from "../core/storage";
import { h } from "../core/ui/dom";
import { strings } from "../strings";

/** Fills `#game-grid` with game cards (Continue / Play from local progress). */
export function renderGameGrid(root: HTMLElement): void {
  const base = import.meta.env.BASE_URL;
  const cards = GAMES.map((game) => {
    const progress = loadProgress(game.id);
    const level = progress.levels[progress.difficulty];
    const playHref = `${base}games/${game.id}/`;
    return h(
      "article",
      { class: "game-card", style: `--accent: ${game.color}` },
      h("div", { class: "game-icon", "aria-hidden": "true" }, game.icon),
      h("h2", {}, game.title),
      h("p", {}, game.description),
      h(
        "div",
        { class: "game-actions" },
        level > 1
          ? h(
              "a",
              { class: "btn btn-primary btn-continue", href: playHref },
              h("span", {}, strings.continue),
              h("span", { class: "btn-sub" }, strings.levelWithDifficulty(level, strings.difficulty[progress.difficulty])),
            )
          : h("a", { class: "btn btn-primary", href: playHref }, strings.play),
        level > 1 && h("a", { class: "btn btn-link", href: `${playHref}?level=1` }, strings.startOver),
      ),
    );
  });

  root.replaceChildren(...cards, h("div", { class: "game-card placeholder" }, h("p", {}, strings.comingSoon)));
}
