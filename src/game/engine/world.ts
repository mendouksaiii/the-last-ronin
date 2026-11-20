import { MEMORY_ENEMIES, MEMORY_ENV, MEMORY_H, MEMORY_POI, MEMORY_W, NATIONS, ZONE_H, ZONE_W, poiPos } from "../data/nations";
import type { NationId, PoiKey, ZoneId } from "../types";
import { dist, inRect, type Building, type Prop, type Rect, type Vec, type Zone } from "./state";

// Builds a district of ruined New York from a fixed seed, so every visit looks the same.
// City blocks sit on a grid; streets run between them, so every place can be reached.

export function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const POI_KEYS: PoiKey[] = ["village", "fields", "road", "water", "ruin", "camp", "outer", "inner", "throne"];
const CELL = 20;
const WALL = 1.3;
const FORT: Rect = { x: 131, y: 35, w: 47, h: 40 };
const INNER_X = 148;
const GATE_H = 7;
const SIGNS = ["BAR", "HOTEL", "24H", "NOODLES", "PAWN", "LIQUOR", "OPEN", "MOTEL", "DINER", "CLUB", "PHARMACY", "RAMEN", "XXX", "TATTOO", "CASH"];

function city(rnd: () => number, w: number, h: number, clear: (p: Vec, r: number) => boolean): Building[] {
  const out: Building[] = [];
  for (let cx = CELL / 2; cx < w; cx += CELL) {
    for (let cy = CELL / 2; cy < h; cy += CELL) {
      if (rnd() < 0.06 || clear({ x: cx, y: cy }, 12)) continue;
      // Some cells hold two narrower buildings.
      const split = rnd() < 0.35;
      const parts = split ? 2 : 1;
      for (let i = 0; i < parts; i++) {
        const bw = split ? 5 + rnd() * 1.5 : 8 + rnd() * 4.5;
        const bh = 8 + rnd() * 4.5;
        const ox = split ? (i === 0 ? -3.4 : 3.4) : 0;
        // Manhattan's mix: brownstone rows, six-storey walk-ups, prewar mid-rises and towers.
        const a = rnd();
        const c = rnd();
        const b: Building = {
          x: cx + ox - bw / 2,
          y: cy - bh / 2,
          w: bw,
          h: bh,
          height: split ? 12 + a * 7 : a < 0.3 ? 15 + c * 10 : a < 0.72 ? 26 + c * 22 : 50 + c * c * 75,
          ruined: rnd() < 0.3,
          seed: Math.floor(rnd() * 1e6),
        };
        out.push(b);
      }
    }
  }
  return out;
}

export type BuildingStyle = "brownstone" | "walkup" | "deco" | "glass" | "ruin";

/** The kind of New York building a block holds, fixed by its size and seed. */
export function styleOf(b: Building): BuildingStyle {
  if (b.ruined) return "ruin";
  if (b.height >= 46) return b.seed % 3 === 0 ? "glass" : "deco";
  if (b.height <= 20 && Math.min(b.w, b.h) < 8) return b.seed % 4 === 0 ? "walkup" : "brownstone";
  return "walkup";
}

/** The face of a building that its door opens onto: 0 north, 1 south, 2 west, 3 east. */
export const frontOf = (b: Building) => (b.seed >> 3) % 2;

