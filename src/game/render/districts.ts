import * as THREE from "three";
import type { Zone } from "../engine/state";
import { mulberry } from "../engine/world";
import type { Emitter, LightSource } from "./city";
import { facadeBox, farSkyline } from "./nyc";
import { skylineTexture } from "./textures";

// District-specific 3D architecture, landmarks, biome vegetation, custom hideouts,
// stronghold adornments and bespoke far skylines so all 5 districts feel unmistakable.

type Keep = <T extends { dispose: () => void }>(x: T) => T;

export interface DistrictContext {
  zone: Zone;
  group: THREE.Group;
  keep: Keep;
  lights: LightSource[];
  emitters: Emitter[];
  flames: THREE.Mesh[];
  det: { asphalt: THREE.Texture; concrete: THREE.Texture; fabric: THREE.Texture; leather: THREE.Texture };
}

const dummy = new THREE.Object3D();

function tiled(t: THREE.Texture, keep: Keep, x: number, y = x) {
  const c = t.clone();
  c.repeat.set(x, y);
  c.needsUpdate = true;
  return keep(c);
}

/** Builds custom hideout shelter, stronghold wall trim, district landmarks and far skyline. */
export function buildDistrictFeatures(ctx: DistrictContext) {
  const nation = ctx.zone.id === "memory" ? "ash" : ctx.zone.nation;
  buildHideout(ctx, nation);
  buildStrongholdTheme(ctx, nation);

  switch (nation) {
    case "reeds":
      buildReeds(ctx);
      break;
    case "snow":
      buildSnow(ctx);
      break;
    case "tides":
      buildTides(ctx);
      break;
    case "lanterns":
      buildLanterns(ctx);
      break;
    case "ash":
      buildAsh(ctx);
      break;
  }

  buildDistrictSkyline(ctx, nation);
}

// ---------- District-styled Hideouts ----------

function buildHideout(ctx: DistrictContext, nation: Zone["nation"]) {
  const { zone, group, keep, lights, det } = ctx;
  const v = zone.pois.village;
  const hx = v.x;
  const hz = v.y - 1;

  if (nation === "reeds") {
    // Culvert concrete arch & corrugated tin shelter.
    const concrete = keep(new THREE.MeshStandardMaterial({ color: 0x626660, roughness: 0.9, normalMap: tiled(det.concrete, keep, 2) }));
    const tin = keep(new THREE.MeshStandardMaterial({ color: 0x5c4d42, metalness: 0.7, roughness: 0.65 }));
    for (const sx of [-4.2, 4.2]) {
      const pier = new THREE.Mesh(keep(new THREE.BoxGeometry(0.9, 3.6, 5.4)), concrete);
      pier.position.set(hx + sx, 1.8, hz);
      pier.castShadow = true;
      pier.receiveShadow = true;
      group.add(pier);
    }
    const roof = new THREE.Mesh(keep(new THREE.BoxGeometry(9.6, 0.2, 6.2)), tin);
    roof.position.set(hx, 3.65, hz);
    roof.rotation.x = 0.12;
    roof.castShadow = true;
    group.add(roof);
    lights.push({ pos: new THREE.Vector3(hx, 3.1, hz), color: 0xffa448, intensity: 48, distance: 22, flicker: 1, seed: 7 });
    return;
  }

  if (nation === "snow") {
    // Timber & slate pitched-roof Bodega Shelter dusted with snow.
    const timber = keep(new THREE.MeshStandardMaterial({ color: 0x483222, roughness: 0.85 }));
    const snowRoof = keep(new THREE.MeshStandardMaterial({ color: 0xd0dce8, roughness: 0.92 }));
    for (const [ox, oz] of [[-4.2, -2.6], [4.2, -2.6], [-4.2, 2.6], [4.2, 2.6]]) {
      const post = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.18, 0.22, 3.6, 8)), timber);
      post.position.set(hx + ox, 1.8, hz + oz);
      post.castShadow = true;
      group.add(post);
    }
    const gable = new THREE.Mesh(keep(new THREE.ConeGeometry(6.8, 2.2, 4)), snowRoof);
    gable.position.set(hx, 4.6, hz);
    gable.rotation.y = Math.PI / 4;
    gable.scale.set(1.1, 1, 0.85);
    gable.castShadow = true;
    group.add(gable);
    lights.push({ pos: new THREE.Vector3(hx, 3.1, hz), color: 0xffb868, intensity: 52, distance: 22, flicker: 1, seed: 7 });
    return;
  }

  if (nation === "tides") {
    // Dockside Net-Menders' Row wooden lean-to with maritime storm lamps.
    const wood = keep(new THREE.MeshStandardMaterial({ color: 0x4c3c2e, roughness: 0.9 }));
    const canvasMat = keep(new THREE.MeshStandardMaterial({ color: 0x26444e, roughness: 0.88, side: THREE.DoubleSide, normalMap: tiled(det.fabric, keep, 4) }));
    for (const [ox, oz] of [[-4.3, -2.5], [4.3, -2.5], [-4.3, 2.5], [4.3, 2.5]]) {
      const piling = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.22, 0.26, 3.8, 10)), wood);
      piling.position.set(hx + ox, 1.9, hz + oz);
      piling.castShadow = true;
      group.add(piling);
    }
    const canopy = new THREE.Mesh(keep(new THREE.BoxGeometry(9.4, 0.14, 5.8)), canvasMat);
    canopy.position.set(hx, 3.7, hz);
    canopy.rotation.x = 0.14;
    canopy.castShadow = true;
    group.add(canopy);
    const greenBulb = new THREE.Mesh(keep(new THREE.SphereGeometry(0.22, 10, 8)), keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(0x30ffb0).multiplyScalar(2.2), toneMapped: false })));
    greenBulb.position.set(hx - 4.1, 3.2, hz + 2.5);
    group.add(greenBulb);
    lights.push({ pos: new THREE.Vector3(hx, 3.1, hz), color: 0xffb058, intensity: 46, distance: 22, flicker: 1, seed: 7 });
    return;
  }

  if (nation === "lanterns") {
    // Sign-Makers' glowing neon workshop awning!
    const darkMetal = keep(new THREE.MeshStandardMaterial({ color: 0x1e1a24, metalness: 0.8, roughness: 0.4 }));
    const awning = new THREE.Mesh(keep(new THREE.BoxGeometry(9.2, 0.18, 5.8)), darkMetal);
    awning.position.set(hx, 3.6, hz);
    awning.castShadow = true;
    group.add(awning);
    for (const [ox, oz] of [[-4.2, -2.5], [4.2, -2.5], [-4.2, 2.5], [4.2, 2.5]]) {
      const post = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.12, 0.14, 3.6, 8)), darkMetal);
      post.position.set(hx + ox, 1.8, hz + oz);
      group.add(post);
    }
    const cyan = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(0x00e5ff).multiplyScalar(2.4), toneMapped: false }));
    const magenta = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2070).multiplyScalar(2.4), toneMapped: false }));
    const bar1 = new THREE.Mesh(keep(new THREE.BoxGeometry(8.8, 0.12, 0.12)), cyan);
    bar1.position.set(hx, 3.45, hz + 2.85);
    const bar2 = new THREE.Mesh(keep(new THREE.BoxGeometry(8.8, 0.12, 0.12)), magenta);
    bar2.position.set(hx, 3.45, hz - 2.85);
    group.add(bar1, bar2);
    lights.push({ pos: new THREE.Vector3(hx, 3.2, hz), color: 0xff5a98, intensity: 48, distance: 22, flicker: 0, seed: 7 });
    return;
  }

  // Ash Ward: Gravekeeper's dark shrine pavilion with stone toro lanterns.
  const darkWood = keep(new THREE.MeshStandardMaterial({ color: 0x2a1d18, roughness: 0.88 }));
  const crimsonTrim = keep(new THREE.MeshStandardMaterial({ color: 0x7c1816, roughness: 0.6 }));
  for (const [ox, oz] of [[-4.2, -2.5], [4.2, -2.5], [-4.2, 2.5], [4.2, 2.5]]) {
    const col = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.2, 0.24, 3.8, 10)), crimsonTrim);
    col.position.set(hx + ox, 1.9, hz + oz);
    col.castShadow = true;
    group.add(col);
  }
  const eaves = new THREE.Mesh(keep(new THREE.BoxGeometry(10, 0.25, 6.4)), darkWood);
  eaves.position.set(hx, 3.9, hz);
  eaves.castShadow = true;
  const ridge = new THREE.Mesh(keep(new THREE.BoxGeometry(10.4, 0.35, 1.2)), crimsonTrim);
  ridge.position.set(hx, 4.35, hz);
  group.add(eaves, ridge);
  lights.push({ pos: new THREE.Vector3(hx, 3.2, hz), color: 0xff7a30, intensity: 52, distance: 24, flicker: 1, seed: 7 });
}

