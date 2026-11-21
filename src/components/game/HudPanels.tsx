import { Eye, EyeOff, Syringe } from "lucide-react";
import type { HudState } from "@/game/types";
import { cn } from "@/lib/utils";
import { CLASS_ICONS } from "./icons";

function Bar({ value, max, className }: { value: number; max: number; className: string }) {
  return (
    <div className="h-full w-full overflow-hidden border border-ink bg-ink/80">
      <div className={cn("h-full transition-[width] duration-150", className)} style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} />
    </div>
  );
}

const STEALTH = {
  hidden: { label: "Hidden", icon: EyeOff, cls: "text-muted-foreground" },
  suspicious: { label: "Suspicious", icon: Eye, cls: "text-accent" },
  detected: { label: "Detected", icon: Eye, cls: "text-primary" },
} as const;

/** Hero name, level, health, stamina, stims and stealth. */
export function StatusPanel({ hud }: { hud: HudState }) {
  const low = hud.hp / hud.maxHp < 0.3;
  const s = hud.stealth ? STEALTH[hud.stealth] : null;
  return (
    <div className="w-56 border border-border border-l-2 border-l-primary bg-background/90 p-2 sm:w-72">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-display text-2xl leading-none tracking-wider text-foreground">{hud.hero}</span>
        <span className="text-xs font-bold uppercase tabular-nums tracking-widest text-muted-foreground">Lv {hud.level}</span>
      </div>
      <div className={cn("relative mt-1.5 h-3.5", low && "ring-1 ring-primary shadow-glow")}>
        <Bar value={hud.hp} max={hud.maxHp} className="bg-gradient-vermilion" />
        <span className="absolute inset-0 flex items-center justify-end pr-1 text-[10px] font-bold leading-none tabular-nums text-primary-foreground">
          {hud.hp}
        </span>
      </div>
      <div className="mt-1 h-1.5">
        <Bar value={hud.stamina} max={hud.maxStamina} className={hud.stamina < 20 ? "bg-accent" : "bg-paper"} />
      </div>
      <div className="mt-1 h-0.5">
        <Bar value={hud.xp} max={hud.xpNeed} className="bg-accent" />
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1" title="Healing stims (R)">
          {Array.from({ length: hud.maxStims }, (_, i) => (
            <Syringe key={i} className={cn("size-3.5", i < hud.stims ? "text-accent" : "text-muted")} />
          ))}
        </div>
        {s && (
          <span className={cn("flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest", s.cls)}>
            <s.icon className="size-3.5" /> {s.label}
          </span>
        )}
      </div>
      <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{hud.zone}</p>
    </div>
  );
}

/** The current mission and objective, or a hint when no mission is active. */
export function QuestTracker({ hud, hint }: { hud: HudState; hint: string | null }) {
  const o = hud.objective;
  if (!o) {
    return hint ? <div className="w-56 border border-border border-r-2 border-r-accent bg-background/90 p-2 text-xs font-bold text-muted-foreground sm:w-72">{hint}</div> : null;
  }
  const Icon = CLASS_ICONS[o.cls];
  return (
    <div className="w-56 border border-border border-r-2 border-r-accent bg-background/90 p-2 text-foreground sm:w-72">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-accent">
        <Icon className="size-3.5" /> {o.cls}
      </div>
      <p className="font-display text-lg leading-tight tracking-wide">{o.title}</p>
      <p className="mt-0.5 text-xs font-bold leading-snug text-foreground/85">
        {o.text}
        {o.need > 1 && (
          <span className="ml-1 tabular-nums text-accent">
            {o.got}/{o.need}
          </span>
        )}
      </p>
      {hud.friend && (
        <div className="mt-1.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{hud.friend.name}</p>
          <div className="h-2">
            <Bar value={hud.friend.hp} max={hud.friend.maxHp} className="bg-jade" />
          </div>
        </div>
      )}
    </div>
  );
}

export function BossBar({ boss }: { boss: NonNullable<HudState["boss"]> }) {
  return (
    <div className="w-[min(92vw,34rem)] animate-fade-in">
      <p className="text-center font-display text-xl tracking-widest text-foreground drop-shadow-[0_2px_0_hsl(var(--ink))]">{boss.name}</p>
      <div className="h-3">
        <Bar value={boss.hp} max={boss.maxHp} className="bg-gradient-vermilion" />
      </div>
    </div>
  );
}
