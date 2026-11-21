import type { Move, MoveAnim, WeaponId } from "../types";
import type { Enemy, Npc, Player } from "../engine/state";
import { mixPose, restPose, type Look, type Pose } from "./rig";

// Poses for every action: guard stances per weapon, wind-up and strike keys per attack, rolls,
// stagger, takedowns and deaths. The renderer eases the rig towards these each frame.

const FLURRY_GAP = 0.075;
const ease = (k: number) => k * k * (3 - 2 * k);
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
  const look = e.boss?.look ?? "ox";
  const base: Look = { skin: 0x7a6250, cloth: fatigue(e.color), accent: 0xa00e18, scale: 1.2, bulk: 1.2, head: "oni", gear: "katana", eyes: 0xff3a1a, eyeGlow: 3, skirt: 0.6, outfit: "tactical", cape: 0x9a0c16, seed: e.id + 1 };
  switch (look) {
    case "ox":
      return { ...base, scale: 1.65, bulk: 1.55, head: "helmet", gear: "club", skirt: 0.5 };
    case "bell":
      return { ...base, scale: 1.25, bulk: 1.1, head: "monk", gear: "naginata", skirt: 0.85, eyes: 0xffa040 };
    case "tide":
      return { ...base, scale: 1.12, bulk: 0.95, head: "kerchief", gear: "sickle", skirt: 0.7, accent: 0x8a1a1a };
    case "mask":
      return { ...base, scale: 1.12, bulk: 0.95, head: "mask", gear: "knives", offGear: "knives", skirt: 0.8 };
    case "genryu":
      return { ...base, scale: 1.1, bulk: 1, head: "hair", gear: "katana", skirt: 0.75, cloth: 0x2a2826, accent: 0x9a9286, eyes: 0xd8d0c0, eyeGlow: 0.8, outfit: undefined, cape: 0x1a1a1c };
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
  katana: { armR: [-0.75, 0.15, -0.95], armL: [-0.85, -0.12, -1.0], wrist: 0.25, twist: -0.15, lean: 0.08, gearA: 0 },
  bo: { armR: [-0.55, 0.3, -0.85], armL: [-0.65, -0.1, -1.2], wrist: 0, twist: -0.35, lean: 0.08, gearA: 0 },
  nunchaku: { armR: [-0.45, 0.25, -1.5], armL: [-0.7, 0.05, -1.5], wrist: 0.5, twist: -0.1, lean: 0.12, gearA: 2.6 },
  kusari: { armR: [-0.35, 0.3, -1.0], armL: [-0.6, -0.05, -1.45], wrist: 0, twist: -0.1, lean: 0.06, gearA: 0.55 },
};

const BLOCK: Record<WeaponId, Key> = {
  katana: { armR: [-1.35, 0.25, -1.25], armL: [-1.35, -0.25, -1.25], wrist: 1.0, twist: 0, lean: 0.05, crouch: 0.2 },
  bo: { armR: [-1.3, 0.4, -1.1], armL: [-1.3, -0.3, -1.3], wrist: 0, twist: 0, crouch: 0.2 },
  nunchaku: { armR: [-1.2, 0.3, -1.7], armL: [-1.25, -0.2, -1.8], wrist: -0.6, crouch: 0.2 },
  kusari: { armR: [-1.2, 0.3, -1.6], armL: [-1.25, -0.2, -1.8], wrist: -0.6, crouch: 0.2, gearA: 0.4 },
};

