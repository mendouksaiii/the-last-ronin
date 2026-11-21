import { DISTRICT_LAYOUTS, MEMORY_ENEMIES, MEMORY_ENV, MEMORY_H, MEMORY_POI, MEMORY_W, NATIONS, ZONE_H, ZONE_W, poiPos } from "../data/nations";
import type { NationId, PoiKey, ZoneId } from "../types";
import { dist, inRect, type Building, type BuildingKind, type Prop, type Rect, type Vec, type Zone } from "./state";

// Builds each district of ruined New York from a fixed seed with its own urban layout,
// architectural archetypes, landmark clearings, stronghold position and street dressing.

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
const WALL = 1.3;
const GATE_H = 7.5;
const SIGNS = ["BAR", "HOTEL", "24H", "NOODLES", "PAWN", "LIQUOR", "OPEN", "MOTEL", "DINER", "CLUB", "PHARMACY", "RAMEN", "XXX", "TATTOO", "CASH", "侍"];
const CONTAINER_COLORS = [0x8c2e24, 0x1d5a64, 0xb27622, 0x243b55, 0x5c3a2c, 0x2b523d, 0x454c54];

export type BuildingStyle = BuildingKind;

/** The architectural type of a building, honouring explicit district style first. */
export function styleOf(b: Building): BuildingStyle {
  if (b.style) return b.style;
  if (b.ruined) return "ruin";
  if (b.height >= 46) return b.seed % 3 === 0 ? "glass" : "deco";
  if (b.height <= 20 && Math.min(b.w, b.h) < 8) return b.seed % 4 === 0 ? "walkup" : "brownstone";
  return "walkup";
}

/** The face of a building that its door opens onto: 0 north, 1 south. */
export const frontOf = (b: Building) => (b.seed >> 3) % 2;

