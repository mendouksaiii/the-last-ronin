import type { Vec } from "./state";

export type Action =
  | "light"
  | "heavy"
  | "special"
  | "dodge"
  | "guard"
  | "stim"
  | "interact"
  | "crouch"
  | "lock"
  | "weapon1"
  | "weapon2"
  | "weapon3"
  | "weapon4";

const KEY_ACTIONS: Record<string, Action> = {
  j: "light",
  k: "heavy",
  f: "special",
  " ": "dodge",
  r: "stim",
  e: "interact",
  c: "crouch",
  control: "crouch",
  tab: "lock",
  "1": "weapon1",
  "2": "weapon2",
  "3": "weapon3",
  "4": "weapon4",
};

/** Held to guard; a press just before a blow lands is a parry. */
const BLOCK_KEYS = ["q", "l"];
const PREVENT = ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " ", "tab", "control", "shift"];

/** Keyboard, mouse and touch input shared by the engine and the on-screen controls. */
export class Input {
  keys = new Set<string>();
  /** Touch joystick direction, each axis in -1..1. */
  stick: Vec = { x: 0, y: 0 };
  /** Guard held by mouse, touch or keyboard. */
  guardHeld = false;
  queue: Action[] = [];
  /** Accumulated camera turn from mouse or touch drag, consumed each frame. */
  look: Vec = { x: 0, y: 0 };

  private down = (ev: KeyboardEvent) => {
    const k = ev.key.toLowerCase();
    if (PREVENT.includes(k)) ev.preventDefault();
    if (ev.repeat) return;
    this.keys.add(k);
    if (BLOCK_KEYS.includes(k)) this.queue.push("guard");
    const action = KEY_ACTIONS[k];
    if (action) this.queue.push(action);
  };

  private up = (ev: KeyboardEvent) => {
    this.keys.delete(ev.key.toLowerCase());
  };

  private blur = () => {
    this.keys.clear();
    this.guardHeld = false;
  };

  attach() {
    window.addEventListener("keydown", this.down);
    window.addEventListener("keyup", this.up);
    window.addEventListener("blur", this.blur);
  }

  detach() {
    window.removeEventListener("keydown", this.down);
    window.removeEventListener("keyup", this.up);
    window.removeEventListener("blur", this.blur);
  }

  /** Movement, x to the right and y forward, relative to the camera. */
  axis(): Vec {
    const k = this.keys;
    // Left and right arrows turn the camera instead (see Game.updateCamera).
    let x = this.stick.x + (k.has("d") ? 1 : 0) - (k.has("a") ? 1 : 0);
    let y = -this.stick.y + (k.has("w") || k.has("arrowup") ? 1 : 0) - (k.has("s") || k.has("arrowdown") ? 1 : 0);
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  guarding() {
    return this.guardHeld || BLOCK_KEYS.some((k) => this.keys.has(k));
  }

  sprinting() {
    return this.keys.has("shift");
  }
}
