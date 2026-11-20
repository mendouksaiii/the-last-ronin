import * as THREE from "three";
import type { Burst } from "../engine/state";
import { smokePuff, softDot } from "./textures";

// Rain, sleet and ash around the camera; smoke from fires and grates; blood, sparks and dust
// from combat; blood pooling on the asphalt; shockwave rings.

const dot = softDot();
const puff = smokePuff();

// ---------- Generic particle pool ----------

class Particles {
  points: THREE.Points;
  private pos: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private alpha: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private max: Float32Array;
  private grav: Float32Array;
  private drag: Float32Array;
  private base: Float32Array;
  private next = 0;

  constructor(
    readonly cap: number,
    additive: boolean,
  ) {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 3);
    this.size = new Float32Array(cap);
    this.alpha = new Float32Array(cap);
    this.vel = new Float32Array(cap * 3);
    this.life = new Float32Array(cap);
    this.max = new Float32Array(cap).fill(1);
    this.grav = new Float32Array(cap);
    this.drag = new Float32Array(cap);
    this.base = new Float32Array(cap);
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    g.setAttribute("size", new THREE.BufferAttribute(this.size, 1));
    g.setAttribute("alpha", new THREE.BufferAttribute(this.alpha, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: dot }, scale: { value: 400 } },
      vertexShader: `
        attribute float size; attribute float alpha; attribute vec3 color;
        varying vec3 vColor; varying float vAlpha; uniform float scale;
        void main() {
          vColor = color; vAlpha = alpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * scale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D map; varying vec3 vColor; varying float vAlpha;
        void main() {
          vec4 t = texture2D(map, gl_PointCoord);
          gl_FragColor = vec4(vColor, t.a * vAlpha);
        }`,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
  }

  setScale(h: number) {
    (this.points.material as THREE.ShaderMaterial).uniforms.scale.value = h * 0.9;
  }

  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, color: THREE.Color, grav = 0, drag = 0) {
    const i = this.next;
    this.next = (this.next + 1) % this.cap;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.col.set([color.r, color.g, color.b], i * 3);
    this.life[i] = life;
    this.max[i] = life;
    this.base[i] = size;
    this.grav[i] = grav;
    this.drag[i] = drag;
  }

  update(dt: number, onLand?: (x: number, z: number) => void) {
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      const k = i * 3;
      const d = Math.pow(1 - Math.min(0.95, this.drag[i]), dt * 10);
      this.vel[k] *= d;
      this.vel[k + 2] *= d;
      this.vel[k + 1] = this.vel[k + 1] * d - this.grav[i] * dt;
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      if (this.pos[k + 1] < 0.02 && this.grav[i] > 0) {
        this.pos[k + 1] = 0.02;
        if (onLand && this.vel[k + 1] < -1) onLand(this.pos[k], this.pos[k + 2]);
        this.vel[k] = this.vel[k + 1] = this.vel[k + 2] = 0;
        this.life[i] = Math.min(this.life[i], 0.15);
      }
      const t = this.life[i] / this.max[i];
      this.alpha[i] = Math.min(1, t * 2.5);
      this.size[i] = this.base[i] * (0.5 + t * 0.5);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.alpha.needsUpdate = true;
    g.attributes.size.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
  }
}

// ---------- Precipitation ----------

const RAIN_N = 2600;
const BOX = { w: 44, h: 24, d: 44 };

class Weather {
  object: THREE.Object3D;
  private pos: Float32Array;
  private speed: Float32Array;
  private kind: "rain" | "sleet" | "ash";

