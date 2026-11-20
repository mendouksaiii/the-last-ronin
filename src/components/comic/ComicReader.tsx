import { useCallback, useEffect, useState } from "react";
import { ChevronRight, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ComicPage } from "@/game/types";
import { cn } from "@/lib/utils";
import { ComicPanel } from "./ComicPanel";

interface Props {
  pages: ComicPage[];
  onDone: () => void;
}

const LAYOUT: Record<number, string> = {
  1: "grid-cols-1 grid-rows-1",
  2: "grid-cols-1 grid-rows-2 landscape:grid-cols-2 landscape:grid-rows-1",
  3: "grid-cols-2 grid-rows-2",
  4: "grid-cols-2 grid-rows-2",
};

/** Full-screen comic pages. Click, tap or press Space to turn the page. */
export function ComicReader({ pages, onDone }: Props) {
  const [page, setPage] = useState(0);
  const last = page >= pages.length - 1;

  const next = useCallback(() => {
    if (last) onDone();
    else setPage((p) => p + 1);
  }, [last, onDone]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === " " || ev.key === "Enter") {
        ev.preventDefault();
        next();
      } else if (ev.key === "Escape") onDone();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, onDone]);

  const panels = pages[page] ?? [];
  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in flex-col bg-gradient-ink p-3 sm:p-6" onClick={next} role="dialog" aria-label="Comic page">
      <div key={page} className={cn("mx-auto grid min-h-0 w-full max-w-5xl flex-1 gap-3 sm:gap-4", LAYOUT[panels.length] ?? LAYOUT[4])}>
        {panels.map((panel, i) => (
          <ComicPanel key={i} panel={panel} index={i} className={cn(panels.length === 3 && i === 0 && "col-span-2")} />
        ))}
      </div>
      <div className="mx-auto mt-3 flex w-full max-w-5xl items-center justify-between gap-3 sm:mt-4">
        <span className="text-sm font-bold text-muted-foreground">
          Page {page + 1} of {pages.length}
        </span>
        <div className="flex gap-2">
          {!last && (
            <Button
              variant="hud"
              size="sm"
              onClick={(ev) => {
                ev.stopPropagation();
                onDone();
              }}
            >
              <SkipForward /> Skip
            </Button>
          )}
          <Button
            variant="hero"
            size="sm"
            onClick={(ev) => {
              ev.stopPropagation();
              next();
            }}
          >
            {last ? "Continue" : "Next"} <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
