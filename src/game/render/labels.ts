import * as THREE from "three";
import type { Game } from "../engine/game";
import { dist } from "../engine/state";

// DOM labels drawn over the 3D view: damage numbers, speech bubbles, stealth meters over enemies,
// health bars on wounded foes, the lock-on reticle and the objective marker.

class Pool {
  private items: HTMLDivElement[] = [];
  private used = 0;
  constructor(
    private root: HTMLElement,
    private make: () => HTMLDivElement,
  ) {}
  begin() {
    this.used = 0;
  }
  take() {
    let el = this.items[this.used];
    if (!el) {
      el = this.make();
      this.root.appendChild(el);
      this.items.push(el);
    }
    this.used++;
    el.style.display = "";
    return el;
  }
  end() {
    for (let i = this.used; i < this.items.length; i++) this.items[i].style.display = "none";
  }
}

const div = (cls: string, html = "") => () => {
  const d = document.createElement("div");
  d.className = `pointer-events-none absolute left-0 top-0 will-change-transform ${cls}`;
  d.innerHTML = html;
  return d;
};

export class Labels {
  root: HTMLDivElement;
  private floaters: Pool;
  private bubbles: Pool;
  private meters: Pool;
  private bars: Pool;
  private reticle: HTMLDivElement;
  private marker: HTMLDivElement;
  private v = new THREE.Vector3();

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "pointer-events-none absolute inset-0 overflow-hidden";
    parent.appendChild(this.root);
    this.floaters = new Pool(this.root, div("whitespace-nowrap font-display tracking-wide drop-shadow-[0_2px_0_hsl(var(--ink))]"));
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
      '<div class="size-3.5 rotate-45 border-2 border-ink bg-gold shadow-glow"></div><span class="rounded-sm bg-ink/80 px-1 text-[10px] font-bold text-gold"></span>';
    this.root.append(this.reticle, this.marker);
  }

  /** Projects a world point (x east, y south, h up) to screen pixels; null if behind the camera. */
  private project(cam: THREE.Camera, x: number, h: number, z: number, w: number, hh: number) {
    this.v.set(x, h, z).project(cam);
    if (this.v.z > 1) return null;
    return { x: (this.v.x * 0.5 + 0.5) * w, y: (-this.v.y * 0.5 + 0.5) * hh, behind: false };
  }

  update(g: Game, cam: THREE.PerspectiveCamera, w: number, h: number, heightOf: (on: object) => number) {
    const at = (el: HTMLElement, x: number, y: number, extra = "") => {
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%) ${extra}`;
    };
    const p = g.player;

    this.floaters.begin();
    for (const f of g.floaters) {
      const s = this.project(cam, f.x, 2.2 + f.t * 1.2, f.y, w, h);
      if (!s) continue;
      const el = this.floaters.take();
      if (el.textContent !== f.text) el.textContent = f.text;
      el.style.color = f.color;
      el.style.fontSize = f.big ? "26px" : "18px";
      el.style.opacity = `${Math.min(1, (1.1 - f.t) * 3)}`;
      at(el, s.x, s.y, `scale(${f.t < 0.1 ? 1.4 - f.t * 4 : 1})`);
    }
    this.floaters.end();

    this.bubbles.begin();
    for (const b of g.bubbles) {
      const s = this.project(cam, b.on.x, heightOf(b.on) + 0.6, b.on.y, w, h);
      if (!s) continue;
      const el = this.bubbles.take();
      const [who, line] = el.children as HTMLCollectionOf<HTMLElement>;
      if (who.textContent !== b.speaker) who.textContent = b.speaker;
      if (line.textContent !== b.text) line.textContent = b.text;
      el.style.opacity = `${Math.min(1, b.t * 2)}`;
      el.classList.toggle("italic", b.ghost);
      at(el, Math.max(120, Math.min(w - 120, s.x)), Math.max(60, s.y));
    }
    this.bubbles.end();

    // Stealth meters over enemies that are searching, and health bars over wounded ones.
    this.meters.begin();
    this.bars.begin();
    for (const e of g.enemies) {
      if (e.state === "dead" || dist(e, p) > 32) continue;
      const top = heightOf(e) + 0.35;
      if (!e.object && !e.boss && ((!e.aware && e.suspicion > 0.05) || e.state === "stagger")) {
        const s = this.project(cam, e.x, top + 0.35, e.y, w, h);
        if (s) {
          const el = this.meters.take();
          const stagger = e.state === "stagger";
          const text = stagger ? "!" : e.suspicion > 0.35 ? "?" : "·";
          if (el.textContent !== text) el.textContent = text;
          const k = Math.round(e.suspicion * 100);
          el.style.background = stagger
            ? "hsl(var(--gold) / 0.9)"
            : `conic-gradient(hsl(var(--vermilion)) ${k}%, hsl(var(--ink) / 0.7) ${k}% 100%)`;
          el.style.borderColor = "hsl(var(--ink))";
          el.style.color = stagger ? "hsl(var(--ink))" : "hsl(var(--paper))";
          at(el, s.x, s.y, stagger ? `scale(${1 + Math.sin(g.time * 14) * 0.12})` : "");
        }
      }
      if (!e.boss && e.hp < e.maxHp && (e.aware || e.object)) {
        const s = this.project(cam, e.x, top, e.y, w, h);
        if (s) {
          const el = this.bars.take();
          (el.firstChild as HTMLElement).style.width = `${Math.max(0, (e.hp / e.maxHp) * 100)}%`;
          at(el, s.x, s.y);
        }
      }
    }
    this.meters.end();
    this.bars.end();

    const lock = g.lock;
    const ls = lock && lock.state !== "dead" ? this.project(cam, lock.x, heightOf(lock) * 0.6, lock.y, w, h) : null;
    this.reticle.style.display = ls ? "" : "none";
    if (ls) this.reticle.style.transform = `translate(${ls.x}px, ${ls.y}px) translate(-50%, -50%) rotate(${g.time * 90}deg)`;

    // Objective marker: over the target, or pinned to the screen edge.
    const obj = g.objectivePoint();
    this.marker.style.display = obj && !g.cine ? "" : "none";
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
      const label = this.marker.lastChild as HTMLElement;
      const t = `${Math.round(d)}m`;
      if (label.textContent !== t) label.textContent = t;
      this.marker.style.opacity = d < 5 ? "0.3" : "1";
      this.marker.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    }
  }

  dispose() {
    this.root.remove();
  }
}
