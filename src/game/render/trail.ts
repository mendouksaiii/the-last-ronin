import * as THREE from "three";
import type { GearParts } from "./rig";

// A fading ribbon behind a swinging weapon, sampled from its base and tip each frame.

const N = 14;
const LIFE = 0.16;

export class Trail {
  mesh: THREE.Mesh;
  private pos = new Float32Array(N * 2 * 3);
  private alpha = new Float32Array(N * 2);
  private samples: { a: THREE.Vector3; b: THREE.Vector3; age: number }[] = [];
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
  }

  update(dt: number, gear: GearParts | null, active: boolean, color: number) {
    for (const s of this.samples) s.age += dt;
    this.samples = this.samples.filter((s) => s.age < LIFE);
    if (active && gear && dt > 0) {
      gear.base.getWorldPosition(this.va);
      gear.tip.getWorldPosition(this.vb);
      this.samples.unshift({ a: this.va.clone(), b: this.vb.clone(), age: 0 });
      if (this.samples.length > N) this.samples.length = N;
    }
    this.mat.uniforms.color.value.set(color);
    const n = this.samples.length;
    this.mesh.visible = n > 1;
    if (n < 2) return;
    for (let i = 0; i < N; i++) {
      const s = this.samples[Math.min(i, n - 1)];
      this.pos.set([s.a.x, s.a.y, s.a.z], i * 6);
      this.pos.set([s.b.x, s.b.y, s.b.z], i * 6 + 3);
      const k = i < n ? (1 - s.age / LIFE) * (1 - i / N) : 0;
      this.alpha[i * 2] = k * 0.1;
      this.alpha[i * 2 + 1] = k * 0.75;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.alpha.needsUpdate = true;
  }
}
