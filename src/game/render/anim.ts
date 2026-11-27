import type { Move, MoveAnim, WeaponId } from "../types";
import type { Enemy, Npc, Player } from "../engine/state";
import { mixPose, restPose, type Look, type Pose } from "./rig";

// Poses for every action: guard stances per weapon, wind-up and strike keys per attack, rolls,
// stagger, takedowns and deaths. The renderer eases the rig towards these each frame.

const FLURRY_GAP = 0.075;
const ease = (k: number) => k * k * (3 - 2 * k);
const easeOutCubic = (k: number) => 1 - Math.pow(1 - k, 3);
const easeInQuad = (k: number) => k * k;
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));

// ---------- Looks ----------

export function heroLook(w: WeaponId): Look {
  return {
    skin: 0x525e46,
    cloth: 0x1b1a1c,
    accent: 0x7c151c,
    scale: 1.04,
    bulk: 1.22,
    head: "turtle",
    gear: w,
    eyes: 0xf3eee4,
    eyeGlow: 0.95,
    shell: 0x7c7872,
    cloak: 0x101115,
    outfit: "ronin",
    seed: 7,
  };
}

const ARCH_LOOK: Record<string, Partial<Look>> = {
  melee: { gear: "machete", bulk: 1.05, scale: 1 },
  ranged: { gear: "crossbow", bulk: 0.95, scale: 0.98 },
  brute: { gear: "hammer", bulk: 1.45, scale: 1.28 },
  fast: { gear: "knives", offGear: "knives", bulk: 0.9, scale: 0.96 },
};

/** Fatigues are near-black with a trace of the district's colour. */
const fatigue = (hex: number) => {
  const c = { r: (hex >> 16) & 255, g: (hex >> 8) & 255, b: hex & 255 };
  const k = 0.22;
  const mix = (v: number) => Math.round(18 + (v - 18) * k);
  return (mix(c.r) << 16) | (mix(c.g) << 8) | mix(c.b);
};

export function enemyLook(e: Enemy, beast: boolean): Look {
  if (beast) return { skin: e.color, cloth: e.color, accent: e.color, scale: 1.25, bulk: 1, head: "hood", gear: "none", eyes: 0xff2030, eyeGlow: 3, beast: true };
  const a = ARCH_LOOK[e.arch];
  // The clan's uniform: horned red hood, black faceplate, black fatigues and red kit.
  return {
    skin: 0x6a5546,
    cloth: fatigue(e.color),
    accent: e.elite ? 0xc0121e : 0x8e0e18,
    scale: (a.scale ?? 1) * (e.elite ? 1.15 : 1),
    bulk: a.bulk ?? 1,
    head: "oni",
    gear: a.gear ?? "machete",
    offGear: a.offGear,
    eyes: e.elite ? 0xff8a3a : 0xff3a44,
    eyeGlow: 2.6,
    outfit: "tactical",
    cape: e.arch === "ranged" ? undefined : e.elite ? 0xb0101c : 0x7a0c14,
    seed: e.id + 1,
  };
}

export function bossLook(e: Enemy): Look {
  const look = e.bossStyle ?? e.boss?.look ?? "ox";
  const base: Look = {
    skin: 0x7a6250,
    cloth: fatigue(e.color),
    accent: 0xa00e18,
    scale: 1.2,
    bulk: 1.2,
    head: "oni",
    gear: "katana",
    eyes: 0xff3a1a,
    eyeGlow: 3,
    skirt: 0.6,
    outfit: look,
    cape: 0x9a0c16,
    seed: e.id + 1,
  };
  switch (look) {
    case "ox":
      return { ...base, scale: 1.68, bulk: 1.56, head: "helmet", gear: "club", cloth: 0x201818, accent: 0x8a141c, skirt: 0.45, eyes: 0xff4a18, cape: 0x4e0c10, outfit: "ox" };
    case "bell":
      return { ...base, scale: 1.28, bulk: 1.12, head: "monk", gear: "naginata", cloth: 0x262220, accent: 0xb86416, skirt: 0.88, eyes: 0xffaa30, cape: 0x6a1c14, outfit: "bell" };
    case "tide":
      return { ...base, scale: 1.12, bulk: 0.92, head: "kerchief", gear: "sickle", cloth: 0x162534, accent: 0xa41624, skirt: 0.78, eyes: 0x48e0ff, eyeGlow: 2.8, cape: 0x0e1824, outfit: "tide" };
    case "mask":
      return { ...base, scale: 1.12, bulk: 0.94, head: "mask", gear: "knives", offGear: "knives", cloth: 0x121016, accent: 0xb01228, skirt: 0.82, eyes: 0xff2878, eyeGlow: 3.4, cape: 0x700c1e, outfit: "mask" };
    case "genryu":
      return { ...base, scale: 1.12, bulk: 1.02, head: "hair", gear: "katana", skirt: 0.84, cloth: 0x242328, accent: 0x9a1820, eyes: 0xeae2d2, eyeGlow: 0.8, cape: 0x16161a, outfit: "genryu" };
  }
}

