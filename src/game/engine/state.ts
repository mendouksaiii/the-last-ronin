import type { Archetype, AttackSpec, BossDef, Env, Mission, Move, NationId, PoiKey, WeaponId, ZoneId } from "../types";

// Runtime entities of the world simulation. The world is a flat plane: x runs east, y runs south,
// both in metres. The renderer maps y onto the 3D z axis.

export interface Vec {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type BuildingKind = "brownstone" | "walkup" | "deco" | "glass" | "ruin" | "warehouse" | "container" | "cathedral";

export interface Building extends Rect {
  height: number;
  /** Broken, open-topped ruin. */
  ruined: boolean;
  seed: number;
  /** Explicit district architectural archetype; falls back to size/seed heuristics when omitted. */
  style?: BuildingKind;
  /** Optional colour accent (e.g., shipping container hull paint). */
  color?: number;
}

/** Things that only decorate the streets. Cars and barriers also block movement and sight. */
export interface Prop extends Vec {
  kind: "car" | "barrier" | "fire" | "lamp" | "sign" | "rubble" | "steam" | "crate" | "stoop" | "subway" | "hydrant";
  rot: number;
  seed: number;
  color?: number;
  text?: string;
}

export interface Ledge {
  x: number;
  y: number;
  /** Top elevation of the ledge or beam above ground (metres). */
  z: number;
  w: number;
  h: number;
  thickness: number;
  /** Outward wall normal facing into open air. */
  nx: number;
  ny: number;
  kind: "hold" | "beam";
}

export interface Zone {
  id: ZoneId;
  nation: NationId;
  w: number;
  h: number;
  pois: Record<PoiKey, Vec & { name: string }>;
  buildings: Building[];
  /** Fortress walls and the inner wall. */
  walls: Rect[];
  /** Small solids such as cars and barriers. */
  cover: Rect[];
  /** Climbable wall handholds and narrow projecting beams. */
  ledges: Ledge[];
  gate: Rect | null;
  fortress: Rect | null;
  /** The general's hall inside the fortress; bosses stay within it. */
  hall: Rect | null;
  props: Prop[];
  camps: Vec[];
  env: Env;
  enemies: Record<Archetype, { name: string; color: number }>;
  beast?: Archetype;
}

export type ActKind =
  | "idle"
  | "attack"
  | "dodge"
  | "block"
  | "hurt"
  | "broken"
  | "takedown"
  | "stim"
  | "getup"
  | "slide"
  | "vault"
  | "wallrun"
  | "hang"
  | "mantle"
  | "ledgehop"
  | "parkour_roll";

export interface PlayerAct {
  kind: ActKind;
  t: number;
  dur: number;
  move: Move | null;
  /** Which strike of the move has landed (flurries land several). */
  landed: number;
  dir: number;
  /** Counter attack: bonus damage multiplier on this move. */
  bonus: number;
  target: Enemy | null;
}

export interface HangLedge {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  minT: number;
  maxT: number;
  t: number;
  topZ: number;
  isRoof: boolean;
  onBeam?: boolean;
}

export interface Player extends Vec {
  /** Elevation above the street in metres and vertical velocity. */
  z: number;
  vz: number;
  grounded: boolean;
  airT: number;
  fallPeakVz: number;
  /** Impact landing crouch absorption timer. */
  landT: number;
  landDur: number;
  landHeavy: boolean;
  coyoteT: number;
  dropIgnoreT: number;
  ledge: HangLedge | null;
  wallSide: -1 | 0 | 1;
  wallNx: number;
  wallNy: number;
  facing: number;
  /** Current velocity, eased towards the desired one so movement has weight. */
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  staminaT: number;
  weapon: WeaponId;
  act: PlayerAct;
  combo: number;
  comboT: number;
  /** Buffered press, executed when the current action ends. */
  buffer: "light" | "heavy" | "special" | "dodge" | "jump" | null;
  bufferT: number;
  specialCd: number;
  stims: number;
  /** Time left in which a just-pressed guard parries. */
  parryT: number;
  blocking: boolean;
  /** Next attack within this window is a counter. */
  counterT: number;
  invuln: number;
  lastHurt: number;
  flash: number;
  crouch: boolean;
  speed: number;
  walk: number;
}

export type EnemyState =
  | "idle"
  | "patrol"
  | "search"
  | "chase"
  | "sprint"
  | "circle"
  | "windup"
  | "recover"
  | "stagger"
  | "dodge"
  | "home"
  | "dead";

export interface Enemy extends Vec {
  id: number;
  arch: Archetype;
  name: string;
  color: number;
  hp: number;
  maxHp: number;
  dmg: number;
  speed: number;
  radius: number;
  xp: number;
  state: EnemyState;
  t: number;
  /** Total length of the current windup, for telegraphs. */
  tw: number;
  aim: number;
  facing: number;
  home: Vec;
  patrol: Vec[];
  patrolI: number;
  camp: number;
  mission: boolean;
  step: boolean;
  elite: boolean;
  object: boolean;
  beast: boolean;
  decoy: boolean;
  boss: BossDef | null;
  bossStyle?: BossDef["look"];
  atk: AttackSpec;
  atkIdx: number;
  cd: number;
  chaseT: number;
  stun: number;
  flash: number;
  guardT: number;
  poise: number;
  maxPoise: number;
  /** 0..1: how sure this enemy is that someone is there. */
  suspicion: number;
  lastSeen: Vec | null;
  aware: boolean;
  /** Knock-back velocity. */
  kx: number;
  ky: number;
  walk: number;
  /** Seconds since death, for the fall and fade. */
  deadT: number;
  /** Took the attack token: allowed to attack the hero now. */
  token: boolean;
  circleDir: number;
  killedBy: "takedown" | "blow" | null;
  /** Boss evasion cooldown & state fields. */
  dodgeCd: number;
  dodgeDir: number;
  dodgeInvuln: number;
  dodgeSpeed: number;
  /** Remaining follow-up strikes in an active combo skill. */
  comboLeft: number;
  /** Whether Phase 2 (< 50% HP) escalation has activated. */
  phase2: boolean;
  /** Target coordinates locked for leaping slams or blink ambushes. */
  leapX?: number;
  leapY?: number;
  leapStartX?: number;
  leapStartY?: number;
  blinked?: boolean;
}

export interface Shot extends Vec {
  vx: number;
  vy: number;
  sx: number;
  sy: number;
  dmg: number;
  life: number;
  pull: boolean;
  blade?: boolean;
  r: number;
}

export interface Shockwave extends Vec {
  delay: number;
  r: number;
  maxR: number;
  dmg: number;
  perilous: boolean;
  color: number;
  owner: Enemy;
  hit: boolean;
}

export interface Npc extends Vec {
  name: string;
  role: "giver" | "biwa" | "villager" | "friend";
  look: "villager" | "biwa" | "cargo";
  hp: number;
  maxHp: number;
  facing: number;
  home: Vec;
  t: number;
  walk: number;
  pauseT?: number;
  goal?: Vec | null;
  vx?: number;
  vy?: number;
  steerDir?: number;
}

export interface Pickup extends Vec {
  label: string;
  taken: boolean;
}

/** One-shot effects the renderer turns into particles. */
export interface Burst extends Vec {
  k:
    | "blood"
    | "spark"
    | "parry"
    | "dust"
    | "slide"
    | "slash"
    | "shatter"
    | "ring"
    | "heal"
    | "guardBreak"
    | "ripple"
    | "shadow";
  n: number;
  /** Direction the spray flies, in radians. */
  dir: number;
  r?: number;
  /** Surface elevation above street level (metres). */
  z?: number;
  /** Optional slash arc roll tilt (radians) & hex tint. */
  tilt?: number;
  color?: number;
}

export interface Floater extends Vec {
  text: string;
  t: number;
  color: string;
  big: boolean;
}

export interface Bubble {
  speaker: string;
  text: string;
  t: number;
  ghost: boolean;
  on: Vec;
}

export interface Active {
  m: Mission;
  i: number;
  got: number;
  need: number;
  wave: number;
  waveT: number;
  started: boolean;
  friend: Npc | null;
  ambush: number;
}

export const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);

export const angleDiff = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

export const inRect = (p: Vec, r: Rect, pad = 0) => p.x > r.x - pad && p.x < r.x + r.w + pad && p.y > r.y - pad && p.y < r.y + r.h + pad;

/** Distance from point p to the segment a-b. */
export function segDist(p: Vec, a: Vec, b: Vec) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

/** Does the segment a-b cross the rectangle? (slab test) */
export function segHitsRect(a: Vec, b: Vec, r: Rect) {
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const clip = (p: number, q: number) => {
    if (p === 0) return q >= 0;
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
    return true;
  };
  return clip(-dx, a.x - r.x) && clip(dx, r.x + r.w - a.x) && clip(-dy, a.y - r.y) && clip(dy, r.y + r.h - a.y) && t0 <= t1;
}