/** Wind-up and strike keys for every move animation. */
const ANIM: Record<MoveAnim, { wind: Key; strike: Key }> = {
  slashR: { wind: { armR: [-2.5, 0.9, -0.5], armL: [-2.3, 0.4, -0.6], twist: -0.75, wrist: 0.4 }, strike: { armR: [-1.25, -0.6, -0.1], armL: [-1.1, -0.9, -0.2], twist: 0.8, wrist: 1.3, lean: 0.25 } },
  slashL: { wind: { armR: [-2.3, -0.4, -0.7], armL: [-2.4, -0.7, -0.5], twist: 0.75, wrist: 0.4 }, strike: { armR: [-1.2, 1.0, -0.1], armL: [-1.15, 0.6, -0.2], twist: -0.8, wrist: 1.3, lean: 0.25 } },
  rising: { wind: { armR: [-0.45, 0.75, -0.55], armL: [-0.6, 0.35, -0.8], twist: -0.75, crouch: 0.35, lean: 0.2, wrist: 1.4 }, strike: { armR: [-2.65, -0.45, -0.15], armL: [-2.45, -0.75, -0.3], twist: 0.7, lean: -0.08, crouch: 0.05, wrist: 0.35 } },
  overhead: { wind: { armR: [-3.0, 0.1, -0.6], armL: [-3.0, -0.1, -0.6], lean: -0.2, wrist: 0.6 }, strike: { armR: [-1.0, 0.05, -0.05], armL: [-1.0, -0.05, -0.05], lean: 0.45, crouch: 0.35, wrist: 1.4 } },
  thrust: { wind: { armR: [-0.7, 0.3, -1.7], armL: [-0.9, -0.1, -1.6], twist: -0.5, crouch: 0.2 }, strike: { armR: [-1.55, 0.05, 0], armL: [-1.45, -0.05, -0.1], twist: 0.35, lean: 0.3, crouch: 0.25, wrist: 1.5 } },
  spin: { wind: { armR: [-1.6, 1.2, -0.3], armL: [-1.4, -0.4, -0.8], twist: -0.6 }, strike: { armR: [-1.6, 1.4, -0.1], armL: [-1.5, -0.2, -0.4], twist: 0.2, crouch: 0.25 } },
  sweep: { wind: { armR: [-1.2, 1.0, -0.5], armL: [-1.0, 0.3, -0.8], twist: -0.8, crouch: 0.35 }, strike: { armR: [-1.0, -0.7, -0.1], armL: [-0.9, -0.9, -0.2], twist: 0.8, crouch: 0.45 } },
  flurry: { wind: { armR: [-1.6, 0.5, -1.2], armL: [-1.2, -0.3, -1.4], twist: -0.3 }, strike: { armR: [-1.4, -0.4, -0.2], armL: [-1.2, -0.3, -1.4], twist: 0.5, lean: 0.2 } },
  throw: { wind: { armR: [-2.6, 0.4, -1.3], armL: [-1.0, -0.3, -1.2], twist: -0.6, lean: -0.1 }, strike: { armR: [-1.55, 0.0, 0], armL: [-0.6, -0.4, -1.0], twist: 0.45, lean: 0.25, wrist: 0 } },
  draw: { wind: { armR: [-0.4, -0.5, -1.5], armL: [-0.3, -0.2, -1.2], twist: -0.9, lean: 0.35, crouch: 0.55, wrist: 0.9 }, strike: { armR: [-1.5, 1.1, 0], armL: [-0.6, 0.5, -0.4], twist: 0.95, lean: 0.4, crouch: 0.3, wrist: 1.4 } },
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
  const strikeEnd = move.startup + (hits - 1) * FLURRY_GAP + 0.1;
  let pose: Pose;
  let trail = false;
  if (t < move.startup) {
    pose = mixPose(guard, key.wind, ease(clamp01(t / move.startup)));
  } else if (t < strikeEnd) {
    const wind = mixPose(guard, key.wind, 1);
    if (hits > 1) {
      // Alternate cuts for a flurry.
      const i = Math.floor((t - move.startup) / FLURRY_GAP);
      const k = ((t - move.startup) % FLURRY_GAP) / FLURRY_GAP;
      const a = i % 2 ? ANIM.slashL : ANIM.slashR;
      pose = mixPose(mixPose(guard, a.wind, 0.6), a.strike, ease(k));
    } else pose = mixPose(wind, key.strike, ease(clamp01((t - move.startup) / 0.1)));
    trail = true;
  } else {
    const strike = mixPose(guard, key.strike, 1);
    pose = mixPose(strike, guard, ease(clamp01((t - strikeEnd) / Math.max(0.05, dur - strikeEnd))));
    trail = t - strikeEnd < 0.08;
  }
  if (move.anim === "spin" && t >= move.startup) pose.spin = clamp01((t - move.startup) / 0.32) * Math.PI * 2;
  // Footwork: settle into a fighting stance on the wind-up, drive off the back foot on the blow,
  // and switch the lead foot between cuts so the chain walks forward like real swordplay.
  const lead = move.anim === "slashL" || move.anim === "rising" ? 1 : -1;
  const into = clamp01((t - move.startup + 0.06) / 0.14);
  pose.phase = (lead * Math.PI) / 2;
  pose.legs = 0.28 + into * 0.22 * (1 - clamp01((t - strikeEnd) / 0.4)) + (move.lunge > 1 ? 0.12 : 0);
  pose.crouch += 0.12;
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
    if (p.crouch) pose = mixPose(pose, { crouch: 0.55, lean: 0.4 }, 1);
    pose = locomotion(pose, p.speed, phase, sprint && p.speed > 4.5, time, sheathed || !relaxedOff, !sheathed);
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
    } else if (w === "kusari" && a.move.anim === "spin") guard.gearA = a.t >= a.move.startup ? a.move.range * 0.85 : 0.6;
    if (w === "nunchaku") guard.gearA = trail ? 0.1 : 2.4;
    return { pose: guard, yaw, trail };
  }

  const k = clamp01(a.t / Math.max(0.01, a.dur));
  switch (a.kind) {
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
        ? mixPose(mixPose(base, ANIM.thrust.wind, 1), { ...ANIM.thrust.strike, armL: [-1.4, -0.1, -0.4] }, ease(clamp01((a.t - 0.42) / 0.12)))
        : mixPose(base, ANIM.thrust.wind, ease(clamp01(a.t / 0.42)));
      return { pose, yaw, trail: struck && a.t < 0.6 };
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
  const alert = e.aware;
  pose = mixPose(pose, alert ? (ranged ? E_AIM : E_GUARD) : E_IDLE, 1);
  pose.lean += Math.sin(time * 2 + e.id) * 0.02;
  let laser = false;
  let telegraph = 0;
  let trail = false;

  if (e.state === "dead") {
    const fall: Fall = e.killedBy === "takedown" ? "forward" : (["back", "back", "side", "forward"] as const)[e.id % 4];
    return { pose: deathPose(pose, e.deadT, fall, e.id % 2 ? 1 : -1), laser, telegraph, trail };
  }

  const moving = ["patrol", "search", "chase", "circle", "home"].includes(e.state);
  if (moving) {
    const speed = e.state === "chase" ? e.speed : e.speed * 0.4;
    const legs = Math.min(1, speed / 4.5) * (e.state === "chase" ? 0.92 : 0.6);
    pose = gait(pose, legs, phase, alert ? [0.15, 0.35] : [0.4, 0.45]);
    if (e.state === "chase") pose.lean += 0.22;
  }
  pose.breath = Math.sin(time * (alert ? 4 : 2) + e.id);
  if (!moving && !alert) pose.look = Math.sin(time * 0.4 + e.id * 1.7) * 0.35;
  if (e.state === "search") pose.head = Math.sin(time * 1.5 + e.id) * 0.2;

  const spec = e.atk;
  if (e.state === "windup") {
    const k = clamp01(1 - e.t / e.tw);
    telegraph = k;
    if (ranged || spec.k === "shots") {
      pose = mixPose(pose, { ...E_AIM, lean: -0.05 }, 1);
      laser = true;
    } else if (spec.k === "slam") pose = mixPose(pose, ANIM.overhead.wind, ease(k));
    else if (spec.k === "charge") pose = mixPose(pose, { ...ANIM.thrust.wind, crouch: 0.45, lean: 0.35 }, ease(k));
    else if (spec.k === "summon" || spec.k === "decoys") pose = mixPose(pose, { armR: [-2.9, 0.3, -0.2], armL: [-2.9, 0.3, -0.2], head: -0.3 }, ease(k));
    else if (spec.k === "guard") pose = mixPose(pose, ANIM.draw.wind, ease(k));
    else pose = mixPose(pose, ANIM.slashR.wind, ease(k));
    // A last shiver right before the blow.
    if (k > 0.8) pose.twist += Math.sin(time * 60) * 0.03;
  } else if (e.state === "recover") {
    const k = clamp01(e.t / (e.boss ? 0.75 : 0.55));
    const key = spec.k === "slam" ? ANIM.overhead.strike : spec.k === "charge" ? ANIM.thrust.strike : spec.k === "shots" ? E_AIM : ANIM.slashR.strike;
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
