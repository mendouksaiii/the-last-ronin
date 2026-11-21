import * as THREE from "three";
import { Cape, type CapeSpec } from "./cloak";
import { capsule, clothMat, cyl, geo, leatherMat, mats, part, rbox, sphere, type Gear, type Limb } from "./rig";

// Clothing and kit layered over the base body:
// 1. roninKit: Ren's landing-page warrior gear (crossed chest harness with brass buckles,
//    buckled waist sash & tattered loincloth, crimson bicep bands, weathered cloth arm/leg wraps,
//    dark elbow/knee pads, and brotherhood weapons strapped to the carapace).
// 2. tacticalKit: Clan ninja/foot gear (horned oni hood, faceplate, chest webbing, pauldrons).
// 3. survivorKit: Layered civilian jackets, lapels, scarves, satchels and backpacks.

/** Black armour plates: lacquered, a little scuffed. */
const armorMat = () => new THREE.MeshPhysicalMaterial({ color: 0x18191d, roughness: 0.34, metalness: 0.42, clearcoat: 0.65, clearcoatRoughness: 0.4 });
/** Worn leather straps and pouches. */
const redKit = (color: number) => {
  const m = leatherMat(color);
  m.roughness = 0.6;
  return m;
};

/** A hood: a sculpted partial sphere open at the face, draped low at the back of the neck. */
export function addHood(head: THREE.Object3D, m: THREE.MeshStandardMaterial, r: number, open = 0.95) {
  m.side = THREE.DoubleSide;
  const g = geo(`hood2:${r}:${open}`, () => new THREE.SphereGeometry(r, 28, 18, Math.PI / 2 + open, Math.PI * 2 - open * 2, 0, Math.PI * 0.7));
  const hood = part(g, m);
  hood.scale.set(1.06, 1.16, 1.18);
  hood.position.set(0, 0.032, -0.028);
  head.add(hood);
  // Subtle pointed ronin hood crown.
  const peak = part(sphere(r * 0.42), m);
  peak.scale.set(0.95, 0.78, 1.38);
  peak.position.set(0, 0.03 + r * 0.94, -0.035);
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

/**
 * Ren's landing-page warrior kit: crossed leather chest & shoulder harness with brass buckles,
 * dark cloth waist sash with buckled belt and tattered loincloth, crimson bicep bands,
 * weathered tan cloth forearm/hand/thigh/shin wrappings, dark elbow & knee pads,
 * and brotherhood weapons strapped across the carapace.
 */
export function roninKit({ torso, armR, armL, legR, legL, b }: Body, accentColor: number, equipped: Gear = "katana", cloakColor?: number) {
  const M = mats();
  const padMat = new THREE.MeshPhysicalMaterial({ color: 0x222428, roughness: 0.52, metalness: 0.18, clearcoat: 0.12 });
  const wrapCloth = clothMat(0x948a79);
  const darkWrap = clothMat(0x1e1c1e);
  const bandCloth = clothMat(accentColor);
  const leather = leatherMat(0x281e18);
  const brass = new THREE.MeshStandardMaterial({ color: 0x9c7c48, metalness: 0.84, roughness: 0.36 });
  const chainIron = new THREE.MeshStandardMaterial({ color: 0x3b3e44, metalness: 0.88, roughness: 0.42 });
  const extra: THREE.MeshStandardMaterial[] = [padMat, wrapCloth, darkWrap, bandCloth, leather, brass, chainIron];

  if (cloakColor !== undefined) {
    // Draped shoulder collar bridging the hood and flowing cape while leaving the chest X-harness exposed.
    const collarMat = clothMat(cloakColor);
    const collar = part(geo(`roninCollar:${b.toFixed(2)}`, () => new THREE.TorusGeometry(0.145, 0.048, 12, 28, Math.PI * 1.45)), collarMat);
    collar.rotation.set(Math.PI / 2 + 0.08, 0, Math.PI * 0.775);
    collar.scale.set(1.16 * b, 1.24, 0.88);
    collar.position.set(0, 0.67, -0.02);
    torso.add(collar);
    extra.push(collarMat);
  }

  // 1. Crossed Leather Chest & Shoulder Harness with Brass Buckles.
  for (const side of [-1, 1]) {
    const chestStrap = part(rbox(0.048, 0.56, 0.018, 0.006), leather);
    chestStrap.position.set(0, 0.34, 0.172);
    chestStrap.rotation.z = side * 0.56;
    const shoulderArch = part(rbox(0.052, 0.16, 0.14, 0.012), leather);
    shoulderArch.position.set(side * 0.128 * b, 0.555, 0.02);
    shoulderArch.rotation.set(0.32, 0, -side * 0.2);
    const chestBuckle = part(rbox(0.06, 0.044, 0.024, 0.006), brass);
    chestBuckle.position.set(side * 0.072 * b, 0.435, 0.18);
    chestBuckle.rotation.z = -side * 0.48;
    const flankStrap = part(rbox(0.05, 0.04, 0.28, 0.008), leather);
    flankStrap.position.set(side * 0.215 * b, 0.22, -0.02);
    torso.add(chestStrap, shoulderArch, chestBuckle, flankStrap);
  }
  // Back shell harness cross-strap & lower shell cinch.
  const backStrap = part(rbox(0.38 * b, 0.046, 0.036, 0.01), leather);
  backStrap.position.set(0, 0.24, -0.31);
  const backDiag = part(rbox(0.048, 0.62, 0.024, 0.008), leather);
  backDiag.position.set(0, 0.36, -0.335);
  backDiag.rotation.z = 0.52;
  torso.add(backStrap, backDiag);

  // 2. Layered Dark Waist Sash, Off-Center Buckled Leather Belt & Tattered Loincloth.
  const sash = part(cyl(0.184 * b, 0.198 * b, 0.12, 28), darkWrap);
  sash.scale.z = 0.88;
  sash.position.y = 0.078;
  const sashKnot = part(sphere(0.052), darkWrap);
  sashKnot.scale.set(1.25, 0.85, 0.85);
  sashKnot.position.set(-0.015, 0.07, 0.168 * b);
  const waistBelt = part(cyl(0.19 * b, 0.194 * b, 0.052, 28), leather);
  waistBelt.scale.z = 0.9;
  waistBelt.position.y = 0.072;
  const beltBuckle = part(rbox(0.068, 0.058, 0.026, 0.008), brass);
  beltBuckle.position.set(0.055 * b, 0.074, 0.174 * b);
  beltBuckle.rotation.y = 0.28;
  torso.add(sash, sashKnot, waistBelt, beltBuckle);

  // Tattered hanging front & back loincloth strips (angled clear of running/crouching thighs).
  const strips: [number, number, number, number, number][] = [
    [0, 0.155 * b, 0.085, 0.26, -0.15],
    [-0.048 * b, 0.148 * b, 0.055, 0.22, -0.16],
    [0.048 * b, 0.148 * b, 0.058, 0.24, -0.16],
    [0, -0.155 * b, 0.095, 0.25, 0.16],
    [-0.052 * b, -0.148 * b, 0.055, 0.21, 0.17],
    [0.052 * b, -0.148 * b, 0.055, 0.21, 0.17],
  ];
  for (let i = 0; i < strips.length; i++) {
    const [sx, sz, w, h, tilt] = strips[i];
    const flap = part(rbox(w, h, 0.014, 0.004), darkWrap);
    flap.position.set(sx, 0.05 - h * 0.5, sz);
    flap.rotation.x = tilt;
    flap.rotation.z = (i % 2 ? 1 : -1) * 0.06;
    const tip = part(rbox(w * 0.55, 0.065, 0.012, 0.003), darkWrap);
    tip.position.set(sx * 1.05, 0.04 - h - 0.02, sz + (sz > 0 ? 0.032 : -0.032));
    tip.rotation.x = tilt * 1.15;
    torso.add(flap, tip);
  }

  // 3. Arms: Crimson Bicep Bands, Dark Elbow Pads, Layered Forearm & Hand Wraps.
  for (const [arm, side] of [[armR, -1], [armL, 1]] as const) {
    // Tight crimson cloth band around upper arm (shoulders/delts stay bare muscular turtle skin).
    const bicepBand = part(cyl(0.071 * b, 0.067 * b, 0.068, 18), bandCloth);
    bicepBand.position.y = -0.13;
    const bicepFold = part(geo(`bfold:${b.toFixed(2)}`, () => new THREE.TorusGeometry(0.069 * b, 0.011, 8, 20)), bandCloth);
    bicepFold.rotation.x = Math.PI / 2;
    bicepFold.position.y = -0.11;
    arm.upper.add(bicepBand, bicepFold);

    // Dark contoured elbow pad on back of joint.
    const elbowPad = part(sphere(0.056 * b), padMat);
    elbowPad.scale.set(0.95, 1.05, 0.65);
    elbowPad.position.set(0, -0.01, -0.042 * b);
    arm.lower.add(elbowPad);

    // Layered weathered cloth forearm wraps from mid-forearm down to the wrist.
    const forearmWrap = part(cyl(0.057 * b, 0.047 * b, 0.16, 18), wrapCloth);
    forearmWrap.position.y = -0.19;
    arm.lower.add(forearmWrap);
    for (let r = 0; r < 3; r++) {
      const ring = part(
        geo(`awrap:${b.toFixed(2)}:${r}`, () => new THREE.TorusGeometry((0.054 - r * 0.0035) * b, 0.009, 7, 18)),
        wrapCloth,
      );
      ring.rotation.x = Math.PI / 2 + (r % 2 ? 0.08 : -0.08);
      ring.position.y = -0.135 - r * 0.05;
      arm.lower.add(ring);
    }

    // Wrist/knuckle cloth wrap over palm leaving muscular turtle fingers bare.
    const wristCuff = part(cyl(0.047 * b, 0.046 * b, 0.05, 16), wrapCloth);
    wristCuff.position.y = 0.01;
    const palmWrap = part(rbox(0.072 * b, 0.072, 0.038, 0.014), wrapCloth);
    palmWrap.position.set(side * 0.002, -0.04, 0.002);
    arm.end.add(wristCuff, palmWrap);
  }

  // 4. Legs: Thigh Wraps, Dark Rounded Knee Pads & Shin/Ankle Cloth Wraps.
  for (const [leg, side] of [[legR, -1], [legL, 1]] as const) {
    const thighWrap = part(cyl(0.092 * b, 0.086 * b, 0.135, 18), wrapCloth);
    thighWrap.position.y = -0.22;
    const thighStrap = part(cyl(0.094 * b, 0.094 * b, 0.024, 18), leather);
    thighStrap.position.y = -0.175;
    leg.upper.add(thighWrap, thighStrap);
    if (side === -1) {
      const pouch = part(rbox(0.042, 0.095, 0.068, 0.012), leather);
      pouch.position.set(-0.086 * b, -0.22, 0);
      leg.upper.add(pouch);
    }

    // Dark rounded knee pad with strap behind knee.
    const kneePad = part(sphere(0.074 * b), padMat);
    kneePad.scale.set(1.02, 1.08, 0.68);
    kneePad.position.set(0, -0.02, 0.048);
    const kneeStrap = part(cyl(0.072 * b, 0.07 * b, 0.036, 18), leather);
    kneeStrap.position.y = -0.025;
    leg.lower.add(kneePad, kneeStrap);

    // Layered weathered cloth wraps on lower shin & ankle.
    const shinWrap = part(cyl(0.066 * b, 0.055 * b, 0.22, 18), wrapCloth);
    shinWrap.position.y = -0.34;
    leg.lower.add(shinWrap);
    for (let r = 0; r < 3; r++) {
      const ring = part(
        geo(`lwrap:${b.toFixed(2)}:${r}`, () => new THREE.TorusGeometry((0.064 - r * 0.0035) * b, 0.01, 7, 18)),
        wrapCloth,
      );
      ring.rotation.x = Math.PI / 2 + (r % 2 ? -0.07 : 0.07);
      ring.position.y = -0.255 - r * 0.068;
      leg.lower.add(ring);
    }
    const ankleWrap = part(cyl(0.056 * b, 0.058 * b, 0.075, 16), wrapCloth);
    ankleWrap.position.set(0, 0.012, 0.004);
    leg.end.add(ankleWrap);
  }

  // 5. Carried Brotherhood Weapons & Heavy Iron Chain on the Carapace.
  // Heavy iron chain draped over the top ridge & left shoulder of the carapace.
  const linkGeo = geo("roninChainLink", () => new THREE.TorusGeometry(0.023, 0.0075, 6, 12));
  const linkCount = 13;
  for (let i = 0; i < linkCount; i++) {
    const t = i / (linkCount - 1);
    const link = part(linkGeo, chainIron);
    const lx = (-0.06 + t * 0.34) * b;
    const ly = 0.68 - Math.pow(t, 1.35) * 0.62;
    const lz = -0.25 - Math.sin(t * Math.PI) * 0.14;
    link.position.set(lx, ly, lz);
    link.rotation.set(0.5 + t * 0.8, i % 2 ? 0.35 : 1.45, -0.35);
    torso.add(link);
  }

  // Long oak Bo Staff strapped vertically/diagonally behind the left side of the shell (unless equipped).
  if (equipped !== "bo") {
    const boGrp = new THREE.Group();
    boGrp.position.set(0.18 * b, 0.46, -0.32);
    boGrp.rotation.set(-0.04, 0, 0.11);
    const staff = part(cyl(0.021, 0.021, 1.64, 12), M.wood);
    const topCap = part(cyl(0.024, 0.024, 0.08, 12), M.iron);
    topCap.position.y = 0.8;
    const botCap = part(cyl(0.024, 0.024, 0.08, 12), M.iron);
    botCap.position.y = -0.8;
    const grip = part(cyl(0.023, 0.023, 0.24, 12), darkWrap);
    boGrp.add(staff, topCap, botCap, grip);
    torso.add(boGrp);
  }

  // Hanging Nunchaku off the left-rear waist/shell harness (unless equipped).
  if (equipped !== "nunchaku") {
    const nunGrp = new THREE.Group();
    nunGrp.position.set(0.24 * b, 0.14, -0.21);
    nunGrp.rotation.set(0.1, 0.15, -0.06);
    const stickA = part(cyl(0.017, 0.019, 0.28, 10), M.wood);
    stickA.position.set(-0.028, -0.18, 0);
    stickA.rotation.z = -0.08;
    const stickB = part(cyl(0.017, 0.019, 0.28, 10), M.wood);
    stickB.position.set(0.028, -0.22, -0.015);
    stickB.rotation.z = 0.07;
    const ring = part(geo("nunChain", () => new THREE.TorusGeometry(0.025, 0.005, 6, 12)), chainIron);
    ring.position.set(0, -0.03, 0);
    nunGrp.add(ring, stickA, stickB);
    torso.add(nunGrp);
  }

  // Stowed Katana Scabbard + Hilt on the back when wielding another weapon (live sheath handles "katana").
  if (equipped !== "katana") {
    const stowed = new THREE.Group();
    const dir = new THREE.Vector3(0.45, -0.85, -0.25).normalize();
    stowed.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    stowed.position.set(-0.15 * b, 0.62, -0.34).addScaledVector(dir, -0.15);
    const lacquer = new THREE.MeshPhysicalMaterial({ color: 0x120a0a, roughness: 0.25, clearcoat: 1 });
    const scabbard = part(rbox(0.036, 0.054, 0.82, 0.014), lacquer);
    scabbard.position.z = 0.56;
    const tsuba = part(cyl(0.044, 0.044, 0.012, 16), M.steelWrap);
    tsuba.rotation.x = Math.PI / 2;
    tsuba.position.z = 0.14;
    const grip = part(rbox(0.03, 0.034, 0.25, 0.01), darkWrap);
    grip.position.z = 0.01;
    stowed.add(scabbard, tsuba, grip);
    torso.add(stowed);
    extra.push(lacquer);
  }

  return extra;
}

/** Tactical gear of the clan, after the concept art: black fatigues with red kit. */
export function tacticalKit({ torso, armR, armL, legR, legL, b }: Body, accentColor: number, swordOnBack: boolean, seed: number) {
  const M = mats();
  const armor = armorMat();
  const red = redKit(accentColor);
  const black = leatherMat(0x141416);
  const scarfMat = clothMat(0x22252b);

  const scarf = part(geo("scarf", () => new THREE.TorusGeometry(0.1, 0.05, 12, 28)), scarfMat);
  scarf.rotation.x = Math.PI / 2;
  scarf.scale.set(1.15 * b, 1, 1.4);
  scarf.position.set(0, 0.62, 0.0);
  const drape = part(sphere(0.075), scarfMat);
  drape.scale.set(1.4, 0.9, 0.7);
  drape.position.set(0, 0.57, 0.12 * b);
  torso.add(scarf, drape);

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

/** Layered street clothes for human civilians & quest givers: jacket lapels, shirt, scarf, satchel or pack. */
export function survivorKit({ torso, b }: Body, scarfColor: number, seed: number, shirtColor = 0xc8c0b4) {
  const out: THREE.MeshStandardMaterial[] = [];
  const shirtMat = clothMat(shirtColor);
  out.push(shirtMat);

  // Inner shirt/sweater chest V-panel & collar lapels so jackets read as real layered clothing.
  const innerChest = part(rbox(0.1 * b, 0.28, 0.04, 0.015), shirtMat);
  innerChest.position.set(0, 0.44, 0.108 * b);
  torso.add(innerChest);

  if (seed % 2 === 0) {
    const scarfMat = clothMat(scarfColor);
    const scarf = part(geo("scarfThin", () => new THREE.TorusGeometry(0.082, 0.032, 12, 28)), scarfMat);
    scarf.rotation.x = Math.PI / 2;
    scarf.scale.set(1.05 * b, 1, 1.28);
    scarf.position.set(0, 0.625, 0.006);
    const tail = part(rbox(0.055, 0.23, 0.02, 0.008), scarfMat);
    tail.position.set(0.045, 0.49, 0.14 * b);
    tail.rotation.z = 0.08;
    torso.add(scarf, tail);
    out.push(scarfMat);
  }

  const bag = Math.floor(seed / 5) % 3;
  if (bag === 0) {
    const packMat = leatherMat(0x4a3a2a);
    const pack = part(rbox(0.24 * b, 0.28, 0.12, 0.035), packMat);
    pack.position.set(0, 0.37, -0.14 * b - 0.05);
    const rollMat = clothMat(0x5a5040);
    const roll = part(capsule(0.048, 0.2), rollMat);
    roll.rotation.z = Math.PI / 2;
    roll.position.set(0, 0.55, -0.14 * b - 0.05);
    torso.add(pack, roll);
    out.push(packMat, rollMat);
  } else if (bag === 1) {
    const bagMat = leatherMat(0x3a2c22);
    const strap = part(rbox(0.032, 0.6, 0.015, 0.005), bagMat);
    strap.position.set(0, 0.32, 0.135 * b);
    strap.rotation.z = -0.6;
    const satchel = part(rbox(0.21, 0.16, 0.07, 0.02), bagMat);
    satchel.position.set(0.19 * b, 0.03, 0.05);
    torso.add(strap, satchel);
    out.push(bagMat);
  }
  return out;
}

/** The hero's long black hooded cloak. Arched neatly over the carapace so it never clips, open in front for the harness. */
export const CLOAK = (b: number, seed: number): CapeSpec => ({
  top: 0.71,
  length: 1.32,
  rNeck: 0.15,
  rShoulder: 0.37 * Math.max(1, b * 0.94),
  rHem: 0.54,
  sx: 1.08,
  cz: -0.06,
  wrapNeck: Math.PI * 1.52,
  wrapBody: Math.PI * 0.94,
  tatter: 0.16,
  seed,
  archBack: 0.09,
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
