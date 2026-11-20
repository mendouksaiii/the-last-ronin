import * as THREE from "three";
import { addHood } from "./outfit";
import { charTex, clothMat, geo, part, rbox, sphere, type Look } from "./rig";

// Human heads for the people of the city: a sculpted skull with eye sockets, brow, cheekbones,
// a nose, lips and a jaw, set at true proportions (about 15 cm wide and 22 cm tall), with
// lidded eyes, brows, ears, and a range of hair, beards and hats picked from the person's seed.

type Build = "man" | "woman" | "broad";

interface Shape {
  w: number;
  h: number;
  d: number;
  jaw: number;
  nose: number;
  chin: number;
}

const SHAPES: Record<Build, Shape> = {
  man: { w: 0.074, h: 0.108, d: 0.095, jaw: 0.22, nose: 1, chin: 1 },
  woman: { w: 0.07, h: 0.103, d: 0.09, jaw: 0.34, nose: 0.78, chin: 0.6 },
  broad: { w: 0.079, h: 0.108, d: 0.097, jaw: 0.12, nose: 1.15, chin: 1.2 },
};

const gauss = (dx: number, dy: number, sx: number, sy = sx) => Math.exp(-((dx * dx) / (2 * sx * sx) + (dy * dy) / (2 * sy * sy)));
const smooth = (a: number, b: number, x: number) => {
  const k = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/** Nose height above the face along its length: a low bridge rising to the tip, then tucking under. */
function noseProfile(y: number) {
  if (y > 0.18) return 0;
  if (y > -0.3) return 0.035 + (0.18 - y) * 0.3;
  if (y > -0.44) return (0.035 + 0.48 * 0.3) * (1 - (-0.3 - y) / 0.14);
  return 0;
}

/** Maps a point on the unit sphere onto the sculpted head, in metres. z is forward, y up. */
function sculpt(x: number, y: number, z: number, s: Shape): [number, number, number] {
  // The lower face is squarer than a ball: the mouth and chin sit forward, under the nose.
  if (y < 0 && z > 0) z = Math.pow(z, 1 - 0.45 * -y);
  let px = x * s.w;
  const py = y * s.h;
  let pz = z * s.d;
  if (y < 0 && z > 0) pz += s.d * 0.2 * smooth(0, 0.6, z) * -y;
  // The jaw narrows towards the chin; the neck tucks in under the back of the skull.
  if (y < 0) px *= 1 - s.jaw * Math.pow(-y, 1.6);
  if (y < 0 && z < 0) pz *= 1 - 0.32 * -y * -z;
  if (y > 0 && z < 0) pz *= 1.06;
  // The face is flatter than the skull.
  const f = smooth(0.25, 0.8, z);
  pz -= f * s.d * 0.06 * (1 - Math.abs(y));
  let feat = 0;
  feat -= 0.1 * (gauss(x - 0.36, y - 0.12, 0.13, 0.1) + gauss(x + 0.36, y - 0.12, 0.13, 0.1));
  feat += 0.05 * gauss(x, y - 0.3, 0.42, 0.07);
  feat += 0.035 * (gauss(x - 0.5, y + 0.08, 0.14) + gauss(x + 0.5, y + 0.08, 0.14));
  const ny = noseProfile(y);
  feat += ny * s.nose * Math.exp(-(x * x) / (2 * Math.pow(0.07 + Math.max(0, -y - 0.15) * 0.25, 2)));
  feat += 0.035 * gauss(x, y + 0.53, 0.2, 0.045);
  feat -= 0.018 * gauss(x, y + 0.6, 0.18, 0.02);
  feat += 0.045 * s.chin * gauss(x, y + 0.86, 0.17, 0.1);
  pz += f * s.d * feat;
  return [px, py, pz];
}

const headGeo = (b: Build) =>
  geo(`humanHead:${b}`, () => {
    const g = new THREE.SphereGeometry(1, 40, 32);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const [x, y, z] = sculpt(pos.getX(i), pos.getY(i), pos.getZ(i), SHAPES[b]);
      pos.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    return g;
  });

/** A layer over the head (hair, beard, stubble): the sculpted surface pushed out, keeping only where `mask` holds. */
const shellGeo = (key: string, b: Build, grow: number, mask: (x: number, y: number, z: number) => boolean) =>
  geo(`humanShell:${b}:${key}`, () => {
    const src = new THREE.SphereGeometry(1, 40, 32);
    const pos = src.attributes.position as THREE.BufferAttribute;
    const keep: boolean[] = [];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      keep.push(mask(x, y, z));
      const [px, py, pz] = sculpt(x, y, z, SHAPES[b]);
      pos.setXYZ(i, px * grow, py * grow + (grow - 1) * 0.02, pz * grow);
    }
    const index = src.index!;
    const tris: number[] = [];
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i);
      const c = index.getX(i + 1);
      const d = index.getX(i + 2);
      if (keep[a] && keep[c] && keep[d]) tris.push(a, c, d);
    }
    src.setIndex(tris);
    src.computeVertexNormals();
    return src;
  });

