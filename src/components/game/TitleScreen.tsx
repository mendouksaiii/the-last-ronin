import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ART } from "@/game/data/art";
import type { SaveData } from "@/game/types";

interface Props {
  save: SaveData | null;
  onContinue: () => void;
  onNew: () => void;
}

export function TitleScreen({ save, onContinue, onNew }: Props) {
  const [confirm, setConfirm] = useState(false);
  return (
    <main className="relative flex h-full w-full flex-col items-center justify-end overflow-hidden bg-gradient-ink">
      <img src={ART.title} alt="Ren, a turtle ronin, stands in a rain-soaked ruined New York street under red neon" crossOrigin="anonymous" className="absolute inset-0 h-full w-full animate-fade-in object-cover" />
      <div className="absolute inset-0 bg-gradient-veil" />
      <div className="halftone absolute inset-0 opacity-30" />

      <div className="relative z-10 flex w-full max-w-3xl flex-col items-center gap-5 px-6 pb-12 text-center sm:pb-16">
        <p className="animate-panel-in border border-border border-l-2 border-l-primary bg-background/85 px-3 py-1 text-xs font-bold uppercase tracking-[0.3em] text-foreground">
          A cinematic action story in fifty missions
        </p>
        <h1 className="animate-panel-in font-display text-7xl leading-none tracking-wider text-foreground drop-shadow-[0_4px_0_hsl(var(--ink))] sm:text-9xl">The Last Ronin</h1>
        <p className="animate-panel-in font-display text-2xl tracking-[0.3em] text-primary sm:text-3xl">Five Shards of Daybreak</p>
        <p className="max-w-xl text-sm font-semibold text-foreground/80 sm:text-base">
          Four turtle brothers guarded the Lantern Lord of a drowned New York. Five generals betrayed him. One brother is left, and he carries the others with him.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {save ? (
            <>
              <Button variant="hero" size="lg" onClick={onContinue}>
                Continue the journey
              </Button>
              <Button variant="ink" size="lg" onClick={() => setConfirm(true)}>
                Start over
              </Button>
            </>
          ) : (
            <Button variant="hero" size="lg" onClick={onNew}>
              Begin the journey
            </Button>
          )}
        </div>
        {save && (
          <p className="text-xs font-bold uppercase tabular-nums tracking-wider text-muted-foreground">
            Level {save.level} · {save.done.length} of 50 missions complete
          </p>
        )}
      </div>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start a new journey?</AlertDialogTitle>
            <AlertDialogDescription>This erases the progress saved on this device: your level and all completed missions.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my progress</AlertDialogCancel>
            <AlertDialogAction onClick={onNew}>Erase and start over</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
