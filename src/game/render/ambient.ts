import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Game } from "../engine/game";
import type { Vec } from "../engine/state";
import type { Ground } from "./crowd";
import { softDot } from "./textures";

// Moving life above and around the streets: pigeons that scatter from the hero, streams of air
// traffic between the towers, police drones sweeping searchlights over the blocks, and litter
// tumbling along in the wind.

const TAU = Math.PI * 2;
const dummy = new THREE.Object3D();
dummy.rotation.order = "YZX";
const _from = new THREE.Vector3();
const _to = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _down = new THREE.Vector3(0, -1, 0);

// ---------- Pigeons ----------

interface Bird {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  hop: number;
}

interface Flock {
  birds: Bird[];
  flying: boolean;
  t: number;
}

const MAX_BIRDS = 32;

class Pigeons {
  readonly group = new THREE.Group();
  private body: THREE.InstancedMesh;
  private wingL: THREE.InstancedMesh;
  private wingR: THREE.InstancedMesh;
  private flocks: Flock[] = [];
  private spawnT = 1;

  constructor(
    private ground: Ground,
    private maxFlocks: number,
    bodyColor = 0x55585f,
    wingColor = 0x45474d,
  ) {
    const torso = new THREE.SphereGeometry(0.08, 10, 8);
    torso.scale(0.85, 0.8, 1.5);
    const head = new THREE.SphereGeometry(0.045, 8, 6);
    head.translate(0, 0.07, 0.12);
    const bodyGeo = mergeGeometries([torso, head]);
    if (bodyGeo) {
      torso.dispose();
      head.dispose();
    } else {
      head.dispose();
    }
    const mat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.75 });
    const wing = (side: number) => {
      const g = new THREE.PlaneGeometry(0.24, 0.1);
      g.rotateX(-Math.PI / 2);
      g.translate(side * 0.12, 0.02, -0.02);
      return g;
    };
    const wingMat = new THREE.MeshStandardMaterial({ color: wingColor, roughness: 0.8, side: THREE.DoubleSide });
    this.body = new THREE.InstancedMesh(bodyGeo ?? torso, mat, MAX_BIRDS);
    this.wingL = new THREE.InstancedMesh(wing(1), wingMat, MAX_BIRDS);
    this.wingR = new THREE.InstancedMesh(wing(-1), wingMat, MAX_BIRDS);
    for (const m of [this.body, this.wingL, this.wingR]) {
      m.count = 0;
      m.frustumCulled = false;
      m.castShadow = true;
      this.group.add(m);
    }
  }

  update(dt: number, game: Game, time: number, danger: boolean) {
    const hero = game.player;
    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.flocks.length < this.maxFlocks) {
      this.spawnT = 5 + Math.random() * 8;
      const at = this.ground.spot(hero, 14, 32, 1);
      if (at) {
        const n = 5 + Math.floor(Math.random() * 5);
        const birds: Bird[] = [];
        for (let i = 0; i < n; i++) {
          const x = at.x + (Math.random() - 0.5) * 3;
          const y = at.y + (Math.random() - 0.5) * 3;
          if (this.ground.free(x, y, 0.2)) birds.push({ x, y, z: 0, vx: 0, vy: 0, vz: 0, yaw: Math.random() * TAU, hop: Math.random() * 5 });
        }
        if (birds.length) this.flocks.push({ birds, flying: false, t: 0 });
      }
    }

    let n = 0;
    for (let fi = this.flocks.length - 1; fi >= 0; fi--) {
      const f = this.flocks[fi];
      f.t += dt;
      const c = f.birds[0];
      const d = Math.hypot(c.x - hero.x, c.y - hero.y);
      if (!f.flying && (d < 6.5 || (d < 11 && hero.speed > 5) || (danger && d < 16))) {
        // Startled: burst up and away from the hero.
        f.flying = true;
        f.t = 0;
        for (const b of f.birds) {
          const a = Math.atan2(b.y - hero.y, b.x - hero.x) + (Math.random() - 0.5) * 1.2;
          const sp = 4 + Math.random() * 3;
          b.vx = Math.cos(a) * sp;
          b.vy = Math.sin(a) * sp;
          b.vz = 3.5 + Math.random() * 2.5;
        }
      }
      if ((f.flying && f.t > 7) || d > 60) {
        this.flocks.splice(fi, 1);
        continue;
      }
      for (let i = 0; i < f.birds.length && n < MAX_BIRDS; i++) {
        const b = f.birds[i];
        let flap = 0.15;
        let wingScale = 0.55;
        let bob = 0;
        if (f.flying) {
          b.vz += dt * 1.2;
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.z += b.vz * dt;
          b.yaw = Math.atan2(b.vx, b.vy);
          flap = Math.sin(time * 32 + i * 1.7) * 0.9;
          wingScale = 1;
        } else {
          // Pecking and the odd hop.
          b.hop -= dt;
          if (b.hop < 0) {
            b.hop = 1.5 + Math.random() * 4;
            const a = Math.random() * TAU;
            const nx = b.x + Math.cos(a) * 0.3;
            const ny = b.y + Math.sin(a) * 0.3;
            if (this.ground.free(nx, ny, 0.2)) {
              b.x = nx;
              b.y = ny;
            }
            b.yaw = Math.random() * TAU;
          }
          bob = Math.max(0, Math.sin(time * 9 + i * 2.3)) * 0.35;
        }
        dummy.position.set(b.x, b.z + 0.1, b.y);
        dummy.rotation.set(bob, b.yaw, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        this.body.setMatrixAt(n, dummy.matrix);
        dummy.scale.set(wingScale, 1, 1);
        dummy.rotation.set(0, b.yaw, flap);
        dummy.updateMatrix();
        this.wingL.setMatrixAt(n, dummy.matrix);
        dummy.rotation.set(0, b.yaw, -flap);
        dummy.updateMatrix();
        this.wingR.setMatrixAt(n, dummy.matrix);
        n++;
      }
    }
    const hadBirds = this.body.count > 0;
    for (const m of [this.body, this.wingL, this.wingR]) {
      m.count = n;
      if (n > 0 || hadBirds) m.instanceMatrix.needsUpdate = true;
    }
  }

  dispose() {
    for (const m of [this.body, this.wingL, this.wingR]) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
      m.dispose();
    }
  }
}

