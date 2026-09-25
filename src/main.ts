import "./styles.css";
import type { GameInstance } from "./core/game";
import { findGame } from "./core/registry";
import { h } from "./core/ui/dom";
import { renderHub } from "./hub/hub";
import { strings } from "./strings";

const app = document.getElementById("app")!;
let current: GameInstance | null = null;
let routeToken = 0;

function goHome(): void {
  location.hash = "#/";
}

async function route(): Promise<void> {
  const token = ++routeToken;
  current?.dispose();
  current = null;

  // Routes: "#/" (hub) and "#/play/<gameId>[?level=N]"
  const [path, query = ""] = location.hash.replace(/^#/, "").split("?");
  const match = path.match(/^\/play\/([\w-]+)$/);
  const game = match ? findGame(match[1]) : undefined;

  if (!game) {
    document.title = strings.siteName;
    document.body.classList.remove("in-game");
    renderHub(app);
    window.scrollTo(0, 0);
    return;
  }

  document.title = `${game.title} - ${strings.siteName}`;
  document.body.classList.add("in-game");
  app.replaceChildren(h("div", { class: "loading" }, h("div", { class: "loading-icon" }, game.icon)));

  const runtime = await game.load();
  if (token !== routeToken) return;

  const level = Number(new URLSearchParams(query).get("level"));
  if (query) history.replaceState(null, "", `#${path}`);
  const root = h("div", { class: "game-root" });
  app.replaceChildren(root);
  current = runtime.start({ root, exit: goHome }, { level: Number.isInteger(level) && level >= 1 ? level : undefined });
}

window.addEventListener("hashchange", () => void route());
void route();
