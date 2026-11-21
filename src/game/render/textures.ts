import * as THREE from "three";
import type { Zone } from "../engine/state";
import { mulberry } from "../engine/world";

// Procedural PBR textures for the city and characters: brick and concrete facades, wet asphalt,
// tiled surface detail (normal maps), neon signs and soft particles.

const canvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D is not available");
  return { c, ctx };
};

const rgb = (r: number, g: number, b: number, a = 1) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
const grey = (v: number, a = 1) => rgb(v, v, v, a);

/** Builds a tangent-space normal map from a greyscale height canvas (wrapping at the edges). */
function normalFromHeight(src: HTMLCanvasElement, strength: number, wrap = true) {
  const w = src.width;
  const h = src.height;
  const sctx = src.getContext("2d", { willReadFrequently: true });
  if (!sctx) throw new Error("Canvas 2D is not available");
  const hd = sctx.getImageData(0, 0, w, h).data;
  const out = canvas(w, h);
  const img = out.ctx.createImageData(w, h);
  const d = img.data;
  const at = (x: number, y: number) => {
    if (wrap) {
      x = (x + w) % w;
      y = (y + h) % h;
    } else {
      x = Math.max(0, Math.min(w - 1, x));
      y = Math.max(0, Math.min(h - 1, y));
    }
    return hd[(y * w + x) * 4] / 255;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      d[i] = (-dx / len) * 127.5 + 127.5;
      d[i + 1] = (dy / len) * 127.5 + 127.5;
      d[i + 2] = (1 / len) * 127.5 + 127.5;
      d[i + 3] = 255;
    }
  }
  out.ctx.putImageData(img, 0, 0);
  return out.c;
}

const colorTex = (c: HTMLCanvasElement, aniso = 8) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
};
const dataTex = (c: HTMLCanvasElement, aniso = 8) => {
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = aniso;
  return t;
};
const repeat = <T extends THREE.Texture>(t: T, x = 1, y = x) => {
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(x, y);
  return t;
};

