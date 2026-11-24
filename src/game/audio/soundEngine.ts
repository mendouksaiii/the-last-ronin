import { getSettings, subscribeSettings, type GameSettings } from "../settings";
import type { NationId } from "../types";

export type MusicKey = "none" | "title" | NationId | "boss";
export type AmbientKey = "none" | "rain" | "sleet" | "ash";

export type SfxKey =
  | "swingLight"
  | "swingHeavy"
  | "swingSpecial"
  | "drawBlade"
  | "hitFlesh"
  | "hitHeavy"
  | "hitWood"
  | "parry"
  | "block"
  | "guardBreak"
  | "finisher"
  | "dodge"
  | "bowShot"
  | "peril"
  | "bossIntro"
  | "stepDry"
  | "stepWet"
  | "slideWet"
  | "slideDry"
  | "jump"
  | "landHeavy"
  | "ledgeGrab"
  | "stim"
  | "hurt"
  | "death"
  | "pickup"
  | "levelup"
  | "thunder"
  | "uiClick"
  | "uiOpen";

export interface PlaySfxOpts {
  volume?: number;
  rate?: number;
  jitter?: number;
  /** Optional world coordinates for stereo panning & distance rolloff. */
  at?: { x: number; y: number };
}

const MUSIC_URLS: Record<Exclude<MusicKey, "none">, string> = {
  title: "/assets/audio/title-theme.mp3",
  reeds: "/assets/audio/bgm-reeds.mp3",
  snow: "/assets/audio/bgm-snow.mp3",
  tides: "/assets/audio/bgm-tides.mp3",
  lanterns: "/assets/audio/bgm-lanterns.mp3",
  ash: "/assets/audio/bgm-ash.mp3",
  boss: "/assets/audio/bgm-boss.mp3",
};

const AMBIENT_URLS: Record<Exclude<AmbientKey, "none">, string> = {
  rain: "/assets/audio/amb-rain.mp3",
  sleet: "/assets/audio/amb-wind.mp3",
  ash: "/assets/audio/amb-embers.mp3",
};

const SFX_URLS: Record<SfxKey, readonly string[]> = {
  swingLight: [
    "/assets/audio/swing-light-1.mp3",
    "/assets/audio/swing-light-2.mp3",
    "/assets/audio/swing-light-3.mp3",
  ],
  swingHeavy: ["/assets/audio/swing-heavy.mp3"],
  swingSpecial: ["/assets/audio/swing-special.mp3"],
  drawBlade: ["/assets/audio/draw-blade.mp3"],
  hitFlesh: ["/assets/audio/hit-flesh-1.mp3", "/assets/audio/hit-flesh-2.mp3"],
  hitHeavy: ["/assets/audio/hit-heavy.mp3"],
  hitWood: ["/assets/audio/hit-wood.mp3"],
  parry: ["/assets/audio/parry-1.mp3", "/assets/audio/parry-2.mp3"],
  block: ["/assets/audio/block.mp3"],
  guardBreak: ["/assets/audio/guard-break.mp3"],
  finisher: ["/assets/audio/finisher.mp3"],
  dodge: ["/assets/audio/dodge.mp3"],
  bowShot: ["/assets/audio/bow-shot.mp3"],
  peril: ["/assets/audio/peril.mp3"],
  bossIntro: ["/assets/audio/boss-intro.mp3"],
  stepDry: [
    "/assets/audio/step-dry-1.mp3",
    "/assets/audio/step-dry-2.mp3",
    "/assets/audio/step-dry-3.mp3",
  ],
  stepWet: [
    "/assets/audio/step-wet-1.mp3",
    "/assets/audio/step-wet-2.mp3",
    "/assets/audio/step-wet-3.mp3",
  ],
  slideWet: ["/assets/audio/slide-wet.mp3"],
  slideDry: ["/assets/audio/slide-dry.mp3"],
  jump: ["/assets/audio/jump.mp3"],
  landHeavy: ["/assets/audio/land-heavy.mp3"],
  ledgeGrab: ["/assets/audio/ledge-grab.mp3"],
  stim: ["/assets/audio/stim.mp3"],
  hurt: ["/assets/audio/hurt.mp3"],
  death: ["/assets/audio/death.mp3"],
  pickup: ["/assets/audio/pickup.mp3"],
  levelup: ["/assets/audio/levelup.mp3"],
  thunder: ["/assets/audio/thunder.mp3"],
  uiClick: ["/assets/audio/ui-click.mp3"],
  uiOpen: ["/assets/audio/ui-open.mp3"],
};

