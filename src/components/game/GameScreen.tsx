import { useEffect, useRef, useState } from "react";
import { Home, Map as MapIcon, Pause, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { ComicReader } from "@/components/comic/ComicReader";
import { Button } from "@/components/ui/button";
import { sound } from "@/game/audio/soundEngine";
import { NATIONS } from "@/game/data/nations";
import { Game } from "@/game/engine/game";
import { Renderer } from "@/game/render/renderer";
import { nextMission } from "@/game/save";
import { getSettings, subscribeSettings, updateSettings } from "@/game/settings";
import type { ComicPage, HudState, Mission, SaveData } from "@/game/types";
import { useCoarsePointer } from "@/hooks/use-coarse-pointer";
import { cn } from "@/lib/utils";
import { ControlHints } from "./ControlHints";
import { BossBar, QuestTracker, StatusPanel } from "./HudPanels";
import { PauseMenu } from "./PauseMenu";
import { QuestLog } from "./QuestLog";
import { QuestOffer } from "./QuestOffer";
import { TouchControls } from "./TouchControls";
import { WeaponBar } from "./WeaponBar";
import { WorldMap } from "./WorldMap";

interface Props {
  save: SaveData;
  onEnding: () => void;
  onExitTitle: () => void;
}

interface Comic {
  id: number;
  pages: ComicPage[];
  then: () => void;
}

type Panel = "map" | "log" | "pause" | null;

/** The playable world: the 3D view, the HUD and the comic pages that tell the story. */
export function GameScreen({ save, onEnding, onExitTitle }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const comicId = useRef(0);
  const [hud, setHud] = useState<HudState | null>(null);
  const [comic, setComic] = useState<Comic | null>(null);
  const [offer, setOffer] = useState<Mission | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [settings, setSettings] = useState(() => getSettings());
  const [failed, setFailed] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [, setVersion] = useState(0);
  const touch = useCoarsePointer();

  useEffect(() => subscribeSettings(setSettings), []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const game = new Game(
      save,
      (e) => {
        if (e.type === "offer") setOffer(e.mission);
        else if (e.type === "comic") setComic({ id: ++comicId.current, pages: e.pages, then: e.then });
        else if (e.type === "toast") toast(e.title, { description: e.text, position: "top-center" });
        else if (e.type === "ending") onEnding();
        else setVersion((v) => v + 1);
        if (e.type === "offer" || e.type === "comic") {
          game.paused = true;
          document.exitPointerLock?.();
        }
      },
      setHud,
    );
    let renderer: Renderer;
    try {
      renderer = new Renderer(host, game, window.matchMedia("(pointer: coarse)").matches, setContextLost);
    } catch {
      setFailed(true);
      return;
    }
    game.onFrame = (dt) => renderer.frame(dt);
    gameRef.current = game;
    game.start();

    // Mouse: left button light attack, right button heavy, middle lock-on; moving turns the camera.
    const canvas = renderer.canvas;
    canvasRef.current = canvas;
    const down = (ev: PointerEvent) => {
      sound.unlock();
      if (ev.pointerType !== "mouse" || game.paused) return;
      if (document.pointerLockElement !== canvas) {
        const lock = canvas.requestPointerLock?.() as unknown as Promise<void> | undefined;
        lock?.catch?.(() => undefined);
      }
      if (ev.button === 0) game.act("light");
      else if (ev.button === 2) game.act("heavy");
      else if (ev.button === 1) game.act("lock");
    };
    const moveMouse = (ev: PointerEvent) => {
      if (ev.pointerType !== "mouse") return;
      if (document.pointerLockElement === canvas || ev.buttons) game.input.look.x += ev.movementX;
    };
    const menu = (ev: Event) => ev.preventDefault();
    const onLockChange = () => setPointerLocked(document.pointerLockElement === canvas);

    canvas.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", moveMouse);
    canvas.addEventListener("contextmenu", menu);
    document.addEventListener("pointerlockchange", onLockChange);
    return () => {
      canvas.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", moveMouse);
      canvas.removeEventListener("contextmenu", menu);
      document.removeEventListener("pointerlockchange", onLockChange);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      canvasRef.current = null;
      setPointerLocked(false);
      game.stop();
      renderer.dispose();
      gameRef.current = null;
    };
  }, [save, onEnding]);

  const overlay = !!comic || !!offer || !!panel;
  useEffect(() => {
    if (gameRef.current) gameRef.current.paused = overlay || contextLost;
    if (overlay || contextLost) document.exitPointerLock?.();
  }, [overlay, contextLost]);

  // Esc/P toggles Pause, M opens Map, I opens Quests, H toggles HUD control hints.
  const blocked = !!comic || !!offer;
  const memoryLocked = !!hud?.memory;
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (blocked || ev.repeat) return;
      const k = ev.key.toLowerCase();
      if (ev.key === "Escape") {
        setPanel((p) => {
          if (p === "map" || p === "log" || p === "pause") return null;
          sound.playSfx("uiOpen", { volume: 0.75 });
          return "pause";
        });
      } else if (k === "p") {
        setPanel((p) => {
          const next = p === "pause" ? null : "pause";
          if (next) sound.playSfx("uiOpen", { volume: 0.75 });
          return next;
        });
      } else if (k === "m" && !memoryLocked) {
        setPanel((p) => {
          const next = p === "map" ? null : "map";
          if (next) sound.playSfx("uiOpen", { volume: 0.75 });
          return next;
        });
      } else if (k === "i") {
        setPanel((p) => {
          const next = p === "log" ? null : "log";
          if (next) sound.playSfx("uiOpen", { volume: 0.75 });
          return next;
        });
      } else if (k === "h") {
        const next = !getSettings().showHints;
        updateSettings({ showHints: next });
        sound.playSfx("uiClick", { volume: 0.65 });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [blocked, memoryLocked]);

  const resumeGameplay = () => {
    setPanel(null);
    const canvas = canvasRef.current;
    if (canvas && !touch && document.pointerLockElement !== canvas) {
      const lock = canvas.requestPointerLock?.() as unknown as Promise<void> | undefined;
      lock?.catch?.(() => undefined);
    }
  };

  const game = gameRef.current;
  const nation = NATIONS[save.nation];
  const upcoming = nextMission(save, save.nation);
  const hint = hud?.memory
    ? null
    : upcoming
      ? `Find ${nation.giver} at the hideout to take the next mission.`
      : `${nation.name} is free. Open the map to move on.`;
  const cine = !!hud?.cinematic;

  return (
    <div className="no-select relative h-full w-full overflow-hidden bg-background">
      <div ref={hostRef} className="absolute inset-0" />

      {failed && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
          <p className="max-w-md font-bold text-muted-foreground">This device could not start the 3D view (WebGL is unavailable). Try a recent desktop browser.</p>
        </div>
      )}

      {contextLost && !failed && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/85 p-6 text-center">
          <p className="max-w-sm border border-border bg-secondary px-4 py-3 text-sm font-bold text-foreground">Restoring graphics context...</p>
        </div>
      )}

      {hud && game && (
        // Keep keyboard focus off the HUD so Space never re-triggers a clicked button.
        <div className={cn("pointer-events-none absolute inset-0 transition-opacity duration-300", cine && "opacity-0")} onMouseDown={(ev) => ev.preventDefault()}>
          {touch && <TouchControls game={game} hud={hud} />}

          <div className="absolute left-2 top-2 flex flex-col gap-2 sm:left-4 sm:top-4">
            <StatusPanel hud={hud} />
            <div className={cn("sm:hidden", hud.boss && "hidden")}>
              <QuestTracker hud={hud} hint={hint} />
            </div>
          </div>

          <div className="absolute right-2 top-2 flex flex-col items-end gap-2 sm:right-4 sm:top-4">
            <div className="pointer-events-auto flex gap-1.5">
              <Button
                variant="hud"
                size="sm"
                className="whitespace-nowrap"
                disabled={hud.memory}
                onClick={() => {
                  sound.playSfx("uiOpen", { volume: 0.75 });
                  setPanel("map");
                }}
                title="City map (M)"
              >
                <MapIcon /> <span className="hidden md:inline">Map</span>
              </Button>
              <Button
                variant="hud"
                size="sm"
                className="whitespace-nowrap"
                onClick={() => {
                  sound.playSfx("uiOpen", { volume: 0.75 });
                  setPanel("log");
                }}
                title="Quest log (I)"
              >
                <ScrollText /> <span className="hidden md:inline">Quests</span>
              </Button>
              <Button
                variant="hud"
                size="sm"
                className="whitespace-nowrap"
                onClick={() => {
                  sound.playSfx("uiClick", { volume: 0.75 });
                  game.returnToVillage();
                }}
                title={hud.memory ? "Leave the memory" : "Return to the hideout"}
              >
                <Home /> <span className="hidden md:inline">{hud.memory ? "Leave memory" : "Hideout"}</span>
              </Button>
              <Button
                variant="hud"
                size="sm"
                className="whitespace-nowrap"
                onClick={() => {
                  sound.playSfx("uiOpen", { volume: 0.75 });
                  setPanel("pause");
                }}
                title="Pause & settings (Esc / P)"
                aria-label="Pause and settings"
              >
                <Pause /> <span className="hidden md:inline">Pause</span>
              </Button>
            </div>
            <div className={cn("hidden sm:block", hud.boss && "max-lg:hidden")}>
              <QuestTracker hud={hud} hint={hint} />
            </div>
          </div>

          {!touch && !overlay && !contextLost && !pointerLocked && !cine && !hud.boss && (
            <div className="pointer-events-none absolute left-1/2 top-4 hidden -translate-x-1/2 border border-border bg-background/85 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground lg:block">
              Click view to lock camera · Pause (P)
            </div>
          )}

          {hud.boss && (
            <div className="absolute left-1/2 top-32 -translate-x-1/2 lg:top-5">
              <BossBar boss={hud.boss} />
            </div>
          )}

          <div className={cn("absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-3", touch ? "top-1/2 translate-y-12" : "bottom-5")}>
            {hud.prompt && (
              <Button variant="hero" className="pointer-events-auto animate-fade-in" onClick={() => game.interact()}>
                {!touch && <kbd className="border border-ink bg-paper px-1.5 text-xs text-ink">E</kbd>}
                {hud.prompt}
              </Button>
            )}
            {!touch && (
              <div className="pointer-events-auto">
                <WeaponBar hud={hud} onWeapon={(w) => game.setWeapon(w)} />
              </div>
            )}
          </div>

          {touch ? (
            <div className="pointer-events-auto absolute left-1/2 top-2 -translate-x-1/2 max-sm:top-auto max-sm:bottom-2">
              <WeaponBar hud={hud} onWeapon={(w) => game.setWeapon(w)} />
            </div>
          ) : (
            settings.showHints && <ControlHints />
          )}
        </div>
      )}

      {panel === "map" && game && (
        <WorldMap
          save={save}
          busy={!!hud?.objective}
          onClose={() => setPanel(null)}
          onTravel={(id) => {
            sound.playSfx("uiClick", { volume: 0.75 });
            setPanel(null);
            game.travel(id);
          }}
        />
      )}

      {panel === "log" && game && (
        <QuestLog save={save} activeId={game.active?.m.id ?? null} objective={hud?.objective?.text ?? null} onClose={() => setPanel(null)} />
      )}

      {panel === "pause" && game && hud && (
        <PauseMenu
          save={save}
          hud={hud}
          onResume={resumeGameplay}
          onReturnHideout={() => {
            setPanel(null);
            game.returnToVillage();
          }}
          onExitTitle={() => {
            setPanel(null);
            sound.stopGameplayAudio(0.35);
            onExitTitle();
          }}
        />
      )}

      {offer && game && (
        <QuestOffer
          mission={offer}
          onDecline={() => setOffer(null)}
          onAccept={() => {
            sound.playSfx("uiClick", { volume: 0.8 });
            setOffer(null);
            game.accept(offer);
          }}
        />
      )}

      {comic && (
        <ComicReader
          key={comic.id}
          pages={comic.pages}
          onDone={() => {
            setComic(null);
            comic.then();
          }}
        />
      )}
    </div>
  );
}
