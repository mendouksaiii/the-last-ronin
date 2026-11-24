import * as THREE from "three";

// Fluid cloth simulation for cloaks and shoulder rags:
// Coupled multi-row angular spring chain with sub-stepped integration, arc-length preservation,
// traveling wind ripples, turn whip, and stride kick. Zero per-frame allocations.

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
  /** Extra outward clearance along -z at mid-back (e.g. over a turtle carapace). */
  archBack?: number;
}

const COLS = 28;
const ROWS = 18;
const smooth = (a: number, b: number, x: number) => {
  const k = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);

export class Cape {
  readonly mesh: THREE.Mesh;
  private geo: THREE.BufferGeometry;
  private base: Float32Array;
  private vFrac: Float32Array;
  private rowIdx: Uint8Array;
  private angle: Float32Array;
  private tatterY: Float32Array;
  private segLen: number;

  // Per-row coupled cloth state (row 0 = pinned collar, row ROWS = free hem).
  private rowDrag = new Float32Array(ROWS + 1);
  private rowDragV = new Float32Array(ROWS + 1);
  private rowSide = new Float32Array(ROWS + 1);
  private rowSideV = new Float32Array(ROWS + 1);
  private rowLift = new Float32Array(ROWS + 1);
  private rowLiftV = new Float32Array(ROWS + 1);
  private cumX = new Float32Array(ROWS + 1);
  private cumY = new Float32Array(ROWS + 1);
  private cumZ = new Float32Array(ROWS + 1);

  private time = 0;
  private prev = new THREE.Vector3();
  private prevYaw = 0;
  private started = false;
  private speed = 0;

