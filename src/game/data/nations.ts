import type { Archetype, Env, Nation, NationId, PoiKey } from "../types";

// The five districts of a drowned, burning New York, their generals and their weather.
// All distances are in metres.

export const NATION_ORDER: NationId[] = ["reeds", "snow", "tides", "lanterns", "ash"];

export const NATIONS: Record<NationId, Nation> = {
  reeds: {
    id: "reeds",
    act: "Act I",
    name: "The Drowned Borough",
    realm: "Queens",
    blurb: "Flooded streets, marsh reeds through the asphalt, and empty ration depots.",
    giver: "Sae the Fixer",
    flip: false,
    env: { fog: 0x56606b, fogDensity: 0.0135, sky: 0x1e2734, ground: 0x4a4e52, building: 0x8a8580, neon: [0xc8102e, 0xff5a1f, 0x9b111e], precip: "rain", fires: 10, water: true },
    poi: {
      village: "The Culvert Hideout",
      fields: "The Flooded Lots",
      road: "Toll Boulevard",
      water: "The Ferry Slip",
      ruin: "Old Ration Depot",
      camp: "The Ledger House",
      outer: "Depot Wall",
      inner: "The Great Depot",
      throne: "The Ox's Table",
    },
    enemies: {
      melee: { name: "Toll Enforcer", color: 0x3a3330 },
      ranged: { name: "Crossbowman", color: 0x2e3330 },
      brute: { name: "Yoke Brute", color: 0x4a2a24 },
      fast: { name: "Reed Blade", color: 0x45403a },
    },
    general: {
      name: "Kuroda Gonzaemon",
      title: "The Ox",
      actor: "ox",
      color: 0x5a2418,
      poem: ["I ate the whole harvest", "and still the bowl was empty.", "Reeds bow to the wind."],
      boss: {
        hp: 900,
        dmg: 40,
        speed: 2.6,
        radius: 0.9,
        look: "ox",
        pattern: [
          { k: "slam", name: "Iron Club", windup: 1.1, dmg: 1.1, reach: 2.6, r: 3.2, perilous: true },
          { k: "cone", name: "Table Sweep", windup: 0.75, dmg: 0.9, reach: 2.8, range: 3.4, half: 1.1 },
          { k: "charge", name: "Ox Charge", windup: 1.0, dmg: 1.2, reach: 9, dist: 10, width: 1.8, perilous: true },
          { k: "cone", name: "Table Sweep", windup: 0.75, dmg: 0.9, reach: 2.8, range: 3.4, half: 1.1 },
          { k: "summon", name: "Call the Guard", windup: 0.8, dmg: 0, reach: 30, arch: "melee", count: 2 },
        ],
      },
    },
    reward: "bo",
  },
  snow: {
    id: "snow",
    act: "Act II",
    name: "The Cathedral Heights",
    realm: "Upper Manhattan",
    blurb: "A frozen cathedral cult on the heights, under endless sleet.",
    giver: "Brother Enzan",
    flip: true,
    env: { fog: 0x66707a, fogDensity: 0.015, sky: 0x26303c, ground: 0x52565a, building: 0x908e8a, neon: [0xb3001b, 0xff6b2c], precip: "sleet", fires: 7, water: false },
    poi: {
      village: "The Bodega Shelter",
      fields: "Riverside Woods",
      road: "The Thousand Steps",
      water: "The Cable Bridge",
      ruin: "The Burnt Library",
      camp: "Crossbow Terrace",
      outer: "Hall of Saints",
      inner: "Bell Tower Stair",
      throne: "The Great Bell",
    },
    enemies: {
      melee: { name: "Warrior Monk", color: 0x5a3a22 },
      ranged: { name: "Crossbow Monk", color: 0x4a1e24 },
      brute: { name: "Cathedral Guardian", color: 0x34383d },
      fast: { name: "Feral Hound", color: 0x3c3f42 },
    },
    beast: "fast",
    general: {
      name: "Abbot Joshin",
      title: "The Bell",
      actor: "bell",
      color: 0x8a4a1c,
      poem: ["I rang for heaven.", "Only snow answered the bell,", "falling without sound."],
      boss: {
        hp: 850,
        dmg: 32,
        speed: 3,
        radius: 0.6,
        look: "bell",
        pattern: [
          { k: "cone", name: "Long Blade Sweep", windup: 0.8, dmg: 1, reach: 3.2, range: 3.9, half: 1.1 },
          { k: "slam", name: "The Bell Tolls", windup: 1.6, dmg: 1.3, reach: 4, r: 5.5, perilous: true },
          { k: "shots", name: "Prayer Beads", windup: 0.7, dmg: 0.6, reach: 12, count: 5, spread: 0.9, speed: 14 },
          { k: "cone", name: "Long Blade Sweep", windup: 0.8, dmg: 1, reach: 3.2, range: 3.9, half: 1.1 },
          { k: "summon", name: "Chant", windup: 0.8, dmg: 0, reach: 30, arch: "ranged", count: 2 },
        ],
      },
    },
    reward: "kusari",
  },
  tides: {
    id: "tides",
    act: "Act III",
    name: "The Red Hook Docks",
    realm: "Brooklyn",
    blurb: "Rusting piers, container stacks and black-sailed ships.",
    giver: "Net-Mender Ume",
    flip: false,
    env: { fog: 0x515c66, fogDensity: 0.0135, sky: 0x1c2530, ground: 0x484c50, building: 0x8c8278, neon: [0xc8102e, 0xff7a1a], precip: "rain", fires: 9, water: true },
    poi: {
      village: "Net-Menders' Row",
      fields: "The Shallows",
      road: "Fish Market",
      water: "The Harbor Chain",
      ruin: "Smugglers' Cove",
      camp: "Pirate Anchorage",
      outer: "Storm Deck",
      inner: "The Black Flagship",
      throne: "The Admiral's Deck",
    },
    enemies: {
      melee: { name: "Pirate", color: 0x262c33 },
      ranged: { name: "Harpooner", color: 0x23302f },
      brute: { name: "Press-Ganger", color: 0x3d2422 },
      fast: { name: "Deck Runner", color: 0x3d382f },
    },
    general: {
      name: "Lady Uzushio Namie",
      title: "The Tide",
      actor: "tide",
      color: 0x1f3a4a,
      poem: ["No lord, no anchor.", "The tide I chased for so long", "goes out without me."],
      boss: {
        hp: 800,
        dmg: 30,
        speed: 4.2,
        radius: 0.5,
        look: "tide",
        pattern: [
          { k: "shots", name: "Chain Throw", windup: 0.6, dmg: 0.6, reach: 10, count: 1, spread: 0, speed: 20, pull: true },
          { k: "slam", name: "Sickle Spin", windup: 0.55, dmg: 0.9, reach: 2.2, r: 2.7 },
          { k: "charge", name: "Riptide", windup: 0.55, dmg: 1, reach: 7, dist: 8, width: 1, perilous: true },
          { k: "shots", name: "Three Hooks", windup: 0.6, dmg: 0.6, reach: 10, count: 3, spread: 0.5, speed: 16 },
          { k: "slam", name: "Sickle Spin", windup: 0.55, dmg: 0.9, reach: 2.2, r: 2.7 },
        ],
      },
    },
    reward: "nunchaku",
  },
  lanterns: {
    id: "lanterns",
    act: "Act IV",
    name: "The Neon Quarter",
    realm: "Lower East Side",
    blurb: "A city of endless night, signs that never switch off and theatres full of spies.",
    giver: "Okiku the Sign-Maker",
    flip: true,
    env: { fog: 0x5c5258, fogDensity: 0.013, sky: 0x251d26, ground: 0x4a464a, building: 0x88807e, neon: [0xe0102a, 0xff4d1a, 0xff8a1f, 0xb0001a], precip: "rain", fires: 6, water: false },
    poi: {
      village: "Sign-Makers' Alley",
      fields: "Theatre Street",
      road: "The Neon Gate",
      water: "Festival Square",
      ruin: "The Informer's Teahouse",
      camp: "The Puppet Theatre",
      outer: "Backstage",
      inner: "Hall of Mirrors",
      throne: "The Great Stage",
    },
    enemies: {
      melee: { name: "Masked Decoy", color: 0x4a1a22 },
      ranged: { name: "Knife Thrower", color: 0x2e2430 },
      brute: { name: "Great Puppet", color: 0x4a3a2c },
      fast: { name: "Shadow Actor", color: 0x2a2630 },
    },
    general: {
      name: "Yashiro Sosuke",
      title: "The Mask",
      actor: "mask",
      color: 0x6a1420,
      poem: ["The last mask comes off.", "Beneath it, to my surprise,", "there is no face at all."],
      boss: {
        hp: 750,
        dmg: 28,
        speed: 4,
        radius: 0.5,
        look: "mask",
        pattern: [
          { k: "decoys", name: "Seven Faces", windup: 0.6, dmg: 0, reach: 30, count: 3 },
          { k: "shots", name: "Fan of Knives", windup: 0.6, dmg: 0.55, reach: 10, count: 7, spread: 1.4, speed: 15 },
          { k: "charge", name: "Exit, Pursued", windup: 0.5, dmg: 1, reach: 7, dist: 7.5, width: 1, perilous: true },
          { k: "shots", name: "Fan of Knives", windup: 0.6, dmg: 0.55, reach: 10, count: 7, spread: 1.4, speed: 15 },
        ],
      },
    },
  },
  ash: {
    id: "ash",
    act: "Act V",
    name: "The Ash Ward",
    realm: "Lower Manhattan",
    blurb: "The old seat of power, burnt to the girders beneath the Lantern Tower.",
    giver: "Hana the Gravekeeper",
    flip: false,
    env: { fog: 0x6a564a, fogDensity: 0.015, sky: 0x2e2018, ground: 0x4c433c, building: 0x847a70, neon: [0xc8102e, 0xff5a1f], precip: "ash", fires: 16, water: false },
    poi: {
      village: "The Gravekeeper's Shelter",
      fields: "The Camellia Roof Garden",
      road: "The Road of Cinders",
      water: "The River of Embers",
      ruin: "The Old Dojo",
      camp: "Garrison Yard",
      outer: "The Hundred-Man Stair",
      inner: "The Banquet Hall",
      throne: "The Lord's Seat",
    },
    enemies: {
      melee: { name: "Ash Guard", color: 0x3b3431 },
      ranged: { name: "Ember Crossbow", color: 0x4a2a1c },
      brute: { name: "Tower Champion", color: 0x3d2020 },
      fast: { name: "Fallen Student", color: 0x3a3d42 },
    },
    general: {
      name: "Master Genryu",
      title: "The Sword Saint",
      actor: "genryu",
      color: 0xb8b2a8,
      poem: ["The student's blade is clean.", "At last the old pine may fall.", "Look, the dawn he kept."],
      boss: {
        hp: 1000,
        dmg: 30,
        speed: 4.4,
        radius: 0.5,
        look: "genryu",
        pattern: [
          { k: "charge", name: "Dash Cut", windup: 0.5, dmg: 1, reach: 7, dist: 8, width: 1, perilous: true },
          { k: "slam", name: "Whirl", windup: 0.6, dmg: 0.9, reach: 2.4, r: 3 },
          { k: "cone", name: "Sweep", windup: 0.5, dmg: 0.9, reach: 2.7, range: 3.2, half: 1 },
          { k: "guard", name: "Still Water", windup: 0.2, dmg: 0, reach: 30, dur: 2 },
          { k: "cone", name: "Sweep", windup: 0.45, dmg: 0.9, reach: 2.7, range: 3.2, half: 1 },
          { k: "charge", name: "Dash Cut", windup: 0.45, dmg: 1, reach: 7, dist: 8, width: 1, perilous: true },
        ],
      },
    },
  },
};

