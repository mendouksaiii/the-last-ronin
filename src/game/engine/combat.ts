import { WEAPONS } from "../data/weapons";
import { sound } from "../audio/soundEngine";
import type { Move } from "../types";
import { alert } from "./enemies";
import type { Game } from "./game";
import { moveBody3D, updateParkourAct } from "./parkour";
import { angleDiff, dist, type Enemy, type PlayerAct, type Vec } from "./state";

// The hero's combat. Every blow is committed: a wind-up, the strike, then a recovery in which he
// is open. Guarding costs stamina, a guard pressed just before a blow lands parries it, and a
// parry or a last-instant dodge opens a counter that hits far harder.

export const MAX_STAMINA = 100;
export const MAX_STIMS = 3;
const FLURRY_GAP = 0.075;
const PARRY_WINDOW = 0.2;
const COUNTER_WINDOW = 1.1;
const DODGE = { dur: 0.42, dist: 4.8, from: 0.03, to: 0.3, cost: 20 };

export const idleAct = (): PlayerAct => ({ kind: "idle", t: 0, dur: 0, move: null, landed: 0, dir: 0, bonus: 1, target: null });

const turnTo = (from: number, to: number, rate: number) => {
  const d = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + Math.max(-rate, Math.min(rate, d));
};

const living = (g: Game) => g.enemies.filter((e) => e.state !== "dead");

/** The best enemy to swing at: the lock-on target, else the nearest one roughly in front. */
function pickTarget(g: Game, range: number, dir: number): Enemy | null {
  const p = g.player;
  if (g.lock && g.lock.state !== "dead" && dist(p, g.lock) < range + 4) return g.lock;
  let best: Enemy | null = null;
  let score = Infinity;
  for (const e of living(g)) {
    const d = dist(p, e) - e.radius;
    if (d > range + 1.2) continue;
    const off = angleDiff(Math.atan2(e.y - p.y, e.x - p.x), dir);
    if (off > 1.7) continue;
    const s = d + off * 2.2;
    if (s < score) {
      score = s;
      best = e;
    }
  }
  return best;
}

function spend(g: Game, cost: number) {
  const p = g.player;
  if (p.stamina <= 0) {
    g.float(p, "Exhausted", "#9aa0a6");
    return false;
  }
  p.stamina = Math.max(0, p.stamina - cost);
  p.staminaT = g.time + (p.stamina === 0 ? 1.4 : 0.7);
  return true;
}

export function startAttack(g: Game, kind: "light" | "heavy" | "special") {
  const p = g.player;
  const w = WEAPONS[p.weapon];
  let move: Move;
  if (kind === "special") {
    if (p.specialCd > 0) {
      g.float(p, "Not ready", "#9aa0a6");
      return;
    }
    move = w.special;
  } else if (kind === "heavy") {
    move = w.heavy;
    p.combo = 0;
  } else {
    const i = p.comboT > 0 ? p.combo % w.light.length : 0;
    move = w.light[i];
    p.combo = i + 1;
  }
  if (!spend(g, move.stamina)) return;
  if (kind === "special") p.specialCd = w.special.cd;
  const moving = Math.hypot(p.vx, p.vy) > 0.5;
  const dir = moving && !g.lock ? Math.atan2(p.vy, p.vx) : p.facing;
  const target = pickTarget(g, move.range + move.lunge, dir) ?? g.engageTarget(dir);
  if (target) p.facing = Math.atan2(target.y - p.y, target.x - p.x);
  // Swinging at someone locks the camera on them.
  if (target && !target.object && g.lock !== target && (!g.lock || g.lockAuto)) {
    g.lock = target;
    g.lockAuto = true;
  }
  g.lastSwing = g.time;
  const counter = p.counterT > 0;
  p.counterT = 0;
  const hits = move.hits ?? 1;
  p.act = {
    kind: "attack",
    t: 0,
    dur: move.startup + (hits - 1) * FLURRY_GAP + move.recovery,
    move,
    landed: 0,
    dir: p.facing,
    bonus: counter ? (p.weapon === "katana" ? 3 : 2) : 1,
    target,
  };
  if (counter) g.float(p, "Counter", "#ff5a1f", true);
}

