import { h } from "./dom";

export interface ModalButton {
  label: string;
  /** Smaller second line under the label. */
  hint?: string;
  primary?: boolean;
  /** Marks the current choice in a list of options. */
  selected?: boolean;
  /** If set, renders as a link instead of a button. */
  href?: string;
  /** Open href in a new tab (default true for http(s) links). */
  external?: boolean;
  onClick?(): void;
}

export interface ModalOptions {
  title: string;
  lines?: string[];
  buttons: ModalButton[];
  /** Options shown as a two-column grid above the regular buttons. */
  choices?: ModalButton[];
}

export interface Modal {
  /** Triggers the primary button (Enter/Space). */
  confirm(): void;
  close(): void;
}

function button(b: ModalButton, baseClass: string): HTMLElement {
  const classes = [baseClass, b.primary && "btn-primary", b.selected && "selected"].filter(Boolean).join(" ");
  const content = [h("span", { class: "btn-label" }, b.label), b.hint && h("span", { class: "btn-hint" }, b.hint)];

  if (b.href) {
    const external = b.external ?? /^https?:\/\//.test(b.href);
    const link = h(
      "a",
      {
        class: classes,
        href: b.href,
        target: external ? "_blank" : undefined,
        rel: external ? "noopener noreferrer" : undefined,
        "aria-pressed": b.selected === undefined ? undefined : String(b.selected),
      },
      ...content,
    );
    if (b.onClick) link.addEventListener("click", () => b.onClick?.());
    return link;
  }

  const btn = h(
    "button",
    { class: classes, type: "button", "aria-pressed": b.selected === undefined ? undefined : String(b.selected) },
    ...content,
  );
  btn.addEventListener("click", () => b.onClick?.());
  return btn;
}

/** Centered card over the game area; used for intro, pause, win and lose screens. */
export function showModal(parent: HTMLElement, options: ModalOptions): Modal {
  const choices = (options.choices ?? []).map((b) => button(b, "btn btn-choice"));
  const buttons = options.buttons.map((b) => button(b, "btn"));
  const card = h(
    "div",
    { class: "modal-card", role: "dialog", "aria-modal": "true" },
    h("h2", {}, options.title),
    ...(options.lines ?? []).map((line) => h("p", {}, line)),
    choices.length > 0 && h("div", { class: "modal-choices" }, ...choices),
    h("div", { class: "modal-buttons" }, ...buttons),
  );
  const el = h("div", { class: "modal" }, card);
  parent.append(el);
  const focusTarget =
    choices[(options.choices ?? []).findIndex((b) => b.selected)] ??
    buttons[options.buttons.findIndex((b) => b.primary)] ??
    buttons[0];
  focusTarget?.focus({ preventScroll: true });

  return {
    confirm: () => (options.buttons.find((b) => b.primary) ?? options.buttons[0])?.onClick?.(),
    close: () => el.remove(),
  };
}
