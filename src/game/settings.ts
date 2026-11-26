// Persistent player settings for audio levels, camera feel, graphics quality and HUD hints.

export type GraphicsQuality = "high" | "balanced" | "performance";

export interface GameSettings {
  muted: boolean;
  masterVol: number;
  musicVol: number;
  sfxVol: number;
  ambVol: number;
  voiceVol: number;
  mouseSensitivity: number;
  invertY: boolean;
  cameraFov: number;
  screenShake: boolean;
  graphicsQuality: GraphicsQuality;
  showHints: boolean;
}

const KEY = "last-ronin-settings-v1";

export const DEFAULT_SETTINGS: GameSettings = {
  muted: false,
  masterVol: 0.85,
  musicVol: 0.62,
  sfxVol: 0.9,
  ambVol: 0.58,
  voiceVol: 0.95,
  mouseSensitivity: 1.0,
  invertY: false,
  cameraFov: 58,
  screenShake: true,
  graphicsQuality: "high",
  showHints: true,
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function sanitize(raw: Partial<GameSettings> | null | undefined): GameSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SETTINGS };
  const num = (v: unknown, def: number, lo: number, hi: number) =>
    typeof v === "number" && Number.isFinite(v) ? clamp(v, lo, hi) : def;
  const q = raw.graphicsQuality;
  const graphicsQuality: GraphicsQuality =
    q === "high" || q === "balanced" || q === "performance" ? q : DEFAULT_SETTINGS.graphicsQuality;
  return {
    muted: typeof raw.muted === "boolean" ? raw.muted : DEFAULT_SETTINGS.muted,
    masterVol: num(raw.masterVol, DEFAULT_SETTINGS.masterVol, 0, 1),
    musicVol: num(raw.musicVol, DEFAULT_SETTINGS.musicVol, 0, 1),
    sfxVol: num(raw.sfxVol, DEFAULT_SETTINGS.sfxVol, 0, 1),
    ambVol: num(raw.ambVol, DEFAULT_SETTINGS.ambVol, 0, 1),
    voiceVol: num(raw.voiceVol, DEFAULT_SETTINGS.voiceVol, 0, 1),
    mouseSensitivity: num(raw.mouseSensitivity, DEFAULT_SETTINGS.mouseSensitivity, 0.3, 2.5),
    invertY: typeof raw.invertY === "boolean" ? raw.invertY : DEFAULT_SETTINGS.invertY,
    cameraFov: Math.round(num(raw.cameraFov, DEFAULT_SETTINGS.cameraFov, 50, 72)),
    screenShake: typeof raw.screenShake === "boolean" ? raw.screenShake : DEFAULT_SETTINGS.screenShake,
    graphicsQuality,
    showHints: typeof raw.showHints === "boolean" ? raw.showHints : DEFAULT_SETTINGS.showHints,
  };
}

function loadInitial(): GameSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return sanitize(JSON.parse(raw) as Partial<GameSettings>);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

let current: GameSettings = loadInitial();
const listeners = new Set<(s: GameSettings) => void>();

export function getSettings(): GameSettings {
  return current;
}

export function updateSettings(patch: Partial<GameSettings>): GameSettings {
  current = sanitize({ ...current, ...patch });
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(current));
    } catch {
      // Ignore storage failures in private browsing.
    }
  }
  for (const fn of listeners) fn(current);
  return current;
}

export function resetSettings(): GameSettings {
  return updateSettings(DEFAULT_SETTINGS);
}

export function subscribeSettings(fn: (s: GameSettings) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