export function startDodge(g: Game) {
  const p = g.player;
  if (!spend(g, DODGE.cost)) return;
  const ax = g.moveInput();
  const dir = Math.hypot(ax.x, ax.y) > 0.2 ? Math.atan2(ax.y, ax.x) : p.facing + Math.PI;
  p.act = { ...idleAct(), kind: "dodge", dur: DODGE.dur, dir };
  p.combo = 0;
  sound.playSfx("dodge", { volume: 0.85, jitter: 0.08 });
  g.burst({ k: "ripple", x: p.x, y: p.y, z: p.z, n: 4, dir: dir + Math.PI, r: 0.9 });
  g.burst({ k: "dust", x: p.x, y: p.y, z: p.z, n: 4, dir: dir + Math.PI, r: 0.65 });
}

export function pressGuard(g: Game) {
  const p = g.player;
  // Guarding cancels the tail of an attack, but not its wind-up.
  if (p.act.kind === "attack" && p.act.move && p.act.t > p.act.move.startup + 0.05) p.act = idleAct();
  if (p.act.kind === "idle") p.parryT = PARRY_WINDOW;
}

export function drinkStim(g: Game) {
  const p = g.player;
  if (p.act.kind !== "idle" || p.stims <= 0 || p.hp >= p.maxHp) return;
  p.stims--;
  p.act = { ...idleAct(), kind: "stim", dur: 0.95 };
  sound.playSfx("stim", { volume: 0.85 });
}

/** An unaware enemy reachable from behind, or a staggered one ready to be finished. */
export function finisherTarget(g: Game): { e: Enemy; kind: "takedown" | "execute" } | null {
  const p = g.player;
  if (p.act.kind !== "idle") return null;
  let best: { e: Enemy; kind: "takedown" | "execute" } | null = null;
  let bestD = Infinity;
  for (const e of living(g)) {
    if (e.object || e.decoy) continue;
    const d = dist(p, e);
    if (d > 2.1 || d > bestD) continue;
    if (!e.aware && !e.boss && angleDiff(Math.atan2(p.y - e.y, p.x - e.x), e.facing) > 1.5) {
      best = { e, kind: "takedown" };
      bestD = d;
    } else if (e.state === "stagger") {
      best = { e, kind: "execute" };
      bestD = d;
    }
  }
  return best;
}

export function startFinisher(g: Game, f: { e: Enemy; kind: "takedown" | "execute" }) {
  const p = g.player;
  const e = f.e;
  // Step in to arm's length behind or in front of the target.
  const a = f.kind === "takedown" ? e.facing + Math.PI : Math.atan2(p.y - e.y, p.x - e.x);
  p.x = e.x + Math.cos(a) * 1.05;
  p.y = e.y + Math.sin(a) * 1.05;
  p.facing = Math.atan2(e.y - p.y, e.x - p.x);
  p.vx = p.vy = 0;
  e.stun = 2;
  if (f.kind === "takedown") e.facing = Math.atan2(e.y - p.y, e.x - p.x) + Math.PI;
  p.act = { ...idleAct(), kind: "takedown", dur: 1.15, target: e, bonus: f.kind === "takedown" ? 1 : 2 };
  p.invuln = 1.2;
  sound.playSfx("drawBlade", { volume: 0.85 });
  g.cinematic(1.0, e);
}

function landFinisher(g: Game) {
  const p = g.player;
  const e = p.act.target;
  if (!e || e.state === "dead") return;
  const execute = p.act.bonus === 2;
  const ang = Math.atan2(e.y - p.y, e.x - p.x);
  sound.playSfx("finisher", { volume: 1.0 });
  sound.playSfx("hitHeavy", { volume: 0.9, at: e });
  g.burst({ k: "slash", x: p.x, y: p.y, z: p.z, n: 12, dir: ang, r: 2.35, tilt: 0.62, color: execute ? 0xffc850 : 0xff3b28 });
  g.burst({ k: "slash", x: p.x, y: p.y, z: p.z, n: 10, dir: ang, r: 2.1, tilt: -0.62, color: 0xe01830 });
  g.burst({ k: "ring", x: e.x, y: e.y, z: p.z, n: 1, dir: ang, r: 3.6, color: execute ? 0xffb838 : 0xe02030 });
  g.burst({ k: "spark", x: e.x, y: e.y, z: p.z, n: 14, dir: ang, color: 0xffd078 });
  g.burst({ k: "blood", x: e.x, y: e.y, z: p.z, n: 26, dir: ang });
  g.hitstop = 0.14;
  g.shake(0.25);
  if (e.boss || e.elite) {
    // Generals and lieutenants survive a finisher, badly hurt.
    const dmg = Math.round(e.maxHp * (e.boss ? 0.16 : 0.45));
    e.hp -= dmg;
    g.float(e, `${dmg}`, "#ff5a1f", true);
    e.state = "recover";
    e.t = 0.6;
    e.poise = 0;
    alert(g, e, p);
    if (e.hp <= 0) g.kill(e, "takedown");
    return;
  }
  g.kill(e, "takedown");
  g.float(e, execute ? "Executed" : "Silent", "#c8102e", true);
  // Anyone who sees it raises the alarm.
  for (const o of living(g)) {
    if (o.object || o.aware || dist(o, e) > 12) continue;
    if (g.lineOfSight(o, e, false) && angleDiff(Math.atan2(e.y - o.y, e.x - o.x), o.facing) < 1.2) alert(g, o, p);
  }
}

