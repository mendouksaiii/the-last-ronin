import { useEffect, useState } from "react";
import { RotateCcw, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { sound } from "@/game/audio/soundEngine";
import {
  getSettings,
  resetSettings,
  subscribeSettings,
  updateSettings,
  type GameSettings,
  type GraphicsQuality,
} from "@/game/settings";
import { cn } from "@/lib/utils";

const QUALITY_OPTIONS: { id: GraphicsQuality; label: string; detail: string }[] = [
  { id: "high", label: "High", detail: "Shadows · Bloom · Ambient Occlusion · Crisp DPR" },
  { id: "balanced", label: "Balanced", detail: "Shadows · Bloom · Capped DPR" },
  { id: "performance", label: "Performance", detail: "Shadows off · Fast post-processing" },
];

const pct = (v: number) => `${Math.round(v * 100)}%`;

interface SliderRowProps {
  label: string;
  valueText: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}

function SliderRow({ label, valueText, value, min, max, step, disabled, onChange }: SliderRowProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", disabled && "opacity-50")}>
      <div className="flex items-center justify-between text-xs font-bold">
        <span className="text-foreground">{label}</span>
        <span className="tabular-nums text-accent">{valueText}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={([next]) => onChange(next)}
        onValueCommit={() => sound.playSfx("uiClick", { volume: 0.65 })}
      />
    </div>
  );
}

/** Shared audio, camera and graphics settings panel backed by persistent GameSettings. */
export function SettingsPanel() {
  const [settings, setSettings] = useState<GameSettings>(() => getSettings());

  useEffect(() => subscribeSettings(setSettings), []);

  const click = () => sound.playSfx("uiClick", { volume: 0.75 });

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 border border-border border-l-2 border-l-primary bg-secondary p-3.5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-primary">Audio Mixers</p>
            <p className="text-xs font-semibold text-muted-foreground">Soundtracks, rain/wind ambience and combat foley</p>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-bold">
            {settings.muted ? <VolumeX className="size-4 text-primary" /> : <Volume2 className="size-4 text-accent" />}
            <span>Mute</span>
            <Switch
              checked={settings.muted}
              onCheckedChange={(muted) => {
                updateSettings({ muted });
                if (!muted) {
                  sound.unlock();
                  sound.playSfx("uiClick", { volume: 0.75 });
                }
              }}
            />
          </label>
        </div>

        <SliderRow
          label="Master volume"
          valueText={pct(settings.masterVol)}
          value={settings.masterVol}
          min={0}
          max={1}
          step={0.02}
          disabled={settings.muted}
          onChange={(masterVol) => updateSettings({ masterVol })}
        />
        <SliderRow
          label="Music"
          valueText={pct(settings.musicVol)}
          value={settings.musicVol}
          min={0}
          max={1}
          step={0.02}
          disabled={settings.muted}
          onChange={(musicVol) => updateSettings({ musicVol })}
        />
        <SliderRow
          label="Combat & world SFX"
          valueText={pct(settings.sfxVol)}
          value={settings.sfxVol}
          min={0}
          max={1}
          step={0.02}
          disabled={settings.muted}
          onChange={(sfxVol) => updateSettings({ sfxVol })}
        />
        <SliderRow
          label="Weather & ambience"
          valueText={pct(settings.ambVol)}
          value={settings.ambVol}
          min={0}
          max={1}
          step={0.02}
          disabled={settings.muted}
          onChange={(ambVol) => updateSettings({ ambVol })}
        />
      </section>

      <section className="flex flex-col gap-3 border border-border bg-secondary p-3.5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-primary">Camera & Interface</p>
        <SliderRow
          label="Mouse sensitivity"
          valueText={`${settings.mouseSensitivity.toFixed(2)}x`}
          value={settings.mouseSensitivity}
          min={0.3}
          max={2.5}
          step={0.05}
          onChange={(mouseSensitivity) => updateSettings({ mouseSensitivity })}
        />
        <SliderRow
          label="Camera field of view"
          valueText={`${settings.cameraFov}°`}
          value={settings.cameraFov}
          min={50}
          max={72}
          step={1}
          onChange={(cameraFov) => updateSettings({ cameraFov })}
        />

        <div className="flex items-center justify-between pt-1">
          <div>
            <p className="text-xs font-bold">Screen shake</p>
            <p className="text-[11px] text-muted-foreground">Camera impact recoil on heavy hits, parries and explosions</p>
          </div>
          <Switch
            checked={settings.screenShake}
            onCheckedChange={(screenShake) => {
              click();
              updateSettings({ screenShake });
            }}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold">Desktop controls card</p>
            <p className="text-[11px] text-muted-foreground">Show the collapsible keybinding card in the bottom-left corner</p>
          </div>
          <Switch
            checked={settings.showHints}
            onCheckedChange={(showHints) => {
              click();
              updateSettings({ showHints });
            }}
          />
        </div>
      </section>

      <section className="flex flex-col gap-2.5 border border-border bg-secondary p-3.5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-primary">Graphics Quality</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {QUALITY_OPTIONS.map((opt) => {
            const active = settings.graphicsQuality === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  click();
                  updateSettings({ graphicsQuality: opt.id });
                }}
                className={cn(
                  "flex flex-col items-start gap-1 border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  active
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border bg-background/60 text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                )}
              >
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">{opt.label}</span>
                <span className="text-[11px] leading-snug">{opt.detail}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex justify-end">
        <Button
          variant="ink"
          size="sm"
          onClick={() => {
            click();
            resetSettings();
          }}
        >
          <RotateCcw /> Reset to defaults
        </Button>
      </div>
    </div>
  );
}
