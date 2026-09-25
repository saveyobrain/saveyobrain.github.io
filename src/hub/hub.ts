import { GAMES } from "../core/registry";
import { loadProgress } from "../core/storage";
import { h } from "../core/ui/dom";
import { strings } from "../strings";

export function renderHub(root: HTMLElement): void {
  const cards = GAMES.map((game) => {
    const progress = loadProgress(game.id);
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
        h("a", { class: "btn btn-primary", href: playHref }, progress.level > 1 ? strings.continueLevel(progress.level) : strings.play),
        progress.level > 1 && h("a", { class: "btn btn-link", href: `${playHref}?level=1` }, strings.startOver),
      ),
    );
  });

  root.replaceChildren(
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
      h("footer", { class: "hub-footer" }, strings.footer),
    ),
  );
}