/** Color for Ghost-of-Tsushima slash waves based on move tier and counter state. */
function slashColor(move: Move, counter: boolean): number {
  if (counter) return 0xff6e24;
  switch (move.tier) {
    case "special":
      return 0xffb838;
    case "heavy":
      return 0xff3838;
    case "finisher":
      return 0xffc850;
    default:
      return 0x9ad4ff;
  }
}

/** Lands a blow from the hero's current move on everything inside its arc. */
function land(g: Game) {
  const p = g.player;
  const a = p.act;
  const move = a.move;
  if (!move) return;
  const counter = a.bonus > 1;
  const color = slashColor(move, counter);

  // Emit glowing 3D crescent slash waves & wind sparks on blade release.
  const isFlurry = (move.hits ?? 1) > 2;
  if (!isFlurry || a.landed % 2 === 0) {
    if (move.tier === "special") sound.playSfx("swingSpecial", { volume: 0.95 });
    else if (move.tier === "heavy" || move.dmg >= 1.5) sound.playSfx("swingHeavy", { volume: 0.88 });
    else sound.playSfx("swingLight", { volume: 0.82 });
    const tiltBase = move.arcTilt ?? 0.25;
    const tilt = a.landed % 2 === 1 ? -tiltBase : tiltBase;
    const waveR =
      move.anim === "flash"
        ? 2.85
        : move.anim === "helmSplitter"
          ? 2.3
          : move.anim === "cyclone" || move.anim === "crescent"
            ? Math.max(1.85, move.range * 0.62)
            : Math.max(1.45, move.range * 0.56);
    g.burst({
      k: "slash",
      x: p.x,
      y: p.y,
      z: p.z,
      n: move.tier === "special" || move.tier === "heavy" ? 14 : move.tier === "finisher" ? 11 : 7,
      dir: p.facing,
      r: waveR,
      tilt,
      color,
    });
    if (move.tier === "special" && (a.landed === 0 || a.landed % 4 === 0)) {
      const echoColor = move.anim === "flash" ? 0x6ce4ff : move.anim === "cyclone" ? 0xff4060 : 0xff5a1f;
      g.burst({
        k: "slash",
        x: p.x,
        y: p.y,
        z: p.z,
        n: 10,
        dir: p.facing + (a.landed % 2 === 0 ? 0.14 : -0.14),
        r: waveR * 1.18,
        tilt: -tilt * 0.55,
        color: echoColor,
      });
    }
  }

  const base = g.pdmg() * move.dmg * a.bonus;
  let hit = 0;
  const singleChain = p.weapon === "kusari" && move.arc < 0.5;
  let bestChain: Enemy | null = null;
  let bestChainD = Infinity;
  for (const e of living(g)) {
    const d = dist(p, e);
    if (d > move.range + e.radius) continue;
    if (angleDiff(Math.atan2(e.y - p.y, e.x - p.x), p.facing) > move.arc + 0.12) continue;
    if (!g.lineOfSight(p, e, false)) continue;
    if (singleChain) {
      if (d < bestChainD) {
        bestChainD = d;
        bestChain = e;
      }
      continue;
    }
    hitEnemy(g, e, base, move, counter);
    hit++;
  }
  if (bestChain) {
    hitEnemy(g, bestChain, base, move, counter);
    hit++;
  }
  if (move.anim === "overhead" || move.anim === "helmSplitter" || move.anim === "spin" || (move.anim === "cyclone" && a.landed === 0) || move.tier === "special") {
    const fxX = p.x + Math.cos(p.facing) * (move.anim === "helmSplitter" ? 1.35 : 0.8);
    const fxY = p.y + Math.sin(p.facing) * (move.anim === "helmSplitter" ? 1.35 : 0.8);
    if (move.tier === "special" || move.anim === "helmSplitter" || move.anim === "cyclone") {
      g.burst({ k: "ring", x: fxX, y: fxY, z: p.z, n: 1, dir: p.facing, r: move.tier === "special" ? 4.4 : 2.9, color });
      g.burst({ k: "spark", x: fxX, y: fxY, z: p.z, n: move.tier === "special" ? 14 : 9, dir: p.facing });
    } else {
      g.burst({ k: "dust", x: fxX, y: fxY, z: p.z, n: 8, dir: p.facing, r: 1.25 });
    }
  }
  if (!hit && move.anim === "throw") g.burst({ k: "spark", x: p.x + Math.cos(p.facing) * move.range, y: p.y + Math.sin(p.facing) * move.range, z: p.z, n: 4, dir: p.facing });
}