// ---------- Stronghold Wall & Hall Embellishments ----------

function buildStrongholdTheme(ctx: DistrictContext, nation: Zone["nation"]) {
  const { zone, group, keep, lights, emitters, flames } = ctx;
  const f = zone.fortress;
  const h = zone.hall;
  if (!f || !h) return;

  const midZ = f.y + f.h / 2;
  const hallCenterX = h.x + h.w / 2;
  const hallCenterZ = h.y + h.h / 2;

  // Hall floor runner tailored to each general!
  const runnerColors: Record<Zone["nation"], number> = {
    reeds: 0x4c3a28, // weathered timber/burlap runner
    snow: 0x7a1a22, // cathedral crimson-gold carpet
    tides: 0x26323a, // dark ship-deck planks
    lanterns: 0x8a1026, // kabuki stage scarlet lacquer
    ash: 0x3a1410, // scorched ceremonial runner
  };
  const carpetMat = keep(
    new THREE.MeshStandardMaterial({
      color: runnerColors[nation],
      roughness: nation === "lanterns" ? 0.3 : 0.9,
      metalness: nation === "lanterns" ? 0.2 : 0,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  const carpet = new THREE.Mesh(keep(new THREE.PlaneGeometry(h.w - 4, 6)), carpetMat);
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.set(hallCenterX, 0.03, hallCenterZ);
  carpet.receiveShadow = true;
  group.add(carpet);

  // Corner watchtowers / bastions framing the stronghold entrance & corners.
  const towerColors: Record<Zone["nation"], { body: number; trim: number; light: number }> = {
    reeds: { body: 0x5c4a3c, trim: 0x3b3530, light: 0xff8028 },
    snow: { body: 0xb6bec6, trim: 0x424c58, light: 0xffbe68 },
    tides: { body: 0x3e4850, trim: 0x8c2e24, light: 0x30e0a0 },
    lanterns: { body: 0x221628, trim: 0xd01838, light: 0x00e5ff },
    ash: { body: 0x262220, trim: 0xb86820, light: 0xff4018 },
  };
  const tc = towerColors[nation];
  const bodyMat = keep(new THREE.MeshStandardMaterial({ color: tc.body, roughness: 0.78, metalness: nation === "tides" ? 0.55 : 0.15 }));
  const trimMat = keep(new THREE.MeshStandardMaterial({ color: tc.trim, roughness: 0.5, metalness: 0.5 }));
  const glowMat = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(tc.light).multiplyScalar(2.4), toneMapped: false }));

  for (const [cx, cz] of [
    [f.x, f.y],
    [f.x, f.y + f.h],
    [f.x + f.w, f.y],
    [f.x + f.w, f.y + f.h],
  ]) {
    const bastion = new THREE.Mesh(keep(new THREE.BoxGeometry(3.4, 10.5, 3.4)), bodyMat);
    bastion.position.set(cx, 5.25, cz);
    bastion.castShadow = true;
    bastion.receiveShadow = true;
    const cap = new THREE.Mesh(keep(new THREE.BoxGeometry(4.0, 0.7, 4.0)), trimMat);
    cap.position.set(cx, 10.6, cz);
    const beacon = new THREE.Mesh(keep(new THREE.SphereGeometry(0.32, 10, 8)), glowMat);
    beacon.position.set(cx, 11.4, cz);
    group.add(bastion, cap, beacon);
  }

  // Ceremonial flaming braziers flanking the hall inside every stronghold!
  const brazierMat = keep(new THREE.MeshStandardMaterial({ color: 0x282422, metalness: 0.85, roughness: 0.45 }));
  const flameGeo = keep(new THREE.ConeGeometry(0.36, 1.2, 10, 1, true));
  const flameMat = keep(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(nation === "lanterns" ? 0xff2870 : 0xff6a1a).multiplyScalar(2.8),
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  for (let i = 0; i < 3; i++) {
    const bx = h.x + 5 + i * 8;
    for (const bz of [midZ - 6.5, midZ + 6.5]) {
      const stand = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.45, 0.3, 1.1, 8)), brazierMat);
      stand.position.set(bx, 0.55, bz);
      stand.castShadow = true;
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.set(bx, 1.55, bz);
      flame.userData.seed = i * 17 + bz;
      group.add(stand, flame);
      flames.push(flame);
      emitters.push({ pos: new THREE.Vector3(bx, 1.6, bz), kind: "fire" });
      lights.push({ pos: new THREE.Vector3(bx, 2.2, bz), color: nation === "lanterns" ? 0xff3080 : 0xff7a28, intensity: 28, distance: 16, flicker: 1, seed: i * 13 });
    }
  }
}

// ---------- 1. THE DROWNED BOROUGH (Queens · Reeds) ----------

