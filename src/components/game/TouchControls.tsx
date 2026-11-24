import { useRef, useState } from "react";
import type { Game } from "@/game/engine/game";
import type { Action } from "@/game/engine/input";
import type { HudState } from "@/game/types";
import { cn } from "@/lib/utils";
import { ACTION_ICONS, WEAPON_ICONS } from "./icons";

const RADIUS = 46;

function Pad({ label, onDown, onUp, className, children }: { label: string; onDown: () => void; onUp?: () => void; className?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        onDown();
      }}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={onUp}
      className={cn("no-select pointer-events-auto absolute flex items-center justify-center rounded-full border border-border bg-background/80 text-foreground active:scale-95", className)}
    >
      {children}
    </button>
  );
}

/** Joystick, camera drag and combat buttons for touch screens. */
export function TouchControls({ game, hud }: { game: Game; hud: HudState }) {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const pad = useRef<HTMLDivElement>(null);
  const look = useRef<{ id: number; x: number } | null>(null);
  const input = game.input;
  const act = (a: Action) => game.act(a);

  const move = (ev: React.PointerEvent) => {
    const el = pad.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    let x = (ev.clientX - (box.left + box.width / 2)) / RADIUS;
    let y = (ev.clientY - (box.top + box.height / 2)) / RADIUS;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    input.stick = { x, y };
    setKnob({ x, y });
  };
  const release = () => {
    input.stick = { x: 0, y: 0 };
    setKnob({ x: 0, y: 0 });
  };
  const Weapon = WEAPON_ICONS[hud.weapon];
  const I = ACTION_ICONS;

  return (
    <>
      {/* Drag anywhere on the right half to turn the camera. */}
      <div
        className="no-select pointer-events-auto absolute inset-y-0 right-0 w-1/2"
        onPointerDown={(ev) => {
          ev.currentTarget.setPointerCapture(ev.pointerId);
          look.current = { id: ev.pointerId, x: ev.clientX };
        }}
        onPointerMove={(ev) => {
          const l = look.current;
          if (!l || l.id !== ev.pointerId) return;
          input.look.x += (ev.clientX - l.x) * 1.6;
          l.x = ev.clientX;
        }}
        onPointerUp={() => (look.current = null)}
        onPointerCancel={() => (look.current = null)}
      />
      <div
        ref={pad}
        className="no-select pointer-events-auto absolute bottom-6 left-5 size-28 rounded-full border border-border bg-background/65"
        onPointerDown={(ev) => {
          ev.currentTarget.setPointerCapture(ev.pointerId);
          move(ev);
        }}
        onPointerMove={(ev) => {
          if (ev.currentTarget.hasPointerCapture(ev.pointerId)) move(ev);
        }}
        onPointerUp={release}
        onPointerCancel={release}
        aria-label="Move"
        role="application"
      >
        <div
          className="absolute left-1/2 top-1/2 size-12 rounded-full border border-border bg-paper/80"
          style={{ transform: `translate(calc(-50% + ${knob.x * RADIUS}px), calc(-50% + ${knob.y * RADIUS}px))` }}
        />
      </div>
      <Pad label="Crouch" onDown={() => act("crouch")} className={cn("bottom-36 left-6 size-11", hud.crouched && "border-accent text-accent")}>
        <I.crouch className="size-5" />
      </Pad>

      <Pad label="Light attack" onDown={() => act("light")} className="bottom-8 right-8 size-20 border-primary bg-primary/40">
        <Weapon className="size-8" />
      </Pad>
      <Pad label="Heavy attack" onDown={() => act("heavy")} className="bottom-28 right-6 size-14">
        <I.heavy className="size-6" />
      </Pad>
      <Pad label="Dodge" onDown={() => act("dodge")} className="bottom-6 right-32 size-14">
        <I.dodge className="size-6" />
      </Pad>
      <Pad label="Jump and climb" onDown={() => act("jump")} className="bottom-6 right-52 size-12">
        <I.jump className="size-5" />
      </Pad>
      <Pad
        label="Guard and parry"
        onDown={() => {
          input.guardHeld = true;
          act("guard");
        }}
        onUp={() => (input.guardHeld = false)}
        className="bottom-24 right-28 size-14"
      >
        <I.guard className="size-6" />
      </Pad>
      <Pad label="Weapon art" onDown={() => act("special")} className={cn("bottom-44 right-8 size-11", hud.specialCd <= 0 && "border-accent text-accent")}>
        <I.special className="size-5" />
      </Pad>
      <Pad label="Lock on" onDown={() => act("lock")} className={cn("bottom-44 right-24 size-11", hud.locked && "border-primary text-primary")}>
        <I.lock className="size-5" />
      </Pad>
      <Pad label="Use a stim" onDown={() => act("stim")} className="bottom-56 right-16 size-10">
        <I.stim className="size-4" />
      </Pad>
    </>
  );
}
