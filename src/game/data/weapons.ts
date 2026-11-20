import type { Weapon, WeaponId } from "../types";

// The four brothers' weapons. Every blow commits the hero: a wind-up, the strike, then a recovery
// in which he is open. Stamina pays for attacks, dodges and blocked blows.
export const WEAPONS: Record<WeaponId, Weapon> = {
  katana: {
    id: "katana",
    name: "Katana",
    owner: "Ren",
    role: "Precision. A flowing five-cut chain; counters strike for triple damage.",
    // The Ashina chain: diagonal cut, backhand return, rising cut, stepping thrust, then a
    // two-handed falling cut. Press attack as each blow lands and the next flows straight on.
    light: [
      { name: "Diagonal Cut", anim: "slashR", startup: 0.16, recovery: 0.32, dmg: 1, range: 2.4, arc: 0.8, lunge: 0.55, stamina: 9, stagger: 16, chain: 0.1 },
      { name: "Return Cut", anim: "slashL", startup: 0.14, recovery: 0.32, dmg: 1, range: 2.4, arc: 0.8, lunge: 0.45, stamina: 9, stagger: 16, chain: 0.1 },
      { name: "Rising Cut", anim: "rising", startup: 0.15, recovery: 0.34, dmg: 1.1, range: 2.4, arc: 0.7, lunge: 0.4, stamina: 10, stagger: 20, chain: 0.11 },
      { name: "Stepping Thrust", anim: "thrust", startup: 0.2, recovery: 0.36, dmg: 1.3, range: 2.9, arc: 0.35, lunge: 1.3, stamina: 11, stagger: 26, chain: 0.13 },
      { name: "Falling Cut", anim: "overhead", startup: 0.28, recovery: 0.6, dmg: 2, range: 2.7, arc: 0.5, lunge: 0.8, stamina: 14, stagger: 45, kb: 1.2 },
    ],
    heavy: { name: "Iaido Draw", anim: "draw", startup: 0.5, recovery: 0.6, dmg: 2.6, range: 3, arc: 0.4, lunge: 2.2, stamina: 26, stagger: 55 },
    special: { name: "Stepping Moon", anim: "draw", startup: 0.35, recovery: 0.7, dmg: 3.2, range: 6.5, arc: 0.3, lunge: 5.5, stamina: 30, stagger: 80, cd: 12 },
  },
  bo: {
    id: "bo",
    name: "Bo Staff",
    owner: "Daigo",
    role: "Crowd control. Wide sweeps that knock enemies back.",
    light: [
      { name: "Sweep", anim: "slashR", startup: 0.26, recovery: 0.38, dmg: 0.75, range: 3.1, arc: 1.4, lunge: 0.3, stamina: 13, stagger: 25, kb: 1.4 },
      { name: "Return Sweep", anim: "slashL", startup: 0.24, recovery: 0.38, dmg: 0.75, range: 3.1, arc: 1.4, lunge: 0.3, stamina: 13, stagger: 25, kb: 1.4 },
      { name: "Driving Thrust", anim: "thrust", startup: 0.28, recovery: 0.5, dmg: 1.2, range: 3.4, arc: 0.35, lunge: 0.8, stamina: 15, stagger: 45, kb: 3 },
    ],
    heavy: { name: "Wheel", anim: "spin", startup: 0.45, recovery: 0.6, dmg: 1.3, range: 3.3, arc: Math.PI, lunge: 0, stamina: 26, stagger: 60, kb: 3.5 },
    special: { name: "Earthbreaker", anim: "overhead", startup: 0.55, recovery: 0.75, dmg: 1.6, range: 4.6, arc: Math.PI, lunge: 0.5, stamina: 30, stagger: 90, kb: 2.5, stun: 2.2, cd: 14 },
  },
  nunchaku: {
    id: "nunchaku",
    name: "Nunchaku",
    owner: "Kai",
    role: "Fast combos. Light blows that break an enemy's guard.",
    light: [
      { name: "Snap", anim: "slashR", startup: 0.11, recovery: 0.18, dmg: 0.5, range: 2, arc: 0.8, lunge: 0.3, stamina: 7, stagger: 16 },
      { name: "Snap", anim: "slashL", startup: 0.11, recovery: 0.18, dmg: 0.5, range: 2, arc: 0.8, lunge: 0.3, stamina: 7, stagger: 16 },
      { name: "Snap", anim: "slashR", startup: 0.11, recovery: 0.18, dmg: 0.55, range: 2, arc: 0.8, lunge: 0.3, stamina: 7, stagger: 18 },
      { name: "Crack", anim: "overhead", startup: 0.16, recovery: 0.22, dmg: 0.7, range: 2.1, arc: 0.7, lunge: 0.4, stamina: 8, stagger: 24 },
      { name: "Whip", anim: "spin", startup: 0.2, recovery: 0.42, dmg: 1, range: 2.4, arc: Math.PI, lunge: 0.2, stamina: 10, stagger: 30 },
    ],
    heavy: { name: "Flurry", anim: "flurry", startup: 0.25, recovery: 0.5, dmg: 0.45, range: 2.2, arc: 0.7, lunge: 0.4, stamina: 24, stagger: 14, hits: 6 },
    special: { name: "Dragon Storm", anim: "flurry", startup: 0.2, recovery: 0.6, dmg: 0.5, range: 2.8, arc: Math.PI, lunge: 0, stamina: 28, stagger: 16, hits: 10, cd: 12 },
  },
  kusari: {
    id: "kusari",
    name: "Kusari-fundo",
    owner: "Shun",
    role: "Range and disruption. Strike from afar and drag enemies in.",
    light: [
      { name: "Weight Throw", anim: "throw", startup: 0.24, recovery: 0.36, dmg: 0.75, range: 6.5, arc: 0.22, lunge: 0, stamina: 12, stagger: 22 },
      { name: "Weight Throw", anim: "throw", startup: 0.24, recovery: 0.42, dmg: 0.85, range: 6.5, arc: 0.22, lunge: 0, stamina: 12, stagger: 28 },
    ],
    heavy: { name: "Bind and Drag", anim: "throw", startup: 0.4, recovery: 0.55, dmg: 0.7, range: 8, arc: 0.2, lunge: 0, stamina: 22, stagger: 60, pull: true },
    special: { name: "Chain Whirl", anim: "spin", startup: 0.35, recovery: 0.6, dmg: 0.9, range: 5, arc: Math.PI, lunge: 0, stamina: 26, stagger: 100, stun: 1.6, cd: 13 },
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
