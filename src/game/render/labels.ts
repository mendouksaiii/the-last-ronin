import * as THREE from "three";
import type { Game } from "../engine/game";
import { dist } from "../engine/state";

// DOM labels drawn over the 3D view: damage numbers, speech bubbles, stealth meters over enemies,
// health bars on wounded foes, the lock-on reticle and the objective marker.

interface PooledItem {
  el: HTMLDivElement;
  visible: boolean;
  transform: string;
  opacity: string;
  color: string;
  fontSize: string;
  bg: string;
  border: string;
  width: string;
  ghost: boolean;
  text: string;
  speaker: string;
  line: string;
  fill: HTMLElement | null;
  who: HTMLElement | null;
  msg: HTMLElement | null;
}

class Pool {
  private items: PooledItem[] = [];
  private used = 0;
  constructor(
    private root: HTMLElement,
    private make: () => HTMLDivElement,
  ) {}
  begin() {
    this.used = 0;
  }
  take(): PooledItem {
    let item = this.items[this.used];
    if (!item) {
      const el = this.make();
      this.root.appendChild(el);
      item = {
        el,
        visible: true,
        transform: "",
        opacity: "",
        color: "",
        fontSize: "",
        bg: "",
        border: "",
        width: "",
        ghost: false,
        text: "",
        speaker: "",
        line: "",
        fill: el.firstElementChild as HTMLElement | null,
        who: (el.children[0] as HTMLElement | undefined) ?? null,
        msg: (el.children[1] as HTMLElement | undefined) ?? null,
      };
      this.items.push(item);
    }
    this.used++;
    if (!item.visible) {
      item.visible = true;
      item.el.style.display = "";
    }
    return item;
  }
  end() {
    for (let i = this.used; i < this.items.length; i++) {
      const item = this.items[i];
      if (item.visible) {
        item.visible = false;
        item.el.style.display = "none";
      }
    }
  }
}

const div = (cls: string, html = "") => () => {
  const d = document.createElement("div");
  d.className = `pointer-events-none absolute left-0 top-0 will-change-transform ${cls}`;
  d.innerHTML = html;
  return d;
};

const snap = (v: number) => Math.round(v * 2) * 0.5;

