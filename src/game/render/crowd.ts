import * as THREE from "three";
import type { Game } from "../engine/game";
import type { Rect, Vec, Zone } from "../engine/state";
import { gait, survivorLook } from "./anim";
import type { CityScene } from "./city";
import { applyPose, buildRig, clothMat, cyl, disposeRig, easeYaw, mats, mixPose, part, restPose, type Pose, type Rig } from "./rig";

// The city's people: survivors walking the streets, huddled round burning barrels, talking in
// pairs or squatting against walls. They glance at the hero as he passes, step out of his way,
// and scatter in panic when blades come out. The crowd lives only around the player, spawning
// out in the haze and fading away behind him, so it costs little wherever you are.

const TAU = Math.PI * 2;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Where people can stand: inside the zone, outside buildings, walls, cars and the stronghold. */
export class Ground {
  private solids: Rect[];
  private houses: Rect[];
  constructor(readonly zone: Zone) {
    this.houses = zone.buildings;
    this.solids = [...zone.buildings, ...zone.walls, ...zone.cover, ...(zone.fortress ? [zone.fortress] : [])];
  }
  free(x: number, y: number, pad = 0.45, onlyHouses = false) {
    const z = this.zone;
    if (x < 2.5 || y < 2.5 || x > z.w - 2.5 || y > z.h - 2.5) return false;
    for (const r of onlyHouses ? this.houses : this.solids) {
      if (x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad) return false;
    }
    return true;
  }
  /** A free spot between rMin and rMax metres from a point. */
  spot(c: Vec, rMin: number, rMax: number, pad = 0.6): Vec | null {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * TAU;
      const d = rMin + Math.random() * (rMax - rMin);
      const x = c.x + Math.cos(a) * d;
      const y = c.y + Math.sin(a) * d;
      if (this.free(x, y, pad)) return { x, y };
    }
    return null;
  }
}

type Mood = "walk" | "idle" | "warm" | "talk" | "squat" | "flee";

interface Ped {
  rig: Rig;
  mood: Mood;
  x: number;
  y: number;
  heading: number;
  speed: number;
  t: number;
  phase: number;
  seed: number;
  focus: Vec | null;
  pace: number;
  fire: number;
  umbrella: boolean;
  shadows: boolean;
}

const IDLE_ARMS: Partial<Pose> = { armR: [-0.12, 0.12, -0.3], armL: [-0.1, 0.12, -0.3] };

export class Crowd {
  readonly group = new THREE.Group();
  private peds: Ped[] = [];
  private spawnT = 0;
  private first = true;
  private fireBusy = new Map<number, number>();
  private fires: Vec[];
  private max: number;

  constructor(
    private ground: Ground,
    city: CityScene,
    private rainy: boolean,
    lowPower: boolean,
  ) {
    this.fires = city.emitters.filter((e) => e.kind === "fire").map((e) => ({ x: e.pos.x, y: e.pos.z }));
    this.max = lowPower ? 5 : 10;
  }

  private make(at: Vec, mood: Mood, heading: number, focus: Vec | null = null, fire = -1): Ped {
    const seed = Math.floor(Math.random() * 1e9);
    const look = survivorLook(seed);
    const rig = buildRig(look);
    const umbrella = this.rainy && mood !== "warm" && mood !== "squat" && Math.random() < 0.35;
    if (umbrella) {
      // A black umbrella gripped naturally in the left hand (local +z aligns with world +y when armL sums to -pi/2).
      const u = new THREE.Group();
      u.position.set(0, -0.05, 0.01);
      u.rotation.x = Math.PI / 2;
      const pole = part(cyl(0.008, 0.008, 0.96, 8), mats().iron);
      pole.position.y = 0.44;
      const handle = part(cyl(0.014, 0.014, 0.11, 8), mats().wood);
      handle.position.y = -0.02;
      const canopyMat = clothMat(0x101114);
      canopyMat.side = THREE.DoubleSide;
      const canopy = part(new THREE.ConeGeometry(0.56, 0.24, 12, 1, true), canopyMat);
      canopy.position.y = 0.94;
      canopy.userData.own = true;
      u.add(pole, handle, canopy);
      rig.armL.end.add(u);
      rig.mats.push(canopyMat);
    }
    rig.root.position.set(at.x, 0, at.y);
    this.group.add(rig.root);
    const p: Ped = { rig, mood, x: at.x, y: at.y, heading, speed: 0, t: 4 + Math.random() * 10, phase: Math.random() * TAU, seed, focus, pace: 1.15 + Math.random() * 0.45, fire, umbrella, shadows: true };
    this.peds.push(p);
    return p;
  }

