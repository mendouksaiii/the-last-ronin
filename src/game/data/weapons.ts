import type { Weapon, WeaponId } from "../types";

// The four brothers' weapons. Every blow commits the hero: a wind-up, the strike, then a recovery
// in which he is open. Stamina pays for attacks, dodges and blocked blows.
export const WEAPONS: Record<WeaponId, Weapon> = {
  katana: {
    id: "katana",
    name: "Katana",
    owner: "Ren",
    role: "Precision. Flowing Tsushima stances, spinning crescents, and lightning iaido cuts.",
    // Five-stance flowing chain: Water kesa-giri -> reverse rising sweep -> 360° Moon crescent ->
    // Wind piercing lunge -> Leaping Heaven-Splitter slam.
    light: [
      { name: "Water Cut", anim: "slashR", startup: 0.16, recovery: 0.3, dmg: 1, range: 2.5, arc: 0.9, lunge: 0.65, stamina: 9, stagger: 16, chain: 0.09, tier: "light", arcTilt: -0.52 },
      { name: "Reverse Sweep", anim: "slashL", startup: 0.14, recovery: 0.3, dmg: 1.05, range: 2.5, arc: 0.9, lunge: 0.55, stamina: 9, stagger: 18, chain: 0.09, tier: "light", arcTilt: 0.44 },
      { name: "Spinning Crescent", anim: "crescent", startup: 0.18, recovery: 0.34, dmg: 1.25, range: 2.85, arc: 1.45, lunge: 0.75, stamina: 11, stagger: 26, chain: 0.11, tier: "finisher", arcTilt: 0.14 },
      { name: "Wind Thrust", anim: "thrust", startup: 0.18, recovery: 0.34, dmg: 1.35, range: 3.1, arc: 0.45, lunge: 1.45, stamina: 11, stagger: 30, chain: 0.12, tier: "light", arcTilt: 0.05 },
      { name: "Heavenly Cleave", anim: "helmSplitter", startup: 0.27, recovery: 0.56, dmg: 2.1, range: 3.0, arc: 0.85, lunge: 1.15, stamina: 14, stagger: 52, kb: 1.6, tier: "finisher", arcTilt: Math.PI * 0.46 },
    ],
    heavy: { name: "Iaido Draw", anim: "draw", startup: 0.44, recovery: 0.54, dmg: 2.7, range: 3.3, arc: 0.68, lunge: 2.6, stamina: 24, stagger: 60, kb: 1.4, tier: "heavy", arcTilt: -0.2 },
    special: { name: "Heavenly Strike", anim: "flash", startup: 0.32, recovery: 0.62, dmg: 3.4, range: 6.8, arc: 0.75, lunge: 5.8, stamina: 28, stagger: 90, kb: 2.2, stun: 1.0, cd: 12, tier: "special", arcTilt: -0.34 },
  },
  bo: {
    id: "bo",
    name: "Bo Staff",
    owner: "Daigo",
    role: "Crowd control. Whirlwind sweeps, double-end snaps, and seismic slams.",
    light: [
      { name: "Sweeping Arc", anim: "slashR", startup: 0.22, recovery: 0.34, dmg: 0.8, range: 3.2, arc: 1.4, lunge: 0.4, stamina: 12, stagger: 26, kb: 1.4, chain: 0.11, tier: "light", arcTilt: 0.18 },
      { name: "Twin End Snap", anim: "crossCut", startup: 0.22, recovery: 0.36, dmg: 0.52, range: 3.1, arc: 1.2, lunge: 0.5, stamina: 13, stagger: 18, hits: 2, kb: 1.0, chain: 0.12, tier: "light", arcTilt: -0.4 },
      { name: "Moon Whirl", anim: "crescent", startup: 0.24, recovery: 0.38, dmg: 1.0, range: 3.4, arc: 1.85, lunge: 0.55, stamina: 14, stagger: 35, kb: 2.0, chain: 0.14, tier: "finisher", arcTilt: 0.08 },
      { name: "Driving Thrust", anim: "thrust", startup: 0.24, recovery: 0.46, dmg: 1.3, range: 3.6, arc: 0.45, lunge: 1.1, stamina: 15, stagger: 48, kb: 3.2, tier: "finisher", arcTilt: 0 },
    ],
    heavy: { name: "Tempest Wheel", anim: "cyclone", startup: 0.38, recovery: 0.54, dmg: 1.4, range: 3.6, arc: Math.PI, lunge: 0.6, stamina: 24, stagger: 68, kb: 3.6, tier: "heavy", arcTilt: 0.05 },
    special: { name: "Earthbreaker", anim: "helmSplitter", startup: 0.46, recovery: 0.68, dmg: 1.85, range: 4.8, arc: Math.PI, lunge: 1.1, stamina: 28, stagger: 95, kb: 3.0, stun: 2.2, cd: 14, tier: "special", arcTilt: Math.PI * 0.48 },
  },
  nunchaku: {
    id: "nunchaku",
    name: "Nunchaku",
    owner: "Kai",
    role: "Relentless speed. Twin snaps, tornado kicks, and storming combos.",
    light: [
      { name: "Snap", anim: "slashR", startup: 0.11, recovery: 0.18, dmg: 0.52, range: 2.1, arc: 0.85, lunge: 0.35, stamina: 7, stagger: 16, chain: 0.06, tier: "light", arcTilt: -0.35 },
      { name: "Cross Whip", anim: "crossCut", startup: 0.12, recovery: 0.2, dmg: 0.36, range: 2.15, arc: 0.9, lunge: 0.4, stamina: 8, stagger: 12, hits: 2, chain: 0.07, tier: "light", arcTilt: 0.42 },
      { name: "Rising Fang", anim: "rising", startup: 0.13, recovery: 0.2, dmg: 0.62, range: 2.2, arc: 0.85, lunge: 0.45, stamina: 7, stagger: 20, chain: 0.08, tier: "light", arcTilt: -0.95 },
      { name: "Crack", anim: "overhead", startup: 0.15, recovery: 0.22, dmg: 0.75, range: 2.2, arc: 0.75, lunge: 0.45, stamina: 8, stagger: 26, chain: 0.09, tier: "light", arcTilt: Math.PI * 0.45 },
      { name: "Tornado Whip", anim: "cyclone", startup: 0.18, recovery: 0.38, dmg: 1.15, range: 2.75, arc: Math.PI, lunge: 0.65, stamina: 11, stagger: 36, kb: 1.4, tier: "finisher", arcTilt: 0.1 },
    ],
    heavy: { name: "Flurry", anim: "flurry", startup: 0.22, recovery: 0.45, dmg: 0.48, range: 2.35, arc: 0.85, lunge: 0.6, stamina: 22, stagger: 15, hits: 6, tier: "heavy", arcTilt: -0.25 },
    special: { name: "Dragon Storm", anim: "cyclone", startup: 0.18, recovery: 0.56, dmg: 0.52, range: 3.1, arc: Math.PI, lunge: 0.8, stamina: 26, stagger: 18, hits: 8, cd: 12, tier: "special", arcTilt: 0.12 },
  },
  kusari: {
    id: "kusari",
    name: "Kusari-fundo",
    owner: "Shun",
    role: "Range and disruption. Whipping crescents, distant snares, and chain cyclones.",
    light: [
      { name: "Weight Throw", anim: "throw", startup: 0.22, recovery: 0.34, dmg: 0.8, range: 6.5, arc: 0.28, lunge: 0.2, stamina: 12, stagger: 24, chain: 0.1, tier: "light", arcTilt: -0.1 },
      { name: "Crescent Lash", anim: "crescent", startup: 0.2, recovery: 0.34, dmg: 0.9, range: 3.4, arc: 1.5, lunge: 0.6, stamina: 12, stagger: 28, chain: 0.12, tier: "light", arcTilt: 0.14 },
      { name: "Shatter Sling", anim: "throw", startup: 0.23, recovery: 0.38, dmg: 1.0, range: 6.8, arc: 0.32, lunge: 0.3, stamina: 13, stagger: 34, kb: 1.6, tier: "finisher", arcTilt: 0.2 },
    ],
    heavy: { name: "Bind and Drag", anim: "throw", startup: 0.36, recovery: 0.5, dmg: 0.8, range: 8.2, arc: 0.25, lunge: 0.2, stamina: 20, stagger: 62, pull: true, tier: "heavy", arcTilt: 0 },
    special: { name: "Chain Whirl", anim: "cyclone", startup: 0.3, recovery: 0.55, dmg: 1.05, range: 5.2, arc: Math.PI, lunge: 0.4, stamina: 24, stagger: 100, stun: 1.6, cd: 13, tier: "special", arcTilt: 0.08 },
  },
};

// Global tempo: every move winds up and recovers a little quicker than its listed timing.
for (const w of Object.values(WEAPONS)) {
  for (const m of [...w.light, w.heavy, w.special]) {
    m.startup *= 0.85;
    m.recovery *= 0.8;
  }
}

export const WEAPON_ORDER: WeaponId[] = ["katana", "bo", "nunchaku", "kusari"];

/** Hero name shown while playing with a given brother's weapon in a Memory mission. */
export const BROTHER: Record<WeaponId, string> = {
  katana: "Ren",
  bo: "Daigo",
  nunchaku: "Kai",
  kusari: "Shun",
};
