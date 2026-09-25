import { h } from "./dom";

export interface ModalButton {
  label: string;
  primary?: boolean;
  onClick(): void;
}

export interface ModalOptions {
  title: string;
  lines?: string[];
  buttons: ModalButton[];
}

export interface Modal {
  /** Triggers the primary button (Enter/Space). */
  confirm(): void;
  close(): void;
}

/** Centered card over the game area; used for intro, pause, win and lose screens. */
export function showModal(parent: HTMLElement, options: ModalOptions): Modal {
  const buttons = options.buttons.map((b) => {
    const btn = h("button", { class: b.primary ? "btn btn-primary" : "btn", type: "button" }, b.label);
    btn.addEventListener("click", () => b.onClick());
    return btn;
  });
  const card = h(
    "div",
    { class: "modal-card", role: "dialog", "aria-modal": "true" },
    h("h2", {}, options.title),
    ...(options.lines ?? []).map((line) => h("p", {}, line)),
    h("div", { class: "modal-buttons" }, ...buttons),
  );
  const el = h("div", { class: "modal" }, card);
  parent.append(el);
  (buttons.find((_, i) => options.buttons[i].primary) ?? buttons[0])?.focus({ preventScroll: true });

  return {
    confirm: () => (options.buttons.find((b) => b.primary) ?? options.buttons[0])?.onClick(),
    close: () => el.remove(),
  };
}
