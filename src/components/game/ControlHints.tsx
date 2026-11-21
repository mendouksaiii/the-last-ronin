import { useState } from "react";
import { Keyboard, X } from "lucide-react";

const ROWS: [string, string][] = [
  ["WASD", "Move"],
  ["Mouse / ← →", "Camera"],
  ["Click / J", "Light attack"],
  ["Right click / K", "Heavy attack"],
  ["F", "Weapon art"],
  ["Space", "Dodge"],
  ["Q or L", "Guard · tap to parry"],
  ["Shift", "Sprint"],
  ["C", "Crouch · stealth"],
  ["Tab", "Lock on"],
  ["E", "Takedown · talk"],
  ["R", "Stim"],
  ["1 – 4", "Weapons"],
  ["M · I", "Map · Quests"],
];

/** Collapsible keyboard and mouse reference for desktop play. */
export function ControlHints() {
  const [open, setOpen] = useState(true);
  return (
    <div className="pointer-events-auto absolute bottom-4 left-4 hidden lg:block">
      {open ? (
        <div className="w-60 border border-border border-l-2 border-l-accent bg-background/90 p-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Controls</span>
            <button type="button" aria-label="Hide controls" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <X className="size-3.5" />
            </button>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px]">
            {ROWS.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="font-bold text-accent">{k}</dt>
                <dd className="text-foreground/80">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <button type="button" aria-label="Show controls" onClick={() => setOpen(true)} className="flex size-9 items-center justify-center border border-border bg-background/90 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
          <Keyboard className="size-4" />
        </button>
      )}
    </div>
  );
}
