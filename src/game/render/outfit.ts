import * as THREE from "three";
import { Cape, type CapeSpec } from "./cloak";
import { capsule, clothMat, cyl, geo, leatherMat, mats, part, rbox, sphere, type Limb } from "./rig";

// Clothing and kit layered over the base body: the clan's tactical gear (red hood with horns,
// black faceplate, pauldrons, red-strapped chest rig, pack and a katana across the back),
// the hero's hooded black cloak, and the layered clothes of the city's survivors.

/** Black armour plates: lacquered, a little scuffed. */
const armorMat = () => new THREE.MeshPhysicalMaterial({ color: 0x16171a, roughness: 0.38, metalness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.45 });
/** Worn red webbing and pouches. */
const redKit = (color: number) => {
  const m = leatherMat(color);
  m.roughness = 0.62;
  return m;
};

/** A hood: a partial sphere open at the face, draped low at the back of the neck. */
export function addHood(head: THREE.Object3D, m: THREE.MeshStandardMaterial, r: number, open = 0.95) {
  m.side = THREE.DoubleSide;
  const g = geo(`hood${r}:${open}`, () => new THREE.SphereGeometry(r, 28, 18, Math.PI / 2 + open, Math.PI * 2 - open * 2, 0, Math.PI * 0.68));
  const hood = part(g, m);
  hood.scale.set(1.05, 1.18, 1.18);
  hood.position.set(0, 0.035, -0.03);
  head.add(hood);
  // A soft peak at the crown.
  const peak = part(sphere(r * 0.45), m);
  peak.scale.set(1, 0.8, 1.3);
  peak.position.set(0, 0.035 + r * 0.95, -0.03);
  head.add(peak);
  return hood;
}

/** The clan's horned red hood and black faceplate with glowing eye slits. */
export function oniHead(head: THREE.Object3D, accent: THREE.MeshStandardMaterial, eyes: THREE.MeshStandardMaterial) {
  addHood(head, accent, 0.165, 0.9);
  const horn = geo("horn", () => new THREE.ConeGeometry(0.024, 0.11, 12));
  const hornMat = armorMat();
  for (const s of [-1, 1]) {
    const h = part(horn, hornMat);
    h.position.set(s * 0.085, 0.165, 0.01);
    h.rotation.set(-0.25, 0, -s * 0.45);
    head.add(h);
  }
  const plate = new THREE.MeshPhysicalMaterial({ color: 0x0b0b0d, roughness: 0.22, metalness: 0.5, clearcoat: 1, clearcoatRoughness: 0.15 });
  const mask = part(sphere(0.112), plate);
  mask.scale.set(0.95, 1.12, 0.74);
  mask.position.set(0, -0.005, 0.05);
  head.add(mask);
  const brow = part(rbox(0.16, 0.03, 0.04, 0.01), plate);
  brow.position.set(0, 0.04, 0.12);
  head.add(brow);
  // Red war-lines down the faceplate.
  const line = new THREE.MeshStandardMaterial({ color: 0x9a0c16, emissive: 0x5a0408, roughness: 0.4 });
  const mid = part(rbox(0.012, 0.075, 0.01, 0.003), line);
  mid.position.set(0, 0.075, 0.128);
  head.add(mid);
  for (const s of [-1, 1]) {
    const cheek = part(rbox(0.01, 0.065, 0.01, 0.003), line);
    cheek.position.set(s * 0.05, -0.035, 0.122);
    cheek.rotation.z = s * 0.4;
    const slit = new THREE.Mesh(rbox(0.048, 0.012, 0.012, 0.004), eyes);
    slit.position.set(s * 0.038, 0.016, 0.131);
    slit.rotation.z = -s * 0.22;
    head.add(cheek, slit);
  }
}

/** A knitted beanie for street survivors. */
export function beanie(head: THREE.Object3D, m: THREE.MeshStandardMaterial) {
  const cap = part(geo("beanie", () => new THREE.SphereGeometry(0.132, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5)), m);
  cap.scale.set(1, 1.1, 1.06);
  cap.position.y = 0.02;
  const brim = part(geo("brim", () => new THREE.TorusGeometry(0.124, 0.022, 10, 28)), m);
  brim.rotation.x = Math.PI / 2;
  brim.position.y = 0.03;
  head.add(cap, brim);
}

interface Body {
  torso: THREE.Object3D;
  armR: Limb;
  armL: Limb;
  legR: Limb;
  legL: Limb;
  b: number;
}

