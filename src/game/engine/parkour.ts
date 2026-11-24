import { sound } from "../audio/soundEngine";
import type { Game } from "./game";
import type { Building, HangLedge, Ledge, Rect, Vec, Zone } from "./state";

const GRAVITY = 23.5;
const JUMP_VZ = 8.6;
const SPRINT_JUMP_VZ = 9.0;
const PLAYER_R = 0.4;
const MAX_CLIMB_H = 22.5;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function idleAct() {
  return { kind: "idle" as const, t: 0, dur: 0, move: null, landed: 0, dir: 0, bonus: 1, target: null };
}

export function coverHeight(r: Rect): number {
  const maxDim = Math.max(r.w, r.h);
  if (maxDim >= 4.0) return 1.38; // wrecked car / taxi
  if (maxDim >= 3.4) return 2.4; // subway kiosk / entrance
  if (Math.abs(r.w - r.h) > 0.25) return 1.15; // brownstone stoop
  return 0.95; // concrete jersey barrier
}

interface SolidBox {
  x: number;
  y: number;
  w: number;
  h: number;
  top: number;
  climbable: boolean;
}

const solidCache = new WeakMap<Zone, { ver: number; list: SolidBox[] }>();

function getSolids(zone: Zone): SolidBox[] {
  const cached = solidCache.get(zone);
  if (cached && cached.ver === zone.buildings.length + zone.walls.length + (zone.gate ? 1 : 0)) {
    return cached.list;
  }
  const list: SolidBox[] = [];
  for (const b of zone.buildings) {
    list.push({ x: b.x, y: b.y, w: b.w, h: b.h, top: b.height, climbable: b.height <= MAX_CLIMB_H });
  }
  for (const w of zone.walls) {
    // Fortress walls stay unscalable while the stronghold shutter gate is locked.
    list.push({ x: w.x, y: w.y, w: w.w, h: w.h, top: zone.gate ? 99 : 6.5, climbable: !zone.gate });
  }
  if (zone.gate) {
    list.push({ x: zone.gate.x, y: zone.gate.y, w: zone.gate.w, h: zone.gate.h, top: 99, climbable: false });
  }
  for (const c of zone.cover) {
    list.push({ x: c.x, y: c.y, w: c.w, h: c.h, top: coverHeight(c), climbable: true });
  }
  solidCache.set(zone, { ver: zone.buildings.length + zone.walls.length + (zone.gate ? 1 : 0), list });
  return list;
}

/** Highest walkable surface beneath (x, y) reachable from footZ. */
export function groundHeightAt(zone: Zone, x: number, y: number, footZ: number, r = PLAYER_R): number {
  let best = 0;
  const stepReach = footZ + 0.52;
  for (const s of getSolids(zone)) {
    if (s.top > stepReach || s.top <= best) continue;
    if (x + r * 0.65 > s.x && x - r * 0.65 < s.x + s.w && y + r * 0.65 > s.y && y - r * 0.65 < s.y + s.h) {
      best = s.top;
    }
  }
  for (const l of zone.ledges) {
    if (l.z > stepReach || l.z <= best) continue;
    const pad = l.kind === "beam" ? 0.36 : 0.24;
    if (x + pad > l.x && x - pad < l.x + l.w && y + pad > l.y && y - pad < l.y + l.h) {
      best = l.z;
    }
  }
  return best;
}

/** Moves a body horizontally against every solid whose top rises above current elevation. */
export function moveBody3D(g: Game, b: Vec, dx: number, dy: number, r: number, footZ: number, sub = 0.28) {
  const z = g.zone;
  const edge = 1.6 + r;
  const solids = getSolids(z);
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / sub));
  for (let i = 0; i < n; i++) {
    b.x = clamp(b.x + dx / n, edge, z.w - edge);
    b.y = clamp(b.y + dy / n, edge, z.h - edge);
    for (const s of solids) {
      if (footZ >= s.top - 0.45) continue;
      if (b.x < s.x - r || b.x > s.x + s.w + r || b.y < s.y - r || b.y > s.y + s.h + r) continue;
      const cx = clamp(b.x, s.x, s.x + s.w);
      const cy = clamp(b.y, s.y, s.y + s.h);
      const ox = b.x - cx;
      const oy = b.y - cy;
      const d = Math.hypot(ox, oy);
      if (d >= r) continue;
      if (d > 0.0001) {
        b.x = cx + (ox / d) * r;
        b.y = cy + (oy / d) * r;
      } else {
        const opts = [
          [s.x - r - b.x, 0],
          [s.x + s.w + r - b.x, 0],
          [0, s.y - r - b.y],
          [0, s.y + s.h + r - b.y],
        ];
        opts.sort((u, v) => Math.abs(u[0] + u[1]) - Math.abs(v[0] + v[1]));
        b.x += opts[0][0];
        b.y += opts[0][1];
      }
    }
  }
}

