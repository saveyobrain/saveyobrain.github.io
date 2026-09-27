import "../styles.css";
import { renderGameGrid } from "../hub/hub";
import { initNav } from "../site/nav";
import { redirectLegacyHash } from "../site/redirects";

if (!redirectLegacyHash()) {
  initNav();
  const grid = document.getElementById("game-grid");
  if (grid) renderGameGrid(grid);
}