function buildReeds(ctx: DistrictContext) {
  const { zone, group, keep, lights, det } = ctx;
  const rnd = mulberry(1017);

  // Expansive shimmering floodwater lagoons around Flooded Lots & Ferry Slip!
  const waterMat = keep(
    new THREE.MeshPhysicalMaterial({
      color: zone.env.waterColor,
      roughness: 0.05,
      metalness: 0.05,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      normalMap: tiled(det.concrete, keep, 7),
      normalScale: new THREE.Vector2(0.14, 0.14),
      envMapIntensity: 2.1,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  const pools: [number, number, number, number][] = [
    [zone.pois.fields.x, zone.pois.fields.y, 19, 14],
    [zone.pois.water.x, zone.pois.water.y, 22, 16],
    [zone.w * 0.22, zone.h * 0.8, 17, 12],
    [zone.w * 0.58, zone.h * 0.8, 15, 11],
  ];
  for (const [px, pz, rx, rz] of pools) {
    const p = new THREE.Mesh(keep(new THREE.CircleGeometry(1, 36)), waterMat);
    p.rotation.x = -Math.PI / 2;
    p.scale.set(rx, rz, 1);
    p.position.set(px, 0.03, pz);
    p.receiveShadow = true;
    group.add(p);
  }

  // Weathered timber boardwalk planks spanning the flooded lots & ferry slip.
  const plankMat = keep(new THREE.MeshStandardMaterial({ color: 0x4d3e30, roughness: 0.92, normalMap: tiled(det.fabric, keep, 4) }));
  const addBoardwalk = (x: number, z: number, len: number, rotY: number) => {
    const bw = new THREE.Mesh(keep(new THREE.BoxGeometry(len, 0.16, 3.2)), plankMat);
    bw.position.set(x, 0.09, z);
    bw.rotation.y = rotY;
    bw.receiveShadow = true;
    group.add(bw);
  };
  addBoardwalk(zone.pois.fields.x, zone.pois.fields.y, 26, 0.15);
  addBoardwalk(zone.pois.water.x, zone.pois.water.y, 28, -0.2);

  // Instanced marsh reeds & cattails bursting along the flooded basin banks!
  const reedCount = 460;
  const stalkGeo = keep(new THREE.CylinderGeometry(0.025, 0.055, 2.2, 5));
  stalkGeo.translate(0, 1.1, 0);
  const stalkMat = keep(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88 }));
  const headGeo = keep(new THREE.CylinderGeometry(0.065, 0.065, 0.36, 6));
  headGeo.translate(0, 1.95, 0);
  const headMat = keep(new THREE.MeshStandardMaterial({ color: 0x4a2c1c, roughness: 0.92 }));

  const stalks = new THREE.InstancedMesh(stalkGeo, stalkMat, reedCount);
  const heads = new THREE.InstancedMesh(headGeo, headMat, reedCount);
  const c = new THREE.Color();
  let placed = 0;
  for (let i = 0; i < reedCount; i++) {
    const pool = pools[i % pools.length];
    const ang = rnd() * Math.PI * 2;
    const edge = 0.62 + rnd() * 0.55;
    const x = pool[0] + Math.cos(ang) * pool[2] * edge + (rnd() - 0.5) * 3;
    const z = pool[1] + Math.sin(ang) * pool[3] * edge + (rnd() - 0.5) * 3;
    const scaleH = 0.65 + rnd() * 0.85;
    dummy.position.set(x, 0, z);
    dummy.rotation.set((rnd() - 0.5) * 0.35, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.35);
    dummy.scale.set(1, scaleH, 1);
    dummy.updateMatrix();
    stalks.setMatrixAt(placed, dummy.matrix);
    heads.setMatrixAt(placed, dummy.matrix);
    c.setHSL(0.24 + (rnd() - 0.5) * 0.07, 0.28 + rnd() * 0.14, 0.24 + rnd() * 0.14);
    stalks.setColorAt(placed, c);
    placed++;
  }
  stalks.count = heads.count = placed;
  stalks.computeBoundingSphere();
  heads.computeBoundingSphere();
  group.add(stalks, heads);

  // Elevated Queens Steel Rail Viaduct ("The El") spanning Toll Boulevard overhead!
  const rustSteel = keep(new THREE.MeshStandardMaterial({ color: 0x463a34, metalness: 0.78, roughness: 0.62 }));
  const trackY = 7.4;
  const vy = zone.pois.road.y;
  const startX = 12;
  const endX = zone.fortress ? zone.fortress.x - 6 : zone.w * 0.72;
  const spanLen = endX - startX;
  const midX = (startX + endX) / 2;
  for (const dz of [-2.4, 2.4]) {
    const girder = new THREE.Mesh(keep(new THREE.BoxGeometry(spanLen, 1.25, 0.55)), rustSteel);
    girder.position.set(midX, trackY, vy + dz);
    girder.castShadow = true;
    group.add(girder);
  }
  // Cross-ties along the viaduct.
  const tieCount = Math.floor(spanLen / 1.6);
  const ties = new THREE.InstancedMesh(keep(new THREE.BoxGeometry(0.45, 0.22, 5.4)), plankMat, tieCount);
  for (let i = 0; i < tieCount; i++) {
    dummy.position.set(startX + 2 + i * 1.6, trackY + 0.55, vy);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    ties.setMatrixAt(i, dummy.matrix);
  }
  ties.computeBoundingSphere();
  group.add(ties);
  // Portal steel piers spaced every 22m (placed outside the roadway lanes so hero/enemies run freely underneath!).
  for (let px = startX + 4; px <= endX - 2; px += 22) {
    for (const dz of [-3.6, 3.6]) {
      const col = new THREE.Mesh(keep(new THREE.BoxGeometry(0.65, trackY, 0.65)), rustSteel);
      col.position.set(px, trackY / 2, vy + dz);
      col.castShadow = true;
      group.add(col);
    }
    const beam = new THREE.Mesh(keep(new THREE.BoxGeometry(0.75, 0.75, 8.2)), rustSteel);
    beam.position.set(px, trackY - 0.6, vy);
    group.add(beam);
    lights.push({ pos: new THREE.Vector3(px, trackY - 1.1, vy), color: 0xff9a40, intensity: 24, distance: 18, flicker: px % 44 === 0 ? 2 : 0, seed: px });
  }

  // Twin towering corrugated Ration Silos rising right behind the Ox's Depot Stronghold!
  const siloMat = keep(new THREE.MeshStandardMaterial({ color: 0x6b5b4e, metalness: 0.65, roughness: 0.68 }));
  const domeMat = keep(new THREE.MeshStandardMaterial({ color: 0x4b3d34, metalness: 0.75, roughness: 0.55 }));
  const f = zone.fortress;
  if (f) {
    for (const dz of [-10, 10]) {
      const sx = f.x + f.w + 9;
      const sz = f.y + f.h / 2 + dz;
      const cyl = new THREE.Mesh(keep(new THREE.CylinderGeometry(6.5, 6.8, 28, 20)), siloMat);
      cyl.position.set(sx, 14, sz);
      cyl.castShadow = true;
      const roof = new THREE.Mesh(keep(new THREE.ConeGeometry(7, 5, 20)), domeMat);
      roof.position.set(sx, 30.5, sz);
      group.add(cyl, roof);
    }
  }
}

// ---------- 2. THE CATHEDRAL HEIGHTS (Upper Manhattan · Snow) ----------

function buildSnow(ctx: DistrictContext) {
  const { zone, group, keep, lights, det } = ctx;
  const rnd = mulberry(2029);

  // Riverside Pine Woods: composite snow-dusted evergreen pine trees!
  const treeSpots: [number, number, number][] = [];
  const tryTree = (x: number, z: number, scale: number) => {
    if (x < 4 || x > zone.w - 4 || z < 4 || z > zone.h - 4) return;
    if (zone.fortress && x > zone.fortress.x - 4 && x < zone.fortress.x + zone.fortress.w + 4 && z > zone.fortress.y - 4 && z < zone.fortress.y + zone.fortress.h + 4) return;
    if (zone.buildings.some((b) => x > b.x - 2.6 && x < b.x + b.w + 2.6 && z > b.y - 2.6 && z < b.y + b.h + 2.6)) return;
    for (const k of Object.keys(zone.pois) as (keyof Zone["pois"])[]) {
      const p = zone.pois[k];
      if (Math.hypot(x - p.x, z - p.y) < (k === "fields" ? 5 : 6.5)) return;
    }
    if (treeSpots.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 4.2)) return;
    treeSpots.push([x, z, scale]);
  };
  // Dense pine grove around Riverside Woods (fields).
  for (let i = 0; i < 105; i++) {
    const ang = rnd() * Math.PI * 2;
    const r = 5.5 + rnd() * 24;
    tryTree(zone.pois.fields.x + Math.cos(ang) * r, zone.pois.fields.y + Math.sin(ang) * r, 0.8 + rnd() * 0.75);
  }
  // Scattered winter pines along park borders and Burnt Library.
  const maxTreeX = zone.fortress ? zone.fortress.x - 10 : zone.w - 48;
  for (let i = 0; i < 95; i++) {
    tryTree(6 + rnd() * maxTreeX, 6 + rnd() * (zone.h - 12), 0.75 + rnd() * 0.65);
  }

  if (treeSpots.length) {
    const n = treeSpots.length;
    const trunkGeo = keep(new THREE.CylinderGeometry(0.18, 0.34, 2.4, 7));
    trunkGeo.translate(0, 1.2, 0);
    const tier1Geo = keep(new THREE.ConeGeometry(2.1, 3.2, 8));
    tier1Geo.translate(0, 3.4, 0);
    const tier2Geo = keep(new THREE.ConeGeometry(1.6, 2.8, 8));
    tier2Geo.translate(0, 5.2, 0);
    const tier3Geo = keep(new THREE.ConeGeometry(1.05, 2.3, 8));
    tier3Geo.translate(0, 6.8, 0);
    const snowCapGeo = keep(new THREE.ConeGeometry(1.08, 1.2, 8));
    snowCapGeo.translate(0, 7.45, 0);

    const trunks = new THREE.InstancedMesh(trunkGeo, keep(new THREE.MeshStandardMaterial({ color: 0x3b2a1e, roughness: 0.95 })), n);
    const pineMat = keep(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88 }));
    const t1 = new THREE.InstancedMesh(tier1Geo, pineMat, n);
    const t2 = new THREE.InstancedMesh(tier2Geo, pineMat, n);
    const t3 = new THREE.InstancedMesh(tier3Geo, pineMat, n);
    const cap = new THREE.InstancedMesh(snowCapGeo, keep(new THREE.MeshStandardMaterial({ color: 0xdce8f4, roughness: 0.92 })), n);
    const col = new THREE.Color();

    treeSpots.forEach(([x, z, s], i) => {
      dummy.position.set(x, 0, z);
      dummy.rotation.set(0, rnd() * Math.PI * 2, 0);
      dummy.scale.set(s, s * (0.9 + rnd() * 0.25), s);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      t1.setMatrixAt(i, dummy.matrix);
      t2.setMatrixAt(i, dummy.matrix);
      t3.setMatrixAt(i, dummy.matrix);
      cap.setMatrixAt(i, dummy.matrix);
      col.setHSL(0.4 + (rnd() - 0.5) * 0.05, 0.25 + rnd() * 0.1, 0.18 + rnd() * 0.08);
      t1.setColorAt(i, col);
      t2.setColorAt(i, col);
      t3.setColorAt(i, col);
    });
    for (const m of [trunks, t1, t2, t3, cap]) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.computeBoundingSphere();
      group.add(m);
    }
  }

  // Gothic Stone Archway Colonnade spanning The Thousand Steps!
  const stoneMat = keep(new THREE.MeshStandardMaterial({ color: 0xb2bac2, roughness: 0.86, normalMap: tiled(det.concrete, keep, 2) }));
  const snowTop = keep(new THREE.MeshStandardMaterial({ color: 0xdde8f2, roughness: 0.95 }));
  const rd = zone.pois.road;
  const archStart = zone.pois.village.x + 26;
  const archEnd = zone.fortress ? zone.fortress.x - 10 : zone.w * 0.72;
  const arches = 6;
  for (let i = 0; i < arches; i++) {
    const ax = archStart + (i / (arches - 1)) * Math.max(40, archEnd - archStart);
    const az = rd.y;
    const archGroup = new THREE.Group();
    for (const side of [-4.4, 4.4]) {
      const pier = new THREE.Mesh(keep(new THREE.BoxGeometry(1.1, 7.2, 1.1)), stoneMat);
      pier.position.set(0, 3.6, side);
      pier.castShadow = true;
      const plinth = new THREE.Mesh(keep(new THREE.BoxGeometry(1.5, 0.8, 1.5)), stoneMat);
      plinth.position.set(0, 0.4, side);
      archGroup.add(pier, plinth);
    }
    // Pointed gothic arch lintel spanning overhead (7.2m clearance!).
    for (const side of [-1, 1]) {
      const rib = new THREE.Mesh(keep(new THREE.BoxGeometry(0.95, 0.9, 5.2)), stoneMat);
      rib.position.set(0, 8.2, side * 2.15);
      rib.rotation.x = side * 0.42;
      rib.castShadow = true;
      archGroup.add(rib);
    }
    const crown = new THREE.Mesh(keep(new THREE.BoxGeometry(1.3, 0.5, 1.3)), snowTop);
    crown.position.set(0, 9.45, 0);
    archGroup.add(crown);
    archGroup.position.set(ax, 0, az);
    group.add(archGroup);
    lights.push({ pos: new THREE.Vector3(ax, 6.6, az), color: 0xffb860, intensity: 28, distance: 20, flicker: 1, seed: ax });
  }

  // The Great Cathedral Bell & Gothic Belfry soaring directly behind Abbot Joshin's throne!
  const f = zone.fortress;
  if (f) {
    const bx = f.x + f.w + 9;
    const bz = f.y + f.h / 2;
    const belfry = new THREE.Group();
    // Four soaring stone corner piers.
    for (const [ox, oz] of [[-5.5, -5.5], [5.5, -5.5], [-5.5, 5.5], [5.5, 5.5]]) {
      const col = new THREE.Mesh(keep(new THREE.BoxGeometry(2.4, 34, 2.4)), stoneMat);
      col.position.set(ox, 17, oz);
      col.castShadow = true;
      belfry.add(col);
    }
    // Heavy stone base plinth & upper belfry crown + pointed spire!
    const base = new THREE.Mesh(keep(new THREE.BoxGeometry(14, 12, 14)), stoneMat);
    base.position.y = 6;
    const crownBox = new THREE.Mesh(keep(new THREE.BoxGeometry(14.5, 3, 14.5)), stoneMat);
    crownBox.position.y = 33.5;
    const spire = new THREE.Mesh(keep(new THREE.ConeGeometry(8.5, 22, 4)), keep(new THREE.MeshStandardMaterial({ color: 0x3b4856, metalness: 0.45, roughness: 0.55 })));
    spire.position.y = 46;
    spire.rotation.y = Math.PI / 4;
    belfry.add(base, crownBox, spire);

    // The Great Bronze Bell suspended in the open arch at y = 21m!
    const bellPts = [
      new THREE.Vector2(0.01, 5.2),
      new THREE.Vector2(1.4, 4.9),
      new THREE.Vector2(2.1, 3.4),
      new THREE.Vector2(2.6, 1.4),
      new THREE.Vector2(3.6, 0.2),
      new THREE.Vector2(3.8, 0),
    ];
    const bellGeo = keep(new THREE.LatheGeometry(bellPts, 24));
    const bronzeMat = keep(new THREE.MeshStandardMaterial({ color: 0x9b7236, metalness: 0.88, roughness: 0.32 }));
    const bell = new THREE.Mesh(bellGeo, bronzeMat);
    bell.position.y = 19;
    bell.castShadow = true;
    const yoke = new THREE.Mesh(keep(new THREE.BoxGeometry(11, 1.1, 1.1)), keep(new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 0.9 })));
    yoke.position.y = 24.4;
    belfry.add(bell, yoke);

    belfry.position.set(bx, 0, bz);
    group.add(belfry);
    lights.push({ pos: new THREE.Vector3(bx - 6, 22, bz), color: 0xffc060, intensity: 110, distance: 45, flicker: 0, seed: 88 });
  }
}