  constructor(kind: "rain" | "sleet" | "ash") {
    this.kind = kind;
    const n = kind === "rain" ? RAIN_N : 1600;
    this.speed = new Float32Array(n);
    if (kind === "rain") {
      this.pos = new Float32Array(n * 6);
      for (let i = 0; i < n; i++) {
        const x = (Math.random() - 0.5) * BOX.w;
        const y = Math.random() * BOX.h;
        const z = (Math.random() - 0.5) * BOX.d;
        this.pos.set([x, y, z, x + 0.12, y + 0.75, z + 0.04], i * 6);
        this.speed[i] = 20 + Math.random() * 8;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
      this.object = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x8a96a0, transparent: true, opacity: 0.32, depthWrite: false }));
    } else {
      this.pos = new Float32Array(n * 3);
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        this.pos.set([(Math.random() - 0.5) * BOX.w, Math.random() * BOX.h, (Math.random() - 0.5) * BOX.d], i * 3);
        this.speed[i] = kind === "sleet" ? 5 + Math.random() * 3 : 0.6 + Math.random() * 0.8;
        const ember = kind === "ash" && Math.random() < 0.18;
        const c = ember ? new THREE.Color(2.2, 0.7, 0.15) : kind === "ash" ? new THREE.Color(0.35, 0.33, 0.32) : new THREE.Color(0.6, 0.63, 0.66);
        col.set([c.r, c.g, c.b], i * 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      this.object = new THREE.Points(
        g,
        new THREE.PointsMaterial({ size: kind === "sleet" ? 0.07 : 0.09, map: dot, vertexColors: true, transparent: true, depthWrite: false, opacity: 0.85, blending: kind === "ash" ? THREE.AdditiveBlending : THREE.NormalBlending }),
      );
    }
    this.object.frustumCulled = false;
  }

  update(dt: number, cam: THREE.Vector3, time: number) {
    // Drops live in world space and wrap around the camera, so they never jump.
    const wrap = (v: number, c: number, size: number) => {
      const half = size / 2;
      let r = v - c;
      if (r < -half) r += size * Math.ceil((-half - r) / size);
      else if (r > half) r -= size * Math.ceil((r - half) / size);
      return r + c;
    };
    const cx = cam.x;
    const cz = cam.z;
    if (this.kind === "rain") {
      for (let i = 0; i < this.speed.length; i++) {
        const k = i * 6;
        const dy = this.speed[i] * dt;
        let y = this.pos[k + 1] - dy;
        let x = this.pos[k] - dy * 0.16;
        let z = this.pos[k + 2] - dy * 0.05;
        if (y < 0) y += BOX.h;
        x = wrap(x, cx, BOX.w);
        z = wrap(z, cz, BOX.d);
        this.pos.set([x, y, z, x + 0.12, y + 0.75, z + 0.04], k);
      }
    } else {
      const ash = this.kind === "ash";
      for (let i = 0; i < this.speed.length; i++) {
        const k = i * 3;
        let y = this.pos[k + 1] - this.speed[i] * dt;
        const sway = ash ? Math.sin(time * 0.7 + i) * 0.5 : Math.sin(time * 2 + i) * 0.3;
        let x = this.pos[k] + (sway + (ash ? 0.4 : -0.8)) * dt;
        let z = this.pos[k + 2] + Math.cos(time * 0.5 + i) * 0.3 * dt;
        if (y < 0) y += BOX.h;
        x = wrap(x, cx, BOX.w);
        z = wrap(z, cz, BOX.d);
        this.pos.set([x, y, z], k);
      }
    }
    (this.object as THREE.Points).geometry.attributes.position.needsUpdate = true;
  }
}

// ---------- Smoke sprites ----------

interface Puff {
  s: THREE.Sprite;
  v: THREE.Vector3;
  life: number;
  max: number;
  grow: number;
  peak: number;
}

const SMOKE_N = 140;

// ---------- Effects facade ----------

const BLOOD = new THREE.Color(0.32, 0.01, 0.015);
const BLOOD_HI = new THREE.Color(0.55, 0.02, 0.03);
const SPARK = new THREE.Color(3, 1.6, 0.6);
const PARRY = new THREE.Color(3, 2.6, 2);
const DUST = new THREE.Color(0.32, 0.3, 0.28);
const EMBER = new THREE.Color(2.4, 0.8, 0.2);
const STONE = new THREE.Color(0.25, 0.24, 0.23);

export class Effects {
  group = new THREE.Group();
  private additive = new Particles(1400, true);
  private normal = new Particles(1400, false);
  private weather: Weather;
  private splash = new Particles(220, false);
  private puffs: Puff[] = [];
  private puffI = 0;
  private decals: THREE.InstancedMesh;
  private decalI = 0;
  private rings: { m: THREE.Mesh; t: number; r: number }[] = [];
  private dummy = new THREE.Object3D();
  private emitT = 0;

