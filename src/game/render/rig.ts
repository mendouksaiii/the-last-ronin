import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { detailMaps, shellTextures } from "./textures";
import type { Cape } from "./cloak";
import { CLOAK, RAG, addHood, beanie, makeCape, oniHead, survivorKit, tacticalKit } from "./outfit";
import { humanHead, person } from "./human";

// Character models built from smooth, anatomically proportioned volumes with physically based
// skin, fabric, leather and steel. Models face +z; y is up; units are metres.

export type Gear =
  | "katana"
  | "bo"
  | "nunchaku"
  | "kusari"
  | "machete"
  | "crossbow"
  | "hammer"
  | "knives"
  | "club"
  | "naginata"
  | "sickle"
  | "biwa"
  | "none";

export type Head = "turtle" | "hood" | "helmet" | "monk" | "mask" | "hair" | "kerchief" | "oni" | "beanie" | "human";

export interface Look {
  skin: number;
  cloth: number;
  accent: number;
  scale: number;
  bulk: number;
  head: Head;
  gear: Gear;
  /** Weapon in the left hand. */
  offGear?: Gear;
  eyes: number;
  eyeGlow: number;
  kasa?: boolean;
  /** Length of a robe or coat skirt, 0 for none. */
  skirt?: number;
  shell?: number;
  /** A long hooded cloak of this colour. */
  cloak?: number;
  /** A tattered cloth hanging from one shoulder. */
  cape?: number;
  outfit?: "tactical" | "survivor";
  /** Trousers, when they differ from the coat. */
  pants?: number;
  /** Seed for small per-character variations. */
  seed?: number;
  beast?: boolean;
}

export interface Limb {
  upper: THREE.Group;
  lower: THREE.Group;
  end: THREE.Group;
}

export interface Rig {
  root: THREE.Group;
  body: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  armL: Limb;
  armR: Limb;
  legL: Limb;
  legR: Limb;
  hipH: number;
  look: Look;
  /** Materials that flash when struck. */
  mats: THREE.MeshStandardMaterial[];
  /** Glowing eyes or visor, pulsed when winding up an attack. */
  glow: THREE.MeshStandardMaterial[];
  weapon: GearParts | null;
  off: GearParts | null;
  /** Scabbard on the back: the main weapon rests here when not fighting. */
  sheath: { back: THREE.Group } | null;
  tails: THREE.Group | null;
  /** Chest volume, scaled slightly with breathing. */
  chest: THREE.Object3D | null;
  /** Cloth simulated each frame. */
  capes: Cape[];
  /** Leg-cycle smoothing state. */
  ph: { target: number; off: number };
  /** Current pose, eased towards the target each frame. */
  cur: Pose;
  /** Smoothed heading of the model, so turns sweep instead of snapping. */
  yaw: number | null;
}

export interface GearParts {
  group: THREE.Group;
  tip: THREE.Object3D;
  base: THREE.Object3D;
  /** Nunchaku: the free stick. Kusari: the chain, scaled along its length. */
  swing?: THREE.Group;
  chain?: THREE.Group;
  weight?: THREE.Object3D;
  laser?: THREE.Mesh;
  steel?: THREE.MeshStandardMaterial;
}

export interface Pose {
  armR: [number, number, number];
  armL: [number, number, number];
  wrist: number;
  twist: number;
  lean: number;
  crouch: number;
  legs: number;
  phase: number;
  spin: number;
  roll: number;
  drop: number;
  head: number;
  /** Nunchaku free-stick angle, or kusari chain length. */
  gearA: number;
  /** Sideways bank of the whole body, leaning into turns. */
  bank: number;
  /** Side-to-side hip shift as weight moves from foot to foot. */
  sway: number;
  /** Head turn left/right. */
  look: number;
  /** Breathing, 0..1. */
  breath: number;
}

export const restPose = (): Pose => ({
  armR: [0, 0.1, -0.2],
  armL: [0, 0.1, -0.2],
  wrist: 0,
  twist: 0,
  lean: 0,
  crouch: 0,
  legs: 0,
  phase: 0,
  spin: 0,
  roll: 0,
  drop: 0,
  head: 0,
  gearA: 0,
  bank: 0,
  sway: 0,
  look: 0,
  breath: 0,
});

// ---------- Shared geometry and materials ----------