// ---------- 3. THE RED HOOK DOCKS (Brooklyn · Tides) ----------

function buildTides(ctx: DistrictContext) {
  const { zone, group, keep, lights, det } = ctx;

  // Expansive deep maritime harbor water basin along the southern waterfront & beyond!
  const seaMat = keep(
    new THREE.MeshPhysicalMaterial({
      color: zone.env.waterColor,
      roughness: 0.06,
      metalness: 0.1,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      normalMap: tiled(det.concrete, keep, 14),
      normalScale: new THREE.Vector2(0.18, 0.18),
      envMapIntensity: 2.2,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  // Shallow harbor cove lapping into The Shallows & Harbor Chain + deep harbor beyond the southern quay.
  const quayY = Math.round(zone.h * 0.675);
  const shallowsW = zone.fortress ? zone.fortress.x - 10 : zone.w * 0.72;
  const shallows = new THREE.Mesh(keep(new THREE.PlaneGeometry(shallowsW, 30)), seaMat);
  shallows.rotation.x = -Math.PI / 2;
  shallows.position.set(shallowsW / 2 + 4, 0.025, zone.h - 18);
  group.add(shallows);

  const deepHarbor = new THREE.Mesh(keep(new THREE.PlaneGeometry(zone.w + 760, 420)), seaMat);
  deepHarbor.rotation.x = -Math.PI / 2;
  deepHarbor.position.set(zone.w / 2, 0.02, zone.h + 210);
  group.add(deepHarbor);

  // Wooden pier pilings & iron mooring bollards along the quay edge and southern pier face.
  const woodMat = keep(new THREE.MeshStandardMaterial({ color: 0x3b2e24, roughness: 0.92 }));
  const ironMat = keep(new THREE.MeshStandardMaterial({ color: 0x262a2e, metalness: 0.85, roughness: 0.45 }));
  const pilingGeo = keep(new THREE.CylinderGeometry(0.28, 0.34, 1.8, 10));
  pilingGeo.translate(0, 0.9, 0);
  const cols = Math.floor((zone.w - 16) / 9.5);
  const pilings = new THREE.InstancedMesh(pilingGeo, woodMat, cols * 2);
  for (let i = 0; i < cols * 2; i++) {
    const x = 8 + (i % cols) * 9.5;
    const z = i < cols ? quayY + 0.5 : zone.h - 3.6;
    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 0.75 + (i % 3) * 0.25, 1);
    dummy.updateMatrix();
    pilings.setMatrixAt(i, dummy.matrix);
  }
  pilings.castShadow = true;
  pilings.computeBoundingSphere();
  group.add(pilings);

  // Harbor Chain Stanchions at pois.water!
  const wPos = zone.pois.water;
  for (const dx of [-8, 8]) {
    const bollard = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.55, 0.7, 2.2, 12)), ironMat);
    bollard.position.set(wPos.x + dx, 1.1, wPos.y);
    bollard.castShadow = true;
    group.add(bollard);
  }
  const chainCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(wPos.x - 8, 1.7, wPos.y),
    new THREE.Vector3(wPos.x, 0.65, wPos.y),
    new THREE.Vector3(wPos.x + 8, 1.7, wPos.y),
  ]);
  const chainMesh = new THREE.Mesh(keep(new THREE.TubeGeometry(chainCurve, 24, 0.12, 8, false)), ironMat);
  group.add(chainMesh);

  // 4 Towering Harbor Gantry Cranes looming over the container yard & pier!
  const cranePaint = keep(new THREE.MeshStandardMaterial({ color: 0x264860, metalness: 0.7, roughness: 0.5 }));
  const craneAccent = keep(new THREE.MeshStandardMaterial({ color: 0xc84824, metalness: 0.6, roughness: 0.5 }));
  const redBeacon = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2020).multiplyScalar(3), toneMapped: false }));
  const cranePositions: [number, number, number][] = [
    [zone.w * 0.23, quayY, 0],
    [zone.w * 0.46, quayY, 0],
    [zone.w * 0.64, zone.h * 0.36, Math.PI / 2],
    [zone.w * 0.28, zone.h * 0.14, Math.PI],
  ];
  for (const [cx, cz, yaw] of cranePositions) {
    const crane = new THREE.Group();
    // 4 tall portal legs (wide straddle so players can pass cleanly underneath!).
    for (const [lx, lz] of [[-5, -4], [5, -4], [-5, 4], [5, 4]]) {
      const leg = new THREE.Mesh(keep(new THREE.BoxGeometry(0.85, 22, 0.85)), cranePaint);
      leg.position.set(lx, 11, lz);
      leg.castShadow = true;
      crane.add(leg);
    }
    // Cross-beams & upper machinery deck.
    const deck = new THREE.Mesh(keep(new THREE.BoxGeometry(11.5, 1.4, 9.5)), cranePaint);
    deck.position.y = 21.5;
    const apex = new THREE.Mesh(keep(new THREE.BoxGeometry(2.2, 10, 2.2)), craneAccent);
    apex.position.y = 27;
    // Long horizontal boom arm jutting out 26m!
    const boom = new THREE.Mesh(keep(new THREE.BoxGeometry(2.6, 1.6, 30)), craneAccent);
    boom.position.set(0, 22.8, 7);
    boom.castShadow = true;
    // Hanging hoist cables & spreader beam.
    for (const sx of [-1.2, 1.2]) {
      const cable = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.06, 0.06, 11, 6)), ironMat);
      cable.position.set(sx, 16.5, 14);
      crane.add(cable);
    }
    const spreader = new THREE.Mesh(keep(new THREE.BoxGeometry(3.4, 0.55, 6.5)), keep(new THREE.MeshStandardMaterial({ color: 0xd4961a, roughness: 0.5, metalness: 0.4 })));
    spreader.position.set(0, 11, 14);
    const lightTip = new THREE.Mesh(keep(new THREE.SphereGeometry(0.35, 8, 6)), redBeacon);
    lightTip.position.set(0, 32.5, 0);
    crane.add(deck, apex, boom, spreader, lightTip);
    crane.position.set(cx, 0, cz);
    crane.rotation.y = yaw;
    group.add(crane);
    lights.push({ pos: new THREE.Vector3(cx, 19, cz), color: 0xffb850, intensity: 90, distance: 38, flicker: 0, seed: cx });
  }

  // THE BLACK FLAGSHIP: colossal black-sailed pirate ship rising directly behind the Storm Deck stronghold!
  const f = zone.fortress;
  if (f) {
    const ship = new THREE.Group();
    const hullMat = keep(new THREE.MeshStandardMaterial({ color: 0x1a1d22, metalness: 0.55, roughness: 0.58 }));
    const deckWood = keep(new THREE.MeshStandardMaterial({ color: 0x3b2c20, roughness: 0.88 }));
    const sailMat = keep(new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.92, side: THREE.DoubleSide }));
    const trimGold = keep(new THREE.MeshStandardMaterial({ color: 0xa47a32, metalness: 0.78, roughness: 0.35 }));

    // Hull body + raked prow!
    const hull = new THREE.Mesh(keep(new THREE.BoxGeometry(14, 9, 44)), hullMat);
    hull.position.y = 4.5;
    hull.castShadow = true;
    const prow = new THREE.Mesh(keep(new THREE.ConeGeometry(7.2, 16, 4)), hullMat);
    prow.rotation.x = Math.PI / 2;
    prow.rotation.y = Math.PI / 4;
    prow.position.set(0, 5.2, -28);
    const stern = new THREE.Mesh(keep(new THREE.BoxGeometry(13.5, 5, 10)), hullMat);
    stern.position.set(0, 11.5, 17);
    const deck = new THREE.Mesh(keep(new THREE.BoxGeometry(13.2, 0.4, 43)), deckWood);
    deck.position.y = 9.1;
    const stripe = new THREE.Mesh(keep(new THREE.BoxGeometry(14.3, 0.55, 44.2)), trimGold);
    stripe.position.y = 7.4;
    ship.add(hull, prow, stern, deck, stripe);

    // Twin soaring masts, yardarms & billowing tattered black sails!
    for (const [mz, mh] of [[-8, 34], [10, 30]] as const) {
      const mast = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.45, 0.65, mh, 10)), deckWood);
      mast.position.set(0, 9 + mh / 2, mz);
      ship.add(mast);
      for (const [yy, yw, sh] of [[mh * 0.45, 16, 8.5], [mh * 0.78, 12, 6.5]] as const) {
        const yard = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.22, 0.22, yw, 8)), deckWood);
        yard.rotation.z = Math.PI / 2;
        yard.position.set(0, 9 + yy, mz);
        const sail = new THREE.Mesh(keep(new THREE.PlaneGeometry(yw * 0.88, sh, 4, 3)), sailMat);
        sail.position.set(0, 9 + yy - sh / 2, mz - 0.6);
        sail.rotation.x = -0.14;
        ship.add(yard, sail);
      }
    }
    // Glowing crimson & emerald stern lanterns!
    const lanternGlow = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff5a20).multiplyScalar(2.6), toneMapped: false }));
    for (const lx of [-4, 0, 4]) {
      const l = new THREE.Mesh(keep(new THREE.SphereGeometry(0.45, 8, 6)), lanternGlow);
      l.position.set(lx, 14.5, 22.3);
      ship.add(l);
    }

    ship.position.set(f.x + f.w + 13, 0, f.y + f.h / 2);
    group.add(ship);
    lights.push({ pos: new THREE.Vector3(f.x + f.w + 5, 14, f.y + f.h / 2), color: 0xff6a28, intensity: 110, distance: 46, flicker: 1, seed: 303 });
  }
}