/** Builds a HangLedge descriptor from a static Ledge or a building roof perimeter edge. */
function makeHangFromLedge(l: Ledge, x: number, y: number, zone: Zone): HangLedge {
  const tx = -l.ny;
  const ty = l.nx;
  const cx = l.x + l.w / 2;
  const cy = l.y + l.h / 2;
  const halfSpan = (Math.abs(tx) * l.w + Math.abs(ty) * l.h) * 0.5;
  const proj = (x - cx) * tx + (y - cy) * ty;
  const t = clamp(proj, -halfSpan + 0.25, halfSpan - 0.25);
  // Determine whether this hold opens directly onto a roof or beam top.
  let topZ = l.z;
  let isRoof = l.kind === "beam";
  if (l.kind === "hold") {
    const insideX = cx - l.nx * 0.8;
    const insideY = cy - l.ny * 0.8;
    for (const b of zone.buildings) {
      if (insideX >= b.x - 0.2 && insideX <= b.x + b.w + 0.2 && insideY >= b.y - 0.2 && insideY <= b.y + b.h + 0.2) {
        if (Math.abs(b.height - l.z) < 1.35) {
          topZ = b.height;
          isRoof = true;
        }
        break;
      }
    }
  }
  return {
    x: cx + l.nx * (Math.abs(l.nx) * l.w * 0.5 + 0.02),
    y: cy + l.ny * (Math.abs(l.ny) * l.h * 0.5 + 0.02),
    z: l.z,
    nx: l.nx,
    ny: l.ny,
    minT: -halfSpan + 0.25,
    maxT: halfSpan - 0.25,
    t,
    topZ,
    isRoof,
    onBeam: l.kind === "beam",
  };
}

/** Searches for a grab-able wall hold or climbable rooftop lip near (x, y, handZ). */
export function findGrabLedge(zone: Zone, x: number, y: number, handZ: number, facing: number, dirFilter = true): HangLedge | null {
  const fx = Math.cos(facing);
  const fy = Math.sin(facing);
  let best: HangLedge | null = null;
  let bestScore = Infinity;

  for (const l of zone.ledges) {
    if (Math.abs(l.z - handZ) > 0.72) continue;
    const tx = -l.ny;
    const ty = l.nx;
    const cx = l.x + l.w / 2;
    const cy = l.y + l.h / 2;
    const halfSpan = (Math.abs(tx) * l.w + Math.abs(ty) * l.h) * 0.5;
    const relX = x - cx;
    const relY = y - cy;
    const along = relX * tx + relY * ty;
    const perp = relX * l.nx + relY * l.ny;
    if (Math.abs(along) > halfSpan + 0.35) continue;
    if (perp < -0.55 || perp > 1.05) continue;
    if (dirFilter && fx * -l.nx + fy * -l.ny < -0.35) continue;
    const score = Math.abs(l.z - handZ) * 1.4 + Math.abs(perp);
    if (score < bestScore) {
      bestScore = score;
      best = makeHangFromLedge(l, x, y, zone);
    }
  }

  for (const s of getSolids(zone)) {
    if (!s.climbable || s.top < 1.55) continue;
    if (Math.abs(s.top - handZ) > 0.65) continue;
    const faces: [number, number, number, number, number, number][] = [
      [s.x, s.y + s.h * 0.5, -1, 0, s.h * 0.5, y - (s.y + s.h * 0.5)],
      [s.x + s.w, s.y + s.h * 0.5, 1, 0, s.h * 0.5, y - (s.y + s.h * 0.5)],
      [s.x + s.w * 0.5, s.y, 0, -1, s.w * 0.5, x - (s.x + s.w * 0.5)],
      [s.x + s.w * 0.5, s.y + s.h, 0, 1, s.w * 0.5, x - (s.x + s.w * 0.5)],
    ];
    for (const [edgeX, edgeY, nx, ny, half, along] of faces) {
      if (Math.abs(along) > half - 0.15) continue;
      const perp = (x - edgeX) * nx + (y - edgeY) * ny;
      if (perp < -0.35 || perp > 1.0) continue;
      if (dirFilter && fx * -nx + fy * -ny < -0.25) continue;
      const score = Math.abs(s.top - handZ) * 1.4 + Math.abs(perp);
      if (score < bestScore) {
        bestScore = score;
        const tx = -ny;
        const ty = nx;
        const t = clamp((x - edgeX) * tx + (y - edgeY) * ty, -half + 0.35, half - 0.35);
        best = {
          x: edgeX,
          y: edgeY,
          z: s.top,
          nx,
          ny,
          minT: -half + 0.35,
          maxT: half - 0.35,
          t,
          topZ: s.top,
          isRoof: true,
        };
      }
    }
  }
  return best;
}