/** Sprinkles soft noise blobs over a height canvas. */
function noise(ctx: CanvasRenderingContext2D, w: number, h: number, rnd: () => number, count: number, size: [number, number], spread: [number, number]) {
  for (let i = 0; i < count; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = size[0] + rnd() * (size[1] - size[0]);
    ctx.fillStyle = grey(spread[0] + rnd() * (spread[1] - spread[0]), 0.35 + rnd() * 0.4);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------- Facades ----------

/** Facade tiles: 8 columns by 8 floors of windows, about 32 m by 28 m of wall. */
export const FACADE_W = 32;
export const FACADE_H = 28;

export interface FacadeSet {
  map: THREE.CanvasTexture;
  emissive: THREE.CanvasTexture;
  normal: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
}

export type FacadeKind = "brick" | "concrete" | "brownstone" | "limestone" | "glass" | "corrugated" | "gothic";

/** A brick, brownstone, concrete, corrugated metal or gothic stone wall with windows and surface detail. */
export function facadeTextures(kind: FacadeKind): FacadeSet {
  if (kind === "glass") return glassTextures();
  if (kind === "corrugated") return corrugatedTextures();
  if (kind === "gothic") return gothicTextures();
  const size = 1024;
  const cell = size / 8;
  const rnd = mulberry(kind === "brick" ? 9001 : kind === "brownstone" ? 7117 : kind === "limestone" ? 3131 : 4242);
  const base = canvas(size, size);
  const glow = canvas(size, size);
  const height = canvas(size, size);
  const rough = canvas(size, size);
  const b = base.ctx;
  const e = glow.ctx;
  const hc = height.ctx;
  const r = rough.ctx;

  if (kind === "brick") {
    // Mortar, then courses of bricks with colour variation and chipped edges.
    b.fillStyle = rgb(118, 108, 98);
    b.fillRect(0, 0, size, size);
    hc.fillStyle = grey(70);
    hc.fillRect(0, 0, size, size);
    r.fillStyle = grey(245);
    r.fillRect(0, 0, size, size);
    const bh = 8;
    const bw = 22;
    for (let row = 0; row * bh < size; row++) {
      const off = row % 2 ? bw / 2 : 0;
      for (let x = -bw; x < size; x += bw) {
        const k = 0.75 + rnd() * 0.4;
        const burnt = rnd() < 0.12 ? 0.6 : 1;
        b.fillStyle = rgb(128 * k * burnt, 62 * k * burnt, 46 * k * burnt);
        b.fillRect(x + off + 1, row * bh + 1, bw - 2, bh - 2);
        hc.fillStyle = grey(150 + rnd() * 40);
        hc.fillRect(x + off + 1.5, row * bh + 1.5, bw - 3, bh - 3);
        r.fillStyle = grey(200 + rnd() * 40);
        r.fillRect(x + off + 1, row * bh + 1, bw - 2, bh - 2);
      }
    }
  } else if (kind === "brownstone" || kind === "limestone") {
    // Dressed stone: coursed blocks with fine joints, rusticated deeper at street level.
    const [cr, cg, cb] = kind === "brownstone" ? [104, 68, 54] : [168, 160, 146];
    b.fillStyle = rgb(cr, cg, cb);
    b.fillRect(0, 0, size, size);
    hc.fillStyle = grey(160);
    hc.fillRect(0, 0, size, size);
    r.fillStyle = grey(215);
    r.fillRect(0, 0, size, size);
    noise(b, size, size, rnd, 6000, [1, 6], kind === "brownstone" ? [70, 120] : [130, 190]);
    const course = 32;
    for (let row = 0; row * course < size; row++) {
      const y = row * course;
      const k = 0.88 + rnd() * 0.2;
      b.fillStyle = rgb(cr * k, cg * k, cb * k, 0.5);
      b.fillRect(0, y, size, course);
      hc.fillStyle = grey(70);
      hc.fillRect(0, y, size, 2);
      const off = row % 2 ? 48 : 0;
      for (let x = off; x < size; x += 96) hc.fillRect(x, y, 2, course);
    }
  } else {
    // Poured concrete panels with form-tie holes and floor seams.
    b.fillStyle = rgb(132, 130, 126);
    b.fillRect(0, 0, size, size);
    hc.fillStyle = grey(150);
    hc.fillRect(0, 0, size, size);
    r.fillStyle = grey(230);
    r.fillRect(0, 0, size, size);
    noise(b, size, size, rnd, 5000, [1, 5], [95, 160]);
    noise(hc, size, size, rnd, 4000, [1, 4], [120, 180]);
    for (let y = 0; y < size; y += cell) {
      b.fillStyle = rgb(80, 78, 76);
      b.fillRect(0, y, size, 3);
      hc.fillStyle = grey(60);
      hc.fillRect(0, y, size, 3);
    }
    for (let x = 0; x < size; x += cell / 2) {
      hc.fillStyle = grey(90);
      hc.fillRect(x, 0, 2, size);
    }
  }
  // Fine grit everywhere.
  noise(hc, size, size, rnd, 9000, [0.5, 1.6], [90, 200]);

  // Windows.
  for (let gx = 0; gx < 8; gx++) {
    for (let gy = 0; gy < 8; gy++) {
      const x = gx * cell + 26;
      const y = gy * cell + 24;
      const w = cell - 52;
      const h = cell - 44;
      const roll = rnd();
      // Stone lintel and sill.
      b.fillStyle = rgb(150, 146, 138);
      b.fillRect(x - 6, y - 8, w + 12, 7);
      b.fillRect(x - 8, y + h, w + 16, 7);
      hc.fillStyle = grey(235);
      hc.fillRect(x - 6, y - 8, w + 12, 7);
      hc.fillRect(x - 8, y + h, w + 16, 7);
      // Frame and recessed glass.
      b.fillStyle = rgb(40, 38, 36);
      b.fillRect(x, y, w, h);
      hc.fillStyle = grey(20);
      hc.fillRect(x, y, w, h);
      r.fillStyle = grey(140);
      r.fillRect(x, y, w, h);
      const gw = w - 8;
      const gh = h - 8;
      const glass = b.createLinearGradient(x, y, x + w, y + h);
      glass.addColorStop(0, rgb(52, 60, 70));
      glass.addColorStop(1, rgb(18, 22, 28));
      b.fillStyle = glass;
      b.fillRect(x + 4, y + 4, gw, gh);
      hc.fillStyle = grey(8);
      hc.fillRect(x + 4, y + 4, gw, gh);
      r.fillStyle = grey(18);
      r.fillRect(x + 4, y + 4, gw, gh);
      // Mullions.
      b.fillStyle = rgb(40, 38, 36);
      b.fillRect(x + w / 2 - 2, y, 4, h);
      b.fillRect(x, y + h * 0.42, w, 4);
      hc.fillStyle = grey(30);
      hc.fillRect(x + w / 2 - 2, y, 4, h);
      hc.fillRect(x, y + h * 0.42, w, 4);
      r.fillStyle = grey(150);
      r.fillRect(x + w / 2 - 2, y, 4, h);

      if (roll < 0.1) {
        // Warm lamplight behind a curtain.
        const grad = e.createLinearGradient(x, y, x, y + h);
        grad.addColorStop(0, "#ffc27a");
        grad.addColorStop(1, "#d06a2a");
        e.fillStyle = grad;
        e.fillRect(x + 4, y + 4, gw, gh);
        b.fillStyle = rgb(120, 80, 48);
        b.fillRect(x + 4, y + 4, gw, gh);
      } else if (roll < 0.17) {
        e.fillStyle = "#5a3418";
        e.fillRect(x + 4, y + 4, gw, gh);
      } else if (roll < 0.2) {
        e.fillStyle = "#9eb4d0";
        e.fillRect(x + 4, y + 4, gw, gh * 0.6);
      } else if (roll < 0.22) {
        e.fillStyle = "#a01020";
        e.fillRect(x + 4, y + 4, gw, gh);
      } else if (roll < 0.36) {
        // Boarded up with weathered planks.
        for (let p = 0; p < 4; p++) {
          const py = y + 3 + p * (h / 4);
          const k = 0.7 + rnd() * 0.3;
          b.fillStyle = rgb(92 * k, 74 * k, 54 * k);
          b.fillRect(x - 2, py, w + 4, h / 4 - 3);
          hc.fillStyle = grey(170);
          hc.fillRect(x - 2, py, w + 4, h / 4 - 3);
          r.fillStyle = grey(235);
          r.fillRect(x - 2, py, w + 4, h / 4 - 3);
        }
      } else if (roll < 0.46) {
        // Shattered pane.
        b.fillStyle = rgb(10, 10, 11);
        b.fillRect(x + 4, y + 4, gw * (0.4 + rnd() * 0.6), gh * (0.4 + rnd() * 0.6));
        r.fillStyle = grey(230);
        r.fillRect(x + 4, y + 4, gw * 0.5, gh * 0.5);
      }
      // Soot above burnt-out windows.
      if (roll > 0.36 && roll < 0.46) {
        const soot = b.createLinearGradient(x, y - 40, x, y);
        soot.addColorStop(0, "rgba(10,10,10,0)");
        soot.addColorStop(1, "rgba(10,10,10,0.75)");
        b.fillStyle = soot;
        b.fillRect(x - 6, y - 40, w + 12, 40);
      }
    }
  }

  // Grime: darker at street level, rain streaks running from sills (wet = smoother).
  const grime = b.createLinearGradient(0, 0, 0, size);
  grime.addColorStop(0, "rgba(20,18,16,0.0)");
  grime.addColorStop(1, "rgba(20,18,16,0.25)");
  b.fillStyle = grime;
  b.fillRect(0, 0, size, size);
  for (let i = 0; i < 160; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const w = 2 + rnd() * 6;
    const l = 40 + rnd() * 200;
    const g = b.createLinearGradient(0, y, 0, y + l);
    g.addColorStop(0, "rgba(16,15,14,0.35)");
    g.addColorStop(1, "rgba(16,15,14,0)");
    b.fillStyle = g;
    b.fillRect(x, y, w, l);
    r.fillStyle = grey(110, 0.35);
    r.fillRect(x, y, w, l * 0.7);
  }

  const map = repeat(colorTex(base.c));
  const emissive = repeat(colorTex(glow.c));
  const normal = repeat(dataTex(normalFromHeight(height.c, 2.2)));
  const roughness = repeat(dataTex(rough.c));
  return { map, emissive, normal, roughness };
}

/** A curtain wall: dark reflective glass in a metal grid, spandrel bands, and offices left lit. */
function glassTextures(): FacadeSet {
  const size = 1024;
  const cell = size / 8;
  const rnd = mulberry(5150);
  const base = canvas(size, size);
  const glow = canvas(size, size);
  const height = canvas(size, size);
  const rough = canvas(size, size);
  const b = base.ctx;
  const e = glow.ctx;
  const hc = height.ctx;
  const r = rough.ctx;
  e.fillStyle = "#000";
  e.fillRect(0, 0, size, size);
  for (let gy = 0; gy < 8; gy++) {
    const y = gy * cell;
    // Floor slab spandrel.
    b.fillStyle = rgb(38, 42, 48);
    b.fillRect(0, y, size, 22);
    hc.fillStyle = grey(150);
    hc.fillRect(0, y, size, 22);
    r.fillStyle = grey(170);
    r.fillRect(0, y, size, 22);
    // Office floors: whole runs of panes lit together.
    const litRun = rnd() < 0.45;
    const runA = Math.floor(rnd() * 16);
    const runB = runA + 2 + Math.floor(rnd() * 8);
    for (let gx = 0; gx < 16; gx++) {
      const x = gx * (cell / 2);
      const w = cell / 2;
      const g = b.createLinearGradient(x, y + 22, x + w, y + cell);
      const k = 0.85 + rnd() * 0.3;
      g.addColorStop(0, rgb(58 * k, 72 * k, 88 * k));
      g.addColorStop(1, rgb(16 * k, 20 * k, 28 * k));
      b.fillStyle = g;
      b.fillRect(x, y + 22, w, cell - 22);
      hc.fillStyle = grey(110);
      hc.fillRect(x, y + 22, w, cell - 22);
      r.fillStyle = grey(14 + rnd() * 20);
      r.fillRect(x, y + 22, w, cell - 22);
      const lit = (litRun && gx >= runA && gx < runB) || rnd() < 0.06;
      if (lit) {
        e.fillStyle = rnd() < 0.7 ? rgb(200, 214, 230) : rgb(240, 196, 140);
        e.fillRect(x + 3, y + 26, w - 6, cell - 30);
        // Ceiling lights read brighter at the top of the pane.
        e.fillStyle = "rgba(255,255,255,0.5)";
        e.fillRect(x + 3, y + 26, w - 6, 6);
      } else if (rnd() < 0.08) {
        // A smashed pane.
        b.fillStyle = rgb(8, 8, 9);
        b.fillRect(x + 4, y + 26, w - 8, (cell - 30) * (0.5 + rnd() * 0.5));
      }
      // Mullions.
      b.fillStyle = rgb(120, 126, 132);
      b.fillRect(x, y, 3, cell);
      hc.fillStyle = grey(240);
      hc.fillRect(x, y, 3, cell);
      r.fillStyle = grey(90);
      r.fillRect(x, y, 3, cell);
    }
  }
  const map = repeat(colorTex(base.c));
  const emissive = repeat(colorTex(glow.c));
  const normal = repeat(dataTex(normalFromHeight(height.c, 2)));
  const roughness = repeat(dataTex(rough.c));
  return { map, emissive, normal, roughness };
}

/** Weathered corrugated steel panels with vertical ribs, horizontal panel seams and rust streaks (warehouses & containers). */
function corrugatedTextures(): FacadeSet {
  const size = 512;
  const rnd = mulberry(8821);
  const base = canvas(size, size);
  const glow = canvas(size, size);
  const height = canvas(size, size);
  const rough = canvas(size, size);
  const b = base.ctx;
  const e = glow.ctx;
  const hc = height.ctx;
  const r = rough.ctx;
  e.fillStyle = "#000";
  e.fillRect(0, 0, size, size);
  b.fillStyle = rgb(168, 170, 172);
  b.fillRect(0, 0, size, size);
  hc.fillStyle = grey(128);
  hc.fillRect(0, 0, size, size);
  r.fillStyle = grey(145);
  r.fillRect(0, 0, size, size);
  // Vertical corrugation ribs.
  const pitch = 16;
  for (let x = 0; x < size; x += pitch) {
    const grad = b.createLinearGradient(x, 0, x + pitch, 0);
    grad.addColorStop(0, rgb(125, 128, 132));
    grad.addColorStop(0.35, rgb(206, 208, 210));
    grad.addColorStop(0.65, rgb(196, 198, 202));
    grad.addColorStop(1, rgb(115, 118, 122));
    b.fillStyle = grad;
    b.fillRect(x, 0, pitch, size);
    const hg = hc.createLinearGradient(x, 0, x + pitch, 0);
    hg.addColorStop(0, grey(45));
    hg.addColorStop(0.5, grey(235));
    hg.addColorStop(1, grey(45));
    hc.fillStyle = hg;
    hc.fillRect(x, 0, pitch, size);
  }
  // Horizontal sheet seams & rivets.
  for (let y = 0; y < size; y += 128) {
    b.fillStyle = rgb(70, 68, 66);
    b.fillRect(0, y, size, 4);
    hc.fillStyle = grey(30);
    hc.fillRect(0, y, size, 4);
  }
  // Rust streaks & weathered paint scrapes.
  for (let i = 0; i < 120; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const w = 4 + rnd() * 16;
    const l = 20 + rnd() * 90;
    const rg = b.createLinearGradient(0, y, 0, y + l);
    rg.addColorStop(0, rgb(124, 66, 38, 0.55));
    rg.addColorStop(1, rgb(124, 66, 38, 0));
    b.fillStyle = rg;
    b.fillRect(x, y, w, l);
    r.fillStyle = grey(235, 0.65);
    r.fillRect(x, y, w, l * 0.7);
  }
  const map = repeat(colorTex(base.c));
  const emissive = repeat(colorTex(glow.c));
  const normal = repeat(dataTex(normalFromHeight(height.c, 3.0)));
  const roughness = repeat(dataTex(rough.c));
  return { map, emissive, normal, roughness };
}

/** Frost-dusted gothic cathedral stonework with tall pointed lancet arches and warm candlelit stained glass. */
function gothicTextures(): FacadeSet {
  const size = 1024;
  const cell = size / 8;
  const rnd = mulberry(6319);
  const base = canvas(size, size);
  const glow = canvas(size, size);
  const height = canvas(size, size);
  const rough = canvas(size, size);
  const b = base.ctx;
  const e = glow.ctx;
  const hc = height.ctx;
  const r = rough.ctx;
  e.fillStyle = "#000";
  e.fillRect(0, 0, size, size);
  b.fillStyle = rgb(164, 170, 178);
  b.fillRect(0, 0, size, size);
  hc.fillStyle = grey(160);
  hc.fillRect(0, 0, size, size);
  r.fillStyle = grey(220);
  r.fillRect(0, 0, size, size);
  // Ashlar stone blocks with frost highlights.
  const course = 32;
  for (let row = 0; row * course < size; row++) {
    const y = row * course;
    for (let x = (row % 2 ? -32 : 0); x < size; x += 64) {
      const k = 0.85 + rnd() * 0.25;
      b.fillStyle = rgb(156 * k, 164 * k, 174 * k);
      b.fillRect(x + 1, y + 1, 62, course - 2);
      hc.fillStyle = grey(150 + rnd() * 45);
      hc.fillRect(x + 2, y + 2, 60, course - 4);
    }
    hc.fillStyle = grey(55);
    hc.fillRect(0, y, size, 2);
  }
  // Pointed gothic lancet windows (4 tall arched bays across, 4 storeys high).
  const bayW = cell * 2;
  const bayH = cell * 2;
  for (let gx = 0; gx < 4; gx++) {
    for (let gy = 0; gy < 4; gy++) {
      const cx = gx * bayW + bayW / 2;
      const top = gy * bayH + 34;
      const w = bayW * 0.42;
      const h = bayH * 0.68;
      const archH = w * 0.65;
      const drawArch = (ctx: CanvasRenderingContext2D, pad: number) => {
        const hw = w / 2 + pad;
        ctx.beginPath();
        ctx.moveTo(cx - hw, top + h + pad);
        ctx.lineTo(cx - hw, top + archH);
        ctx.quadraticCurveTo(cx - hw, top - pad, cx, top - pad);
        ctx.quadraticCurveTo(cx + hw, top - pad, cx + hw, top + archH);
        ctx.lineTo(cx + hw, top + h + pad);
        ctx.closePath();
        ctx.fill();
      };
      // Stone surround.
      b.fillStyle = rgb(196, 204, 212);
      drawArch(b, 10);
      hc.fillStyle = grey(240);
      drawArch(hc, 10);
      // Recessed gothic leaded glass.
      const lit = rnd() < 0.42;
      b.fillStyle = lit ? rgb(140, 82, 46) : rgb(24, 34, 48);
      drawArch(b, 0);
      hc.fillStyle = grey(18);
      drawArch(hc, 0);
      r.fillStyle = grey(30);
      drawArch(r, 0);
      if (lit) {
        const gg = e.createLinearGradient(cx, top, cx, top + h);
        const warm = rnd() < 0.72;
        gg.addColorStop(0, warm ? "#ffba66" : "#d63042");
        gg.addColorStop(1, warm ? "#b8501a" : "#6a1020");
        e.fillStyle = gg;
        drawArch(e, -4);
      }
      // Stone tracery mullions.
      b.fillStyle = rgb(120, 128, 136);
      b.fillRect(cx - 3, top + 8, 6, h - 8);
      b.fillRect(cx - w / 2, top + h * 0.55, w, 5);
      // Snow ledge on sill.
      b.fillStyle = rgb(228, 236, 245);
      b.fillRect(cx - w / 2 - 12, top + h + 2, w + 24, 9);
    }
  }
  const map = repeat(colorTex(base.c));
  const emissive = repeat(colorTex(glow.c));
  const normal = repeat(dataTex(normalFromHeight(height.c, 2.4)));
  const roughness = repeat(dataTex(rough.c));
  return { map, emissive, normal, roughness };
}

/** Far towers seen through the haze: flat silhouettes in the fog colour, pricked with lit windows. */
export function skylineTexture(fog: number) {
  const size = 256;
  const { c, ctx } = canvas(size, size);
  const rnd = mulberry(fog & 0xffff);
  const f = new THREE.Color(fog);
  ctx.fillStyle = rgb(f.r * 255 * 0.62, f.g * 255 * 0.62, f.b * 255 * 0.66);
  ctx.fillRect(0, 0, size, size);
  const cell = size / 8;
  for (let gy = 0; gy < 8; gy++) {
    for (let gx = 0; gx < 16; gx++) {
      if (rnd() > 0.16) continue;
      ctx.fillStyle = rnd() < 0.6 ? rgb(230, 170, 110, 0.75) : rgb(190, 205, 225, 0.6);
      ctx.fillRect(gx * (cell / 2) + 4, gy * cell + 8, cell / 2 - 8, cell - 16);
    }
  }
  return repeat(colorTex(c, 4));
}

// ---------- Ground ----------

const PX = 8;

/** District-specific ground albedo, roughness and optional emissive map (e.g. Ash Ward molten ember cracks). */
export function groundTextures(zone: Zone): { map: THREE.CanvasTexture; roughness: THREE.CanvasTexture; emissive?: THREE.CanvasTexture } {
  const w = Math.round(zone.w * PX);
  const h = Math.round(zone.h * PX);
  const rnd = mulberry(zone.nation.length * 31 + zone.nation.charCodeAt(0) * 19 + 7);
  const col = canvas(w, h);
  const rough = canvas(w, h);
  const c = col.ctx;
  const r = rough.ctx;
  const nation = zone.id === "memory" ? "ash" : zone.nation;
  const g = new THREE.Color(zone.env.ground);
  const hex = (k: number, a = 1) => rgb(g.r * 255 * k, g.g * 255 * k, g.b * 255 * k, a);

  c.fillStyle = hex(1);
  c.fillRect(0, 0, w, h);
  r.fillStyle = grey(nation === "lanterns" ? 72 : nation === "snow" ? 185 : 122);
  r.fillRect(0, 0, w, h);

  // Base tonal mottling & aggregate.
  for (let i = 0; i < (w * h) / 900; i++) {
    c.fillStyle = hex(0.8 + rnd() * 0.4, 0.28);
    c.beginPath();
    c.arc(rnd() * w, rnd() * h, 8 + rnd() * 40, 0, Math.PI * 2);
    c.fill();
  }
  for (let i = 0; i < (w * h) / 45; i++) {
    c.fillStyle = hex(0.72 + rnd() * 0.65, 0.55);
    c.fillRect(rnd() * w, rnd() * h, 1, 1);
  }

  // ---------- District-unique surface treatments ----------
  if (nation === "reeds") {
    // Mossy silt patches & flooded marsh wash across the low lots.
    for (let i = 0; i < 160; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      const rad = (1.5 + rnd() * 5.5) * PX;
      const grad = c.createRadialGradient(x, y, 0, x, y, rad);
      grad.addColorStop(0, "rgba(44, 68, 46, 0.55)");
      grad.addColorStop(1, "rgba(44, 68, 46, 0)");
      c.fillStyle = grad;
      c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  } else if (nation === "snow") {
    // Snow-blanketed cobblestones & flagstones with gleaming wind-swept snowdrifts and frozen ice sheets.
    c.strokeStyle = "rgba(86, 98, 114, 0.45)";
    c.lineWidth = 1;
    for (let x = 0; x < w; x += 2.2 * PX) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, h);
      c.stroke();
    }
    for (let y = 0; y < h; y += 2.2 * PX) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y);
      c.stroke();
    }
    // Deep snowdrifts across the ground.
    for (let i = 0; i < 240; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      const rx = (2 + rnd() * 7) * PX;
      const ry = rx * (0.45 + rnd() * 0.5);
      const a = rnd() * Math.PI;
      c.fillStyle = `rgba(216, 228, 240, ${0.35 + rnd() * 0.45})`;
      c.beginPath();
      c.ellipse(x, y, rx, ry, a, 0, Math.PI * 2);
      c.fill();
      r.fillStyle = grey(230);
      r.beginPath();
      r.ellipse(x, y, rx, ry, a, 0, Math.PI * 2);
      r.fill();
    }
    // Swept dark-slate ceremonial path along the Thousand Steps.
    const rd = zone.pois.road;
    const startX = Math.max(12, zone.pois.village.x - 4) * PX;
    const endX = (zone.fortress ? zone.fortress.x - 2 : zone.w * 0.72) * PX;
    c.fillStyle = "rgba(74, 84, 96, 0.8)";
    c.fillRect(startX, (rd.y - 4.5) * PX, Math.max(10, endX - startX), 9 * PX);
    // Frozen mirror ice patches.
    for (let i = 0; i < 95; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      const rx = (1.2 + rnd() * 3.8) * PX;
      const ry = rx * (0.45 + rnd() * 0.5);
      const a = rnd() * Math.PI;
      c.fillStyle = "rgba(130, 168, 198, 0.55)";
      c.beginPath();
      c.ellipse(x, y, rx, ry, a, 0, Math.PI * 2);
      c.fill();
      r.fillStyle = grey(12);
      r.beginPath();
      r.ellipse(x, y, rx * 0.9, ry * 0.9, a, 0, Math.PI * 2);
      r.fill();
    }
  } else if (nation === "tides") {
    // Concrete dock slabs + timber planked southern pier deck + industrial hazard bay markings.
    const quayY = Math.round(zone.h * 0.675);
    c.strokeStyle = "rgba(24, 28, 32, 0.65)";
    c.lineWidth = 1.2;
    for (let x = 0; x < w; x += 5 * PX) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, (quayY + 2) * PX);
      c.stroke();
    }
    for (let y = 0; y < (quayY + 2) * PX; y += 5 * PX) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y);
      c.stroke();
    }
    // Weathered timber pier planking along the southern waterfront.
    const pierY = quayY * PX;
    c.fillStyle = rgb(72, 56, 44);
    c.fillRect(0, pierY, w, h - pierY);
    r.fillStyle = grey(150);
    r.fillRect(0, pierY, w, h - pierY);
    for (let y = pierY; y < h; y += 0.45 * PX) {
      const k = 0.78 + rnd() * 0.34;
      c.fillStyle = rgb(78 * k, 60 * k, 46 * k);
      c.fillRect(0, y, w, 0.36 * PX);
      c.fillStyle = "rgba(14, 12, 10, 0.75)";
      c.fillRect(0, y + 0.36 * PX, w, 0.09 * PX);
    }
    // Yellow/black industrial hazard stripe along the quay edge.
    const edgeY = (quayY - 0.8) * PX;
    c.fillStyle = rgb(210, 156, 26, 0.85);
    c.fillRect(0, edgeY, w, 0.9 * PX);
    c.fillStyle = "rgba(20, 20, 20, 0.85)";
    for (let x = 0; x < w; x += 2.2 * PX) {
      c.fillRect(x, edgeY, 1.1 * PX, 0.9 * PX);
    }
  } else if (nation === "lanterns") {
    // Ornate Festival Square plaza paving around pois.water.
    const sq = zone.pois.water;
    const sx = sq.x * PX;
    const sy = sq.y * PX;
    const rad = 14.5 * PX;
    c.fillStyle = rgb(44, 34, 48);
    c.beginPath();
    c.arc(sx, sy, rad, 0, Math.PI * 2);
    c.fill();
    for (const [rr, colStr] of [
      [rad, "rgba(220, 40, 70, 0.75)"],
      [rad * 0.72, "rgba(240, 175, 45, 0.6)"],
      [rad * 0.42, "rgba(0, 220, 255, 0.65)"],
    ] as const) {
      c.strokeStyle = colStr;
      c.lineWidth = 3;
      c.beginPath();
      c.arc(sx, sy, rr, 0, Math.PI * 2);
      c.stroke();
    }
    r.fillStyle = grey(36);
    r.beginPath();
    r.arc(sx, sy, rad, 0, Math.PI * 2);
    r.fill();
  } else if (nation === "ash") {
    // Ash drifts over scorched black stone.
    for (let i = 0; i < 190; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      const rx = (1.5 + rnd() * 5.5) * PX;
      const ry = rx * (0.4 + rnd() * 0.5);
      const a = rnd() * Math.PI;
      c.fillStyle = `rgba(120, 108, 100, ${0.22 + rnd() * 0.28})`;
      c.beginPath();
      c.ellipse(x, y, rx, ry, a, 0, Math.PI * 2);
      c.fill();
      r.fillStyle = grey(220);
      r.beginPath();
      r.ellipse(x, y, rx, ry, a, 0, Math.PI * 2);
      r.fill();
    }
  }

  // Sidewalks with curbs around urban buildings (skip shipping containers and snow cloister edges).
  for (const b of zone.buildings) {
    if (b.style === "container") continue;
    const pad = nation === "snow" ? 1.8 : 2.2;
    const x0 = (b.x - pad) * PX;
    const y0 = (b.y - pad) * PX;
    const ww = (b.w + pad * 2) * PX;
    const hh = (b.h + pad * 2) * PX;
    c.fillStyle = rgb(24, 24, 24, 0.55);
    c.fillRect(x0 - 3, y0 - 3, ww + 6, hh + 6);
    c.fillStyle = nation === "snow" ? rgb(186, 196, 206) : nation === "lanterns" ? rgb(92, 86, 102) : nation === "ash" ? rgb(96, 86, 80) : rgb(142, 140, 134);
    c.fillRect(x0, y0, ww, hh);
    c.fillStyle = nation === "snow" ? rgb(156, 166, 178) : nation === "lanterns" ? rgb(68, 62, 78) : nation === "ash" ? rgb(74, 66, 62) : rgb(106, 104, 100);
    c.fillRect(x0 + 0.3 * PX, y0 + 0.3 * PX, ww - 0.6 * PX, hh - 0.6 * PX);
    r.fillStyle = grey(nation === "lanterns" ? 90 : 175);
    r.fillRect(x0, y0, ww, hh);
  }

  // Contact shadows under buildings (baked ambient occlusion).
  c.save();
  c.shadowColor = "rgba(0,0,0,0.72)";
  c.shadowBlur = 1.6 * PX;
  for (const b of zone.buildings) {
    c.fillStyle = rgb(18, 18, 18);
    c.fillRect(b.x * PX, b.y * PX, b.w * PX, b.h * PX);
  }
  c.restore();
  for (const b of zone.buildings) {
    c.fillStyle = rgb(18, 18, 18);
    c.fillRect(b.x * PX, b.y * PX, b.w * PX, b.h * PX);
  }

  // Road lane markings ONLY in urban asphalt districts (reeds, lanterns, ash) — NOT on snow cloisters or timber docks!
  if (nation === "reeds" || nation === "lanterns" || nation === "ash") {
    const step = nation === "lanterns" ? 17 : nation === "reeds" ? 23 : 21;
    const alpha = nation === "lanterns" ? 0.72 : nation === "ash" ? 0.35 : 0.45;
    for (let x = step; x < zone.w; x += step) {
      for (let y = 0; y < zone.h; y += 0.5) {
        if (rnd() < 0.22) continue;
        c.fillStyle = nation === "lanterns" ? rgb(235, 185, 50, alpha) : rgb(186, 148, 56, alpha);
        c.fillRect(x * PX - 3, y * PX, 1.5, 0.5 * PX);
        c.fillRect(x * PX + 2, y * PX, 1.5, 0.5 * PX);
      }
    }
    for (let y = step; y < zone.h; y += step) {
      for (let x = 0; x < zone.w; x += 0.5) {
        if (rnd() < 0.22) continue;
        c.fillStyle = nation === "lanterns" ? rgb(235, 185, 50, alpha) : rgb(186, 148, 56, alpha);
        c.fillRect(x * PX, y * PX - 3, 0.5 * PX, 1.5);
        c.fillRect(x * PX, y * PX + 2, 0.5 * PX, 1.5);
      }
    }
  }

  // Cracks, oil stains & puddles.
  for (let i = 0; i < 240; i++) {
    let x = rnd() * w;
    let y = rnd() * h;
    c.strokeStyle = rnd() < 0.4 ? "rgba(8,8,8,0.8)" : "rgba(20,20,22,0.55)";
    c.lineWidth = 0.6 + rnd() * 1.6;
    c.beginPath();
    c.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x += (rnd() - 0.5) * 32;
      y += (rnd() - 0.5) * 32;
      c.lineTo(x, y);
    }
    c.stroke();
  }

  // Puddles: abundant mirror puddles in reeds & lanterns, moderate in tides, sparse in ash.
  const puddleCount = nation === "reeds" ? 260 : nation === "lanterns" ? 230 : nation === "tides" ? 150 : nation === "snow" ? 30 : 40;
  for (let i = 0; i < puddleCount; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const rx = (0.7 + rnd() * (nation === "reeds" ? 4.2 : 2.8)) * PX;
    const ry = rx * (0.4 + rnd() * 0.6);
    const a = rnd() * Math.PI;
    c.fillStyle = hex(0.65, 0.65);
    c.beginPath();
    c.ellipse(x, y, rx, ry, a, 0, Math.PI * 2);
    c.fill();
    r.fillStyle = grey(6);
    r.beginPath();
    r.ellipse(x, y, rx * 0.9, ry * 0.9, a, 0, Math.PI * 2);
    r.fill();
  }

  // Ash Ward: glowing subterranean ember fissures burned into an emissive canvas!
  let emissive: THREE.CanvasTexture | undefined;
  if (nation === "ash") {
    const em = canvas(w, h);
    const ec = em.ctx;
    ec.fillStyle = "#000";
    ec.fillRect(0, 0, w, h);
    const drawCrack = (x0: number, y0: number, segs: number, stepLen: number, width: number, bright: number) => {
      let x = x0;
      let y = y0;
      ec.lineCap = "round";
      ec.lineJoin = "round";
      // Soft red-orange heat halo.
      ec.strokeStyle = `rgba(255, 68, 12, ${0.42 * bright})`;
      ec.lineWidth = width * 3.4;
      ec.beginPath();
      ec.moveTo(x, y);
      const pts: [number, number][] = [[x, y]];
      for (let k = 0; k < segs; k++) {
        x += (rnd() - 0.45) * stepLen;
        y += (rnd() - 0.5) * stepLen;
        pts.push([x, y]);
        ec.lineTo(x, y);
      }
      ec.stroke();
      // White-hot molten core.
      ec.strokeStyle = `rgba(255, 195, 75, ${0.95 * bright})`;
      ec.lineWidth = width;
      ec.beginPath();
      pts.forEach(([px, py], idx) => (idx === 0 ? ec.moveTo(px, py) : ec.lineTo(px, py)));
      ec.stroke();
      // Charred edge in albedo.
      c.strokeStyle = "rgba(10, 6, 4, 0.9)";
      c.lineWidth = width * 2.2;
      c.beginPath();
      pts.forEach(([px, py], idx) => (idx === 0 ? c.moveTo(px, py) : c.lineTo(px, py)));
      c.stroke();
    };
    // Dense glowing fissures around River of Embers and Road of Cinders.
    const rv = zone.pois.water;
    for (let i = 0; i < 28; i++) {
      drawCrack((rv.x + (rnd() - 0.5) * 28) * PX, (rv.y + (rnd() - 0.5) * 18) * PX, 7, 26, 2.2 + rnd() * 2, 1);
    }
    const rd = zone.pois.road;
    for (let i = 0; i < 22; i++) {
      drawCrack((rd.x + (rnd() - 0.5) * 40) * PX, (rd.y + (rnd() - 0.5) * 16) * PX, 6, 24, 1.6 + rnd() * 1.6, 0.85);
    }
    // Scattered ember cracks across the whole ward.
    for (let i = 0; i < 45; i++) {
      drawCrack(rnd() * w, rnd() * h, 5, 22, 1.2 + rnd() * 1.4, 0.7);
    }
    emissive = colorTex(em.c, 8);
  }

  const map = colorTex(col.c, 16);
  const roughness = dataTex(rough.c, 16);
  return { map, roughness, emissive };
}

