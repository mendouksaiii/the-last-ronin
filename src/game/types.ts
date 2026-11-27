// Shared types for The Last Ronin game data and engine.

export type NationId = "reeds" | "snow" | "tides" | "lanterns" | "ash";
export type ZoneId = NationId | "memory";
export type WeaponId = "katana" | "bo" | "nunchaku" | "kusari";
export type MissionClass =
  | "Story"
  | "Hunt"
  | "Gather"
  | "Aid"
  | "Sabotage"
  | "Memory"
  | "Stronghold"
  | "General";
export type PoiKey =
  | "village"
  | "fields"
  | "road"
  | "water"
  | "ruin"
  | "camp"
  | "outer"
  | "inner"
  | "throne";
export type Archetype = "melee" | "ranged" | "brute" | "fast";

// ---------- Comic ----------

export type SceneId = NationId | "castle" | "moon" | "shrine" | "grave";
export type ActorId =
  | "ren"
  | "daigo"
  | "shun"
  | "kai"
  | "lord"
  | "ox"
  | "bell"
  | "tide"
  | "mask"
  | "genryu"
  | "biwa"
  | "villager"
  | "soldier";

export interface Panel {
  scene: SceneId;
  actors?: ActorId[];
  /** Narration box. */
  caption?: string;
  /** "Speaker: line" shown in a speech bubble. */
  speech?: string;
  /** Optional painted illustration that replaces the drawn scene. */
  image?: string;
}

export type ComicPage = Panel[];

// ---------- Missions ----------

interface StepBase {
  /** Objective text shown in the quest tracker. */
  text: string;
  /** "Speaker: line" bubble shown over the hero when the step begins. */
  say?: string;
}

export type Step =
  | (StepBase & { kind: "reach"; at: PoiKey })
  | (StepBase & { kind: "kill"; at: PoiKey; enemy: Archetype; count: number; elite?: string })
  | (StepBase & { kind: "collect"; at: PoiKey; item: string; count: number; guards: number })
  | (StepBase & { kind: "destroy"; at: PoiKey; target: string; count: number; guards: number })
  | (StepBase & { kind: "escort"; from: PoiKey; to: PoiKey; npc: string; waves: number })
  | (StepBase & { kind: "defend"; at: PoiKey; npc: string; waves: number })
  | (StepBase & { kind: "survive"; at: PoiKey; waves: number })
  | (StepBase & { kind: "boss"; at: PoiKey });

export interface Mission {
  id: string;
  nation: NationId;
  n: number;
  title: string;
  cls: MissionClass;
  beat: string;
  intro: ComicPage;
  outro: ComicPage;
  steps: Step[];
  /** Memory missions: whose eyes the player sees through. */
  playAs?: WeaponId;
}

// ---------- Combat ----------

/** How a move is animated on the character. */
export type MoveAnim =
  | "slashR"
  | "slashL"
  | "rising"
  | "overhead"
  | "thrust"
  | "spin"
  | "sweep"
  | "flurry"
  | "throw"
  | "draw"
  | "crescent"
  | "helmSplitter"
  | "flash"
  | "crossCut"
  | "cyclone";

/** One attack of the hero. Distances are in metres, times in seconds. */
export interface Move {
  name: string;
  anim: MoveAnim;
  /** Time before the blow lands. */
  startup: number;
  /** Time after the blow before the hero can act again. */
  recovery: number;
  /** Damage as a multiple of the hero's base damage. */
  dmg: number;
  range: number;
  /** Half-angle of the strike, in radians. */
  arc: number;
  /** Distance the hero steps forward into the blow. */
  lunge: number;
  stamina: number;
  /** Poise damage: enough of it staggers an enemy. */
  stagger: number;
  kb?: number;
  /** Pulls the struck enemy towards the hero. */
  pull?: boolean;
  /** Number of blows in a flurry. */
  hits?: number;
  stun?: number;
  /** Time after the blow from which a queued attack cuts the recovery short and flows on. */
  chain?: number;
  /** Visual intensity tier driving slash wave & trail color/scale. */
  tier?: "light" | "finisher" | "heavy" | "special";
  /** Roll tilt (radians) for 3D crescent slash arcs (0 = horizontal, PI/2 = vertical). */
  arcTilt?: number;
}

export interface Weapon {
  id: WeaponId;
  name: string;
  owner: string;
  role: string;
  /** The light combo, one move per press. */
  light: Move[];
  heavy: Move;
  special: Move & { cd: number };
}

