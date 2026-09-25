import { GAMES } from "../core/registry";
import { loadProgress } from "../core/storage";
import { h } from "../core/ui/dom";
import { supportLink } from "../core/ui/support";
import { strings } from "../strings";

export function renderHub(root: HTMLElement): void {
  const cards = GAMES.map((game) => {
    const progress = loadProgress(game.id);
    const level = progress.levels[progress.difficulty];
    const playHref = `#/play/${game.id}`;
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

  root.replaceChildren(
    h(
      "div",
      { class: "hub-page" },
      h("div", { class: "hub-topbar" }, supportLink()),
      h(
        "main",
        { class: "hub" },
        h(
          "header",
          { class: "hub-header" },
          h("h1", {}, strings.siteName),
          h("p", { class: "hub-tagline" }, strings.tagline),
          h("p", { class: "hub-intro" }, strings.hubIntro),
        ),
        h("section", { class: "game-grid" }, ...cards, h("div", { class: "game-card placeholder" }, h("p", {}, strings.comingSoon))),
        h("p", { class: "hub-note" }, strings.footer),
      ),
      h("footer", { class: "site-footer" }, h("a", { href: "#/legal" }, strings.legalLink)),
    ),
  );
}