// ---------- 4. THE NEON QUARTER (Lower East Side · Lanterns) ----------

function buildLanterns(ctx: DistrictContext) {
  const { zone, group, keep, lights } = ctx;

  const lacquerRed = keep(new THREE.MeshStandardMaterial({ color: 0xa41024, roughness: 0.32, metalness: 0.18 }));
  const obsidian = keep(new THREE.MeshStandardMaterial({ color: 0x16141c, roughness: 0.18, metalness: 0.75 }));
  const neonCyan = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(0x00e8ff).multiplyScalar(2.6), toneMapped: false }));
  const neonPink = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff1868).multiplyScalar(2.8), toneMapped: false }));
  const neonGold = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb420).multiplyScalar(2.5), toneMapped: false }));

  // Helper: Monumental Vermilion Neo-Torii Archway spanning wide streets!
  const addTorii = (x: number, z: number, yaw: number, span = 10, height = 10.5) => {
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
      const base = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.65, 0.8, 1.4, 10)), obsidian);
      base.position.set(s * (span / 2), 0.7, 0);
      const col = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.42, 0.52, height, 12)), lacquerRed);
      col.position.set(s * (span / 2), height / 2 + 0.5, 0);
      col.castShadow = true;
      g.add(base, col);
    }
    const lowerBeam = new THREE.Mesh(keep(new THREE.BoxGeometry(span + 2.6, 0.65, 0.7)), lacquerRed);
    lowerBeam.position.y = height - 1.4;
    const upperBeam = new THREE.Mesh(keep(new THREE.BoxGeometry(span + 4.4, 0.85, 1.15)), obsidian);
    upperBeam.position.y = height + 0.3;
    const neonStrip = new THREE.Mesh(keep(new THREE.BoxGeometry(span + 3.8, 0.18, 1.28)), neonPink);
    neonStrip.position.y = height + 0.25;
    const plaque = new THREE.Mesh(keep(new THREE.BoxGeometry(1.4, 1.8, 0.35)), neonGold);
    plaque.position.set(0, height - 0.5, 0);
    g.add(lowerBeam, upperBeam, neonStrip, plaque);
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    group.add(g);
    lights.push({ pos: new THREE.Vector3(x, height - 1, z), color: 0xff2870, intensity: 65, distance: 30, flicker: 0, seed: x + z });
  };

  // The Neon Gate (road) & Theatre Approach!
  addTorii(zone.pois.road.x, zone.pois.road.y, Math.PI / 2, 11, 11);
  if (zone.fortress) {
    addTorii(zone.fortress.x - 4.5, zone.fortress.y + zone.fortress.h / 2, Math.PI / 2, 11.5, 12);
  }

  // Festival Square Tiered Neon Pagoda Pavilion (centerpiece of pois.water)!
  const sq = zone.pois.water;
  const pag = new THREE.Group();
  const tiers: [number, number, number, THREE.Material][] = [
    [0, 5.2, 3.6, neonCyan],
    [3.8, 4.1, 3.2, neonPink],
    [7.2, 3.0, 2.8, neonGold],
  ];
  // Open pedestal base with 4 corner pillars so it feels monumental yet airy.
  for (const [ox, oz] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]]) {
    const p = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.24, 0.28, 3.6, 10)), lacquerRed);
    p.position.set(ox, 1.8, oz);
    p.castShadow = true;
    pag.add(p);
  }
  const coreLight = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.65, 0.65, 9.5, 12)), neonGold);
  coreLight.position.y = 5.4;
  pag.add(coreLight);
  for (const [y0, r, h, glow] of tiers) {
    const eave = new THREE.Mesh(keep(new THREE.ConeGeometry(r, 1.35, 8)), obsidian);
    eave.position.y = y0 + h;
    eave.castShadow = true;
    const trim = new THREE.Mesh(keep(new THREE.TorusGeometry(r * 0.92, 0.08, 8, 8)), glow);
    trim.rotation.x = Math.PI / 2;
    trim.rotation.z = Math.PI / 8;
    trim.position.y = y0 + h - 0.55;
    pag.add(eave, trim);
  }
  const finial = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.08, 0.22, 3.8, 8)), neonCyan);
  finial.position.y = 12.6;
  pag.add(finial);
  pag.position.set(sq.x, 0, sq.y);
  group.add(pag);
  lights.push({ pos: new THREE.Vector3(sq.x, 6, sq.y), color: 0x00e0ff, intensity: 85, distance: 36, flicker: 0, seed: 404 });

  // Hall of Mirrors: gleaming mirrored obsidian-and-chrome monoliths lining the Theatre Stronghold!
  const hall = zone.hall;
  if (hall) {
    const mirrorMat = keep(new THREE.MeshPhysicalMaterial({ color: 0xd0e4ff, metalness: 0.96, roughness: 0.04, clearcoat: 1, envMapIntensity: 2.5 }));
    const midZ = hall.y + hall.h / 2;
    for (let i = 0; i < 3; i++) {
      const mx = hall.x + 5.5 + i * 7.5;
      for (const mz of [hall.y + 3.2, hall.y + hall.h - 3.2]) {
        const frame = new THREE.Mesh(keep(new THREE.BoxGeometry(1.6, 7.5, 0.45)), lacquerRed);
        frame.position.set(mx, 3.75, mz);
        const glass = new THREE.Mesh(keep(new THREE.BoxGeometry(1.3, 6.8, 0.52)), mirrorMat);
        glass.position.set(mx, 3.75, mz);
        group.add(frame, glass);
      }
    }
    // Glowing golden stage arch behind Yashiro's Great Stage!
    const stageArch = new THREE.Mesh(keep(new THREE.TorusGeometry(6.2, 0.25, 10, 24, Math.PI)), neonGold);
    stageArch.rotation.y = Math.PI / 2;
    stageArch.position.set(hall.x + hall.w - 2.2, 0.5, midZ);
    group.add(stageArch);
  }
}

