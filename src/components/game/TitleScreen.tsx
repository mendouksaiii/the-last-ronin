import { useEffect, useState } from "react";
import { SlidersHorizontal, Volume2, VolumeX } from "lucide-react";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { sound } from "@/game/audio/soundEngine";
import { ART } from "@/game/data/art";
import { getSettings, subscribeSettings, updateSettings } from "@/game/settings";
import type { SaveData } from "@/game/types";
import { SettingsPanel } from "./SettingsPanel";

interface Props {
  save: SaveData | null;
  onContinue: () => void;
  onNew: () => void;
}

export function TitleScreen({ save, onContinue, onNew }: Props) {
  const [confirm, setConfirm] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [muted, setMuted] = useState(() => getSettings().muted);

  useEffect(() => subscribeSettings((next) => setMuted(next.muted)), []);

  useEffect(() => {
    sound.unlock();
    sound.setMusic("title", 0.55);

    const onGesture = () => sound.unlock();
    window.addEventListener("pointerdown", onGesture, { passive: true });
    window.addEventListener("keydown", onGesture, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
      sound.setMusic("none", 0.35);
    };
  }, []);

  const toggleMute = () => {
    const next = !muted;
    updateSettings({ muted: next });
    if (!next) {
      sound.unlock();
      sound.playSfx("uiClick", { volume: 0.75 });
    }
  };

  return (
    <main className="relative flex h-full w-full flex-col items-center justify-end overflow-hidden bg-gradient-ink">
      <img src={ART.title} alt="Ren, a turtle ronin, stands in a rain-soaked ruined New York street under red neon" crossOrigin="anonymous" className="absolute inset-0 h-full w-full animate-fade-in object-cover" />
      <div className="absolute inset-0 bg-gradient-veil" />
      <div className="halftone absolute inset-0 opacity-30" />

      <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            sound.unlock();
            sound.playSfx("uiOpen", { volume: 0.75 });
            setSettingsOpen(true);
          }}
          aria-label="Open audio, camera and graphics settings"
          className="flex size-10 items-center justify-center border border-border bg-background/85 text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <SlidersHorizontal className="size-4" />
        </button>
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? "Unmute title music" : "Mute title music"}
          className="flex size-10 items-center justify-center border border-border bg-background/85 text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
      </div>

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
              <Button
                variant="hero"
                size="lg"
                onClick={() => {
                  sound.unlock();
                  sound.playSfx("uiClick", { volume: 0.8 });
                  onContinue();
                }}
              >
                Continue the journey
              </Button>
              <Button
                variant="ink"
                size="lg"
                onClick={() => {
                  sound.unlock();
                  sound.playSfx("uiClick", { volume: 0.8 });
                  setConfirm(true);
                }}
              >
                Start over
              </Button>
            </>
          ) : (
            <Button
              variant="hero"
              size="lg"
              onClick={() => {
                sound.unlock();
                sound.playSfx("uiClick", { volume: 0.8 });
                onNew();
              }}
            >
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

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto border border-border sm:rounded-none">
          <DialogHeader>
            <DialogTitle className="font-display text-4xl font-normal tracking-wider">Settings</DialogTitle>
            <DialogDescription className="font-bold">
              Audio levels, camera sensitivity, field of view and graphics quality
            </DialogDescription>
          </DialogHeader>
          <SettingsPanel />
        </DialogContent>
      </Dialog>

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