// ---------- Air traffic ----------

interface Lane {
  ox: number;
  oz: number;
  dx: number;
  dz: number;
  alt: number;
  speed: number;
  offset: number;
}

const PER_LANE = 14;
const LANE_LEN = 700;

class AirTraffic {
  readonly points: THREE.Points;
  private lanes: Lane[] = [];
  private pos: Float32Array;

  constructor(cx: number, cz: number, count: number, palette: [number, number] = [0xfff1dc, 0xff3a30]) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI + Math.random() * 0.3;
      const dir = i % 2 ? 1 : -1;
      this.lanes.push({
        ox: cx + (Math.random() - 0.5) * 120,
        oz: cz + (Math.random() - 0.5) * 120,
        dx: Math.cos(a) * dir,
        dz: Math.sin(a) * dir,
        alt: 55 + Math.random() * 60,
        speed: 22 + Math.random() * 20,
        offset: Math.random() * LANE_LEN,
      });
    }
    const n = count * PER_LANE * 2;
    this.pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const lane = Math.floor(i / (PER_LANE * 2));
      c.set(lane % 2 ? palette[0] : palette[1]).multiplyScalar(2);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    this.points = new THREE.Points(
      g,
      new THREE.PointsMaterial({ size: 1.6, map: softDot(), vertexColors: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }),
    );
    this.points.frustumCulled = false;
  }

  update(time: number) {
    let i = 0;
    for (const l of this.lanes) {
      for (let k = 0; k < PER_LANE; k++) {
        const u = (((k / PER_LANE) * LANE_LEN + l.offset + time * l.speed + k * 13) % LANE_LEN) - LANE_LEN / 2;
        const x = l.ox + l.dx * u;
        const z = l.oz + l.dz * u;
        const y = l.alt + Math.sin(k * 3.1) * 3;
        // Two lights per craft, side by side.
        const k0 = i * 3;
        this.pos[k0] = x - l.dz * 0.9;
        this.pos[k0 + 1] = y;
        this.pos[k0 + 2] = z + l.dx * 0.9;
        this.pos[k0 + 3] = x + l.dz * 0.9;
        this.pos[k0 + 4] = y;
        this.pos[k0 + 5] = z - l.dx * 0.9;
        i += 2;
      }
    }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose() {
    this.points.geometry.dispose();
    const m = this.points.material as THREE.PointsMaterial;
    m.map?.dispose();
    m.dispose();
  }
}

