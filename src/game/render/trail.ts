import * as THREE from "three";
import type { GearParts } from "./rig";

// A fading ribbon behind a swinging weapon, sampled from its base and tip each frame.

const N = 14;
const LIFE = 0.16;

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
  private alpha = new Float32Array(N * 2);
  private samples: Sample[] = Array.from({ length: N }, () => ({ ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0, age: LIFE }));
  private count = 0;
  private mat: THREE.ShaderMaterial;
  private va = new THREE.Vector3();
  private vb = new THREE.Vector3();

  constructor() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute("alpha", new THREE.BufferAttribute(this.alpha, 1));
    const idx: number[] = [];
    for (let i = 0; i < N - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    g.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color(0xffffff) } },
      vertexShader: `attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 color; varying float vA; void main(){ gl_FragColor = vec4(color * 2.2, vA); }`,
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

  update(dt: number, gear: GearParts | null, active: boolean, color: number) {
    // Advance ages and drop expired tail samples in place.
    for (let i = 0; i < this.count; i++) {
      this.samples[i].age += dt;
    }
    while (this.count > 0 && this.samples[this.count - 1].age >= LIFE) {
      this.count--;
    }

    if (active && gear && dt > 0) {
      gear.base.getWorldPosition(this.va);
      gear.tip.getWorldPosition(this.vb);
      const nextCount = Math.min(N, this.count + 1);
      const reused = this.samples[Math.min(nextCount - 1, N - 1)];
      for (let i = nextCount - 1; i > 0; i--) {
        this.samples[i] = this.samples[i - 1];
      }
      reused.ax = this.va.x;
      reused.ay = this.va.y;
      reused.az = this.va.z;
      reused.bx = this.vb.x;
      reused.by = this.vb.y;
      reused.bz = this.vb.z;
      reused.age = 0;
      this.samples[0] = reused;
      this.count = nextCount;
    }

    const n = this.count;
    this.mesh.visible = n > 1;
    if (n < 2) return;

    this.mat.uniforms.color.value.set(color);
    for (let i = 0; i < N; i++) {
      const s = this.samples[i < n ? i : n - 1];
      const pIdx = i * 6;
      this.pos[pIdx] = s.ax;
      this.pos[pIdx + 1] = s.ay;
      this.pos[pIdx + 2] = s.az;
      this.pos[pIdx + 3] = s.bx;
      this.pos[pIdx + 4] = s.by;
      this.pos[pIdx + 5] = s.bz;
      const k = i < n ? (1 - s.age / LIFE) * (1 - i / N) : 0;
      this.alpha[i * 2] = k * 0.1;
      this.alpha[i * 2 + 1] = k * 0.75;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.alpha.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