export function hitEnemy(g: Game, e: Enemy, raw: number, move: Move, counter: boolean) {
  const p = g.player;
  const ang = Math.atan2(e.y - p.y, e.x - p.x);
  let mult = 1;
  if (e.state === "stagger" || e.stun > 0) mult *= 1.5;
  if (e.guardT > 0) mult *= 0.25;
  if (!e.aware && !e.object) mult *= 2.5;
  const dmg = Math.max(1, Math.round(raw * mult * (0.92 + Math.random() * 0.16)));
  e.hp -= dmg;
  e.flash = 0.12;
  g.float(e, `${dmg}`, counter ? "#ff5a1f" : "#d9d4cc", counter);
  if (e.object) sound.playSfx("hitWood", { at: e, volume: 0.9 });
  else if (e.guardT > 0) sound.playSfx("block", { at: e, volume: 0.85 });
  else if (counter || move.dmg >= 1.5 || move.tier === "special") sound.playSfx("hitHeavy", { at: e, volume: 0.92 });
  else sound.playSfx("hitFlesh", { at: e, volume: 0.88 });
  g.burst({ k: e.object ? "spark" : "blood", x: e.x, y: e.y, z: p.z, n: Math.min(22, 5 + Math.round(dmg / 6)), dir: ang });
  if (e.guardT > 0 || counter || move.tier === "heavy" || move.tier === "special" || move.tier === "finisher") {
    g.burst({ k: "spark", x: e.x, y: e.y, z: p.z, n: e.guardT > 0 ? 10 : counter || move.tier === "special" ? 9 : 5, dir: ang + Math.PI });
  }
  g.hitstop = Math.max(g.hitstop, counter || move.dmg >= 1.5 ? 0.11 : 0.045);
  g.shake(counter || move.dmg >= 1.5 ? 0.18 : 0.07);
  if (!e.object) {
    alert(g, e, p);
    e.poise += move.stagger * (counter ? 2.2 : 1) * (e.boss ? 0.6 : 1);
    if (e.poise >= e.maxPoise && e.state !== "stagger") {
      e.state = "stagger";
      e.t = e.boss ? 1.8 : 1.4;
      e.guardT = 0;
      e.token = false;
      sound.playSfx("guardBreak", { at: e, volume: 0.9 });
      g.float(e, "Broken", "#ff5a1f", true);
      g.burst({ k: "guardBreak", x: e.x, y: e.y, z: p.z, n: 12, dir: ang, r: 2.8 });
    } else if (e.state === "windup" && !e.boss && (move.stagger >= 40 || counter) && e.arch !== "brute") {
      e.state = "recover";
      e.t = 0.4;
    }
    if (!e.boss && e.arch !== "brute") {
      if (move.kb) {
        e.kx = Math.cos(ang) * move.kb * 4;
        e.ky = Math.sin(ang) * move.kb * 4;
      }
      if (move.pull) {
        const to = { x: p.x + Math.cos(ang) * 1.5, y: p.y + Math.sin(ang) * 1.5 };
        g.moveBody(e, to.x - e.x, to.y - e.y, e.radius);
        if (e.state !== "stagger") {
          e.state = "recover";
          e.t = 0.8;
        }
      }
    }
    if (move.stun) e.stun = Math.max(e.stun, e.boss ? move.stun * 0.4 : move.stun);
  }
  if (e.hp <= 0) g.kill(e, "blow");
}