function buildDistrictCity(
  nation: NationId | "memory",
  rnd: () => number,
  w: number,
  h: number,
  clear: (p: Vec, r: number) => boolean,
): Building[] {
  const out: Building[] = [];
  const margin = nation === "memory" ? 3.5 : 8.5;
  const quayY = Math.round(h * 0.675);

  const canPlace = (b: Building, minGap = 4.6, skipOverlapWith = out.length) => {
    if (b.x < margin || b.y < margin || b.x + b.w > w - margin || b.y + b.h > h - margin) return false;
    const rad = Math.max(b.w, b.h) * 0.5;
    if (clear({ x: b.x + b.w / 2, y: b.y + b.h / 2 }, rad)) return false;
    // Check corners too so oversized buildings never clip into POIs or arterial lanes.
    if (clear({ x: b.x + 1, y: b.y + 1 }, 2) || clear({ x: b.x + b.w - 1, y: b.y + b.h - 1 }, 2)) return false;
    for (let i = 0; i < skipOverlapWith; i++) {
      const o = out[i];
      if (b.x < o.x + o.w + minGap && b.x + b.w + minGap > o.x && b.y < o.y + o.h + minGap && b.y + b.h + minGap > o.y) {
        return false;
      }
    }
    return true;
  };

  if (nation === "reeds") {
    // Queens Drowned Borough: sparse low-rise brick tenements, brownstones & wide ration depots, open flooded marsh lots.
    const cell = 23;
    for (let cx = cell / 2; cx < w; cx += cell) {
      for (let cy = cell / 2; cy < h; cy += cell) {
        if (rnd() < 0.24 || clear({ x: cx, y: cy }, 13)) continue;
        const isDepot = rnd() < 0.42;
        if (isDepot) {
          const bw = 10 + rnd() * 5;
          const bh = 7 + rnd() * 4.5;
          const b: Building = {
            x: cx - bw / 2,
            y: cy - bh / 2,
            w: bw,
            h: bh,
            height: 7 + rnd() * 6,
            ruined: rnd() < 0.25,
            seed: Math.floor(rnd() * 1e6),
            style: "warehouse",
          };
          if (canPlace(b)) out.push(b);
        } else {
          const split = rnd() < 0.45;
          const parts = split ? 2 : 1;
          const groupStart = out.length;
          for (let i = 0; i < parts; i++) {
            const bw = split ? 5 + rnd() * 1.3 : 8 + rnd() * 3.5;
            const bh = 7.5 + rnd() * 4;
            const ox = split ? (i === 0 ? -3.8 : 3.8) : 0;
            const ruined = rnd() < 0.32;
            const b: Building = {
              x: cx + ox - bw / 2,
              y: cy - bh / 2,
              w: bw,
              h: bh,
              height: 9 + rnd() * 14,
              ruined,
              seed: Math.floor(rnd() * 1e6),
              style: ruined ? "ruin" : split ? "brownstone" : "walkup",
            };
            if (canPlace(b, 4.6, groupStart)) out.push(b);
          }
        }
      }
    }
    return out;
  }

  if (nation === "snow") {
    // Cathedral Heights: spacious gothic stone cloisters, limestone abbeys & winter brownstones around forested hillsides.
    const cell = 22;
    for (let cx = cell / 2; cx < w; cx += cell) {
      for (let cy = cell / 2; cy < h; cy += cell) {
        if (rnd() < 0.28 || clear({ x: cx, y: cy }, 13)) continue;
        const abbey = rnd() < 0.58;
        const bw = abbey ? 9 + rnd() * 4.5 : 7 + rnd() * 3;
        const bh = abbey ? 9 + rnd() * 4.5 : 7 + rnd() * 3.5;
        const ruined = rnd() < 0.18;
        const b: Building = {
          x: cx - bw / 2,
          y: cy - bh / 2,
          w: bw,
          h: bh,
          height: abbey ? 16 + rnd() * 20 : 12 + rnd() * 11,
          ruined,
          seed: Math.floor(rnd() * 1e6),
          style: ruined ? "ruin" : abbey ? "cathedral" : "brownstone",
        };
        if (canPlace(b)) out.push(b);
      }
    }
    return out;
  }

  if (nation === "tides") {
    // Red Hook Docks: open southern waterfront, colourful shipping container yards & wide brick/corrugated dock warehouses.
    const cell = 20;
    for (let cx = cell / 2; cx < w; cx += cell) {
      for (let cy = cell / 2; cy < quayY - 3; cy += cell) {
        if (rnd() < 0.16 || clear({ x: cx, y: cy }, 11.5)) continue;
        const isContainers = cy > 36 ? rnd() < 0.68 : rnd() < 0.38;
        if (isContainers) {
          // A pair of stacked shipping-container rows with a navigable alley between them.
          const horizontal = rnd() < 0.65;
          const rows = 2;
          const groupStart = out.length;
          for (let i = 0; i < rows; i++) {
            const bw = horizontal ? 9.5 + rnd() * 2.5 : 3.2;
            const bh = horizontal ? 3.2 : 9.5 + rnd() * 2.5;
            const ox = horizontal ? 0 : i === 0 ? -3.6 : 3.6;
            const oy = horizontal ? (i === 0 ? -3.4 : 3.4) : 0;
            const tiers = 1 + Math.floor(rnd() * 3);
            const seed = Math.floor(rnd() * 1e6);
            const b: Building = {
              x: cx + ox - bw / 2,
              y: cy + oy - bh / 2,
              w: bw,
              h: bh,
              height: tiers * 2.9,
              ruined: false,
              seed,
              style: "container",
              color: CONTAINER_COLORS[seed % CONTAINER_COLORS.length],
            };
            if (canPlace(b, 4.4, groupStart)) out.push(b);
          }
        } else {
          const bw = 10 + rnd() * 4.5;
          const bh = 8 + rnd() * 4;
          const ruined = rnd() < 0.18;
          const b: Building = {
            x: cx - bw / 2,
            y: cy - bh / 2,
            w: bw,
            h: bh,
            height: 8 + rnd() * 10,
            ruined,
            seed: Math.floor(rnd() * 1e6),
            style: ruined ? "ruin" : "warehouse",
          };
          if (canPlace(b)) out.push(b);
        }
      }
    }
    return out;
  }

  if (nation === "lanterns") {
    // Neon Quarter: dense vertical cyberpunk canyons of Art Deco & reflective glass towers around glowing festival plazas.
    const cell = 17;
    for (let cx = cell / 2; cx < w; cx += cell) {
      for (let cy = cell / 2; cy < h; cy += cell) {
        if (rnd() < 0.08 || clear({ x: cx, y: cy }, 10)) continue;
        const bw = 7.5 + rnd() * 3.0;
        const bh = 7.5 + rnd() * 3.0;
        const roll = rnd();
        const seed = Math.floor(rnd() * 1e6);
        const height = roll < 0.25 ? 20 + rnd() * 14 : roll < 0.65 ? 36 + rnd() * 28 : 60 + rnd() * 38;
        const style: BuildingKind = height >= 44 ? (seed % 2 === 0 ? "glass" : "deco") : "walkup";
        const b: Building = {
          x: cx - bw / 2,
          y: cy - bh / 2,
          w: bw,
          h: bh,
          height,
          ruined: rnd() < 0.06,
          seed,
          style,
        };
        if (canPlace(b, 4.6)) out.push(b);
      }
    }
    return out;
  }

  if (nation === "ash") {
    // Ash Ward: devastated Lower Manhattan financial district — tall shattered skyscraper husks & exposed steel girders.
    const cell = 21;
    for (let cx = cell / 2; cx < w; cx += cell) {
      for (let cy = cell / 2; cy < h; cy += cell) {
        if (rnd() < 0.16 || clear({ x: cx, y: cy }, 12)) continue;
        const bw = 8.5 + rnd() * 4.5;
        const bh = 8.5 + rnd() * 4.5;
        const ruined = rnd() < 0.62;
        const tall = rnd();
        const seed = Math.floor(rnd() * 1e6);
        const height = tall < 0.35 ? 20 + rnd() * 18 : 42 + rnd() * 52;
        const b: Building = {
          x: cx - bw / 2,
          y: cy - bh / 2,
          w: bw,
          h: bh,
          height,
          ruined,
          seed,
          style: ruined ? "ruin" : height >= 46 ? (seed % 3 === 0 ? "glass" : "deco") : "walkup",
        };
        if (canPlace(b)) out.push(b);
      }
    }
    return out;
  }

  // Memory zone (Night of Red Camellias): classic Manhattan mix around the Lantern Tower plaza.
  const cell = 20;
  for (let cx = cell / 2; cx < w; cx += cell) {
    for (let cy = cell / 2; cy < h; cy += cell) {
      if (rnd() < 0.06 || clear({ x: cx, y: cy }, 12)) continue;
      const split = rnd() < 0.35;
      const parts = split ? 2 : 1;
      const groupStart = out.length;
      for (let i = 0; i < parts; i++) {
        const bw = split ? 5 + rnd() * 1.5 : 8 + rnd() * 4.5;
        const bh = 8 + rnd() * 4.5;
        const ox = split ? (i === 0 ? -3.4 : 3.4) : 0;
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
        if (canPlace(b, 3.8, groupStart)) out.push(b);
      }
    }
  }
  return out;
}

