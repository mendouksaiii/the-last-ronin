import { Check, CircleDot, Lock } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MISSIONS } from "@/game/data/missions";
import { NATION_ORDER, NATIONS } from "@/game/data/nations";
import { nationOpen, nationProgress } from "@/game/save";
import type { Mission, SaveData } from "@/game/types";
import { cn } from "@/lib/utils";
import { CLASS_ICONS } from "./icons";

interface Props {
  save: SaveData;
  /** Id of the mission in progress, if any. */
  activeId: string | null;
  /** Objective of the mission in progress. */
  objective: string | null;
  onClose: () => void;
}

type Status = "done" | "active" | "next" | "locked";

const SHORT = { reeds: "Queens", snow: "Heights", tides: "Docks", lanterns: "Neon", ash: "Ash" } as const;

function Row({ m, status, note }: { m: Mission; status: Status; note: string }) {
  const Icon = CLASS_ICONS[m.cls];
  return (
    <li
      className={cn(
        "flex gap-2.5 border p-2",
        status === "locked" ? "border-border bg-background text-muted-foreground" : "border-border bg-secondary text-foreground",
        status === "active" && "border-primary shadow-glow",
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center border border-border bg-background text-accent">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-[11px] font-bold uppercase tabular-nums tracking-wider", status !== "locked" && "text-primary")}>
          {m.n}. {m.cls}
        </p>
        <p className="font-display text-lg leading-tight tracking-wide">{m.title}</p>
        <p className="text-xs font-bold leading-snug opacity-80">{m.beat}</p>
        <p className="mt-0.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider">
          {status === "done" && <Check className="size-3.5" />}
          {status === "active" && <CircleDot className="size-3.5" />}
          {status === "locked" && <Lock className="size-3.5" />}
          {note}
        </p>
      </div>
    </li>
  );
}

/** The quest log: all fifty missions with their class, story beat and status. */
export function QuestLog({ save, activeId, objective, onClose }: Props) {
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-3 border-l border-border sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-4xl font-normal tracking-wider">Quest Log</SheetTitle>
          <SheetDescription className="font-bold tabular-nums">{save.done.length} of 50 missions complete</SheetDescription>
        </SheetHeader>
        <Tabs defaultValue={save.nation} className="flex min-h-0 flex-1 flex-col">
          <TabsList className="grid w-full grid-cols-5">
            {NATION_ORDER.map((id) => (
              <TabsTrigger key={id} value={id} className="px-1 text-xs font-bold">
                {SHORT[id]}
              </TabsTrigger>
            ))}
          </TabsList>
          {NATION_ORDER.map((id) => {
            const open = nationOpen(save, id);
            const next = MISSIONS[id].find((m) => !save.done.includes(m.id));
            return (
              <TabsContent key={id} value={id} className="min-h-0 flex-1 overflow-y-auto pr-1">
                <p className="mb-2 text-xs font-bold uppercase tabular-nums tracking-wider text-muted-foreground">
                  {NATIONS[id].name} · {nationProgress(save, id)} / 10
                </p>
                <ul className="space-y-2 pb-2">
                  {MISSIONS[id].map((m) => {
                    let status: Status = "locked";
                    let note = "Complete the earlier missions first";
                    if (save.done.includes(m.id)) {
                      status = "done";
                      note = "Complete";
                    } else if (m.id === activeId) {
                      status = "active";
                      note = objective ?? "In progress";
                    } else if (!open) {
                      note = "Sealed until four generals are dead";
                    } else if (m === next) {
                      status = "next";
                      note = id === save.nation ? `Speak with ${NATIONS[id].giver}` : `Go to ${NATIONS[id].name}`;
                    }
                    return <Row key={m.id} m={m} status={status} note={note} />;
                  })}
                </ul>
              </TabsContent>
            );
          })}
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
