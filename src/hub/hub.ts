import { GAMES } from "../core/registry";
import { loadProgress } from "../core/storage";
import { h } from "../core/ui/dom";
import { localizePath } from "../i18n/locales";
import { getActiveLocale, getStrings } from "../i18n/strings";

/** Fills `#game-grid` with game cards (Continue / Play from local progress). */
export function renderGameGrid(root: HTMLElement): void {
  const base = import.meta.env.BASE_URL;
  const locale = getActiveLocale();
  const strings = getStrings(locale);
  const cards = GAMES.map((game) => {
    const progress = loadProgress(game.id);
    const level = progress.levels[progress.difficulty];
    const playHref = `${base}${localizePath(`games/${game.id}/`, locale)}`;
    const title = strings.stl.title;
    const description = strings.stl.description;
    return h(
      "article",
      { class: "game-card", style: `--accent: ${game.color}` },
      h("div", { class: "game-icon", "aria-hidden": "true" }, game.icon),
      h("h2", {}, title),
      h("p", {}, description),
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