// ---------- Police drones ----------

function beamFade() {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 128;
  const ctx = c.getContext("2d");
  if (ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(1, "#202020");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 128);
  }
  return new THREE.CanvasTexture(c);
}

class Drone {
  readonly group = new THREE.Group();
  private craft = new THREE.Group();
  private beam: THREE.Mesh;
  private pool: THREE.Mesh;
  private red: THREE.Mesh;
  private blue: THREE.Mesh;
  private spot: THREE.SpotLight | null;
  private center = new THREE.Vector2();
  private started = false;
  private disposables: { dispose: () => void }[] = [];

  constructor(
    private phase: number,
    withLight: boolean,
    fade: THREE.Texture,
    dot: THREE.Texture,
    beamColor = 0xc8dcff,
  ) {
    const keep = <T extends { dispose: () => void }>(x: T) => {
      this.disposables.push(x);
      return x;
    };
    const hull = keep(new THREE.MeshStandardMaterial({ color: 0x2a2c30, metalness: 0.8, roughness: 0.4 }));
    const body = new THREE.Mesh(keep(new THREE.BoxGeometry(1.4, 0.35, 2.2)), hull);
    const nose = new THREE.Mesh(keep(new THREE.SphereGeometry(0.4, 12, 8)), hull);
    nose.scale.set(1.4, 0.6, 1);
    nose.position.z = 1.1;
    this.craft.add(body, nose);
    const rotorGeo = keep(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 16));
    for (const [x, z] of [[1.2, 1], [-1.2, 1], [1.2, -1], [-1.2, -1]]) {
      const r = new THREE.Mesh(rotorGeo, hull);
      r.position.set(x, 0.1, z);
      this.craft.add(r);
    }
    const lamp = (color: number) => new THREE.Mesh(keep(new THREE.SphereGeometry(0.12, 8, 6)), keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(4), toneMapped: false })));
    this.red = lamp(0xff1020);
    this.red.position.set(-0.75, 0, 0);
    this.blue = lamp(0x2050ff);
    this.blue.position.set(0.75, 0, 0);
    this.craft.add(this.red, this.blue);
    const beamGeo = keep(new THREE.ConeGeometry(1, 1, 24, 1, true));
    beamGeo.translate(0, -0.5, 0);
    this.beam = new THREE.Mesh(
      beamGeo,
      keep(new THREE.MeshBasicMaterial({ color: beamColor, alphaMap: fade, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })),
    );
    const poolGeo = keep(new THREE.PlaneGeometry(1, 1));
    poolGeo.rotateX(-Math.PI / 2);
    this.pool = new THREE.Mesh(poolGeo, keep(new THREE.MeshBasicMaterial({ color: beamColor, map: dot, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })));
    this.group.add(this.craft, this.beam, this.pool);
    this.spot = null;
    if (withLight) {
      this.spot = new THREE.SpotLight(beamColor, 160, 70, 0.17, 0.55, 1);
      this.group.add(this.spot, this.spot.target);
    }
  }

  update(time: number, dt: number, hero: Vec) {
    if (!this.started) {
      this.center.set(hero.x, hero.y);
      this.started = true;
    }
    // Patrol lazily around wherever the hero is, sweeping the street with the light.
    this.center.x += (hero.x - this.center.x) * Math.min(1, dt * 0.12);
    this.center.y += (hero.y - this.center.y) * Math.min(1, dt * 0.12);
    const t = time * 0.12 + this.phase;
    const x = this.center.x + Math.cos(t) * 24;
    const z = this.center.y + Math.sin(t * 1.3) * 20;
    const y = 22 + Math.sin(time * 0.7 + this.phase) * 1.2;
    this.craft.position.set(x, y, z);
    this.craft.rotation.set(0.08, Math.atan2(-Math.sin(t) * 24, Math.cos(t * 1.3) * 26), Math.sin(time * 0.9) * 0.05);
    const tx = this.center.x + Math.cos(time * 0.5 + this.phase * 2) * 10;
    const tz = this.center.y + Math.sin(time * 0.37 + this.phase) * 10;
    _from.set(x, y - 0.3, z);
    _to.set(tx, 0, tz);
    _dir.copy(_to).sub(_from);
    const len = _dir.length();
    this.beam.position.copy(_from);
    this.beam.quaternion.setFromUnitVectors(_down, _dir.normalize());
    this.beam.scale.set(3.6, len, 3.6);
    this.pool.position.set(tx, 0.06, tz);
    this.pool.scale.setScalar(9);
    const blink = Math.floor(time * 3 + this.phase) % 2 === 0;
    this.red.visible = blink;
    this.blue.visible = !blink;
    if (this.spot) {
      this.spot.position.copy(_from);
      this.spot.target.position.copy(_to);
    }
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.spot?.dispose();
  }
}

