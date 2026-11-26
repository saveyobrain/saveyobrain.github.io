import { getStrings } from "../../i18n/strings";
import { h } from "../../core/ui/dom";

export interface LookUpHud {
  el: HTMLElement;
  setWave(wave: number): void;
  setScore(score: number): void;
  setLives(lives: number, max: number): void;
  setShields(charges: number): void;
  setDifficulty(text: string): void;
}

/** Compact status strip for Look UP (wave / score / lives / shields). */
export function createLookUpHud(onMenu: () => void): LookUpHud {
  const strings = getStrings();
  const t = strings.lookUp;

  const wave = h("div", { class: "hud-level lup-wave" });
  const score = h("div", { class: "hud-solves lup-score" });
  const lives = h("div", { class: "hud-solves lup-lives" });
  const shields = h("div", { class: "hud-solves lup-shields" });
  const difficulty = h("div", { class: "hud-level lup-diff" });

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

  const status = h("div", { class: "hud-status lup-status" }, lives, shields, score);

  const el = h(
    "div",
    { class: "hud lup-hud" },
    h(
      "div",
      { class: "hud-top" },
      h("div", { class: "hud-left" }, wave, difficulty),
      h("div", { class: "hud-right" }, menu),
    ),
    status,
  );

  return {
    el,
    setWave: (n) => {
      wave.textContent = t.wave(n);
    },
    setScore: (n) => {
      score.textContent = t.score(n);
    },
    setLives: (n, max) => {
      lives.textContent = t.lives(n, max);
      lives.classList.toggle("critical", n <= 1);
    },
    setShields: (n) => {
      shields.textContent = t.shields(n);
      shields.classList.toggle("empty", n <= 0);
    },
    setDifficulty: (text) => {
      difficulty.textContent = text;
    },
  };
}