  private drop(p: Ped) {
    this.group.remove(p.rig.root);
    disposeRig(p.rig);
    if (p.fire >= 0) this.fireBusy.set(p.fire, (this.fireBusy.get(p.fire) ?? 1) - 1);
  }

  private populate(hero: Vec) {
    const g = this.ground;
    const walkers = this.peds.filter((p) => p.fire < 0).length;
    const near = this.first ? 5 : 26;
    const far = this.first ? 38 : 44;
    if (walkers < this.max) {
      const roll = Math.random();
      if (roll < 0.15) {
        // Two people talking.
        const a = g.spot(hero, near, far);
        if (a) {
          const h = Math.random() * TAU;
          const b = { x: a.x + Math.cos(h) * 1.1, y: a.y + Math.sin(h) * 1.1 };
          if (g.free(b.x, b.y)) {
            const p1 = this.make(a, "talk", h, b);
            const p2 = this.make(b, "talk", h + Math.PI, a);
            p1.t = p2.t = 8 + Math.random() * 14;
          }
        }
      } else if (roll < 0.3) {
        // Someone squatting against a wall.
        const houses = g.zone.buildings.filter((b) => {
          const d = Math.hypot(b.x + b.w / 2 - hero.x, b.y + b.h / 2 - hero.y);
          return d > near && d < far;
        });
        const b = houses[Math.floor(Math.random() * houses.length)];
        if (b) {
          const side = Math.floor(Math.random() * 4);
          const k = 0.15 + Math.random() * 0.7;
          const at = [
            { x: b.x + b.w * k, y: b.y - 0.55, h: -Math.PI / 2 },
            { x: b.x + b.w + 0.55, y: b.y + b.h * k, h: 0 },
            { x: b.x + b.w * k, y: b.y + b.h + 0.55, h: Math.PI / 2 },
            { x: b.x - 0.55, y: b.y + b.h * k, h: Math.PI },
          ][side];
          if (g.free(at.x, at.y, 0.2)) this.make(at, "squat", at.h).t = 1e9;
        }
      } else {
        const at = g.spot(hero, near, far);
        if (at) this.make(at, roll < 0.85 ? "walk" : "idle", Math.random() * TAU);
      }
    }
    // Small groups warming their hands round burning barrels.
    this.fires.forEach((f, i) => {
      if ((this.fireBusy.get(i) ?? 0) > 0) return;
      const d = Math.hypot(f.x - hero.x, f.y - hero.y);
      if (d > 38 || (!this.first && d < 22)) return;
      const n = 2 + Math.floor(Math.random() * 2);
      const a0 = Math.random() * TAU;
      let made = 0;
      for (let k = 0; k < n; k++) {
        const a = a0 + (k / n) * TAU + (Math.random() - 0.5) * 0.5;
        const at = { x: f.x + Math.cos(a) * 1.25, y: f.y + Math.sin(a) * 1.25 };
        if (!this.ground.free(at.x, at.y, 0.3)) continue;
        const p = this.make(at, Math.random() < 0.25 ? "squat" : "warm", a + Math.PI, f, i);
        p.t = 1e9;
        made++;
      }
      // A barrel with no room around it is left alone.
      this.fireBusy.set(i, made || 99);
    });
    this.first = false;
  }

  update(dt: number, game: Game, time: number) {
    if (dt <= 0) return;
    const hero = game.player;
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 0.6;
      for (const p of [...this.peds]) {
        if (Math.hypot(p.x - hero.x, p.y - hero.y) > 58) {
          this.drop(p);
          this.peds.splice(this.peds.indexOf(p), 1);
        }
      }
      this.populate(hero);
    }

