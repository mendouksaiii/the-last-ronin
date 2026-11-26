import { useCallback, useEffect, useState } from "react";
import { ComicReader } from "@/components/comic/ComicReader";
import { EndingScreen } from "@/components/game/EndingScreen";
import { GameScreen } from "@/components/game/GameScreen";
import { TitleScreen } from "@/components/game/TitleScreen";
import { sound } from "@/game/audio/soundEngine";
import { PROLOGUE } from "@/game/data/story";
import { clearSave, loadSave, newSave, writeSave } from "@/game/save";
import type { SaveData } from "@/game/types";

type Screen = "title" | "prologue" | "game" | "ending";

const Index = () => {
  const [screen, setScreen] = useState<Screen>("title");
  const [stored, setStored] = useState<SaveData | null>(() => loadSave());
  const [save, setSave] = useState<SaveData | null>(null);

  useEffect(() => {
    if (screen !== "prologue") return;
    sound.unlock();
    sound.setMusic("title", 0.8);
    return () => {
      sound.setMusic("none", 0.45);
    };
  }, [screen]);

  const play = (data: SaveData) => {
    setSave(data);
    setScreen(data.prologue ? "game" : "prologue");
  };

  const startNew = () => {
    clearSave();
    const fresh = newSave();
    writeSave(fresh);
    setStored(fresh);
    play(fresh);
  };

  const onEnding = useCallback(() => setScreen("ending"), []);

  if (screen === "prologue" && save) {
    return (
      <ComicReader
        pages={PROLOGUE}
        onDone={() => {
          save.prologue = true;
          writeSave(save);
          setScreen("game");
        }}
      />
    );
  }

  if (screen === "game" && save) {
    return (
      <GameScreen
        save={save}
        onEnding={onEnding}
        onExitTitle={() => {
          setStored(loadSave() ?? save);
          setScreen("title");
        }}
      />
    );
  }

  if (screen === "ending" && save) {
    return (
      <EndingScreen
        save={save}
        onExplore={() => setScreen("game")}
        onTitle={() => {
          setStored(loadSave() ?? save);
          setScreen("title");
        }}
      />
    );
  }

  return <TitleScreen save={stored} onContinue={() => stored && play(stored)} onNew={startNew} />;
};

export default Index;