// ---------- Zone layout ----------

export const ZONE_W = 180;
export const ZONE_H = 110;

const BASE_POI: Record<PoiKey, [number, number]> = {
  village: [24, 55],
  fields: [57, 27],
  road: [62, 78],
  water: [97, 91],
  ruin: [99, 20],
  camp: [114, 56],
  outer: [140, 55],
  inner: [155.5, 55],
  throne: [170, 55],
};

export function poiPos(nation: NationId, key: PoiKey): { x: number; y: number } {
  const [x, y] = BASE_POI[key];
  return { x, y: NATIONS[nation].flip ? ZONE_H - y : y };
}

// The Night of Red Camellias: the plaza beneath the Lantern Tower, used by Memory missions.
export const MEMORY_W = 105;
export const MEMORY_H = 55;

export const MEMORY_POI: Record<PoiKey, { x: number; y: number; name: string }> = {
  village: { x: 11, y: 27.5, name: "Tower Road" },
  camp: { x: 28, y: 15, name: "The Tea House" },
  fields: { x: 47.5, y: 27.5, name: "Tower Plaza" },
  road: { x: 47.5, y: 47, name: "The Tower Gate" },
  water: { x: 47.5, y: 8.5, name: "The Watch Post" },
  ruin: { x: 72.5, y: 27.5, name: "The Water Gate" },
  outer: { x: 95, y: 27.5, name: "Shrine Road" },
  inner: { x: 95, y: 27.5, name: "Shrine Road" },
  throne: { x: 95, y: 27.5, name: "The Shrine" },
};

export const MEMORY_ENV: Env = {
  fog: 0x5e4038,
  fogDensity: 0.014,
  sky: 0x2a1612,
  ground: 0x4a3e3a,
  building: 0x7c706a,
  neon: [0xc8102e, 0xff5a1f],
  precip: "ash",
  fires: 14,
  water: false,
};

export const MEMORY_ENEMIES: Record<Archetype, { name: string; color: number }> = {
  melee: { name: "Traitor Soldier", color: 0x3d2422 },
  ranged: { name: "Traitor Crossbow", color: 0x3a2a20 },
  brute: { name: "Traitor Captain", color: 0x3a1a1a },
  fast: { name: "Assassin", color: 0x26222a },
};