    // Anything that sends people running.
    const danger: (Vec & { r: number })[] = [];
    for (const e of game.enemies) {
      if (e.state !== "dead" && !e.object && e.aware) danger.push({ x: e.x, y: e.y, r: 15 });
    }
    if (hero.act.kind === "attack" || hero.act.kind === "takedown") danger.push({ x: hero.x, y: hero.y, r: 9 });

    for (const p of this.peds) this.step(p, dt, time, hero, danger);
  }

  private step(p: Ped, dt: number, time: number, hero: Vec & { speed: number; facing: number }, danger: (Vec & { r: number })[]) {
    const g = this.ground;
    const dHero = Math.hypot(p.x - hero.x, p.y - hero.y);
    // Panic: run from the nearest threat.
    let threat: Vec | null = null;
    for (const d of danger) if (Math.hypot(p.x - d.x, p.y - d.y) < d.r) threat = d;
    if (!threat && dHero < 1.3 && hero.speed > 5) threat = hero;
    if (threat) {
      if (p.mood !== "flee") {
        p.mood = "flee";
        p.focus = null;
        if (p.fire >= 0) {
          this.fireBusy.set(p.fire, (this.fireBusy.get(p.fire) ?? 1) - 1);
          p.fire = -1;
        }
      }
      p.t = 5 + Math.random() * 3;
      p.heading = Math.atan2(p.y - threat.y, p.x - threat.x) + (Math.random() - 0.5) * 0.4;
    }

    p.t -= dt;
    if (p.t <= 0) {
      if (p.mood === "walk") {
        p.mood = Math.random() < 0.3 ? "idle" : "walk";
        p.heading += (Math.random() - 0.5) * 1.6;
        p.t = p.mood === "idle" ? 2 + Math.random() * 4 : 5 + Math.random() * 9;
      } else {
        p.mood = "walk";
        p.focus = null;
        p.t = 5 + Math.random() * 9;
      }
    }

    const moving = p.mood === "walk" || p.mood === "flee";
    const want = p.mood === "flee" ? 5.6 : moving ? p.pace : 0;
    p.speed += (want - p.speed) * (1 - Math.exp(-dt * (p.mood === "flee" ? 6 : 3.2)));
    if (p.speed > 0.05) {
      // Smoothly steer round walls, cars, the hero, and other pedestrians.
      let wish = p.heading;
      if (dHero < 2.4 && p.mood !== "flee") {
        const away = Math.atan2(p.y - hero.y, p.x - hero.x);
        if (Math.abs(wrap(away - p.heading)) > 1.0) wish = p.heading + Math.sign(wrap(away - p.heading)) * 0.75;
      }
      for (const o of this.peds) {
        if (o === p) continue;
        const dx = p.x - o.x;
        const dy = p.y - o.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.05 && d < 1.15) {
          const away = Math.atan2(dy, dx);
          const rel = wrap(away - wish);
          if (Math.abs(rel) < 2.2) wish += Math.sign(rel || 1) * (1.15 - d) * 0.7;
        }
      }
      const look = 1.15 + p.speed * 0.25;
      let found = false;
      for (const off of [0, 0.3, -0.3, 0.65, -0.65, 1.05, -1.05, 1.55, -1.55, 2.2, -2.2, Math.PI]) {
        const h = wish + off;
        if (g.free(p.x + Math.cos(h) * look, p.y + Math.sin(h) * look, 0.4)) {
          wish = h;
          found = true;
          break;
        }
      }
      if (!found) p.speed *= Math.exp(-dt * 4);
      const turn = wrap(wish - p.heading);
      p.heading += turn * (1 - Math.exp(-dt * (p.mood === "flee" ? 9 : 4.5)));
      const nx = p.x + Math.cos(p.heading) * p.speed * dt;
      const ny = p.y + Math.sin(p.heading) * p.speed * dt;
      if (g.free(nx, ny, 0.35)) {
        const step = Math.min(1.8, Math.max(0.62, 0.62 + p.speed * 0.13));
        p.phase += ((p.speed * dt) / step) * Math.PI;
        p.x = nx;
        p.y = ny;
      } else {
        p.heading += dt * 2.8;
        p.speed *= 0.85;
      }
    } else if (p.focus) {
      p.heading += wrap(Math.atan2(p.focus.y - p.y, p.focus.x - p.x) - p.heading) * (1 - Math.exp(-dt * 4));
    }

    // Pose.
    let pose = mixPose(restPose(), IDLE_ARMS, 1);
    pose.breath = Math.sin(time * (p.mood === "flee" ? 6 : 2) + p.seed);
    const legs = Math.min(1, p.speed / 3.9) * 0.78;
    switch (p.mood) {
      case "flee":
        pose.lean = 0.28;
        pose.armR = [-0.25, 0.18, -1.35];
        pose.armL = [-0.25, 0.18, -1.35];
        pose = gait(pose, legs, p.phase, [0.9, 0.9]);
        pose.head = -0.14;
        break;
      case "warm":
        pose = mixPose(
          pose,
          {
            armR: [-1.1 + Math.sin(time * 3 + p.seed) * 0.04, -0.12, -1.05],
            armL: [-1.1 - Math.sin(time * 3 + p.seed) * 0.04, -0.12, -1.05],
            lean: 0.08,
            head: 0.18,
          },
          1,
        );
        pose.sway = Math.sin(time * 0.7 + p.seed) * 0.025;
        pose.wrist = Math.sin(time * 2.4 + p.seed) * 0.22;
        break;
      case "talk": {
        // Alternate conversational cadence between speakers using seed parity.
        const speaker = Math.sin(time * 1.15 + p.seed) > 0;
        const gest = speaker ? Math.max(0, Math.sin(time * 2.4 + p.seed)) : 0.12;
        pose = mixPose(
          pose,
          {
            armR: [-0.42 - gest * 0.52, 0.22, -1.15 - gest * 0.25],
            armL: [-0.14, 0.14, -0.55],
            head: speaker ? Math.sin(time * 2.6 + p.seed) * 0.07 : Math.sin(time * 1.4 + p.seed) * 0.05,
          },
          1,
        );
        pose.look = Math.sin(time * 0.5 + p.seed) * 0.12;
        pose.sway = Math.sin(time * 0.6 + p.seed) * 0.022;
        break;
      }
      case "squat":
        pose = mixPose(pose, { crouch: 0.84, lean: 0.34, head: 0.2, armR: [-0.88, 0.24, -0.72], armL: [-0.88, 0.24, -0.72] }, 1);
        break;
      default:
        pose = gait(pose, legs, p.phase, [0.4, 0.45]);
        pose.lean = 0.02 + Math.min(0.06, p.speed * 0.02);
        pose.head = -0.02;
        if (p.mood === "idle") {
          pose.look = Math.sin(time * 0.42 + p.seed) * 0.42;
          pose.sway = Math.sin(time * 0.6 + p.seed) * 0.02;
        }
    }
    if (p.umbrella) pose.armL = [-0.32, 0.14, -1.25];
    // Glance at the hero as he passes.
    if (dHero < 6 && p.mood !== "flee") {
      const rel = wrap(Math.atan2(hero.y - p.y, hero.x - p.x) - p.heading);
      if (Math.abs(rel) < 2) pose.look = Math.max(-1.1, Math.min(1.1, -rel));
    }

    p.rig.root.position.set(p.x, 0, p.y);
    p.rig.root.rotation.y = easeYaw(p.rig, Math.PI / 2 - p.heading, dt, 8).yaw;
    applyPose(p.rig, pose, dt, 12);

    // Only nearby people cast shadows.
    const shadows = dHero < 24;
    if (shadows !== p.shadows) {
      p.shadows = shadows;
      p.rig.root.traverse((o) => (o.castShadow = shadows && (o as THREE.Mesh).isMesh));
    }
  }

  dispose() {
    for (const p of this.peds) this.drop(p);
    this.peds = [];
  }
}
