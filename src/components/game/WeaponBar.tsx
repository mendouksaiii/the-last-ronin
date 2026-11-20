import { Sparkles } from "lucide-react";
import { WEAPONS, WEAPON_ORDER } from "@/game/data/weapons";
import type { HudState, WeaponId } from "@/game/types";
import { cn } from "@/lib/utils";
import { WEAPON_ICONS } from "./icons";

interface Props {
  hud: HudState;
  onWeapon: (w: WeaponId) => void;
}

/** The weapon switcher and the current weapon's art, with its cooldown. */
export function WeaponBar({ hud, onWeapon }: Props) {
  const w = WEAPONS[hud.weapon];
  const ready = hud.specialCd <= 0;
  return (
    <div className="flex items-end gap-2">
      <div className="flex gap-1">
        {hud.weapons.map((id) => {
          const Icon = WEAPON_ICONS[id];
          const on = id === hud.weapon;
          return (
            <button
              key={id}
              type="button"
              title={`${WEAPONS[id].owner}'s ${WEAPONS[id].name}: ${WEAPONS[id].role}`}
              aria-label={`Switch to ${WEAPONS[id].name}`}
              onPointerDown={(ev) => {
                ev.preventDefault();
                onWeapon(id);
              }}
              className={cn(
                "no-select relative flex size-11 items-center justify-center border transition-colors",
                on ? "border-primary bg-primary/25 text-foreground shadow-glow" : "border-border bg-background/70 text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-5" />
              <span className="absolute bottom-0 right-0.5 text-[9px] font-bold text-muted-foreground">{WEAPON_ORDER.indexOf(id) + 1}</span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-col items-start">
        <span className="font-display text-lg leading-none tracking-wider text-foreground">{w.name}</span>
        <span className={cn("flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest", ready ? "text-accent" : "text-muted-foreground")}>
          <Sparkles className="size-3" /> {w.special.name}
          {!ready && <span className="ml-1 inline-block h-1 w-10 bg-muted"><span className="block h-full bg-accent" style={{ width: `${(1 - hud.specialCd) * 100}%` }} /></span>}
        </span>
      </div>
    </div>
  );
}
