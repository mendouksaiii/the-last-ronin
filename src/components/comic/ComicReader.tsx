import { useCallback, useEffect, useState } from "react";
import { ChevronRight, RotateCcw, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sound } from "@/game/audio/soundEngine";
import { lookupVoiceLine } from "@/game/data/voiceManifest";
import type { ComicPage, Panel } from "@/game/types";
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

function panelVoiceUrls(panel: Panel): string[] {
  const urls: string[] = [];
  if (panel.caption) {
    const cap = lookupVoiceLine("Narrator", panel.caption);
    if (cap) urls.push(cap);
  }
  if (panel.speech) {
    const split = panel.speech.indexOf(": ");
    const speaker = split > 0 ? panel.speech.slice(0, split) : "Narrator";
    const line = split > 0 ? panel.speech.slice(split + 2) : panel.speech;
    const sp = lookupVoiceLine(speaker, line);
    if (sp) urls.push(sp);
  }
  return urls;
}

/** Full-screen comic pages with sequenced voice narration. Click, tap or press Space to turn the page. */
export function ComicReader({ pages, onDone }: Props) {
  const [page, setPage] = useState(0);
  const [replayNonce, setReplayNonce] = useState(0);
  const last = page >= pages.length - 1;

  const finish = useCallback(() => {
    sound.stopVoice();
    onDone();
  }, [onDone]);

  const next = useCallback(() => {
    sound.unlock();
    sound.stopVoice();
    if (last) onDone();
    else setPage((p) => p + 1);
  }, [last, onDone]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === " " || ev.key === "Enter") {
        ev.preventDefault();
        next();
      } else if (ev.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, finish]);

  // Sequence all caption + speech voice lines on the active page and preload the next page.
  useEffect(() => {
    const panels = pages[page] ?? [];
    const queue = panels.flatMap(panelVoiceUrls);
    const nextPanels = pages[page + 1] ?? [];
    for (const url of nextPanels.flatMap(panelVoiceUrls)) sound.preloadVoice(url);

    let cancelled = false;
    let idx = 0;
    const playNext = () => {
      if (cancelled || idx >= queue.length) return;
      const url = queue[idx++];
      sound.playVoice(url, {
        volume: 1.0,
        onEnd: () => {
          if (!cancelled) playNext();
        },
      });
    };

    const timer = window.setTimeout(() => {
      sound.unlock();
      playNext();
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      sound.stopVoice();
    };
  }, [pages, page, replayNonce]);

  const panels = pages[page] ?? [];
  const hasVoice = panels.some((p) => panelVoiceUrls(p).length > 0);

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
          {hasVoice && (
            <Button
              variant="hud"
              size="sm"
              onClick={(ev) => {
                ev.stopPropagation();
                sound.unlock();
                setReplayNonce((n) => n + 1);
              }}
              title="Replay page voiceover"
            >
              <RotateCcw /> <span className="hidden sm:inline">Replay</span>
            </Button>
          )}
          {!last && (
            <Button
              variant="hud"
              size="sm"
              onClick={(ev) => {
                ev.stopPropagation();
                finish();
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
