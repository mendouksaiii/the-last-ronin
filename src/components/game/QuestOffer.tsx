import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NATIONS } from "@/game/data/nations";
import type { Mission } from "@/game/types";
import { CLASS_ICONS } from "./icons";

interface Props {
  mission: Mission;
  onAccept: () => void;
  onDecline: () => void;
}

/** The quest giver's offer: what the mission is and what it asks of the hero. */
export function QuestOffer({ mission, onAccept, onDecline }: Props) {
  const Icon = CLASS_ICONS[mission.cls];
  const nation = NATIONS[mission.nation];
  return (
    <Dialog open onOpenChange={(open) => !open && onDecline()}>
      <DialogContent className="max-w-md border border-border border-l-2 border-l-primary bg-background text-foreground sm:rounded-none">
        <DialogHeader>
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tabular-nums tracking-widest text-primary">
            <Icon className="size-4" /> {mission.cls} mission {mission.n} of 10 · {nation.name}
          </p>
          <DialogTitle className="font-display text-4xl font-normal tracking-wider">{mission.title}</DialogTitle>
          <DialogDescription className="text-sm font-semibold text-muted-foreground">
            {nation.giver}: {mission.beat}.
          </DialogDescription>
        </DialogHeader>
        <ol className="space-y-1 border-l-2 border-accent pl-3 text-sm font-semibold">
          {mission.steps.map((s, i) => (
            <li key={i}>{s.text}</li>
          ))}
        </ol>
        <DialogFooter className="gap-2">
          <Button variant="hud" onClick={onDecline}>
            Not yet
          </Button>
          <Button variant="hero" onClick={onAccept}>
            Accept mission
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
