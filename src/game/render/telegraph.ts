import * as THREE from "three";
import type { Enemy } from "../engine/state";

// Ground markings that warn of an enemy attack while it winds up: a cone, a slam circle or a
// charge lane. Red can be parried or blocked; pulsing orange is perilous and must be dodged.

const RED = new THREE.Color(1.6, 0.06, 0.1);
const ORANGE = new THREE.Color(2.4, 0.7, 0.12);

export class Telegraph {
  group = new THREE.Group();
  private outline: THREE.Mesh;
  private fill: THREE.Mesh;
  private key = "";
  private outMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });
  private fillMat = this.outMat.clone();
  private stretch = false;

  constructor() {
    this.outline = new THREE.Mesh(new THREE.BufferGeometry(), this.outMat);
    this.fill = new THREE.Mesh(new THREE.BufferGeometry(), this.fillMat);
    this.outline.position.y = 0.04;
    this.fill.position.y = 0.05;
    this.group.add(this.outline, this.fill);
    this.group.visible = false;
  }

  private shape(e: Enemy) {
    const a = e.atk;
    const r = e.radius;
    switch (a.k) {
      case "cone":
        return { key: `c${a.range}:${a.half}`, geo: new THREE.CircleGeometry((a.range ?? 2.3) + r, 28, -(a.half ?? 0.8), (a.half ?? 0.8) * 2), stretch: false };
      case "slam":
        return { key: `s${a.r}`, geo: new THREE.CircleGeometry(a.r ?? 2.6, 40), stretch: false };
      case "charge": {
        const len = (a.dist ?? 4.8) + r;
        const g = new THREE.PlaneGeometry(len, a.width ?? 0.9);
        g.translate(len / 2, 0, 0);
        return { key: `h${len}:${a.width}`, geo: g, stretch: true };
      }
      case "shots":
        if (!e.boss) return null;
        return { key: `p${a.reach}:${a.spread}`, geo: new THREE.CircleGeometry(a.reach, 28, -((a.spread ?? 0) / 2 + 0.06), (a.spread ?? 0) + 0.12), stretch: false };
      case "summon":
      case "decoys":
      case "guard":
        return { key: `r`, geo: new THREE.RingGeometry(1.4, 1.6, 40), stretch: false };
    }
  }

  /** k is the windup progress 0..1, or below 0 to hide. */
  update(e: Enemy, k: number, time: number) {
    if (k < 0 || e.state === "dead") {
      this.group.visible = false;
      return;
    }
    const s = this.shape(e);
    if (!s) {
      this.group.visible = false;
      return;
    }
    if (s.key !== this.key) {
      this.key = s.key;
      this.outline.geometry.dispose();
      this.outline.geometry = s.geo;
      this.fill.geometry = s.geo;
      this.stretch = s.stretch;
      this.outline.rotation.x = this.fill.rotation.x = -Math.PI / 2;
    } else s.geo.dispose();
    this.group.visible = true;
    this.group.position.set(e.x, 0, e.y);
    this.group.rotation.y = -e.aim;
    const perilous = !!e.atk.perilous;
    const c = perilous ? ORANGE : RED;
    const pulse = perilous ? 0.6 + Math.sin(time * 24) * 0.4 : 1;
    this.outMat.color.copy(c);
    this.outMat.opacity = 0.18 * pulse;
    this.fillMat.color.copy(c);
    this.fillMat.opacity = (0.2 + k * 0.35) * pulse;
    const f = Math.max(0.02, k);
    if (this.stretch) this.fill.scale.set(f, 1, 1);
    else this.fill.scale.set(f, f, 1);
  }
}