  constructor(spec: CapeSpec, material: THREE.Material) {
    let s = spec.seed * 9301 + 49297;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const ragged: number[] = [];
    for (let j = 0; j <= COLS; j++) {
      const edge = Math.abs(j / COLS - 0.5) * 2;
      ragged.push(rnd() * spec.tatter * (0.65 + edge * 0.55));
    }
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const vFrac: number[] = [];
    const rowIdx: number[] = [];
    const angle: number[] = [];
    const tatterY: number[] = [];
    const arch = spec.archBack ?? 0;
    this.segLen = spec.length / ROWS;

    for (let i = 0; i <= ROWS; i++) {
      const v = i / ROWS;
      const shoulderCurve = smooth(0, 0.22, v);
      const r =
        spec.rNeck +
        (spec.rShoulder - spec.rNeck) * shoulderCurve +
        (spec.rHem - spec.rShoulder) * Math.max(0, (v - 0.22) / 0.78);
      const wrap = spec.wrapNeck + (spec.wrapBody - spec.wrapNeck) * smooth(0.04, 0.28, v);
      const backBulge = arch * Math.sin(Math.min(1, v / 0.78) * Math.PI);
      for (let j = 0; j <= COLS; j++) {
        const u = j / COLS;
        const th = Math.PI - wrap / 2 + u * wrap;
        const backness = Math.max(0, -Math.cos(th));
        // Natural vertical drapery pleats deepening softly toward the hem.
        const fold = 1 + (Math.sin(u * Math.PI * 12) * 0.03 + Math.cos(u * Math.PI * 6) * 0.015) * smooth(0.1, 1, v);
        const tat = i === ROWS ? ragged[j] : i === ROWS - 1 ? ragged[j] * 0.45 : 0;
        const y = -v * spec.length + tat;
        const px = Math.sin(th) * r * spec.sx * fold;
        const pz = Math.cos(th) * r * fold - backBulge * backness;
        pos.push(px, y, pz);
        uv.push(u * 3, 1 - v);
        vFrac.push(v);
        rowIdx.push(i);
        angle.push(th);
        tatterY.push(tat);
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
    this.vFrac = new Float32Array(vFrac);
    this.rowIdx = new Uint8Array(rowIdx);
    this.angle = new Float32Array(angle);
    this.tatterY = new Float32Array(tatterY);
    this.mesh = new THREE.Mesh(this.geo, material);
    this.mesh.position.set(0, spec.top, spec.cz);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
  }

  /** Steps the coupled multi-row cloth simulation from 3D world position, heading, stride, and spine pitch. */
  update(dt: number, at: THREE.Vector3, yaw: number, stride: number, bodyPitch = 0, bodyY = 0.95) {
    if (dt <= 0) return;
    this.time += dt;
    if (!this.started) {
      this.prev.copy(at);
      this.prevYaw = yaw;
      this.started = true;
    }
    const dx = at.x - this.prev.x;
    const dy = at.y - this.prev.y;
    const dz = at.z - this.prev.z;
    this.prev.copy(at);
    const turn = Math.atan2(Math.sin(yaw - this.prevYaw), Math.cos(yaw - this.prevYaw)) / dt;
    this.prevYaw = yaw;

    // Velocity in the body's frame (forward = +z, right = -x for a model facing +z, plus vertical velocity vy).
    const vx = dx / dt;
    const vy = Math.abs(dy / dt) > 28 ? 0 : dy / dt;
    const vz = dz / dt;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    let fwd = vx * s + vz * c;
    let lat = vx * c - vz * s;
    if (Math.hypot(fwd, lat) > 22) fwd = lat = 0;
    const targetSpeed = Math.hypot(fwd, lat) + Math.abs(vy) * 0.45;
    this.speed += (targetSpeed - this.speed) * (1 - Math.exp(-dt * 10));

    // Downward velocity creates upward airflow; backward torso tilt (slide/getup) offsets local drag so cloth trails backward in world space.
    const upDraft = clamp(-vy * 0.082, -0.18, 0.9);
    const leanComp = bodyPitch < -0.25 ? clamp(-bodyPitch - 0.12, 0, 1.35) : 0;
    const maxDrag = 1.34 + leanComp;

    // Two substeps keep the coupled chain crisp and responsive at any frame rate.
    const steps = 2;
    const h = Math.min(dt, 1 / 30) / steps;
    const t = this.time;

    for (let step = 0; step < steps; step++) {
      for (let i = 1; i <= ROWS; i++) {
        const v = i / ROWS;
        const gust = Math.sin(t * 2.4 - v * 2.6) * 0.035 + Math.cos(t * 4.1 - v * 3.8) * 0.02;
        const worldDrag = clamp(
          fwd * (0.145 + v * 0.065) + Math.max(0, upDraft) * (0.35 + v * 0.62) + gust * (0.35 + v * 0.8),
          -0.18,
          1.32,
        );
        const dragTarget = clamp(worldDrag + leanComp * (0.65 + v * 0.3), -0.18, maxDrag);
        const sideTarget = clamp(lat * (0.12 + v * 0.06) - turn * (0.08 + v * 0.18), -0.92, 0.92);
        const liftTarget = clamp(this.speed * 0.036 + Math.max(0, upDraft) * 0.24 + Math.abs(turn) * 0.026, 0, 0.46);

        // Coupled follow-through: each row tracks the row above it plus gravity return, giving fluid S-waves.
        const prevD = this.rowDrag[i - 1];
        const prevS = this.rowSide[i - 1];
        const prevL = this.rowLift[i - 1];
        const follow = 58 - v * 24;
        const restore = 26 - v * 10;
        const damp = 7.4 - v * 1.4;

        const aD = (prevD - this.rowDrag[i]) * follow + (dragTarget - this.rowDrag[i]) * restore - this.rowDragV[i] * damp;
        const aS = (prevS - this.rowSide[i]) * follow + (sideTarget - this.rowSide[i]) * restore - this.rowSideV[i] * damp;
        const aL = (prevL - this.rowLift[i]) * 44 + (liftTarget - this.rowLift[i]) * 24 - this.rowLiftV[i] * 6.8;

        this.rowDragV[i] += aD * h;
        this.rowDrag[i] = clamp(this.rowDrag[i] + this.rowDragV[i] * h, v < 0.55 ? -0.05 : -0.22, maxDrag);

        this.rowSideV[i] += aS * h;
        this.rowSide[i] = clamp(this.rowSide[i] + this.rowSideV[i] * h, -0.95, 0.95);

        this.rowLiftV[i] += aL * h;
        this.rowLift[i] = clamp(this.rowLift[i] + this.rowLiftV[i] * h, 0, 0.48);
      }
    }

    // Arc-length-preserving spine integration from shoulder collar down to hem, keeping hem above ground level.
    this.cumX[0] = 0;
    this.cumY[0] = 0;
    this.cumZ[0] = 0;
    const seg = this.segLen;
    const cosP = Math.cos(bodyPitch);
    const sinP = Math.sin(bodyPitch);
    const collarH = bodyY + cosP * this.mesh.position.y - sinP * this.mesh.position.z;
    for (let i = 1; i <= ROWS; i++) {
      const pitch = this.rowDrag[i];
      const roll = this.rowSide[i];
      const dirZ = -Math.sin(pitch);
      const dirX = -Math.sin(roll);
      const dirY = -Math.cos(pitch) * Math.cos(roll * 0.65);
      const invLen = seg / Math.hypot(dirX, dirY, dirZ);
      const nx = this.cumX[i - 1] + dirX * invLen;
      let ny = this.cumY[i - 1] + dirY * invLen;
      let nz = this.cumZ[i - 1] + dirZ * invLen;
      const worldRelY = collarH + cosP * ny - sinP * nz;
      if (worldRelY < 0.08) {
        const lift = 0.08 - worldRelY;
        ny += lift * cosP;
        nz -= lift * sinP;
      }
      this.cumX[i] = nx;
      this.cumY[i] = ny;
      this.cumZ[i] = nz;
    }

    const p = this.geo.attributes.position as THREE.BufferAttribute;
    const arr = p.array as Float32Array;
    const speedK = Math.min(1, this.speed / 5.5);
    const windAmp = 0.015 + speedK * 0.044;

    for (let n = 0; n < this.rowIdx.length; n++) {
      const i = this.rowIdx[n];
      const v = this.vFrac[n];
      const w = Math.pow(v, 1.25);
      const bx = this.base[n * 3];
      const bz = this.base[n * 3 + 2];
      const th = this.angle[n];

      // Traveling fluid waves propagating downward from the shoulders to the hem.
      const waveA = Math.sin(t * (5.8 + speedK * 4.2) - v * 6.4 + th * 3.2);
      const waveB = Math.cos(t * (9.2 + speedK * 5.0) - v * 9.5 - th * 4.5);
      const flut = windAmp * w * (waveA * 0.65 + waveB * 0.35);
      const kick = stride * w * 0.068 * Math.sin(th);
      const lift = this.rowLift[i] * w;

      arr[n * 3] = bx * (1 + lift * 0.6) + this.cumX[i] + flut + kick;
      arr[n * 3 + 1] = this.cumY[i] + this.tatterY[n] + flut * 0.25 * Math.sin(this.rowDrag[i]);
      arr[n * 3 + 2] = bz * (1 + lift * 0.38) + this.cumZ[i] + waveB * windAmp * w * 0.85;
    }

    p.needsUpdate = true;
    this.geo.computeVertexNormals();
  }

  dispose() {
    this.geo.dispose();
  }
}