function streetProps(rnd: () => number, zone: Pick<Zone, "w" | "h" | "buildings" | "walls" | "env">, count: number, blocked: (p: Vec) => boolean) {
  const props: Prop[] = [];
  const cover: Rect[] = [];
  const free = (p: Vec, pad: number) =>
    p.x > 3 && p.y > 3 && p.x < zone.w - 3 && p.y < zone.h - 3 && !blocked(p) && !zone.buildings.some((b) => inRect(p, b, pad)) && !zone.walls.some((r) => inRect(p, r, pad + 1));
  for (let i = 0; i < count; i++) {
    const p = { x: rnd() * zone.w, y: rnd() * zone.h };
    const roll = rnd();
    const seed = Math.floor(rnd() * 1e6);
    if (roll < 0.22) {
      if (!free(p, 3) || props.some((q) => q.kind === "car" && dist(q, p) < 6)) continue;
      const rot = rnd() < 0.5 ? 0 : Math.PI / 2;
      // One in four is a yellow cab.
      const taxi = seed % 4 === 1;
      props.push({ ...p, kind: "car", rot: rot + (rnd() - 0.5) * 0.6, seed, color: taxi ? 0xd9a514 : [0x2a2d31, 0x3a1e1c, 0x2f3134, 0x1f2326][seed % 4], text: taxi ? "taxi" : undefined });
      const long = Math.abs(Math.sin(rot)) > 0.5;
      cover.push(long ? { x: p.x - 1, y: p.y - 2.1, w: 2, h: 4.2 } : { x: p.x - 2.1, y: p.y - 1, w: 4.2, h: 2 });
    } else if (roll < 0.34) {
      if (!free(p, 2)) continue;
      const rot = rnd() * Math.PI;
      props.push({ ...p, kind: "barrier", rot, seed });
      cover.push({ x: p.x - 1, y: p.y - 1, w: 2, h: 2 });
    } else if (roll < 0.62) {
      if (free(p, 0.6)) props.push({ ...p, kind: "rubble", rot: rnd() * 6, seed });
    } else if (roll < 0.74) {
      if (free(p, 1)) props.push({ ...p, kind: "lamp", rot: 0, seed });
    } else if (roll < 0.86) {
      if (free(p, 1)) props.push({ ...p, kind: "steam", rot: 0, seed });
    } else if (free(p, 1)) props.push({ ...p, kind: "crate", rot: rnd() * 6, seed });
  }
  // Burning barrels.
  for (let i = 0, tries = 0; i < zone.env.fires && tries < 200; tries++) {
    const p = { x: rnd() * zone.w, y: rnd() * zone.h };
    if (!free(p, 1.5)) continue;
    props.push({ ...p, kind: "fire", rot: 0, seed: Math.floor(rnd() * 1e6) });
    i++;
  }
  // Neon signs hang on the faces of buildings that front a street.
  for (const b of zone.buildings) {
    if (b.height < 9 || rnd() < 0.45) continue;
    const side = Math.floor(rnd() * 4);
    const pos = 0.2 + rnd() * 0.6;
    const at =
      side === 0
        ? { x: b.x + b.w * pos, y: b.y - 0.15, rot: Math.PI }
        : side === 1
          ? { x: b.x + b.w * pos, y: b.y + b.h + 0.15, rot: 0 }
          : side === 2
            ? { x: b.x - 0.15, y: b.y + b.h * pos, rot: -Math.PI / 2 }
            : { x: b.x + b.w + 0.15, y: b.y + b.h * pos, rot: Math.PI / 2 };
    const neon = zone.env.neon;
    props.push({ x: at.x, y: at.y, rot: at.rot, kind: "sign", seed: Math.floor(rnd() * 1e6), color: neon[Math.floor(rnd() * neon.length)], text: SIGNS[Math.floor(rnd() * SIGNS.length)] });
  }
  nycStreets(mulberry(zone.w * 31 + zone.buildings.length), zone, props, cover, free);
  return { props, cover };
}

/** Stoops on the brownstones, subway entrances and fire hydrants. */
function nycStreets(rnd: () => number, zone: Pick<Zone, "buildings">, props: Prop[], cover: Rect[], free: (p: Vec, pad: number) => boolean) {
  let subways = 0;
  for (const b of zone.buildings) {
    const north = frontOf(b) === 0;
    const fy = north ? b.y : b.y + b.h;
    const out = north ? -1 : 1;
    if (styleOf(b) === "brownstone") {
      // Stairs up to the parlour floor, 2 m out over the sidewalk.
      const x = b.x + b.w * (0.3 + rnd() * 0.4);
      if (free({ x, y: fy + out * 2.6 }, 0.4)) {
        props.push({ x, y: fy + out * 1.05, kind: "stoop", rot: north ? Math.PI : 0, seed: Math.floor(rnd() * 1e6) });
        cover.push({ x: x - 0.85, y: north ? fy - 2.1 : fy, w: 1.7, h: 2.1 });
      }
    } else if (subways < 4 && b.w > 8 && rnd() < 0.3) {
      // A subway stair at the corner, green globes either side.
      const x = b.x + (rnd() < 0.5 ? 2.2 : b.w - 2.2);
      const y = fy + out * 3.1;
      if (free({ x, y }, 2.2) && free({ x, y: y + out * 1.5 }, 1)) {
        props.push({ x, y, kind: "subway", rot: north ? Math.PI : 0, seed: Math.floor(rnd() * 1e6) });
        cover.push({ x: x - 1.9, y: y - 1.0, w: 3.8, h: 2.0 });
        subways++;
      }
    }
    if (rnd() < 0.45) {
      const x = b.x + rnd() * b.w;
      const y = (rnd() < 0.5 ? b.y - 2.1 : b.y + b.h + 2.1);
      if (free({ x, y }, 0.5)) props.push({ x, y, kind: "hydrant", rot: rnd() * 6, seed: Math.floor(rnd() * 1e6) });
    }
  }
}