/** Finds an obstacle directly ahead of the hero suitable for a single-hand speed vault. */
function findVaultObstacle(g: Game, dir: number): SolidBox | null {
  const p = g.player;
  const fx = Math.cos(dir);
  const fy = Math.sin(dir);
  const probeX = p.x + fx * 0.95;
  const probeY = p.y + fy * 0.95;
  for (const s of getSolids(g.zone)) {
    if (!s.climbable) continue;
    const relTop = s.top - p.z;
    if (relTop < 0.45 || relTop > 1.68) continue;
    if (probeX > s.x - 0.4 && probeX < s.x + s.w + 0.4 && probeY > s.y - 0.4 && probeY < s.y + s.h + 0.4) {
      return s;
    }
  }
  return null;
}

/** Finds a higher wall hold for upward/diagonal ledge-to-ledge hops while hanging. */
function findHopLedge(g: Game, dirX: number, dirY: number): HangLedge | null {
  const p = g.player;
  const cur = p.ledge;
  if (!cur) return null;
  const tx = -cur.ny;
  const ty = cur.nx;
  const latInput = dirX * tx + dirY * ty;
  let best: HangLedge | null = null;
  let bestScore = Infinity;

  for (const l of g.zone.ledges) {
    if (Math.abs(l.nx - cur.nx) > 0.25 || Math.abs(l.ny - cur.ny) > 0.25) continue;
    const dz = l.z - cur.z;
    if (dz < 0.65 || dz > 3.15) continue;
    const h = makeHangFromLedge(l, p.x + latInput * 2.1, p.y + latInput * 2.1, g.zone);
    // Keep ledge hops strictly along the same building wall face (allowing beam depth offset <= 1.1m).
    const perpDiff = Math.abs((h.x - cur.x) * cur.nx + (h.y - cur.y) * cur.ny);
    if (perpDiff > 1.15) continue;
    const ptX = h.x + tx * h.t;
    const ptY = h.y + ty * h.t;
    const latDist = (ptX - p.x) * tx + (ptY - p.y) * ty;
    if (Math.abs(latDist) > 3.4) continue;
    const alignmentPenalty = Math.abs(latInput) > 0.2 && Math.sign(latDist) !== Math.sign(latInput) ? 3.5 : 0;
    const score = dz + Math.abs(latDist) * 0.55 + alignmentPenalty;
    if (score < bestScore) {
      bestScore = score;
      best = h;
    }
  }

  // Also check the top roof rim right above the current wall hold or beam.
  if (!cur.isRoof || cur.onBeam) {
    const wallOffset = cur.onBeam ? 0.7 : 0;
    const roofProbe = findGrabLedge(g.zone, p.x - cur.nx * wallOffset, p.y - cur.ny * wallOffset, cur.z + 2.35, p.facing, false);
    if (roofProbe && roofProbe.isRoof && !roofProbe.onBeam && roofProbe.z - cur.z > 0.6 && roofProbe.z - cur.z < 3.1) {
      const score = roofProbe.z - cur.z;
      if (score < bestScore) best = roofProbe;
    }
  }
  return best;
}

/** Checks if a nearby wall is aligned for an airborne horizontal wall-run. */
function findWallRunFace(zone: Zone, x: number, y: number, z: number, vx: number, vy: number): { nx: number; ny: number; side: -1 | 1 } | null {
  const spd = Math.hypot(vx, vy);
  if (spd < 4.2) return null;
  const ux = vx / spd;
  const uy = vy / spd;
  for (const s of getSolids(zone)) {
    if (s.top < z + 1.8) continue;
    if (x < s.x - 0.85 || x > s.x + s.w + 0.85 || y < s.y - 0.85 || y > s.y + s.h + 0.85) continue;
    const faces: [number, number, number, number][] = [
      [s.x, 0, -1, 0],
      [s.x + s.w, 0, 1, 0],
      [0, s.y, 0, -1],
      [0, s.y + s.h, 0, 1],
    ];
    for (const [fx, fy, nx, ny] of faces) {
      const distFace = nx !== 0 ? (x - fx) * nx : (y - fy) * ny;
      if (distFace < 0.1 || distFace > 0.78) continue;
      // Moving roughly parallel to the wall (not head-on).
      const dotN = Math.abs(ux * nx + uy * ny);
      if (dotN > 0.58) continue;
      const tx = -ny;
      const ty = nx;
      const along = ux * tx + uy * ty;
      const side: -1 | 1 = along > 0 ? 1 : -1;
      return { nx, ny, side };
    }
  }
  return null;
}