// ---------- 5. THE ASH WARD (Lower Manhattan · Ash) ----------

function buildAsh(ctx: DistrictContext) {
  const { zone, group, keep, lights, emitters } = ctx;
  const rnd = mulberry(5051);

  // The River of Embers: glowing molten chasm trench at pois.water!
  const rv = zone.pois.water;
  const magmaMat = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff4c12).multiplyScalar(2.4), toneMapped: false }));
  const basaltMat = keep(new THREE.MeshStandardMaterial({ color: 0x201c1a, roughness: 0.92, flatShading: true }));
  const riverPlane = new THREE.Mesh(keep(new THREE.PlaneGeometry(24, 5.2)), magmaMat);
  riverPlane.rotation.x = -Math.PI / 2;
  riverPlane.rotation.z = 0.22;
  riverPlane.position.set(rv.x, 0.04, rv.y);
  group.add(riverPlane);
  for (let i = -3; i <= 3; i++) {
    const ex = rv.x + i * 3.2;
    const ez = rv.y - i * 0.7;
    emitters.push({ pos: new THREE.Vector3(ex, 0.3, ez), kind: "fire" });
    if (i % 2 === 0) lights.push({ pos: new THREE.Vector3(ex, 1.8, ez), color: 0xff4810, intensity: 46, distance: 20, flicker: 1, seed: i * 19 + 5 });
    // Charred basalt bank rocks flanking the fissure.
    for (const side of [-3.4, 3.4]) {
      const rock = new THREE.Mesh(keep(new THREE.DodecahedronGeometry(0.9 + rnd() * 0.8, 0)), basaltMat);
      rock.position.set(ex + (rnd() - 0.5) * 1.4, 0.35, ez + side + (rnd() - 0.5) * 1.2);
      rock.scale.set(1.4, 0.55, 1.1);
      rock.castShadow = true;
      group.add(rock);
    }
  }

  // The Camellia Roof Garden (pois.fields) & Hideout Camellia Trees: dark gnarled trunks crowned with vivid crimson blossoms!
  const barkMat = keep(new THREE.MeshStandardMaterial({ color: 0x221b18, roughness: 0.95 }));
  const blossomMat = keep(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72, emissive: new THREE.Color(0x3a0608) }));
  const treeSpots: [number, number, number][] = [
    [zone.pois.village.x - 5.5, zone.pois.village.y - 4.5, 1.05],
    [zone.pois.village.x + 6.5, zone.pois.village.y - 4.8, 0.95],
  ];
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * Math.PI * 2 + rnd() * 0.3;
    const r = 6.2 + rnd() * 7.5;
    treeSpots.push([zone.pois.fields.x + Math.cos(ang) * r, zone.pois.fields.y + Math.sin(ang) * r, 0.85 + rnd() * 0.55]);
  }
  const clusterGeo = keep(new THREE.IcosahedronGeometry(1.15, 1));
  const blossoms = new THREE.InstancedMesh(clusterGeo, blossomMat, treeSpots.length * 4);
  const col = new THREE.Color();
  let bi = 0;
  for (const [tx, tz, s] of treeSpots) {
    const trunk = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.16 * s, 0.32 * s, 3.2 * s, 7)), barkMat);
    trunk.position.set(tx, 1.6 * s, tz);
    trunk.rotation.z = (rnd() - 0.5) * 0.25;
    trunk.castShadow = true;
    group.add(trunk);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + rnd() * 0.6;
      const rad = k === 0 ? 0.2 : 1.15 * s;
      dummy.position.set(tx + Math.cos(a) * rad, (3.2 + (k === 0 ? 0.65 : 0.1)) * s, tz + Math.sin(a) * rad);
      dummy.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
      dummy.scale.set(s * (0.9 + rnd() * 0.4), s * 0.65, s * (0.9 + rnd() * 0.4));
      dummy.updateMatrix();
      blossoms.setMatrixAt(bi, dummy.matrix);
      col.setHSL(0.98 + (rnd() - 0.5) * 0.03, 0.78, 0.28 + rnd() * 0.14);
      blossoms.setColorAt(bi, col);
      bi++;
    }
  }
  blossoms.castShadow = true;
  blossoms.computeBoundingSphere();
  group.add(blossoms);

  // The Old Dojo Ruins (pois.ruin): scorched wooden pillars & broken vermilion shrine gate.
  const ruin = zone.pois.ruin;
  const burntWood = keep(new THREE.MeshStandardMaterial({ color: 0x261a14, roughness: 0.94 }));
  for (const [dx, dz, h] of [[-5, -5, 4.5], [5, -5, 3.2], [-5, 5, 2.4], [5, 5, 5.1]] as const) {
    const p = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.26, 0.3, h, 8)), burntWood);
    p.position.set(ruin.x + dx, h / 2, ruin.y + dz);
    p.rotation.z = (rnd() - 0.5) * 0.18;
    p.castShadow = true;
    group.add(p);
  }

  // THE COLOSSAL LANTERN TOWER: rising 140m directly behind Master Genryu's Lord's Seat!
  const f = zone.fortress;
  if (f) {
    const tx = f.x + f.w + 15;
    const tz = f.y + f.h / 2;
    const tower = new THREE.Group();
    const obs = keep(new THREE.MeshStandardMaterial({ color: 0x1e1a18, metalness: 0.65, roughness: 0.42 }));
    const goldSteel = keep(new THREE.MeshStandardMaterial({ color: 0x9c6828, metalness: 0.85, roughness: 0.35 }));
    const beaconRed = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3814).multiplyScalar(3.4), toneMapped: false }));

    const tiers: [number, number, number][] = [
      [0, 24, 34],
      [34, 18, 36],
      [70, 13, 32],
      [102, 8.5, 22],
    ];
    for (const [y0, w, h] of tiers) {
      const m = new THREE.Mesh(keep(new THREE.BoxGeometry(w, h, w)), obs);
      m.position.y = y0 + h / 2;
      m.castShadow = true;
      const ledge = new THREE.Mesh(keep(new THREE.BoxGeometry(w + 1.4, 0.9, w + 1.4)), goldSteel);
      ledge.position.y = y0 + h;
      tower.add(m, ledge);
    }
    // Blazing crimson vertical light ribs on all 4 sides of the tower!
    for (const side of [0, 1, 2, 3]) {
      const slit = new THREE.Mesh(keep(new THREE.BoxGeometry(0.85, 118, 0.3)), beaconRed);
      const ang = (side * Math.PI) / 2;
      slit.position.set(Math.sin(ang) * 9.3, 60, Math.cos(ang) * 9.3);
      slit.rotation.y = ang;
      tower.add(slit);
    }
    // Giant blazing Lantern Crown at the summit!
    const lanternCore = new THREE.Mesh(keep(new THREE.CylinderGeometry(3.6, 3.6, 12, 8)), beaconRed);
    lanternCore.position.y = 130;
    const lanternCap = new THREE.Mesh(keep(new THREE.ConeGeometry(7.2, 6, 8)), obs);
    lanternCap.position.y = 139;
    const spire = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.18, 0.65, 22, 6)), goldSteel);
    spire.position.y = 152;
    tower.add(lanternCore, lanternCap, spire);

    tower.position.set(tx, 0, tz);
    group.add(tower);
    lights.push({ pos: new THREE.Vector3(tx - 10, 28, tz), color: 0xff4018, intensity: 140, distance: 60, flicker: 1, seed: 505 });
  }
}

