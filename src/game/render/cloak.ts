import * as THREE from "three";

// Cloth that hangs from the shoulders and moves with the body: it trails behind when running,
// swings out on turns, overshoots and settles when the wearer stops, and flutters in the wind.
// The mesh is a tapered, partly open tube (open at the front) deformed on the CPU each frame.

export interface CapeSpec {
  /** Height of the neckline in torso space. */
  top: number;
  length: number;
  /** Radius at the neck, across the shoulders and at the hem. */
  rNeck: number;
  rShoulder: number;
  rHem: number;
  /** Horizontal stretch (wider than deep). */
  sx: number;
  /** Centre offset towards the back (negative z). */
  cz: number;
  /** Angle the cloth wraps round the body at the neck and lower down (radians). */
  wrapNeck: number;
  wrapBody: number;
  /** How ragged the hem is, in metres. */
  tatter: number;
  seed: number;
}

const COLS = 22;
const ROWS = 12;
const smooth = (a: number, b: number, x: number) => {
  const k = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

export class Cape {
  readonly mesh: THREE.Mesh;
  private geo: THREE.BufferGeometry;
  private base: Float32Array;
  /** Per vertex: hang weight (0 at the neck, 1 at the hem) and distance below the neck. */
  private weight: Float32Array;
  private angle: Float32Array;
  private drag = 0;
  private dragV = 0;
  private side = 0;
  private sideV = 0;
  private time = 0;
  private prev = new THREE.Vector3();
  private prevYaw = 0;
  private started = false;
  private speed = 0;

  constructor(spec: CapeSpec, material: THREE.Material) {
    let s = spec.seed * 9301 + 49297;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const ragged: number[] = [];
    for (let j = 0; j <= COLS; j++) ragged.push(rnd() * spec.tatter);
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const weight: number[] = [];
    const angle: number[] = [];
    for (let i = 0; i <= ROWS; i++) {
      const v = i / ROWS;
      const r = spec.rNeck + (spec.rShoulder - spec.rNeck) * smooth(0, 0.2, v) + (spec.rHem - spec.rShoulder) * Math.max(0, (v - 0.2) / 0.8);
      const wrap = spec.wrapNeck + (spec.wrapBody - spec.wrapNeck) * smooth(0.03, 0.25, v);
      for (let j = 0; j <= COLS; j++) {
        const u = j / COLS;
        const th = Math.PI - wrap / 2 + u * wrap;
        // The hem is ragged; folds ripple the surface lengthwise.
        const fold = 1 + Math.sin(u * Math.PI * 9) * 0.035 * smooth(0.15, 1, v);
        const y = -v * spec.length + (i === ROWS ? ragged[j] : i === ROWS - 1 ? ragged[j] * 0.4 : 0);
        pos.push(Math.sin(th) * r * spec.sx * fold, y, Math.cos(th) * r * fold);
        uv.push(u * 3, 1 - v);
        weight.push(Math.pow(v, 1.35));
        angle.push(th);
      }
    }
    for (let i = 0; i < ROWS; i++) {
      for (let j = 0; j < COLS; j++) {
        const a = i * (COLS + 1) + j;
        const b = a + COLS + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    this.geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    this.geo.setIndex(idx);
    this.geo.computeVertexNormals();
    this.base = new Float32Array(pos);
    this.weight = new Float32Array(weight);
    this.angle = new Float32Array(angle);
    this.mesh = new THREE.Mesh(this.geo, material);
    this.mesh.position.set(0, spec.top, spec.cz);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
  }

  /** Steps the cloth from the wearer's world position and heading. */
  update(dt: number, at: THREE.Vector3, yaw: number, stride: number) {
    if (dt <= 0) return;
    this.time += dt;
    if (!this.started) {
      this.prev.copy(at);
      this.prevYaw = yaw;
      this.started = true;
    }
    const dx = at.x - this.prev.x;
    const dz = at.z - this.prev.z;
    this.prev.copy(at);
    const turn = Math.atan2(Math.sin(yaw - this.prevYaw), Math.cos(yaw - this.prevYaw)) / dt;
    this.prevYaw = yaw;
    // Velocity in the body's frame (forward = +z, right = -x for a model facing +z).
    const vx = dx / dt;
    const vz = dz / dt;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    let fwd = vx * s + vz * c;
    let lat = vx * c - vz * s;
    // Teleports (zone changes, respawns) must not fling the cloth.
    if (Math.hypot(fwd, lat) > 20) fwd = lat = 0;
    this.speed += (Math.hypot(fwd, lat) - this.speed) * (1 - Math.exp(-dt * 6));

    // Damped springs: the cloth lags behind, overshoots a little and settles.
    const dragT = Math.max(-0.25, Math.min(0.85, fwd * 0.12));
    const sideT = Math.max(-0.6, Math.min(0.6, lat * 0.09 - turn * 0.09));
    const k = 55;
    const damp = 7.5;
    const h = Math.min(dt, 1 / 30);
    this.dragV += ((dragT - this.drag) * k - this.dragV * damp) * h;
    this.drag += this.dragV * h;
    this.sideV += ((sideT - this.side) * k - this.sideV * damp) * h;
    this.side += this.sideV * h;

    const p = this.geo.attributes.position as THREE.BufferAttribute;
    const arr = p.array as Float32Array;
    const t = this.time;
    const gust = 0.012 + Math.min(1, this.speed / 5) * 0.03;
    for (let n = 0; n < this.weight.length; n++) {
      const w = this.weight[n];
      const bx = this.base[n * 3];
      const by = this.base[n * 3 + 1];
      const bz = this.base[n * 3 + 2];
      const d = -by;
      const th = this.angle[n];
      const flut = gust * w;
      // Each step kicks the hem out a touch on the side of the leg that moves.
      const kick = stride * w * 0.05 * Math.sin(th);
      const swing = this.drag * w;
      arr[n * 3] = bx - this.side * d * w + Math.sin(t * 7.1 + th * 4 + by * 5) * flut + kick;
      arr[n * 3 + 1] = by + swing * swing * d * 0.45 + Math.abs(this.side) * w * d * 0.2;
      arr[n * 3 + 2] = bz - swing * d + Math.cos(t * 6.3 + th * 3 + by * 4) * flut;
    }
    p.needsUpdate = true;
    this.geo.computeVertexNormals();
  }

  dispose() {
    this.geo.dispose();
  }
}