export class Labels {
  root: HTMLDivElement;
  private floaters: Pool;
  private bubbles: Pool;
  private meters: Pool;
  private bars: Pool;
  private reticle: HTMLDivElement;
  private reticleVisible = true;
  private reticleTransform = "";
  private marker: HTMLDivElement;
  private markerVisible = true;
  private markerOpacity = "";
  private markerTransform = "";
  private markerLabel = "";
  private markerSpan: HTMLElement;
  private v = new THREE.Vector3();
  private pt = { x: 0, y: 0 };

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "pointer-events-none absolute inset-0 overflow-hidden";
    parent.appendChild(this.root);
    this.floaters = new Pool(this.root, div("whitespace-nowrap font-display tabular-nums tracking-wide drop-shadow-[0_2px_0_hsl(var(--ink))]"));
    this.bubbles = new Pool(
      this.root,
      div("max-w-56 border-2 border-ink bg-paper px-2 py-1 text-xs font-bold leading-snug text-ink shadow-comic", '<p class="text-[10px] uppercase tracking-wider text-vermilion"></p><p></p>'),
    );
    this.meters = new Pool(this.root, div("flex size-6 items-center justify-center rounded-full border-2 font-display text-sm"));
    this.bars = new Pool(this.root, div("h-1.5 w-12 border border-ink bg-ink", '<div class="h-full bg-gradient-vermilion"></div>'));
    this.reticle = div("size-10 rounded-full border-2 border-vermilion shadow-glow")();
    this.reticle.innerHTML = '<div class="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-vermilion"></div>';
    this.marker = div("flex flex-col items-center gap-0.5")();
    this.marker.innerHTML =
      '<div class="size-3.5 rotate-45 border-2 border-ink bg-gold shadow-glow"></div><span class="rounded-sm bg-ink/80 px-1 text-[10px] font-bold tabular-nums text-gold"></span>';
    this.markerSpan = this.marker.lastChild as HTMLElement;
    this.root.append(this.reticle, this.marker);
  }

  /** Projects a world point (x east, y south, h up) into `this.pt`; returns false if behind the camera. */
  private project(cam: THREE.Camera, x: number, h: number, z: number, w: number, hh: number) {
    this.v.set(x, h, z).project(cam);
    if (this.v.z > 1) return false;
    this.pt.x = (this.v.x * 0.5 + 0.5) * w;
    this.pt.y = (-this.v.y * 0.5 + 0.5) * hh;
    return true;
  }

  update(g: Game, cam: THREE.PerspectiveCamera, w: number, h: number, heightOf: (on: object) => number) {
    const at = (item: PooledItem, x: number, y: number, extra = "") => {
      const tr = `translate(${snap(x)}px, ${snap(y)}px) translate(-50%, -100%)${extra}`;
      if (item.transform !== tr) {
        item.transform = tr;
        item.el.style.transform = tr;
      }
    };
    const p = g.player;

    this.floaters.begin();
    for (const f of g.floaters) {
      if (!this.project(cam, f.x, 2.2 + f.t * 1.2, f.y, w, h)) continue;
      const item = this.floaters.take();
      if (item.text !== f.text) {
        item.text = f.text;
        item.el.textContent = f.text;
      }
      if (item.color !== f.color) {
        item.color = f.color;
        item.el.style.color = f.color;
      }
      const fs = f.big ? "26px" : "18px";
      if (item.fontSize !== fs) {
        item.fontSize = fs;
        item.el.style.fontSize = fs;
      }
      const op = `${Math.min(1, Math.round(Math.max(0, 1.1 - f.t) * 300) / 100)}`;
      if (item.opacity !== op) {
        item.opacity = op;
        item.el.style.opacity = op;
      }
      const sc = f.t < 0.1 ? ` scale(${(1.4 - f.t * 4).toFixed(2)})` : "";
      at(item, this.pt.x, this.pt.y, sc);
    }
    this.floaters.end();

    this.bubbles.begin();
    for (const b of g.bubbles) {
      if (!this.project(cam, b.on.x, heightOf(b.on) + 0.6, b.on.y, w, h)) continue;
      const item = this.bubbles.take();
      if (item.who && item.speaker !== b.speaker) {
        item.speaker = b.speaker;
        item.who.textContent = b.speaker;
      }
      if (item.msg && item.line !== b.text) {
        item.line = b.text;
        item.msg.textContent = b.text;
      }
      const op = `${Math.min(1, Math.round(b.t * 200) / 100)}`;
      if (item.opacity !== op) {
        item.opacity = op;
        item.el.style.opacity = op;
      }
      if (item.ghost !== b.ghost) {
        item.ghost = b.ghost;
        item.el.classList.toggle("italic", b.ghost);
      }
      at(item, Math.max(120, Math.min(w - 120, this.pt.x)), Math.max(60, this.pt.y));
    }
    this.bubbles.end();

    // Stealth meters over enemies that are searching, and health bars over wounded ones.
    this.meters.begin();
    this.bars.begin();
    for (const e of g.enemies) {
      if (e.state === "dead" || dist(e, p) > 32) continue;
      const top = heightOf(e) + 0.35;
      if (!e.object && !e.boss && ((!e.aware && e.suspicion > 0.05) || e.state === "stagger")) {
        if (this.project(cam, e.x, top + 0.35, e.y, w, h)) {
          const item = this.meters.take();
          const stagger = e.state === "stagger";
          const text = stagger ? "!" : e.suspicion > 0.35 ? "?" : "·";
          if (item.text !== text) {
            item.text = text;
            item.el.textContent = text;
          }
          const k = Math.round(e.suspicion * 100);
          const bg = stagger
            ? "hsl(var(--gold) / 0.9)"
            : `conic-gradient(hsl(var(--vermilion)) ${k}%, hsl(var(--ink) / 0.7) ${k}% 100%)`;
          if (item.bg !== bg) {
            item.bg = bg;
            item.el.style.background = bg;
          }
          if (item.border !== "hsl(var(--ink))") {
            item.border = "hsl(var(--ink))";
            item.el.style.borderColor = "hsl(var(--ink))";
          }
          const col = stagger ? "hsl(var(--ink))" : "hsl(var(--paper))";
          if (item.color !== col) {
            item.color = col;
            item.el.style.color = col;
          }
          at(item, this.pt.x, this.pt.y, stagger ? ` scale(${(1 + Math.sin(g.time * 14) * 0.12).toFixed(2)})` : "");
        }
      }
      if (!e.boss && e.hp < e.maxHp && (e.aware || e.object)) {
        if (this.project(cam, e.x, top, e.y, w, h)) {
          const item = this.bars.take();
          const pct = `${Math.max(0, Math.round((e.hp / e.maxHp) * 100))}%`;
          if (item.fill && item.width !== pct) {
            item.width = pct;
            item.fill.style.width = pct;
          }
          at(item, this.pt.x, this.pt.y);
        }
      }
    }
    this.meters.end();
    this.bars.end();

    const lock = g.lock;
    const hasReticle = !!(lock && lock.state !== "dead" && this.project(cam, lock.x, heightOf(lock) * 0.6, lock.y, w, h));
    if (this.reticleVisible !== hasReticle) {
      this.reticleVisible = hasReticle;
      this.reticle.style.display = hasReticle ? "" : "none";
    }
    if (hasReticle) {
      const tr = `translate(${snap(this.pt.x)}px, ${snap(this.pt.y)}px) translate(-50%, -50%) rotate(${Math.round(g.time * 90)}deg)`;
      if (this.reticleTransform !== tr) {
        this.reticleTransform = tr;
        this.reticle.style.transform = tr;
      }
    }

    // Objective marker: over the target, or pinned to the screen edge.
    const obj = g.objectivePoint();
    const hasMarker = !!(obj && !g.cine);
    if (this.markerVisible !== hasMarker) {
      this.markerVisible = hasMarker;
      this.marker.style.display = hasMarker ? "" : "none";
    }
    if (obj && !g.cine) {
      const d = dist(p, obj);
      this.v.set(obj.x, 2.5, obj.y).project(cam);
      let x = (this.v.x * 0.5 + 0.5) * w;
      let y = (-this.v.y * 0.5 + 0.5) * h;
      if (this.v.z > 1) {
        x = w - x;
        y = h - 40;
      }
      x = Math.max(28, Math.min(w - 28, x));
      y = Math.max(70, Math.min(h - 40, y));
      const t = `${Math.round(d)}m`;
      if (this.markerLabel !== t) {
        this.markerLabel = t;
        this.markerSpan.textContent = t;
      }
      const op = d < 5 ? "0.3" : "1";
      if (this.markerOpacity !== op) {
        this.markerOpacity = op;
        this.marker.style.opacity = op;
      }
      const tr = `translate(${snap(x)}px, ${snap(y)}px) translate(-50%, -50%)`;
      if (this.markerTransform !== tr) {
        this.markerTransform = tr;
        this.marker.style.transform = tr;
      }
    }
  }

  dispose() {
    this.root.remove();
  }
}
