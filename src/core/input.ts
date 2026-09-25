export type Direction = "up" | "down" | "left" | "right";

export type InputEvent =
  | { type: "move"; dir: Direction }
  | { type: "answer"; index: number }
  | { type: "pause" }
  | { type: "confirm" };

const DIRECTION_KEYS: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "up",
  KeyS: "down",
  KeyA: "left",
  KeyD: "right",
};

const ANSWER_KEYS: Record<string, number> = {
  Digit1: 0,
  Digit2: 1,
  Digit3: 2,
  Digit4: 3,
  Numpad1: 0,
  Numpad2: 1,
  Numpad3: 2,
  Numpad4: 3,
};

export interface Keyboard {
  /** Most recently pressed direction that is still held, if any. */
  heldDirection(): Direction | null;
  dispose(): void;
}

/** Keyboard mapping shared by all games: arrows/WASD, 1-4, Esc, Enter/Space. */
export function createKeyboard(onEvent: (e: InputEvent) => void): Keyboard {
  const held: Direction[] = [];

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const dir = DIRECTION_KEYS[e.code];
    if (dir) {
      e.preventDefault();
      if (!e.repeat) {
        const i = held.indexOf(dir);
        if (i >= 0) held.splice(i, 1);
        held.push(dir);
        onEvent({ type: "move", dir });
      }
      return;
    }
    const answer = ANSWER_KEYS[e.code];
    if (answer !== undefined) {
      if (!e.repeat) onEvent({ type: "answer", index: answer });
      return;
    }
    if (e.code === "Escape") {
      e.preventDefault();
      if (!e.repeat) onEvent({ type: "pause" });
      return;
    }
    if (e.code === "Enter" || e.code === "NumpadEnter" || e.code === "Space") {
      // A focused button already turns Enter/Space into a click.
      if (e.target instanceof HTMLButtonElement) return;
      e.preventDefault();
      if (!e.repeat) onEvent({ type: "confirm" });
    }
  };

  const onKeyUp = (e: KeyboardEvent) => {
    const dir = DIRECTION_KEYS[e.code];
    if (!dir) return;
    const i = held.indexOf(dir);
    if (i >= 0) held.splice(i, 1);
  };

  const onBlur = () => {
    held.length = 0;
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  return {
    heldDirection: () => (held.length ? held[held.length - 1] : null),
    dispose: () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    },
  };
}
