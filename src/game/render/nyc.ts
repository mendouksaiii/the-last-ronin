import * as THREE from "three";
import type { Building, Prop, Zone } from "../engine/state";
import { frontOf, mulberry, type BuildingStyle } from "../engine/world";
import type { LightSource } from "./city";
import { FACADE_H, FACADE_W, skylineTexture } from "./textures";

// New York architecture layered onto the city blocks: brownstone stoops, cast-iron fire escapes
// zig-zagging up walk-ups, storefronts under canvas awnings, cedar water towers on the roofs,
// art-deco towers stepping back to lit crowns and spires, glass towers, subway entrances with
// their green globes, fire hydrants, and a far skyline standing in the haze.

type Keep = <T extends { dispose: () => void }>(x: T) => T;

/** Box with facade UVs that repeat per metre, so windows keep their size on every building. */
export function facadeBox(w: number, h: number, d: number, seed: number) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const ou = (seed % 97) / 97;
  for (let face = 0; face < 6; face++) {
    const span = face < 2 ? d : w;
    for (let i = 0; i < 4; i++) {
      const idx = face * 4 + i;
      if (face === 2 || face === 3) {
        uv.setXY(idx, uv.getX(idx) * 0.05, uv.getY(idx) * 0.05);
        continue;
      }
      uv.setXY(idx, ou + (uv.getX(idx) * span) / FACADE_W, (uv.getY(idx) * h) / FACADE_H);
    }
  }
  uv.needsUpdate = true;
  return g;
}

/** Many copies of one shape drawn as a single instanced mesh. */
class Batch {
  private list: THREE.Matrix4[] = [];
  private colors: (THREE.Color | null)[] = [];
  constructor(
    private geo: THREE.BufferGeometry,
    private mat: THREE.Material,
    private shadows = true,
  ) {}
  add(m: THREE.Matrix4, color?: number) {
    this.list.push(m);
    this.colors.push(color === undefined ? null : new THREE.Color(color));
  }
  build(group: THREE.Group, keep: Keep) {
    if (!this.list.length) return;
    const inst = new THREE.InstancedMesh(keep(this.geo), keep(this.mat), this.list.length);
    this.list.forEach((m, i) => inst.setMatrixAt(i, m));
    if (this.colors.some((c) => c)) this.colors.forEach((c, i) => inst.setColorAt(i, c ?? new THREE.Color(1, 1, 1)));
    inst.castShadow = this.shadows;
    inst.receiveShadow = true;
    group.add(inst);
  }
}

/** A frame on a wall or prop: u runs along the face, v up, w out from it. */
interface Frame {
  o: THREE.Vector3;
  yaw: number;
  len: number;
}

const dummy = new THREE.Object3D();
function at(f: Frame, u: number, v: number, w: number, sx: number, sy: number, sz: number, tilt = 0, roll = 0) {
  const c = Math.cos(f.yaw);
  const s = Math.sin(f.yaw);
  dummy.position.set(f.o.x + c * u + s * w, f.o.y + v, f.o.z - s * u + c * w);
  dummy.rotation.set(tilt, f.yaw, roll, "YXZ");
  dummy.scale.set(sx, sy, sz);
  dummy.updateMatrix();
  return dummy.matrix.clone();
}

/** One side of a building: 0 north, 1 south, 2 west, 3 east. */
function face(b: Building, side: number): Frame {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  switch (side) {
    case 0:
      return { o: new THREE.Vector3(cx, 0, b.y), yaw: Math.PI, len: b.w };
    case 1:
      return { o: new THREE.Vector3(cx, 0, b.y + b.h), yaw: 0, len: b.w };
    case 2:
      return { o: new THREE.Vector3(b.x, 0, cy), yaw: -Math.PI / 2, len: b.h };
    default:
      return { o: new THREE.Vector3(b.x + b.w, 0, cy), yaw: Math.PI / 2, len: b.h };
  }
}

const propFrame = (p: Prop): Frame => ({ o: new THREE.Vector3(p.x, 0, p.y), yaw: p.rot, len: 0 });