// ---------- Tiled surface detail ----------

let detail: { asphalt: THREE.Texture; concrete: THREE.Texture; skin: THREE.Texture; fabric: THREE.Texture; leather: THREE.Texture } | null = null;

/** Shared, tiling normal maps for fine surface detail. Clone before changing repeat. */
export function detailMaps() {
  if (detail) return detail;
  const size = 256;
  const make = (seed: number, draw: (ctx: CanvasRenderingContext2D, rnd: () => number) => void, strength: number) => {
    const rnd = mulberry(seed);
    const { c, ctx } = canvas(size, size);
    ctx.fillStyle = grey(128);
    ctx.fillRect(0, 0, size, size);
    draw(ctx, rnd);
    const t = dataTex(normalFromHeight(c, strength));
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  };
  detail = {
    asphalt: make(1, (ctx, rnd) => noise(ctx, size, size, rnd, 6000, [0.6, 2.2], [60, 220]), 3),
    concrete: make(2, (ctx, rnd) => noise(ctx, size, size, rnd, 2500, [1, 4], [100, 170]), 1.5),
    // Pebbled reptile skin: packed round scales.
    skin: make(3, (ctx, rnd) => {
      for (let i = 0; i < 1400; i++) {
        const x = rnd() * size;
        const y = rnd() * size;
        const rad = 2 + rnd() * 4;
        const gr = ctx.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, grey(200));
        gr.addColorStop(1, grey(110, 0));
        ctx.fillStyle = gr;
        ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
    }, 2.5),
    // Woven fabric: fine crossing threads.
    fabric: make(4, (ctx, rnd) => {
      for (let y = 0; y < size; y += 4) {
        ctx.fillStyle = grey(150 + rnd() * 30);
        ctx.fillRect(0, y, size, 2);
      }
      for (let x = 0; x < size; x += 4) {
        ctx.fillStyle = grey(100 + rnd() * 20, 0.6);
        ctx.fillRect(x, 0, 2, size);
      }
      noise(ctx, size, size, rnd, 400, [2, 8], [110, 150]);
    }, 1.2),
    leather: make(5, (ctx, rnd) => {
      noise(ctx, size, size, rnd, 3000, [1, 3], [90, 170]);
      ctx.strokeStyle = grey(70, 0.5);
      for (let i = 0; i < 80; i++) {
        ctx.beginPath();
        const x = rnd() * size;
        const y = rnd() * size;
        ctx.moveTo(x, y);
        ctx.lineTo(x + (rnd() - 0.5) * 30, y + (rnd() - 0.5) * 10);
        ctx.stroke();
      }
    }, 1.5),
  };
  return detail;
}