const geos = new Map<string, THREE.BufferGeometry>();
export const geo = (key: string, make: () => THREE.BufferGeometry) => {
  let g = geos.get(key);
  if (!g) {
    g = make();
    geos.set(key, g);
  }
  return g;
};
export const capsule = (r: number, l: number) => geo(`c${r.toFixed(3)}:${l.toFixed(3)}`, () => new THREE.CapsuleGeometry(r, Math.max(0.001, l), 6, 18));
export const sphere = (r: number) => geo(`s${r.toFixed(3)}`, () => new THREE.SphereGeometry(r, 28, 20));
const box = (w: number, h: number, d: number) => geo(`b${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
export const rbox = (w: number, h: number, d: number, r: number) => geo(`r${w}:${h}:${d}:${r}`, () => new RoundedBoxGeometry(w, h, d, 3, r));
export const cyl = (r1: number, r2: number, h: number, seg = 18, open = false) => geo(`y${r1}:${r2}:${h}:${seg}:${open}`, () => new THREE.CylinderGeometry(r1, r2, h, seg, 1, open));

let tex: { skin: THREE.Texture; fabric: THREE.Texture; leather: THREE.Texture } | null = null;
export const charTex = () => {
  if (tex) return tex;
  const d = detailMaps();
  const rep = (t: THREE.Texture, k: number) => {
    const c = t.clone();
    c.repeat.set(k, k);
    c.needsUpdate = true;
    return c;
  };
  tex = { skin: rep(d.skin, 3), fabric: rep(d.fabric, 6), leather: rep(d.leather, 3) };
  return tex;
};

let shared: { steelWrap: THREE.MeshStandardMaterial; wood: THREE.MeshStandardMaterial; wrap: THREE.MeshStandardMaterial; iron: THREE.MeshStandardMaterial; boot: THREE.MeshStandardMaterial } | null = null;
export const mats = () => {
  if (shared) return shared;
  const t = charTex();
  shared = {
    steelWrap: new THREE.MeshStandardMaterial({ color: 0x8a8278, metalness: 0.9, roughness: 0.35 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.6, normalMap: t.fabric, normalScale: new THREE.Vector2(0.4, 0.4) }),
    wrap: new THREE.MeshStandardMaterial({ color: 0x1e1a1a, roughness: 0.85, normalMap: t.fabric }),
    iron: new THREE.MeshStandardMaterial({ color: 0x4a4c50, metalness: 0.9, roughness: 0.4 }),
    boot: new THREE.MeshStandardMaterial({ color: 0x1c1816, roughness: 0.55, normalMap: t.leather }),
  };
  return shared;
};
const STEEL = () => new THREE.MeshStandardMaterial({ color: 0xdfe3e8, metalness: 1, roughness: 0.16, emissive: 0x000000 });

export function part(g: THREE.BufferGeometry, m: THREE.Material) {
  const mesh = new THREE.Mesh(g, m);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Skin: slightly glossy with fine pebbled detail. */
const skinMat = (color: number, reptile: boolean) =>
  new THREE.MeshPhysicalMaterial({
    color,
    roughness: reptile ? 0.5 : 0.62,
    normalMap: charTex().skin,
    normalScale: new THREE.Vector2(reptile ? 0.9 : 0.25, reptile ? 0.9 : 0.25),
    clearcoat: reptile ? 0.25 : 0.05,
    clearcoatRoughness: 0.5,
    sheen: reptile ? 0 : 0.3,
    sheenColor: new THREE.Color(0xffc8b0),
  });
/** Woven cloth with a soft fabric sheen. */
export const clothMat = (color: number) =>
  new THREE.MeshPhysicalMaterial({ color, roughness: 0.88, normalMap: charTex().fabric, normalScale: new THREE.Vector2(0.6, 0.6), sheen: 0.6, sheenRoughness: 0.6, sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.4) });
export const leatherMat = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, normalMap: charTex().leather });

/** A limb segment that tapers from r1 at the top to r2 at the bottom, with rounded ends. */
const taper = (r1: number, r2: number, l: number) =>
  geo(`t${r1.toFixed(3)}:${r2.toFixed(3)}:${l.toFixed(3)}`, () => {
    const pts: THREE.Vector2[] = [];
    const n = 8;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * (Math.PI / 2);
      pts.push(new THREE.Vector2(Math.sin(a) * r2, -l / 2 - Math.cos(a) * r2 * 0.8));
    }
    // A muscle bulge in the upper third.
    for (let i = 1; i < 6; i++) {
      const k = i / 6;
      const r = r2 + (r1 - r2) * k + Math.sin(k * Math.PI) * (r1 * 0.12);
      pts.push(new THREE.Vector2(r, -l / 2 + l * k));
    }
    for (let i = 0; i <= n; i++) {
      const a = (1 - i / n) * (Math.PI / 2);
      pts.push(new THREE.Vector2(Math.sin(a) * r1, l / 2 + Math.cos(a) * r1 * 0.8));
    }
    return new THREE.LatheGeometry(pts, 18);
  });

function limb(parent: THREE.Object3D, x: number, y: number, r1: number, l1: number, r2: number, l2: number, m: THREE.Material, m2 = m): Limb {
  const upper = new THREE.Group();
  upper.position.set(x, y, 0);
  parent.add(upper);
  const um = part(taper(r1, r1 * 0.78, l1 - r1 * 0.6), m);
  um.position.y = -l1 / 2;
  upper.add(um);
  // A rounded joint to bridge the knee or elbow.
  const joint = part(sphere(r1 * 0.8), m);
  joint.position.y = -l1;
  upper.add(joint);
  const lower = new THREE.Group();
  lower.position.y = -l1;
  upper.add(lower);
  const lm = part(taper(r2, r2 * 0.68, l2 - r2 * 0.5), m2);
  lm.position.y = -l2 / 2;
  lower.add(lm);
  const end = new THREE.Group();
  end.position.y = -l2;
  lower.add(end);
  return { upper, lower, end };
}

// ---------- Weapons ----------

function buildGear(kind: Gear): GearParts | null {
  if (kind === "none") return null;
  const M = mats();
  const group = new THREE.Group();
  const tip = new THREE.Object3D();
  const base = new THREE.Object3D();
  group.add(tip, base);
  const out: GearParts = { group, tip, base };
  switch (kind) {
    case "katana":
    case "machete":
    case "knives": {
      const len = kind === "katana" ? 0.8 : kind === "machete" ? 0.55 : 0.3;
      const steel = STEEL();
      const grip = part(rbox(0.032, 0.036, kind === "katana" ? 0.26 : 0.13, 0.012), M.wrap);
      grip.position.z = 0.02;
      const guard = part(cyl(0.045, 0.045, 0.012, 20), M.steelWrap);
      guard.rotation.x = Math.PI / 2;
      guard.position.z = kind === "katana" ? 0.15 : 0.08;
      // A slightly curved, tapered blade.
      const shape = new THREE.Shape();
      const bw = kind === "machete" ? 0.07 : 0.032;
      shape.moveTo(0, 0);
      shape.lineTo(len, kind === "katana" ? 0.02 : 0);
      shape.lineTo(len - 0.05, bw * 0.95);
      shape.quadraticCurveTo(len * 0.5, bw * 1.05, 0, bw);
      shape.lineTo(0, 0);
      const bladeGeo = geo(`blade${kind}`, () => {
        const g = new THREE.ExtrudeGeometry(shape, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1, curveSegments: 10 });
        g.translate(0, -bw / 2, -0.003);
        g.rotateY(-Math.PI / 2);
        return g;
      });
      const blade = part(bladeGeo, steel);
      blade.position.z = guard.position.z;
      group.add(grip, guard, blade);
      base.position.z = guard.position.z + 0.05;
      tip.position.z = guard.position.z + len;
      out.steel = steel;
      break;
    }
    case "bo": {
      const staff = part(cyl(0.022, 0.022, 1.9, 14), M.wood);
      staff.rotation.z = Math.PI / 2;
      staff.position.x = -0.3;
      const capA = part(cyl(0.026, 0.026, 0.1, 14), M.iron);
      capA.rotation.z = Math.PI / 2;
      capA.position.x = 0.6;
      const capB = capA.clone();
      capB.position.x = -1.2;
      const grip = part(cyl(0.025, 0.025, 0.3, 14), M.wrap);
      grip.rotation.z = Math.PI / 2;
      grip.position.x = -0.3;
      group.add(staff, capA, capB, grip);
      tip.position.x = -1.25;
      base.position.x = -0.6;
      break;
    }
    case "nunchaku": {
      const a = part(cyl(0.02, 0.023, 0.3, 12), M.wood);
      a.rotation.x = Math.PI / 2;
      a.position.z = 0.1;
      const swing = new THREE.Group();
      swing.position.z = 0.27;
      const link = part(box(0.01, 0.01, 0.06), M.iron);
      link.position.z = 0.03;
      const b = part(cyl(0.023, 0.02, 0.3, 12), M.wood);
      b.rotation.x = Math.PI / 2;
      b.position.z = 0.21;
      swing.add(link, b);
      group.add(a, swing);
      swing.add(tip);
      tip.position.z = 0.36;
      base.position.z = 0.25;
      out.swing = swing;
      break;
    }
    case "kusari":
    case "sickle": {
      if (kind === "sickle") {
        const handle = part(rbox(0.035, 0.035, 0.32, 0.01), M.wood);
        handle.position.z = 0.08;
        const steel = STEEL();
        const hook = part(rbox(0.01, 0.3, 0.04, 0.004), steel);
        hook.position.set(0, 0.13, 0.24);
        group.add(handle, hook);
        out.steel = steel;
      } else {
        const coil = part(geo("coil", () => new THREE.TorusGeometry(0.05, 0.012, 10, 20)), M.iron);
        coil.rotation.y = Math.PI / 2;
        group.add(coil);
      }
      // The chain hangs along -y of the hand: the continuation of the forearm.
      const chain = new THREE.Group();
      const links = part(cyl(0.008, 0.008, 1, 6), M.iron);
      links.position.y = -0.5;
      chain.add(links);
      const weight = part(rbox(0.07, 0.11, 0.07, 0.015), M.iron);
      group.add(chain, weight);
      out.chain = chain;
      out.weight = weight;
      tip.position.y = -1;
      chain.add(tip);
      break;
    }
    case "crossbow": {
      const holder = new THREE.Group();
      holder.rotation.x = Math.PI / 2;
      const stock = part(rbox(0.06, 0.07, 0.62, 0.015), M.wood);
      stock.position.z = 0.12;
      const limbs = part(rbox(0.62, 0.025, 0.04, 0.008), M.iron);
      limbs.position.z = 0.4;
      const laser = new THREE.Mesh(
        box(0.008, 0.008, 1),
        new THREE.MeshBasicMaterial({ color: 0xff1a2a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
      );
      laser.scale.z = 14;
      laser.position.z = 0.43 + 7;
      laser.visible = false;
      holder.add(stock, limbs, laser);
      group.add(holder);
      tip.position.y = -0.4;
      out.laser = laser;
      break;
    }
    case "hammer":
    case "club":
    case "naginata": {
      const len = kind === "naginata" ? 2 : kind === "hammer" ? 1.1 : 1.25;
      const shaft = part(kind === "club" ? cyl(0.11, 0.05, len, 18) : cyl(0.025, 0.025, len, 14), kind === "club" ? M.iron : M.wood);
      shaft.rotation.x = Math.PI / 2;
      shaft.position.z = len / 2 - 0.2;
      group.add(shaft);
      if (kind === "hammer") {
        const head = part(rbox(0.22, 0.22, 0.36, 0.03), M.iron);
        head.position.z = len - 0.25;
        head.rotation.x = Math.PI / 2;
        group.add(head);
      } else if (kind === "naginata") {
        const steel = STEEL();
        const blade = part(rbox(0.012, 0.06, 0.55, 0.005), steel);
        blade.position.z = len - 0.2 + 0.25;
        group.add(blade);
        out.steel = steel;
      } else {
        for (let i = 0; i < 4; i++) {
          const stud = part(rbox(0.05, 0.05, 0.05, 0.01), M.steelWrap);
          stud.position.set(Math.cos(i * 1.57) * 0.1, Math.sin(i * 1.57) * 0.1, len - 0.45);
          group.add(stud);
        }
      }
      tip.position.z = len - 0.1;
      base.position.z = len * 0.5;
      break;
    }
    case "biwa": {
      const body = part(sphere(0.18), M.wood);
      body.scale.set(1, 1.3, 0.35);
      body.position.set(0, -0.05, 0.1);
      const neck = part(rbox(0.04, 0.4, 0.03, 0.008), M.wood);
      neck.position.set(0, 0.3, 0.1);
      group.add(body, neck);
      break;
    }
  }
  return out;
}

// ---------- Heads ----------

function buildHead(head: THREE.Group, look: Look, skin: THREE.Material, cloth: THREE.Material, accent: THREE.Material, eyes: THREE.MeshStandardMaterial) {
  const M = mats();
  const sclera = new THREE.MeshPhysicalMaterial({ color: 0xe8e2d8, roughness: 0.15, clearcoat: 1 });
  const iris = new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 0.2 });
  /** Realistic eyes: a glossy eyeball with a dark iris. */
  const realEyes = (z: number, y: number, gap: number, r: number) => {
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(sphere(r), sclera);
      e.position.set(s * gap, y, z);
      const i = new THREE.Mesh(sphere(r * 0.5), iris);
      i.position.set(0, 0, r * 0.62);
      e.add(i);
      head.add(e);
    }
  };
  /** Glowing optics (cyber goggles of the gangs). */
  const glowEyes = (z: number, y: number, gap: number, r: number) => {
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(sphere(r), eyes);
      e.position.set(s * gap, y, z);
      head.add(e);
    }
  };
  /** A human face: skull, jaw, nose, brow and ears. */
  const face = (m: THREE.Material) => {
    const skull = part(sphere(0.12), m);
    skull.scale.set(0.95, 1.08, 1.05);
    skull.position.y = 0.02;
    const jaw = part(sphere(0.095), m);
    jaw.scale.set(0.92, 0.85, 1);
    jaw.position.set(0, -0.06, 0.03);
    const nose = part(rbox(0.026, 0.05, 0.035, 0.01), m);
    nose.position.set(0, -0.005, 0.12);
    nose.rotation.x = -0.2;
    const brow = part(rbox(0.15, 0.022, 0.03, 0.01), m);
    brow.position.set(0, 0.04, 0.105);
    head.add(skull, jaw, nose, brow);
    for (const s of [-1, 1]) {
      const ear = part(sphere(0.025), m);
      ear.scale.set(0.5, 1, 0.8);
      ear.position.set(s * 0.115, 0, 0);
      head.add(ear);
    }
  };
  let tails: THREE.Group | null = null;
  switch (look.head) {
    case "turtle": {
      // A broad reptile skull with a blunt beak and heavy brow.
      const skull = part(sphere(0.13), skin);
      skull.scale.set(1.05, 0.98, 1.15);
      skull.position.set(0, 0.01, 0.0);
      const snout = part(sphere(0.1), skin);
      snout.scale.set(1.0, 0.72, 1.0);
      snout.position.set(0, -0.045, 0.075);
      const brow = part(rbox(0.21, 0.035, 0.06, 0.016), skin);
      brow.position.set(0, 0.035, 0.1);
      head.add(skull, snout, brow);
      // The mask: a cloth band wrapping the eyes.
      const band = part(cyl(0.142, 0.14, 0.055, 32, true), accent);
      (band.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
      band.scale.set(1.05, 1, 1.18);
      band.position.set(0, 0.022, 0.012);
      head.add(band);
      realEyes(0.148, 0.022, 0.048, 0.02);
      if (look.cloak) {
        const hoodMat = clothMat(look.cloak);
        addHood(head, hoodMat, 0.185, 1.0);
        break;
      }
      tails = new THREE.Group();
      tails.position.set(0, 0.03, -0.15);
      for (const s of [-1, 1]) {
        const t = part(rbox(0.04, 0.008, 0.36, 0.003), accent);
        t.position.set(s * 0.03, 0, -0.17);
        t.rotation.y = s * 0.18;
        tails.add(t);
      }
      const knot = part(sphere(0.03), accent);
      knot.scale.set(1.4, 1, 0.8);
      tails.add(knot);
      head.add(tails);
      break;
    }
    case "hood":
    case "kerchief": {
      face(skin);
      const hood = part(sphere(0.15), cloth);
      hood.scale.set(1.05, 1.1, 1.08);
      hood.position.set(0, 0.03, -0.025);
      head.add(hood);
      // A cloth face mask over the mouth, and cyber goggles.
      const mask = part(sphere(0.11), look.head === "kerchief" ? accent : M.wrap);
      mask.scale.set(1, 0.65, 0.9);
      mask.position.set(0, -0.055, 0.05);
      head.add(mask);
      const visor = part(rbox(0.16, 0.035, 0.03, 0.012), M.iron);
      visor.position.set(0, 0.012, 0.115);
      head.add(visor);
      glowEyes(0.13, 0.012, 0.04, 0.014);
      break;
    }
    case "helmet": {
      const shell = part(rbox(0.28, 0.3, 0.3, 0.07), M.iron);
      shell.position.y = 0.02;
      head.add(shell);
      const slit = new THREE.Mesh(box(0.2, 0.025, 0.02), eyes);
      slit.position.set(0, 0.03, 0.152);
      head.add(slit);
      const grill = part(rbox(0.16, 0.08, 0.03, 0.01), M.steelWrap);
      grill.position.set(0, -0.06, 0.145);
      head.add(grill);
      break;
    }
    case "monk": {
      face(skin);
      const hat = part(cyl(0.05, 0.3, 0.14, 32), cloth);
      hat.position.y = 0.15;
      head.add(hat);
      realEyes(0.1, 0.012, 0.04, 0.014);
      break;
    }
    case "mask": {
      const skull = part(sphere(0.13), cloth);
      skull.scale.set(1, 1.08, 1.04);
      head.add(skull);
      const mask = part(sphere(0.12), new THREE.MeshPhysicalMaterial({ color: 0xd8d2c8, roughness: 0.3, clearcoat: 0.8 }));
      mask.scale.set(1, 1.15, 0.6);
      mask.position.z = 0.07;
      head.add(mask);
      glowEyes(0.135, 0.03, 0.042, 0.014);
      break;
    }
    case "hair": {
      face(skin);
      const hairMat = new THREE.MeshPhysicalMaterial({ color: 0xcfc8bc, roughness: 0.55, sheen: 1, sheenColor: new THREE.Color(0xffffff), normalMap: charTex().fabric });
      const hair = part(sphere(0.128), hairMat);
      hair.scale.set(1.02, 0.85, 1.06);
      hair.position.set(0, 0.055, -0.02);
      head.add(hair);
      const knot = part(sphere(0.045), hairMat);
      knot.position.set(0, 0.16, -0.06);
      head.add(knot);
      const beard = part(sphere(0.07), hairMat);
      beard.scale.set(1, 1.3, 0.7);
      beard.position.set(0, -0.11, 0.07);
      head.add(beard);
      realEyes(0.1, 0.012, 0.04, 0.014);
      break;
    }
    case "oni":
      face(skin);
      oniHead(head, accent as THREE.MeshStandardMaterial, eyes);
      break;
    case "human":
      humanHead(head, look, skin, person(look.seed ?? 1, look.accent));
      break;
    case "beanie":
      face(skin);
      beanie(head, accent as THREE.MeshStandardMaterial);
      realEyes(0.1, 0.012, 0.04, 0.014);
      break;
  }
  if (look.kasa && !look.cloak) {
    const hat = part(cyl(0.02, 0.44, 0.17, 40), new THREE.MeshPhysicalMaterial({ color: 0x6a5838, roughness: 0.9, normalMap: charTex().fabric, sheen: 0.4 }));
    hat.position.set(0, 0.16, 0.01);
    hat.rotation.x = 0.08;
    head.add(hat);
  }
  return tails;
}

// ---------- Characters ----------

export function buildRig(look: Look): Rig {
  const rig = look.beast ? buildBeast(look) : buildBody(look);
  const dynamic = new Set<THREE.Object3D>();
  if (rig.chest) dynamic.add(rig.chest);
  for (const w of [rig.weapon, rig.off]) {
    if (w?.laser) dynamic.add(w.laser);
    if (w?.weight) dynamic.add(w.weight);
  }
  for (const c of rig.capes) dynamic.add(c.mesh);
  bake(rig.root, dynamic);
  return rig;
}

/**
 * Merges the rigid parts under each bone into one mesh per material, so a fully kitted
 * character costs a few dozen draw calls instead of well over a hundred.
 */
function bake(root: THREE.Object3D, dynamic: Set<THREE.Object3D>) {
  const bones: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) bones.push(o);
  });
  for (const bone of bones) {
    const buckets = new Map<THREE.Material, THREE.Mesh[]>();
    for (const c of bone.children) {
      const m = c as THREE.Mesh;
      if (!m.isMesh || dynamic.has(m) || m.children.length || Array.isArray(m.material)) continue;
      const list = buckets.get(m.material) ?? [];
      list.push(m);
      buckets.set(m.material, list);
    }
    for (const [mat, list] of buckets) {
      if (list.length < 2) continue;
      const parts = list.map((m) => {
        m.updateMatrix();
        const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        for (const name of Object.keys(g.attributes)) if (name !== "position" && name !== "normal" && name !== "uv") g.deleteAttribute(name);
        g.clearGroups();
        g.applyMatrix4(m.matrix);
        return g;
      });
      const merged = mergeGeometries(parts);
      parts.forEach((g) => g.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = list.some((m) => m.castShadow);
      mesh.receiveShadow = true;
      mesh.userData.own = true;
      for (const m of list) bone.remove(m);
      bone.add(mesh);
    }
  }
}

function buildBody(look: Look): Rig {
  const M = mats();
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  root.scale.setScalar(look.scale);
  const b = look.bulk;
  const turtle = look.head === "turtle";
  const skin = skinMat(look.skin, turtle);
  const cloth = clothMat(look.cloth);
  const accent = clothMat(look.accent);
  const eyes = new THREE.MeshStandardMaterial({ color: look.eyes, emissive: look.eyes, emissiveIntensity: look.eyeGlow, toneMapped: false });
  const limbMat = turtle ? skin : cloth;
  const pants = look.pants !== undefined ? clothMat(look.pants) : null;
  const legMat = pants ?? limbMat;
  const human = look.head === "human";
  const hipH = 0.95;

  const torso = new THREE.Group();
  body.add(torso);
  // Pelvis, abdomen and a broad chest that narrows to the waist.
  const pelvis = part(sphere(0.16), turtle ? M.wrap : (pants ?? cloth));
  pelvis.scale.set(1.12 * b, 0.7, 0.85 * b);
  pelvis.position.y = 0.02;
  torso.add(pelvis);
  const abdomen = part(capsule(0.14, 0.12), turtle ? skin : cloth);
  abdomen.scale.set(b, 1, 0.82 * b);
  abdomen.position.y = 0.17;
  torso.add(abdomen);
  const chest = part(sphere(0.2), turtle ? skin : cloth);
  chest.scale.set(1.12 * b, 1.08, 0.72 * b);
  chest.position.y = 0.4;
  torso.add(chest);
  // Trapezius slope from neck to shoulders.
  const traps = part(sphere(0.13), turtle ? skin : cloth);
  traps.scale.set(1.5 * b, 0.55, 0.7 * b);
  traps.position.set(0, 0.54, -0.02);
  torso.add(traps);
  const belt = part(cyl(0.175 * b, 0.18 * b, 0.07, 32), turtle ? M.boot : leatherMat(0x2a2220));
  belt.scale.z = 0.85;
  belt.position.y = 0.08;
  const buckle = part(rbox(0.06, 0.045, 0.02, 0.006), M.steelWrap);
  buckle.position.set(0, 0.08, 0.155 * b);
  torso.add(belt, buckle);
  if (!turtle) {
    // A jacket: collar and a hem flare over the hips.
    const collar = part(cyl(0.085, 0.1, 0.07, 24, true), cloth);
    (collar.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    collar.position.y = 0.6;
    torso.add(collar);
  }
  if (look.shell) {
    const st = shellTextures();
    const carapace = new THREE.MeshPhysicalMaterial({ color: look.shell, map: st.map, normalMap: st.normal, roughness: 0.55, clearcoat: 0.4, clearcoatRoughness: 0.4 });
    const shell = part(sphere(0.3), carapace);
    shell.scale.set(1.12 * b, 1.3, 0.62);
    shell.position.set(0, 0.34, -0.14);
    // Rim where shell meets plastron.
    const rim = part(geo("rim", () => new THREE.TorusGeometry(0.3, 0.025, 12, 40)), carapace);
    rim.scale.set(1.12 * b, 1.3, 1);
    rim.position.set(0, 0.34, -0.06);
    const plastronMat = new THREE.MeshPhysicalMaterial({ color: 0x9a8458, roughness: 0.6, normalMap: st.normal, normalScale: new THREE.Vector2(0.4, 0.4), clearcoat: 0.2 });
    const plastron = part(sphere(0.26), plastronMat);
    plastron.scale.set(0.9 * b, 1.18, 0.42);
    plastron.position.set(0, 0.3, 0.07);
    torso.add(shell, rim, plastron);
    // A leather harness strap across the chest.
    const strap = part(rbox(0.05, 0.62, 0.02, 0.008), M.boot);
    strap.position.set(0, 0.32, 0.18);
    strap.rotation.z = 0.6;
    torso.add(strap);
  }
  const faceSkin = turtle ? skin : skinMat(look.skin, false);
  const neck = part(human ? cyl(0.047, 0.06, 0.15, 18) : cyl(0.06, 0.075, 0.14, 18), faceSkin);
  neck.position.y = 0.64;
  torso.add(neck);
  const head = new THREE.Group();
  head.position.y = 0.79;
  torso.add(head);
  const tails = buildHead(head, look, faceSkin, cloth, accent, eyes);

  // Shoulders, arms and hands.
  const armR = limb(torso, -0.25 * b, 0.53, 0.066 * b, 0.3, 0.056 * b, 0.27, limbMat, turtle ? skin : cloth);
  const armL = limb(torso, 0.25 * b, 0.53, 0.066 * b, 0.3, 0.056 * b, 0.27, limbMat, turtle ? skin : cloth);
  const handMat = turtle ? skin : human && look.outfit === "survivor" ? faceSkin : leatherMat(0x1e1a18);
  for (const [a, s] of [[armR, -1], [armL, 1]] as const) {
    const delt = part(sphere(0.085 * b), turtle ? skin : cloth);
    delt.scale.set(1, 0.9, 1);
    delt.position.set(0, -0.01, 0);
    a.upper.add(delt);
    const palm = part(rbox(0.07 * b, 0.09, 0.04, 0.015), handMat);
    palm.position.y = -0.045;
    const fingers = part(rbox(0.065 * b, 0.05, 0.045, 0.018), handMat);
    fingers.position.set(0, -0.095, 0.012);
    fingers.rotation.x = 0.5;
    const thumb = part(capsule(0.014, 0.035), handMat);
    thumb.position.set(-s * 0.035 * b, -0.05, 0.02);
    thumb.rotation.z = s * 0.6;
    a.end.add(palm, fingers, thumb);
    if (!turtle) {
      // Wrist cuff.
      const cuff = part(cyl(0.05 * b, 0.05 * b, 0.05, 18), cloth);
      cuff.position.y = 0.02;
      a.end.add(cuff);
    } else {
      // Hand wraps on the forearm.
      const wrap = part(cyl(0.046 * b, 0.044 * b, 0.1, 18), M.wrap);
      wrap.position.y = 0.06;
      a.end.add(wrap);
    }
  }
  // Legs: thighs, knees, shins and boots.
  const legR = limb(body, -0.11 * b, 0, 0.088 * b, 0.46, 0.066 * b, 0.45, legMat, turtle ? skin : legMat);
  const legL = limb(body, 0.11 * b, 0, 0.088 * b, 0.46, 0.066 * b, 0.45, legMat, turtle ? skin : legMat);
  for (const l of [legR, legL]) {
    const foot = part(rbox(0.1 * b, 0.075, 0.26, 0.03), turtle ? skin : M.boot);
    foot.position.set(0, -0.03, 0.06);
    l.end.add(foot);
    if (turtle) {
      // Knee pad.
      const pad = part(sphere(0.07 * b), M.boot);
      pad.scale.set(1, 0.9, 0.7);
      pad.position.set(0, -0.02, 0.04);
      l.lower.add(pad);
    } else {
      const shaft = part(cyl(0.066 * b, 0.06 * b, 0.18, 18), M.boot);
      shaft.position.y = 0.06;
      l.end.add(shaft);
    }
  }
  if (look.skirt) {
    const skirt = part(cyl(0.2 * b, 0.32 * b, look.skirt, 32, true), cloth);
    (skirt.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    skirt.position.y = 0.06 - look.skirt / 2;
    torso.add(skirt);
  }

  const weapon = buildGear(look.gear);
  if (weapon) armR.end.add(weapon.group);
  const off = look.offGear ? buildGear(look.offGear) : null;
  if (off) armL.end.add(off.group);
  let sheath: Rig["sheath"] = null;
  if (look.gear === "katana" && look.shell && weapon) {
    // Slung across the back over the cloak: the hilt rises behind the right shoulder so the
    // right hand can draw it, the tip rests at the left hip.
    const back = new THREE.Group();
    const dir = new THREE.Vector3(0.45, -0.85, -0.27).normalize();
    back.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    back.position.set(-0.15, 0.6, look.cloak ? -0.37 : -0.33).addScaledVector(dir, -0.15);
    const lacquer = new THREE.MeshPhysicalMaterial({ color: 0x120a0a, roughness: 0.25, clearcoat: 1 });
    const scabbard = part(rbox(0.036, 0.055, 0.84, 0.014), lacquer);
    scabbard.position.z = 0.15 + 0.42;
    const throat = part(cyl(0.032, 0.032, 0.04, 14), M.steelWrap);
    throat.rotation.x = Math.PI / 2;
    throat.position.z = 0.17;
    const chape = part(cyl(0.03, 0.022, 0.05, 14), M.steelWrap);
    chape.rotation.x = Math.PI / 2;
    chape.position.z = 0.99;
    back.add(scabbard, throat, chape);
    torso.add(back);
    sheath = { back };
    back.add(weapon.group);
  }

  // Clothing, kit and simulated cloth.
  const seed = look.seed ?? 1;
  const extra: THREE.MeshStandardMaterial[] = [];
  const parts = { torso, armR, armL, legR, legL, b };
  if (look.outfit === "tactical") extra.push(...tacticalKit(parts, look.accent, look.gear !== "katana" && look.gear !== "crossbow", seed));
  else if (look.outfit === "survivor") extra.push(...survivorKit(parts, look.accent, seed));
  const capes: Cape[] = [];
  if (look.cloak !== undefined) {
    const c = makeCape(CLOAK(b, seed), look.cloak);
    torso.add(c.cape.mesh);
    capes.push(c.cape);
    extra.push(c.mat);
  }
  if (look.cape !== undefined) {
    const c = makeCape(RAG(b, seed), look.cape, 0.45);
    torso.add(c.cape.mesh);
    capes.push(c.cape);
    extra.push(c.mat);
  }

  return {
    root,
    body,
    torso,
    head,
    armL,
    armR,
    legL,
    legR,
    hipH,
    look,
    mats: [skin, cloth, accent, ...(pants ? [pants] : []), ...extra],
    glow: [eyes],
    weapon,
    off,
    sheath,
    tails,
    chest,
    cur: restPose(),
    yaw: null,
    capes,
    ph: { target: 0, off: 0 },
  };
}

/** A four-legged hound. Its front legs use the arm limbs and its back legs the leg limbs. */
function buildBeast(look: Look): Rig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  root.scale.setScalar(look.scale);
  const fur = new THREE.MeshPhysicalMaterial({ color: look.cloth, roughness: 0.9, normalMap: charTex().fabric, normalScale: new THREE.Vector2(1.2, 1.2), sheen: 1, sheenRoughness: 0.7, sheenColor: new THREE.Color(look.cloth).lerp(new THREE.Color(0xffffff), 0.5) });
  const eyes = new THREE.MeshStandardMaterial({ color: look.eyes, emissive: look.eyes, emissiveIntensity: look.eyeGlow, toneMapped: false });
  const torso = new THREE.Group();
  body.add(torso);
  const chest = part(sphere(0.2), fur);
  chest.scale.set(0.95, 1.05, 1.1);
  chest.position.set(0, 0.02, 0.22);
  const trunk = part(capsule(0.15, 0.4), fur);
  trunk.rotation.x = Math.PI / 2;
  trunk.position.set(0, 0.0, -0.05);
  torso.add(chest, trunk);
  const neck = part(capsule(0.08, 0.12), fur);
  neck.position.set(0, 0.12, 0.38);
  neck.rotation.x = 0.8;
  torso.add(neck);
  const head = new THREE.Group();
  head.position.set(0, 0.16, 0.47);
  torso.add(head);
  const skull = part(sphere(0.11), fur);
  skull.scale.set(1, 0.9, 1.1);
  const snout = part(rbox(0.09, 0.08, 0.17, 0.03), fur);
  snout.position.set(0, -0.03, 0.13);
  const nose = part(sphere(0.022), new THREE.MeshPhysicalMaterial({ color: 0x0a0a0a, roughness: 0.2, clearcoat: 1 }));
  nose.position.set(0, -0.005, 0.22);
  head.add(skull, snout, nose);
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(sphere(0.016), eyes);
    e.position.set(s * 0.05, 0.03, 0.09);
    const ear = part(geo("ear", () => new THREE.ConeGeometry(0.03, 0.09, 10)), fur);
    ear.position.set(s * 0.06, 0.11, -0.02);
    head.add(e, ear);
  }
  const tail = part(taper(0.03, 0.015, 0.3), fur);
  tail.position.set(0, 0.06, -0.38);
  tail.rotation.x = -2.2;
  torso.add(tail);
  const armR = limb(torso, -0.1, -0.05, 0.05, 0.22, 0.035, 0.22, fur);
  const armL = limb(torso, 0.1, -0.05, 0.05, 0.22, 0.035, 0.22, fur);
  armR.upper.position.z = armL.upper.position.z = 0.28;
  const legR = limb(torso, -0.1, -0.05, 0.06, 0.22, 0.035, 0.22, fur);
  const legL = limb(torso, 0.1, -0.05, 0.06, 0.22, 0.035, 0.22, fur);
  legR.upper.position.z = legL.upper.position.z = -0.25;
  return { root, body, torso, head, armL, armR, legL, legR, hipH: 0.5, look, mats: [fur], glow: [eyes], weapon: null, off: null, sheath: null, tails: null, chest: null, cur: restPose(), yaw: null, capes: [], ph: { target: 0, off: 0 } };
}

// ---------- Posing ----------

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export function mixPose(a: Pose, b: Partial<Pose>, k: number): Pose {
  const out = { ...a, armR: [...a.armR] as Pose["armR"], armL: [...a.armL] as Pose["armL"] };
  for (const key of Object.keys(b) as (keyof Pose)[]) {
    const v = b[key];
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      const arr = out[key] as number[];
      for (let i = 0; i < 3; i++) arr[i] = lerp(arr[i], v[i], k);
    } else (out[key] as number) = lerp(out[key] as number, v as number, k);
  }
  return out;
}

/** Eases the rig towards a target pose and applies it to the bones. */
export function applyPose(rig: Rig, target: Pose, dt: number, rate = 20) {
  const k = 1 - Math.exp(-dt * rate);
  const p = mixPose(rig.cur, target, k);
  // A running stride follows the leg cycle exactly; a sudden jump (a stance change between cuts,
  // stopping to fight) is absorbed into an offset that bleeds away, so the feet step across.
  const jump = Math.atan2(Math.sin(target.phase - rig.ph.target), Math.cos(target.phase - rig.ph.target));
  if (Math.abs(jump) > 0.6) rig.ph.off -= jump;
  rig.ph.target = target.phase;
  rig.ph.off *= Math.exp(-dt * 12);
  p.phase = target.phase + rig.ph.off;
  p.spin = target.spin;
  p.roll = Math.abs(target.roll - rig.cur.roll) > 1 ? target.roll : p.roll;
  rig.cur = p;
  for (const c of rig.capes) c.update(dt, rig.root.position, rig.root.rotation.y, Math.sin(p.phase) * p.legs);

  const beast = !!rig.look.beast;
  rig.body.position.y = rig.hipH + p.drop - p.crouch * (beast ? 0.15 : 0.32);
  rig.body.position.x = p.sway;
  rig.body.rotation.set(p.roll, p.spin, p.bank);
  rig.torso.rotation.set(beast ? 0 : p.lean, beast ? 0 : p.twist, beast ? 0 : -p.sway * 1.2);
  // The head stays level: it counters the torso's lean and twist like a real neck.
  rig.head.rotation.set(p.head - (beast ? 0 : p.lean * 0.55), p.look - (beast ? 0 : p.twist * 0.5), beast ? 0 : p.sway * 1.5);
  if (rig.chest) rig.chest.scale.y = 1.08 * (1 + p.breath * 0.025);

  const s = Math.sin(p.phase);
  const c = Math.cos(p.phase);
  if (beast) {
    const a = p.legs;
    rig.armR.upper.rotation.x = s * a - p.crouch * 0.4;
    rig.armL.upper.rotation.x = -s * a - p.crouch * 0.4;
    rig.legR.upper.rotation.x = -s * a + p.crouch * 0.5;
    rig.legL.upper.rotation.x = s * a + p.crouch * 0.5;
    for (const l of [rig.armR, rig.armL, rig.legR, rig.legL]) l.lower.rotation.x = 0.3 + Math.max(0, -l.upper.rotation.x) * 0.8;
    rig.head.rotation.x = p.head - p.crouch * 0.3;
    rig.torso.rotation.x = p.lean + Math.sin(p.phase * 2) * a * 0.05;
    return;
  }

  // Stride: the swing leg lifts its knee and plants heel first; the stance leg straightens and rolls to the toe.
  const a = p.legs;
  const bend = p.crouch;
  const hipR = s * a * 0.85;
  const hipL = -s * a * 0.85;
  rig.legR.upper.rotation.set(hipR - bend * 1.0 - p.lean * 0.3, 0, -p.sway * 0.6);
  rig.legL.upper.rotation.set(hipL - bend * 1.0 - p.lean * 0.3, 0, -p.sway * 0.6);
  const kneeR = bend * 1.7 + Math.max(0, c) * a * 1.25 + a * 0.12;
  const kneeL = bend * 1.7 + Math.max(0, -c) * a * 1.25 + a * 0.12;
  rig.legR.lower.rotation.x = kneeR;
  rig.legL.lower.rotation.x = kneeL;
  // Ankles keep the feet roughly flat to the street, toes lifting through the swing.
  rig.legR.end.rotation.x = -(hipR - bend * 1.0 + kneeR) * 0.85 + bend * 0.4 + Math.max(0, -s) * a * 0.25;
  rig.legL.end.rotation.x = -(hipL - bend * 1.0 + kneeL) * 0.85 + bend * 0.4 + Math.max(0, s) * a * 0.25;

  rig.armR.upper.rotation.set(p.armR[0], 0, -p.armR[1]);
  rig.armR.lower.rotation.x = p.armR[2];
  rig.armL.upper.rotation.set(p.armL[0], 0, p.armL[1]);
  rig.armL.lower.rotation.x = p.armL[2];
  rig.armR.end.rotation.x = p.wrist;

  const w = rig.weapon;
  if (w?.swing) w.swing.rotation.x = p.gearA;
  if (w?.chain && w.weight) {
    const len = Math.max(0.35, p.gearA);
    w.chain.scale.y = len;
    w.weight.position.set(0, -len, 0);
  }
}

/** Puts the main weapon in the right hand, or back in its scabbard. */
export function holdWeapon(rig: Rig, inHand: boolean) {
  const w = rig.weapon;
  if (!w || !rig.sheath) return;
  const to = inHand ? rig.armR.end : rig.sheath.back;
  if (w.group.parent === to) return;
  to.add(w.group);
  w.group.position.set(0, 0, 0);
  w.group.quaternion.identity();
}

/** Turns a model smoothly towards a heading (radians), returning the eased yaw. */
export function easeYaw(rig: Rig, want: number, dt: number, rate: number) {
  if (rig.yaw === null || dt <= 0) {
    rig.yaw = rig.yaw ?? want;
    return { yaw: rig.yaw, turn: 0 };
  }
  const diff = Math.atan2(Math.sin(want - rig.yaw), Math.cos(want - rig.yaw));
  const step = diff * (1 - Math.exp(-dt * rate));
  rig.yaw += step;
  return { yaw: rig.yaw, turn: step / dt };
}

/** Frees a character's own materials (shared geometry and materials stay cached). */
export function disposeRig(rig: Rig) {
  for (const c of rig.capes) c.dispose();
  const keep = new Set<THREE.Material>(Object.values(mats()));
  rig.root.traverse((o) => {
    if (o.userData.own) (o as THREE.Mesh).geometry.dispose();
    const m = (o as THREE.Mesh).material;
    if (m && !Array.isArray(m) && !keep.has(m)) m.dispose();
  });
}

/** Hit flash: tints the body bright for an instant. */
export function setFlash(rig: Rig, k: number) {
  for (const m of rig.mats) {
    m.emissive.setRGB(k * 0.9, k * 0.85, k * 0.8);
  }
}
