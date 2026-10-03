import { CUSTOM_TABLE_MIN, CUSTOM_TABLE_PAGE_ENDS, customTableVisibleMax } from "../difficulty";
import type { CustomMathSettings } from "../storage";
import { h } from "./dom";
import type { Modal } from "./modal";

export interface CustomMathSetupStrings {
  title: string;
  operationsLabel: string;
  multiplication: string;
  division: string;
  tablesLabel: string;
  needSelection: string;
  loadMore: string;
  start: string;
  back: string;
}

function makeChip(n: number, selected: boolean): HTMLButtonElement {
  return h(
    "button",
    {
      class: "btn custom-chip",
      type: "button",
      "aria-pressed": String(selected),
      "data-n": String(n),
    },
    String(n),
  );
}

/** Interactive Custom difficulty setup: ×/÷ toggles and expandable table chips 2–20. */
export function showCustomMathSetup(
  parent: HTMLElement,
  initial: CustomMathSettings,
  labels: CustomMathSetupStrings,
  onStart: (settings: CustomMathSettings) => void,
  onBack: () => void,
): Modal {
  let mul = initial.mul;
  let div = initial.div;
  const tables = new Set(initial.tables);
  let visibleMax = customTableVisibleMax(initial.tables);

  const mulBtn = h(
    "button",
    { class: "btn custom-toggle", type: "button", "aria-pressed": String(mul) },
    labels.multiplication,
  );
  const divBtn = h(
    "button",
    { class: "btn custom-toggle", type: "button", "aria-pressed": String(div) },
    labels.division,
  );
  const chips = h("div", { class: "custom-chips" });
  const hint = h("p", { class: "custom-setup-hint" });
  const startBtn = h("button", { class: "btn btn-primary", type: "button" }, labels.start);
  const backBtn = h("button", { class: "btn", type: "button" }, labels.back);

  function nextPageEnd(current: number): number | null {
    const idx = CUSTOM_TABLE_PAGE_ENDS.indexOf(current as (typeof CUSTOM_TABLE_PAGE_ENDS)[number]);
    if (idx < 0 || idx >= CUSTOM_TABLE_PAGE_ENDS.length - 1) return null;
    return CUSTOM_TABLE_PAGE_ENDS[idx + 1];
  }

  function onChipClick(n: number): void {
    if (tables.has(n)) {
      if (tables.size > 1) tables.delete(n);
    } else {
      tables.add(n);
    }
    sync();
  }

  function renderChips(): void {
    chips.replaceChildren();
    for (let n = CUSTOM_TABLE_MIN; n <= visibleMax; n++) {
      const btn = makeChip(n, tables.has(n));
      btn.addEventListener("click", () => onChipClick(n));
      chips.append(btn);
    }
    const moreTo = nextPageEnd(visibleMax);
    if (moreTo !== null) {
      const more = h(
        "button",
        { class: "btn custom-chip custom-load-more", type: "button", title: labels.loadMore },
        labels.loadMore,
      );
      more.addEventListener("click", () => {
        visibleMax = moreTo;
        renderChips();
        sync();
      });
      chips.append(more);
    }
  }

  function sync(): void {
    mulBtn.classList.toggle("selected", mul);
    mulBtn.setAttribute("aria-pressed", String(mul));
    divBtn.classList.toggle("selected", div);
    divBtn.setAttribute("aria-pressed", String(div));
    for (const btn of chips.querySelectorAll<HTMLButtonElement>(".custom-chip[data-n]")) {
      const n = Number(btn.dataset.n);
      const on = tables.has(n);
      btn.classList.toggle("selected", on);
      btn.setAttribute("aria-pressed", String(on));
    }
    const valid = (mul || div) && tables.size > 0;
    startBtn.disabled = !valid;
    hint.textContent = valid ? "" : labels.needSelection;
    hint.hidden = valid;
  }

  mulBtn.addEventListener("click", () => {
    mul = !mul;
    if (!mul && !div) div = true;
    sync();
  });
  divBtn.addEventListener("click", () => {
    div = !div;
    if (!mul && !div) mul = true;
    sync();
  });

  startBtn.addEventListener("click", () => {
    if (startBtn.disabled) return;
    startBtn.blur();
    onStart({ mul, div, tables: [...tables].sort((a, b) => a - b) });
  });
  backBtn.addEventListener("click", () => {
    backBtn.blur();
    onBack();
  });

  const card = h(
    "div",
    { class: "modal-card custom-setup-card", role: "dialog", "aria-modal": "true" },
    h("h2", {}, labels.title),
    h("p", { class: "custom-setup-label" }, labels.operationsLabel),
    h("div", { class: "custom-toggles" }, mulBtn, divBtn),
    h("p", { class: "custom-setup-label" }, labels.tablesLabel),
    chips,
    hint,
    h("div", { class: "modal-buttons" }, startBtn, backBtn),
  );
  const el = h("div", { class: "modal" }, card);
  parent.append(el);
  renderChips();
  sync();
  startBtn.focus({ preventScroll: true });

  return {
    confirm: () => {
      if (!startBtn.disabled) onStart({ mul, div, tables: [...tables].sort((a, b) => a - b) });
    },
    close: () => el.remove(),
  };
}