// ---------- Per-District Far Skylines ----------

function buildDistrictSkyline(ctx: DistrictContext, nation: Zone["nation"]) {
  const { zone, group, keep } = ctx;
  if (zone.id === "memory") {
    farSkyline(zone, group, keep);
    return;
  }

  const rnd = mulberry(zone.w * 5 + nation.charCodeAt(0) * 131 + nation.length * 37);
  const tex = keep(skylineTexture(zone.env.fog));
  const body = keep(new THREE.MeshBasicMaterial({ map: tex, fog: false }));
  const dark = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(zone.env.fog).multiplyScalar(0.45), fog: false }));
  const accent = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(zone.env.neon[0] ?? 0xff5a1f).multiplyScalar(1.3), fog: false, toneMapped: false }));
  const accent2 = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(zone.env.neon[1] ?? 0xffb860).multiplyScalar(1.2), fog: false, toneMapped: false }));

  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(keep(geo), mat);
    m.position.set(x, y, z);
    group.add(m);
    return m;
  };

  const cx = zone.w / 2;
  const cz = zone.h / 2;

  // Height & density profiles differ drastically by district!
  const count = nation === "lanterns" ? 96 : nation === "reeds" ? 56 : nation === "tides" ? 48 : nation === "snow" ? 60 : 76;
  const maxH = nation === "lanterns" ? 250 : nation === "ash" ? 215 : nation === "reeds" ? 120 : nation === "tides" ? 98 : 135;

  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rnd() * 0.08;
    // Leave southern sea horizon open in Red Hook Docks (keep far harbor flanks framed).
    if (nation === "tides" && Math.sin(a) > 0.38) continue;
    const rx = zone.w / 2 + 175 + rnd() * 175;
    const rz = zone.h / 2 + 175 + rnd() * 175;
    const x = cx + Math.cos(a) * rx;
    const z = cz + Math.sin(a) * rz;
    const w = 16 + rnd() * 26;
    const h = 34 + rnd() * rnd() * maxH;
    add(facadeBox(w, h, w, i * 17), body, x, h / 2, z);
    if (nation === "lanterns" && h > 90) {
      add(new THREE.BoxGeometry(w + 1, 2.4, w + 1), i % 2 === 0 ? accent : accent2, x, h - 3, z);
    } else if (nation === "snow" && h > 58) {
      // Gothic pointed roofs on far skyline towers!
      const roof = add(new THREE.ConeGeometry(w * 0.72, 24, 4), dark, x, h + 12, z);
      roof.rotation.y = Math.PI / 4;
    } else if (nation === "ash" && h > 75 && rnd() < 0.45) {
      // Glowing fire-lit top on ruined financial skyline!
      add(new THREE.BoxGeometry(w * 0.85, 3.2, w * 0.85), accent, x, h - 2, z);
    }
  }

  // Signature horizon landmark per district!
  if (nation === "reeds" || nation === "tides" || nation === "snow") {
    // Suspension / Cantilever Bridge spanning the misty horizon!
    const bz = nation === "tides" ? zone.h + 215 : -215;
    const deckY = 38;
    add(new THREE.BoxGeometry(420, 3.4, 7), dark, cx, deckY, bz);
    for (const bx of [cx - 110, cx + 110]) {
      for (const dz of [-4.5, 4.5]) add(new THREE.BoxGeometry(5.5, 102, 5.5), dark, bx, 51, bz + dz);
      add(new THREE.BoxGeometry(5.5, 4.5, 16), dark, bx, 96, bz);
      add(new THREE.BoxGeometry(5.5, 4.5, 16), dark, bx, 62, bz);
      add(new THREE.SphereGeometry(1.6, 8, 6), accent, bx, 104, bz);
    }
    // Bridge suspension catenary cable.
    const cPts = [
      new THREE.Vector3(cx - 210, deckY + 2, bz),
      new THREE.Vector3(cx - 110, 98, bz),
      new THREE.Vector3(cx, deckY + 6, bz),
      new THREE.Vector3(cx + 110, 98, bz),
      new THREE.Vector3(cx + 210, deckY + 2, bz),
    ];
    const cable = new THREE.Mesh(keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cPts), 48, 0.7, 6, false)), dark);
    group.add(cable);
    if (nation === "tides") {
      // Distant Harbor Lighthouse across the dark sea!
      const lx = cx - 170;
      const lz = zone.h + 245;
      add(new THREE.CylinderGeometry(2.8, 5.6, 50, 12), dark, lx, 25, lz);
      add(new THREE.SphereGeometry(3.4, 12, 8), accent2, lx, 52, lz);
    }
  } else if (nation === "lanterns") {
    // Blazing megatowers flanking the Neon Quarter horizon!
    for (const [mx, mz, mh, mat] of [
      [cx + 55, -215, 275, accent],
      [cx - 80, -225, 240, accent2],
      [zone.w + 215, cz - 25, 260, accent],
    ] as const) {
      add(facadeBox(38, mh, 38, Math.abs(mx)), body, mx, mh / 2, mz);
      add(new THREE.BoxGeometry(40, 5, 40), mat, mx, mh - 8, mz);
      add(new THREE.BoxGeometry(26, 3.8, 26), mat, mx, mh - 26, mz);
      add(new THREE.CylinderGeometry(0.4, 1.5, 48, 6), dark, mx, mh + 24, mz);
      add(new THREE.SphereGeometry(1.8, 8, 6), mat, mx, mh + 49, mz);
    }
  } else if (nation === "ash") {
    // Twin shattered monolith silhouettes & glowing horizon smoke stacks.
    for (const [mx, mz, mh] of [[cx - 60, -215, 230], [cx + 65, -225, 205]] as const) {
      add(facadeBox(38, mh, 38, Math.abs(mx)), body, mx, mh / 2, mz);
      add(new THREE.BoxGeometry(40, 3.4, 40), accent, mx, mh - 3, mz);
    }
  }
}