export function npcLook(n: Npc): Look {
  let h = 0;
  for (const ch of n.name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  if (n.role === "villager") h = (h * 31 + Math.abs(Math.round(n.home.x * 13 + n.home.y * 29))) >>> 0;
  // The blind street musician: crimson-plum coat, ochre sash, hair bun & woven kasa.
  if (n.look === "biwa") {
    return {
      ...survivorLook(10020),
      cloth: 0x42151e,
      shirt: 0x1e202b,
      accent: 0xa27438,
      gear: "biwa",
      kasa: true,
      skirt: 0.78,
      seed: 10020,
    };
  }
  return survivorLook(h);
}

/** New Yorkers who stayed: work jackets, parkas and wool coats over layered shirts and jeans. */
export function survivorLook(h: number): Look {
  const coats = [0x2a3040, 0x3e4232, 0x1c1c1e, 0x5a4a36, 0x4a2226, 0x48484c, 0x6a5a40, 0x26363a, 0x3a2e2a];
  const shirts = [0xb8b2a6, 0x3b444f, 0x625042, 0x2a2d32, 0x7c342e, 0x4b5645];
  const pants = [0x2a3448, 0x1e2430, 0x2a2a2c, 0x4a4234, 0x3a3a3e, 0x34302a];
  const accents = [0x7a2a24, 0x2e4a5a, 0x6a5a3a, 0x3a3a3e, 0x5a3a52, 0x8a6a2a, 0x2a2a2e];
  const skins = [0xe2b99c, 0xc9967a, 0xa5735a, 0x7c5440, 0x553a2c, 0xd8a688, 0x8e6248];
  const woman = Math.floor(h / 3) % 5 < 2;
  const coat = Math.floor(h / 29) % 3;
  return {
    skin: skins[Math.floor(h / 31) % skins.length],
    cloth: coats[h % coats.length],
    shirt: shirts[Math.floor(h / 13) % shirts.length],
    pants: pants[Math.floor(h / 37) % pants.length],
    accent: accents[(h >> 3) % accents.length],
    scale: (woman ? 0.92 : 0.97) + ((h >> 5) % 7) * 0.01,
    bulk: (woman ? 0.86 : 0.95) + ((h >> 8) % 3) * 0.05,
    head: "human",
    gear: "none",
    eyes: 0xd0c0a0,
    eyeGlow: 0,
    skirt: coat === 0 ? 0 : coat === 1 ? 0.42 : 0.62,
    outfit: "survivor",
    seed: h,
  };
}

// ---------- Hero ----------

type Key = Partial<Pose>;

const GUARD: Record<WeaponId, Key> = {
  katana: { armR: [-0.82, 0.22, -1.04], armL: [-0.94, -0.18, -1.08], wrist: 0.34, twist: -0.22, lean: 0.12, crouch: 0.12, gearA: 0 },
  bo: { armR: [-0.55, 0.3, -0.85], armL: [-0.65, -0.1, -1.2], wrist: 0, twist: -0.35, lean: 0.1, crouch: 0.1, gearA: 0 },
  nunchaku: { armR: [-0.45, 0.25, -1.5], armL: [-0.7, 0.05, -1.5], wrist: 0.5, twist: -0.14, lean: 0.14, crouch: 0.12, gearA: 2.6 },
  kusari: { armR: [-0.35, 0.3, -1.0], armL: [-0.6, -0.05, -1.45], wrist: 0, twist: -0.14, lean: 0.08, crouch: 0.08, gearA: 0.55 },
};

const BLOCK: Record<WeaponId, Key> = {
  katana: { armR: [-1.42, 0.28, -1.26], armL: [-1.38, -0.28, -1.24], wrist: 1.05, twist: -0.08, lean: 0.08, crouch: 0.26 },
  bo: { armR: [-1.3, 0.4, -1.1], armL: [-1.3, -0.3, -1.3], wrist: 0, twist: 0, crouch: 0.24 },
  nunchaku: { armR: [-1.2, 0.3, -1.7], armL: [-1.25, -0.2, -1.8], wrist: -0.6, crouch: 0.24 },
  kusari: { armR: [-1.2, 0.3, -1.6], armL: [-1.25, -0.2, -1.8], wrist: -0.6, crouch: 0.24, gearA: 0.4 },
};

/** Ghost of Tsushima–inspired martial stances: wind-up coil, explosive strike snap & Zanshin silhouette. */
const ANIM: Record<MoveAnim, { wind: Key; strike: Key; stanceR: [number, number, number]; stanceL: [number, number, number] }> = {
  slashR: {
    wind: { armR: [-2.68, 0.98, -0.42], armL: [-2.35, 0.48, -0.62], twist: -0.9, wrist: 0.38, lean: -0.08, crouch: 0.22, bank: 0.1 },
    strike: { armR: [-1.12, -0.82, -0.08], armL: [-1.02, -1.02, -0.18], twist: 0.94, wrist: 1.48, lean: 0.34, crouch: 0.36, bank: -0.16 },
    stanceR: [-0.72, 0.96, -0.12],
    stanceL: [0.38, 0.48, 0.12],
  },
  slashL: {
    wind: { armR: [-2.12, -0.62, -0.68], armL: [-2.32, -0.82, -0.45], twist: 0.88, wrist: 0.38, lean: 0.1, crouch: 0.3, bank: -0.12 },
    strike: { armR: [-1.52, 1.18, -0.08], armL: [-1.36, 0.56, -0.24], twist: -0.92, wrist: 1.44, lean: 0.24, crouch: 0.2, bank: 0.16 },
    stanceR: [0.34, 0.44, -0.12],
    stanceL: [-0.78, 0.98, 0.12],
  },
  rising: {
    wind: { armR: [-0.36, 0.85, -0.52], armL: [-0.54, 0.42, -0.78], twist: -0.85, crouch: 0.44, lean: 0.28, wrist: 1.45, bank: 0.12 },
    strike: { armR: [-2.78, -0.48, -0.1], armL: [-2.52, -0.78, -0.28], twist: 0.78, lean: -0.14, crouch: 0.04, wrist: 0.32, bank: -0.14 },
    stanceR: [0.28, 0.4, -0.12],
    stanceL: [-0.74, 0.92, 0.12],
  },
  overhead: {
    wind: { armR: [-3.08, 0.1, -0.48], armL: [-3.04, -0.1, -0.48], lean: -0.24, crouch: 0.08, wrist: 0.55 },
    strike: { armR: [-0.9, 0.05, -0.04], armL: [-0.94, -0.05, -0.08], lean: 0.48, crouch: 0.44, wrist: 1.52 },
    stanceR: [-0.82, 1.08, -0.1],
    stanceL: [0.46, 0.52, 0.1],
  },
  thrust: {
    wind: { armR: [-0.62, 0.38, -1.86], armL: [-0.86, -0.08, -1.78], twist: -0.68, crouch: 0.38, lean: 0.22, wrist: 0.9 },
    strike: { armR: [-1.58, 0.05, 0], armL: [-1.45, -0.05, -0.12], twist: 0.46, lean: 0.44, crouch: 0.4, wrist: 1.62 },
    stanceR: [-0.9, 1.15, -0.12],
    stanceL: [0.55, 0.45, 0.12],
  },
  spin: {
    wind: { armR: [-1.62, 1.25, -0.35], armL: [-1.42, -0.42, -0.82], twist: -0.72, crouch: 0.3 },
    strike: { armR: [-1.56, 1.38, -0.08], armL: [-1.48, -0.22, -0.4], twist: 0.32, crouch: 0.26, bank: -0.22 },
    stanceR: [-0.68, 0.92, -0.16],
    stanceL: [0.36, 0.62, 0.16],
  },
  sweep: {
    wind: { armR: [-1.18, 1.08, -0.48], armL: [-1.02, 0.34, -0.82], twist: -0.88, crouch: 0.44 },
    strike: { armR: [-0.95, -0.78, -0.1], armL: [-0.88, -0.94, -0.2], twist: 0.88, crouch: 0.52, bank: -0.18 },
    stanceR: [-0.85, 1.15, -0.18],
    stanceL: [0.38, 0.65, 0.18],
  },
  flurry: {
    wind: { armR: [-1.62, 0.55, -1.25], armL: [-1.25, -0.35, -1.45], twist: -0.38, crouch: 0.26 },
    strike: { armR: [-1.42, -0.48, -0.18], armL: [-1.25, -0.32, -1.35], twist: 0.56, lean: 0.26, crouch: 0.28 },
    stanceR: [-0.65, 0.88, -0.12],
    stanceL: [0.32, 0.48, 0.12],
  },
  throw: {
    wind: { armR: [-2.68, 0.45, -1.32], armL: [-1.05, -0.32, -1.2], twist: -0.68, lean: -0.14, crouch: 0.2 },
    strike: { armR: [-1.55, 0.0, 0], armL: [-0.6, -0.4, -1.0], twist: 0.52, lean: 0.28, wrist: 0, crouch: 0.28 },
    stanceR: [-0.72, 0.94, -0.1],
    stanceL: [0.4, 0.45, 0.1],
  },
  draw: {
    wind: { armR: [-0.42, -0.68, -1.58], armL: [-0.36, -0.32, -1.34], twist: -0.98, lean: 0.44, crouch: 0.66, head: 0.16, wrist: 0.88 },
    strike: { armR: [-1.48, 1.34, 0], armL: [-0.52, 0.72, -0.36], twist: 1.08, lean: 0.46, crouch: 0.34, bank: -0.22, wrist: 1.54 },
    stanceR: [-0.94, 1.24, -0.16],
    stanceL: [0.58, 0.54, 0.16],
  },
  crescent: {
    wind: { armR: [-1.48, 1.28, -0.52], armL: [-1.28, 0.38, -0.95], twist: -0.95, crouch: 0.42, lean: 0.24, bank: 0.14, wrist: 0.45 },
    strike: { armR: [-1.52, 1.36, -0.05], armL: [-1.44, -0.34, -0.44], twist: 0.58, crouch: 0.24, lean: 0.26, bank: -0.26, wrist: 1.56 },
    stanceR: [-0.76, 1.04, -0.18],
    stanceL: [0.42, 0.68, 0.18],
  },
  helmSplitter: {
    wind: { armR: [-3.12, 0.08, -0.36], armL: [-3.08, -0.08, -0.36], lean: -0.26, crouch: 0.06, wrist: 0.52, head: -0.12 },
    strike: { armR: [-0.84, 0.04, -0.04], armL: [-0.88, -0.04, -0.06], lean: 0.54, crouch: 0.6, wrist: 1.58, head: 0.14 },
    stanceR: [-1.02, 1.36, -0.14],
    stanceL: [0.64, 0.62, 0.14],
  },
  flash: {
    wind: { armR: [-0.34, -0.82, -1.68], armL: [-0.34, -0.44, -1.46], twist: -1.12, lean: 0.54, crouch: 0.76, head: 0.22, wrist: 0.92 },
    strike: { armR: [-1.5, 1.52, 0], armL: [-0.38, 0.96, -0.32], twist: 1.18, lean: 0.52, crouch: 0.3, bank: -0.28, wrist: 1.66 },
    stanceR: [-1.06, 1.34, -0.18],
    stanceL: [0.68, 0.52, 0.18],
  },
  crossCut: {
    wind: { armR: [-2.42, 0.88, -0.48], armL: [-2.22, 0.38, -0.68], twist: -0.82, wrist: 0.42, crouch: 0.24 },
    strike: { armR: [-1.32, 1.02, -0.08], armL: [-1.22, 0.48, -0.25], twist: -0.84, wrist: 1.44, lean: 0.28, crouch: 0.26, bank: 0.14 },
    stanceR: [-0.74, 0.96, -0.14],
    stanceL: [0.36, 0.56, 0.14],
  },
  cyclone: {
    wind: { armR: [-1.45, 1.15, -0.58], armL: [-1.45, -0.95, -0.58], twist: -0.78, crouch: 0.44, lean: 0.2, bank: 0.16 },
    strike: { armR: [-1.54, 1.42, -0.08], armL: [-1.54, 1.12, -0.16], twist: 0.42, crouch: 0.22, lean: 0.26, bank: -0.28, wrist: 1.5 },
    stanceR: [-0.88, 1.32, -0.18],
    stanceL: [0.46, 0.94, 0.18],
  },
};

export interface HeroPose {
  pose: Pose;
  /** Overrides the model's heading (rolls go the way of the dodge). */
  yaw: number | null;
  /** Whether the weapon trail should draw. */
  trail: boolean;
}

/** Natural gait layered on any pose: pelvis weight shift, counter-rotating shoulders, and fluid arm swing. */
export function gait(base: Pose, legs: number, phase: number, armSwing: [number, number]) {
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  base.legs = legs;
  base.phase = phase;
  // Subtle pelvic drop as legs pass wide, balanced with stance lift in applyPose.
  base.drop += -(s * s) * legs * 0.042;
  base.sway += c * legs * 0.025;
  base.twist += -s * legs * 0.16;
  base.armR = [base.armR[0] - s * legs * armSwing[0], base.armR[1], base.armR[2] - Math.max(0, -s) * legs * armSwing[0] * 0.55];
  base.armL = [base.armL[0] + s * legs * armSwing[1], base.armL[1], base.armL[2] - Math.max(0, s) * legs * armSwing[1] * 0.55];
  return base;
}

/** Arms held low and loose when walking out of a fight, the blade carried at the side. */
const CARRY: Key = { armR: [-0.25, 0.14, -0.55], armL: [-0.05, 0.12, -0.3], wrist: 0.9, twist: 0, lean: 0.04 };

/** Empty-handed, the sword sheathed on the back: arms hang loose. */
const CALM: Key = { armR: [-0.05, 0.13, -0.24], armL: [-0.05, 0.13, -0.24], wrist: 0.1, twist: 0, lean: 0.03, gearA: 0 };
/** The right hand reaching up behind the shoulder for the hilt. */
const REACH: Key = { armR: [-2.8, 0.3, -1.95], wrist: 0.7, twist: 0.3, head: 0.06 };

function locomotion(base: Pose, speed: number, phase: number, sprint: boolean, time: number, relaxed: boolean, carry = true) {
  const run = Math.min(1, speed / 4.5);
  if (relaxed && carry && run > 0.05) base = mixPose(base, CARRY, Math.min(1, run * 1.6) * 0.7);
  const legs = run * (sprint ? 1 : 0.74);
  base = gait(base, legs, phase, sprint ? [0, 0] : relaxed ? [0.3, 0.5] : [0.12, 0.25]);
  base.lean += run * 0.08;
  if (sprint) {
    // Full sprint: torso pitched forward, both arms pumping, the blade trailing low behind.
    const s = Math.sin(base.phase);
    base.lean += 0.26;
    base.armR = [s * 0.85 - 0.15, 0.18, -1.25 - Math.max(0, -s) * 0.4];
    base.armL = [-s * 0.85 - 0.15, 0.18, -1.25 - Math.max(0, s) * 0.4];
    base.wrist = 1.1;
  }
  // Breathing quickens with effort; standing still the weight drifts between the feet and the eyes wander.
  base.breath = Math.sin(time * (2 + run * 4)) * (0.6 + run * 0.6);
  if (run < 0.05) {
    base.sway += Math.sin(time * 0.55) * 0.018;
    base.look += Math.sin(time * 0.31) * 0.18 + Math.sin(time * 0.83) * 0.06;
  }
  return base;
}

function attackPose(guard: Pose, move: Move, t: number, dur: number): { pose: Pose; trail: boolean } {
  const key = ANIM[move.anim];
  const hits = move.hits ?? 1;
  const strikeSpan = move.anim === "crescent" ? 0.18 : move.anim === "cyclone" ? Math.max(0.24, (hits - 1) * FLURRY_GAP + 0.16) : (hits - 1) * FLURRY_GAP + 0.11;
  const strikeEnd = move.startup + strikeSpan;
  const zanshinHold = move.tier === "special" ? 0.13 : move.tier === "heavy" ? 0.11 : move.tier === "finisher" ? 0.08 : 0.025;
  const recStart = Math.min(dur - 0.04, strikeEnd + zanshinHold);

  let pose: Pose;
  let trail = false;
  if (t < move.startup) {
    const wk = clamp01(t / Math.max(0.01, move.startup));
    pose = mixPose(guard, key.wind, ease(wk));
  } else if (t < strikeEnd) {
    const wind = mixPose(guard, key.wind, 1);
    if (hits > 1) {
      if (move.anim === "cyclone") {
        const sk = clamp01((t - move.startup) / strikeSpan);
        pose = mixPose(wind, key.strike, easeOutCubic(Math.min(1, sk * 2.2)));
      } else {
        // Alternate crisp diagonal slashes for crossCut / flurry.
        const seg = (t - move.startup) / FLURRY_GAP;
        const i = Math.floor(seg);
        const k = seg - i;
        const a = i % 2 ? ANIM.slashL : ANIM.slashR;
        pose = mixPose(mixPose(guard, a.wind, 0.55), a.strike, easeOutCubic(k));
      }
    } else {
      const sk = clamp01((t - move.startup) / strikeSpan);
      pose = mixPose(wind, key.strike, easeOutCubic(sk));
    }
    trail = true;
  } else if (t < recStart) {
    // Brief Zanshin freeze at the razor edge of the slash before sheathing/guard return.
    pose = mixPose(guard, key.strike, 1);
    trail = t - strikeEnd < 0.075;
  } else {
    const strike = mixPose(guard, key.strike, 1);
    const rk = clamp01((t - recStart) / Math.max(0.05, dur - recStart));
    pose = mixPose(strike, guard, ease(rk));
    trail = t - strikeEnd < 0.08;
  }

  // Spinning crescents & cyclones complete exact full turns (2pi / 4pi) so the exit into guard is seamless.
  if (move.anim === "spin" && t >= move.startup) {
    pose.spin = clamp01((t - move.startup) / 0.3) * Math.PI * 2;
  } else if (move.anim === "crescent" && t >= move.startup) {
    const spK = clamp01((t - move.startup) / 0.24);
    pose.spin = -easeOutCubic(spK) * Math.PI * 2;
  } else if (move.anim === "cyclone" && t >= move.startup) {
    const spinDur = Math.max(0.28, strikeSpan + 0.06);
    const spK = clamp01((t - move.startup) / spinDur);
    pose.spin = -ease(spK) * Math.PI * 4;
    const hover = Math.sin(spK * Math.PI);
    pose.drop += hover * 0.24;
  }

  // Airborne leap arc for Ghost of Tsushima Heavenly Cleave / Earthbreaker slams.
  if (move.anim === "helmSplitter") {
    const leapEnd = move.startup + 0.085;
    if (t < leapEnd) {
      const lk = clamp01(t / Math.max(0.01, leapEnd));
      const crouchPre = lk < 0.26 ? Math.sin((lk / 0.26) * Math.PI) * 0.14 : 0;
      const airK = lk > 0.22 ? Math.sin(clamp01((lk - 0.22) / 0.78) * Math.PI * 0.78) : 0;
      pose.drop += airK * 0.54 - crouchPre;
      if (lk > 0.28) {
        pose.legOv = 0.92;
        pose.legR = [-1.18, 1.72, -0.14];
        pose.legL = [-0.45, 1.32, 0.14];
      }
    } else if (t < strikeEnd + 0.04) {
      const slamK = clamp01((t - leapEnd) / Math.max(0.02, strikeEnd + 0.04 - leapEnd));
      pose.drop += (1 - easeInQuad(slamK)) * 0.32 - easeInQuad(slamK) * 0.06;
    }
  }

  // Dynamic samurai footwork & warrior leg stances.
  const lead = move.anim === "slashL" || move.anim === "rising" ? 1 : -1;
  const into = clamp01((t - move.startup + 0.07) / 0.14);
  const outFade = 1 - clamp01((t - recStart) / Math.max(0.08, dur - recStart));
  pose.phase = (lead * Math.PI) / 2;
  pose.legs = 0.25 + into * 0.25 * outFade + (move.lunge > 1.2 ? 0.14 : 0);
  pose.crouch += 0.1;

  if (move.anim !== "helmSplitter" || t >= move.startup + 0.085) {
    const stanceBlend = (t < move.startup ? ease(clamp01(t / Math.max(0.01, move.startup))) * 0.65 : 0.86) * outFade;
    pose.legOv = Math.max(pose.legOv, stanceBlend);
    pose.legR = [
      key.stanceR[0] * stanceBlend + pose.legR[0] * (1 - stanceBlend),
      key.stanceR[1] * stanceBlend + pose.legR[1] * (1 - stanceBlend),
      key.stanceR[2],
    ];
    pose.legL = [
      key.stanceL[0] * stanceBlend + pose.legL[0] * (1 - stanceBlend),
      key.stanceL[1] * stanceBlend + pose.legL[1] * (1 - stanceBlend),
      key.stanceL[2],
    ];
  }
  return { pose, trail };
}

/**
 * `drawn`: the blade is in hand (else sheathed on the back). `reach`: 0..1, the arm going up
 * behind the shoulder to draw or sheathe it.
 */
export function heroPose(p: Player, time: number, sprint: boolean, combat: boolean, phase: number, drawn = true, reach = 0): HeroPose {
  const relaxedOff = combat || p.blocking || p.crouch;
  const w = p.weapon;
  const a = p.act;
  const breathe = Math.sin(time * 2.2) * 0.02;
  let guard = mixPose(restPose(), GUARD[w], 1);
  guard.lean += breathe;
  let yaw: number | null = null;
  let trail = false;

  if (p.hp <= 0) {
    return { pose: heroDeathPose(guard, a.kind === "broken" ? a.t : 0.85), yaw, trail };
  }

  if (a.kind === "idle") {
    const sheathed = !drawn && !p.blocking;
    let pose = p.blocking ? mixPose(guard, BLOCK[w], 1) : sheathed ? mixPose(restPose(), CALM, 1) : guard;
    if (sheathed) pose.lean += breathe;

    if (!p.grounded) {
      // Mid-air parkour silhouettes (`00:04` driven apex & `00:16` long horizontal gap reach).
      const hSpd = Math.hypot(p.vx, p.vy);
      if (hSpd > 7.0 && p.vz > -3.5) {
        // Horizontal rooftop long-jump stretch: forward reach, trailing arm extended back, open stride.
        pose = mixPose(pose, {
          lean: 0.42,
          twist: 0.24,
          armR: [-2.18, 0.34, -0.45],
          armL: [0.46, 0.54, -0.92],
          legOv: 1,
          legR: [-0.94, 0.62, -0.05],
          legL: [0.76, 0.98, 0.08],
          head: -0.22,
        }, 1);
      } else if (p.vz > 1.0) {
        // Rising jump apex (`00:04`): driven front knee, trailing tucked shin, wide raised elbows.
        pose = mixPose(pose, {
          lean: 0.24,
          armR: [-1.72, 0.48, -1.52],
          armL: [-1.42, 0.52, -1.42],
          legOv: 1,
          legR: [-1.18, 1.48, -0.06],
          legL: [0.56, 1.32, 0.06],
          head: -0.1,
        }, 1);
      } else {
        // Descent landing preparation: feet reaching down, knees coiled, arms poised for shock absorption.
        pose = mixPose(pose, {
          lean: 0.24,
          armR: [-1.06, 0.68, -1.02],
          armL: [-1.12, 0.68, -1.02],
          legOv: 1,
          legR: [-0.88, 1.24, -0.12],
          legL: [-0.54, 0.96, 0.12],
          head: 0.12,
        }, 1);
      }
      return { pose, yaw, trail };
    }

    if (p.crouch) pose = mixPose(pose, { crouch: 0.55, lean: 0.4 }, 1);
    pose = locomotion(pose, p.speed, phase, sprint && p.speed > 4.5, time, sheathed || !relaxedOff, !sheathed);

    // Impact landing compression & palm brace (`00:05` / `00:10`).
    if (p.landT > 0 && p.landDur > 0) {
      const pulse = Math.sin(clamp01(p.landT / p.landDur) * Math.PI);
      const amp = p.landHeavy ? 1.0 : 0.72;
      pose = mixPose(pose, {
        crouch: Math.max(pose.crouch, 0.68 * amp),
        lean: Math.max(pose.lean, 0.44 * amp),
        drop: pose.drop - 0.12 * amp,
        armR: [-1.08, 0.36, -0.58],
        armL: [-1.08, 0.36, -0.58],
        head: 0.16 * amp,
      }, pulse);
    }

    if (reach > 0) pose = mixPose(pose, REACH, reach);
    return { pose, yaw, trail };
  }

  if (a.kind === "attack" && a.move) {
    const r = attackPose(guard, a.move, a.t, a.dur);
    trail = r.trail;
    guard = r.pose;
    if (w === "kusari" && a.move.anim === "throw" && a.t >= a.move.startup) {
      const k = a.t - a.move.startup;
      guard.gearA = k < 0.1 ? 0.5 + (a.move.range - 0.5) * (k / 0.1) : k < 0.2 ? a.move.range : Math.max(0.55, a.move.range * (1 - (k - 0.2) / 0.25));
    } else if (w === "kusari" && (a.move.anim === "spin" || a.move.anim === "crescent" || a.move.anim === "cyclone")) {
      guard.gearA = a.t >= a.move.startup ? a.move.range * 0.85 : 0.6;
    }
    if (w === "nunchaku") guard.gearA = trail ? 0.1 : 2.4;
    return { pose: guard, yaw, trail };
  }

  const k = clamp01(a.t / Math.max(0.01, a.dur));
  switch (a.kind) {
    case "getup": {
      // Video 00:00 -> 00:02: prone face-down ground wake -> palm brace push-up -> rising athletic stance.
      const base = mixPose(restPose(), CALM, 1);
      const prone: Partial<Pose> = {
        roll: 1.38,
        drop: -0.74,
        crouch: 0.08,
        lean: 0.1,
        head: -0.72,
        armR: [-1.35, 0.35, -0.82],
        armL: [-1.35, 0.35, -0.82],
        legOv: 1,
        legR: [-0.08, 0.24, -0.08],
        legL: [-0.14, 0.54, 0.08],
      };
      const pushup: Partial<Pose> = {
        roll: 0.42,
        drop: -0.44,
        crouch: 0.72,
        lean: 0.45,
        twist: 0.24,
        head: -0.25,
        armR: [-1.12, 0.32, -0.48],
        armL: [-0.55, 0.25, -1.05],
        legOv: 1,
        legR: [-1.15, 1.85, -0.1],
        legL: [-0.82, 1.28, 0.1],
      };
      if (k < 0.34) {
        return { pose: mixPose(base, prone, 1 - ease(k / 0.34) * 0.18), yaw, trail };
      }
      if (k < 0.68) {
        return { pose: mixPose(mixPose(base, prone, 1), pushup, ease((k - 0.34) / 0.34)), yaw, trail };
      }
      return { pose: mixPose(mixPose(base, pushup, 1), base, ease((k - 0.68) / 0.32)), yaw, trail };
    }

    case "slide": {
      // Video 00:02 -> 00:03: diagonal low baseball/parkour power-slide (extended lead leg, tucked back knee, hand brace).
      yaw = a.dir;
      const enter = ease(clamp01(k / 0.18));
      const exit = k > 0.78 ? ease((k - 0.78) / 0.22) : 0;
      const wSlide = enter * (1 - exit * 0.75);
      const slidePose = mixPose(restPose(), {
        roll: -0.88,
        lean: -0.22,
        bank: -0.26,
        twist: 0.38,
        drop: -0.58,
        crouch: 0.16,
        head: 0.52,
        armR: [-1.25, 0.52, -0.95],
        armL: [0.38, 0.46, -0.24],
        legOv: 1,
        legR: [-0.32, 0.18, -0.08],
        legL: [-0.95, 2.04, 0.34],
      }, wSlide);
      return { pose: slidePose, yaw, trail };
    }

    case "vault": {
      // Video 00:07: single-hand speed vault arching legs laterally over obstacle.
      yaw = a.dir;
      const arc = Math.sin(k * Math.PI);
      const vaultPose = mixPose(restPose(), {
        lean: 0.36 * arc + 0.12,
        bank: 0.52 * arc,
        twist: -0.25 * arc,
        crouch: 0.35 * arc,
        armR: [-0.72, 0.42, -0.14],
        armL: [-1.85, 0.54, -0.95],
        legOv: 1,
        legR: [-1.18, 1.66, -0.34],
        legL: [-0.96, 1.44, -0.18],
      }, Math.max(0.35, arc));
      return { pose: vaultPose, yaw, trail };
    }

    case "wallrun": {
      // Video 00:07 -> 00:08: angled sprint pitched cleanly into wall plane.
      const base = mixPose(restPose(), CALM, 1);
      const s = Math.sin(phase * 1.35);
      const wr = gait(base, 1.0, phase * 1.35, [0.42, 0.42]);
      wr.lean = 0.32;
      wr.bank = p.wallSide * 0.46;
      wr.twist = -p.wallSide * 0.22;
      if (p.wallSide > 0) {
        wr.armR = [-1.45 + s * 0.25, 0.36, -0.85];
        wr.armL = [-0.6 - s * 0.65, 0.28, -1.25];
      } else {
        wr.armL = [-1.45 - s * 0.25, 0.36, -0.85];
        wr.armR = [-0.6 + s * 0.65, 0.28, -1.25];
      }
      return { pose: wr, yaw, trail };
    }

    case "hang": {
      // Video 00:09 & 00:12: two-hand overhead wall hang + horizontal shimmy Alternating hand reaches.
      const shimmy = p.speed > 0.25 ? Math.min(1, p.speed / 2.2) : 0;
      const reachWave = Math.sin(phase * 1.15) * 0.32 * shimmy;
      const legWave = Math.cos(phase * 1.15) * 0.14 * shimmy;
      const hangPose = mixPose(restPose(), {
        lean: 0.14,
        drop: -0.05 + Math.abs(Math.sin(phase * 1.15)) * 0.04 * shimmy,
        head: -0.36,
        sway: Math.cos(phase * 1.15) * 0.075 * shimmy,
        bank: Math.sin(phase * 1.15) * 0.08 * shimmy,
        armR: [-2.85 - Math.max(0, reachWave) * 0.45, 0.18 + Math.abs(reachWave) * 0.15, -0.24 - Math.max(0, -reachWave) * 0.35],
        armL: [-2.85 - Math.max(0, -reachWave) * 0.45, 0.18 + Math.abs(reachWave) * 0.15, -0.24 - Math.max(0, reachWave) * 0.35],
        legOv: 1,
        legR: [-0.9 + legWave, 1.54, -0.08],
        legL: [-0.36 - legWave, 0.84, 0.08],
      }, 1);
      return { pose: hangPose, yaw, trail };
    }

    case "mantle": {
      // Video 00:09 -> 00:10: chest pull-up over rim into low three-point rim squat landing.
      const base = mixPose(restPose(), CALM, 1);
      const startH: Partial<Pose> = {
        lean: 0.18,
        head: -0.32,
        armR: [-2.85, 0.2, -0.25],
        armL: [-2.85, 0.2, -0.25],
        legOv: 1,
        legR: [-0.9, 1.52, -0.08],
        legL: [-0.42, 0.92, 0.08],
      };
      const press: Partial<Pose> = {
        lean: 0.56,
        crouch: 0.42,
        head: 0.14,
        armR: [-0.88, 0.32, -0.62],
        armL: [-0.88, 0.32, -0.62],
        legOv: 1,
        legR: [-1.25, 1.85, -0.14],
        legL: [-0.86, 1.45, 0.14],
      };
      const rimSquat: Partial<Pose> = {
        lean: 0.46,
        crouch: 0.72,
        head: 0.12,
        armR: [-1.05, 0.34, -0.58],
        armL: [-1.05, 0.34, -0.58],
        legOv: 0.45,
        legR: [-1.15, 1.85, -0.1],
        legL: [-1.05, 1.75, 0.1],
      };
      if (k < 0.48) {
        return { pose: mixPose(mixPose(base, startH, 1), press, ease(k / 0.48)), yaw, trail };
      }
      return { pose: mixPose(mixPose(base, press, 1), rimSquat, ease((k - 0.48) / 0.52)), yaw, trail };
    }

    case "ledgehop": {
      // Video 00:13 -> 00:14: explosive upward/diagonal reach onto next wall hold.
      const hopPose = mixPose(restPose(), {
        lean: 0.22,
        head: -0.42,
        armR: [-3.04, 0.22, -0.15],
        armL: [-2.74, 0.28, -0.45],
        legOv: 1,
        legR: [-1.14, 1.56, -0.08],
        legL: [0.36, 0.86, 0.08],
      }, Math.sin(k * Math.PI * 0.85));
      return { pose: hopPose, yaw, trail };
    }

    case "parkour_roll": {
      // High-fall shoulder breakfall roll maintaining sprint momentum (`00:05`).
      yaw = a.dir;
      const roll = ease(clamp01(k / 0.88)) * Math.PI * 2;
      const rollPose = mixPose(restPose(), {
        roll,
        bank: Math.sin(k * Math.PI) * 0.36,
        crouch: 0.72 * Math.sin(k * Math.PI),
        drop: -0.34 * Math.sin(k * Math.PI),
        armR: [-1.65, 0.22, -2.0],
        armL: [-1.65, 0.22, -2.0],
        legOv: 1,
        legR: [-1.35, 2.0, -0.1],
        legL: [-1.35, 2.0, 0.1],
      }, 1);
      return { pose: rollPose, yaw, trail };
    }

    case "dodge": {
      const rel = Math.atan2(Math.sin(a.dir - p.facing), Math.cos(a.dir - p.facing));
      if (Math.abs(rel) > 2.2) {
        // Back-step: a low hop away, eyes on the enemy.
        return { pose: mixPose(guard, { lean: -0.35, crouch: 0.5 * Math.sin(k * Math.PI), drop: 0.15 * Math.sin(k * Math.PI) }, 1), yaw, trail };
      }
      yaw = a.dir;
      const roll = ease(clamp01(k / 0.85)) * Math.PI * 2;
      return { pose: mixPose(guard, { roll, crouch: 0.6 * Math.sin(k * Math.PI), drop: -0.3 * Math.sin(k * Math.PI), armR: [-1.6, 0.2, -2], armL: [-1.6, 0.2, -2] }, 1), yaw, trail };
    }
    case "hurt":
      return { pose: mixPose(guard, { lean: -0.45 * Math.sin(k * Math.PI), twist: 0.3, head: -0.3, armR: [-0.3, 0.5, -0.5], crouch: 0.15 }, 1), yaw, trail };
    case "broken":
      return { pose: mixPose(guard, { crouch: 0.75, lean: 0.55, head: 0.3, armR: [-0.2, 0.2, -0.3], armL: [-0.2, 0.2, -0.3] }, 1), yaw, trail };
    case "stim":
      return { pose: mixPose(guard, { armL: [-2.2, -0.5, -2.3], head: -0.35, lean: -0.05 }, Math.sin(k * Math.PI) * 1.2), yaw, trail };
    case "takedown": {
      const struck = a.t > 0.42;
      const base = mixPose(guard, { armL: [-1.4, -0.1, -0.4], lean: 0.25, crouch: 0.3 }, 1);
      const pose = struck
        ? mixPose(mixPose(base, ANIM.thrust.wind, 1), { ...ANIM.thrust.strike, armL: [-1.4, -0.1, -0.4] }, easeOutCubic(clamp01((a.t - 0.42) / 0.12)))
        : mixPose(base, ANIM.thrust.wind, ease(clamp01(a.t / 0.42)));
      return { pose, yaw, trail: struck && a.t < 0.62 };
    }
    default:
      return { pose: guard, yaw, trail };
  }
}

/**
 * Ren's collapse when slain: reels from the fatal blow, drops heavy onto his knees,
 * pitches face-down onto the street (keeping shell & scabbard clear above the asphalt),
 * bounces once on impact and settles limp with arms sprawled.
 */
export function heroDeathPose(base: Pose, t: number): Pose {
  const recoil = Math.sin(clamp01(t / 0.2) * Math.PI);
  // 1. Sharp stagger from the lethal blow.
  let pose = mixPose(
    base,
    {
      lean: -0.4,
      head: -0.45,
      twist: 0.32,
      armR: [-1.1, 0.75, -0.45],
      armL: [-1.0, -0.65, -0.45],
      wrist: 0.1,
    },
    ease(clamp01(t / 0.12)),
  );
  pose.drop += recoil * 0.02;
  // 2. Drops heavy onto his knees.
  const buckle = ease(clamp01((t - 0.15) / 0.32));
  pose = mixPose(
    pose,
    {
      crouch: 0.92,
      drop: -0.22,
      legs: 0,
      lean: 0.35,
      head: 0.5,
      twist: -0.14,
      armR: [-0.35, 0.35, -0.45],
      armL: [-0.35, -0.35, -0.45],
    },
    buckle,
  );
  // 3. Topples forward onto the wet asphalt with gravity and one heavy bounce.
  const ft = clamp01((t - 0.42) / 0.38);
  const fallK = ft * ft;
  const bounce = t > 0.8 ? Math.sin(clamp01((t - 0.8) / 0.25) * Math.PI) * Math.exp(-(t - 0.8) * 5) * 0.09 : 0;
  const limp = clamp01((t - 0.8) / 0.45);
  pose = mixPose(
    pose,
    {
      crouch: 0.92 - fallK * 0.74,
      drop: -0.22 - fallK * 0.46 + bounce * 0.38,
      lean: 0.08,
      head: -0.22 - limp * 0.12,
      twist: -0.1,
      sway: 0,
    },
    fallK,
  );
  pose.roll = (fallK - bounce) * Math.PI * 0.48;
  pose.bank = fallK * 0.14;
  // 4. Arms sprawl outward as he hits the pavement.
  pose = mixPose(
    pose,
    {
      armR: [-2.45, 0.75, -0.3],
      armL: [-2.2, -0.65, -0.45],
    },
    ease(clamp01((t - 0.52) / 0.45)),
  );
  pose.look = 0.55 * limp;
  pose.breath = 0;
  return pose;
}

export type Fall = "back" | "forward" | "side";

/**
 * A body going down: it recoils from the blow, the knees buckle, it topples with gravity
 * (slow at first, fast at the end), bounces once on the street and settles limp.
 * `t` is seconds since death.
 */
export function deathPose(base: Pose, t: number, fall: Fall, side = 1): Pose {
  const fwd = fall === "forward";
  // 1. Recoil from the killing blow.
  const recoil = Math.sin(clamp01(t / 0.22) * Math.PI);
  let pose = mixPose(base, {
    lean: fwd ? 0.45 : -0.4,
    head: fwd ? 0.5 : -0.55,
    twist: 0.35 * side,
    armR: fwd ? [-0.6, 0.2, -1.4] : [-1.3, 1.0, -0.4],
    armL: fwd ? [-0.7, 0.2, -1.5] : [-1.1, 0.9, -0.5],
    wrist: 0,
  }, ease(clamp01(t / 0.12)));
  pose.drop += recoil * 0.02;
  // 2. The knees give.
  const buckle = ease(clamp01((t - 0.14) / 0.32));
  pose = mixPose(pose, { crouch: 0.75, drop: -0.12, legs: 0, head: fwd ? 0.6 : 0.3, armR: [-0.35, 0.35, -0.5], armL: [-0.3, 0.4, -0.4] }, buckle);
  // 3. Topple: accelerating like a real fall, then one bounce on impact.
  const ft = clamp01((t - 0.36) / 0.42);
  const fallK = ft * ft;
  const bounce = t > 0.78 ? Math.sin(clamp01((t - 0.78) / 0.28) * Math.PI) * Math.exp(-(t - 0.78) * 4) * 0.12 : 0;
  const tip = (fallK - bounce) * Math.PI * 0.5;
  const limp = clamp01((t - 0.78) / 0.5);
  pose = mixPose(pose, {
    crouch: 0.75 - fallK * 0.55,
    drop: -0.12 - fallK * (fall === "side" ? 0.56 : 0.66) + bounce * 0.4,
    lean: 0,
    head: fwd ? 0.1 : -0.25 - limp * 0.2,
    twist: 0.15 * side,
    sway: 0,
  }, fallK);
  if (fall === "side") pose.bank = side * tip;
  else pose.roll = (fwd ? 1 : -1) * tip;
  // 4. Arms flop out as the body lands.
  pose = mixPose(pose, fwd ? { armR: [-2.7, 0.7, -0.4], armL: [-2.5, 0.5, -0.6] } : fall === "side" ? { armR: [-0.9, 1.1, -0.6], armL: [-1.6, 0.2, -0.9] } : { armR: [-2.5, 0.9, -0.3], armL: [-2.2, 1.2, -0.7] }, ease(clamp01((t - 0.55) / 0.5)));
  pose.look = side * 0.5 * limp;
  pose.breath = 0;
  return pose;
}

// ---------- Enemies ----------

const E_GUARD: Key = { armR: [-0.6, 0.2, -0.9], armL: [-0.3, 0.15, -0.6], lean: 0.1 };
const E_AIM: Key = { armR: [-1.5, 0.05, -0.05], armL: [-1.45, -0.25, -0.5], twist: -0.25 };
const E_IDLE: Key = { armR: [-0.15, 0.12, -0.3], armL: [-0.1, 0.12, -0.3] };

export function enemyPose(e: Enemy, time: number, phase: number): { pose: Pose; laser: boolean; telegraph: number; trail: boolean } {
  let pose = restPose();
  const ranged = e.arch === "ranged" && !e.boss;
  const isAlert = e.aware;
  pose = mixPose(pose, isAlert ? (ranged ? E_AIM : E_GUARD) : E_IDLE, 1);
  if (isAlert && e.bossStyle === "genryu") pose = mixPose(pose, GUARD.katana, 0.65);
  else if (isAlert && e.bossStyle === "mask") pose = mixPose(pose, { crouch: 0.2, lean: 0.24, armR: [-0.4, 0.25, -1.2], armL: [-0.4, -0.25, -1.2] }, 0.75);
  else if (isAlert && e.bossStyle === "tide") pose = mixPose(pose, { crouch: 0.14, twist: -0.22, gearA: 0.65 }, 0.7);
  pose.lean += Math.sin(time * 2 + e.id) * 0.02;
  let laser = false;
  let telegraph = 0;
  let trail = false;

  if (e.state === "dead") {
    const fall: Fall = e.killedBy === "takedown" ? "forward" : (["back", "back", "side", "forward"] as const)[e.id % 4];
    return { pose: deathPose(pose, e.deadT, fall, e.id % 2 ? 1 : -1), laser, telegraph, trail };
  }

  const moving = ["patrol", "search", "chase", "sprint", "circle", "home"].includes(e.state);
  if (moving) {
    const isSprint = e.state === "sprint";
    const speed = isSprint ? e.speed * 1.55 : e.state === "chase" ? e.speed : e.speed * 0.4;
    const legs = isSprint ? 1.0 : Math.min(1, speed / 4.5) * (e.state === "chase" ? 0.92 : 0.6);
    pose = gait(pose, legs, phase, isSprint ? [0.35, 0.48] : isAlert ? [0.15, 0.35] : [0.4, 0.45]);
    if (isSprint) pose.lean += 0.36;
    else if (e.state === "chase") pose.lean += 0.22;
  }
  pose.breath = Math.sin(time * (isAlert ? 4 : 2) + e.id);
  if (!moving && !isAlert) pose.look = Math.sin(time * 0.4 + e.id * 1.7) * 0.35;
  if (e.state === "search") pose.head = Math.sin(time * 1.5 + e.id) * 0.2;

  if (e.state === "dodge") {
    const k = 1 - Math.max(0, e.t) / Math.max(0.01, e.tw);
    const rel = Math.atan2(Math.sin(e.dodgeDir - e.facing), Math.cos(e.dodgeDir - e.facing));
    const arc = Math.sin(k * Math.PI);
    if (Math.abs(rel) > 2.2) {
      pose = mixPose(pose, { lean: -0.34, crouch: 0.42 * arc, drop: 0.16 * arc }, 1);
    } else {
      const s = rel >= 0 ? 1 : -1;
      pose = mixPose(pose, { bank: s * 0.35 * arc, twist: -s * 0.42, crouch: 0.4 * arc, drop: 0.14 * arc }, 1);
    }
    return { pose, laser, telegraph, trail };
  }

  const spec = e.atk;
  const comboRight = (e.id + e.comboLeft) % 2 === 0;
  if (e.state === "windup") {
    const k = clamp01(1 - e.t / e.tw);
    telegraph = k;
    if (ranged || spec.k === "shots") {
      pose = mixPose(pose, { ...E_AIM, lean: -0.05 }, 1);
      laser = !spec.blade;
    } else if (spec.k === "slam") {
      pose = mixPose(pose, ANIM.overhead.wind, ease(k));
    } else if (spec.k === "leap") {
      if (k < 0.28) {
        pose = mixPose(pose, { crouch: 0.55, lean: 0.35, ...ANIM.overhead.wind }, ease(k / 0.28));
      } else {
        const fly = clamp01((k - 0.28) / 0.72);
        pose = mixPose(pose, {
          ...ANIM.overhead.wind,
          drop: Math.sin(fly * Math.PI) * 2.25,
          lean: -0.1 + fly * 0.45,
          legOv: 1,
          legR: [-0.95, 1.55, -0.08],
          legL: [-0.75, 1.35, 0.08],
        }, 1);
      }
    } else if (spec.k === "charge" || spec.k === "blink") {
      pose = mixPose(pose, { ...ANIM.thrust.wind, crouch: 0.45, lean: 0.38 }, ease(k));
    } else if (spec.k === "summon" || spec.k === "decoys") {
      pose = mixPose(pose, { armR: [-2.9, 0.3, -0.2], armL: [-2.9, 0.3, -0.2], head: -0.3 }, ease(k));
    } else if (spec.k === "guard") {
      pose = mixPose(pose, ANIM.draw.wind, ease(k));
    } else if (spec.k === "combo") {
      pose = mixPose(pose, comboRight ? ANIM.slashR.wind : ANIM.slashL.wind, ease(k));
    } else {
      pose = mixPose(pose, ANIM.slashR.wind, ease(k));
    }
    // A last shiver right before the blow.
    if (k > 0.8 && spec.k !== "leap") pose.twist += Math.sin(time * 60) * 0.03;
  } else if (e.state === "recover") {
    const k = clamp01(e.t / (e.boss ? 0.75 : 0.55));
    const key =
      spec.k === "slam" || spec.k === "leap"
        ? ANIM.overhead.strike
        : spec.k === "charge"
          ? ANIM.thrust.strike
          : spec.k === "shots"
            ? E_AIM
            : spec.k === "combo" && !comboRight
              ? ANIM.slashL.strike
              : ANIM.slashR.strike;
    pose = mixPose(pose, key, k);
    trail = k > 0.75 && spec.k !== "shots";
  } else if (e.state === "stagger") {
    pose = mixPose(pose, { crouch: 0.5, lean: 0.6, head: 0.4, armR: [-0.2, 0.4, -0.2], armL: [-0.2, 0.4, -0.2], twist: Math.sin(time * 9) * 0.15 }, 1);
  }
  if (e.guardT > 0) pose = mixPose(pose, ANIM.draw.wind, 1);
  if (e.stun > 0 && e.state !== "stagger") pose = mixPose(pose, { lean: -0.2, head: -0.3, armR: [-0.1, 0.4, -0.2], armL: [-0.1, 0.4, -0.2] }, 0.8);
  return { pose, laser, telegraph, trail };
}

export function npcPose(n: Npc, time: number, phase: number, speed: number, heroRel?: { angle: number; dist: number }): Pose {
  const pose = mixPose(restPose(), E_IDLE, 1);
  const seed = n.home.x * 0.7 + n.home.y * 0.3;

  if (n.look === "biwa") {
    return mixPose(
      pose,
      {
        crouch: 0.68,
        lean: 0.06,
        armR: [-0.95 + Math.sin(time * 4.5) * 0.08, -0.35, -1.25 + Math.sin(time * 6.2) * 0.14],
        armL: [-1.15, -0.22, -1.55 + Math.sin(time * 1.8) * 0.06],
        head: 0.12 + Math.sin(time * 1.4) * 0.05,
        look: Math.sin(time * 0.7) * 0.1,
        breath: Math.sin(time * 1.8),
      },
      1,
    );
  }

  // Upright natural human carriage instead of slumped posture.
  const walkAmt = Math.min(1, speed / 3.8);
  pose.lean = 0.015 + walkAmt * 0.05;
  pose.head = -0.02;
  pose.breath = Math.sin(time * 1.9 + seed);

  if (speed < 0.15) {
    // Organic weight-shift, relaxed posture, and attentive glance/gesture toward Ren when nearby.
    pose.sway = Math.sin(time * 0.65 + seed) * 0.022;
    pose.twist = Math.sin(time * 0.42 + seed) * 0.04;
    pose.armR = [-0.08, 0.13, -0.36];
    pose.armL = [-0.1, 0.13, -0.44];
    pose.look = Math.sin(time * 0.35 + seed) * 0.28;
    if (heroRel && heroRel.dist < 6.5) {
      const clampLook = Math.max(-0.9, Math.min(0.9, -heroRel.angle));
      pose.look = clampLook;
      if (n.role === "giver") {
        // Subtle conversational nod and welcoming hand gesture.
        const talk = Math.max(0, Math.sin(time * 2.1 + seed));
        pose.armR = [-0.36 - talk * 0.18, 0.2, -0.82 - talk * 0.15];
        pose.head = -0.03 + Math.sin(time * 2.4 + seed) * 0.045;
      }
    }
    return pose;
  }

  return gait(pose, walkAmt * 0.72, phase, [0.38, 0.42]);
}
