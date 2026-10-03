import { getStrings } from "../../i18n/strings";
import { h } from "./dom";
// import { supportLink } from "./support";

export type MapProgressPhase = "filling" | "ready" | "done";

export interface Hud {
  el: HTMLElement;
  /** Fuel meter element — used for first-run coach spotlight. */
  fuelMeter: HTMLElement;
  setLevel(text: string): void;
  /** 0..1 */
  setMeter(value: number): void;
  setSolved(n: number): void;
  setMapProgress(current: number, target: number, phase: MapProgressPhase): void;
  /** @deprecated Prefer setSolved; kept for simple text slots if needed. */
  setInfo(text: string): void;
}

export function createHud(meterIcon: string, onMenu: () => void): Hud {
  const strings = getStrings();
  const level = h("div", { class: "hud-level" });
  const fill = h("div", { class: "hud-meter-fill" });
  const meter = h("div", { class: "hud-meter" }, h("span", { class: "hud-meter-icon" }, meterIcon), h("div", { class: "hud-meter-track" }, fill));

  const solves = h("div", { class: "hud-solves" }, "\u2714 0");

  const mapFill = h("div", { class: "hud-meter-fill" });
  const mapMeter = h(
    "div",
    { class: "hud-meter hud-map-meter", "data-phase": "filling" },
    h("span", { class: "hud-meter-icon", "aria-hidden": "true" }, "\u{1F5FA}\uFE0F"),
    h("div", { class: "hud-meter-track" }, mapFill),
  );

  const status = h("div", { class: "hud-status" }, meter, solves, mapMeter);

  const menu = h(
    "button",
    { class: "btn hud-menu", type: "button", title: `${strings.menu} (Esc)` },
    h("span", { class: "hud-menu-icon", "aria-hidden": "true" }, "\u2630"),
    strings.menu,
  );
  menu.addEventListener("click", () => {
    menu.blur();
    onMenu();
  });

  const el = h(
    "div",
    { class: "hud" },
    h(
      "div",
      { class: "hud-top" },
      h("div", { class: "hud-left" }, level),
      // Support the project: shown on selected level-complete modals instead of the HUD.
      h("div", { class: "hud-right" }, /* supportLink("hud-support"), */ menu),
    ),
    status,
  );

  return {
    el,
    fuelMeter: meter,
    setLevel: (text) => {
      level.textContent = text;
    },
    setMeter: (v) => {
      const clamped = Math.max(0, Math.min(1, v));
      fill.style.width = `${clamped * 100}%`;
      meter.classList.toggle("critical", clamped > 0 && clamped < 0.25);
      meter.classList.toggle("low", clamped >= 0.25 && clamped < 0.5);
    },
    setSolved: (n) => {
      solves.textContent = `\u2714 ${n}`;
    },
    setMapProgress: (current, target, phase) => {
      const ratio = phase === "filling" ? Math.max(0, Math.min(1, target > 0 ? current / target : 0)) : 1;
      mapFill.style.width = `${ratio * 100}%`;
      mapMeter.dataset.phase = phase;
      mapMeter.classList.toggle("done", phase === "done");
    },
    setInfo: (text) => {
      solves.textContent = text;
    },
  };
}
