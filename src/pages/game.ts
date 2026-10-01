import { track } from "../analytics";
import "../styles.css";
import { findGame } from "../core/registry";
import { h } from "../core/ui/dom";
import { localizePath } from "../i18n/locales";
import { getActiveLocale, initLocaleFromLocation } from "../i18n/strings";
import { redirectLegacyHash } from "../site/redirects";

const GAME_ID = "save-the-light";

function goHome(): void {
  const locale = getActiveLocale();
  location.href = `${import.meta.env.BASE_URL}${localizePath("", locale)}`;
}

async function boot(): Promise<void> {
  initLocaleFromLocation();
  if (redirectLegacyHash()) return;

  const app = document.getElementById("app");
  if (!app) return;

  const game = findGame(GAME_ID);
  if (!game) {
    goHome();
    return;
  }

  document.body.classList.add("in-game");
  app.replaceChildren(h("div", { class: "loading" }, h("div", { class: "loading-icon" }, game.icon)));

  const runtime = await game.load();
  const level = Number(new URLSearchParams(location.search).get("level"));
  const locale = getActiveLocale();
  if (location.search) {
    history.replaceState(null, "", `${import.meta.env.BASE_URL}${localizePath(`games/${GAME_ID}/`, locale)}`);
  }

  const root = h("div", { class: "game-root" });
  app.replaceChildren(root);
  runtime.start(
    { root, exit: goHome },
    { level: Number.isInteger(level) && level >= 1 ? level : undefined },
  );
  track("game_open", { game_id: GAME_ID, locale });
}

void boot();