/** Hairline: forehead at the front, above the ears at the sides, the nape at the back. */
const scalp = (front: number, nape: number) => (x: number, y: number, z: number) => {
  const t = smooth(-0.45, 0.4, z);
  const line = nape + (front - nape) * t;
  // Leave the ears clear.
  if (Math.abs(x) > 0.75 && y < 0.25 && y > -0.35 && z > -0.45) return false;
  return y > line - Math.abs(x) * 0.08;
};

const beardMask = (full: boolean) => (x: number, y: number, z: number) => {
  if (z < -0.15 || y > (full ? 0.05 : -0.2)) return false;
  if (Math.abs(x) > 0.92 && y > -0.25) return false;
  // Keep the lips and the nose clear.
  if (z > 0.5 && Math.abs(x) < 0.26 && y > -0.62 && y < -0.44) return false;
  if (Math.abs(x) < 0.22 && y > -0.44) return false;
  if (z > 0.4 && y > -0.12 && Math.abs(x) < 0.6) return false;
  return true;
};

export interface Person {
  build: Build;
  hair: "short" | "long" | "bun" | "pony" | "curly" | "buzz" | "bald";
  hairColor: number;
  beard: "none" | "stubble" | "beard" | "moustache";
  hat: "none" | "beanie" | "cap" | "hood";
  hatColor: number;
}

const HAIR = [0x16110e, 0x241912, 0x3a2618, 0x5a3c22, 0x7a5a36, 0x8e8a84, 0x2c201a];

/** Picks a person's features from a seed. */
export function person(seed: number, hatColor: number): Person {
  const r = (k: number, n: number) => Math.floor(seed / k) % n;
  const woman = r(3, 5) < 2;
  const build: Build = woman ? "woman" : r(7, 4) === 0 ? "broad" : "man";
  const hairs: Person["hair"][] = woman ? ["long", "bun", "pony", "long", "curly", "short"] : ["short", "short", "buzz", "curly", "bald", "short", "long"];
  const hat = (["none", "none", "none", "beanie", "cap", "hood", "none", "beanie"] as const)[r(11, 8)];
  const old = r(13, 6) === 0;
  return {
    build,
    hair: hairs[r(17, hairs.length)],
    hairColor: old ? 0x8e8a84 : HAIR[r(19, HAIR.length - 1)],
    beard: woman ? "none" : (["none", "stubble", "beard", "none", "moustache", "stubble"] as const)[r(23, 6)],
    hat,
    hatColor,
  };
}