// ---------- Litter ----------

interface Paper {
  x: number;
  y: number;
  h: number;
  vx: number;
  vy: number;
  spin: number;
  tumble: number;
  seed: number;
}

class Litter {
  readonly mesh: THREE.InstancedMesh;
  private papers: Paper[] = [];
  private wind: number;

  constructor(
    private ground: Ground,
    count: number,
    color = 0xb4ae9e,
  ) {
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.34, 0.26), new THREE.MeshStandardMaterial({ color, roughness: 1, side: THREE.DoubleSide }), count);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    this.wind = Math.random() * TAU;
    for (let i = 0; i < count; i++) this.papers.push({ x: 0, y: 0, h: 0, vx: 0, vy: 0, spin: 0, tumble: 0, seed: Math.random() * 100 });
    this.mesh.count = 0;
  }

  update(dt: number, time: number, hero: Vec) {
    const gust = 0.5 + Math.max(0, Math.sin(time * 0.6)) * 1.2 + Math.max(0, Math.sin(time * 1.7 + 1)) * 0.5;
    const wx = Math.cos(this.wind + Math.sin(time * 0.1) * 0.5);
    const wy = Math.sin(this.wind + Math.sin(time * 0.1) * 0.5);
    this.papers.forEach((p, i) => {
      if (p.x === 0 || Math.hypot(p.x - hero.x, p.y - hero.y) > 32) {
        const at = this.ground.spot(hero, 5, 28, 0.4);
        if (!at) return;
        p.x = at.x;
        p.y = at.y;
        p.h = 0;
      }
      const k = 0.6 + Math.sin(p.seed + time * 0.8) * 0.4;
      p.vx += (wx * gust * 1.8 * k - p.vx) * Math.min(1, dt * 2);
      p.vy += (wy * gust * 1.8 * k - p.vy) * Math.min(1, dt * 2);
      const nx = p.x + p.vx * dt;
      const ny = p.y + p.vy * dt;
      if (this.ground.free(nx, ny, 0.1)) {
        p.x = nx;
        p.y = ny;
      } else {
        p.vx *= -0.3;
        p.vy *= -0.3;
      }
      const lift = Math.max(0, gust - 0.9) * k;
      p.h = Math.max(0.01, Math.abs(Math.sin(time * 3 + p.seed)) * 0.45 * lift);
      p.spin += dt * gust * 2 * k;
      p.tumble += dt * gust * 5 * k;
      dummy.position.set(p.x, p.h + 0.01, p.y);
      dummy.rotation.set(p.h > 0.05 ? p.tumble : -Math.PI / 2, p.spin, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    });
    this.mesh.count = this.papers.length;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.dispose();
  }
}

