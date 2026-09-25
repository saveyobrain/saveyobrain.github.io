import { strings } from "../../strings";
import { h } from "./dom";

export interface Hud {
  el: HTMLElement;
  setLevel(text: string): void;
  /** 0..1 */
  setMeter(value: number): void;
  setInfo(text: string): void;
}

export function createHud(meterIcon: string, onPause: () => void): Hud {
  const level = h("div", { class: "hud-level" });
  const fill = h("div", { class: "hud-meter-fill" });
  const meter = h("div", { class: "hud-meter" }, h("span", { class: "hud-meter-icon" }, meterIcon), h("div", { class: "hud-meter-track" }, fill));
  const info = h("div", { class: "hud-info" });
  const pause = h("button", { class: "hud-pause", type: "button", "aria-label": strings.pause, title: `${strings.pause} (Esc)` }, "\u275A\u275A");
  pause.addEventListener("click", onPause);

  const el = h("div", { class: "hud" }, h("div", { class: "hud-left" }, level, meter, info), pause);

  return {
    el,
    setLevel: (text) => {
      level.textContent = text;
    },
    setMeter: (v) => {
      const clamped = Math.max(0, Math.min(1, v));
      fill.style.width = `${clamped * 100}%`;
      meter.classList.toggle("low", clamped < 0.25);
    },
    setInfo: (text) => {
      info.textContent = text;
    },
  };
}