/** Tactical gear of the clan, after the concept art: black fatigues with red kit. */
export function tacticalKit({ torso, armR, armL, legR, legL, b }: Body, accentColor: number, swordOnBack: boolean, seed: number) {
  const M = mats();
  const armor = armorMat();
  const red = redKit(accentColor);
  const black = leatherMat(0x141416);
  const scarfMat = clothMat(0x22252b);

  // A thick scarf wound round the neck.
  const scarf = part(geo("scarf", () => new THREE.TorusGeometry(0.1, 0.05, 12, 28)), scarfMat);
  scarf.rotation.x = Math.PI / 2;
  scarf.scale.set(1.15 * b, 1, 1.4);
  scarf.position.set(0, 0.62, 0.0);
  const drape = part(sphere(0.075), scarfMat);
  drape.scale.set(1.4, 0.9, 0.7);
  drape.position.set(0, 0.57, 0.12 * b);
  torso.add(scarf, drape);

  // Chest rig: webbing panel with four red pouches and a crossing strap.
  const panel = part(rbox(0.3 * b, 0.14, 0.04, 0.012), black);
  panel.position.set(0, 0.29, 0.125 * b);
  torso.add(panel);
  for (let i = 0; i < 4; i++) {
    const x = (-0.105 + i * 0.07) * b;
    const pouch = part(rbox(0.058 * b, 0.11, 0.05, 0.012), red);
    pouch.position.set(x, 0.28, 0.155 * b);
    const flap = part(rbox(0.06 * b, 0.03, 0.054, 0.008), red);
    flap.position.set(x, 0.33, 0.157 * b);
    torso.add(pouch, flap);
  }
  for (const [z, rot] of [[0.165, -0.62], [-0.165, 0.62]] as const) {
    const strap = part(rbox(0.045, 0.66, 0.018, 0.006), red);
    strap.position.set(0.01, 0.4, z * b);
    strap.rotation.z = rot;
    torso.add(strap);
  }
  const buckle = part(rbox(0.05, 0.04, 0.02, 0.005), M.steelWrap);
  buckle.position.set(-0.05, 0.47, 0.18 * b);
  buckle.rotation.z = -0.62;
  torso.add(buckle);
  const hipPouch = part(rbox(0.06, 0.08, 0.05, 0.012), red);
  hipPouch.position.set(0.17 * b, 0.05, 0.05);
  torso.add(hipPouch);

  // A pack on the back, with a sword slung diagonally over it.
  const pack = part(rbox(0.26 * b, 0.3, 0.12, 0.03), black);
  pack.position.set(0, 0.36, -0.15 * b - 0.05);
  const packStrap = part(rbox(0.27 * b, 0.03, 0.125, 0.006), red);
  packStrap.position.set(0, 0.42, -0.15 * b - 0.05);
  torso.add(pack, packStrap);
  if (swordOnBack) {
    const sword = new THREE.Group();
    sword.position.set(0.02, 0.38, -0.15 * b - 0.135);
    sword.rotation.z = 0.55 + ((seed % 5) - 2) * 0.03;
    const sheath = part(rbox(0.038, 0.78, 0.03, 0.012), new THREE.MeshPhysicalMaterial({ color: 0x0c0c0e, roughness: 0.25, clearcoat: 1 }));
    sheath.position.y = -0.05;
    const tsuba = part(cyl(0.04, 0.04, 0.012, 18), M.iron);
    tsuba.position.y = 0.35;
    const grip = part(cyl(0.017, 0.017, 0.24, 12), red);
    grip.position.y = 0.48;
    const pommel = part(sphere(0.02), M.iron);
    pommel.position.y = 0.61;
    sword.add(sheath, tsuba, grip, pommel);
    torso.add(sword);
  }

  // Layered pauldrons, a red armband and forearm guards.
  for (const a of [armR, armL]) {
    const p1 = part(sphere(0.1 * b), armor);
    p1.scale.set(1.15, 0.72, 1.15);
    p1.position.y = 0.02;
    const p2 = part(sphere(0.092 * b), armor);
    p2.scale.set(1.1, 0.55, 1.1);
    p2.position.y = -0.05;
    const band = part(cyl(0.074 * b, 0.074 * b, 0.045, 20), red);
    band.position.y = -0.14;
    a.upper.add(p1, p2, band);
    const guard = part(rbox(0.078 * b, 0.17, 0.08 * b, 0.025), armor);
    guard.position.y = -0.13;
    a.lower.add(guard);
  }
  // Cargo pockets, a thigh holster with red straps, knee pads and red-trimmed boots.
  const holster = part(rbox(0.05, 0.17, 0.1, 0.015), black);
  holster.position.set(-0.09 * b, -0.22, 0);
  const thighStrap = part(cyl(0.094 * b, 0.092 * b, 0.03, 20), red);
  thighStrap.position.y = -0.2;
  legR.upper.add(holster, thighStrap);
  const cargo = part(rbox(0.04, 0.13, 0.11, 0.015), black);
  cargo.position.set(0.092 * b, -0.24, 0);
  legL.upper.add(cargo);
  for (const l of [legR, legL]) {
    const pad = part(sphere(0.07 * b), armor);
    pad.scale.set(1, 0.95, 0.7);
    pad.position.set(0, -0.02, 0.045);
    l.lower.add(pad);
    const trim = part(cyl(0.069 * b, 0.069 * b, 0.025, 20), red);
    trim.position.y = 0.14;
    const sole = part(rbox(0.105 * b, 0.022, 0.27, 0.008), red);
    sole.position.set(0, -0.07, 0.06);
    l.end.add(trim, sole);
  }
  return [armor, red, black, scarfMat];
}