export function hasParkourTargetAhead(g: Game): boolean {
  const p = g.player;
  const ax = g.moveInput();
  const dir = Math.hypot(ax.x, ax.y) > 0.2 ? Math.atan2(ax.y, ax.x) : p.facing;
  if (findVaultObstacle(g, dir)) return true;
  if (findGrabLedge(g.zone, p.x + Math.cos(dir) * 0.45, p.y + Math.sin(dir) * 0.45, p.z + 2.2, dir)) return true;
  return false;
}

function snapToHang(g: Game, h: HangLedge) {
  const p = g.player;
  const tx = -h.ny;
  const ty = h.nx;
  p.ledge = h;
  p.x = h.x + h.nx * 0.44 + tx * h.t;
  p.y = h.y + h.ny * 0.44 + ty * h.t;
  p.z = Math.max(0, h.z - 1.52);
  p.vx = p.vy = p.vz = 0;
  p.grounded = false;
  p.airT = 0;
  p.fallPeakVz = 0;
  p.crouch = false;
  p.blocking = false;
  p.facing = Math.atan2(-h.ny, -h.nx);
  p.act = { ...idleAct(), kind: "hang", dur: 999, dir: p.facing };
  sound.playSfx("ledgeGrab", { volume: 0.78 });
  g.burst({ k: "dust", x: p.x, y: p.y, z: p.z + 1.35, n: 3, dir: p.facing + Math.PI, r: 0.4 });
}

/** Triggers parkour jump, speed-vault, mantle climb, ledge-hop, wall-kick, or slide-leap. */
export function tryParkourJump(g: Game) {
  const p = g.player;
  if (p.hp <= 0) return;

  // Allow instant cancel out of prone get-up once standing motion starts.
  if (p.act.kind === "getup" && p.act.t > 0.14) {
    p.act = idleAct();
  }

  // Hanging on a wall ledge or rooftop lip:
  if (p.act.kind === "hang" && p.ledge) {
    const inp = g.moveInput();
    const cur = p.ledge;
    const away = inp.x * cur.nx + inp.y * cur.ny;
    // Holding back away from the wall + Jump -> Wall-Kick backflip off the wall.
    if (away > 0.45) {
      p.ledge = null;
      p.dropIgnoreT = 0.22;
      p.act = idleAct();
      p.facing = Math.atan2(cur.ny, cur.nx);
      p.vx = cur.nx * 6.4;
      p.vy = cur.ny * 6.4;
      p.vz = 7.6;
      p.grounded = false;
      sound.playSfx("jump", { volume: 0.8 });
      g.burst({ k: "dust", x: p.x, y: p.y, z: p.z, n: 5, dir: p.facing });
      return;
    }
    // At a top roof rim (not a mid-wall beam), Jump pulls smoothly up onto the roof (`mantle`).
    if (cur.isRoof && !cur.onBeam) {
      p.act = { ...idleAct(), kind: "mantle", dur: 0.38, dir: p.facing };
      p.vx = 0;
      p.vy = 0;
      p.vz = 0;
      return;
    }
    // Check if there is a higher handhold or roof rim above/diagonally on the wall.
    const hopTo = findHopLedge(g, inp.x, inp.y);
    if (hopTo) {
      const tx = -hopTo.ny;
      const ty = hopTo.nx;
      const destX = hopTo.x + hopTo.nx * 0.44 + tx * hopTo.t;
      const destY = hopTo.y + hopTo.ny * 0.44 + ty * hopTo.t;
      const destZ = Math.max(0, hopTo.z - 1.52);
      p.ledge = hopTo;
      p.act = {
        ...idleAct(),
        kind: "ledgehop",
        dur: 0.28,
        dir: p.facing,
      };
      p.vx = (destX - p.x) / 0.28;
      p.vy = (destY - p.y) / 0.28;
      p.vz = (destZ - p.z) / 0.28;
      return;
    }
    // Pull-up mantle onto a standable mid-wall beam if no higher hold/rim exists.
    if (cur.isRoof) {
      p.act = { ...idleAct(), kind: "mantle", dur: 0.38, dir: p.facing };
      p.vx = 0;
      p.vy = 0;
      p.vz = 0;
      return;
    }
    // Generic upper hop boost if no explicit higher hold was found.
    p.ledge = null;
    p.dropIgnoreT = 0.22;
    p.act = idleAct();
    p.vz = 8.4;
    p.vx = -cur.nx * 2.2;
    p.vy = -cur.ny * 2.2;
    return;
  }

  // Wall-run kick-off jump:
  if (p.act.kind === "wallrun") {
    const inp = g.moveInput();
    p.act = idleAct();
    p.vz = 8.6;
    p.vx = p.vx * 0.8 + p.wallNx * 5.2 + inp.x * 2.2;
    p.vy = p.vy * 0.8 + p.wallNy * 5.2 + inp.y * 2.2;
      p.wallSide = 0;
      p.facing = Math.atan2(p.vy, p.vx);
      sound.playSfx("jump", { volume: 0.82 });
      g.burst({ k: "dust", x: p.x, y: p.y, z: p.z, n: 6, dir: p.facing });
      return;
    }

  // Slide-to-Leap transition (frames 00:03 -> 00:04):
  if (p.act.kind === "slide") {
    const dir = p.act.dir;
    p.act = idleAct();
    p.crouch = false;
    p.grounded = false;
    p.coyoteT = 0;
    p.vz = SPRINT_JUMP_VZ;
    p.vx = Math.cos(dir) * 9.8;
    p.vy = Math.sin(dir) * 9.8;
    p.facing = dir;
    sound.playSfx("jump", { volume: 0.86 });
    g.burst({ k: "slide", x: p.x, y: p.y, z: p.z, n: 8, dir: dir + Math.PI, r: 0.7 });
    return;
  }

  if (p.act.kind !== "idle" && p.act.kind !== "parkour_roll") return;

  const ax = g.moveInput();
  const mag = Math.hypot(ax.x, ax.y);
  const dir = mag > 0.2 ? Math.atan2(ax.y, ax.x) : p.facing;

  // Airborne jump press scans for a ledge grab immediately.
  if (!p.grounded && p.coyoteT <= 0) {
    const grab = findGrabLedge(g.zone, p.x, p.y, p.z + 1.65, dir, false);
    if (grab) snapToHang(g, grab);
    return;
  }

  // Check for single-hand Speed Vault over a low/medium obstacle directly ahead.
  const vaultObs = findVaultObstacle(g, dir);
  if (vaultObs && mag > 0.15) {
    p.act = { ...idleAct(), kind: "vault", dur: 0.34, dir };
    p.crouch = false;
    p.blocking = false;
    p.facing = dir;
    p.grounded = false;
    p.coyoteT = 0;
    const speed = Math.max(7.2, Math.hypot(p.vx, p.vy));
    p.vx = Math.cos(dir) * speed;
    p.vy = Math.sin(dir) * speed;
    // Target peak apex slightly above obstacle top.
    p.vz = (vaultObs.top + 0.35 - p.z) * 3.8;
    sound.playSfx("jump", { volume: 0.82 });
    g.burst({ k: "dust", x: p.x, y: p.y, z: p.z, n: 5, dir: dir + Math.PI });
    g.burst({ k: "ripple", x: p.x, y: p.y, z: p.z, n: 4, dir: dir + Math.PI, r: 0.85 });
    return;
  }

  // Standard or sprint long-jump.
  p.act = idleAct();
  p.crouch = false;
  p.blocking = false;
  p.grounded = false;
  p.coyoteT = 0;
  p.landT = 0;
  const sprinting = g.input.sprinting() || Math.hypot(p.vx, p.vy) > 6.5;
  p.vz = sprinting ? SPRINT_JUMP_VZ : JUMP_VZ;
  if (mag > 0.2) {
    const boost = sprinting ? Math.max(8.8, Math.hypot(p.vx, p.vy) + 1.1) : Math.max(5.8, Math.hypot(p.vx, p.vy));
    p.vx = Math.cos(dir) * boost;
    p.vy = Math.sin(dir) * boost;
    p.facing = dir;
  }
  sound.playSfx("jump", { volume: 0.75 });
  g.burst({ k: "dust", x: p.x, y: p.y, z: p.z, n: 5, dir: p.facing + Math.PI });
}