/** One enemy or boss attack, in metres. Bosses cycle a pattern. */
export interface AttackSpec {
  k: "cone" | "slam" | "charge" | "shots" | "summon" | "decoys" | "guard" | "leap" | "blink" | "combo";
  name?: string;
  windup: number;
  /** Damage multiplier of the attacker's base damage. */
  dmg: number;
  /** Distance at which the attacker starts this attack. */
  reach: number;
  range?: number;
  half?: number;
  r?: number;
  dist?: number;
  width?: number;
  count?: number;
  spread?: number;
  speed?: number;
  pull?: boolean;
  /** Fires wide glowing blade-wave projectiles rather than darts/beads. */
  blade?: boolean;
  /** Multi-ring shockwave count for slam/leap attacks. */
  waves?: number;
  /** Number of rapid strikes for combo attacks. */
  hits?: number;
  /** Forward step distance per combo strike. */
  step?: number;
  /** Blink leaves a shadow decoy behind where the boss vanished. */
  leaveDecoy?: boolean;
  /** Guard stance counters reckless frontal blows instead of only soaking them. */
  counter?: boolean;
  arch?: Archetype;
  dur?: number;
  /** Cannot be blocked or parried: it must be dodged. */
  perilous?: boolean;
}

export type BossLook = "ox" | "bell" | "tide" | "mask" | "genryu";

export type BossDodgeStyle = "none" | "backstep" | "sidestep" | "shadow" | "deflect";

export interface BossDef {
  hp: number;
  dmg: number;
  speed: number;
  radius: number;
  look: BossLook;
  pattern: AttackSpec[];
  /** Escalated Phase 2 attack cycle unlocked below 50% HP. */
  phase2Pattern?: AttackSpec[];
  /** Distance beyond which the boss breaks into a full sprint. */
  sprintDist?: number;
  /** Preferred spacing distance below which zoner/agile bosses backstep or kite. */
  kiteDist?: number;
  /** Chance (0..1) to reactively evade when the hero winds up close. */
  dodgeChance?: number;
  /** Minimum seconds between reactive dodges. */
  dodgeCd?: number;
  dodgeStyle?: BossDodgeStyle;
  /** Poise damage multiplier (e.g. < 1 for heavy armored bosses). */
  poiseMult?: number;
}

// ---------- World ----------

/** The look and weather of a district. Colours are 0xRRGGBB. */
export interface Env {
  fog: number;
  fogDensity: number;
  sky: number;
  ground: number;
  building: number;
  /** Neon sign colours for the district. */
  neon: number[];
  precip: "rain" | "sleet" | "ash";
  /** Number of burning barrels or braziers scattered through the streets. */
  fires: number;
  /** Flooded ground or open water around the water point. */
  water: boolean;
  /** Hemisphere sky and ground bounce colours. */
  hemiSky: number;
  hemiGround: number;
  /** Directional moonlight / overcast key colour and strength. */
  moonColor: number;
  moonIntensity: number;
  /** Street lamp / brazier illumination colour. */
  lampColor: number;
  /** Colour grade split-tone multipliers (RGB). */
  gradeShadow: [number, number, number];
  gradeHigh: [number, number, number];
  /** Post-processing bloom intensity. */
  bloom: number;
  /** Tint for canals, harbour basins or ice sheets. */
  waterColor: number;
}

export interface General {
  name: string;
  title: string;
  actor: ActorId;
  color: number;
  poem: [string, string, string];
  boss: BossDef;
}

export interface Nation {
  id: NationId;
  act: string;
  name: string;
  realm: string;
  blurb: string;
  giver: string;
  flip: boolean;
  env: Env;
  poi: Record<PoiKey, string>;
  enemies: Record<Archetype, { name: string; color: number }>;
  beast?: Archetype;
  general: General;
  reward?: WeaponId;
}

export interface SaveData {
  level: number;
  xp: number;
  done: string[];
  nation: NationId;
  visited: NationId[];
  prologue: boolean;
  weapon: WeaponId;
}

export type Stealth = "hidden" | "suspicious" | "detected";

export interface HudState {
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  stims: number;
  maxStims: number;
  level: number;
  xp: number;
  xpNeed: number;
  weapon: WeaponId;
  weapons: WeaponId[];
  /** Remaining cooldown fraction of the weapon art (0 = ready). */
  specialCd: number;
  crouched: boolean;
  stealth: Stealth | null;
  locked: boolean;
  cinematic: boolean;
  zone: string;
  nation: NationId;
  memory: boolean;
  hero: string;
  objective: { title: string; cls: MissionClass; text: string; got: number; need: number } | null;
  prompt: string | null;
  boss: { name: string; hp: number; maxHp: number } | null;
  friend: { name: string; hp: number; maxHp: number } | null;
}

export type GameEvent =
  | { type: "offer"; mission: Mission }
  | { type: "comic"; pages: ComicPage[]; then: () => void }
  | { type: "toast"; title: string; text?: string }
  | { type: "progress" }
  | { type: "ending" };
