import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Building, Prop, Rect, Zone } from "../engine/state";
import { mulberry, styleOf } from "../engine/world";
import { Architect, facadeBox, farSkyline } from "./nyc";
import { SIGN_WORDS, detailMaps, facadeTextures, groundTextures, signAtlas, type FacadeSet } from "./textures";

// Builds the static city of a zone: wet asphalt with curbs and puddles, brick and concrete towers
// with lit windows, neon signs, wrecked cars, barricades, sodium lamps, burning barrels and the
// walled stronghold. Materials are physically based so the rain-wet city reflects its lights.

export interface LightSource {
  pos: THREE.Vector3;
  color: number;
  intensity: number;
  distance: number;
  /** 0 steady, 1 fire flicker, 2 neon buzz. */
  flicker: number;
  seed: number;
}

export interface Emitter {
  pos: THREE.Vector3;
  kind: "fire" | "steam";
}

export interface CityScene {
  group: THREE.Group;
  lights: LightSource[];
  emitters: Emitter[];
  /** Signs that buzz on and off. */
  signs: { mat: THREE.MeshBasicMaterial; seed: number; base: number }[];
  flames: THREE.Mesh[];
  /** Tall boxes used to keep the camera out of walls. */
  blockers: (Rect & { top: number })[];
  dispose: () => void;
}

let shared: { brick: FacadeSet; concrete: FacadeSet; brownstone: FacadeSet; limestone: FacadeSet; glass: FacadeSet; signs: THREE.Texture } | null = null;
const sharedTex = () =>
  (shared ??= {
    brick: facadeTextures("brick"),
    concrete: facadeTextures("concrete"),
    brownstone: facadeTextures("brownstone"),
    limestone: facadeTextures("limestone"),
    glass: facadeTextures("glass"),
    signs: signAtlas(),
  });

const tone = (hex: number, k: number) => new THREE.Color(hex).multiplyScalar(k);
/** The district colour as a tint whose brightest channel is k, so textures keep their real albedo. */
const tint = (hex: number, k = 1) => {
  const c = new THREE.Color(hex);
  return c.multiplyScalar(k / Math.max(c.r, c.g, c.b, 0.001));
};
/** A shared tiling detail map with its own repeat. */
const tiled = (t: THREE.Texture, x: number, y = x) => {
  const c = t.clone();
  c.repeat.set(x, y);
  c.needsUpdate = true;
  return c;
};

