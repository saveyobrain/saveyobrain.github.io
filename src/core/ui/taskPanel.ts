import type { MathTask } from "../math/tasks";
import { h } from "./dom";

export interface TaskPanel {
  el: HTMLElement;
  show(task: MathTask): void;
  /** Highlights the picked option and the correct one. */
  showResult(picked: number, correct: number): void;
  setEnabled(enabled: boolean): void;
}

export function createTaskPanel(onPick: (index: number) => void): TaskPanel {
  const question = h("div", { class: "task-question", "aria-live": "polite" });
  const options = h("div", { class: "task-options" });
  const el = h("div", { class: "task-panel" }, question, options);
  let buttons: HTMLButtonElement[] = [];

  return {
    el,
    show(task) {
      question.textContent = task.text.includes("=") ? `${task.text},  x = ?` : `${task.text} = ?`;
      options.replaceChildren();
      options.dataset.count = String(task.options.length);
      buttons = task.options.map((value, i) => {
        const btn = h(
          "button",
          { class: "task-option", type: "button" },
          h("span", { class: "task-key" }, String(i + 1)),
          h("span", { class: "task-value" }, String(value)),
        );
        btn.addEventListener("click", () => {
          btn.blur();
          onPick(i);
        });
        options.append(btn);
        return btn;
      });
      el.classList.remove("disabled");
    },
    showResult(picked, correct) {
      buttons[correct]?.classList.add("correct");
      if (picked !== correct) {
        buttons[picked]?.classList.add("wrong");
        el.classList.remove("shake");
        void el.offsetWidth;
        el.classList.add("shake");
      }
    },
    setEnabled(enabled) {
      el.classList.toggle("disabled", !enabled);
      for (const b of buttons) b.disabled = !enabled;
    },
  };
}