/** Layered street clothes: maybe a scarf, maybe a pack with a rolled blanket, or a shoulder bag. */
export function survivorKit({ torso, b }: Body, scarfColor: number, seed: number) {
  const out: THREE.MeshStandardMaterial[] = [];
  if (seed % 2 === 0) {
    const scarfMat = clothMat(scarfColor);
    const scarf = part(geo("scarfThin", () => new THREE.TorusGeometry(0.085, 0.035, 12, 28)), scarfMat);
    scarf.rotation.x = Math.PI / 2;
    scarf.scale.set(1.05 * b, 1, 1.3);
    scarf.position.set(0, 0.63, 0.005);
    const tail = part(rbox(0.06, 0.24, 0.02, 0.008), scarfMat);
    tail.position.set(0.05, 0.5, 0.15 * b);
    tail.rotation.z = 0.08;
    torso.add(scarf, tail);
    out.push(scarfMat);
  }
  const bag = Math.floor(seed / 5) % 3;
  if (bag === 0) {
    const packMat = leatherMat(0x4a3a2a);
    const pack = part(rbox(0.24 * b, 0.28, 0.12, 0.035), packMat);
    pack.position.set(0, 0.38, -0.15 * b - 0.05);
    const roll = part(capsule(0.05, 0.2), clothMat(0x5a5040));
    roll.rotation.z = Math.PI / 2;
    roll.position.set(0, 0.56, -0.15 * b - 0.05);
    torso.add(pack, roll);
    out.push(packMat);
  } else if (bag === 1) {
    // A satchel on a strap across the body.
    const bagMat = leatherMat(0x3a2c22);
    const strap = part(rbox(0.035, 0.62, 0.015, 0.005), bagMat);
    strap.position.set(0, 0.32, 0.15 * b);
    strap.rotation.z = -0.62;
    const satchel = part(rbox(0.22, 0.17, 0.07, 0.02), bagMat);
    satchel.position.set(0.2 * b, 0.02, 0.06);
    torso.add(strap, satchel);
    out.push(bagMat);
  }
  return out;
}

/** The hero's long black hooded cloak. It drapes over the shell and moves with him. */
export const CLOAK = (b: number, seed: number): CapeSpec => ({
  top: 0.75,
  length: 1.4,
  rNeck: 0.13,
  rShoulder: 0.41 * Math.max(1, b * 0.95),
  rHem: 0.58,
  sx: 1.1,
  cz: -0.05,
  wrapNeck: Math.PI * 1.75,
  wrapBody: Math.PI * 1.05,
  tatter: 0.14,
  seed,
});

/** The clan's tattered red cloth, hanging from one shoulder down the back. */
export const RAG = (b: number, seed: number): CapeSpec => ({
  top: 0.6,
  length: 0.95,
  rNeck: 0.15,
  rShoulder: 0.27 * b,
  rHem: 0.33 * b,
  sx: 1.1,
  cz: -0.02,
  wrapNeck: Math.PI * 0.9,
  wrapBody: Math.PI * 0.5,
  tatter: 0.2,
  seed,
});

export function makeCape(spec: CapeSpec, color: number, sideways = 0) {
  const m = clothMat(color);
  m.side = THREE.DoubleSide;
  const cape = new Cape(spec, m);
  cape.mesh.rotation.y = sideways;
  return { cape, mat: m };
}
