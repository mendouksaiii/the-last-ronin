import * as THREE from "three";
import type { Burst } from "../engine/state";
import type { NationId } from "../types";
import { smokePuff, softDot } from "./textures";

// Rain, sleet and ash around the camera; district atmospheric motes; wet street ripples;
// smoke from fires and grates; blood, sparks, slashes, heals, guard breaks and shockwave rings.

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
  private floorY: Float32Array;
  private blood: Uint8Array;
  private next = 0;
  private activeCount = 0;
  private colorDirty = false;
  private hadAlive = false;

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
    this.floorY = new Float32Array(cap);
    this.blood = new Uint8Array(cap);
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
          if (mv.z > -0.1 || vAlpha <= 0.005) {
            gl_PointSize = 0.0;
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            return;
          }
          gl_PointSize = clamp(size * scale / -mv.z, 0.0, 220.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D map; varying vec3 vColor; varying float vAlpha;
        void main() {
          vec4 t = texture2D(map, gl_PointCoord);
          float a = t.a * vAlpha;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vColor * t.rgb, a);
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

  spawn(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    life: number,
    size: number,
    color: THREE.Color,
    grav = 0,
    drag = 0,
    floor = 0,
    isBlood = false,
  ) {
    const i = this.next;
    this.next = (this.next + 1) % this.cap;
    const k = i * 3;
    this.pos[k] = x;
    this.pos[k + 1] = y;
    this.pos[k + 2] = z;
    this.vel[k] = vx;
    this.vel[k + 1] = vy;
    this.vel[k + 2] = vz;
    this.col[k] = color.r;
    this.col[k + 1] = color.g;
    this.col[k + 2] = color.b;
    if (this.life[i] <= 0) this.activeCount++;
    this.life[i] = life;
    this.max[i] = life;
    this.base[i] = size;
    this.grav[i] = grav;
    this.drag[i] = drag;
    this.floorY[i] = floor + 0.02;
    this.blood[i] = isBlood ? 1 : 0;
    this.colorDirty = true;
  }

  update(dt: number, onLand?: (x: number, z: number) => void) {
    if (this.activeCount === 0 && !this.hadAlive && !this.colorDirty) return;
    let alive = 0;
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      alive++;
      const k = i * 3;
      const d = Math.pow(1 - Math.min(0.95, this.drag[i]), dt * 10);
      this.vel[k] *= d;
      this.vel[k + 2] *= d;
      this.vel[k + 1] = this.vel[k + 1] * d - this.grav[i] * dt;
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      if (this.pos[k + 1] < this.floorY[i] && this.grav[i] > 0) {
        this.pos[k + 1] = this.floorY[i];
        if (onLand && this.blood[i] && this.vel[k + 1] < -1) onLand(this.pos[k], this.pos[k + 2]);
        this.vel[k] *= 0.35;
        this.vel[k + 1] = 0;
        this.vel[k + 2] *= 0.35;
        this.life[i] = Math.min(this.life[i], 0.14);
      }
      const t = this.life[i] / this.max[i];
      this.alpha[i] = Math.min(1, t * 2.5);
      this.size[i] = this.base[i] * (0.5 + t * 0.5);
    }
    this.activeCount = alive;
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.alpha.needsUpdate = true;
    g.attributes.size.needsUpdate = true;
    if (this.colorDirty) {
      g.attributes.color.needsUpdate = true;
      this.colorDirty = false;
    }
    this.hadAlive = alive > 0;
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
        const k = i * 6;
        const x = (Math.random() - 0.5) * BOX.w;
        const y = Math.random() * BOX.h;
        const z = (Math.random() - 0.5) * BOX.d;
        this.pos[k] = x;
        this.pos[k + 1] = y;
        this.pos[k + 2] = z;
        this.pos[k + 3] = x + 0.12;
        this.pos[k + 4] = y + 0.75;
        this.pos[k + 5] = z + 0.04;
        this.speed[i] = 20 + Math.random() * 8;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
      this.object = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x8a96a0, transparent: true, opacity: 0.32, depthWrite: false }));
    } else {
      this.pos = new Float32Array(n * 3);
      const col = new Float32Array(n * 3);
      const scratch = new THREE.Color();
      for (let i = 0; i < n; i++) {
        const k = i * 3;
        this.pos[k] = (Math.random() - 0.5) * BOX.w;
        this.pos[k + 1] = Math.random() * BOX.h;
        this.pos[k + 2] = (Math.random() - 0.5) * BOX.d;
        this.speed[i] = kind === "sleet" ? 5 + Math.random() * 3 : 0.6 + Math.random() * 0.8;
        const ember = kind === "ash" && Math.random() < 0.18;
        if (ember) scratch.setRGB(2.2, 0.7, 0.15);
        else if (kind === "ash") scratch.setRGB(0.35, 0.33, 0.32);
        else scratch.setRGB(0.6, 0.63, 0.66);
        col[k] = scratch.r;
        col[k + 1] = scratch.g;
        col[k + 2] = scratch.b;
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
      const half = size * 0.5;
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
        this.pos[k] = x;
        this.pos[k + 1] = y;
        this.pos[k + 2] = z;
        this.pos[k + 3] = x + 0.12;
        this.pos[k + 4] = y + 0.75;
        this.pos[k + 5] = z + 0.04;
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
        this.pos[k] = x;
        this.pos[k + 1] = y;
        this.pos[k + 2] = z;
      }
    }
    (this.object as THREE.LineSegments | THREE.Points).geometry.attributes.position.needsUpdate = true;
  }
}