function streetProps(
  nation: NationId | "memory",
  rnd: () => number,
  zone: Pick<Zone, "w" | "h" | "buildings" | "walls" | "env">,
  count: number,
  blocked: (p: Vec) => boolean,
) {
  const props: Prop[] = [];
  const cover: Rect[] = [];
  const quayY = Math.round(zone.h * 0.675);
  const free = (p: Vec, pad: number) =>
    p.x > 4 &&
    p.y > 4 &&
    p.x < zone.w - 4 &&
    p.y < zone.h - 4 &&
    !blocked(p) &&
    !zone.buildings.some((b) => inRect(p, b, pad)) &&
    !zone.walls.some((r) => inRect(p, r, pad + 1.5));

  // Ensure solid cover (cars, barriers, subways, stoops) never corks narrow gaps or stacks on top of other cover.
  const freeCover = (p: Vec, bPad: number, cPad: number) =>
    free(p, bPad) && !cover.some((c) => inRect(p, c, cPad));

  // Per-district prop weightings so the street clutter reflects each biome.
  const carCut = nation === "snow" ? 0.06 : nation === "tides" ? 0.09 : nation === "reeds" ? 0.18 : nation === "ash" ? 0.16 : 0.22;
  const barrierCut = carCut + (nation === "tides" ? 0.18 : nation === "ash" ? 0.14 : 0.11);
  const rubbleCut = barrierCut + (nation === "ash" ? 0.38 : nation === "reeds" ? 0.24 : nation === "snow" ? 0.16 : 0.18);
  const lampCut = rubbleCut + (nation === "lanterns" ? 0.18 : nation === "snow" ? 0.2 : 0.14);
  const steamCut = lampCut + (nation === "snow" ? 0.03 : nation === "tides" ? 0.04 : 0.12);

  for (let i = 0; i < count; i++) {
    const p = { x: rnd() * zone.w, y: rnd() * zone.h };
    const roll = rnd();
    const seed = Math.floor(rnd() * 1e6);
    if (roll < carCut) {
      if (nation === "tides" && p.y > quayY - 2) continue;
      if (!freeCover(p, 3.6, 3.8) || props.some((q) => q.kind === "car" && dist(q, p) < 7.5)) continue;
      const rot = rnd() < 0.5 ? 0 : Math.PI / 2;
      const taxi = nation !== "snow" && nation !== "tides" && seed % 4 === 1;
      props.push({
        ...p,
        kind: "car",
        rot: rot + (rnd() - 0.5) * 0.6,
        seed,
        color: taxi ? 0xd9a514 : [0x2a2d31, 0x3a1e1c, 0x2f3134, 0x1f2326][seed % 4],
        text: taxi ? "taxi" : undefined,
      });
      const long = Math.abs(Math.sin(rot)) > 0.5;
      cover.push(long ? { x: p.x - 1, y: p.y - 2.1, w: 2, h: 4.2 } : { x: p.x - 2.1, y: p.y - 1, w: 4.2, h: 2 });
    } else if (roll < barrierCut) {
      if (!freeCover(p, 3.0, 3.2)) continue;
      const rot = rnd() * Math.PI;
      props.push({ ...p, kind: "barrier", rot, seed });
      cover.push({ x: p.x - 1, y: p.y - 1, w: 2, h: 2 });
    } else if (roll < rubbleCut) {
      if (free(p, 0.8)) props.push({ ...p, kind: "rubble", rot: rnd() * 6, seed });
    } else if (roll < lampCut) {
      if (free(p, 1.4)) props.push({ ...p, kind: "lamp", rot: 0, seed });
    } else if (roll < steamCut) {
      if (free(p, 1.2)) props.push({ ...p, kind: "steam", rot: 0, seed });
    } else if (free(p, 1.2)) {
      props.push({ ...p, kind: "crate", rot: rnd() * 6, seed });
    }
  }

  // Burning barrels / monastery braziers.
  for (let i = 0, tries = 0; i < zone.env.fires && tries < 320; tries++) {
    const p = { x: rnd() * zone.w, y: rnd() * zone.h };
    if (!free(p, 1.8)) continue;
    props.push({ ...p, kind: "fire", rot: 0, seed: Math.floor(rnd() * 1e6) });
    i++;
  }

  // Neon signs: dense multi-tier signs in the Neon Quarter, sparse industrial/distress signs elsewhere, none on Cathedral Heights!
  const signChance = nation === "lanterns" ? 0.94 : nation === "snow" ? 0.0 : nation === "tides" ? 0.35 : nation === "ash" ? 0.28 : 0.42;
  const maxPerBuilding = nation === "lanterns" ? 2 : 1;
  for (const b of zone.buildings) {
    if (b.height < 8 || b.style === "container" || b.style === "cathedral") continue;
    for (let s = 0; s < maxPerBuilding; s++) {
      if (rnd() > signChance) continue;
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
      props.push({
        x: at.x,
        y: at.y,
        rot: at.rot,
        kind: "sign",
        seed: Math.floor(rnd() * 1e6),
        color: neon[Math.floor(rnd() * neon.length)],
        text: SIGNS[Math.floor(rnd() * SIGNS.length)],
      });
    }
  }
  nycStreets(nation, mulberry(zone.w * 31 + zone.buildings.length), zone, props, cover, free, freeCover);
  return { props, cover };
}

