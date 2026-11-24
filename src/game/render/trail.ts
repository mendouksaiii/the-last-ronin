import * as THREE from "three";
import type { GearParts } from "./rig";

// A Ghost-of-Tsushima–style dual-tone brush-stroke weapon ribbon with curved arc interpolation.

const N = 28;
const LIFE = 0.22;

interface Sample {
  ax: number;
  ay: number;
  az: number;
  bx: number;
  by: number;
  bz: number;
  age: number;
}

export class Trail {
  mesh: THREE.Mesh;
  private pos = new Float32Array(N * 2 * 3);
  private uv = new Float32Array(N * 2 * 2);
  private samples: Sample[] = Array.from({ length: N }, () => ({ ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0, age: LIFE }));
  private count = 0;
  private mat: THREE.ShaderMaterial;
  private time = 0;
  private va = new THREE.Vector3();
  private vb = new THREE.Vector3();
  private ma = new THREE.Vector3();
  private mb = new THREE.Vector3();
  private prevDir = new THREE.Vector3();
  private curDir = new THREE.Vector3();
  private midDir = new THREE.Vector3();

  constructor() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(this.uv, 2));
    const idx: number[] = [];
    for (let i = 0; i < N - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    g.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0xffffff) },
        uAura: { value: new THREE.Color(0x5098ff) },
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 uColor;
        uniform vec3 uAura;
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          float head = clamp(1.0 - vUv.x, 0.0, 1.0);
          float tailFade = pow(max(0.0001, head), 1.35) * smoothstep(0.0, 0.05, vUv.x + 0.03);
          float across = vUv.y;
          // Painterly brush streaks along blade sweep
          float brush = 0.78 + 0.22 * sin(across * 36.0 - vUv.x * 9.0 + uTime * 22.0) * sin(across * 17.0 + vUv.x * 5.0);
          // Razor-hot steel edge core + glowing aura body
          float core = smoothstep(0.76, 0.98, across);
          float edgeSoft = smoothstep(0.02, 0.24, across) * (1.0 - smoothstep(0.975, 1.0, across) * 0.25);
          vec3 col = mix(uAura * 1.45, uColor * 2.4, smoothstep(0.35, 0.85, across));
          col = mix(col, vec3(2.9, 2.95, 3.0), core * (0.45 + 0.55 * head));
          float alpha = tailFade * edgeSoft * mix(0.28, 0.94, pow(max(0.0001, across), 1.15)) * brush;
          if (alpha < 0.008) discard;
          gl_FragColor = vec4(col, alpha);
        }`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  private pushSample(ax: number, ay: number, az: number, bx: number, by: number, bz: number, age: number) {
    const nextCount = Math.min(N, this.count + 1);
    const reused = this.samples[Math.min(nextCount - 1, N - 1)];
    for (let i = nextCount - 1; i > 0; i--) {
      this.samples[i] = this.samples[i - 1];
    }
    reused.ax = ax;
    reused.ay = ay;
    reused.az = az;
    reused.bx = bx;
    reused.by = by;
    reused.bz = bz;
    reused.age = age;
    this.samples[0] = reused;
    this.count = nextCount;
  }

  update(dt: number, gear: GearParts | null, active: boolean, color: number, auraColor?: number) {
    this.time += dt;
    for (let i = 0; i < this.count; i++) {
      this.samples[i].age += dt;
    }
    while (this.count > 0 && this.samples[this.count - 1].age >= LIFE) {
      this.count--;
    }

    if (active && gear && dt > 0) {
      gear.base.getWorldPosition(this.va);
      gear.tip.getWorldPosition(this.vb);
      if (this.count > 0) {
        const prev = this.samples[0];
        const dx = this.vb.x - prev.bx;
        const dy = this.vb.y - prev.by;
        const dz = this.vb.z - prev.bz;
        const jump = Math.hypot(dx, dy, dz);
        // Subdivide wide swing steps along weapon radius so fast arcs stay silky curved.
        if (jump > 0.16 && jump < 2.8) {
          this.prevDir.set(prev.bx - prev.ax, prev.by - prev.ay, prev.bz - prev.az);
          this.curDir.set(this.vb.x - this.va.x, this.vb.y - this.va.y, this.vb.z - this.va.z);
          const len = (this.prevDir.length() + this.curDir.length()) * 0.5;
          if (len > 0.05) {
            this.ma.set((prev.ax + this.va.x) * 0.5, (prev.ay + this.va.y) * 0.5, (prev.az + this.va.z) * 0.5);
            this.midDir.addVectors(this.prevDir, this.curDir).normalize().multiplyScalar(len);
            this.mb.copy(this.ma).add(this.midDir);
            this.pushSample(this.ma.x, this.ma.y, this.ma.z, this.mb.x, this.mb.y, this.mb.z, dt * 0.5);
          }
        }
      }
      this.pushSample(this.va.x, this.va.y, this.va.z, this.vb.x, this.vb.y, this.vb.z, 0);
    }

    const n = this.count;
    this.mesh.visible = n > 1;
    if (n < 2) return;

    this.mat.uniforms.uColor.value.set(color);
    if (auraColor !== undefined) {
      this.mat.uniforms.uAura.value.set(auraColor);
    } else {
      this.mat.uniforms.uAura.value.set(color).multiplyScalar(0.65);
    }
    this.mat.uniforms.uTime.value = this.time;

    for (let i = 0; i < N; i++) {
      const s = this.samples[i < n ? i : n - 1];
      const pIdx = i * 6;
      this.pos[pIdx] = s.ax;
      this.pos[pIdx + 1] = s.ay;
      this.pos[pIdx + 2] = s.az;
      this.pos[pIdx + 3] = s.bx;
      this.pos[pIdx + 4] = s.by;
      this.pos[pIdx + 5] = s.bz;
      const u = i < n ? Math.min(1, Math.max(i / (n - 1), s.age / LIFE)) : 1;
      const uIdx = i * 4;
      this.uv[uIdx] = u;
      this.uv[uIdx + 1] = 0;
      this.uv[uIdx + 2] = u;
      this.uv[uIdx + 3] = 1;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.uv.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