// ---------- All together ----------

export class Ambient {
  readonly group = new THREE.Group();
  private pigeons: Pigeons;
  private traffic: AirTraffic;
  private drones: Drone[] = [];
  private litter: Litter;
  private fade = beamFade();
  private dot = softDot();

  constructor(ground: Ground, lowPower: boolean) {
    const z = ground.zone;
    const nation = z.id === "memory" ? "ash" : z.nation;
    const cfg: Record<
      typeof z.nation,
      {
        birdBody: number;
        birdWing: number;
        lanes: number;
        laneCols: [number, number];
        drones: number;
        beam: number;
        litterCol: number;
      }
    > = {
      reeds: { birdBody: 0x30383a, birdWing: 0x22282a, lanes: lowPower ? 2 : 4, laneCols: [0xffe0b0, 0xff5a28], drones: lowPower ? 1 : 2, beam: 0xc8e4dc, litterCol: 0x9c9884 },
      snow: { birdBody: 0x262c34, birdWing: 0x1a2028, lanes: 2, laneCols: [0xd8e8ff, 0xff4048], drones: lowPower ? 0 : 1, beam: 0xd8ecff, litterCol: 0xd8e4f0 },
      tides: { birdBody: 0xc2ccd4, birdWing: 0x8e9aa6, lanes: lowPower ? 2 : 4, laneCols: [0xffe4b8, 0x38e0c8], drones: lowPower ? 0 : 1, beam: 0xbee8f0, litterCol: 0xb0aa98 },
      lanterns: { birdBody: 0x525662, birdWing: 0x424652, lanes: lowPower ? 6 : 12, laneCols: [0x38f0ff, 0xff2898], drones: lowPower ? 1 : 2, beam: 0xd0e8ff, litterCol: 0xb4ae9e },
      ash: { birdBody: 0x282220, birdWing: 0x1a1614, lanes: 2, laneCols: [0xff9a50, 0xff2a18], drones: lowPower ? 1 : 2, beam: 0xffd0b0, litterCol: 0x3a2c28 },
    };
    const c = cfg[nation];
    this.pigeons = new Pigeons(ground, lowPower ? 1 : 3, c.birdBody, c.birdWing);
    this.traffic = new AirTraffic(z.w / 2, z.h / 2, c.lanes, c.laneCols);
    this.litter = new Litter(ground, lowPower ? 8 : 20, c.litterCol);
    for (let i = 0; i < c.drones; i++) this.drones.push(new Drone(i * 2.7, !lowPower, this.fade, this.dot, c.beam));
    this.group.add(this.pigeons.group, this.traffic.points, this.litter.mesh, ...this.drones.map((d) => d.group));
  }

  update(dt: number, game: Game, time: number) {
    const danger = game.enemies.some((e) => e.aware && e.state !== "dead" && !e.object) || game.player.act.kind === "attack";
    this.traffic.update(time);
    for (const d of this.drones) d.update(time, dt, game.player);
    if (dt <= 0) return;
    this.pigeons.update(dt, game, time, danger);
    this.litter.update(dt, time, game.player);
  }

  dispose() {
    this.pigeons.dispose();
    this.traffic.dispose();
    this.litter.dispose();
    this.drones.forEach((d) => d.dispose());
    this.fade.dispose();
    this.dot.dispose();
  }
}
