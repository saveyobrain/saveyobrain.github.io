import "../styles.css";
import { findGame } from "../core/registry";
import { h } from "../core/ui/dom";
import { redirectLegacyHash } from "../site/redirects";

const GAME_ID = "save-the-light";

function goHome(): void {
  location.href = import.meta.env.BASE_URL;
}

async function boot(): Promise<void> {
  if (redirectLegacyHash()) return;

  const app = document.getElementById("app");
  if (!app) return;

  const game = findGame(GAME_ID);
  if (!game) {
    location.href = import.meta.env.BASE_URL;
    return;
  }

  document.body.classList.add("in-game");
  app.replaceChildren(h("div", { class: "loading" }, h("div", { class: "loading-icon" }, game.icon)));

  const runtime = await game.load();
  const level = Number(new URLSearchParams(location.search).get("level"));
  if (location.search) {
    history.replaceState(null, "", `${import.meta.env.BASE_URL}games/${GAME_ID}/`);
  }

  const root = h("div", { class: "game-root" });
  app.replaceChildren(root);
  runtime.start(
    { root, exit: goHome },
    { level: Number.isInteger(level) && level >= 1 ? level : undefined },
  );
}

void boot();
