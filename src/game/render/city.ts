import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Building, BuildingKind, Prop, Rect, Zone } from "../engine/state";
import { mulberry, styleOf } from "../engine/world";
import { buildDistrictFeatures } from "./districts";
import { Architect, facadeBox } from "./nyc";
import { SIGN_WORDS, barricadeStripeTexture, detailMaps, facadeTextures, groundTextures, signAtlas, type FacadeSet } from "./textures";

// Builds the static city of a zone: district-tailored ground (wet asphalt, snow, timber piers,
// glossy neon avenues, molten ash), architectural archetypes (warehouses, shipping containers,
// gothic cathedrals, brownstones, walkups, Art Deco & glass towers, shattered ruins), stronghold
// fortifications, street props, and bespoke district landmarks via buildDistrictFeatures().

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

let shared: {
  brick: FacadeSet;
  concrete: FacadeSet;
  brownstone: FacadeSet;
  limestone: FacadeSet;
  glass: FacadeSet;
  corrugated: FacadeSet;
  gothic: FacadeSet;
  signs: THREE.Texture;
} | null = null;

const sharedTex = () =>
  (shared ??= {
    brick: facadeTextures("brick"),
    concrete: facadeTextures("concrete"),
    brownstone: facadeTextures("brownstone"),
    limestone: facadeTextures("limestone"),
    glass: facadeTextures("glass"),
    corrugated: facadeTextures("corrugated"),
    gothic: facadeTextures("gothic"),
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
  const nation = zone.id === "memory" ? "ash" : zone.nation;
  const tex = sharedTex();
  const det = detailMaps();
  const rnd = mulberry(zone.w * 7 + zone.nation.length * 19);

  // ---------- Ground ----------
  const gt = groundTextures(zone);
  keep(gt.map);
  keep(gt.roughness);
  if (gt.emissive) keep(gt.emissive);
  const groundNormScale = nation === "snow" ? 0.42 : nation === "lanterns" ? 0.55 : nation === "ash" ? 1.0 : 0.8;
  const groundEnvInt = nation === "lanterns" ? 1.9 : nation === "snow" ? 0.78 : nation === "ash" ? 0.95 : 1.4;
  const groundMat = keep(
    new THREE.MeshStandardMaterial({
      map: gt.map,
      roughnessMap: gt.roughness,
      roughness: 1,
      metalness: 0,
      emissiveMap: gt.emissive ?? null,
      emissive: gt.emissive ? 0xffffff : 0x000000,
      emissiveIntensity: gt.emissive ? 2.4 : 0,
      normalMap: keep(tiled(det.asphalt, zone.w / 2.5, zone.h / 2.5)),
      normalScale: new THREE.Vector2(groundNormScale, groundNormScale),
      envMapIntensity: groundEnvInt,
    }),
  );
  const ground = new THREE.Mesh(keep(new THREE.PlaneGeometry(zone.w, zone.h)), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(zone.w / 2, 0, zone.h / 2);
  ground.receiveShadow = true;
  group.add(ground);

  // Surrounding ground plane extending far beneath the beyond-border avenues and skyline.
  const outer = new THREE.Mesh(
    keep(new THREE.PlaneGeometry(zone.w + 760, zone.h + 760)),
    keep(
      new THREE.MeshStandardMaterial({
        color: tone(env.ground, nation === "snow" ? 0.96 : 0.85),
        roughness: nation === "snow" ? 0.92 : 0.78,
        normalMap: keep(tiled(det.asphalt, 240)),
      }),
    ),
  );
  outer.rotation.x = -Math.PI / 2;
  outer.position.set(zone.w / 2, -0.04, zone.h / 2);
  outer.receiveShadow = true;
  group.add(outer);

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
        emissiveIntensity: lit ? (glassy ? 1.8 : 2.4) : 0,
        color: glassy ? new THREE.Color(1, 1, 1) : tint(env.building, k),
        envMapIntensity: glassy ? 2.2 : 1.2,
      }),
    );

  const roofColor = nation === "snow" ? 0x9aa8b8 : nation === "ash" ? 0x352c28 : nation === "lanterns" ? 0x2e2a38 : 0x4a4744;
  const roofMat = keep(new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.86, normalMap: keep(tiled(det.concrete, 4)) }));
  const snowCapMat = keep(new THREE.MeshStandardMaterial({ color: 0xd4e0ec, roughness: 0.92 }));
  const slateRoofMat = keep(new THREE.MeshStandardMaterial({ color: 0x2a3644, roughness: 0.76, metalness: 0.15 }));
  const buttressMat = keep(new THREE.MeshStandardMaterial({ color: 0x9aa6b4, roughness: 0.88, normalMap: keep(tiled(det.concrete, 2, 4)) }));
  const girderMat = keep(new THREE.MeshStandardMaterial({ color: 0x5a4436, metalness: 0.85, roughness: 0.55 }));
  const containerFrameMat = keep(new THREE.MeshStandardMaterial({ color: 0x22262b, metalness: 0.82, roughness: 0.45 }));
  const warehouseRoofMat = keep(new THREE.MeshStandardMaterial({ color: 0x3f4346, metalness: 0.55, roughness: 0.72 }));

  const sides = (m: THREE.Material, top: THREE.Material = roofMat) => [m, m, top, top, m, m];
  const brickMats = sides(facade(tex.brick, true, 1));
  const concreteMats = sides(facade(tex.concrete, true, 1));
  const darkBrick = sides(facade(tex.brick, false, 0.62));
  const darkConcrete = sides(facade(tex.concrete, false, 0.58));
  const brownMats = sides(
    keep(
      new THREE.MeshStandardMaterial({
        map: tex.brownstone.map,
        normalMap: tex.brownstone.normal,
        roughnessMap: tex.brownstone.roughness,
        emissiveMap: tex.brownstone.emissive,
        emissive: 0xffffff,
        emissiveIntensity: 2.4,
        envMapIntensity: 1.2,
      }),
    ),
  );
  const limeMats = sides(
    keep(
      new THREE.MeshStandardMaterial({
        map: tex.limestone.map,
        normalMap: tex.limestone.normal,
        roughnessMap: tex.limestone.roughness,
        emissiveMap: tex.limestone.emissive,
        emissive: 0xffffff,
        emissiveIntensity: 2.4,
        color: tint(env.building, 1).lerp(new THREE.Color(1, 1, 1), 0.6),
        envMapIntensity: 1.2,
      }),
    ),
  );
  const glassMats = sides(facade(tex.glass, true, 1, true));
  const warehouseMats = sides(
    keep(
      new THREE.MeshStandardMaterial({
        map: tex.corrugated.map,
        normalMap: tex.corrugated.normal,
        roughnessMap: tex.corrugated.roughness,
        roughness: 0.82,
        metalness: 0.48,
        color: tint(env.building, 0.78),
        envMapIntensity: 1.1,
      }),
    ),
    warehouseRoofMat,
  );
  const gothicMats = sides(
    keep(
      new THREE.MeshStandardMaterial({
        map: tex.gothic.map,
        normalMap: tex.gothic.normal,
        roughnessMap: tex.gothic.roughness,
        emissiveMap: tex.gothic.emissive,
        emissive: 0xffffff,
        emissiveIntensity: 2.2,
        color: new THREE.Color(0xc4d0dc),
        envMapIntensity: 0.95,
      }),
    ),
    slateRoofMat,
  );

  // Cache corrugated materials per shipping container paint colour.
  const containerMatCache = new Map<number, THREE.Material[]>();
  const getContainerMats = (hex: number) => {
    let cached = containerMatCache.get(hex);
    if (!cached) {
      const m = keep(
        new THREE.MeshStandardMaterial({
          map: tex.corrugated.map,
          normalMap: tex.corrugated.normal,
          roughnessMap: tex.corrugated.roughness,
          roughness: 0.66,
          metalness: 0.58,
          color: new THREE.Color(hex),
          envMapIntensity: 1.35,
        }),
      );
      cached = [m, m, m, m, m, m];
      containerMatCache.set(hex, cached);
    }
    return cached;
  };

  // Shared 3-sided prism geometry for gabled roofs (apex along +Y, ridge along Z).
  const gableGeo = keep(new THREE.CylinderGeometry(0.5, 0.5, 1, 3));
  gableGeo.rotateX(Math.PI / 2);
  // Rotate around Z so one flat edge is at the bottom and apex points up.
  gableGeo.rotateZ(Math.PI / 6);
  const pinnacleGeo = keep(new THREE.ConeGeometry(0.35, 3.2, 4));
  const spireGeo = keep(new THREE.ConeGeometry(0.75, 7.5, 6));
  const ventGeo = keep(new THREE.CylinderGeometry(0.35, 0.42, 2.2, 8));
  const girder = keep(new THREE.BoxGeometry(0.25, 1, 0.25));
  const arch = new Architect(group, keep, lights, det, roofMat);

  const addGableRoof = (cx: number, cz: number, w: number, d: number, baseH: number, peakH: number, mat: THREE.Material, snowDust = false) => {
    const alongX = w >= d;
    const span = alongX ? d : w;
    const len = alongX ? w : d;
    const mesh = new THREE.Mesh(gableGeo, mat);
    // Cylinder(r=0.5, 3 segs): triangle width = 0.866, height = 0.75, center to bottom = 0.25
    mesh.scale.set(span / 0.866, peakH / 0.75, len + 0.4);
    if (alongX) mesh.rotation.y = Math.PI / 2;
    mesh.position.set(cx, baseH + peakH * 0.33, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (snowDust) {
      const cap = new THREE.Mesh(gableGeo, snowCapMat);
      cap.scale.set((span * 0.94) / 0.866, (peakH * 0.96) / 0.75, len + 0.45);
      if (alongX) cap.rotation.y = Math.PI / 2;
      cap.position.set(cx, baseH + peakH * 0.33 + 0.14, cz);
      cap.receiveShadow = true;
      group.add(cap);
    }
  };

  const addBuilding = (b: Building, solid = true) => {
    const h = b.ruined ? b.height * 0.75 : b.height;
    const style = styleOf(b);
    const brick = b.seed % 3 !== 0;
    const ruinMats = brick ? darkBrick : darkConcrete;
    if (solid) blockers.push({ x: b.x, y: b.y, w: b.w, h: b.h, top: h });
    const r = mulberry(b.seed);
    const cx = b.x + b.w / 2;
    const cz = b.y + b.h / 2;

    if (style === "container") {
      // Intermodal corrugated shipping container (single or stacked tiers).
      const col = b.color ?? 0x8c2e24;
      const body = new THREE.Mesh(keep(facadeBox(b.w, h, b.h, b.seed)), getContainerMats(col));
      body.position.set(cx, h / 2, cz);
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);
      // Heavy steel corner casting frames at base, top, and between stacked tiers.
      const tiers = Math.max(1, Math.round(h / 3.4));
      for (let t = 0; t <= tiers; t++) {
        const y = t === 0 ? 0.12 : t === tiers ? h - 0.1 : (t / tiers) * h;
        const rail = new THREE.Mesh(keep(new THREE.BoxGeometry(b.w + 0.14, 0.22, b.h + 0.14)), containerFrameMat);
        rail.position.set(cx, y, cz);
        group.add(rail);
      }
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const post = new THREE.Mesh(keep(new THREE.BoxGeometry(0.24, h + 0.08, 0.24)), containerFrameMat);
          post.position.set(cx + sx * (b.w / 2 - 0.04), h / 2, cz + sz * (b.h / 2 - 0.04));
          group.add(post);
        }
      }
      return;
    }

    if (style === "warehouse") {
      // Industrial corrugated depot / dock shed with gabled roof and vent stacks.
      const mats = b.ruined ? ruinMats : warehouseMats;
      const m = new THREE.Mesh(keep(facadeBox(b.w, h, b.h, b.seed)), mats);
      m.position.set(cx, h / 2, cz);
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
      if (!b.ruined) {
        const peak = Math.min(3.8, Math.min(b.w, b.h) * 0.28);
        addGableRoof(cx, cz, b.w, b.h, h, peak, warehouseRoofMat, false);
        // Rusted exhaust vents along roof ridge.
        const vents = b.w > 11 || b.h > 11 ? 2 : 1;
        for (let vi = 0; vi < vents; vi++) {
          const v = new THREE.Mesh(ventGeo, girderMat);
          const off = vents === 2 ? (vi === 0 ? -2.2 : 2.2) : 0;
          v.position.set(cx + (b.w >= b.h ? off : 0), h + peak * 0.75 + 0.8, cz + (b.w < b.h ? off : 0));
          v.castShadow = true;
          group.add(v);
        }
      }
    } else if (style === "cathedral") {
      // Gothic limestone abbey / cloister block with buttresses, steep slate roof & pinnacles.
      const m = new THREE.Mesh(keep(facadeBox(b.w, h, b.h, b.seed)), b.ruined ? darkConcrete : gothicMats);
      m.position.set(cx, h / 2, cz);
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
      // Stepped exterior stone buttresses along the long faces.
      const alongX = b.w >= b.h;
      const longLen = alongX ? b.w : b.h;
      const count = Math.max(2, Math.min(4, Math.floor(longLen / 3.8)));
      for (let i = 0; i < count; i++) {
        const frac = (i + 0.5) / count - 0.5;
        for (const side of [-1, 1]) {
          const bw = alongX ? 0.65 : 1.05;
          const bd = alongX ? 1.05 : 0.65;
          const bh = h * 0.78;
          const but = new THREE.Mesh(keep(new THREE.BoxGeometry(bw, bh, bd)), buttressMat);
          const bx = alongX ? cx + frac * (b.w - 1.2) : cx + side * (b.w / 2 + 0.28);
          const bz = alongX ? cz + side * (b.h / 2 + 0.28) : cz + frac * (b.h - 1.2);
          but.position.set(bx, bh / 2, bz);
          but.castShadow = true;
          group.add(but);
        }
      }
      if (!b.ruined) {
        const peak = Math.min(6.5, Math.min(b.w, b.h) * 0.52);
        addGableRoof(cx, cz, b.w, b.h, h, peak, slateRoofMat, nation === "snow");
        // Four pointed Gothic corner pinnacles.
        for (const sx of [-1, 1]) {
          for (const sz of [-1, 1]) {
            const pin = new THREE.Mesh(pinnacleGeo, buttressMat);
            pin.position.set(cx + sx * (b.w / 2 - 0.35), h + 1.4, cz + sz * (b.h / 2 - 0.35));
            pin.castShadow = true;
            group.add(pin);
          }
        }
        // Central steeple on taller cathedral wings.
        if (h >= 15) {
          const spire = new THREE.Mesh(spireGeo, slateRoofMat);
          spire.position.set(cx, h + peak + 2.8, cz);
          spire.castShadow = true;
          group.add(spire);
        }
      }
    } else if (style === "deco" || style === "glass") {
      arch.tower(b, h, style, { limestone: limeMats, glass: glassMats, stone: roofMat }, solid);
    } else {
      const mats = b.ruined ? ruinMats : style === "brownstone" ? brownMats : brick || b.seed % 5 !== 0 ? brickMats : concreteMats;
      const m = new THREE.Mesh(keep(facadeBox(b.w, h, b.h, b.seed)), mats);
      m.position.set(cx, h / 2, cz);
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
    }

    if (style === "walkup" && solid) arch.walkup(b, h);

    if (b.ruined) {
      // Broken upper floors and bare steel girders.
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
      cornice.position.set(cx, h - 0.35, cz);
      cornice.castShadow = true;
      group.add(cornice);
      const band = new THREE.Mesh(keep(new THREE.BoxGeometry(b.w + 0.3, 0.3, b.h + 0.3)), roofMat);
      band.position.set(cx, h - 1.3, cz);
      group.add(band);
      if (nation === "snow") {
        const cap = new THREE.Mesh(keep(new THREE.BoxGeometry(b.w + 0.4, 0.28, b.h + 0.4)), snowCapMat);
        cap.position.set(cx, h + 0.12, cz);
        group.add(cap);
      }
      // Cedar water tanks on taller tenement roofs (skip in Snow Cathedral Heights).
      if (nation !== "snow" && h > 17 && r() < 0.7) {
        arch.waterTower(b.x + b.w * (0.3 + r() * 0.4), b.y + b.h * (0.3 + r() * 0.4), h, 0.85 + r() * 0.35);
      }
    }

    // Red aircraft-warning beacons on tall towers.
    if (h > 30 && r() < 0.7) {
      const beacon = new THREE.Mesh(keep(new THREE.SphereGeometry(0.25, 8, 6)), keep(new THREE.MeshBasicMaterial({ color: 0xff1020, toneMapped: false })));
      beacon.position.set(cx, h + 0.4, cz);
      group.add(beacon);
      signs.push({ mat: beacon.material as THREE.MeshBasicMaterial, seed: b.seed, base: 3 });
    }
  };
  zone.buildings.forEach((b) => addBuilding(b));

  // ---------- Beyond-the-Barricade Roads, Buildings & Skyscrapers ----------
  const step = nation === "lanterns" ? 17 : nation === "reeds" ? 23 : nation === "snow" ? 22 : nation === "tides" ? 20 : 21;
  const roadXs: number[] = [];
  for (let rx = step; rx < zone.w - 4; rx += step) roadXs.push(rx);
  const roadZs: number[] = [];
  for (let rz = step; rz < zone.h - 4; rz += step) roadZs.push(rz);
  if (zone.id !== "memory") {
    if (!roadXs.some((rx) => Math.abs(rx - zone.pois.water.x) < 6)) roadXs.push(zone.pois.water.x);
    if (!roadZs.some((rz) => Math.abs(rz - zone.pois.road.y) < 6)) roadZs.push(zone.pois.road.y);
  }
  const nearRoadX = (x: number, tol = 5.4) => roadXs.some((rx) => Math.abs(rx - x) < tol);
  const nearRoadZ = (z: number, tol = 5.4) => roadZs.some((rz) => Math.abs(rz - z) < tol);
  const openSouthWater = nation === "tides";
  const OUTER_EXT = 165;

  // Extended asphalt avenues, raised concrete sidewalks, dashed yellow centerlines & marching streetlights outside the border.
  const dOut = new THREE.Object3D();
  const roadMat = keep(
    new THREE.MeshStandardMaterial({
      color: nation === "snow" ? 0x56606b : 0x1e2124,
      roughness: nation === "lanterns" ? 0.25 : 0.52,
      normalMap: keep(tiled(det.asphalt, 24, 6)),
      envMapIntensity: nation === "lanterns" ? 1.8 : 1.1,
    }),
  );
  const walkMat = keep(
    new THREE.MeshStandardMaterial({
      color: nation === "snow" ? 0x9ca8b4 : nation === "ash" ? 0x4b423e : 0x62605b,
      roughness: 0.88,
      normalMap: keep(tiled(det.concrete, 16, 4)),
    }),
  );
  const dashMat = keep(new THREE.MeshBasicMaterial({ color: nation === "snow" ? 0xb4c0cc : 0xc89a34 }));
  const outerPoleMat = keep(new THREE.MeshStandardMaterial({ color: 0x35383c, metalness: 0.82, roughness: 0.5 }));
  const outerLampGlow = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(env.lampColor).multiplyScalar(1.9), toneMapped: false }));

  const roadMats: THREE.Matrix4[] = [];
  const walkMats: THREE.Matrix4[] = [];
  const dashMats: THREE.Matrix4[] = [];
  const lampPostMats: THREE.Matrix4[] = [];
  const lampHeadMats: THREE.Matrix4[] = [];

  const pushBox = (list: THREE.Matrix4[], x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0) => {
    dOut.position.set(x, y, z);
    dOut.rotation.set(0, ry, 0);
    dOut.scale.set(sx, sy, sz);
    dOut.updateMatrix();
    list.push(dOut.matrix.clone());
  };

  const addOuterAvenue = (cx: number, cz: number, len: number, alongX: boolean) => {
    const rw = 8.4;
    pushBox(roadMats, cx, -0.025, cz, alongX ? len : rw, 0.04, alongX ? rw : len);
    for (const s of [-1, 1]) {
      pushBox(walkMats, cx + (alongX ? 0 : s * 5.2), 0.005, cz + (alongX ? s * 5.2 : 0), alongX ? len : 2.0, 0.06, alongX ? 2.0 : len);
    }
    for (let u = -len / 2 + 2; u <= len / 2 - 2; u += 4.2) {
      const dx = cx + (alongX ? u : 0);
      const dz = cz + (alongX ? 0 : u);
      pushBox(dashMats, dx, 0.002, dz, alongX ? 1.8 : 0.14, 0.02, alongX ? 0.14 : 1.8);
    }
    let idx = 0;
    for (let u = -len / 2 + 10; u <= len / 2 - 8; u += 22) {
      const side = idx++ % 2 === 0 ? -1 : 1;
      const lx = cx + (alongX ? u : side * 5.1);
      const lz = cz + (alongX ? side * 5.1 : u);
      pushBox(lampPostMats, lx, 3.0, lz, 0.18, 6.0, 0.18);
      pushBox(lampHeadMats, lx + (alongX ? 0 : -side * 0.45), 6.0, lz + (alongX ? -side * 0.45 : 0), alongX ? 0.4 : 0.95, 0.2, alongX ? 0.95 : 0.4);
    }
  };

  // Perpendicular roads continuing outward past the borders.
  for (const rx of roadXs) {
    addOuterAvenue(rx, -OUTER_EXT / 2, OUTER_EXT, false);
    if (!openSouthWater) addOuterAvenue(rx, zone.h + OUTER_EXT / 2, OUTER_EXT, false);
  }
  for (const rz of roadZs) {
    addOuterAvenue(-OUTER_EXT / 2, rz, OUTER_EXT, true);
    addOuterAvenue(zone.w + OUTER_EXT / 2, rz, OUTER_EXT, true);
  }
  // Parallel outer cross-avenues framing city blocks beyond the barricades.
  const totalOuterSpanX = zone.w + OUTER_EXT * 2;
  const totalOuterSpanZ = zone.h + (openSouthWater ? OUTER_EXT : OUTER_EXT * 2);
  const centerOuterZ = openSouthWater ? (zone.h - OUTER_EXT) / 2 : zone.h / 2;
  for (const distOut of [38, 84, 130]) {
    addOuterAvenue(zone.w / 2, -distOut, totalOuterSpanX, true);
    if (!openSouthWater) addOuterAvenue(zone.w / 2, zone.h + distOut, totalOuterSpanX, true);
    addOuterAvenue(-distOut, centerOuterZ, totalOuterSpanZ, false);
    addOuterAvenue(zone.w + distOut, centerOuterZ, totalOuterSpanZ, false);
  }

  const flushBatch = (list: THREE.Matrix4[], geo: THREE.BufferGeometry, mat: THREE.Material, castShadow = false, receiveShadow = true) => {
    if (!list.length) return;
    const inst = new THREE.InstancedMesh(keep(geo), mat, list.length);
    list.forEach((m, i) => inst.setMatrixAt(i, m));
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    inst.castShadow = castShadow;
    inst.receiveShadow = receiveShadow;
    group.add(inst);
  };

  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  flushBatch(roadMats, unitBox.clone(), roadMat, false, true);
  flushBatch(walkMats, unitBox.clone(), walkMat, false, true);
  flushBatch(dashMats, unitBox.clone(), dashMat, false, false);
  flushBatch(lampPostMats, new THREE.CylinderGeometry(0.08, 0.13, 1, 8), outerPoleMat, false, false);
  flushBatch(lampHeadMats, unitBox.clone(), outerLampGlow, false, false);

  // Beyond-border buildings (near ring) & towering skyscrapers (mid + outer rings) placed cleanly on outer city blocks!
  const containerCols = [0x8c2e24, 0x1d5a64, 0xb27622, 0x243b55, 0x2b523d];
  const crownGoldMat = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(env.neon[0] ?? 0xffb860).multiplyScalar(1.4), toneMapped: false }));
  const crownCoolMat = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(env.neon[1] ?? 0x90d0ff).multiplyScalar(1.3), toneMapped: false }));
  const skyBeaconMat = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff1e24).multiplyScalar(2.6), toneMapped: false }));
  const crownMats: THREE.Matrix4[] = [];
  const crownMats2: THREE.Matrix4[] = [];
  const skyBeaconMats: THREE.Matrix4[] = [];

  const outerBands: [number, number, number][] = [
    [13, 29, 0], // Ring 1: directly visible right behind the roadblock barricades
    [46, 75, 1], // Ring 2: mid-ground tall avenues & towers
    [92, 121, 2], // Ring 3: towering high-rises
    [138, 162, 3], // Ring 4: colossal skyline skyscrapers
  ];

  const placeOuterStructure = (cx: number, cz: number, tier: number) => {
    const bw = tier === 0 ? 11 + rnd() * 9 : 13 + rnd() * 14;
    const bd = tier === 0 ? 11 + rnd() * 9 : 13 + rnd() * 14;
    const bx = cx - bw / 2;
    const bz = cz - bd / 2;
    let height = 18 + rnd() * 34;
    let ruined = rnd() < 0.2;
    let style: BuildingKind | undefined;
    let color: number | undefined;

    if (tier === 0) {
      if (nation === "reeds") {
        height = 10 + rnd() * 22;
        ruined = rnd() < 0.28;
        style = rnd() < 0.45 ? "warehouse" : "walkup";
      } else if (nation === "snow") {
        height = 14 + rnd() * 32;
        ruined = rnd() < 0.14;
        style = rnd() < 0.6 ? "cathedral" : "brownstone";
      } else if (nation === "tides") {
        height = 9 + rnd() * 20;
        ruined = rnd() < 0.15;
        if (rnd() < 0.35) {
          style = "container";
          height = 6.8 + (rnd() < 0.4 ? 3.4 : 0);
          color = containerCols[Math.floor(rnd() * containerCols.length)];
        } else {
          style = rnd() < 0.6 ? "warehouse" : "walkup";
        }
      } else if (nation === "lanterns") {
        height = 36 + rnd() * 68;
        ruined = false;
        style = rnd() < 0.5 ? "glass" : "deco";
      } else {
        height = 24 + rnd() * 58;
        ruined = rnd() < 0.6;
        style = ruined ? "ruin" : rnd() < 0.5 ? "deco" : "glass";
      }
      addBuilding({ x: bx, y: bz, w: bw, h: bd, height, ruined, style, color, seed: Math.floor(rnd() * 1e6) }, false);
      return;
    }

    // Tiers 1..3: towering skyscrapers & urban towers stretching deep past the barricades!
    const baseSky = nation === "reeds" ? 26 : nation === "tides" ? 22 : nation === "snow" ? 32 : nation === "ash" ? 44 : 52;
    const scaleTier = tier === 1 ? 1.0 : tier === 2 ? 1.45 : 1.95;
    height = (baseSky + rnd() * rnd() * 64) * scaleTier;
    const seed = Math.floor(rnd() * 1e6);
    const mats =
      nation === "snow" && height < 62
        ? gothicMats
        : nation === "ash" && rnd() < 0.45
          ? darkConcrete
          : seed % 3 === 0
            ? glassMats
            : seed % 3 === 1
              ? limeMats
              : brickMats;
    const mesh = new THREE.Mesh(keep(facadeBox(bw, height, bd, seed)), mats);
    mesh.position.set(cx, height / 2, cz);
    mesh.receiveShadow = true;
    group.add(mesh);
    if (height > 55) {
      const upperH = height * 0.24;
      const upper = new THREE.Mesh(keep(facadeBox(bw * 0.7, upperH, bd * 0.7, seed + 5)), mats);
      upper.position.set(cx, height + upperH / 2, cz);
      group.add(upper);
      const topY = height + upperH;
      pushBox(seed % 2 === 0 ? crownMats : crownMats2, cx, topY - 1.2, cz, bw * 0.74, 0.85, bd * 0.74);
      pushBox(skyBeaconMats, cx, topY + 2.5, cz, 0.75, 0.75, 0.75);
    } else if (height > 32) {
      pushBox(crownMats2, cx, height - 0.8, cz, bw + 0.4, 0.6, bd + 0.4);
    }
  };

  for (const [dMin, dMax, tier] of outerBands) {
    const midD = (dMin + dMax) / 2;
    const jitter = (dMax - dMin) * 0.22;
    // North & South blocks outside borders
    for (let x = -140; x <= zone.w + 140; x += 24) {
      if (nearRoadX(x, 6.5)) continue;
      for (const side of openSouthWater ? [-1] : [-1, 1]) {
        if (rnd() < (tier === 0 ? 0.18 : 0.14)) continue;
        const cx = x + (rnd() - 0.5) * 4;
        const cz = side < 0 ? -midD + (rnd() - 0.5) * jitter : zone.h + midD + (rnd() - 0.5) * jitter;
        if (nearRoadZ(cz, 6.2)) continue;
        placeOuterStructure(cx, cz, tier);
      }
    }
    // West & East blocks outside borders
    for (let z = 6; z <= zone.h - 6; z += 24) {
      if (nearRoadZ(z, 6.5)) continue;
      for (const side of [-1, 1]) {
        if (rnd() < (tier === 0 ? 0.18 : 0.14)) continue;
        const cx = side < 0 ? -midD + (rnd() - 0.5) * jitter : zone.w + midD + (rnd() - 0.5) * jitter;
        const cz = z + (rnd() - 0.5) * 4;
        if (nearRoadX(cx, 6.2)) continue;
        placeOuterStructure(cx, cz, tier);
      }
    }
  }
  flushBatch(crownMats, unitBox.clone(), crownGoldMat, false, false);
  flushBatch(crownMats2, unitBox.clone(), crownCoolMat, false, false);
  flushBatch(skyBeaconMats, new THREE.SphereGeometry(0.7, 6, 4), skyBeaconMat, false, false);

  // Red Hook Docks: anchored cargo freighters & distant harbor skyline across the open southern bay!
  if (openSouthWater) {
    const hullMat = keep(new THREE.MeshStandardMaterial({ color: 0x1b222a, metalness: 0.65, roughness: 0.55 }));
    const cabinGlow = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb860).multiplyScalar(1.6), toneMapped: false }));
    for (const [fx, fz, fyaw] of [
      [zone.w * 0.26, zone.h + 95, 0.25],
      [zone.w * 0.68, zone.h + 135, -0.18],
      [zone.w * 0.48, zone.h + 190, 0.08],
    ] as const) {
      const ship = new THREE.Group();
      const hull = new THREE.Mesh(keep(new THREE.BoxGeometry(32, 5.5, 9)), hullMat);
      hull.position.y = 2.75;
      const bridge = new THREE.Mesh(keep(new THREE.BoxGeometry(7, 8, 7)), hullMat);
      bridge.position.set(-9, 8.5, 0);
      const win = new THREE.Mesh(keep(new THREE.BoxGeometry(7.2, 1.4, 7.2)), cabinGlow);
      win.position.set(-9, 10.8, 0);
      ship.add(hull, bridge, win);
      for (let ci = 0; ci < 3; ci++) {
        const stack = new THREE.Mesh(keep(new THREE.BoxGeometry(6.5, 4.2, 6.5)), getContainerMats(containerCols[ci % containerCols.length])[0]);
        stack.position.set(1 + ci * 7.5, 7.2, 0);
        ship.add(stack);
      }
      ship.position.set(fx, 0, fz);
      ship.rotation.y = fyaw;
      group.add(ship);
    }
  }

  // ---------- GTA-Style Perimeter Road-Stop Barricades & Security Fencing (at EDGE = 1.6m) ----------
  const EDGE = 1.6;
  const redStripeMat = keep(
    new THREE.MeshStandardMaterial({
      map: keep(barricadeStripeTexture("red")),
      roughness: 0.68,
      metalness: 0.1,
    }),
  );
  const yellowStripeMat = keep(
    new THREE.MeshStandardMaterial({
      map: keep(barricadeStripeTexture("yellow")),
      roughness: 0.62,
      metalness: 0.25,
    }),
  );
  const jerseyMat = keep(
    new THREE.MeshStandardMaterial({
      color: nation === "snow" ? 0xaab4be : 0x8e8b85,
      roughness: 0.88,
      normalMap: keep(tiled(det.concrete, 2, 1)),
    }),
  );
  const coneMat = keep(new THREE.MeshStandardMaterial({ color: 0xe85a14, roughness: 0.55 }));
  const coneRingMat = keep(new THREE.MeshBasicMaterial({ color: 0xf4f4f2 }));
  const fenceSteelMat = keep(new THREE.MeshStandardMaterial({ color: 0x3b4046, metalness: 0.82, roughness: 0.45 }));
  const bollardMat = keep(new THREE.MeshStandardMaterial({ color: 0xd89a18, metalness: 0.45, roughness: 0.45 }));
  const amberFlashMat = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff9a10).multiplyScalar(2.8), transparent: true, toneMapped: false }));
  signs.push({ mat: amberFlashMat, seed: 777, base: 2.8 });

  const jerseyMats: THREE.Matrix4[] = [];
  const sawhorseBoardMats: THREE.Matrix4[] = [];
  const sawhorseLegMats: THREE.Matrix4[] = [];
  const coneMats: THREE.Matrix4[] = [];
  const coneRingMats: THREE.Matrix4[] = [];
  const bollardMats: THREE.Matrix4[] = [];
  const boomMats: THREE.Matrix4[] = [];
  const fencePostMats: THREE.Matrix4[] = [];
  const fenceRailMats: THREE.Matrix4[] = [];
  const amberBeaconMats: THREE.Matrix4[] = [];

  const pushRotBox = (list: THREE.Matrix4[], x: number, y: number, z: number, sx: number, sy: number, sz: number, yaw: number, tilt = 0) => {
    dOut.position.set(x, y, z);
    dOut.rotation.set(tilt, yaw, 0, "YXZ");
    dOut.scale.set(sx, sy, sz);
    dOut.updateMatrix();
    list.push(dOut.matrix.clone());
  };

  const addRoadStop = (x: number, z: number, yaw: number, withLight: boolean) => {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const place = (u: number, w: number) => ({ x: x + c * u + s * w, z: z - s * u + c * w });

    // Staggered double Concrete Jersey Barriers across the roadway.
    for (const [u, w] of [[-2.5, 0], [0, -0.35], [2.5, 0]] as const) {
      const p = place(u, w);
      pushRotBox(jerseyMats, p.x, 0.48, p.z, 2.35, 0.96, 0.62, yaw);
    }
    // Red-and-white striped "ROAD CLOSED" Sawhorse Barricades + flashing amber beacons!
    for (const u of [-2.2, 2.2]) {
      const p = place(u, 0.85);
      pushRotBox(sawhorseBoardMats, p.x, 0.96, p.z, 2.5, 0.36, 0.08, yaw);
      pushRotBox(sawhorseBoardMats, p.x, 0.52, p.z, 2.5, 0.24, 0.08, yaw);
      for (const ls of [-0.95, 0.95]) {
        const lp = place(u + ls, 0.85);
        pushRotBox(sawhorseLegMats, lp.x, 0.55, lp.z, 0.08, 1.15, 0.08, yaw, 0.22);
        pushRotBox(sawhorseLegMats, lp.x, 0.55, lp.z, 0.08, 1.15, 0.08, yaw, -0.22);
      }
      pushRotBox(amberBeaconMats, p.x, 1.24, p.z, 0.22, 0.22, 0.22, yaw);
    }
    // Yellow bollards + striped steel road-stop boom bar across the lane.
    for (const u of [-4.1, 4.1]) {
      const bp = place(u, 0.4);
      pushRotBox(bollardMats, bp.x, 0.65, bp.z, 0.24, 1.3, 0.24, yaw);
    }
    const boomP = place(0, 0.4);
    pushRotBox(boomMats, boomP.x, 1.12, boomP.z, 8.2, 0.16, 0.12, yaw);

    // Reflective orange traffic cones on the approach side.
    for (const u of [-3.3, -1.1, 1.1, 3.3]) {
      const cp = place(u, 1.55);
      pushRotBox(coneMats, cp.x, 0.36, cp.z, 0.42, 0.72, 0.42, yaw);
      pushRotBox(coneRingMats, cp.x, 0.44, cp.z, 0.28, 0.16, 0.28, yaw);
    }
    if (withLight) {
      const lp = place(0, 0.85);
      lights.push({ pos: new THREE.Vector3(lp.x, 1.5, lp.z), color: 0xff8c18, intensity: 22, distance: 16, flicker: 2, seed: Math.round(lp.x + lp.z) });
    }
  };

  let roadStopIdx = 0;
  // North & South Perimeter Edges
  for (const [zEdge, yaw, isHarborQuay] of [
    [EDGE, 0, false],
    [zone.h - EDGE, Math.PI, openSouthWater],
  ] as const) {
    if (isHarborQuay) {
      // Southern dock quay guardrail & yellow/black hazard edge in Red Hook Docks (sightline across harbor stays clear!).
      for (let x = 3; x <= zone.w - 3; x += 4.5) {
        pushRotBox(bollardMats, x, 0.55, zEdge, 0.22, 1.1, 0.22, 0);
        if (x + 4.5 <= zone.w - 3) {
          pushRotBox(boomMats, x + 2.25, 0.92, zEdge, 4.4, 0.12, 0.1, 0);
          pushRotBox(fenceRailMats, x + 2.25, 0.48, zEdge, 4.4, 0.06, 0.06, 0);
        }
        if (Math.round(x) % 18 === 3) pushRotBox(amberBeaconMats, x, 1.18, zEdge, 0.2, 0.2, 0.2, 0);
      }
      continue;
    }
    // Road-stop barricades at every street centerline meeting this border!
    for (const rx of roadXs) {
      if (rx < 6 || rx > zone.w - 6) continue;
      addRoadStop(rx, zEdge, yaw, roadStopIdx++ % 3 === 0);
    }
    // Continuous low concrete jersey barrier + see-through steel fence between street roadblocks.
    for (let x = 2.8; x <= zone.w - 2.8; x += 3.2) {
      if (nearRoadX(x, 4.2)) continue;
      pushRotBox(jerseyMats, x, 0.46, zEdge, 3.05, 0.92, 0.56, 0);
      pushRotBox(fencePostMats, x - 1.45, 0.78, zEdge, 0.08, 1.56, 0.08, 0);
      pushRotBox(fenceRailMats, x, 1.48, zEdge, 3.15, 0.06, 0.06, 0);
      pushRotBox(fenceRailMats, x, 1.18, zEdge, 3.15, 0.05, 0.05, 0);
    }
  }

  // West & East Perimeter Edges
  for (const [xEdge, yaw] of [
    [EDGE, Math.PI / 2],
    [zone.w - EDGE, -Math.PI / 2],
  ] as const) {
    for (const rz of roadZs) {
      if (rz < 6 || rz > zone.h - 6) continue;
      addRoadStop(xEdge, rz, yaw, roadStopIdx++ % 3 === 0);
    }
    for (let z = 2.8; z <= zone.h - 2.8; z += 3.2) {
      if (nearRoadZ(z, 4.2)) continue;
      pushRotBox(jerseyMats, xEdge, 0.46, z, 3.05, 0.92, 0.56, Math.PI / 2);
      pushRotBox(fencePostMats, xEdge, 0.78, z - 1.45, 0.08, 1.56, 0.08, Math.PI / 2);
      pushRotBox(fenceRailMats, xEdge, 1.48, z, 3.15, 0.06, 0.06, Math.PI / 2);
      pushRotBox(fenceRailMats, xEdge, 1.18, z, 3.15, 0.05, 0.05, Math.PI / 2);
    }
  }

  flushBatch(jerseyMats, new RoundedBoxGeometry(1, 1, 1, 2, 0.08), jerseyMat, true, true);
  flushBatch(sawhorseBoardMats, unitBox.clone(), redStripeMat, true, true);
  flushBatch(sawhorseLegMats, unitBox.clone(), fenceSteelMat, true, false);
  flushBatch(coneMats, new THREE.ConeGeometry(0.5, 1, 10), coneMat, true, true);
  flushBatch(coneRingMats, new THREE.CylinderGeometry(0.42, 0.48, 1, 10), coneRingMat, false, false);
  flushBatch(bollardMats, new THREE.CylinderGeometry(0.5, 0.5, 1, 10), bollardMat, true, true);
  flushBatch(boomMats, unitBox.clone(), yellowStripeMat, true, true);
  flushBatch(fencePostMats, unitBox.clone(), fenceSteelMat, true, false);
  flushBatch(fenceRailMats, unitBox.clone(), fenceSteelMat, false, false);
  flushBatch(amberBeaconMats, new THREE.SphereGeometry(0.5, 8, 6), amberFlashMat, false, false);
  unitBox.dispose();

  // ---------- Stronghold walls and gate ----------
  const wallCfg: Record<Zone["nation"], { color: number; metal: number; rough: number; lamp: number; gateCol: number }> = {
    reeds: { color: 0x626862, metal: 0.1, rough: 0.92, lamp: 0xff8830, gateCol: 0x4e2d20 },
    snow: { color: 0x8e9aa8, metal: 0.05, rough: 0.88, lamp: 0xff2a38, gateCol: 0x4c1820 },
    tides: { color: 0x34444e, metal: 0.68, rough: 0.56, lamp: 0xffa830, gateCol: 0x68241c },
    lanterns: { color: 0x262234, metal: 0.45, rough: 0.5, lamp: 0xff1e8a, gateCol: 0x481038 },
    ash: { color: 0x362a26, metal: 0.25, rough: 0.88, lamp: 0xff3b18, gateCol: 0x5c1810 },
  };
  const wc = wallCfg[nation];
  const wallMat = keep(
    new THREE.MeshStandardMaterial({
      color: wc.color,
      metalness: wc.metal,
      roughness: wc.rough,
      normalMap: keep(tiled(det.concrete, 3, 1)),
      normalScale: new THREE.Vector2(1.5, 1.5),
    }),
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
    const long = Math.max(w.w, w.h);
    for (let s = 3; s < long; s += 9) {
      const px = w.w > w.h ? w.x + s : w.x + w.w / 2;
      const py = w.w > w.h ? w.y + w.h / 2 : w.y + s;
      lights.push({ pos: new THREE.Vector3(px, 7, py), color: wc.lamp, intensity: 15, distance: 16, flicker: 0, seed: s });
      const lamp = new THREE.Mesh(
        keep(new THREE.SphereGeometry(0.18, 8, 6)),
        keep(new THREE.MeshBasicMaterial({ color: wc.lamp, toneMapped: false })),
      );
      lamp.position.set(px, 6.8, py);
      group.add(lamp);
    }
  }
  if (zone.gate) {
    const shutter = keep(new THREE.MeshStandardMaterial({ color: wc.gateCol, metalness: 0.8, roughness: 0.45, normalMap: keep(tiled(det.fabric, 2, 6)) }));
    addWall(zone.gate, 5.8, shutter);
    const g = zone.gate;
    lights.push({ pos: new THREE.Vector3(g.x - 1.5, 4, g.y + g.h / 2), color: wc.lamp, intensity: 34, distance: 18, flicker: 2, seed: 99 });
  }

  // ---------- Parkour Wall Holds & Projecting Beams ----------
  if (zone.ledges.length) {
    const dummyL = new THREE.Object3D();
    const holdMat = keep(new THREE.MeshStandardMaterial({ color: 0x5c6268, roughness: 0.72, metalness: 0.35, normalMap: keep(tiled(det.concrete, 2, 1)) }));
    const beamMat = keep(new THREE.MeshStandardMaterial({ color: nation === "snow" ? 0x6a7886 : 0x6e4e34, roughness: 0.65, metalness: 0.25, normalMap: keep(tiled(det.fabric, 2, 1)) }));
    const edgeAccentMat = keep(new THREE.MeshBasicMaterial({ color: nation === "lanterns" ? 0xe070a0 : 0xc9b8a0 }));
    const holdList = zone.ledges.filter((l) => l.kind === "hold");
    const beamList = zone.ledges.filter((l) => l.kind === "beam");

    const emitLedgeBatch = (list: typeof zone.ledges, mat: THREE.Material) => {
      if (!list.length) return;
      const bodyGeo = keep(new RoundedBoxGeometry(1, 1, 1, 2, 0.04));
      const stripGeo = keep(new THREE.BoxGeometry(1, 1, 1));
      const inst = new THREE.InstancedMesh(bodyGeo, mat, list.length);
      const stripInst = new THREE.InstancedMesh(stripGeo, edgeAccentMat, list.length);
      list.forEach((l, i) => {
        const cx = l.x + l.w * 0.5;
        const cz = l.y + l.h * 0.5;
        dummyL.position.set(cx, l.z - l.thickness * 0.5, cz);
        dummyL.rotation.set(0, 0, 0);
        dummyL.scale.set(l.w, l.thickness, l.h);
        dummyL.updateMatrix();
        inst.setMatrixAt(i, dummyL.matrix);

        // Chalked / worn outer lip highlights the climbable edge cleanly at night.
        dummyL.position.set(
          cx + l.nx * Math.max(0, (Math.abs(l.nx) * l.w) * 0.5 - 0.03),
          l.z - 0.015,
          cz + l.ny * Math.max(0, (Math.abs(l.ny) * l.h) * 0.5 - 0.03),
        );
        dummyL.scale.set(l.nx === 0 ? l.w * 0.94 : 0.08, 0.035, l.ny === 0 ? l.h * 0.94 : 0.08);
        dummyL.updateMatrix();
        stripInst.setMatrixAt(i, dummyL.matrix);
      });
      inst.instanceMatrix.needsUpdate = true;
      inst.computeBoundingSphere();
      inst.castShadow = true;
      inst.receiveShadow = true;
      stripInst.instanceMatrix.needsUpdate = true;
      stripInst.computeBoundingSphere();
      group.add(inst, stripInst);
    };
    emitLedgeBatch(holdList, holdMat);
    emitLedgeBatch(beamList, beamMat);
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
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    inst.castShadow = true;
    inst.receiveShadow = true;
    group.add(inst);
  };
  const concrete = keep(
    new THREE.MeshStandardMaterial({
      color: nation === "snow" ? 0xb4bec8 : nation === "ash" ? 0x5c524c : 0x9a9792,
      roughness: 0.85,
      normalMap: keep(tiled(det.concrete, 1.5)),
      normalScale: new THREE.Vector2(1.5, 1.5),
    }),
  );
  instanced(counts.barrier, new RoundedBoxGeometry(2, 0.9, 0.6, 2, 0.06), concrete, (_, o) => (o.position.y = 0.45));
  instanced(
    counts.crate,
    new RoundedBoxGeometry(1, 1, 1, 2, 0.03),
    keep(new THREE.MeshStandardMaterial({ color: nation === "tides" ? 0x84603c : 0x7a5e40, roughness: 0.85, normalMap: keep(tiled(det.fabric, 1, 4)) })),
    (p, o) => {
      const s = 0.7 + ((p.seed % 10) / 10) * 0.6;
      o.scale.setScalar(s);
      o.position.y = s / 2;
    },
  );
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
    if (p.seed % 4 === 0) lights.push({ pos: new THREE.Vector3(p.x, 0.8, p.y), color: 0xc8102e, intensity: 5, distance: 7, flicker: 2, seed: p.seed });
  }

  // Street lamps tinted to each district's lighting signature.
  const poleGeo = keep(new THREE.CylinderGeometry(0.08, 0.12, 6, 10));
  const headGeo = keep(new RoundedBoxGeometry(0.9, 0.18, 0.35, 2, 0.05));
  const poleMat = keep(new THREE.MeshStandardMaterial({ color: nation === "snow" ? 0x262e38 : 0x3e4042, metalness: 0.85, roughness: 0.5 }));
  const lampOn = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(env.lampColor).multiplyScalar(2), toneMapped: false }));
  const showStreetSigns = nation !== "snow" && nation !== "tides";
  for (const p of counts.lamp ?? []) {
    const lit = p.seed % 3 !== 0;
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(p.x, 3, p.y);
    pole.castShadow = true;
    const head = new THREE.Mesh(headGeo, lit ? lampOn : poleMat);
    head.position.set(p.x + 0.35, 6, p.y);
    group.add(pole, head);
    if (showStreetSigns && p.seed % 2 === 0) arch.streetSign(p.x, p.y);
    if (lit) lights.push({ pos: new THREE.Vector3(p.x + 0.4, 5.6, p.y), color: env.lampColor, intensity: 80, distance: 28, flicker: p.seed % 7 === 0 ? 2 : 0, seed: p.seed });
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

  // Burning barrels (iron temple braziers in Snow & Ash, oil drums elsewhere).
  const useBrazier = nation === "snow" || nation === "ash";
  const barrelGeo = keep(new THREE.CylinderGeometry(0.35, 0.35, 0.9, 16, 1, true));
  const brazierPedGeo = keep(new THREE.CylinderGeometry(0.18, 0.32, 0.65, 8));
  const brazierBowlGeo = keep(new THREE.CylinderGeometry(0.5, 0.22, 0.38, 10));
  const barrelMat = keep(
    new THREE.MeshStandardMaterial({
      color: useBrazier ? 0x262426 : 0x6a3a24,
      metalness: useBrazier ? 0.85 : 0.7,
      roughness: useBrazier ? 0.48 : 0.8,
      side: THREE.DoubleSide,
      normalMap: keep(tiled(det.leather, 2)),
    }),
  );
  const flameGeo = keep(new THREE.ConeGeometry(0.32, 1, 10, 1, true));
  const flameMat = keep(
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff6a1a).multiplyScalar(2.5), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  for (const p of counts.fire ?? []) {
    if (useBrazier) {
      const ped = new THREE.Mesh(brazierPedGeo, barrelMat);
      ped.position.set(p.x, 0.32, p.y);
      ped.castShadow = true;
      const bowl = new THREE.Mesh(brazierBowlGeo, barrelMat);
      bowl.position.set(p.x, 0.82, p.y);
      bowl.castShadow = true;
      group.add(ped, bowl);
    } else {
      const barrel = new THREE.Mesh(barrelGeo, barrelMat);
      barrel.position.set(p.x, 0.45, p.y);
      barrel.castShadow = true;
      group.add(barrel);
    }
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(p.x, 1.32, p.y);
    flame.userData.seed = p.seed;
    group.add(flame);
    flames.push(flame);
    lights.push({ pos: new THREE.Vector3(p.x, 1.65, p.y), color: 0xff7a30, intensity: 36, distance: 16, flicker: 1, seed: p.seed });
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

  // Bespoke district hideout, stronghold hall theme, landmarks, water/vegetation, and far skyline.
  buildDistrictFeatures({ zone, group, keep, lights, emitters, flames, det });

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