const AWNINGS = [0x5a1418, 0x1e3a2a, 0x1c2438, 0x141416, 0x6a3a12, 0x3a1a2a];

export interface TowerMats {
  limestone: THREE.Material[];
  glass: THREE.Material[];
  stone: THREE.Material;
}

export class Architect {
  private box = new THREE.BoxGeometry(1, 1, 1);
  private iron: Batch;
  private ironGreen: Batch;
  private awning: Batch;
  private shopDark: Batch;
  private shopLit: Batch;
  private stone: Batch;
  private brown: Batch;
  private door: Batch;
  private wood: Batch;
  private roofCone: Batch;
  private crownGold: Batch;
  private crownCool: Batch;
  private steel: Batch;
  private globe: Batch;
  private hole: Batch;
  private red: Batch;
  private taxiLamp: Batch;
  private signGreen: Batch;

  constructor(
    private group: THREE.Group,
    private keep: Keep,
    private lights: LightSource[],
    det: { fabric: THREE.Texture; concrete: THREE.Texture; leather: THREE.Texture },
    stoneMat: THREE.Material,
  ) {
    const tiled = (t: THREE.Texture, k: number) => {
      const c = t.clone();
      c.repeat.set(k, k);
      c.needsUpdate = true;
      return keep(c);
    };
    const B = () => this.box.clone();
    this.iron = new Batch(B(), new THREE.MeshStandardMaterial({ color: 0x1a1b1d, metalness: 0.8, roughness: 0.55 }));
    this.ironGreen = new Batch(B(), new THREE.MeshStandardMaterial({ color: 0x24402e, metalness: 0.6, roughness: 0.5 }));
    this.awning = new Batch(B(), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, normalMap: tiled(det.fabric, 2) }));
    this.shopDark = new Batch(B(), new THREE.MeshPhysicalMaterial({ color: 0x0c0f12, roughness: 0.08, metalness: 0.2, clearcoat: 1, envMapIntensity: 1.6 }), false);
    this.shopLit = new Batch(B(), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb070).multiplyScalar(1.3), toneMapped: false }), false);
    this.stone = new Batch(B(), stoneMat);
    this.brown = new Batch(B(), new THREE.MeshStandardMaterial({ color: 0x5e3e30, roughness: 0.85, normalMap: tiled(det.concrete, 1) }));
    this.door = new Batch(B(), new THREE.MeshPhysicalMaterial({ color: 0x2a1a12, roughness: 0.4, clearcoat: 0.6 }), false);
    this.wood = new Batch(new THREE.CylinderGeometry(1, 1, 1, 20, 1), new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.9, normalMap: tiled(det.fabric, 3) }));
    this.roofCone = new Batch(new THREE.ConeGeometry(1, 1, 20), new THREE.MeshStandardMaterial({ color: 0x3a3028, roughness: 0.8, metalness: 0.3 }));
    this.crownGold = new Batch(B(), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc070).multiplyScalar(1.6), toneMapped: false }), false);
    this.crownCool = new Batch(B(), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xbcd4ff).multiplyScalar(1.4), toneMapped: false }), false);
    this.steel = new Batch(new THREE.ConeGeometry(1, 1, 8), new THREE.MeshStandardMaterial({ color: 0xb8bcc0, metalness: 1, roughness: 0.25 }));
    this.globe = new Batch(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x40ff80).multiplyScalar(1.5), toneMapped: false }), false);
    this.hole = new Batch(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x030303 }), false);
    this.red = new Batch(new THREE.CylinderGeometry(1, 1, 1, 14), new THREE.MeshStandardMaterial({ color: 0x8a1a14, roughness: 0.45, metalness: 0.4 }));
    this.taxiLamp = new Batch(B(), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff0c0).multiplyScalar(1.4), toneMapped: false }), false);
    this.signGreen = new Batch(B(), new THREE.MeshStandardMaterial({ color: 0x0e5a32, roughness: 0.5, metalness: 0.3 }), false);
  }

  /** A walk-up's front: a shop at street level under an awning, and a fire escape climbing the floors above. */
  walkup(b: Building, h: number) {
    const r = mulberry(b.seed + 11);
    const f = face(b, frontOf(b));
    // Storefronts.
    const shops = f.len > 9 ? 2 : 1;
    const sw = (f.len - 1.2) / shops;
    for (let i = 0; i < shops; i++) {
      const u = -f.len / 2 + 0.6 + sw * (i + 0.5);
      const lit = r() < 0.35;
      (lit ? this.shopLit : this.shopDark).add(at(f, u, 1.45, 0.03, sw - 0.6, 2.5, 0.08));
      // Piers between the windows.
      this.stone.add(at(f, u - sw / 2, 1.7, 0.08, 0.35, 3.4, 0.2));
      if (r() < 0.75) {
        const c = AWNINGS[Math.floor(r() * AWNINGS.length)];
        this.awning.add(at(f, u, 3.1, 0.66, sw - 0.5, 0.05, 1.4, 0.35), c);
        this.awning.add(at(f, u, 2.66, 1.33, sw - 0.5, 0.3, 0.03), c);
      }
      if (lit) {
        const p = at(f, u, 2.2, 1.6, 1, 1, 1);
        this.lights.push({ pos: new THREE.Vector3().setFromMatrixPosition(p), color: 0xffa860, intensity: 16, distance: 10, flicker: r() < 0.2 ? 2 : 0, seed: b.seed + i });
      }
    }
    this.stone.add(at(f, f.len / 2 - 0.2, 1.7, 0.08, 0.35, 3.4, 0.2));
    this.stone.add(at(f, 0, 3.55, 0.12, f.len, 0.35, 0.3));
    if (h < 11) return;
    // Fire escape: platforms on every floor, railings, and stairs zig-zagging between them.
    const fw = Math.min(4.2, f.len * 0.5);
    const u0 = (r() - 0.5) * Math.max(0, f.len - fw - 1.5);
    const posts = Math.round(fw / 0.42);
    let dir = 1;
    for (let v = 4.6; v < h - 2.4; v += 3.5) {
      this.iron.add(at(f, u0, v, 0.55, fw, 0.05, 1.05));
      for (const y of [0.95, 0.5]) {
        this.iron.add(at(f, u0, v + y, 1.07, fw, 0.035, 0.035));
        for (const s of [-1, 1]) this.iron.add(at(f, u0 + (s * fw) / 2, v + y, 0.55, 0.035, 0.035, 1.05));
      }
      for (let k = 0; k <= posts; k++) this.iron.add(at(f, u0 - fw / 2 + (k * fw) / posts, v + 0.48, 1.07, 0.022, 0.95, 0.022));
      if (v + 3.5 < h - 2.4) {
        const run = fw - 1.1;
        const len = Math.hypot(3.5, run);
        const ang = Math.atan2(3.5, run) * dir;
        this.iron.add(at(f, u0, v + 1.78, 0.32, len, 0.05, 0.55, 0, ang));
        this.iron.add(at(f, u0, v + 2.6, 0.06, len, 0.03, 0.03, 0, ang));
        dir = -dir;
      } else {
        // A ladder up to the roof.
        for (const s of [-0.2, 0.2]) this.iron.add(at(f, u0 + fw / 2 - 0.5 + s, v + 1.8, 0.85, 0.03, 3.6, 0.03));
      }
    }
    // The drop ladder hanging over the sidewalk.
    for (const s of [-0.22, 0.22]) this.iron.add(at(f, u0 + fw / 2 - 0.45 + s, 3.4, 0.95, 0.03, 2.4, 0.03));
    for (let k = 0; k < 6; k++) this.iron.add(at(f, u0 + fw / 2 - 0.45, 2.4 + k * 0.38, 0.95, 0.44, 0.025, 0.025));
  }

  /** A cedar water tank on a steel frame, the skyline's signature. */
  waterTower(x: number, z: number, roof: number, size = 1) {
    const legH = 2.2 * size;
    for (const [lx, lz] of [[0.95, 0.95], [-0.95, 0.95], [0.95, -0.95], [-0.95, -0.95]]) {
      dummy.position.set(x + lx * size, roof + legH / 2, z + lz * size);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(0.16, legH, 0.16);
      dummy.updateMatrix();
      this.iron.add(dummy.matrix.clone());
    }
    const put = (batch: Batch, y: number, r: number, hgt: number) => {
      dummy.position.set(x, roof + y, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(r, hgt, r);
      dummy.updateMatrix();
      batch.add(dummy.matrix.clone());
    };
    put(this.iron, legH + 0.05, 1.5 * size, 0.1);
    put(this.wood, legH + 1.55 * size, 1.35 * size, 3 * size);
    put(this.iron, legH + 0.6 * size, 1.37 * size, 0.07);
    put(this.iron, legH + 2.4 * size, 1.37 * size, 0.07);
    put(this.roofCone, legH + 3.6 * size, 1.48 * size, 1.1 * size);
  }

  /**
   * A tower: art deco stepping back in tiers to a lit crown and steel spire, or glass rising
   * clean to a lit rim and mast. Returns the tier meshes.
   */
  tower(b: Building, h: number, style: BuildingStyle, mats: TowerMats, detail: boolean) {
    const deco = style === "deco";
    const tiers: [number, number, number][] = deco
      ? [[0, 0.48, 1], [0.48, 0.7, 0.8], [0.7, 0.86, 0.62], [0.86, 1, 0.44]]
      : b.seed % 2
        ? [[0, 0.7, 1], [0.7, 1, 0.8]]
        : [[0, 1, 1]];
    const cx = b.x + b.w / 2;
    const cz = b.y + b.h / 2;
    let top = { w: b.w, d: b.h, y: h };
    tiers.forEach(([a, z, k], i) => {
      const w = b.w * k;
      const d = b.h * k;
      const y0 = h * a;
      const y1 = h * z;
      const m = new THREE.Mesh(this.keep(facadeBox(w, y1 - y0, d, b.seed + i * 7)), deco ? mats.limestone : mats.glass);
      m.position.set(cx, (y0 + y1) / 2, cz);
      m.castShadow = true;
      m.receiveShadow = true;
      this.group.add(m);
      // A stone ledge marks each setback.
      dummy.position.set(cx, y1 - 0.2, cz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(w + (deco ? 0.7 : 0.25), deco ? 0.5 : 0.3, d + (deco ? 0.7 : 0.25));
      dummy.updateMatrix();
      (deco ? this.stone : this.iron).add(dummy.matrix.clone());
      top = { w, d, y: y1 };
    });
    const ring = (batch: Batch, y: number, grow: number, hgt: number) => {
      dummy.position.set(cx, y, cz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(top.w + grow, hgt, top.d + grow);
      dummy.updateMatrix();
      batch.add(dummy.matrix.clone());
    };
    if (deco) {
      // Floodlit bands round the crown and a stainless spire.
      ring(this.crownGold, top.y - 1.4, 0.12, 0.4);
      ring(this.crownGold, top.y - 4.6, 0.12, 0.3);
      const sr = Math.min(top.w, top.d) * 0.28;
      const sh = h * 0.16;
      dummy.position.set(cx, top.y + sh / 2, cz);
      dummy.scale.set(sr, sh, sr);
      dummy.updateMatrix();
      this.steel.add(dummy.matrix.clone());
      dummy.position.set(cx, top.y + 0.6, cz);
      dummy.scale.set(top.w * 0.7, 1.2, top.d * 0.7);
      dummy.updateMatrix();
      this.stone.add(dummy.matrix.clone());
    } else {
      ring(this.crownCool, top.y + 0.1, 0.3, 0.22);
      dummy.position.set(cx, top.y + 5, cz);
      dummy.scale.set(0.12, 10, 0.12);
      dummy.updateMatrix();
      this.iron.add(dummy.matrix.clone());
    }
    // A lobby at street level.
    if (detail) {
      const f = face(b, frontOf(b));
      this.shopLit.add(at(f, 0, 1.8, 0.04, Math.min(6, f.len * 0.5), 3.2, 0.08));
      this.stone.add(at(f, 0, 3.7, 0.5, Math.min(7, f.len * 0.6), 0.25, 1.2));
    }
  }

  /** Brownstone stoop: stone steps up to the parlour door between sloping balustrades. */
  stoop(p: Prop) {
    const f = propFrame(p);
    for (let k = 0; k < 7; k++) {
      const top = 0.22 * (k + 1);
      this.brown.add(at(f, 0, top / 2, 1.05 - 0.3 * k - 0.15, 1.6, top, 0.3));
    }
    for (const s of [-1, 1]) {
      this.brown.add(at(f, s * 0.86, 1.05, -0.05, 0.16, 0.42, 2.45, 0.62));
      this.brown.add(at(f, s * 0.86, 0.5, 1.0, 0.24, 1.0, 0.24));
    }
    this.door.add(at(f, 0, 1.54 + 1.25, -1.0, 1.15, 2.5, 0.1));
    this.brown.add(at(f, 0, 1.54 + 2.65, -0.95, 1.6, 0.3, 0.25));
    const lamp = at(f, 0.75, 3.4, -0.85, 1, 1, 1);
    this.lights.push({ pos: new THREE.Vector3().setFromMatrixPosition(lamp), color: 0xffb070, intensity: 8, distance: 7, flicker: 0, seed: p.seed });
    this.taxiLamp.add(at(f, 0.75, 3.4, -0.9, 0.14, 0.22, 0.14));
  }

  /** A subway stairway: green railings round a dark opening, globes on posts at the mouth. */
  subway(p: Prop) {
    const f = propFrame(p);
    this.hole.add(at(f, 0, 0.015, 0, 3.4, 1.5, 1, -Math.PI / 2));
    for (const s of [-1, 1]) {
      this.ironGreen.add(at(f, 0, 1.0, s * 0.85, 3.6, 0.05, 0.05));
      this.ironGreen.add(at(f, 0, 0.5, s * 0.85, 3.6, 0.04, 0.04));
      for (let k = 0; k <= 8; k++) this.ironGreen.add(at(f, -1.8 + k * 0.45, 0.5, s * 0.85, 0.04, 1.0, 0.04));
      // Lamp posts with green globes at the open end.
      this.ironGreen.add(at(f, 1.8, 1.2, s * 0.85, 0.08, 2.4, 0.08));
      this.globe.add(at(f, 1.8, 2.5, s * 0.85, 0.18, 0.18, 0.18));
    }
    this.ironGreen.add(at(f, -1.8, 1.0, 0, 0.05, 0.05, 1.7));
    this.ironGreen.add(at(f, -1.8, 0.5, 0, 0.04, 0.04, 1.7));
    const g = at(f, 1.8, 2.5, 0, 1, 1, 1);
    this.lights.push({ pos: new THREE.Vector3().setFromMatrixPosition(g), color: 0x40ff80, intensity: 10, distance: 9, flicker: 0, seed: p.seed });
  }

  hydrant(p: Prop) {
    const put = (y: number, r: number, hgt: number, rx = 0, rz = 0, ox = 0) => {
      dummy.position.set(p.x + ox * Math.cos(p.rot), y, p.y + ox * Math.sin(p.rot));
      dummy.rotation.set(rx, -p.rot, rz);
      dummy.scale.set(r, hgt, r);
      dummy.updateMatrix();
      this.red.add(dummy.matrix.clone());
    };
    put(0.05, 0.16, 0.1);
    put(0.36, 0.12, 0.56);
    put(0.68, 0.1, 0.1);
    put(0.75, 0.04, 0.1);
    put(0.45, 0.05, 0.3, 0, Math.PI / 2);
  }

  /** A yellow cab's roof light. */
  taxi(x: number, z: number, rot: number) {
    dummy.position.set(x, 1.68, z);
    dummy.rotation.set(0, -rot, 0);
    dummy.scale.set(0.3, 0.16, 0.7);
    dummy.updateMatrix();
    this.taxiLamp.add(dummy.matrix.clone());
  }

  /** Green street-name blades crossed on a lamp post. */
  streetSign(x: number, z: number) {
    for (const r of [0, Math.PI / 2]) {
      dummy.position.set(x, 4.4, z);
      dummy.rotation.set(0, r, 0);
      dummy.scale.set(1.3, 0.24, 0.03);
      dummy.updateMatrix();
      this.signGreen.add(dummy.matrix.clone());
    }
  }

  finish() {
    for (const b of [this.iron, this.ironGreen, this.awning, this.shopDark, this.shopLit, this.stone, this.brown, this.door, this.wood, this.roofCone, this.crownGold, this.crownCool, this.steel, this.globe, this.hole, this.red, this.taxiLamp, this.signGreen]) b.build(this.group, this.keep);
    this.box.dispose();
  }
}

/**
 * The skyline beyond the district: flat haze-coloured towers pricked with lights, and two
 * landmark spires. They ignore the fog so they read as silhouettes against the night sky.
 */
export function farSkyline(zone: Zone, group: THREE.Group, keep: Keep) {
  const rnd = mulberry(zone.w * 3 + zone.nation.length * 101);
  const tex = keep(skylineTexture(zone.env.fog));
  const body = keep(new THREE.MeshBasicMaterial({ map: tex, fog: false }));
  const dark = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(zone.env.fog).multiplyScalar(0.5), fog: false }));
  const gold = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc880).multiplyScalar(0.9), fog: false }));
  const red = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2a2a).multiplyScalar(1.4), fog: false, toneMapped: false }));
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(keep(geo), mat);
    m.position.set(x, y, z);
    group.add(m);
    return m;
  };
  const cx = zone.w / 2;
  const cz = zone.h / 2;
  // A ring of towers out in the haze.
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2 + rnd() * 0.08;
    const rx = zone.w / 2 + 75 + rnd() * 110;
    const rz = zone.h / 2 + 75 + rnd() * 110;
    const x = cx + Math.cos(a) * rx;
    const z = cz + Math.sin(a) * rz;
    const w = 14 + rnd() * 22;
    const h = 40 + rnd() * rnd() * 170;
    add(facadeBox(w, h, w, i * 13), body, x, h / 2, z);
    if (h > 90 && rnd() < 0.5) add(facadeBox(w * 0.6, h * 0.25, w * 0.6, i), body, x, h + h * 0.125, z);
    if (h > 120) add(new THREE.SphereGeometry(0.7, 6, 4), red, x, h + (h > 90 ? h * 0.25 : 0) + 1, z);
  }
  // A great deco tower in stepped tiers with a floodlit top and mast.
  const ex = cx + zone.w * 0.2;
  const ez = -150;
  let y = 0;
  for (const [w, h] of [[46, 70], [36, 60], [28, 50], [20, 26], [12, 14]]) {
    add(facadeBox(w, h, w, w), body, ex, y + h / 2, ez);
    y += h;
  }
  add(new THREE.BoxGeometry(13, 4, 13), gold, ex, y - 6, ez);
  add(new THREE.CylinderGeometry(1.4, 2.6, 24, 8), dark, ex, y + 12, ez);
  add(new THREE.CylinderGeometry(0.3, 0.6, 22, 6), dark, ex, y + 35, ez);
  add(new THREE.SphereGeometry(1, 8, 6), red, ex, y + 46, ez);
  // A tower crowned with stacked steel arches, lit from within.
  const kx = zone.w + 140;
  const kz = cz - 20;
  add(facadeBox(30, 110, 30, 77), body, kx, 55, kz);
  add(facadeBox(22, 45, 22, 78), body, kx, 132, kz);
  for (let i = 0; i < 5; i++) {
    const r = 11 - i * 2;
    const c = add(new THREE.ConeGeometry(r, 9, 4, 1, true), i % 2 ? gold : dark, kx, 158 + i * 6, kz);
    c.rotation.y = Math.PI / 4;
  }
  add(new THREE.CylinderGeometry(0.15, 0.9, 34, 6), dark, kx, 205, kz);
}