/** Handles Crouch (idle), Baseball Power-Slide (while sprinting), or Drop-Down Edge Catch. */
export function trySlideOrDrop(g: Game) {
  const p = g.player;
  if (p.hp <= 0) return;

  if (p.act.kind === "getup" && p.act.t > 0.14) p.act = idleAct();

  // Release current wall ledge and drop down (auto-catches lower holds below, frames 00:11 -> 00:12).
  if (p.act.kind === "hang" && p.ledge) {
    p.ledge = null;
    p.dropIgnoreT = 0.22;
    p.vz = -1.6;
    p.act = idleAct();
    return;
  }

  if (p.act.kind !== "idle") return;

  // At a rooftop drop edge (`z > 1.25`), pressing C/Ctrl performs a clean edge Drop-Down & Catch (`00:11`).
  if (p.grounded && p.z > 1.25) {
    const ax = g.moveInput();
    const dir = Math.hypot(ax.x, ax.y) > 0.2 ? Math.atan2(ax.y, ax.x) : p.facing;
    const fx = Math.cos(dir);
    const fy = Math.sin(dir);
    const aheadZ = groundHeightAt(g.zone, p.x + fx * 0.9, p.y + fy * 0.9, p.z);
    if (aheadZ < p.z - 1.1) {
      const lip = findGrabLedge(g.zone, p.x + fx * 0.65, p.y + fy * 0.65, p.z, dir + Math.PI, false);
      if (lip) {
        snapToHang(g, lip);
        return;
      }
    }
  }

  // High-speed Baseball/Parkour Slide (frames 00:02 -> 00:03).
  const speed = Math.hypot(p.vx, p.vy);
  if (p.grounded && (speed > 5.5 || (g.input.sprinting() && speed > 3.2))) {
    const ax = g.moveInput();
    const dir = Math.hypot(ax.x, ax.y) > 0.2 ? Math.atan2(ax.y, ax.x) : Math.atan2(p.vy, p.vx);
    p.facing = dir;
    p.crouch = false;
    p.blocking = false;
    p.vx = Math.cos(dir) * 11.4;
    p.vy = Math.sin(dir) * 11.4;
    p.act = { ...idleAct(), kind: "slide", dur: 0.56, dir };
    sound.playSfx(g.zone.env.precip === "rain" ? "slideWet" : "slideDry", { volume: 0.88 });
    g.burst({ k: "slide", x: p.x, y: p.y, z: p.z, n: 14, dir: dir + Math.PI, r: 1 });
    return;
  }

  p.crouch = !p.crouch;
}