/** The hero is struck. Returns nothing: parries, guards and dodges are resolved here. */
export function hurtPlayer(g: Game, dmg: number, from: Vec | null, perilous: boolean, attacker: Enemy | null) {
  const p = g.player;
  if (p.hp <= 0) return;
  if (p.invuln > 0) {
    if (p.act.kind === "dodge" && p.act.t < 0.26 && p.counterT <= 0) {
      p.counterT = COUNTER_WINDOW;
      g.slow(0.35);
      g.float(p, "Perfect dodge", "#ff8a1f", true);
      g.burst({ k: "ring", x: p.x, y: p.y, z: p.z, n: 1, dir: p.facing, r: 2.2, color: 0xffaa30 });
      g.burst({ k: "spark", x: p.x, y: p.y, z: p.z, n: 8, dir: p.facing, color: 0xffc850 });
    }
    return;
  }
  const facing = !from || angleDiff(Math.atan2(from.y - p.y, from.x - p.x), p.facing) < 1.5;
  const guarding = p.act.kind === "idle" && p.blocking;
  if (!perilous && facing && p.parryT > 0 && (p.act.kind === "idle" || guarding)) {
    p.parryT = 0;
    p.counterT = COUNTER_WINDOW;
    p.stamina = Math.min(MAX_STAMINA, p.stamina + 12);
    sound.playSfx("parry", { volume: 1.0, jitter: 0.05 });
    g.burst({ k: "parry", x: p.x + Math.cos(p.facing) * 0.6, y: p.y + Math.sin(p.facing) * 0.6, z: p.z, n: 16, dir: p.facing });
    g.hitstop = 0.12;
    g.slow(0.3);
    g.shake(0.15);
    g.float(p, "Parry", "#ff5a1f", true);
    if (attacker && !attacker.object) {
      attacker.poise += attacker.maxPoise * (attacker.boss ? 0.3 : 0.6);
      if (attacker.poise >= attacker.maxPoise) {
        attacker.state = "stagger";
        attacker.t = attacker.boss ? 1.6 : 1.4;
        attacker.guardT = 0;
        attacker.token = false;
        sound.playSfx("guardBreak", { at: attacker, volume: 0.85 });
        g.float(attacker, "Broken", "#ff5a1f", true);
      } else {
        attacker.state = "recover";
        attacker.t = 0.9;
      }
    }
    return;
  }
  if (!perilous && facing && guarding) {
    p.stamina -= dmg * 1.4;
    p.staminaT = g.time + 0.8;
    const gx = p.x + Math.cos(p.facing) * 0.5;
    const gy = p.y + Math.sin(p.facing) * 0.5;
    g.burst({ k: "spark", x: gx, y: gy, z: p.z, n: 8, dir: p.facing });
    g.burst({ k: "ring", x: gx, y: gy, z: p.z + 0.9, n: 1, dir: p.facing, r: 1.35, color: 0xffe098 });
    if (from) push(g, from, 0.35);
    if (p.stamina > 0) {
      const chip = Math.round(dmg * 0.1);
      p.hp -= chip;
      p.lastHurt = g.time;
      sound.playSfx("block", { volume: 0.9 });
      g.shake(0.06);
      if (p.hp <= 0) g.die();
      return;
    }
    p.stamina = 0;
    p.staminaT = g.time + 1.6;
    sound.playSfx("guardBreak", { volume: 0.95 });
    g.float(p, "Guard broken", "#c8102e", true);
    g.burst({ k: "guardBreak", x: p.x, y: p.y, z: p.z, n: 14, dir: p.facing, r: 3.1, color: 0xe02838 });
    p.act = { ...idleAct(), kind: "broken", dur: 1.1 };
    dmg *= 0.5;
  }
  if (perilous && guarding) g.float(p, "Unblockable", "#c8102e");
  const taken = Math.round(dmg);
  p.hp -= taken;
  p.lastHurt = g.time;
  p.flash = 0.18;
  p.combo = 0;
  p.counterT = 0;
  p.ledge = null;
  p.wallSide = 0;
  sound.playSfx("hurt", { volume: taken > 25 ? 1.0 : 0.82 });
  g.float(p, `-${taken}`, "#e0102a");
  g.burst({ k: "blood", x: p.x, y: p.y, z: p.z, n: 12, dir: from ? Math.atan2(p.y - from.y, p.x - from.x) : 0 });
  g.shake(taken > 25 ? 0.45 : 0.25);
  g.hitstop = Math.max(g.hitstop, 0.08);
  if (p.act.kind !== "broken") p.act = { ...idleAct(), kind: "hurt", dur: taken > 25 ? 0.9 : 0.45 };
  if (from) push(g, from, taken > 25 ? 1.6 : 0.7);
  if (p.hp <= 0) g.die();
}