function buildMemory(nation: NationId): Zone {
  const pois = MEMORY_POI;
  const rnd = mulberry(77);
  const clear = (p: Vec, r: number) => POI_KEYS.some((k) => dist(p, pois[k]) < 6 + r * 0.3) || Math.abs(p.y - 27.5) < 6;
  const buildings = city(rnd, MEMORY_W, MEMORY_H, clear);
  // The Lantern Tower rises over the plaza.
  buildings.push({ x: 40, y: 13, w: 15, h: 7, height: 90, ruined: false, seed: 4242 });
  const base = { w: MEMORY_W, h: MEMORY_H, buildings, walls: [] as Rect[], env: MEMORY_ENV };
  const { props, cover } = streetProps(rnd, base, 110, (p) => POI_KEYS.some((k) => dist(p, pois[k]) < 5));
  return {
    id: "memory",
    nation,
    ...base,
    pois,
    cover,
    gate: null,
    fortress: null,
    hall: null,
    props,
    camps: [],
    enemies: MEMORY_ENEMIES,
  };
}

export function buildZone(id: ZoneId, nation: NationId, gateOpen: boolean): Zone {
  if (id === "memory") return buildMemory(nation);
  const n = NATIONS[nation];
  const pois = {} as Zone["pois"];
  for (const k of POI_KEYS) pois[k] = { ...poiPos(nation, k), name: n.poi[k] };

  const f = FORT;
  const gy = f.y + f.h / 2 - GATE_H / 2;
  const sideH = (f.h - GATE_H) / 2;
  const walls: Rect[] = [
    { x: f.x, y: f.y, w: f.w, h: WALL },
    { x: f.x, y: f.y + f.h - WALL, w: f.w, h: WALL },
    { x: f.x + f.w - WALL, y: f.y, w: WALL, h: f.h },
    { x: f.x, y: f.y, w: WALL, h: sideH },
    { x: f.x, y: gy + GATE_H, w: WALL, h: sideH },
    { x: INNER_X, y: f.y, w: WALL, h: sideH },
    { x: INNER_X, y: gy + GATE_H, w: WALL, h: sideH },
  ];
  const gate: Rect | null = gateOpen ? null : { x: f.x, y: gy, w: WALL, h: GATE_H };
  const hall: Rect = { x: INNER_X + WALL, y: f.y + WALL, w: f.x + f.w - WALL - (INNER_X + WALL), h: f.h - WALL * 2 };

  const flipY = (y: number) => (n.flip ? ZONE_H - y : y);
  const camps: Vec[] = [
    { x: 52, y: flipY(52) },
    { x: 82, y: flipY(47) },
    { x: 85, y: flipY(69) },
    { x: 122, y: flipY(32) },
  ];

  const seed = nation.length * 97 + nation.charCodeAt(0) * 13;
  const rnd = mulberry(seed);
  const clear = (p: Vec, r: number) =>
    inRect(p, f, 7) || POI_KEYS.some((k) => dist(p, pois[k]) < 6 + r * 0.3) || camps.some((c) => dist(p, c) < 5 + r * 0.3);
  const buildings = city(rnd, ZONE_W, ZONE_H, clear);
  const base = { w: ZONE_W, h: ZONE_H, buildings, walls, env: n.env };
  const { props, cover } = streetProps(rnd, base, 260, (p) => inRect(p, f, 3) || POI_KEYS.some((k) => dist(p, pois[k]) < 6) || camps.some((c) => dist(p, c) < 4));
  // The hideout is lit warm, and each camp has its fire.
  props.push({ ...pois.village, x: pois.village.x + 3, kind: "fire", rot: 0, seed: 1 });
  for (const c of camps) props.push({ ...c, kind: "fire", rot: 0, seed: 2 });

  return {
    id,
    nation,
    ...base,
    pois,
    cover,
    gate,
    fortress: f,
    hall,
    props,
    camps,
    enemies: n.enemies,
    beast: n.beast,
  };
}
