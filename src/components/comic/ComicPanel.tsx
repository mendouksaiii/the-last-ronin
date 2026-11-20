import type { Panel } from "@/game/types";
import { cn } from "@/lib/utils";
import { SceneArt } from "./SceneArt";

interface Props {
  panel: Panel;
  index: number;
  className?: string;
}

/** One comic panel: art, a narration caption and a speech bubble. */
export function ComicPanel({ panel, index, className }: Props) {
  const split = panel.speech?.indexOf(": ") ?? -1;
  const speaker = panel.speech && split > 0 ? panel.speech.slice(0, split) : "";
  const line = panel.speech && split > 0 ? panel.speech.slice(split + 2) : panel.speech;
  const ghost = /voice/i.test(speaker);
  return (
    <div
      className={cn("relative min-h-0 animate-panel-in overflow-hidden border-[3px] border-ink bg-ink shadow-comic", className)}
      style={{ animationDelay: `${index * 0.22}s` }}
    >
      {panel.image ? (
        <img src={panel.image} alt={panel.caption ?? "Comic illustration"} crossOrigin="anonymous" className="h-full w-full object-cover" />
      ) : (
        <SceneArt scene={panel.scene} actors={panel.actors} />
      )}
      {panel.caption && (
        <p className="absolute left-0 top-0 m-2 max-w-[82%] border-2 border-ink bg-paper px-2.5 py-1.5 text-xs font-semibold italic leading-snug text-ink shadow-comic sm:text-sm">
          {panel.caption}
        </p>
      )}
      {line && (
        <div
          className={cn(
            "absolute bottom-0 right-0 m-2 max-w-[86%] rounded-2xl border-2 border-ink bg-paper px-3 py-2 text-xs font-bold leading-snug text-ink shadow-comic sm:text-sm",
            ghost && "border-dashed italic",
          )}
        >
          {speaker && <span className="mb-0.5 block text-[0.7em] uppercase tracking-wider text-vermilion">{speaker}</span>}
          {/* Poems are written with " / " between their lines. */}
          {line.split(" / ").map((part, i) => (
            <span key={i} className="block">
              {part}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
