import "../styles.css";
import { renderGameGrid } from "../hub/hub";
import { initLocaleFromLocation } from "../i18n/strings";
import { initLangPicker, initNav } from "../site/nav";
import { redirectLegacyHash } from "../site/redirects";

initLocaleFromLocation();

if (!redirectLegacyHash()) {
  initNav();
  initLangPicker();
  const grid = document.getElementById("game-grid");
  if (grid) renderGameGrid(grid);
}