  constructor(readonly precip: "rain" | "sleet" | "ash") {
    this.weather = new Weather(precip);
    this.group.add(this.additive.points, this.normal.points, this.weather.object, this.splash.points);
    for (let i = 0; i < SMOKE_N; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, transparent: true, depthWrite: false, opacity: 0, color: 0x8a8886 }));
      s.visible = false;
      this.group.add(s);
      this.puffs.push({ s, v: new THREE.Vector3(), life: 0, max: 1, grow: 1, peak: 0.5 });
    }
    this.decals = new THREE.InstancedMesh(
      new THREE.CircleGeometry(0.5, 12),
      new THREE.MeshStandardMaterial({ color: 0x2a0204, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
      160,
    );
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    for (let i = 0; i < 160; i++) this.decals.setMatrixAt(i, this.dummy.matrix);
    this.decals.frustumCulled = false;
    this.group.add(this.decals);
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1, 48),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 0.9, 0.3), transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
      );
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      this.group.add(m);
      this.rings.push({ m, t: 1, r: 1 });
    }
  }

  resize(h: number) {
    for (const p of [this.additive, this.normal, this.splash]) p.setScale(h);
  }

  smoke(pos: THREE.Vector3, opts: { v?: THREE.Vector3; life?: number; size?: number; color?: number; opacity?: number } = {}) {
    const p = this.puffs[this.puffI];
    this.puffI = (this.puffI + 1) % SMOKE_N;
    p.s.position.copy(pos);
    p.v.copy(opts.v ?? new THREE.Vector3((Math.random() - 0.5) * 0.4, 1.2, (Math.random() - 0.5) * 0.4));
    p.life = p.max = opts.life ?? 3;
    const size = opts.size ?? 1;
    p.s.scale.setScalar(size);
    p.grow = size * 1.6;
    p.peak = opts.opacity ?? 0.35;
    (p.s.material as THREE.SpriteMaterial).color.set(opts.color ?? 0x7a7876);
    (p.s.material as THREE.SpriteMaterial).rotation = Math.random() * 6;
    p.s.visible = true;
  }

  private bloodDecal(x: number, z: number, size: number) {
    this.dummy.position.set(x, 0.025, z);
    this.dummy.rotation.set(-Math.PI / 2, 0, Math.random() * 6);
    this.dummy.scale.set(size * (0.7 + Math.random() * 0.6), size, 1);
    this.dummy.updateMatrix();
    this.decals.setMatrixAt(this.decalI, this.dummy.matrix);
    this.decalI = (this.decalI + 1) % 160;
    this.decals.instanceMatrix.needsUpdate = true;
  }

  burst(b: Burst) {
    const x = b.x;
    const z = b.y;
    const dx = Math.cos(b.dir);
    const dz = Math.sin(b.dir);
    const r = Math.random;
    switch (b.k) {
      case "blood":
        for (let i = 0; i < b.n * 2; i++) {
          const sp = 2 + r() * 5;
          const a = b.dir + (r() - 0.5) * 1.3;
          this.normal.spawn(x, 1 + r() * 0.5, z, Math.cos(a) * sp, 1 + r() * 3.5, Math.sin(a) * sp, 0.8 + r() * 0.5, 0.06 + r() * 0.08, r() < 0.5 ? BLOOD : BLOOD_HI, 14, 0.02);
        }
        this.bloodDecal(x + dx * (0.6 + r()), z + dz * (0.6 + r()), 0.4 + Math.min(1, b.n / 20) * 0.9);
        break;
      case "spark":
        for (let i = 0; i < b.n * 3; i++) {
          const a = b.dir + (r() - 0.5) * 2;
          const sp = 3 + r() * 6;
          this.additive.spawn(x, 1.1 + r() * 0.4, z, Math.cos(a) * sp, r() * 4, Math.sin(a) * sp, 0.25 + r() * 0.3, 0.05 + r() * 0.04, SPARK, 12, 0.05);
        }
        break;
      case "parry":
        for (let i = 0; i < b.n * 3; i++) {
          const a = r() * Math.PI * 2;
          const sp = 4 + r() * 8;
          this.additive.spawn(x, 1.2, z, Math.cos(a) * sp, (r() - 0.3) * 6, Math.sin(a) * sp, 0.3 + r() * 0.3, 0.07 + r() * 0.05, PARRY, 9, 0.08);
        }
        this.additive.spawn(x, 1.2, z, 0, 0, 0, 0.18, 2.4, PARRY);
        break;
      case "dust": {
        const rad = b.r ?? 1;
        for (let i = 0; i < Math.min(14, b.n); i++) {
          const a = r() * Math.PI * 2;
          const d = r() * rad;
          this.smoke(new THREE.Vector3(x + Math.cos(a) * d, 0.3, z + Math.sin(a) * d), {
            v: new THREE.Vector3(Math.cos(a) * 1.5, 0.4 + r() * 0.6, Math.sin(a) * 1.5),
            life: 1.2 + r(),
            size: 0.9 + r() * 0.8,
            color: 0x7a7672,
            opacity: 0.4,
          });
        }
        for (let i = 0; i < b.n; i++) {
          const a = r() * Math.PI * 2;
          this.normal.spawn(x, 0.2, z, Math.cos(a) * (1 + r() * 3), 2 + r() * 3, Math.sin(a) * (1 + r() * 3), 0.7, 0.06, STONE, 12);
        }
        break;
      }
      case "shatter":
        for (let i = 0; i < b.n * 2; i++) {
          const a = r() * Math.PI * 2;
          const sp = 2 + r() * 6;
          this.normal.spawn(x, 0.8 + r(), z, Math.cos(a) * sp, 2 + r() * 5, Math.sin(a) * sp, 1.2, 0.1 + r() * 0.1, STONE, 14);
          if (i % 3 === 0) this.additive.spawn(x, 0.8, z, Math.cos(a) * sp, 3 + r() * 4, Math.sin(a) * sp, 0.6, 0.06, SPARK, 10);
        }
        this.smoke(new THREE.Vector3(x, 0.8, z), { size: 2.5, life: 2.5, color: 0x6a6662, opacity: 0.5 });
        break;
      case "ring": {
        const ring = this.rings.find((q) => q.t >= 1) ?? this.rings[0];
        ring.t = 0;
        ring.r = b.r ?? 3;
        ring.m.position.set(x, 0.06, z);
        ring.m.visible = true;
        break;
      }
    }
  }

  update(dt: number, cam: THREE.Vector3, emitters: { pos: THREE.Vector3; kind: "fire" | "steam" }[], time: number) {
    this.weather.update(dt, cam, time);
    this.additive.update(dt);
    this.normal.update(dt, (px, pz) => {
      if (Math.random() < 0.08) this.bloodDecal(px, pz, 0.15 + Math.random() * 0.2);
    });
    // Rain splashes on the street around the camera.
    if (this.precip === "rain") {
      for (let i = 0; i < 6; i++) {
        this.splash.spawn(cam.x + (Math.random() - 0.5) * 30, 0.05, cam.z + (Math.random() - 0.5) * 30, 0, 0.6, 0, 0.18, 0.08, DUST.clone().multiplyScalar(1.6));
      }
    }
    this.splash.update(dt);

    // Fires smoke and spit embers; grates breathe steam.
    this.emitT += dt;
    if (this.emitT > 0.12) {
      this.emitT = 0;
      for (const e of emitters) {
        if (Math.abs(e.pos.x - cam.x) > 45 || Math.abs(e.pos.z - cam.z) > 45) continue;
        if (e.kind === "fire") {
          if (Math.random() < 0.6) this.smoke(e.pos.clone().setY(2), { v: new THREE.Vector3(0.3, 1.6, 0.1), life: 4, size: 1.1, color: 0x2a2624, opacity: 0.45 });
          this.additive.spawn(e.pos.x, e.pos.y + 0.5, e.pos.z, (Math.random() - 0.5) * 0.6, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 0.6, 1.5, 0.05, EMBER, -0.3, 0.02);
        } else if (Math.random() < 0.7) {
          this.smoke(e.pos, { v: new THREE.Vector3(0.2, 1.4, 0), life: 3, size: 1.3, color: 0x8a8886, opacity: 0.25 });
        }
      }
    }

    for (const p of this.puffs) {
      if (!p.s.visible) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.s.visible = false;
        continue;
      }
      p.s.position.addScaledVector(p.v, dt);
      p.v.multiplyScalar(Math.pow(0.6, dt));
      const s = p.s.scale.x + p.grow * dt * 0.5;
      p.s.scale.setScalar(s);
      const t = p.life / p.max;
      (p.s.material as THREE.SpriteMaterial).opacity = p.peak * Math.min(1, (1 - t) * 6) * t;
    }

    for (const ring of this.rings) {
      if (ring.t >= 1) continue;
      ring.t = Math.min(1, ring.t + dt * 2.6);
      const s = ring.r * (0.3 + ring.t * 0.8);
      ring.m.scale.set(s, s, s);
      (ring.m.material as THREE.MeshBasicMaterial).opacity = (1 - ring.t) * 0.9;
      if (ring.t >= 1) ring.m.visible = false;
    }
  }

  dispose() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
  }
}
