import { Check, Lock, MapPin, Skull } from "lucide-react";
import { SceneArt } from "@/components/comic/SceneArt";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { NATION_ORDER, NATIONS } from "@/game/data/nations";
import { generalSlain, generalsSlain, nationOpen, nationProgress } from "@/game/save";
import type { NationId, SaveData } from "@/game/types";

interface Props {
  save: SaveData;
  /** True while a mission is in progress; travelling abandons it. */
  busy: boolean;
  onTravel: (nation: NationId) => void;
  onClose: () => void;
}

/** The city map: five districts of New York, their generals and the progress in each. */
export function WorldMap({ save, busy, onTravel, onClose }: Props) {
  const shards = generalsSlain(save);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto border border-border sm:rounded-none">
        <DialogHeader>
          <DialogTitle className="font-display text-4xl font-normal tracking-wider">Drowned New York</DialogTitle>
          <DialogDescription className="font-bold">
            {save.done.length} of 50 missions complete · {shards} of 5 shards of Daybreak recovered
            {busy && <span className="mt-1 block text-accent">Moving to another district abandons your current mission.</span>}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {NATION_ORDER.map((id) => {
            const n = NATIONS[id];
            const open = nationOpen(save, id);
            const slain = generalSlain(save, id);
            const here = save.nation === id;
            const count = nationProgress(save, id);
            return (
              <article key={id} className={cn("flex flex-col border bg-secondary text-foreground", here ? "border-primary shadow-glow" : "border-border")}>
                <div className="relative aspect-[5/3] border-b border-border">
                  <SceneArt scene={id} actors={open ? [n.general.actor] : []} />
                  {!open && (
                    <div className="absolute inset-0 flex items-center justify-center bg-ink/75 text-muted-foreground">
                      <Lock className="size-8" />
                    </div>
                  )}
                  {slain && (
                    <span className="absolute right-1.5 top-1.5 flex items-center gap-1 bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                      <Skull className="size-3" /> Slain
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1.5 p-2.5">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-primary">
                    {n.act} · {n.realm}
                  </p>
                  <h3 className="font-display text-2xl leading-tight tracking-wide">{n.name}</h3>
                  <p className="text-xs font-bold leading-snug text-muted-foreground">{n.blurb}</p>
                  <p className="text-xs font-bold leading-snug">
                    {n.general.title}: {n.general.name}
                  </p>
                  <div className="mt-auto pt-1.5">
                    <div className="mb-1 flex justify-between text-[11px] font-bold uppercase tracking-wider">
                      <span>Missions</span>
                      <span>{count} / 10</span>
                    </div>
                    <Progress value={count * 10} className="h-1.5 rounded-none bg-muted" />
                  </div>
                  {here ? (
                    <Button variant="hud" size="sm" disabled className="mt-1.5">
                      <MapPin /> You are here
                    </Button>
                  ) : open ? (
                    <Button variant="hero" size="sm" className="mt-1.5" onClick={() => onTravel(id)}>
                      {count === 10 ? <Check /> : null} Go there
                    </Button>
                  ) : (
                    <p className="mt-1.5 border border-dashed border-border px-2 text-muted-foreground py-1.5 text-center text-[11px] font-bold leading-snug">
                      Sealed until the other four generals are dead
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
