import { SceneArt } from "@/components/comic/SceneArt";
import { Button } from "@/components/ui/button";
import type { SaveData } from "@/game/types";

interface Props {
  save: SaveData;
  onExplore: () => void;
  onTitle: () => void;
}

/** Shown after the epilogue, once all five generals have fallen. */
export function EndingScreen({ save, onExplore, onTitle }: Props) {
  return (
    <main className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-gradient-ink p-6 text-center">
      <div className="w-full max-w-2xl animate-panel-in border-[3px] border-ink bg-paper shadow-comic-lg">
        <div className="aspect-[5/2] border-b-[3px] border-ink">
          <SceneArt scene="grave" actors={["ren"]} />
        </div>
        <div className="flex flex-col items-center gap-3 p-6 text-ink">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-vermilion">Daybreak is whole again</p>
          <h1 className="font-display text-5xl leading-none sm:text-6xl">The End</h1>
          <p className="max-w-md text-sm font-bold leading-relaxed">
            Five generals have fallen. The bo, the chain and the nunchaku lie beside the katana on the Lantern Lord's grave, and the last ronin walks out into the rain, free.
          </p>
          <p className="text-xs font-bold uppercase tracking-wider text-ink/70">
            Level {save.level} · {save.done.length} of 50 missions complete
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Button variant="hero" onClick={onExplore}>
              Keep wandering
            </Button>
            <Button variant="ink" onClick={onTitle}>
              Title screen
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