/** Updates active parkour actions (`getup`, `slide`, `vault`, `wallrun`, `hang`, `mantle`, `ledgehop`, `parkour_roll`) and vertical gravity/landing. */
export function updateParkourAct(g: Game, dt: number): boolean | null {
  const p = g.player;
  const a = p.act;

  if (p.landT > 0) p.landT = Math.max(0, p.landT - dt);
  if (p.dropIgnoreT > 0) p.dropIgnoreT = Math.max(0, p.dropIgnoreT - dt);

  switch (a.kind) {
    case "getup": {
      const want = g.moveInput();
      if (a.t > 0.16 && (Math.hypot(want.x, want.y) > 0.35 || g.input.guarding())) {
        p.act = idleAct();
        return true;
      }
      if (a.t >= a.dur) {
        p.act = idleAct();
        return true;
      }
      return false;
    }

    case "slide": {
      const k = clamp(a.t / a.dur, 0, 1);
      const decay = Math.max(0.28, 1 - k * 0.72);
      const sp = 11.4 * decay;
      const beforeX = p.x;
      const beforeY = p.y;
      moveBody3D(g, p, Math.cos(a.dir) * sp * dt, Math.sin(a.dir) * sp * dt, PLAYER_R, p.z);
      p.speed = Math.hypot(p.x - beforeX, p.y - beforeY) / Math.max(1e-4, dt);
      p.walk += p.speed * dt * 0.15;
      const wakeStep = Math.floor(a.t / 0.065);
      if (wakeStep > a.landed && k < 0.85) {
        a.landed = wakeStep;
        g.burst({
          k: "slide",
          x: p.x - Math.cos(a.dir) * 0.24,
          y: p.y - Math.sin(a.dir) * 0.24,
          z: p.z,
          n: 6,
          dir: a.dir + Math.PI,
          r: 0.55,
        });
      }
      // Step off ledge mid-slide transitions into airborne fall.
      const sup = groundHeightAt(g.zone, p.x, p.y, p.z);
      if (sup < p.z - 0.35) {
        p.grounded = false;
        p.act = idleAct();
        p.vx = Math.cos(a.dir) * sp;
        p.vy = Math.sin(a.dir) * sp;
        return true;
      }
      p.z = sup;
      if (a.t >= a.dur) {
        p.act = idleAct();
        p.vx = Math.cos(a.dir) * sp * 0.7;
        p.vy = Math.sin(a.dir) * sp * 0.7;
        return true;
      }
      return false;
    }

    case "vault": {
      const sp = Math.max(6.8, Math.hypot(p.vx, p.vy));
      // Horizontal travel smoothly carries over obstacles without getting snagged on low solid top.
      const z = g.zone;
      const edge = 1.6 + PLAYER_R;
      const step = sp * dt;
      p.x = clamp(p.x + Math.cos(a.dir) * step, edge, z.w - edge);
      p.y = clamp(p.y + Math.sin(a.dir) * step, edge, z.h - edge);
      // Wait: ensure we never vault straight into a tall building wall!
      moveBody3D(g, p, 0, 0, PLAYER_R, p.z + 1.65);
      p.vz -= GRAVITY * 0.72 * dt;
      p.z = Math.max(0, p.z + p.vz * dt);
      const sup = groundHeightAt(z, p.x, p.y, p.z);
      if (p.z <= sup && p.vz < 0) {
        p.z = sup;
        p.vz = 0;
        p.grounded = true;
      }
      p.speed = sp;
      if (a.t >= a.dur) {
        p.act = idleAct();
        p.z = Math.max(p.z, groundHeightAt(z, p.x, p.y, p.z));
        return true;
      }
      return false;
    }

    case "wallrun": {
      const sp = 7.4;
      const beforeX = p.x;
      const beforeY = p.y;
      moveBody3D(g, p, (p.vx * 0.92) * dt, (p.vy * 0.92) * dt, PLAYER_R, p.z);
      p.speed = Math.hypot(p.x - beforeX, p.y - beforeY) / Math.max(1e-4, dt);
      p.walk += p.speed * dt;
      const wallStep = Math.floor(a.t / 0.14);
      if (wallStep > a.landed) {
        a.landed = wallStep;
        g.burst({ k: "spark", x: p.x - p.wallNx * 0.22, y: p.y - p.wallNy * 0.22, z: p.z - 0.5, n: 2, dir: a.dir + Math.PI, color: 0xaad4ff });
      }
      p.vz = Math.max(-2.2, p.vz - GRAVITY * 0.35 * dt);
      p.z += p.vz * dt;
      const wallStillHere = findWallRunFace(g.zone, p.x, p.y, p.z, p.vx, p.vy);
      const sup = groundHeightAt(g.zone, p.x, p.y, p.z);
      if (p.z <= sup) {
        p.z = sup;
        p.vz = 0;
        p.grounded = true;
        p.wallSide = 0;
        p.act = idleAct();
        return true;
      }
      // Check for automatic ledge grab at end/top of a wall-run.
      const grab = findGrabLedge(g.zone, p.x, p.y, p.z + 1.55, p.facing, false);
      if (grab) {
        p.wallSide = 0;
        snapToHang(g, grab);
        return false;
      }
      if (!wallStillHere || a.t >= a.dur || p.speed < sp * 0.25) {
        p.wallSide = 0;
        p.act = idleAct();
        return true;
      }
      return false;
    }

    case "hang": {
      const h = p.ledge;
      if (!h) {
        p.act = idleAct();
        return true;
      }
      const inp = g.moveInput();
      const tx = -h.ny;
      const ty = h.nx;
      const lat = inp.x * tx + inp.y * ty;
      const intoWall = inp.x * -h.nx + inp.y * -h.ny;
      if (Math.abs(lat) > 0.15) {
        const dtShimmy = lat * 2.75 * dt;
        const nextT = clamp(h.t + dtShimmy, h.minT, h.maxT);
        p.walk += Math.abs(nextT - h.t) * 1.4;
        h.t = nextT;
        p.x = h.x + h.nx * 0.44 + tx * h.t;
        p.y = h.y + h.ny * 0.44 + ty * h.t;
        p.speed = 2.75 * Math.abs(lat);
      } else {
        p.speed = 0;
      }
      p.facing = Math.atan2(-h.ny, -h.nx);
      p.z = Math.max(0, h.z - 1.52);

      // Holding W / forward onto a rooftop lip automatically triggers a smooth Mantle (`00:09 -> 00:10`).
      if (intoWall > 0.72 && a.t > 0.16 && h.isRoof) {
        p.act = { ...idleAct(), kind: "mantle", dur: 0.36, dir: p.facing };
      }
      return false;
    }

    case "mantle": {
      const h = p.ledge;
      if (!h) {
        p.act = idleAct();
        return true;
      }
      const k = clamp(a.t / a.dur, 0, 1);
      const ease = k * k * (3 - 2 * k);
      const tx = -h.ny;
      const ty = h.nx;
      const startX = h.x + h.nx * 0.44 + tx * h.t;
      const startY = h.y + h.ny * 0.44 + ty * h.t;
      const startZ = Math.max(0, h.z - 1.52);
      const endX = h.x - h.nx * 0.56 + tx * h.t;
      const endY = h.y - h.ny * 0.56 + ty * h.t;
      p.x = startX + (endX - startX) * ease;
      p.y = startY + (endY - startY) * ease;
      p.z = startZ + (h.topZ - startZ) * ease;
      p.facing = Math.atan2(-h.ny, -h.nx);
      p.speed = 0;
      if (a.t >= a.dur) {
        p.ledge = null;
        p.z = h.topZ;
        p.vz = 0;
        p.grounded = true;
        p.landT = 0.22;
        p.landDur = 0.22;
        p.landHeavy = false;
        p.act = idleAct();
        g.burst({ k: "dust", x: p.x, y: p.y, z: p.z, n: 4, dir: p.facing });
        return true;
      }
      return false;
    }

    case "ledgehop": {
      const h = p.ledge;
      if (!h) {
        p.act = idleAct();
        return true;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.speed = Math.hypot(p.vx, p.vy);
      if (a.t >= a.dur) {
        snapToHang(g, h);
        return false;
      }
      return false;
    }

    case "parkour_roll": {
      const sp = 7.4;
      const beforeX = p.x;
      const beforeY = p.y;
      moveBody3D(g, p, Math.cos(a.dir) * sp * dt, Math.sin(a.dir) * sp * dt, PLAYER_R, p.z);
      p.speed = Math.hypot(p.x - beforeX, p.y - beforeY) / Math.max(1e-4, dt);
      p.z = groundHeightAt(g.zone, p.x, p.y, p.z);
      if (a.t >= a.dur) {
        p.act = idleAct();
        return true;
      }
      return false;
    }

    default:
      return null;
  }
}

/** Applies vertical gravity, airborne wall-run / ledge auto-catch, and landing impact crouch/roll during free idle/move frames. */
export function updateVerticalPhysics(g: Game, dt: number, wantMove: Vec) {
  const p = g.player;
  if (p.act.kind === "hang" || p.act.kind === "mantle" || p.act.kind === "ledgehop" || p.act.kind === "vault" || p.act.kind === "wallrun" || p.act.kind === "getup") {
    return;
  }

  const prevZ = p.z;
  const supBefore = groundHeightAt(g.zone, p.x, p.y, p.z);

  if (p.grounded && p.vz <= 0) {
    if (supBefore >= p.z - 0.35) {
      p.z = supBefore;
      p.coyoteT = 0.14;
      p.airT = 0;
      p.fallPeakVz = 0;
      return;
    }
    // Just stepped off a ledge / roof!
    p.grounded = false;
    p.vz = 0;
    p.airT = 0;
    p.fallPeakVz = 0;
  }

  if (p.coyoteT > 0) p.coyoteT = Math.max(0, p.coyoteT - dt);

  if (!p.grounded) {
    p.airT += dt;
    p.vz -= GRAVITY * dt;
    p.fallPeakVz = Math.min(p.fallPeakVz, p.vz);
    p.z += p.vz * dt;

    // Auto-catch ledges & rooftop rims while airborne (unless intentionally dropping down).
    if (p.dropIgnoreT <= 0 && p.vz < 4.5 && p.act.kind === "idle" && p.hp > 0) {
      const grab = findGrabLedge(g.zone, p.x, p.y, p.z + 1.55, p.facing, true);
      if (grab && (p.vz < 1.2 || p.airT > 0.1)) {
        snapToHang(g, grab);
        return;
      }
    }

    // Trigger wall-run when airborne at sprint speed parallel to a tall wall face.
    if (p.act.kind === "idle" && p.z > 0.3 && p.vz > -4.8 && p.airT > 0.08 && p.hp > 0) {
      const wr = findWallRunFace(g.zone, p.x, p.y, p.z, p.vx, p.vy);
      if (wr && Math.hypot(wantMove.x, wantMove.y) > 0.35) {
        p.wallSide = wr.side;
        p.wallNx = wr.nx;
        p.wallNy = wr.ny;
        p.vz = Math.max(p.vz, 1.8);
        p.act = { ...idleAct(), kind: "wallrun", dur: 0.65, dir: Math.atan2(p.vy, p.vx) };
        return;
      }
    }

    const sup = groundHeightAt(g.zone, p.x, p.y, Math.max(prevZ, p.z));
    if (p.z <= sup && p.vz <= 0) {
      p.z = sup;
      const impact = -p.fallPeakVz;
      p.vz = 0;
      p.grounded = true;
      p.airT = 0;
      p.fallPeakVz = 0;
      if (p.hp > 0 && impact > 9.4 && Math.hypot(wantMove.x, wantMove.y) > 0.25) {
        const dir = Math.atan2(wantMove.y, wantMove.x);
        p.facing = dir;
        p.act = { ...idleAct(), kind: "parkour_roll", dur: 0.44, dir };
        sound.playSfx("landHeavy", { volume: 0.85 });
        g.burst({ k: "dust", x: p.x, y: p.y, z: p.z, n: 10, dir: dir + Math.PI });
        g.burst({ k: "ripple", x: p.x, y: p.y, z: p.z, n: 6, dir, r: 1.2 });
        g.burst({ k: "ring", x: p.x, y: p.y, z: p.z, n: 1, dir, r: 1.65, color: 0x9ad4ff });
      } else if (impact > 3.6) {
        p.landT = clamp((impact - 3.2) * 0.044, 0.16, 0.34);
        p.landDur = p.landT;
        p.landHeavy = impact > 6.8;
        g.burst({ k: "dust", x: p.x, y: p.y, z: p.z, n: p.landHeavy ? 8 : 4, dir: p.facing });
        if (p.landHeavy) {
          sound.playSfx("landHeavy", { volume: 0.78 });
          g.burst({ k: "ripple", x: p.x, y: p.y, z: p.z, n: 6, dir: p.facing, r: 1.35 });
          g.shake(0.08);
        }
      }
    }
  }
}
