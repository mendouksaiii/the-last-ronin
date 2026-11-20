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
    if (x < 2 || y < 2 || x > z.w - 2 || y > z.h - 2) return false;
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
      // A black umbrella held up in the left hand.
      const u = new THREE.Group();
      u.position.set(0.16, 0.5, 0.22);
      const pole = part(cyl(0.008, 0.008, 1.0, 6), mats().iron);
      pole.position.y = 0.45;
      const canopyMat = clothMat(0x101114);
      canopyMat.side = THREE.DoubleSide;
      const canopy = part(new THREE.ConeGeometry(0.55, 0.24, 10, 1, true), canopyMat);
      canopy.position.y = 0.95;
      canopy.userData.own = true;
      u.add(pole, canopy);
      rig.torso.add(u);
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
    p.speed += (want - p.speed) * (1 - Math.exp(-dt * (p.mood === "flee" ? 6 : 3)));
    if (p.speed > 0.05) {
      // Steer round walls, cars and the hero, testing directions either side of the wish.
      let wish = p.heading;
      if (dHero < 2.2 && p.mood !== "flee") {
        const away = Math.atan2(p.y - hero.y, p.x - hero.x);
        if (Math.abs(wrap(away - p.heading)) > 1.2) wish = p.heading + Math.sign(wrap(away - p.heading)) * 0.8;
      }
      const look = 1.2 + p.speed * 0.25;
      let found = false;
      for (const off of [0, 0.35, -0.35, 0.75, -0.75, 1.2, -1.2, 1.8, -1.8, Math.PI]) {
        const h = wish + off;
        if (g.free(p.x + Math.cos(h) * look, p.y + Math.sin(h) * look, 0.4)) {
          wish = h;
          found = true;
          break;
        }
      }
      if (!found) p.speed *= 0.5;
      const turn = wrap(wish - p.heading);
      p.heading += Math.max(-dt * 4, Math.min(dt * 4, turn));
      const nx = p.x + Math.cos(p.heading) * p.speed * dt;
      const ny = p.y + Math.sin(p.heading) * p.speed * dt;
      if (g.free(nx, ny, 0.35)) {
        const step = Math.min(1.8, Math.max(0.6, 0.55 + p.speed * 0.18));
        p.phase += ((p.speed * dt) / step) * Math.PI;
        p.x = nx;
        p.y = ny;
      } else p.heading += 1.2;
    } else if (p.focus) {
      p.heading += wrap(Math.atan2(p.focus.y - p.y, p.focus.x - p.x) - p.heading) * Math.min(1, dt * 3);
    }

    // Pose.
    let pose = mixPose(restPose(), IDLE_ARMS, 1);
    pose.breath = Math.sin(time * (p.mood === "flee" ? 6 : 2) + p.seed);
    const legs = Math.min(1, p.speed / 4.5) * 0.8;
    switch (p.mood) {
      case "flee":
        pose.lean = 0.32;
        pose.armR = [-0.2, 0.18, -1.3];
        pose.armL = [-0.2, 0.18, -1.3];
        pose = gait(pose, legs, p.phase, [0.9, 0.9]);
        pose.head = -0.15;
        break;
      case "warm":
        pose = mixPose(pose, { armR: [-1.15, -0.1, -1.05], armL: [-1.15, -0.1, -1.05], lean: 0.12, head: 0.25 }, 1);
        pose.sway = Math.sin(time * 0.7 + p.seed) * 0.03;
        pose.wrist = Math.sin(time * 1.3 + p.seed) * 0.2;
        break;
      case "talk": {
        const gest = Math.max(0, Math.sin(time * 1.6 + p.seed));
        pose = mixPose(pose, { armR: [-0.5 - gest * 0.6, 0.25, -1.3], armL: [-0.15, 0.15, -0.6], head: Math.sin(time * 2.3 + p.seed) * 0.08 }, 1);
        pose.look = Math.sin(time * 0.5 + p.seed) * 0.15;
        pose.sway = Math.sin(time * 0.6 + p.seed) * 0.025;
        break;
      }
      case "squat":
        pose = mixPose(pose, { crouch: 0.85, lean: 0.4, head: 0.25, armR: [-0.9, 0.25, -0.7], armL: [-0.9, 0.25, -0.7] }, 1);
        break;
      default:
        pose = gait(pose, legs, p.phase, [0.4, 0.45]);
        pose.lean = 0.04;
        if (p.mood === "idle") pose.look = Math.sin(time * 0.4 + p.seed) * 0.5;
    }
    if (p.umbrella) pose.armL = [-0.75, 0.12, -1.55];
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