// ---------- District atmospheric motes ----------

const MOTE_N = 240;
const MOTE_BOX = { w: 36, h: 11, d: 36 };

const NATION_MOTE_PALETTE: Record<NationId, [number, number]> = {
  reeds: [0x92ffa8, 0xffd268], // marsh fireflies & drifting warm reeds spores
  snow: [0xc8e8ff, 0xf2f8ff], // frost crystals & icy dust
  tides: [0x38f2d8, 0x80c8ff], // bioluminescent harbor mist & sea sparks
  lanterns: [0xff329e, 0xffb040], // neon bokeh embers & lantern haze
  ash: [0xff581a, 0xffc040], // glowing cinders & burning embers
};

class AmbientMotes {
  points: THREE.Points;
  private pos: Float32Array;
  private col: Float32Array;
  private phase: Float32Array;
  private mat: THREE.ShaderMaterial;
  private nation: NationId = "reeds";

  constructor() {
    this.pos = new Float32Array(MOTE_N * 3);
    this.col = new Float32Array(MOTE_N * 3);
    this.phase = new Float32Array(MOTE_N);
    for (let i = 0; i < MOTE_N; i++) {
      const k = i * 3;
      this.pos[k] = (Math.random() - 0.5) * MOTE_BOX.w;
      this.pos[k + 1] = 0.4 + Math.random() * MOTE_BOX.h;
      this.pos[k + 2] = (Math.random() - 0.5) * MOTE_BOX.d;
      this.phase[i] = Math.random() * Math.PI * 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    g.setAttribute("phase", new THREE.BufferAttribute(this.phase, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: dot }, scale: { value: 400 }, time: { value: 0 } },
      vertexShader: `
        attribute vec3 color;
        attribute float phase;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float scale;
        uniform float time;
        void main() {
          vColor = color;
          float tw = 0.5 + 0.5 * sin(time * 2.1 + phase);
          vAlpha = 0.28 + 0.58 * pow(max(0.0001, tw), 1.6);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          if (mv.z > -0.25) {
            gl_PointSize = 0.0;
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            return;
          }
          float sz = 0.055 + 0.06 * tw;
          gl_PointSize = clamp(sz * scale / -mv.z, 0.0, 90.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D map;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec4 t = texture2D(map, gl_PointCoord);
          float a = t.a * vAlpha;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vColor * 1.35 * t.rgb, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.setNation("reeds");
  }

  setScale(h: number) {
    this.mat.uniforms.scale.value = h * 0.9;
  }

  setNation(nation: NationId) {
    this.nation = nation;
    const [aHex, bHex] = NATION_MOTE_PALETTE[nation];
    const ca = new THREE.Color(aHex);
    const cb = new THREE.Color(bHex);
    const mixCol = new THREE.Color();
    for (let i = 0; i < MOTE_N; i++) {
      mixCol.copy(ca).lerp(cb, (i % 7) / 6);
      const k = i * 3;
      this.col[k] = mixCol.r;
      this.col[k + 1] = mixCol.g;
      this.col[k + 2] = mixCol.b;
    }
    this.points.geometry.attributes.color.needsUpdate = true;
  }

  update(dt: number, cam: THREE.Vector3, time: number) {
    this.mat.uniforms.time.value = time;
    if (dt <= 0) return;
    const rise = this.nation === "ash" ? 0.55 : this.nation === "snow" ? -0.25 : 0.14;
    const drift = this.nation === "tides" ? 0.65 : 0.38;
    const wrap = (v: number, c: number, size: number) => {
      const half = size * 0.5;
      let r = v - c;
      if (r < -half) r += size * Math.ceil((-half - r) / size);
      else if (r > half) r -= size * Math.ceil((r - half) / size);
      return r + c;
    };
    for (let i = 0; i < MOTE_N; i++) {
      const k = i * 3;
      const p = this.phase[i];
      let x = this.pos[k] + (Math.sin(time * 0.8 + p) * drift + 0.18) * dt;
      let y = this.pos[k + 1] + (rise + Math.cos(time * 1.1 + p * 1.3) * 0.25) * dt;
      let z = this.pos[k + 2] + Math.cos(time * 0.7 + p * 0.9) * drift * dt;
      if (y < 0.25) y += MOTE_BOX.h;
      else if (y > MOTE_BOX.h + 0.4) y -= MOTE_BOX.h;
      x = wrap(x, cam.x, MOTE_BOX.w);
      z = wrap(z, cam.z, MOTE_BOX.d);
      this.pos[k] = x;
      this.pos[k + 1] = y;
      this.pos[k + 2] = z;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

// ---------- Surface water / step ripples ----------

interface RippleSlot {
  m: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  t: number;
  dur: number;
  maxR: number;
}

const RIPPLE_N = 28;

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
const DUST = new THREE.Color(0.58, 0.56, 0.54);
const SNOW_DUST = new THREE.Color(0.74, 0.8, 0.88);
const ASH_DUST = new THREE.Color(0.56, 0.52, 0.48);
const WATER_SPRAY = new THREE.Color(0.56, 0.72, 0.86);
const WATER_HI = new THREE.Color(0.84, 0.93, 1.0);
const WATER_GLINT = new THREE.Color(0.68, 0.84, 1.0);
const RAIN_SPLASH = new THREE.Color(0.62, 0.74, 0.86);
const EMBER = new THREE.Color(2.4, 0.8, 0.2);
const STONE = new THREE.Color(0.42, 0.4, 0.38);
const HEAL_EMERALD = new THREE.Color(0.45, 2.2, 1.35);
const HEAL_GOLD = new THREE.Color(2.4, 1.95, 0.75);
const BREAK_GOLD = new THREE.Color(2.9, 1.75, 0.4);
const SHADOW_CRIMSON = new THREE.Color(1.85, 0.16, 0.48);
const SHADOW_VIOLET = new THREE.Color(0.95, 0.24, 1.45);
const _smokePos = new THREE.Vector3();
const _smokeVel = new THREE.Vector3();
const _slashCol = new THREE.Color();
const _slashCore = new THREE.Color();
const _slashSpark = new THREE.Color();
const _burstCol = new THREE.Color();

interface SlashWave {
  m: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  v: THREE.Vector3;
  t: number;
  dur: number;
  baseScale: number;
}

const SLASH_N = 16;

/** Curved tapered horizontal crescent blade-wave strip around +Z (facing). */
function buildCrescentGeo(): THREE.BufferGeometry {
  const segs = 28;
  const arc = 2.35; // ~135° sweep centered around +Z
  const pos = new Float32Array((segs + 1) * 2 * 3);
  const uv = new Float32Array((segs + 1) * 2 * 2);
  const idx: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const a = (u - 0.5) * arc;
    const sx = Math.sin(a);
    const cz = Math.cos(a);
    // Razor tapered crescent thickness: thick belly at center, razor horns at ends.
    const belly = Math.pow(Math.sin(u * Math.PI), 0.68);
    const rOuter = 1.0 + belly * 0.16;
    const rInner = rOuter - (0.04 + belly * 0.44);
    const p = i * 6;
    pos[p] = sx * rInner;
    pos[p + 1] = 0;
    pos[p + 2] = cz * rInner;
    pos[p + 3] = sx * rOuter;
    pos[p + 4] = 0;
    pos[p + 5] = cz * rOuter;
    const uIdx = i * 4;
    uv[uIdx] = u;
    uv[uIdx + 1] = 0;
    uv[uIdx + 2] = u;
    uv[uIdx + 3] = 1;
    if (i < segs) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

export class Effects {
  group = new THREE.Group();
  private additive = new Particles(1600, true);
  private normal = new Particles(1600, false);
  private weather: Weather;
  private motes = new AmbientMotes();
  private splash = new Particles(480, false);
  private puffs: Puff[] = [];
  private puffI = 0;
  private decals: THREE.InstancedMesh;
  private decalI = 0;
  private rings: { m: THREE.Mesh; t: number; r: number }[] = [];
  private ripples: RippleSlot[] = [];
  private rippleI = 0;
  private rippleGeo: THREE.BufferGeometry;
  private slashes: SlashWave[] = [];
  private slashGeo: THREE.BufferGeometry;
  private dummy = new THREE.Object3D();
  private emitT = 0;

  constructor(
    readonly precip: "rain" | "sleet" | "ash",
    nation: NationId = "reeds",
  ) {
    this.weather = new Weather(precip);
    this.motes.setNation(nation);
    this.group.add(this.additive.points, this.normal.points, this.weather.object, this.motes.points, this.splash.points);
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
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(0.86, 1, 48),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 0.9, 0.3), transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
      );
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      this.group.add(m);
      this.rings.push({ m, t: 1, r: 1 });
    }
    this.rippleGeo = new THREE.PlaneGeometry(2, 2);
    this.rippleGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < RIPPLE_N; i++) {
      const mat = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(0x9ad4ff) }, uProgress: { value: 1 } },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv * 2.0 - 1.0;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `
          uniform vec3 uColor;
          uniform float uProgress;
          varying vec2 vUv;
          void main() {
            float d = length(vUv);
            if (d > 1.0) discard;
            float r1 = exp(-pow(max(0.0001, abs(d - uProgress * 0.92) * 18.0), 2.0));
            float r2 = exp(-pow(max(0.0001, abs(d - max(0.0, uProgress - 0.16) * 0.85) * 20.0), 2.0)) * 0.55;
            float fade = pow(max(0.0001, 1.0 - uProgress), 1.35) * smoothstep(1.0, 0.82, d);
            float a = (r1 + r2) * fade * 0.65;
            if (a < 0.01) discard;
            gl_FragColor = vec4(uColor * 1.6, a);
          }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        toneMapped: false,
      });
      const m = new THREE.Mesh(this.rippleGeo, mat);
      m.visible = false;
      m.frustumCulled = false;
      this.group.add(m);
      this.ripples.push({ m, mat, t: 1, dur: 0.45, maxR: 0.65 });
    }
    this.slashGeo = buildCrescentGeo();
    for (let i = 0; i < SLASH_N; i++) {
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(0x9ad4ff) },
          uCore: { value: new THREE.Color(0xffffff) },
          uProgress: { value: 1 },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `
          uniform vec3 uColor;
          uniform vec3 uCore;
          uniform float uProgress;
          varying vec2 vUv;
          void main() {
            float u = vUv.x;
            float v = vUv.y;
            float head = smoothstep(0.0, 0.06, uProgress) * pow(max(0.0001, 1.0 - uProgress), 1.1);
            // Sweeping ink/steel brush profile along the crescent horns and belly
            float hornMask = smoothstep(0.0, 0.16, u) * smoothstep(1.0, 0.84, u);
            float radialMask = smoothstep(0.03, 0.38, v) * (1.0 - smoothstep(0.92, 1.0, v) * 0.3);
            float sweep = smoothstep(uProgress - 0.6, uProgress + 0.08, u) * smoothstep(uProgress + 0.72, uProgress - 0.08, u);
            float streak = 0.74 + 0.26 * sin(v * 26.0 + u * 18.0 - uProgress * 12.0);
            float razor = smoothstep(0.68, 0.96, v);
            vec3 col = mix(uColor * 2.5, uCore * 3.1, razor * 0.85);
            float alpha = head * hornMask * radialMask * (0.5 + 0.5 * sweep) * streak;
            if (alpha < 0.01) discard;
            gl_FragColor = vec4(col, alpha);
          }`,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      });
      const m = new THREE.Mesh(this.slashGeo, mat);
      m.rotation.order = "YXZ";
      m.visible = false;
      m.frustumCulled = false;
      this.group.add(m);
      this.slashes.push({ m, mat, v: new THREE.Vector3(), t: 1, dur: 0.22, baseScale: 1.5 });
    }
  }

  setNation(nation: NationId) {
    this.motes.setNation(nation);
  }

  resize(h: number) {
    for (const p of [this.additive, this.normal, this.splash]) p.setScale(h);
    this.motes.setScale(h);
  }

  private spawnRing(x: number, y: number, z: number, radius: number, colorHex?: number) {
    const ring = this.rings.find((q) => q.t >= 1) ?? this.rings[0];
    ring.t = 0;
    ring.r = radius;
    ring.m.position.set(x, y, z);
    if (colorHex !== undefined) (ring.m.material as THREE.MeshBasicMaterial).color.set(colorHex).multiplyScalar(2.2);
    else (ring.m.material as THREE.MeshBasicMaterial).color.setRGB(2.5, 0.9, 0.3);
    ring.m.visible = true;
  }

  private spawnRipple(x: number, y: number, z: number, maxR = 0.75, dur = 0.45, colorHex = 0x8cc8f0) {
    const slot = this.ripples[this.rippleI];
    this.rippleI = (this.rippleI + 1) % RIPPLE_N;
    slot.t = 0;
    slot.dur = dur;
    slot.maxR = maxR;
    slot.m.position.set(x, y + 0.025, z);
    slot.m.scale.setScalar(0.12);
    slot.mat.uniforms.uColor.value.set(colorHex);
    slot.mat.uniforms.uProgress.value = 0;
    slot.m.visible = true;
  }

  smoke(pos: THREE.Vector3, opts: { v?: THREE.Vector3; life?: number; size?: number; color?: number; opacity?: number } = {}) {
    const p = this.puffs[this.puffI];
    this.puffI = (this.puffI + 1) % SMOKE_N;
    p.s.position.copy(pos);
    if (opts.v) p.v.copy(opts.v);
    else p.v.set((Math.random() - 0.5) * 0.4, 1.2, (Math.random() - 0.5) * 0.4);
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
    const baseY = b.z ?? 0;
    const dx = Math.cos(b.dir);
    const dz = Math.sin(b.dir);
    const r = Math.random;
    switch (b.k) {
      case "blood":
        for (let i = 0; i < b.n * 2; i++) {
          const sp = 2 + r() * 5.2;
          const a = b.dir + (r() - 0.5) * 1.3;
          this.normal.spawn(x, baseY + 1 + r() * 0.5, z, Math.cos(a) * sp, 1 + r() * 3.5, Math.sin(a) * sp, 0.8 + r() * 0.5, 0.06 + r() * 0.08, r() < 0.5 ? BLOOD : BLOOD_HI, 14, 0.02, baseY, true);
        }
        if (b.n >= 10) {
          _smokePos.set(x + dx * 0.25, baseY + 1.0, z + dz * 0.25);
          _smokeVel.set(dx * 1.2, 0.35, dz * 1.2);
          this.smoke(_smokePos, { v: _smokeVel, life: 0.45, size: 0.55, color: 0x5c0a12, opacity: 0.22 });
        }
        if (baseY < 0.25) this.bloodDecal(x + dx * (0.6 + r()), z + dz * (0.6 + r()), 0.4 + Math.min(1, b.n / 20) * 0.9);
        break;
      case "spark":
        if (b.color !== undefined) _burstCol.set(b.color).multiplyScalar(2.4);
        else _burstCol.copy(SPARK);
        for (let i = 0; i < b.n * 3; i++) {
          const a = b.dir + (r() - 0.5) * 2;
          const sp = 3 + r() * 6;
          this.additive.spawn(x, baseY + 1.1 + r() * 0.4, z, Math.cos(a) * sp, r() * 4, Math.sin(a) * sp, 0.25 + r() * 0.3, 0.05 + r() * 0.04, _burstCol, 12, 0.05, baseY);
        }
        break;
      case "parry": {
        for (let i = 0; i < b.n * 3; i++) {
          const a = r() * Math.PI * 2;
          const sp = 4 + r() * 8;
          this.additive.spawn(x, baseY + 1.2, z, Math.cos(a) * sp, (r() - 0.3) * 6, Math.sin(a) * sp, 0.3 + r() * 0.3, 0.07 + r() * 0.05, PARRY, 9, 0.08, baseY);
        }
        this.additive.spawn(x, baseY + 1.2, z, 0, 0, 0, 0.18, 2.4, PARRY);
        this.spawnRing(x, baseY + 1.1, z, 2.6, 0xffd088);
        break;
      }
      case "slash": {
        const sw = this.slashes.find((q) => q.t >= 1) ?? this.slashes[0];
        const radius = b.r ?? 1.6;
        const colHex = b.color ?? 0x9ad4ff;
        _slashCol.set(colHex);
        _slashCore.copy(_slashCol).lerp(WATER_HI, 0.72);
        sw.mat.uniforms.uColor.value.copy(_slashCol);
        sw.mat.uniforms.uCore.value.copy(_slashCore);
        sw.mat.uniforms.uProgress.value = 0.04;
        sw.t = 0.04;
        sw.dur = radius > 2.2 ? 0.3 : 0.22;
        sw.baseScale = radius;
        sw.m.position.set(x + dx * 0.42, baseY + 1.06, z + dz * 0.42);
        sw.m.rotation.set(0, Math.PI / 2 - b.dir, b.tilt ?? 0);
        sw.m.scale.setScalar(radius * 0.78);
        sw.v.set(dx * (radius > 2.2 ? 6.2 : 4.2), 0.15, dz * (radius > 2.2 ? 6.2 : 4.2));
        sw.m.visible = true;

        // Sweeping Ghost-of-Tsushima wind-ember & steel sparks along the cut arc.
        _slashSpark.copy(_slashCol).multiplyScalar(2.4);
        const sparkCount = Math.max(6, Math.round(b.n * 1.4));
        for (let i = 0; i < sparkCount; i++) {
          const arcA = b.dir + (r() - 0.5) * 1.9;
          const distR = radius * (0.45 + r() * 0.55);
          const tiltY = Math.sin(b.tilt ?? 0) * Math.sin(arcA - b.dir) * 0.75;
          const sx = x + Math.cos(arcA) * distR;
          const sz = z + Math.sin(arcA) * distR;
          const sy = baseY + 1.05 + tiltY + (r() - 0.5) * 0.3;
          const sp = 2.8 + r() * 5.2;
          this.additive.spawn(
            sx,
            sy,
            sz,
            Math.cos(arcA) * sp + dx * 1.4,
            0.6 + r() * 2.4 + tiltY * 1.6,
            Math.sin(arcA) * sp + dz * 1.4,
            0.22 + r() * 0.24,
            0.042 + r() * 0.045,
            i % 3 === 0 ? PARRY : _slashSpark,
            6.5,
            0.08,
            baseY,
          );
        }
        break;
      }
      case "slide": {
        const rad = b.r ?? 0.65;
        const wet = this.precip === "rain" && baseY < 0.25;
        if (wet) this.spawnRipple(x, baseY, z, 0.65 + rad * 0.45, 0.48, 0x8cc8f0);
        const sprayN = Math.max(8, Math.round(b.n * 2.2));
        for (let i = 0; i < sprayN; i++) {
          const side = i % 2 === 0 ? 1 : -1;
          const fan = side * (0.35 + r() * 0.95) + (r() - 0.5) * 0.35;
          const a = b.dir + fan;
          const ox = x + Math.cos(a) * r() * 0.28 * rad;
          const oz = z + Math.sin(a) * r() * 0.28 * rad;
          const sp = wet ? 2.4 + r() * 4.8 : 1.8 + r() * 3.8;
          const vy = wet ? 1.1 + r() * 2.4 : 0.7 + r() * 1.6;
          if (wet) {
            this.normal.spawn(
              ox,
              baseY + 0.05 + r() * 0.08,
              oz,
              Math.cos(a) * sp,
              vy,
              Math.sin(a) * sp,
              0.26 + r() * 0.24,
              0.045 + r() * 0.05,
              r() < 0.45 ? WATER_HI : WATER_SPRAY,
              13,
              0.04,
              baseY,
            );
            if (i % 3 === 0) {
              this.additive.spawn(
                ox,
                baseY + 0.06 + r() * 0.06,
                oz,
                Math.cos(a) * (sp * 0.9),
                vy * 0.95,
                Math.sin(a) * (sp * 0.9),
                0.2 + r() * 0.16,
                0.04 + r() * 0.035,
                WATER_GLINT,
                12,
                0.05,
                baseY,
              );
            }
          } else {
            const col = this.precip === "sleet" ? SNOW_DUST : this.precip === "ash" ? ASH_DUST : DUST;
            this.normal.spawn(
              ox,
              baseY + 0.04 + r() * 0.08,
              oz,
              Math.cos(a) * sp,
              vy,
              Math.sin(a) * sp,
              0.32 + r() * 0.26,
              0.045 + r() * 0.045,
              col,
              9.5,
              0.08,
              baseY,
            );
          }
        }
        if (wet) {
          for (let i = 0; i < Math.max(4, Math.round(b.n * 0.6)); i++) {
            const a = b.dir + (r() - 0.5) * 2.2;
            const d = 0.15 + r() * 0.45 * rad;
            this.splash.spawn(
              x + Math.cos(a) * d,
              baseY + 0.03,
              z + Math.sin(a) * d,
              Math.cos(a) * (0.8 + r() * 1.4),
              0.55 + r() * 0.75,
              Math.sin(a) * (0.8 + r() * 1.4),
              0.18 + r() * 0.12,
              0.075 + r() * 0.065,
              RAIN_SPLASH,
              4,
              0.06,
              baseY,
            );
          }
        }
        // Subtle low ground mist hugging the street (never large dark overhead sprite frames).
        const mistCount = Math.min(3, Math.max(1, Math.round(b.n / 5)));
        const mistCol = wet ? 0xb4cce0 : this.precip === "sleet" ? 0xc0ccd8 : this.precip === "ash" ? 0x948c84 : 0x9e9890;
        for (let i = 0; i < mistCount; i++) {
          const a = b.dir + (r() - 0.5) * 1.4;
          const d = 0.1 + r() * 0.35 * rad;
          _smokePos.set(x + Math.cos(a) * d, baseY + 0.09, z + Math.sin(a) * d);
          _smokeVel.set(Math.cos(a) * (0.9 + r() * 1.1), 0.08 + r() * 0.14, Math.sin(a) * (0.9 + r() * 1.1));
          this.smoke(_smokePos, {
            v: _smokeVel,
            life: 0.3 + r() * 0.2,
            size: 0.28 + r() * 0.18,
            color: mistCol,
            opacity: wet ? 0.14 : 0.16,
          });
        }
        break;
      }
      case "dust": {
        const rad = b.r ?? 0.85;
        const wet = this.precip === "rain" && baseY < 0.25;
        if (wet && b.n >= 5) this.spawnRipple(x, baseY, z, 0.75 + rad * 0.5, 0.5, 0x8cc8f0);
        const mistCount = Math.min(5, Math.max(2, Math.round(b.n * 0.4)));
        const mistCol = wet ? 0xaec4d8 : this.precip === "sleet" ? 0xb8c4d0 : this.precip === "ash" ? 0x908880 : 0x98928a;
        for (let i = 0; i < mistCount; i++) {
          const a = r() * Math.PI * 2;
          const d = r() * rad * 0.65;
          _smokePos.set(x + Math.cos(a) * d, baseY + 0.1, z + Math.sin(a) * d);
          _smokeVel.set(Math.cos(a) * (0.7 + r() * 0.7), 0.12 + r() * 0.2, Math.sin(a) * (0.7 + r() * 0.7));
          this.smoke(_smokePos, {
            v: _smokeVel,
            life: 0.42 + r() * 0.32,
            size: 0.36 + r() * 0.28,
            color: mistCol,
            opacity: wet ? 0.15 : 0.18,
          });
        }
        const grainCol = wet ? WATER_SPRAY : this.precip === "sleet" ? SNOW_DUST : this.precip === "ash" ? ASH_DUST : DUST;
        for (let i = 0; i < b.n * 2; i++) {
          const a = r() * Math.PI * 2;
          const sp = 1 + r() * 3.2;
          this.normal.spawn(
            x + Math.cos(a) * r() * 0.25,
            baseY + 0.06 + r() * 0.12,
            z + Math.sin(a) * r() * 0.25,
            Math.cos(a) * sp,
            wet ? 1.2 + r() * 2.4 : 1.0 + r() * 2.2,
            Math.sin(a) * sp,
            0.35 + r() * 0.28,
            0.05 + r() * 0.04,
            wet && i % 3 === 0 ? WATER_HI : grainCol,
            12,
            0.05,
            baseY,
          );
        }
        break;
      }
      case "shatter":
        for (let i = 0; i < b.n * 2; i++) {
          const a = r() * Math.PI * 2;
          const sp = 2.5 + r() * 6.5;
          this.normal.spawn(x, baseY + 0.8 + r(), z, Math.cos(a) * sp, 2 + r() * 5, Math.sin(a) * sp, 1.2, 0.1 + r() * 0.1, STONE, 14, 0, baseY);
          if (i % 2 === 0) this.additive.spawn(x, baseY + 0.8, z, Math.cos(a) * sp * 1.15, 3 + r() * 4.5, Math.sin(a) * sp * 1.15, 0.65, 0.075, SPARK, 10, 0.03, baseY);
        }
        this.spawnRing(x, baseY + 0.15, z, 3.4, 0xff7028);
        _smokePos.set(x, baseY + 0.8, z);
        this.smoke(_smokePos, { size: 2.2, life: 2.0, color: 0x6a6662, opacity: 0.42 });
        break;
      case "ring":
        this.spawnRing(x, baseY + 0.06, z, b.r ?? 3, b.color);
        break;
      case "heal": {
        const isGold = b.color !== undefined;
        if (isGold) _burstCol.set(b.color!).multiplyScalar(2.1);
        const count = Math.max(14, b.n * 2);
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2 + r() * 0.5;
          const rad = 0.3 + r() * (b.r ?? 0.85);
          const col = isGold ? (i % 2 === 0 ? _burstCol : HEAL_GOLD) : i % 3 === 0 ? HEAL_GOLD : HEAL_EMERALD;
          this.additive.spawn(
            x + Math.cos(a) * rad,
            baseY + 0.25 + r() * 0.9,
            z + Math.sin(a) * rad,
            Math.cos(a) * 0.65,
            1.6 + r() * 2.4,
            Math.sin(a) * 0.65,
            0.55 + r() * 0.45,
            0.07 + r() * 0.06,
            col,
            -1.4,
            0.05,
            baseY,
          );
        }
        this.spawnRing(x, baseY + 0.1, z, b.r ?? 2.4, b.color ?? 0x58f09c);
        break;
      }
      case "guardBreak": {
        const count = Math.max(16, b.n * 2);
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2 + (r() - 0.5) * 0.35;
          const sp = 4.2 + r() * 6.5;
          this.additive.spawn(
            x,
            baseY + 1.15 + r() * 0.3,
            z,
            Math.cos(a) * sp,
            1.4 + r() * 3.8,
            Math.sin(a) * sp,
            0.35 + r() * 0.28,
            0.065 + r() * 0.05,
            i % 3 === 0 ? PARRY : BREAK_GOLD,
            9.5,
            0.06,
            baseY,
          );
        }
        this.additive.spawn(x, baseY + 1.15, z, 0, 0, 0, 0.22, 2.0, BREAK_GOLD);
        this.spawnRing(x, baseY + 1.0, z, b.r ?? 2.9, b.color ?? 0xffa828);
        break;
      }
      case "ripple": {
        const maxR = b.r ?? 0.68;
        this.spawnRipple(x, baseY, z, maxR, 0.42, b.color ?? 0x8cc8f0);
        if (this.precip === "rain") {
          for (let i = 0; i < Math.max(2, b.n); i++) {
            const a = b.dir + (r() - 0.5) * 2.2;
            const sp = 0.8 + r() * 1.8;
            this.splash.spawn(
              x + Math.cos(a) * 0.14,
              baseY + 0.04,
              z + Math.sin(a) * 0.14,
              Math.cos(a) * sp,
              0.7 + r() * 1.1,
              Math.sin(a) * sp,
              0.18 + r() * 0.12,
              0.055 + r() * 0.04,
              WATER_HI,
              8,
              0.04,
              baseY,
            );
          }
        }
        break;
      }
      case "shadow": {
        const col = b.color !== undefined ? _burstCol.set(b.color).multiplyScalar(1.9) : SHADOW_CRIMSON;
        const count = Math.max(14, b.n * 2);
        for (let i = 0; i < count; i++) {
          const a = r() * Math.PI * 2;
          const sp = 1.6 + r() * 4.5;
          this.additive.spawn(
            x + Math.cos(a) * r() * 0.35,
            baseY + 0.4 + r() * 1.2,
            z + Math.sin(a) * r() * 0.35,
            Math.cos(a) * sp,
            1.2 + r() * 2.8,
            Math.sin(a) * sp,
            0.42 + r() * 0.35,
            0.065 + r() * 0.05,
            i % 3 === 0 ? SHADOW_VIOLET : col,
            -0.6,
            0.07,
            baseY,
          );
        }
        _smokePos.set(x, baseY + 0.85, z);
        _smokeVel.set(0, 0.9, 0);
        this.smoke(_smokePos, { v: _smokeVel, life: 0.75, size: 1.05, color: 0x26121c, opacity: 0.34 });
        this.spawnRing(x, baseY + 0.12, z, b.r ?? 2.4, b.color ?? 0xc81848);
        break;
      }
    }
  }

  update(dt: number, cam: THREE.Vector3, emitters: { pos: THREE.Vector3; kind: "fire" | "steam" }[], time: number) {
    this.weather.update(dt, cam, time);
    this.motes.update(dt, cam, time);
    this.additive.update(dt);
    this.normal.update(dt, (px, pz) => {
      if (Math.random() < 0.08) this.bloodDecal(px, pz, 0.15 + Math.random() * 0.2);
    });
    // Rain splashes and concentric puddle ripples around the camera.
    if (this.precip === "rain" && dt > 0) {
      for (let i = 0; i < 6; i++) {
        const sx = cam.x + (Math.random() - 0.5) * 30;
        const sz = cam.z + (Math.random() - 0.5) * 30;
        this.splash.spawn(sx, 0.05, sz, 0, 0.6, 0, 0.18, 0.08, RAIN_SPLASH);
        if (i === 0 && Math.random() < 0.75) {
          this.spawnRipple(sx, 0, sz, 0.32 + Math.random() * 0.24, 0.42, 0x6ea8cc);
        }
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
          if (Math.random() < 0.6) {
            _smokePos.set(e.pos.x, 2, e.pos.z);
            _smokeVel.set(0.3, 1.6, 0.1);
            this.smoke(_smokePos, { v: _smokeVel, life: 4, size: 1.1, color: 0x2a2624, opacity: 0.45 });
          }
          this.additive.spawn(e.pos.x, e.pos.y + 0.5, e.pos.z, (Math.random() - 0.5) * 0.6, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 0.6, 1.5, 0.05, EMBER, -0.3, 0.02);
        } else if (Math.random() < 0.7) {
          _smokeVel.set(0.2, 1.4, 0);
          this.smoke(e.pos, { v: _smokeVel, life: 3, size: 1.3, color: 0x8a8886, opacity: 0.25 });
        }
      }
    }

    for (const p of this.puffs) {
      if (!p.s.visible) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.s.visible = false;
        (p.s.material as THREE.SpriteMaterial).opacity = 0;
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

    for (const rp of this.ripples) {
      if (rp.t >= 1) continue;
      rp.t = Math.min(1, rp.t + dt / rp.dur);
      rp.mat.uniforms.uProgress.value = rp.t;
      const s = rp.maxR * (0.35 + rp.t * 0.65);
      rp.m.scale.setScalar(s);
      if (rp.t >= 1) rp.m.visible = false;
    }

    for (const sw of this.slashes) {
      if (sw.t >= 1) continue;
      sw.t = Math.min(1, sw.t + dt / sw.dur);
      sw.mat.uniforms.uProgress.value = sw.t;
      sw.m.position.addScaledVector(sw.v, dt);
      sw.v.multiplyScalar(Math.pow(0.22, dt));
      sw.m.scale.setScalar(sw.baseScale * (0.78 + sw.t * 0.62));
      if (sw.t >= 1) sw.m.visible = false;
    }
  }

  dispose() {
    this.rippleGeo.dispose();
    this.slashGeo.dispose();
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
  }
}