const SFX_COOLDOWN_MS: Partial<Record<SfxKey, number>> = {
  swingLight: 65,
  hitFlesh: 55,
  hitHeavy: 80,
  hitWood: 70,
  stepDry: 90,
  stepWet: 90,
  peril: 350,
  bowShot: 90,
  thunder: 2500,
  uiClick: 40,
};

const PRELOAD_KEYS: SfxKey[] = [
  "swingLight",
  "swingHeavy",
  "swingSpecial",
  "drawBlade",
  "hitFlesh",
  "hitHeavy",
  "hitWood",
  "parry",
  "block",
  "guardBreak",
  "finisher",
  "dodge",
  "bowShot",
  "peril",
  "stepDry",
  "stepWet",
  "slideWet",
  "slideDry",
  "jump",
  "landHeavy",
  "ledgeGrab",
  "stim",
  "hurt",
  "uiClick",
  "uiOpen",
];

interface ActiveLoop {
  key: string;
  src: AudioBufferSourceNode;
  gain: GainNode;
}

/**
 * Pure file-backed WebAudio engine: decodes real recorded soundtracks, ambient weather loops,
 * and combat/movement foley into separate mixer buses synced with GameSettings.
 */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private ambBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;

  private buffers = new Map<string, AudioBuffer>();
  private loading = new Map<string, Promise<AudioBuffer | null>>();

  private musicLoop: ActiveLoop | null = null;
  private musicTarget: MusicKey = "none";
  private musicReqId = 0;

  private ambLoop: ActiveLoop | null = null;
  private ambTarget: AmbientKey = "none";
  private ambReqId = 0;

  private duck = 1;
  private listenerX = 0;
  private listenerY = 0;
  private listenerYaw = 0;

  private lastPlayedAt = new Map<SfxKey, number>();
  private lastVariant = new Map<SfxKey, number>();
  private settings: GameSettings = getSettings();
  private unlockBound = false;

  constructor() {
    subscribeSettings((next) => {
      this.settings = next;
      this.syncBusVolumes();
    });
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => undefined);
      return this.ctx;
    }
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      const ctx = new Ctor();
      const master = ctx.createGain();
      const music = ctx.createGain();
      const amb = ctx.createGain();
      const sfx = ctx.createGain();

      music.connect(master);
      amb.connect(master);
      sfx.connect(master);
      master.connect(ctx.destination);

      this.ctx = ctx;
      this.masterGain = master;
      this.musicBus = music;
      this.ambBus = amb;
      this.sfxBus = sfx;

      this.syncBusVolumes(0.02);
      this.bindUnlock();
      return ctx;
    } catch {
      return null;
    }
  }

  private bindUnlock() {
    if (this.unlockBound || typeof window === "undefined") return;
    this.unlockBound = true;
    const resume = () => {
      if (this.ctx && this.ctx.state === "suspended") {
        void this.ctx.resume().catch(() => undefined);
      }
    };
    window.addEventListener("pointerdown", resume, { passive: true });
    window.addEventListener("keydown", resume, { passive: true });
  }

  unlock() {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === "suspended") {
      void ctx.resume().catch(() => undefined);
    }
  }

  private syncBusVolumes(tau = 0.06) {
    const ctx = this.ctx;
    if (!ctx || !this.masterGain || !this.musicBus || !this.ambBus || !this.sfxBus) return;
    const now = ctx.currentTime;
    const s = this.settings;
    const master = s.muted ? 0 : s.masterVol;
    this.masterGain.gain.setTargetAtTime(master, now, tau);
    this.musicBus.gain.setTargetAtTime(s.musicVol * this.duck, now, tau);
    this.ambBus.gain.setTargetAtTime(s.ambVol * (0.65 + 0.35 * this.duck), now, tau);
    this.sfxBus.gain.setTargetAtTime(s.sfxVol, now, tau);
  }

  setDucked(ducked: boolean) {
    const target = ducked ? 0.38 : 1;
    if (this.duck === target) return;
    this.duck = target;
    this.syncBusVolumes(0.14);
  }

  setListener(x: number, y: number, camYaw: number) {
    this.listenerX = x;
    this.listenerY = y;
    this.listenerYaw = camYaw;
  }

  private async loadBuffer(url: string): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(url);
    if (cached) return cached;
    const pending = this.loading.get(url);
    if (pending) return pending;

    const ctx = this.ensureContext();
    if (!ctx) return null;

    const job = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((raw) => ctx.decodeAudioData(raw))
      .then((decoded) => {
        this.buffers.set(url, decoded);
        this.loading.delete(url);
        return decoded;
      })
      .catch(() => {
        this.loading.delete(url);
        return null;
      });
    this.loading.set(url, job);
    return job;
  }

  preloadGameplayAudio() {
    if (typeof window === "undefined") return;
    this.ensureContext();
    for (const k of PRELOAD_KEYS) {
      for (const url of SFX_URLS[k]) {
        void this.loadBuffer(url);
      }
    }
  }

  private fadeOutLoop(loop: ActiveLoop | null, fadeSec: number) {
    const ctx = this.ctx;
    if (!loop || !ctx) return;
    const now = ctx.currentTime;
    try {
      loop.gain.gain.cancelScheduledValues(now);
      loop.gain.gain.setValueAtTime(loop.gain.gain.value, now);
      loop.gain.gain.linearRampToValueAtTime(0, now + fadeSec);
      loop.src.stop(now + fadeSec + 0.05);
      loop.src.onended = () => {
        try {
          loop.src.disconnect();
          loop.gain.disconnect();
        } catch {
          // Ignore already-disconnected nodes.
        }
      };
    } catch {
      // Ignore stop races.
    }
  }

  private getLoopBounds(buf: AudioBuffer, steadyAmbient: boolean): { start: number; end: number } | null {
    if (buf.duration < 1.5 || buf.numberOfChannels < 1) return null;
    const ch = buf.getChannelData(0);
    const sr = buf.sampleRate;
    const len = ch.length;
    const minTrim = Math.floor((steadyAmbient ? 0.05 : 0.025) * sr);
    const maxHeadScan = Math.min(len - 1, Math.floor(0.35 * sr));
    const maxTailScan = Math.max(0, len - Math.floor(0.45 * sr));
    const thresh = steadyAmbient ? 0.003 : 0.001;

    let s = minTrim;
    while (s < maxHeadScan && Math.abs(ch[s]) < thresh) s++;
    const headEnd = Math.min(len - 2, s + Math.floor(0.025 * sr));
    while (s < headEnd && !(ch[s] <= 0 && ch[s + 1] > 0)) s++;

    let e = len - 1 - minTrim;
    while (e > maxTailScan && Math.abs(ch[e]) < thresh) e--;
    const tailMin = Math.max(s + Math.floor(0.5 * sr), e - Math.floor(0.025 * sr));
    while (e > tailMin && !(ch[e - 1] <= 0 && ch[e] > 0)) e--;

    if (e - s < Math.floor(0.8 * sr)) return null;
    return { start: s / sr, end: e / sr };
  }

  setMusic(key: MusicKey, fadeSec = 1.4) {
    if (typeof window === "undefined") return;
    if (key === this.musicTarget) return;

    const ctx = this.ensureContext();
    if (!ctx || !this.musicBus) return;

    this.musicTarget = key;
    const req = ++this.musicReqId;

    if (key === "none") {
      this.fadeOutLoop(this.musicLoop, fadeSec);
      this.musicLoop = null;
      return;
    }

    const url = MUSIC_URLS[key];
    void this.loadBuffer(url).then((buf) => {
      if (!buf || req !== this.musicReqId || this.musicTarget !== key) return;
      const curCtx = this.ctx;
      const bus = this.musicBus;
      if (!curCtx || !bus) return;

      this.fadeOutLoop(this.musicLoop, fadeSec);

      const gain = curCtx.createGain();
      const now = curCtx.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(1, now + fadeSec);
      gain.connect(bus);

      const src = curCtx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const bounds = this.getLoopBounds(buf, false);
      if (bounds) {
        src.loopStart = bounds.start;
        src.loopEnd = bounds.end;
        src.connect(gain);
        src.start(0, bounds.start);
      } else {
        src.connect(gain);
        src.start(0);
      }

      this.musicLoop = { key, src, gain };
    });
  }

  setAmbient(key: AmbientKey, fadeSec = 1.6) {
    if (typeof window === "undefined") return;
    if (key === this.ambTarget) return;

    const ctx = this.ensureContext();
    if (!ctx || !this.ambBus) return;

    this.ambTarget = key;
    const req = ++this.ambReqId;

    if (key === "none") {
      this.fadeOutLoop(this.ambLoop, fadeSec);
      this.ambLoop = null;
      return;
    }

    const url = AMBIENT_URLS[key];
    void this.loadBuffer(url).then((buf) => {
      if (!buf || req !== this.ambReqId || this.ambTarget !== key) return;
      const curCtx = this.ctx;
      const bus = this.ambBus;
      if (!curCtx || !bus) return;

      this.fadeOutLoop(this.ambLoop, fadeSec);

      const gain = curCtx.createGain();
      const now = curCtx.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(1, now + fadeSec);
      gain.connect(bus);

      const src = curCtx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const bounds = this.getLoopBounds(buf, true);
      if (bounds) {
        src.loopStart = bounds.start;
        src.loopEnd = bounds.end;
        src.connect(gain);
        src.start(0, bounds.start);
      } else {
        src.connect(gain);
        src.start(0);
      }

      this.ambLoop = { key, src, gain };
    });
  }

  stopGameplayAudio(fadeSec = 0.45) {
    this.setMusic("none", fadeSec);
    this.setAmbient("none", fadeSec);
    this.setDucked(false);
  }

  playSfx(key: SfxKey, opts?: PlaySfxOpts) {
    if (typeof window === "undefined") return;
    if (this.settings.muted || this.settings.masterVol <= 0.005 || this.settings.sfxVol <= 0.005) {
      return;
    }

    const nowMs = performance.now();
    const minGap = SFX_COOLDOWN_MS[key] ?? 0;
    const prevMs = this.lastPlayedAt.get(key) ?? -1e9;
    if (nowMs - prevMs < minGap) return;
    this.lastPlayedAt.set(key, nowMs);

    // Distance attenuation when world coordinates are provided.
    let distGain = 1;
    let pan = 0;
    if (opts?.at) {
      const dx = opts.at.x - this.listenerX;
      const dy = opts.at.y - this.listenerY;
      const d = Math.hypot(dx, dy);
      if (d > 42) return;
      distGain = d <= 3 ? 1 : Math.max(0.08, 1 - (d - 3) / 39);
      const rx = -Math.sin(this.listenerYaw);
      const ry = Math.cos(this.listenerYaw);
      pan = Math.max(-0.9, Math.min(0.9, ((dx * rx + dy * ry) / Math.max(4, d))));
    }

    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;

    const list = SFX_URLS[key];
    let idx = 0;
    if (list.length > 1) {
      const last = this.lastVariant.get(key) ?? -1;
      idx = Math.floor(Math.random() * list.length);
      if (idx === last) idx = (idx + 1) % list.length;
      this.lastVariant.set(key, idx);
    }
    const url = list[idx];

    const startPlayback = (buf: AudioBuffer | null) => {
      if (!buf || !this.ctx || !this.sfxBus) return;
      if (this.ctx.state !== "running") return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const baseRate = opts?.rate ?? 1;
      const jitter = opts?.jitter ?? 0.06;
      src.playbackRate.value = Math.max(0.5, baseRate + (Math.random() - 0.5) * jitter * 2);

      const g = this.ctx.createGain();
      g.gain.value = (opts?.volume ?? 1) * distGain;

      if (Math.abs(pan) > 0.03 && typeof this.ctx.createStereoPanner === "function") {
        const panner = this.ctx.createStereoPanner();
        panner.pan.value = pan;
        src.connect(g);
        g.connect(panner);
        panner.connect(this.sfxBus);
      } else {
        src.connect(g);
        g.connect(this.sfxBus);
      }
      src.onended = () => {
        try {
          src.disconnect();
          g.disconnect();
        } catch {
          // Ignore cleanup errors.
        }
      };
      src.start(0);
    };

    const cached = this.buffers.get(url);
    if (cached) {
      startPlayback(cached);
    } else {
      void this.loadBuffer(url).then((buf) => {
        // Skip very stale triggers for short UI/footstep ticks if decode took long.
        if (performance.now() - nowMs < 240) startPlayback(buf);
      });
    }
  }
}

export const sound = new SoundEngine();
