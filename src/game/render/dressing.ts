import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Building, Zone } from "../engine/state";
import { mulberry } from "../engine/world";
import type { CityScene } from "./city";
import type { Ground } from "./crowd";

// Dressing that makes each district's streets feel inhabited and distinct:
// holographic billboards, festival lantern canopies, monastery prayer strings, and harbor work-lights.

const ADS = 4;

/** Four adverts stacked in one canvas, white on black so each board can be tinted its own neon. */
function adAtlas() {
  const W = 256;
  const H = 400;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H * ADS;
  const ctx = c.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(c);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H * ADS);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const frame = (i: number) => {
    const y = i * H;
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 6;
    ctx.strokeRect(10, y + 10, W - 20, H - 20);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    for (let s = y; s < y + H; s += 6) ctx.fillRect(0, s, W, 2);
    return y;
  };
  // 1. A great kanji in a ring.
  let y = frame(0);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(W / 2, y + 170, 90, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.font = "900 130px serif";
  ctx.fillText("侍", W / 2, y + 175);
  ctx.font = "700 34px Arial, sans-serif";
  ctx.fillText("RONIN SAKE", W / 2, y + 330);
  // 2. Noodle bar.
  y = frame(1);
  ctx.font = "900 70px Arial, sans-serif";
  ctx.fillText("RAMEN", W / 2, y + 110);
  ctx.font = "900 120px Arial, sans-serif";
  ctx.fillText("24", W / 2, y + 225);
  ctx.font = "700 40px serif";
  ctx.fillText("ラーメン", W / 2, y + 330);
  // 3. Corporate eye.
  y = frame(2);
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.ellipse(W / 2, y + 160, 95, 52, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(W / 2, y + 160, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = "800 44px Arial, sans-serif";
  ctx.fillText("OMNICORP", W / 2, y + 290);
  ctx.font = "400 22px Arial, sans-serif";
  ctx.fillText("WE SEE A BETTER CITY", W / 2, y + 335);
  // 4. Bars and a warning.
  y = frame(3);
  for (let i = 0; i < 7; i++) ctx.fillRect(40, y + 50 + i * 26, 40 + ((i * 53) % 140), 14);
  ctx.font = "900 52px Arial, sans-serif";
  ctx.fillText("CURFEW", W / 2, y + 280);
  ctx.font = "700 30px serif";
  ctx.fillText("夜間外出禁止", W / 2, y + 335);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

interface Board {
  mat: THREE.MeshBasicMaterial;
  tex: THREE.Texture;
  seed: number;
  damaged: boolean;
}

interface Lantern {
  x: number;
  y: number;
  z: number;
  seed: number;
}

export class Dressing {
  readonly group = new THREE.Group();
  private boards: Board[] = [];
  private lanterns: Lantern[] = [];
  private lanternMesh: THREE.InstancedMesh | null = null;
  private disposables: { dispose: () => void }[] = [];
  private dummy = new THREE.Object3D();

  constructor(zone: Zone, city: CityScene, ground: Ground, lowPower: boolean) {
    const keep = <T extends { dispose: () => void }>(x: T) => {
      this.disposables.push(x);
      return x;
    };
    const rnd = mulberry(zone.w * 13 + zone.nation.length * 7);
    const nation = zone.id === "memory" ? "ash" : zone.nation;

    // District-specific dressing density & colour palettes.
    const cfg: Record<
      Zone["nation"],
      {
        boards: number;
        minBoardH: number;
        boardPalette: number[];
        damagedBoards: boolean;
        cables: number;
        lanternPalette: number[];
        lanternLight: number;
      }
    > = {
      reeds: {
        boards: lowPower ? 2 : 3,
        minBoardH: 14,
        boardPalette: [0xff9438, 0x30c8a8, 0xd85a2a],
        damagedBoards: true,
        cables: lowPower ? 3 : 6,
        lanternPalette: [0xff9038, 0x58c8a8, 0xffaa44],
        lanternLight: 0xff8c38,
      },
      snow: {
        boards: 0,
        minBoardH: 99,
        boardPalette: [0xb81a24],
        damagedBoards: false,
        cables: lowPower ? 5 : 10,
        lanternPalette: [0xffb848, 0xb81a24, 0xffd078],
        lanternLight: 0xffa848,
      },
      tides: {
        boards: lowPower ? 2 : 4,
        minBoardH: 14,
        boardPalette: [0xffb038, 0x38d8c8, 0xe85a2a],
        damagedBoards: false,
        cables: lowPower ? 5 : 10,
        lanternPalette: [0xffc860, 0x38e8b0, 0xffa038],
        lanternLight: 0xffb848,
      },
      lanterns: {
        boards: lowPower ? 10 : 18,
        minBoardH: 16,
        boardPalette: [0xff2088, 0x30f0ff, 0xffb028, 0xb044ff, 0xff2848],
        damagedBoards: false,
        cables: lowPower ? 12 : 24,
        lanternPalette: [0xff2088, 0x30f0ff, 0xffaa30, 0xaa44ff, 0xff2838],
        lanternLight: 0xff3a88,
      },
      ash: {
        boards: lowPower ? 2 : 4,
        minBoardH: 18,
        boardPalette: [0xff4518, 0xc8102e, 0xff7020],
        damagedBoards: true,
        cables: 0,
        lanternPalette: [0xff4518],
        lanternLight: 0xff4518,
      },
    };
    const dc = cfg[nation];

    // ---------- Billboards ----------
    if (dc.boards > 0) {
      const atlas = keep(adAtlas());
      const cx = zone.w / 2;
      const cy = zone.h / 2;
      const tall = zone.buildings
        .filter((b) => (!b.ruined || nation === "ash") && b.height > dc.minBoardH && b.style !== "container")
        .sort(() => rnd() - 0.5);
      for (const b of tall.slice(0, dc.boards)) {
        this.billboard(b, cx, cy, atlas, rnd, city, ground, keep, dc.boardPalette, dc.damagedBoards);
      }
    }

    // ---------- Overhead lantern / work-light strings ----------
    const cables: THREE.BufferGeometry[] = [];
    const want = dc.cables;
    if (want > 0) {
      const houses = [...zone.buildings].filter((b) => b.style !== "container").sort(() => rnd() - 0.5);
      for (const a of houses) {
        if (cables.length >= want) break;
        for (const b of zone.buildings) {
          if (a === b || b.style === "container" || cables.length >= want) continue;
          const span = this.across(a, b, rnd, ground);
          if (!span) continue;
          const [p, q] = span;
          const pts: THREE.Vector3[] = [];
          const len = p.distanceTo(q);
          for (let i = 0; i <= 16; i++) {
            const t = i / 16;
            const v = p.clone().lerp(q, t);
            v.y -= len * 0.06 * 4 * t * (1 - t);
            pts.push(v);
          }
          cables.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.02, 4));
          const spacing = nation === "lanterns" ? 1.4 : 2.1;
          const n = Math.floor(len / spacing);
          for (let k = 1; k < n; k++) {
            const t = k / n;
            const v = p.clone().lerp(q, t);
            v.y -= len * 0.06 * 4 * t * (1 - t) + 0.3;
            this.lanterns.push({ x: v.x, y: v.y, z: v.z, seed: rnd() * 100 });
          }
          const mid = p.clone().lerp(q, 0.5);
          city.lights.push({
            pos: new THREE.Vector3(mid.x, mid.y - 1, mid.z),
            color: dc.lanternLight,
            intensity: nation === "lanterns" ? 18 : 14,
            distance: 14,
            flicker: 1,
            seed: Math.floor(rnd() * 999),
          });
          break;
        }
      }
    }
    if (cables.length) {
      const merged = mergeGeometries(cables);
      cables.forEach((c) => c.dispose());
      if (merged) {
        const wire = new THREE.Mesh(keep(merged), keep(new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 })));
        this.group.add(wire);
      }
    }
    if (this.lanterns.length) {
      const g = keep(new THREE.SphereGeometry(nation === "tides" ? 0.13 : 0.17, 12, 8));
      g.scale(1, nation === "tides" ? 1 : 1.35, 1);
      const m = new THREE.InstancedMesh(g, keep(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })), this.lanterns.length);
      const c = new THREE.Color();
      this.lanterns.forEach((_, i) => {
        const hex = dc.lanternPalette[i % dc.lanternPalette.length];
        m.setColorAt(i, c.set(hex).multiplyScalar(nation === "lanterns" ? 2.6 : 2.2));
      });
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.frustumCulled = false;
      this.lanternMesh = keep(m);
      this.group.add(m);
    }
  }

  /** Two buildings facing each other across a street: returns the cable's end points. */
  private across(a: Building, b: Building, rnd: () => number, ground: Ground): [THREE.Vector3, THREE.Vector3] | null {
    const h = 6 + rnd() * 3;
    if (a.height < h + 1 || b.height < h + 1) return null;
    let p: THREE.Vector3 | null = null;
    let q: THREE.Vector3 | null = null;
    const gx = b.x - (a.x + a.w);
    const lo = Math.max(a.y, b.y);
    const hi = Math.min(a.y + a.h, b.y + b.h);
    if (gx > 7 && gx < 22 && hi - lo > 3) {
      const y = lo + (hi - lo) * (0.2 + rnd() * 0.6);
      p = new THREE.Vector3(a.x + a.w, h, y);
      q = new THREE.Vector3(b.x, h + (rnd() - 0.5), y);
    } else {
      const gy = b.y - (a.y + a.h);
      const lx = Math.max(a.x, b.x);
      const hx = Math.min(a.x + a.w, b.x + b.w);
      if (gy > 7 && gy < 22 && hx - lx > 3) {
        const x = lx + (hx - lx) * (0.2 + rnd() * 0.6);
        p = new THREE.Vector3(x, h, a.y + a.h);
        q = new THREE.Vector3(x, h + (rnd() - 0.5), b.y);
      }
    }
    if (!p || !q) return null;
    for (let t = 0.15; t < 0.9; t += 0.15) {
      const v = p.clone().lerp(q, t);
      if (!ground.free(v.x, v.z, 0, true)) return null;
    }
    return [p, q];
  }

  private billboard(
    b: Building,
    cx: number,
    cy: number,
    atlas: THREE.Texture,
    rnd: () => number,
    city: CityScene,
    ground: Ground,
    keep: <T extends { dispose: () => void }>(x: T) => T,
    palette: number[],
    damaged: boolean,
  ) {
    const bx = b.x + b.w / 2;
    const by = b.y + b.h / 2;
    const dx = cx - bx;
    const dy = cy - by;
    const xSide = Math.abs(dx) / b.w > Math.abs(dy) / b.h;
    const nx = xSide ? Math.sign(dx) || 1 : 0;
    const ny = xSide ? 0 : Math.sign(dy) || 1;
    const faceW = xSide ? b.h : b.w;
    const w = Math.min(faceW * 0.65, 8.5);
    if (w < 3.4) return;
    const hgt = w * 1.56;
    const cyH = Math.min(b.height - hgt / 2 - 1, 9 + hgt / 2 + rnd() * 6);
    if (cyH - hgt / 2 < 4.5) return;
    const px = bx + nx * (b.w / 2 + 0.22);
    const pz = by + ny * (b.h / 2 + 0.22);
    if (!ground.free(px + nx * 4, pz + ny * 4, 0.5)) return;
    const tex = keep(atlas.clone());
    tex.repeat.set(1, 1 / ADS);
    tex.needsUpdate = true;
    const tint = palette[Math.floor(rnd() * palette.length)];
    const mat = keep(new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(tint).multiplyScalar(1.85), transparent: true, opacity: 0.95, toneMapped: false }));
    const plane = new THREE.Mesh(keep(new THREE.PlaneGeometry(w, hgt)), mat);
    plane.position.set(px, cyH, pz);
    plane.rotation.y = Math.atan2(nx, ny);
    this.group.add(plane);
    const frame = new THREE.Mesh(keep(new THREE.BoxGeometry(w + 0.4, hgt + 0.4, 0.25)), keep(new THREE.MeshStandardMaterial({ color: 0x141416, metalness: 0.7, roughness: 0.5 })));
    frame.position.set(px - nx * 0.14, cyH, pz - ny * 0.14);
    frame.rotation.y = plane.rotation.y;
    this.group.add(frame);
    this.boards.push({ mat, tex, seed: Math.floor(rnd() * 1000), damaged });
    city.lights.push({ pos: new THREE.Vector3(px + nx * 3, Math.min(cyH, 8), pz + ny * 3), color: tint, intensity: 28, distance: 22, flicker: damaged ? 2 : 0, seed: b.seed });
  }

  update(time: number) {
    for (const b of this.boards) {
      const slot = time / 5 + b.seed * 0.37;
      const frame = Math.floor(slot) % ADS;
      b.tex.offset.y = 1 - (frame + 1) / ADS;
      const edge = slot % 1;
      const glitchThresh = b.damaged ? 0.93 : 0.995;
      const glitch = edge < 0.04 || Math.sin(time * 37 + b.seed) > glitchThresh;
      b.mat.opacity = glitch ? (b.damaged ? 0.12 : 0.3) + Math.random() * 0.4 : 0.92 + Math.sin(time * 4 + b.seed) * 0.04;
      b.tex.offset.x = glitch ? (Math.random() - 0.5) * 0.06 : 0;
    }
    const m = this.lanternMesh;
    if (m) {
      const d = this.dummy;
      this.lanterns.forEach((l, i) => {
        const sway = Math.sin(time * 1.4 + l.seed) * 0.08;
        d.position.set(l.x + sway * 0.6, l.y, l.z + sway);
        d.rotation.set(sway, 0, sway * 0.6);
        d.updateMatrix();
        m.setMatrixAt(i, d.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
    }
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}
