import * as THREE from "three";
import { addHood } from "./outfit";
import { capsule, charTex, clothMat, geo, part, rbox, sphere, type Look } from "./rig";

// Human heads for the people of the city: sculpted skull with natural eye sockets, subtle brow,
// cheekbones, nose bridge, upper/lower lips, recessed lidded eyes, contoured ears, and layered
// hair/beards/hats so every NPC reads unmistakably human.

type Build = "man" | "woman" | "broad";

interface Shape {
  w: number;
  h: number;
  d: number;
  jaw: number;
  nose: number;
  chin: number;
  brow: number;
}

const SHAPES: Record<Build, Shape> = {
  man: { w: 0.075, h: 0.11, d: 0.096, jaw: 0.24, nose: 1.0, chin: 1.0, brow: 1.0 },
  woman: { w: 0.07, h: 0.105, d: 0.09, jaw: 0.36, nose: 0.8, chin: 0.62, brow: 0.65 },
  broad: { w: 0.08, h: 0.11, d: 0.099, jaw: 0.14, nose: 1.12, chin: 1.2, brow: 1.2 },
};

const gauss = (dx: number, dy: number, sx: number, sy = sx) => Math.exp(-((dx * dx) / (2 * sx * sx) + (dy * dy) / (2 * sy * sy)));
const smooth = (a: number, b: number, x: number) => {
  const k = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/** Nose profile along y: soft bridge rising to a sculpted tip and tucking into philtrum. */
function noseProfile(y: number) {
  if (y > 0.18) return 0;
  if (y > -0.27) return 0.03 + (0.18 - y) * 0.29;
  if (y > -0.4) return (0.03 + 0.45 * 0.29) * (1 - (-0.27 - y) / 0.13);
  return 0;
}

/** Maps a unit sphere point onto a sculpted human head (in metres; +z forward, +y up). */
function sculpt(x: number, y: number, z: number, s: Shape): [number, number, number] {
  if (y < 0 && z > 0) z = Math.pow(z, 1 - 0.42 * -y);
  let px = x * s.w;
  const py = y * s.h;
  let pz = z * s.d;
  if (y < 0 && z > 0) pz += s.d * 0.18 * smooth(0, 0.6, z) * -y;
  // Natural jaw taper & neck tuck under occiput.
  if (y < 0) px *= 1 - s.jaw * Math.pow(-y, 1.55);
  if (y < 0 && z < 0) pz *= 1 - 0.34 * -y * -z;
  if (y > 0 && z < 0) pz *= 1.07;
  // Subtle temple narrowing for cranial realism.
  if (y > 0.05 && y < 0.6 && z > -0.1) px *= 1 - 0.045 * gauss(y - 0.3, 0, 0.22);

  const f = smooth(0.22, 0.78, z);
  pz -= f * s.d * 0.065 * (1 - Math.abs(y));
  let feat = 0;
  // Recessed eye sockets.
  feat -= 0.125 * (gauss(x - 0.35, y - 0.11, 0.14, 0.11) + gauss(x + 0.35, y - 0.11, 0.14, 0.11));
  // Brow ridge.
  feat += 0.055 * s.brow * gauss(x, y - 0.28, 0.44, 0.075);
  // Cheekbones.
  feat += 0.042 * (gauss(x - 0.48, y + 0.07, 0.15) + gauss(x + 0.48, y + 0.07, 0.15));
  // Nose bridge + nostrils.
  const ny = noseProfile(y);
  feat += ny * s.nose * Math.exp(-(x * x) / (2 * Math.pow(0.065 + Math.max(0, -y - 0.14) * 0.22, 2)));
  feat += 0.022 * (gauss(x - 0.1, y + 0.29, 0.055, 0.045) + gauss(x + 0.1, y + 0.29, 0.055, 0.045));
  // Upper & lower lips with a clean mouth line.
  feat += 0.042 * gauss(x, y + 0.49, 0.18, 0.036);
  feat -= 0.024 * gauss(x, y + 0.555, 0.17, 0.018);
  feat += 0.034 * gauss(x, y + 0.61, 0.15, 0.034);
  // Chin prominence.
  feat += 0.048 * s.chin * gauss(x, y + 0.85, 0.17, 0.11);
  pz += f * s.d * feat;
  return [px, py, pz];
}

const headGeo = (b: Build) =>
  geo(`humanHead2:${b}`, () => {
    const g = new THREE.SphereGeometry(1, 44, 34);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const [x, y, z] = sculpt(pos.getX(i), pos.getY(i), pos.getZ(i), SHAPES[b]);
      pos.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    return g;
  });

/** A close-fitting sculpted shell (hair cap, beard, stubble) following the head contour. */
const shellGeo = (key: string, b: Build, grow: number, mask: (x: number, y: number, z: number) => boolean) =>
  geo(`humanShell2:${b}:${key}`, () => {
    const src = new THREE.SphereGeometry(1, 40, 32);
    const pos = src.attributes.position as THREE.BufferAttribute;
    const keep: boolean[] = [];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      keep.push(mask(x, y, z));
      const [px, py, pz] = sculpt(x, y, z, SHAPES[b]);
      pos.setXYZ(i, px * grow, py * grow + (grow - 1) * 0.016, pz * grow);
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

const scalp = (front: number, nape: number) => (x: number, y: number, z: number) => {
  const t = smooth(-0.45, 0.4, z);
  const line = nape + (front - nape) * t;
  if (Math.abs(x) > 0.74 && y < 0.25 && y > -0.35 && z > -0.42) return false;
  return y > line - Math.abs(x) * 0.08;
};

const beardMask = () => (x: number, y: number, z: number) => {
  if (z < -0.12 || y > 0.04) return false;
  if (Math.abs(x) > 0.9 && y > -0.25) return false;
  if (z > 0.48 && Math.abs(x) < 0.26 && y > -0.64 && y < -0.44) return false;
  if (Math.abs(x) < 0.22 && y > -0.44) return false;
  if (z > 0.42 && y > -0.14 && Math.abs(x) < 0.58) return false;
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

/** Builds an anatomically sculpted human head into `head` (the neck joint). */
export function humanHead(head: THREE.Group, look: Look, skin: THREE.Material, who: Person) {
  const g = new THREE.Group();
  g.position.y = 0.015;
  head.add(g);
  const b = who.build;
  const s = SHAPES[b];
  g.add(part(headGeo(b), skin));

  // Eyes recessed cleanly in sockets with sclera, iris, pupil and upper/lower eyelid folds.
  const sclera = new THREE.MeshPhysicalMaterial({ color: 0xebe4da, roughness: 0.14, clearcoat: 1 });
  const iris = new THREE.MeshStandardMaterial({ color: [0x2a1a10, 0x3a2a1a, 0x2b3e4f, 0x3a4a2a][(look.seed ?? 0) % 4], roughness: 0.25 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.1 });
  const upperLid = geo("lidUp", () => new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.44));
  const lowerLid = geo("lidLo", () => new THREE.SphereGeometry(1, 16, 6, 0, Math.PI * 2, Math.PI * 0.62, Math.PI * 0.34));

  for (const side of [-1, 1]) {
    const [ex, ey, ez] = sculpt(side * 0.35, 0.11, Math.sqrt(1 - 0.35 * 0.35 - 0.11 * 0.11), s);
    const eye = new THREE.Mesh(sphere(0.0108), sclera);
    eye.position.set(ex, ey, ez - 0.0082);
    const ir = new THREE.Mesh(sphere(0.0056), iris);
    ir.position.set(0, 0, 0.0068);
    const pu = new THREE.Mesh(sphere(0.0028), pupilMat);
    pu.position.set(0, 0, 0.004);
    ir.add(pu);
    eye.add(ir);
    const ul = part(upperLid, skin);
    ul.scale.set(0.0124, 0.012, 0.0124);
    ul.rotation.x = 0.36;
    ul.position.copy(eye.position);
    const ll = part(lowerLid, skin);
    ll.scale.set(0.012, 0.0115, 0.012);
    ll.rotation.x = -0.18;
    ll.position.copy(eye.position);
    g.add(eye, ul, ll);
  }

  // Soft natural lip tint over the mouth ridge.
  const skinCol = (skin as THREE.MeshPhysicalMaterial).color ?? new THREE.Color(0xc9967a);
  const lipMat = new THREE.MeshPhysicalMaterial({
    color: skinCol.clone().lerp(new THREE.Color(0x7c3634), 0.34),
    roughness: 0.48,
    clearcoat: 0.12,
  });
  const [lx, ly, lz] = sculpt(0, -0.55, Math.sqrt(1 - 0.55 * 0.55), s);
  const mouth = part(capsule(0.0055, 0.022), lipMat);
  mouth.rotation.z = Math.PI / 2;
  mouth.scale.set(0.75, 1, 0.65);
  mouth.position.set(lx, ly, lz - 0.0025);
  g.add(mouth);

  // Contoured ears.
  for (const side of [-1, 1]) {
    const ear = part(sphere(0.026), skin);
    ear.scale.set(0.28, 1.02, 0.58);
    ear.position.set(side * s.w * 0.96, -0.002, -0.008);
    ear.rotation.y = -side * 0.36;
    g.add(ear);
  }

  // Hair, eyebrows and facial hair.
  const hairMat = clothMat(who.hairColor);
  hairMat.roughness = 0.58;
  hairMat.sheen = 0.75;
  hairMat.normalMap = charTex().fabric;
  hairMat.normalScale.set(1.1, 1.1);

  const browMat = hairMat;
  for (const side of [-1, 1]) {
    const [bx, by, bz] = sculpt(side * 0.34, 0.285, Math.sqrt(1 - 0.34 * 0.34 - 0.08), s);
    const br = part(capsule(0.0032, 0.022), browMat);
    br.position.set(bx, by, bz - 0.001);
    br.rotation.set(0, -side * 0.22, Math.PI / 2 - side * 0.14);
    g.add(br);
  }

  const hatted = who.hat !== "none";
  switch (who.hair) {
    case "bald":
      break;
    case "buzz":
      g.add(part(shellGeo("buzz", b, 1.014, scalp(0.58, -0.4)), hairMat));
      break;
    case "curly": {
      const curlMat = hairMat.clone();
      curlMat.normalScale.set(2.8, 2.8);
      g.add(part(shellGeo("curly", b, 1.15, scalp(0.52, -0.45)), curlMat));
      // Soft curly fringe tufts if unhatted.
      if (!hatted) {
        for (let i = -2; i <= 2; i++) {
          const puff = part(sphere(0.024), curlMat);
          puff.position.set(i * 0.022, s.h * 0.65, s.d * 0.74 - Math.abs(i) * 0.01);
          g.add(puff);
        }
      }
      break;
    }
    default: {
      g.add(part(shellGeo(`cap${who.build}`, b, 1.05, scalp(0.54, -0.46)), hairMat));
      // Natural side temple locks / fringe when unhatted.
      if (!hatted) {
        const bang = part(capsule(0.016, s.w * 1.15), hairMat);
        bang.rotation.z = Math.PI / 2 + 0.18;
        bang.scale.set(0.85, 1, 0.7);
        bang.position.set(0.01, s.h * 0.62, s.d * 0.72);
        g.add(bang);
      }
      if (who.hair === "long" && who.hat !== "hood") {
        // Tapered layered locks framing the cheeks and flowing smoothly over the back of the collar.
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, s.h * 0.35, -s.d * 0.85),
          new THREE.Vector3(0, -0.02, -s.d * 0.92),
          new THREE.Vector3(0, -0.14, -s.d * 0.8),
        ]);
        const backFall = part(new THREE.TubeGeometry(curve, 12, s.w * 0.78, 12, false), hairMat);
        backFall.scale.set(1.18, 1, 0.42);
        g.add(backFall);
        for (const side of [-1, 1]) {
          const strand = new THREE.CatmullRomCurve3([
            new THREE.Vector3(side * s.w * 0.92, s.h * 0.25, -0.01),
            new THREE.Vector3(side * s.w * 0.98, -0.04, 0.01),
            new THREE.Vector3(side * s.w * 0.88, -0.14, 0.02),
          ]);
          g.add(part(new THREE.TubeGeometry(strand, 10, 0.016, 8, false), hairMat));
        }
      } else if (who.hair === "bun" && !hatted) {
        const bun = part(sphere(0.036), hairMat);
        bun.scale.set(1, 0.9, 0.85);
        bun.position.set(0, s.h * 0.78, -s.d * 0.7);
        g.add(bun);
      } else if (who.hair === "pony" && who.hat !== "hood") {
        const tie = part(sphere(0.02), clothMat(who.hatColor));
        tie.position.set(0, s.h * 0.25, -s.d * 1.03);
        const tailCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, s.h * 0.24, -s.d * 1.04),
          new THREE.Vector3(0, s.h * 0.05, -s.d * 1.24),
          new THREE.Vector3(0, -0.12, -s.d * 1.15),
        ]);
        const tail = part(new THREE.TubeGeometry(tailCurve, 10, 0.02, 8, false), hairMat);
        tail.scale.set(1.2, 1, 0.75);
        g.add(tie, tail);
      }
    }
  }

  switch (who.beard) {
    case "stubble": {
      const st = new THREE.MeshStandardMaterial({
        color: new THREE.Color(who.hairColor).lerp(new THREE.Color(0x6a5040), 0.35),
        roughness: 0.9,
        transparent: true,
        opacity: 0.5,
        normalMap: charTex().fabric,
      });
      g.add(part(shellGeo("stubble", b, 1.007, beardMask()), st));
      break;
    }
    case "beard":
      g.add(part(shellGeo("beard", b, 1.048, beardMask()), hairMat));
      break;
    case "moustache": {
      const [mx, my, mz] = sculpt(0, -0.43, 0.94, s);
      const m = part(capsule(0.0045, 0.026), hairMat);
      m.rotation.z = Math.PI / 2;
      m.position.set(mx, my, mz + 0.002);
      g.add(m);
      break;
    }
  }

  // Hats sized cleanly over hair.
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
      cuff.scale.set(s.w * 1.18, 0.036, s.d * 1.14);
      cuff.position.set(0, s.h * 0.24, -0.004);
      cuff.rotation.x = -0.12;
      g.add(cuff);
    } else {
      const brim = part(rbox(s.w * 1.65, 0.007, 0.075, 0.003), hatMat);
      brim.position.set(0, s.h * 0.3, s.d * 1.12);
      brim.rotation.x = 0.12;
      g.add(brim);
    }
  } else if (who.hat === "hood") {
    hatMat.side = THREE.DoubleSide;
    addHood(g, hatMat, 0.126, 0.95);
  }
  return [hairMat, hatMat];
}
