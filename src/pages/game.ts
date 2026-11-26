import { track } from "../analytics";
import "../styles.css";
import { findGame } from "../core/registry";
import { h } from "../core/ui/dom";
import { localeFromPath, localizePath, stripLocalePrefix } from "../i18n/locales";
import { getActiveLocale, initLocaleFromLocation } from "../i18n/strings";
import { redirectLegacyHash } from "../site/redirects";

/** Resolve `/games/<id>/` (or `/ua/games/<id>/`) from the current path. */
function gameIdFromPath(pathname: string): string | null {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "") || "";
  let path = pathname;
  if (base && path.startsWith(base)) path = path.slice(base.length) || "/";
  const logical = stripLocalePrefix(path.replace(/^\//, ""));
  const match = logical.match(/^games\/([^/]+)\/?$/);
  return match?.[1] ?? null;
}

function goHome(): void {
  const locale = getActiveLocale();
  location.href = `${import.meta.env.BASE_URL}${localizePath("", locale)}`;
}

async function boot(): Promise<void> {
  initLocaleFromLocation();
  if (redirectLegacyHash()) return;

  const app = document.getElementById("app");
  if (!app) return;

  const gameId = gameIdFromPath(location.pathname);
  const game = gameId ? findGame(gameId) : undefined;
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
    history.replaceState(null, "", `${import.meta.env.BASE_URL}${localizePath(`games/${game.id}/`, locale)}`);
  }

  // Keep html lang / title in sync if the static shell was English-only.
  document.documentElement.lang = localeFromPath(location.pathname) === "ua" ? "uk" : "en";

  const root = h("div", { class: "game-root" });
  app.replaceChildren(root);
  runtime.start(
    { root, exit: goHome },
    { level: Number.isInteger(level) && level >= 1 ? level : undefined },
  );
  track("game_open", { game_id: game.id, locale });
}

void boot();