function push(g: Game, from: Vec, d: number) {
  const p = g.player;
  const a = Math.atan2(p.y - from.y, p.x - from.x);
  g.moveBody(p, Math.cos(a) * d, Math.sin(a) * d, 0.4);
}

/** Advances the hero's current action. Returns true while the hero may move freely. */
export function updateAct(g: Game, dt: number): boolean {
  const p = g.player;
  const a = p.act;
  a.t += dt;
  const parkourFree = updateParkourAct(g, dt);
  if (parkourFree !== null) return parkourFree;
  switch (a.kind) {
    case "attack": {
      const m = a.move;
      if (!m) break;
      const dashWindow = m.anim === "flash" ? m.startup + 0.09 : m.startup;
      // Step or surge into the blow during wind-up (and flash follow-through).
      if (a.t <= dashWindow) {
        const step = (m.lunge / dashWindow) * dt;
        const t = a.target;
        const close = t && t.state !== "dead" ? dist(p, t) - t.radius - 0.9 : Infinity;
        const d = Math.min(step, Math.max(0, close));
        moveBody3D(g, p, Math.cos(p.facing) * d, Math.sin(p.facing) * d, 0.4, p.z);
        if (t && t.state !== "dead") p.facing = turnTo(p.facing, Math.atan2(t.y - p.y, t.x - p.x), dt * 6);
        if (m.anim === "flash" && Math.random() < dt * 28) {
          g.burst({ k: "slide", x: p.x, y: p.y, z: p.z, n: 3, dir: p.facing + Math.PI, r: 0.55 });
        }
      }
      const hits = m.hits ?? 1;
      while (a.landed < hits && a.t >= m.startup + a.landed * FLURRY_GAP) {
        land(g);
        a.landed++;
      }
      // A queued attack cuts the recovery short once the blow has landed, so the chain flows.
      const chainAt = m.startup + (hits - 1) * FLURRY_GAP + (m.chain ?? 0.16);
      const queued = p.buffer === "light" || p.buffer === "heavy" || p.buffer === "special";
      if (a.t >= a.dur || (queued && a.landed >= hits && a.t >= chainAt)) {
        p.act = idleAct();
        p.comboT = 0.65;
        return true;
      }
      return false;
    }
    case "dodge": {
      const k = Math.max(0, 1 - a.t / (DODGE.dur * 0.8));
      const sp = (DODGE.dist / DODGE.dur) * 1.9 * k;
      moveBody3D(g, p, Math.cos(a.dir) * sp * dt, Math.sin(a.dir) * sp * dt, 0.4, p.z);
      p.invuln = a.t > DODGE.from && a.t < DODGE.to ? 0.02 : p.invuln;
      if (a.t >= a.dur) p.act = idleAct();
      return false;
    }
    case "stim":
      if (a.landed === 0 && a.t > 0.6) {
        a.landed = 1;
        const heal = Math.round(p.maxHp * 0.4);
        p.hp = Math.min(p.maxHp, p.hp + heal);
        g.float(p, `+${heal}`, "#8fbf8f");
        g.burst({ k: "heal", x: p.x, y: p.y, z: p.z, n: 16, dir: 0, r: 2.2 });
      }
      if (a.t >= a.dur) p.act = idleAct();
      return false;
    case "takedown":
      if (a.landed === 0 && a.t > 0.42) {
        a.landed = 1;
        landFinisher(g);
      }
      if (a.t >= a.dur) p.act = idleAct();
      return false;
    case "hurt":
    case "broken":
      if (p.hp <= 0 && a.kind === "broken" && a.landed === 0 && a.t >= 0.8) {
        a.landed = 1;
        g.burst({ k: "dust", x: p.x, y: p.y, z: p.z, n: 10, dir: p.facing, r: 1.1 });
        g.shake(0.14);
      }
      if (p.hp > 0 && a.t >= a.dur) p.act = idleAct();
      return false;
    default:
      return true;
  }
}

/** Whether a press should wait for the current action to end rather than be dropped. */
export function canBuffer(g: Game) {
  const a = g.player.act;
  if (a.kind === "attack" && a.move) return a.t > a.move.startup * 0.4;
  if (a.kind === "slide") return a.t > 0.25;
  if (a.kind === "vault" || a.kind === "parkour_roll") return a.t > 0.2;
  return a.kind === "dodge" && a.t > 0.25;
}

export const DODGE_COST = DODGE.cost;