/** Builds a human head into `head` (the neck joint). */
export function humanHead(head: THREE.Group, look: Look, skin: THREE.Material, who: Person) {
  const g = new THREE.Group();
  g.position.y = 0.02;
  head.add(g);
  const b = who.build;
  const s = SHAPES[b];
  g.add(part(headGeo(b), skin));

  // Eyes: glossy whites with a dark iris, under a skin-coloured upper lid.
  const sclera = new THREE.MeshPhysicalMaterial({ color: 0xe6ddd2, roughness: 0.15, clearcoat: 1 });
  const iris = new THREE.MeshStandardMaterial({ color: [0x2a1a10, 0x3a2a1a, 0x2a3a4a, 0x3a4a2a][(look.seed ?? 0) % 4], roughness: 0.25 });
  const lid = geo("lid", () => new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.45));
  for (const side of [-1, 1]) {
    const [ex, ey, ez] = sculpt(side * 0.36, 0.12, Math.sqrt(1 - 0.36 * 0.36 - 0.12 * 0.12), s);
    const eye = new THREE.Mesh(sphere(0.0115), sclera);
    eye.position.set(ex, ey, ez - 0.006);
    const ir = new THREE.Mesh(sphere(0.0062), iris);
    ir.position.set(0, 0, 0.0075);
    eye.add(ir);
    const l = part(lid, skin);
    l.scale.setScalar(0.0128);
    l.rotation.x = 0.35;
    l.position.copy(eye.position);
    g.add(eye, l);
  }

  // Ears.
  for (const side of [-1, 1]) {
    const ear = part(sphere(0.028), skin);
    ear.scale.set(0.32, 1, 0.62);
    ear.position.set(side * s.w * 0.97, 0.0, -0.008);
    ear.rotation.y = -side * 0.35;
    g.add(ear);
  }

  // Hair, brows and beard.
  const hairMat = clothMat(who.hairColor);
  hairMat.roughness = 0.55;
  hairMat.sheen = 0.8;
  hairMat.normalMap = charTex().fabric;
  hairMat.normalScale.set(1.2, 1.2);
  const brow = part(rbox(0.026, 0.0055, 0.008, 0.0025), hairMat);
  for (const side of [-1, 1]) {
    const [bx, by, bz] = sculpt(side * 0.36, 0.3, Math.sqrt(1 - 0.36 * 0.36 - 0.09), s);
    const br = brow.clone();
    br.position.set(bx, by, bz + 0.002);
    br.rotation.set(-0.2, -side * 0.25, side * -0.12);
    g.add(br);
  }
  const hatted = who.hat !== "none";
  switch (who.hair) {
    case "bald":
      break;
    case "buzz":
      g.add(part(shellGeo("buzz", b, 1.012, scalp(0.6, -0.4)), hairMat));
      break;
    case "curly": {
      const curlMat = hairMat.clone();
      curlMat.normalScale.set(3, 3);
      const curls = part(shellGeo("curly", b, 1.16, scalp(0.52, -0.45)), curlMat);
      g.add(curls);
      break;
    }
    default: {
      g.add(part(shellGeo(`cap${who.build}`, b, 1.045, scalp(0.56, -0.45)), hairMat));
      if (who.hair === "long" && !(who.hat === "hood")) {
        // Hair falling to the shoulders behind, framing the face.
        const fall = part(rbox(s.w * 2.1, 0.2, 0.05, 0.022), hairMat);
        fall.position.set(0, -0.09, -s.d * 0.72);
        fall.rotation.x = 0.12;
        g.add(fall);
        for (const side of [-1, 1]) {
          const lock = part(rbox(0.022, 0.15, 0.05, 0.01), hairMat);
          lock.position.set(side * s.w * 0.95, -0.05, -0.012);
          g.add(lock);
        }
      } else if (who.hair === "bun" && !hatted) {
        const bun = part(sphere(0.034), hairMat);
        bun.position.set(0, s.h * 0.82, -s.d * 0.62);
        g.add(bun);
      } else if (who.hair === "pony" && who.hat !== "hood") {
        const tie = part(sphere(0.022), hairMat);
        tie.position.set(0, s.h * 0.25, -s.d * 1.02);
        const tail = part(rbox(0.035, 0.16, 0.03, 0.014), hairMat);
        tail.position.set(0, s.h * 0.25 - 0.085, -s.d * 1.08);
        tail.rotation.x = 0.2;
        g.add(tie, tail);
      }
    }
  }
  switch (who.beard) {
    case "stubble": {
      const st = new THREE.MeshStandardMaterial({ color: new THREE.Color(who.hairColor).lerp(new THREE.Color(0x6a5040), 0.3), roughness: 0.9, transparent: true, opacity: 0.55, normalMap: charTex().fabric });
      g.add(part(shellGeo("stubble", b, 1.006, beardMask(true)), st));
      break;
    }
    case "beard":
      g.add(part(shellGeo("beard", b, 1.05, beardMask(true)), hairMat));
      break;
    case "moustache": {
      const [mx, my, mz] = sculpt(0, -0.42, 0.95, s);
      const m = part(rbox(0.04, 0.009, 0.012, 0.004), hairMat);
      m.position.set(mx, my, mz + 0.003);
      g.add(m);
      break;
    }
  }

  // Hats.
  const hatMat = clothMat(who.hatColor);
  if (who.hat === "beanie" || who.hat === "cap") {
    const dome = part(geo("hatDome", () => new THREE.SphereGeometry(1, 28, 12, 0, Math.PI * 2, 0, Math.PI * 0.5)), hatMat);
    dome.scale.set(s.w * 1.16, s.h * (who.hat === "beanie" ? 1.08 : 0.92), s.d * 1.12);
    dome.position.set(0, s.h * 0.2, -0.004);
    dome.rotation.x = -0.12;
    g.add(dome);
    if (who.hat === "beanie") {
      const cuff = part(geo("hatCuff", () => new THREE.CylinderGeometry(1, 1, 1, 28, 1, true)), hatMat);
      hatMat.side = THREE.DoubleSide;
      cuff.scale.set(s.w * 1.18, 0.035, s.d * 1.14);
      cuff.position.set(0, s.h * 0.24, -0.004);
      cuff.rotation.x = -0.12;
      g.add(cuff);
    } else {
      const brim = part(rbox(s.w * 1.7, 0.007, 0.075, 0.003), hatMat);
      brim.position.set(0, s.h * 0.3, s.d * 1.12);
      brim.rotation.x = 0.12;
      g.add(brim);
    }
  } else if (who.hat === "hood") {
    hatMat.side = THREE.DoubleSide;
    addHood(g, hatMat, 0.125, 0.95);
  }
  return [hairMat, hatMat];
}
