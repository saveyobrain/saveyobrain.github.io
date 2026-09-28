import { strings } from "../../strings";
import { h } from "./dom";
// import { supportLink } from "./support";

export interface Hud {
  el: HTMLElement;
  setLevel(text: string): void;
  /** 0..1 */
  setMeter(value: number): void;
  setInfo(text: string): void;
}

export function createHud(meterIcon: string, onMenu: () => void): Hud {
  const level = h("div", { class: "hud-level" });
  const fill = h("div", { class: "hud-meter-fill" });
  const meter = h("div", { class: "hud-meter" }, h("span", { class: "hud-meter-icon" }, meterIcon), h("div", { class: "hud-meter-track" }, fill));
  const info = h("div", { class: "hud-info" });
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
    h("div", { class: "hud-bottom-left" }, meter, info),
  );

  return {
    el,
    setLevel: (text) => {
      level.textContent = text;
    },
    setMeter: (v) => {
      const clamped = Math.max(0, Math.min(1, v));
      fill.style.width = `${clamped * 100}%`;
      meter.classList.toggle("critical", clamped > 0 && clamped < 0.25);
      meter.classList.toggle("low", clamped >= 0.25 && clamped < 0.5);
    },
    setInfo: (text) => {
      info.textContent = text;
    },
  };
}