/** Stoops on brownstones, subway entrances (urban districts only) and fire hydrants. */
function nycStreets(
  nation: NationId | "memory",
  rnd: () => number,
  zone: Pick<Zone, "buildings">,
  props: Prop[],
  cover: Rect[],
  free: (p: Vec, pad: number) => boolean,
  freeCover: (p: Vec, bPad: number, cPad: number) => boolean,
) {
  let subways = 0;
  const maxSubways = nation === "tides" || nation === "snow" ? 1 : 6;
  for (const b of zone.buildings) {
    const st = styleOf(b);
    if (st === "container" || st === "warehouse") continue;
    const north = frontOf(b) === 0;
    const fy = north ? b.y : b.y + b.h;
    const out = north ? -1 : 1;
    if (st === "brownstone") {
      const x = b.x + b.w * (0.3 + rnd() * 0.4);
      // Only place stoop when the facing street is genuinely wide open.
      if (freeCover({ x, y: fy + out * 3.0 }, 1.6, 2.4)) {
        props.push({ x, y: fy + out * 1.05, kind: "stoop", rot: north ? Math.PI : 0, seed: Math.floor(rnd() * 1e6) });
        cover.push({ x: x - 0.85, y: north ? fy - 2.1 : fy, w: 1.7, h: 2.1 });
      }
    } else if (subways < maxSubways && b.w > 8 && rnd() < 0.3) {
      const x = b.x + (rnd() < 0.5 ? 2.2 : b.w - 2.2);
      const y = fy + out * 3.2;
      if (freeCover({ x, y }, 2.6, 2.8) && free({ x, y: y + out * 1.6 }, 1.5)) {
        props.push({ x, y, kind: "subway", rot: north ? Math.PI : 0, seed: Math.floor(rnd() * 1e6) });
        cover.push({ x: x - 1.9, y: y - 1.0, w: 3.8, h: 2.0 });
        subways++;
      }
    }
    if (nation !== "snow" && rnd() < 0.4) {
      const x = b.x + rnd() * b.w;
      const y = rnd() < 0.5 ? b.y - 2.1 : b.y + b.h + 2.1;
      if (free({ x, y }, 0.6)) props.push({ x, y, kind: "hydrant", rot: rnd() * 6, seed: Math.floor(rnd() * 1e6) });
    }
  }
}