export function buildCity(zone: Zone): CityScene {
  const group = new THREE.Group();
  const lights: LightSource[] = [];
  const emitters: Emitter[] = [];
  const signs: CityScene["signs"] = [];
  const flames: THREE.Mesh[] = [];
  const blockers: CityScene["blockers"] = [];
  const disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(x: T) => {
    disposables.push(x);
    return x;
  };
  const env = zone.env;
  const tex = sharedTex();
  const det = detailMaps();
  const rnd = mulberry(zone.w * 7 + zone.nation.length);

  // ---------- Ground ----------
  const gt = groundTextures(zone);
  keep(gt.map);
  keep(gt.roughness);
  const groundMat = keep(
    new THREE.MeshStandardMaterial({
      map: gt.map,
      roughnessMap: gt.roughness,
      roughness: 1,
      metalness: 0,
      normalMap: keep(tiled(det.asphalt, zone.w / 2.5, zone.h / 2.5)),
      normalScale: new THREE.Vector2(0.8, 0.8),
      envMapIntensity: 1.4,
    }),
  );
  const ground = new THREE.Mesh(keep(new THREE.PlaneGeometry(zone.w, zone.h)), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(zone.w / 2, 0, zone.h / 2);
  ground.receiveShadow = true;
  group.add(ground);
  // Rubble-strewn wasteland beyond the playable streets.
  const outer = new THREE.Mesh(
    keep(new THREE.PlaneGeometry(zone.w + 400, zone.h + 400)),
    keep(new THREE.MeshStandardMaterial({ color: tone(env.ground, 0.85), roughness: 0.75, normalMap: keep(tiled(det.asphalt, 180)) })),
  );
  outer.rotation.x = -Math.PI / 2;
  outer.position.set(zone.w / 2, -0.02, zone.h / 2);
  outer.receiveShadow = true;
  group.add(outer);

  if (env.water) {
    const water = new THREE.Mesh(
      keep(new THREE.CircleGeometry(13, 48)),
      keep(
        new THREE.MeshPhysicalMaterial({
          color: 0x10161a,
          roughness: 0.04,
          metalness: 0,
          clearcoat: 1,
          clearcoatRoughness: 0.03,
          normalMap: keep(tiled(det.concrete, 5)),
          normalScale: new THREE.Vector2(0.12, 0.12),
          envMapIntensity: 2,
        }),
      ),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(zone.pois.water.x, 0.03, zone.pois.water.y);
    water.receiveShadow = true;
    group.add(water);
  }

  // ---------- Buildings ----------
  const facade = (set: FacadeSet, lit: boolean, k: number, glassy = false) =>
    keep(
      new THREE.MeshStandardMaterial({
        map: set.map,
        normalMap: set.normal,
        roughnessMap: set.roughness,
        roughness: 1,
        metalness: glassy ? 0.75 : 0,
        emissiveMap: lit ? set.emissive : null,
        emissive: lit ? 0xffffff : 0x000000,
        emissiveIntensity: lit ? (glassy ? 1.6 : 2.4) : 0,
        color: glassy ? new THREE.Color(1, 1, 1) : tint(env.building, k),
        envMapIntensity: glassy ? 2.2 : 1.2,
      }),
    );
  const roofMat = keep(new THREE.MeshStandardMaterial({ color: 0x4a4744, roughness: 0.85, normalMap: keep(tiled(det.concrete, 4)) }));
  const girderMat = keep(new THREE.MeshStandardMaterial({ color: 0x5a4436, metalness: 0.85, roughness: 0.55 }));
  const sides = (m: THREE.Material) => [m, m, roofMat, roofMat, m, m];
  const brickMats = sides(facade(tex.brick, true, 1));
  const concreteMats = sides(facade(tex.concrete, true, 1));
  const darkBrick = sides(facade(tex.brick, false, 0.62));
  const darkConcrete = sides(facade(tex.concrete, false, 0.58));
  const brownMats = sides(keep(new THREE.MeshStandardMaterial({ map: tex.brownstone.map, normalMap: tex.brownstone.normal, roughnessMap: tex.brownstone.roughness, emissiveMap: tex.brownstone.emissive, emissive: 0xffffff, emissiveIntensity: 2.4, envMapIntensity: 1.2 })));
  const limeMats = sides(keep(new THREE.MeshStandardMaterial({ map: tex.limestone.map, normalMap: tex.limestone.normal, roughnessMap: tex.limestone.roughness, emissiveMap: tex.limestone.emissive, emissive: 0xffffff, emissiveIntensity: 2.4, color: tint(env.building, 1).lerp(new THREE.Color(1, 1, 1), 0.6), envMapIntensity: 1.2 })));
  const glassMats = sides(facade(tex.glass, true, 1, true));
  const girder = keep(new THREE.BoxGeometry(0.25, 1, 0.25));
  const arch = new Architect(group, keep, lights, det, roofMat);

  const addBuilding = (b: Building, solid = true) => {
    const h = b.ruined ? b.height * 0.75 : b.height;
    const style = styleOf(b);
    const brick = b.seed % 3 !== 0;
    const ruinMats = brick ? darkBrick : darkConcrete;
    if (solid) blockers.push({ x: b.x, y: b.y, w: b.w, h: b.h, top: h });
    const r = mulberry(b.seed);
    if (style === "deco" || style === "glass") {
      arch.tower(b, h, style, { limestone: limeMats, glass: glassMats, stone: roofMat }, solid);
    } else {
      const mats = b.ruined ? ruinMats : style === "brownstone" ? brownMats : brick || b.seed % 5 !== 0 ? brickMats : concreteMats;
      const m = new THREE.Mesh(keep(facadeBox(b.w, h, b.h, b.seed)), mats);
      m.position.set(b.x + b.w / 2, h / 2, b.y + b.h / 2);
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
    }
    if (style === "walkup" && solid) arch.walkup(b, h);
    if (b.ruined) {
      // Broken upper floors and bare girders.
      for (let i = 0; i < 3; i++) {
        const cw = b.w * (0.3 + r() * 0.4);
        const cd = b.h * (0.3 + r() * 0.4);
        const ch = 2 + r() * h * 0.35;
        const chunk = new THREE.Mesh(keep(facadeBox(cw, ch, cd, b.seed + i)), ruinMats);
        chunk.position.set(b.x + cw / 2 + r() * (b.w - cw), h + ch / 2, b.y + cd / 2 + r() * (b.h - cd));
        chunk.castShadow = true;
        chunk.receiveShadow = true;
        group.add(chunk);
      }
      for (let i = 0; i < 6; i++) {
        const gh = 2 + r() * 7;
        const gm = new THREE.Mesh(girder, girderMat);
        gm.scale.y = gh;
        gm.position.set(b.x + r() * b.w, h + gh / 2, b.y + (r() < 0.5 ? 0.2 : b.h - 0.2));
        gm.rotation.z = (r() - 0.5) * 0.5;
        gm.castShadow = true;
        group.add(gm);
      }
    } else if (style === "brownstone" || style === "walkup") {
      // A heavy bracketed cornice at the roofline.
      const deep = style === "brownstone" ? 0.9 : 0.6;
      const cornice = new THREE.Mesh(keep(new THREE.BoxGeometry(b.w + deep, style === "brownstone" ? 0.8 : 0.6, b.h + deep)), roofMat);
      cornice.position.set(b.x + b.w / 2, h - 0.35, b.y + b.h / 2);
      cornice.castShadow = true;
      group.add(cornice);
      const band = new THREE.Mesh(keep(new THREE.BoxGeometry(b.w + 0.3, 0.3, b.h + 0.3)), roofMat);
      band.position.set(b.x + b.w / 2, h - 1.3, b.y + b.h / 2);
      group.add(band);
      // Cedar water tanks on the taller roofs.
      if (h > 17 && r() < 0.7) arch.waterTower(b.x + b.w * (0.3 + r() * 0.4), b.y + b.h * (0.3 + r() * 0.4), h, 0.85 + r() * 0.35);
    }
    // Red aircraft-warning lights on tall towers.
    if (h > 30 && r() < 0.7) {
      const beacon = new THREE.Mesh(keep(new THREE.SphereGeometry(0.25, 8, 6)), keep(new THREE.MeshBasicMaterial({ color: 0xff1020, toneMapped: false })));
      beacon.position.set(b.x + b.w / 2, h + 0.4, b.y + b.h / 2);
      group.add(beacon);
      signs.push({ mat: beacon.material as THREE.MeshBasicMaterial, seed: b.seed, base: 3 });
    }
  };
  zone.buildings.forEach((b) => addBuilding(b));

  // A wall of towers around the edge so the city never ends.
  for (let i = 0; i < 70; i++) {
    const side = i % 4;
    const along = rnd();
    const depth = 6 + rnd() * 30;
    const w = 10 + rnd() * 14;
    const d = 10 + rnd() * 14;
    const x = side < 2 ? along * zone.w : side === 2 ? -depth - w : zone.w + depth;
    const y = side < 2 ? (side === 0 ? -depth - d : zone.h + depth) : along * zone.h;
    addBuilding({ x, y, w, h: d, height: 18 + rnd() * rnd() * 140, ruined: rnd() < 0.25, seed: Math.floor(rnd() * 1e6) }, false);
  }
  farSkyline(zone, group, keep);

  // ---------- Stronghold walls and gate ----------
  const wallMat = keep(
    new THREE.MeshStandardMaterial({ color: 0x77726c, roughness: 0.9, normalMap: keep(tiled(det.concrete, 3, 1)), normalScale: new THREE.Vector2(1.5, 1.5) }),
  );
  const addWall = (r: Rect, height: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(keep(new THREE.BoxGeometry(r.w, height, r.h)), mat);
    m.position.set(r.x + r.w / 2, height / 2, r.y + r.h / 2);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    blockers.push({ ...r, top: height });
  };
  for (const w of zone.walls) {
    addWall(w, 6.5, wallMat);
    // Red lamps along the top.
    const long = Math.max(w.w, w.h);
    for (let s = 3; s < long; s += 9) {
      const px = w.w > w.h ? w.x + s : w.x + w.w / 2;
      const py = w.w > w.h ? w.y + w.h / 2 : w.y + s;
      lights.push({ pos: new THREE.Vector3(px, 7, py), color: 0xff1a1a, intensity: 14, distance: 16, flicker: 0, seed: s });
      const lamp = new THREE.Mesh(keep(new THREE.SphereGeometry(0.18, 8, 6)), keep(new THREE.MeshBasicMaterial({ color: 0xff2020, toneMapped: false })));
      lamp.position.set(px, 6.8, py);
      group.add(lamp);
    }
  }
  if (zone.gate) {
    const shutter = keep(new THREE.MeshStandardMaterial({ color: 0x5a1c18, metalness: 0.8, roughness: 0.45, normalMap: keep(tiled(det.fabric, 2, 6)) }));
    addWall(zone.gate, 5.8, shutter);
    const g = zone.gate;
    lights.push({ pos: new THREE.Vector3(g.x - 1.5, 4, g.y + g.h / 2), color: 0xff2a1a, intensity: 34, distance: 18, flicker: 2, seed: 99 });
  }
  if (zone.hall) {
    // The general's hall: a scarlet carpet and braziers.
    const h = zone.hall;
    const carpet = new THREE.Mesh(
      keep(new THREE.PlaneGeometry(h.w - 4, 5)),
      keep(new THREE.MeshStandardMaterial({ color: 0x6a1014, roughness: 0.95, normalMap: keep(tiled(det.fabric, 8, 2)) })),
    );
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.set(h.x + h.w / 2, 0.02, h.y + h.h / 2);
    carpet.receiveShadow = true;
    group.add(carpet);
  }

  // ---------- Props ----------
  const counts: Record<string, Prop[]> = {};
  for (const p of zone.props) (counts[p.kind] ??= []).push(p);
  const dummy = new THREE.Object3D();
  const instanced = (list: Prop[] | undefined, geo: THREE.BufferGeometry, mat: THREE.Material, place: (p: Prop, o: THREE.Object3D) => void) => {
    if (!list?.length) return;
    const inst = new THREE.InstancedMesh(keep(geo), mat, list.length);
    list.forEach((p, i) => {
      dummy.position.set(p.x, 0, p.y);
      dummy.rotation.set(0, -p.rot, 0);
      dummy.scale.set(1, 1, 1);
      place(p, dummy);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    });
    inst.castShadow = true;
    inst.receiveShadow = true;
    group.add(inst);
  };
  const concrete = keep(
    new THREE.MeshStandardMaterial({ color: 0x9a9792, roughness: 0.85, normalMap: keep(tiled(det.concrete, 1.5)), normalScale: new THREE.Vector2(1.5, 1.5) }),
  );
  instanced(counts.barrier, new RoundedBoxGeometry(2, 0.9, 0.6, 2, 0.06), concrete, (_, o) => (o.position.y = 0.45));
  instanced(counts.crate, new RoundedBoxGeometry(1, 1, 1, 2, 0.03), keep(new THREE.MeshStandardMaterial({ color: 0x7a5e40, roughness: 0.85, normalMap: keep(tiled(det.fabric, 1, 4)) })), (p, o) => {
    const s = 0.7 + ((p.seed % 10) / 10) * 0.6;
    o.scale.setScalar(s);
    o.position.y = s / 2;
  });
  instanced(
    counts.rubble,
    new THREE.DodecahedronGeometry(0.6, 1),
    keep(new THREE.MeshStandardMaterial({ color: tint(env.building, 0.45), roughness: 0.95, flatShading: true, normalMap: keep(tiled(det.concrete, 1)) })),
    (p, o) => {
      const s = 0.4 + ((p.seed % 13) / 13) * 1.1;
      o.scale.set(s * 1.4, s * 0.5, s);
      o.position.y = s * 0.15;
    },
  );

  // Wrecked cars: clear-coated paint, glass cabins, tyres and chrome bumpers.
  const carBody = keep(new RoundedBoxGeometry(4.3, 0.75, 1.9, 3, 0.18));
  const carCabin = keep(new RoundedBoxGeometry(2.3, 0.62, 1.66, 3, 0.22));
  const wheelGeo = keep(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 20));
  const bumperGeo = keep(new THREE.BoxGeometry(0.12, 0.2, 1.85));
  const glass = keep(new THREE.MeshPhysicalMaterial({ color: 0x0b0e12, roughness: 0.05, metalness: 0, clearcoat: 1, envMapIntensity: 1.6 }));
  const tyre = keep(new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.9 }));
  const chrome = keep(new THREE.MeshStandardMaterial({ color: 0xb0b4b8, roughness: 0.25, metalness: 1 }));
  for (const p of counts.car ?? []) {
    const car = new THREE.Group();
    const paint = keep(new THREE.MeshPhysicalMaterial({ color: p.color ?? 0x2a2d31, roughness: 0.5, metalness: 0.6, clearcoat: 0.6, clearcoatRoughness: 0.35, envMapIntensity: 1.3 }));
    const b = new THREE.Mesh(carBody, paint);
    b.position.y = 0.68;
    const c = new THREE.Mesh(carCabin, glass);
    c.position.set(-0.25, 1.3, 0);
    const parts: THREE.Mesh[] = [b, c];
    for (const [wx, wz] of [[1.35, 0.85], [1.35, -0.85], [-1.35, 0.85], [-1.35, -0.85]]) {
      const wheel = new THREE.Mesh(wheelGeo, tyre);
      wheel.rotation.x = Math.PI / 2;
      // Some wrecks sit on flat rear tyres.
      wheel.position.set(wx, p.seed % 3 === 0 && wx < 0 ? 0.24 : 0.36, wz);
      parts.push(wheel);
    }
    for (const bx of [2.17, -2.17]) {
      const bumper = new THREE.Mesh(bumperGeo, chrome);
      bumper.position.set(bx, 0.48, 0);
      parts.push(bumper);
    }
    for (const m of parts) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
    car.add(...parts);
    car.position.set(p.x, 0, p.y);
    car.rotation.set(0, -p.rot, p.seed % 5 === 0 ? 0.08 : 0);
    group.add(car);
    if (p.text === "taxi") arch.taxi(p.x - Math.cos(p.rot) * 0.25, p.y - Math.sin(p.rot) * 0.25, p.rot);
    // Some still have a dying tail-light.
    if (p.seed % 4 === 0) lights.push({ pos: new THREE.Vector3(p.x, 0.8, p.y), color: 0xc8102e, intensity: 5, distance: 7, flicker: 2, seed: p.seed });
  }

  // Street lamps: sodium orange, a third of them dead.
  const poleGeo = keep(new THREE.CylinderGeometry(0.08, 0.12, 6, 10));
  const headGeo = keep(new RoundedBoxGeometry(0.9, 0.18, 0.35, 2, 0.05));
  const poleMat = keep(new THREE.MeshStandardMaterial({ color: 0x3e4042, metalness: 0.85, roughness: 0.5 }));
  const lampOn = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb060).multiplyScalar(2), toneMapped: false }));
  for (const p of counts.lamp ?? []) {
    const lit = p.seed % 3 !== 0;
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(p.x, 3, p.y);
    pole.castShadow = true;
    const head = new THREE.Mesh(headGeo, lit ? lampOn : poleMat);
    head.position.set(p.x + 0.35, 6, p.y);
    group.add(pole, head);
    if (p.seed % 2 === 0) arch.streetSign(p.x, p.y);
    if (lit) lights.push({ pos: new THREE.Vector3(p.x + 0.4, 5.6, p.y), color: 0xffa860, intensity: 80, distance: 28, flicker: p.seed % 7 === 0 ? 2 : 0, seed: p.seed });
  }

  // Neon signs.
  const rows = SIGN_WORDS.length;
  for (const p of counts.sign ?? []) {
    const idx = Math.max(0, SIGN_WORDS.indexOf(p.text ?? "BAR"));
    const g = keep(new THREE.PlaneGeometry(4, 0.5));
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - (idx + 1 - uv.getY(i)) / rows);
    uv.needsUpdate = true;
    const color = new THREE.Color(p.color ?? 0xc8102e).multiplyScalar(3);
    const mat = keep(new THREE.MeshBasicMaterial({ map: tex.signs, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    const m = new THREE.Mesh(g, mat);
    const hgt = 4 + (p.seed % 5);
    m.position.set(p.x, hgt, p.y);
    m.rotation.y = p.rot;
    group.add(m);
    signs.push({ mat, seed: p.seed, base: 3 });
    const out = new THREE.Vector3(Math.sin(p.rot), 0, Math.cos(p.rot)).multiplyScalar(1.2);
    lights.push({ pos: new THREE.Vector3(p.x + out.x, hgt, p.y + out.z), color: p.color ?? 0xc8102e, intensity: 20, distance: 16, flicker: p.seed % 4 === 0 ? 2 : 0, seed: p.seed });
  }

  // Burning barrels.
  const barrelGeo = keep(new THREE.CylinderGeometry(0.35, 0.35, 0.9, 16, 1, true));
  const barrelMat = keep(new THREE.MeshStandardMaterial({ color: 0x6a3a24, metalness: 0.7, roughness: 0.8, side: THREE.DoubleSide, normalMap: keep(tiled(det.leather, 2)) }));
  const flameGeo = keep(new THREE.ConeGeometry(0.32, 1, 10, 1, true));
  const flameMat = keep(
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff6a1a).multiplyScalar(2.5), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  for (const p of counts.fire ?? []) {
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.position.set(p.x, 0.45, p.y);
    barrel.castShadow = true;
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(p.x, 1.3, p.y);
    flame.userData.seed = p.seed;
    group.add(barrel, flame);
    flames.push(flame);
    lights.push({ pos: new THREE.Vector3(p.x, 1.6, p.y), color: 0xff7a30, intensity: 36, distance: 16, flicker: 1, seed: p.seed });
    emitters.push({ pos: new THREE.Vector3(p.x, 1.4, p.y), kind: "fire" });
  }
  for (const p of counts.steam ?? []) {
    const grate = new THREE.Mesh(keep(new THREE.CircleGeometry(0.5, 16)), poleMat);
    grate.rotation.x = -Math.PI / 2;
    grate.position.set(p.x, 0.02, p.y);
    group.add(grate);
    emitters.push({ pos: new THREE.Vector3(p.x, 0.1, p.y), kind: "steam" });
  }

  for (const p of counts.stoop ?? []) arch.stoop(p);
  for (const p of counts.subway ?? []) arch.subway(p);
  for (const p of counts.hydrant ?? []) arch.hydrant(p);
  arch.finish();

  // The hideout: warm lamplight under a tarp.
  const v = zone.pois.village;
  lights.push({ pos: new THREE.Vector3(v.x, 3, v.y - 1), color: 0xffa050, intensity: 45, distance: 20, flicker: 1, seed: 7 });
  const tarp = new THREE.Mesh(
    keep(new THREE.PlaneGeometry(9, 6)),
    keep(new THREE.MeshStandardMaterial({ color: 0x6a5038, roughness: 0.95, side: THREE.DoubleSide, normalMap: keep(tiled(det.fabric, 4)) })),
  );
  tarp.position.set(v.x, 3.4, v.y - 1);
  tarp.rotation.x = -Math.PI / 2 + 0.15;
  tarp.castShadow = true;
  group.add(tarp);

  return {
    group,
    lights,
    emitters,
    signs,
    flames,
    blockers,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}
