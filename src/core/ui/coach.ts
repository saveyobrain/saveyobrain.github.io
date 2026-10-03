import { STORAGE_PREFIX } from "../../config";
import { h } from "./dom";

export type CoachFocus = "task" | "fuel";

export interface Coach {
  readonly active: boolean;
  show(opts: {
    root: HTMLElement;
    focus: CoachFocus;
    message: string;
    buttonLabel: string;
    spotlight: HTMLElement;
    onDone: () => void;
  }): void;
  hide(): void;
  /** Activate primary button (Esc / Enter). */
  confirm(): void;
}

/** Spotlight coach: dims the rest of the game while a target stays readable. */
export function createCoach(): Coach {
  const scrim = h("div", { class: "coach-scrim", "aria-hidden": "true" });
  const message = h("p", { class: "coach-message" });
  const button = h("button", { class: "btn primary coach-btn", type: "button" });
  const card = h("div", { class: "coach-card", role: "dialog", "aria-modal": "true" }, message, button);
  const layer = h("div", { class: "coach-layer" }, scrim, card);

  let onDone: (() => void) | null = null;
  let spotlight: HTMLElement | null = null;
  let root: HTMLElement | null = null;
  let focus: CoachFocus | null = null;
  let placeholder: HTMLElement | null = null;
  let homeParent: HTMLElement | null = null;
  let homeNext: ChildNode | null = null;

  function restoreSpotlight(): void {
    if (!spotlight) return;
    spotlight.classList.remove("coach-spotlight", "coach-spotlight-float");
    spotlight.style.removeProperty("left");
    spotlight.style.removeProperty("top");
    spotlight.style.removeProperty("width");
    if (homeParent) {
      homeParent.insertBefore(spotlight, homeNext);
    }
    placeholder?.remove();
    placeholder = null;
    homeParent = null;
    homeNext = null;
  }

  function hide(): void {
    if (!focus) return;
    restoreSpotlight();
    layer.remove();
    root?.classList.remove("coach-on", `coach-focus-${focus}`);
    root?.style.removeProperty("--coach-card-bottom");
    spotlight = null;
    root = null;
    focus = null;
    onDone = null;
  }

  function layoutCard(): void {
    if (!root || !focus) return;
    const panel = root.querySelector(".task-panel") as HTMLElement | null;
    const panelH = panel?.offsetHeight ?? 0;
    if (focus === "task") {
      root.style.setProperty("--coach-card-bottom", `${panelH + 16}px`);
    } else {
      const status = root.querySelector(".hud-status") as HTMLElement | null;
      const statusH = status?.offsetHeight ?? 40;
      root.style.setProperty("--coach-card-bottom", `${panelH + statusH + 28}px`);
    }
  }

  /** Lift the fuel meter above the full-screen scrim so it stays sharp. */
  function floatFuelMeter(el: HTMLElement): void {
    const rect = el.getBoundingClientRect();
    homeParent = el.parentElement;
    homeNext = el.nextSibling;
    placeholder = h("div", { class: "coach-meter-placeholder" });
    placeholder.style.width = `${rect.width}px`;
    placeholder.style.height = `${rect.height}px`;
    homeParent?.insertBefore(placeholder, el);
    el.classList.add("coach-spotlight", "coach-spotlight-float");
    el.style.left = `${rect.left}px`;
    el.style.top = `${rect.top}px`;
    el.style.width = `${rect.width}px`;
    layer.append(el);
  }

  button.addEventListener("click", () => {
    button.blur();
    const done = onDone;
    hide();
    done?.();
  });

  return {
    get active() {
      return focus !== null;
    },
    show(opts) {
      hide();
      root = opts.root;
      focus = opts.focus;
      onDone = opts.onDone;
      spotlight = opts.spotlight;
      message.textContent = opts.message;
      button.textContent = opts.buttonLabel;
      root.classList.add("coach-on", `coach-focus-${opts.focus}`);

      if (opts.focus === "fuel") {
        floatFuelMeter(opts.spotlight);
      } else {
        opts.spotlight.classList.add("coach-spotlight");
      }

      root.append(layer);
      layoutCard();
      requestAnimationFrame(() => {
        layoutCard();
        button.focus();
      });
    },
    hide,
    confirm() {
      if (!focus) return;
      button.click();
    },
  };
}

export interface CoachFlags {
  /** True once the “solve tasks” hint has been shown. */
  solve: boolean;
  /** True once the fuel-bar hint has been shown. */
  meter: boolean;
}

const COACH_KEY = `${STORAGE_PREFIX}:save-the-light:coach`;

export function loadCoachFlags(): CoachFlags {
  try {
    const raw = localStorage.getItem(COACH_KEY);
    if (!raw) return { solve: false, meter: false };
    const parsed = JSON.parse(raw) as Partial<CoachFlags>;
    return { solve: !!parsed.solve, meter: !!parsed.meter };
  } catch {
    return { solve: false, meter: false };
  }
}

export function markCoachFlag(flag: keyof CoachFlags): void {
  const flags = loadCoachFlags();
  if (flags[flag]) return;
  flags[flag] = true;
  try {
    localStorage.setItem(COACH_KEY, JSON.stringify(flags));
  } catch {
    // Private mode / quota — still treated as shown for this session via callers.
  }
}