let shell: { map: THREE.Texture; normal: THREE.Texture } | null = null;

/** A turtle carapace: hexagonal scutes with growth rings, worn and scratched. */
export function shellTextures() {
  if (shell) return shell;
  const size = 512;
  const rnd = mulberry(77);
  const col = canvas(size, size);
  const hgt = canvas(size, size);
  const c = col.ctx;
  const h = hgt.ctx;
  c.fillStyle = rgb(70, 56, 38);
  c.fillRect(0, 0, size, size);
  h.fillStyle = grey(60);
  h.fillRect(0, 0, size, size);
  const rad = 70;
  for (let row = -1; row < 6; row++) {
    for (let k = -1; k < 6; k++) {
      const cx = k * rad * 1.75 + (row % 2 ? rad * 0.87 : 0);
      const cy = row * rad * 1.5;
      for (let ring = 6; ring >= 1; ring--) {
        const rr = (rad * 0.92 * ring) / 6;
        const t = ring / 6;
        c.fillStyle = rgb(92 - t * 30 + rnd() * 10, 74 - t * 24 + rnd() * 8, 48 - t * 16);
        h.fillStyle = grey(230 - t * 120);
        for (const ctx of [c, h]) {
          ctx.beginPath();
          for (let s = 0; s < 6; s++) {
            const a = Math.PI / 6 + (s * Math.PI) / 3;
            const px = cx + Math.cos(a) * rr;
            const py = cy + Math.sin(a) * rr;
            if (s === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }
  // Scratches and chips.
  for (let i = 0; i < 90; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const dx = (rnd() - 0.5) * 60;
    const dy = (rnd() - 0.5) * 60;
    c.strokeStyle = rgb(140, 120, 90, 0.4);
    h.strokeStyle = grey(30, 0.8);
    for (const ctx of [c, h]) {
      ctx.lineWidth = 1 + rnd();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + dx, y + dy);
      ctx.stroke();
    }
  }
  shell = { map: repeat(colorTex(col.c)), normal: repeat(dataTex(normalFromHeight(hgt.c, 3))) };
  return shell;
}

// ---------- Signs and particles ----------

/** One row per word, white on black: neon colour comes from the vertex colours. */
export const SIGN_WORDS = ["BAR", "HOTEL", "24H", "NOODLES", "PAWN", "LIQUOR", "OPEN", "MOTEL", "DINER", "CLUB", "PHARMACY", "RAMEN", "XXX", "TATTOO", "CASH", "侍"];

export function signAtlas() {
  const rowH = 64;
  const { c, ctx } = canvas(512, rowH * SIGN_WORDS.length);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  SIGN_WORDS.forEach((word, i) => {
    const y = i * rowH + rowH / 2;
    ctx.font = `700 ${word.length > 6 ? 40 : 46}px "Arial Narrow", Arial, sans-serif`;
    ctx.shadowColor = "#fff";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#fff";
    ctx.fillText(word, 256, y + 2);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 3;
    ctx.strokeRect(14, i * rowH + 6, 484, rowH - 12);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A soft round dot for particles and glows. */
export function softDot() {
  const { c, ctx } = canvas(64, 64);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.6)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** A ragged puff for smoke and fog banks. */
export function smokePuff() {
  const { c, ctx } = canvas(128, 128);
  const rnd = mulberry(5);
  for (let i = 0; i < 26; i++) {
    const x = 40 + rnd() * 48;
    const y = 40 + rnd() * 48;
    const r = 16 + rnd() * 26;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(255,255,255,0.22)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(c);
}

/** Diagonal hazard stripes (red/white for road-closed sawhorses or yellow/black for concrete barriers). */
export function barricadeStripeTexture(variant: "red" | "yellow") {
  const size = 128;
  const { c, ctx } = canvas(size, size);
  ctx.fillStyle = variant === "red" ? "#d8d6d0" : "#dba018";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = variant === "red" ? "#b81c22" : "#181a1c";
  for (let x = -size; x < size * 2; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 16, 0);
    ctx.lineTo(x - 48, size);
    ctx.lineTo(x - 64, size);
    ctx.closePath();
    ctx.fill();
  }
  // Light weathering grime.
  const rnd = mulberry(variant === "red" ? 113 : 229);
  for (let i = 0; i < 180; i++) {
    ctx.fillStyle = `rgba(20,18,16,${0.05 + rnd() * 0.14})`;
    ctx.fillRect(rnd() * size, rnd() * size, 2 + rnd() * 8, 2 + rnd() * 6);
  }
  return repeat(colorTex(c, 4), 2, 1);
}
