import { useState } from "react";
import { Home, Keyboard, LogOut, Play, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { sound } from "@/game/audio/soundEngine";
import { CONTROL_ROWS } from "@/game/data/controls";
import { writeSave } from "@/game/save";
import type { HudState, SaveData } from "@/game/types";
import { cn } from "@/lib/utils";
import { SettingsPanel } from "./SettingsPanel";

interface Props {
  save: SaveData;
  hud: HudState;
  onResume: () => void;
  onReturnHideout: () => void;
  onExitTitle: () => void;
}

type Tab = "pause" | "settings" | "controls";

const EXTRA_CONTROLS: [string, string][] = [
  ["Esc / P", "Pause & settings"],
  ["H", "Hide / show HUD hints"],
];

/** In-game pause dialog with mission summary, audio/camera/graphics settings and full controls reference. */
export function PauseMenu({ save, hud, onResume, onReturnHideout, onExitTitle }: Props) {
  const [tab, setTab] = useState<Tab>("pause");
  const click = () => sound.playSfx("uiClick", { volume: 0.75 });

  const switchTab = (next: Tab) => {
    click();
    setTab(next);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onResume()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border border-border sm:rounded-none">
        <DialogHeader>
          <DialogTitle className="font-display text-4xl font-normal tracking-wider">Paused</DialogTitle>
          <DialogDescription className="font-bold tabular-nums">
            {hud.zone} · Level {save.level} · {save.done.length} of 50 missions complete
          </DialogDescription>
        </DialogHeader>

        <div className="flex border-b border-border">
          {(
            [
              ["pause", "Menu"],
              ["settings", "Settings"],
              ["controls", "Controls"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => switchTab(id)}
              className={cn(
                "px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                tab === id
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "pause" && (
          <div className="flex flex-col gap-4">
            <div className="border border-border border-l-2 border-l-primary bg-secondary p-3.5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-primary">
                {hud.memory ? "Brother's Memory" : "Current Objective"}
              </p>
              <p className="mt-0.5 text-sm font-bold text-foreground">
                {hud.objective ? hud.objective.title : "Free roam in " + hud.zone}
              </p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">
                {hud.objective ? hud.objective.text : "Explore the district, patrol rooftops or speak with allies at the hideout."}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-4 border-t border-border/70 pt-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground tabular-nums">
                <span>Stims: {hud.stims}/{hud.maxStims}</span>
                <span>HP: {Math.ceil(hud.hp)}/{Math.ceil(hud.maxHp)}</span>
                <span>XP: {save.xp}/{hud.xpNeed}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                variant="hero"
                size="lg"
                onClick={() => {
                  click();
                  onResume();
                }}
              >
                <Play /> Resume mission
              </Button>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant="ink" onClick={() => switchTab("settings")}>
                  <SlidersHorizontal /> Audio & Graphics Settings
                </Button>
                <Button variant="ink" onClick={() => switchTab("controls")}>
                  <Keyboard /> Controls Reference
                </Button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  variant="ink"
                  onClick={() => {
                    click();
                    onReturnHideout();
                  }}
                >
                  <Home /> {hud.memory ? "Leave memory" : "Return to hideout"}
                </Button>
                <Button
                  variant="ink"
                  onClick={() => {
                    click();
                    writeSave(save);
                    onExitTitle();
                  }}
                >
                  <LogOut /> Save & exit to title
                </Button>
              </div>
            </div>
          </div>
        )}

        {tab === "settings" && <SettingsPanel />}

        {tab === "controls" && (
          <div className="border border-border bg-secondary p-3.5">
            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-widest text-primary">Keyboard & Mouse Bindings</p>
            <dl className="grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
              {[...CONTROL_ROWS, ...EXTRA_CONTROLS].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3 border-b border-border/50 pb-1">
                  <dt className="shrink-0 font-bold text-accent">{k}</dt>
                  <dd className="text-right font-semibold text-foreground/85">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