function buildMemory(nation: NationId): Zone {
  const pois = MEMORY_POI;
  const rnd = mulberry(77);
  const clear = (p: Vec, r: number) => POI_KEYS.some((k) => dist(p, pois[k]) < 6 + r * 0.3) || Math.abs(p.y - 27.5) < 6;
  const buildings = buildDistrictCity("memory", rnd, MEMORY_W, MEMORY_H, clear);
  // The Lantern Tower rises over the plaza.
  buildings.push({ x: 40, y: 13, w: 15, h: 7, height: 90, ruined: false, seed: 4242 });
  const base = { w: MEMORY_W, h: MEMORY_H, buildings, walls: [] as Rect[], env: MEMORY_ENV };
  const { props, cover } = streetProps("memory", rnd, base, 110, (p) => POI_KEYS.some((k) => dist(p, pois[k]) < 5));
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
  const layout = DISTRICT_LAYOUTS[nation];
  const pois = {} as Zone["pois"];
  for (const k of POI_KEYS) pois[k] = { ...poiPos(nation, k), name: n.poi[k] };

  const f: Rect = { ...layout.fortress };
  const innerX = layout.innerX;
  const gy = f.y + f.h / 2 - GATE_H / 2;
  const sideH = (f.h - GATE_H) / 2;
  const walls: Rect[] = [
    { x: f.x, y: f.y, w: f.w, h: WALL },
    { x: f.x, y: f.y + f.h - WALL, w: f.w, h: WALL },
    { x: f.x + f.w - WALL, y: f.y, w: WALL, h: f.h },
    { x: f.x, y: f.y, w: WALL, h: sideH },
    { x: f.x, y: gy + GATE_H, w: WALL, h: sideH },
    { x: innerX, y: f.y, w: WALL, h: sideH },
    { x: innerX, y: gy + GATE_H, w: WALL, h: sideH },
  ];
  const gate: Rect | null = gateOpen ? null : { x: f.x, y: gy, w: WALL, h: GATE_H };
  const hall: Rect = { x: innerX + WALL, y: f.y + WALL, w: f.x + f.w - WALL - (innerX + WALL), h: f.h - WALL * 2 };

  const camps: Vec[] = layout.camps.map(([x, y]) => ({ x, y }));

  const seed = nation.length * 97 + nation.charCodeAt(0) * 13 + nation.charCodeAt(1) * 7;
  const rnd = mulberry(seed);
  const quayY = Math.round(ZONE_H * 0.675);
  const gateApproach: Rect = { x: f.x - 16, y: f.y + f.h / 2 - 5, w: 18, h: 10 };

  // District-specific open landmark clearings & wide arterial avenues connecting POIs, hideout and stronghold!
  const extraClear = (p: Vec) => {
    if (inRect(p, gateApproach)) return true;
    if (Math.abs(p.y - pois.village.y) < 6) return true;
    if (Math.abs(p.x - pois.water.x) < 5.5 && Math.abs(p.y - pois.water.y) < 35) return true;
    if (nation === "reeds") {
      return dist(p, pois.fields) < 19 || dist(p, pois.water) < 22 || Math.abs(p.y - pois.road.y) < 7.5;
    }
    if (nation === "snow") {
      return dist(p, pois.fields) < 22 || dist(p, pois.road) < 16 || dist(p, pois.water) < 15 || Math.abs(p.y - pois.road.y) < 6.5;
    }
    if (nation === "tides") {
      return p.y > quayY + 4 || dist(p, pois.fields) < 18 || dist(p, pois.water) < 20 || Math.abs(p.y - pois.road.y) < 6.5;
    }
    if (nation === "lanterns") {
      return dist(p, pois.water) < 18 || dist(p, pois.road) < 13 || Math.abs(p.y - pois.water.y) < 6.5;
    }
    if (nation === "ash") {
      return dist(p, pois.fields) < 18 || dist(p, pois.water) < 17 || Math.abs(p.y - pois.road.y) < 6.5;
    }
    return false;
  };

  const clear = (p: Vec, r: number) =>
    inRect(p, f, 8.5) ||
    extraClear(p) ||
    POI_KEYS.some((k) => dist(p, pois[k]) < 7.5 + r * 0.3) ||
    camps.some((c) => dist(p, c) < 6 + r * 0.3);

  const buildings = buildDistrictCity(nation, rnd, ZONE_W, ZONE_H, clear);
  const base = { w: ZONE_W, h: ZONE_H, buildings, walls, env: n.env };
  const propCount = nation === "lanterns" ? 300 : nation === "snow" ? 260 : 350;
  const { props, cover } = streetProps(
    nation,
    rnd,
    base,
    propCount,
    (p) =>
      inRect(p, f, 4.0) ||
      inRect(p, gateApproach) ||
      POI_KEYS.some((k) => dist(p, pois[k]) < 7) ||
      camps.some((c) => dist(p, c) < 5) ||
      (nation === "tides" && p.y > quayY + 12),
  );
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
