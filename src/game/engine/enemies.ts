import { NATIONS } from "../data/nations";
import { sound } from "../audio/soundEngine";
import type { Archetype, AttackSpec } from "../types";
import type { Game } from "./game";
import { angleDiff, dist, segDist, type Enemy, type Vec } from "./state";

// Enemy and general behaviour, in metres. Every attack is telegraphed before it lands, and only a
// couple of enemies may attack the hero at once; the rest circle, waiting for an opening.

const ARCH: Record<Archetype, { hp: number; dmg: number; speed: number; r: number; xp: number; cd: number; poise: number; atk: AttackSpec }> = {
  melee: { hp: 70, dmg: 15, speed: 4.8, r: 0.42, xp: 14, cd: 1.25, poise: 45, atk: { k: "cone", windup: 0.5, dmg: 1, reach: 1.9, range: 2.3, half: 0.8 } },
  ranged: { hp: 45, dmg: 12, speed: 4.3, r: 0.4, xp: 14, cd: 1.9, poise: 30, atk: { k: "shots", windup: 0.75, dmg: 1, reach: 13, count: 1, spread: 0, speed: 18 } },
  brute: { hp: 190, dmg: 28, speed: 3.6, r: 0.62, xp: 34, cd: 2.1, poise: 130, atk: { k: "slam", windup: 0.95, dmg: 1, reach: 2.2, r: 2.7, perilous: true } },
  fast: { hp: 48, dmg: 11, speed: 7, r: 0.36, xp: 12, cd: 1.35, poise: 32, atk: { k: "charge", windup: 0.42, dmg: 1, reach: 4.2, dist: 4.8, width: 0.9 } },
};

/** At most this many enemies attack together; the rest wait their turn. */
const TOKENS = 2;
const SIGHT = 17;
const SIGHT_CROUCHED = 9;
const FOV = 1.15;

interface SpawnOpts {
  mission?: boolean;
  step?: boolean;
  elite?: string;
  camp?: number;
  chase?: boolean;
}

/** Enemies grow tougher with every general slain and slightly with each mission of a district. */
function scale(g: Game) {
  const lv = g.generals();
  const n = g.active?.m.n ?? 1;
  return { lv, hp: 1 + 0.45 * lv + 0.03 * (n - 1), dmg: 1 + 0.3 * lv + 0.02 * (n - 1) };
}

function patrolAround(home: Vec): Vec[] {
  const a = Math.random() * Math.PI * 2;
  const r = 4 + Math.random() * 4;
  return [
    { x: home.x + Math.cos(a) * r, y: home.y + Math.sin(a) * r },
    { x: home.x - Math.cos(a) * r, y: home.y - Math.sin(a) * r },
  ];
}

export function makeEnemy(g: Game, arch: Archetype, at: Vec, o: SpawnOpts = {}): Enemy {
  const b = ARCH[arch];
  const look = g.zone.enemies[arch];
  const s = scale(g);
  const hp = Math.round(b.hp * s.hp * (o.elite ? 3.5 : 1));
  const poise = b.poise * (o.elite ? 2 : 1);
  return {
    id: g.ids++,
    arch,
    name: o.elite ?? look.name,
    color: look.color,
    x: at.x,
    y: at.y,
    hp,
    maxHp: hp,
    dmg: b.dmg * s.dmg * (o.elite ? 1.35 : 1),
    speed: b.speed,
    radius: b.r * (o.elite ? 1.2 : 1),
    xp: Math.round(b.xp * (1 + 0.3 * s.lv) * (o.elite ? 5 : 1)),
    state: o.chase ? "chase" : "patrol",
    t: 0,
    tw: 1,
    aim: 0,
    facing: Math.random() * Math.PI * 2,
    home: { x: at.x, y: at.y },
    patrol: patrolAround(at),
    patrolI: 0,
    camp: o.camp ?? -1,
    mission: !!o.mission,
    step: !!o.step,
    elite: !!o.elite,
    object: false,
    beast: g.zone.beast === arch && !o.elite,
    decoy: false,
    boss: null,
    atk: b.atk,
    atkIdx: 0,
    cd: b.cd,
    chaseT: 0,
    stun: 0,
    flash: 0,
    guardT: 0,
    poise: 0,
    maxPoise: poise,
    suspicion: o.chase ? 1 : 0,
    lastSeen: null,
    aware: !!o.chase,
    kx: 0,
    ky: 0,
    walk: Math.random() * 6,
    deadT: 0,
    token: false,
    circleDir: Math.random() < 0.5 ? -1 : 1,
    killedBy: null,
    dodgeCd: 0,
    dodgeDir: 0,
    dodgeInvuln: 0,
    dodgeSpeed: 0,
    comboLeft: 0,
    phase2: false,
  };
}

export function makeObject(g: Game, label: string, at: Vec): Enemy {
  const e = makeEnemy(g, "melee", at, { mission: true, step: true });
  const hp = Math.round(60 * scale(g).hp);
  return { ...e, name: label, object: true, hp, maxHp: hp, radius: 0.75, speed: 0, xp: 0, aware: false, state: "idle", maxPoise: 1e9, color: g.zone.env.building };
}

export function makeBoss(g: Game, at: Vec): Enemy {
  const general = NATIONS[g.zone.nation].general;
  const def = general.boss;
  const s = scale(g);
  const e = makeEnemy(g, "melee", at, { mission: true, step: true, chase: false });
  const hp = Math.round(def.hp * (1 + 0.45 * s.lv));
  return {
    ...e,
    name: general.title,
    color: general.color,
    hp,
    maxHp: hp,
    dmg: def.dmg * (1 + 0.3 * s.lv),
    speed: def.speed,
    radius: def.radius,
    xp: Math.round(160 * (1 + 0.3 * s.lv)),
    boss: def,
    bossStyle: def.look,
    atk: def.pattern[0],
    facing: Math.PI,
    state: "idle",
    maxPoise: 260,
    patrol: [],
  };
}

function makeDecoy(g: Game, boss: Enemy, at: Vec, aim: number): Enemy {
  return {
    ...boss,
    id: g.ids++,
    x: at.x,
    y: at.y,
    home: { x: at.x, y: at.y },
    facing: aim,
    aim,
    hp: 1,
    maxHp: 1,
    dmg: boss.dmg * 0.5,
    speed: boss.speed * 1.1,
    xp: 0,
    boss: null,
    bossStyle: boss.bossStyle,
    decoy: true,
    step: false,
    atk: ARCH.melee.atk,
    cd: 0.35 + Math.random() * 0.5,
    t: 0,
    tw: 1,
    stun: 0,
    flash: 0,
    guardT: 0,
    kx: 0,
    ky: 0,
    deadT: 0,
    token: false,
    state: "chase",
    chaseT: 0,
    aware: true,
    maxPoise: 1,
    poise: 0,
    dodgeCd: 99,
    dodgeInvuln: 0,
    comboLeft: 0,
    phase2: false,
  };
}

function bossPattern(e: Enemy): AttackSpec[] {
  const b = e.boss!;
  return e.phase2 && b.phase2Pattern?.length ? b.phase2Pattern : b.pattern;
}

/** Alert an enemy, and nearby friends who hear the shout. */
export function alert(g: Game, e: Enemy, at: Vec) {
  if (e.object || e.state === "dead") return;
  const was = e.aware;
  e.aware = true;
  e.suspicion = 1;
  e.lastSeen = { x: at.x, y: at.y };
  if (["idle", "patrol", "search", "home"].includes(e.state)) {
    e.state = "chase";
    e.chaseT = 0;
  }
  if (!was) {
    g.float(e, "!", "#e0102a", true);
    if (!e.boss && !e.beast) sound.playSfx("enemyAlert", { at: e, volume: 0.85 });
    if (!e.boss && !e.decoy) g.onEnemyAlerted(e);
    for (const o of g.enemies) {
      if (o !== e && !o.aware && !o.object && o.state !== "dead" && dist(o, e) < 13) {
        o.suspicion = Math.max(o.suspicion, 0.8);
        o.lastSeen = { x: at.x, y: at.y };
        o.state = "search";
      }
    }
  }
}

/** Lands the attack an enemy has been winding up. */
function resolve(g: Game, e: Enemy) {
  const spec = e.atk;
  const dmg = e.dmg * spec.dmg;
  const perilous = !!spec.perilous;
  switch (spec.k) {
    case "cone":
    case "combo": {
      if (spec.k === "combo") {
        const step = spec.step ?? 1.0;
        g.moveBody(e, Math.cos(e.aim) * step, Math.sin(e.aim) * step, e.radius, 0.15);
        g.clampToArena(e);
      }
      const range = spec.range ?? 2.3;
      const half = spec.half ?? 0.8;
      sound.playSfx(spec.k === "combo" ? "swingHeavy" : "swingLight", { at: e, volume: 0.78 });
      g.burst({
        k: "slash",
        x: e.x,
        y: e.y,
        n: perilous ? 9 : 7,
        dir: e.aim,
        r: Math.max(1.5, range * 0.7),
        tilt: ((e.id + e.comboLeft) % 2 === 0 ? 1 : -1) * (perilous ? 0.25 : 0.44),
        color: perilous ? 0xff4a18 : 0xc8102e,
      });
      g.hitFriends(e, (p, r) => dist(p, e) < range + r && angleDiff(Math.atan2(p.y - e.y, p.x - e.x), e.aim) < half, dmg, perilous);
      break;
    }
    case "blink": {
      const range = spec.range ?? 3.0;
      const half = spec.half ?? 1.25;
      sound.playSfx("katanaFlash", { at: e, volume: 0.92 });
      g.burst({
        k: "slash",
        x: e.x,
        y: e.y,
        n: 11,
        dir: e.aim,
        r: Math.max(1.8, range * 0.75),
        tilt: 0.35,
        color: 0xff3b1f,
      });
      g.burst({ k: "shadow", x: e.x, y: e.y, n: 10, dir: e.aim, r: 2.0, color: 0xd02050 });
      g.hitFriends(e, (p, r) => dist(p, e) < range + r && angleDiff(Math.atan2(p.y - e.y, p.x - e.x), e.aim) < half, dmg, perilous);
      break;
    }
    case "slam":
    case "leap": {
      if (spec.k === "leap" && e.leapX !== undefined && e.leapY !== undefined) {
        e.x = e.leapX;
        e.y = e.leapY;
        g.clampToArena(e);
      }
      const r = spec.r ?? 2.6;
      if (e.boss && g.zone.nation === "snow") sound.playSfx("bellToll", { at: e, volume: 0.98 });
      sound.playSfx(spec.k === "leap" ? "boSlam" : "hitHeavy", { at: e, volume: 0.95 });
      g.hitFriends(e, (p, pr) => dist(p, e) < r + pr, dmg, perilous);
      g.burst({ k: "ring", x: e.x, y: e.y, n: 1, dir: 0, r, color: perilous ? 0xff4a18 : 0xe0303a });
      g.burst({ k: "spark", x: e.x, y: e.y, n: 12, dir: 0, color: 0xff7828 });
      g.burst({ k: "ripple", x: e.x, y: e.y, n: 7, dir: 0, r: r * 0.75 });
      g.burst({ k: "dust", x: e.x, y: e.y, n: 22, dir: 0, r: r * 1.1 });
      g.shake(spec.k === "leap" ? 0.45 : 0.35);
      if ((spec.waves ?? 1) >= 2) {
        g.shockwaves.push({
          x: e.x,
          y: e.y,
          delay: 0.42,
          r: r * 0.85,
          maxR: r * 1.78,
          dmg: dmg * 0.75,
          perilous: true,
          color: 0xff8020,
          owner: e,
          hit: false,
        });
      }
      break;
    }
    case "charge": {
      const from = { x: e.x, y: e.y };
      const d = spec.dist ?? 4.8;
      sound.playSfx("swingHeavy", { at: e, volume: 0.82 });
      g.moveBody(e, Math.cos(e.aim) * d, Math.sin(e.aim) * d, e.radius, 0.2);
      g.clampToArena(e);
      const w = (spec.width ?? 0.9) / 2;
      g.hitFriends(e, (p, r) => segDist(p, from, e) < w + r, dmg, perilous);
      g.burst({ k: "dust", x: from.x, y: from.y, n: 10, dir: e.aim });
      g.burst({ k: "slash", x: e.x, y: e.y, n: 8, dir: e.aim, r: 1.85, tilt: 0.14, color: perilous ? 0xff4a18 : 0xe03828 });
      g.burst({ k: "spark", x: e.x, y: e.y, n: 8, dir: e.aim + Math.PI, color: 0xff7828 });
      break;
    }
    case "shots": {
      const count = spec.count ?? 1;
      const speed = spec.speed ?? 18;
      const mx = e.x + Math.cos(e.aim) * 0.65;
      const my = e.y + Math.sin(e.aim) * 0.65;
      sound.playSfx(spec.blade ? "katanaFlash" : "bowShot", { at: e, volume: 0.85 });
      const shotColor = spec.blade ? 0xffe07a : spec.pull ? 0xff2880 : 0xff7028;
      g.burst({ k: spec.blade ? "slash" : "spark", x: mx, y: my, n: spec.blade ? 8 : 5, dir: e.aim, color: shotColor });
      g.burst({ k: "ring", x: mx, y: my, z: 1.05, n: 1, dir: e.aim, r: 0.9, color: shotColor });
      for (let i = 0; i < count; i++) {
        const a = e.aim + (count > 1 ? (spec.spread ?? 0) * (i / (count - 1) - 0.5) : 0);
        g.shots.push({
          x: e.x,
          y: e.y,
          sx: e.x,
          sy: e.y,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          dmg,
          life: 1.4,
          pull: !!spec.pull,
          blade: !!spec.blade,
          r: spec.blade ? 0.72 : spec.pull ? 0.35 : 0.25,
        });
      }
      break;
    }
    case "summon": {
      const adds = g.enemies.filter((o) => o.mission && !o.step && !o.decoy && o.state !== "dead").length;
      if (adds < 3) {
        for (let i = 0; i < (spec.count ?? 2); i++) {
          const at = g.spot(e, 4, 7);
          g.enemies.push(makeEnemy(g, spec.arch ?? "melee", at, { mission: true, chase: true }));
          g.burst({ k: "shadow", x: at.x, y: at.y, n: 8, dir: 0, r: 1.8, color: 0xe02040 });
        }
      }
      g.burst({ k: "shadow", x: e.x, y: e.y, n: 12, dir: 0, r: 4, color: 0xe02040 });
      break;
    }
    case "decoys": {
      g.enemies = g.enemies.filter((o) => !o.decoy);
      const p = g.player;
      const base = Math.random() * Math.PI * 2;
      const n = (spec.count ?? 3) + 1;
      for (let i = 0; i < n; i++) {
        const a = base + (i / n) * Math.PI * 2;
        const at = { x: p.x + Math.cos(a) * 6.5, y: p.y + Math.sin(a) * 6.5 };
        if (i === 0) {
          e.x = at.x;
          e.y = at.y;
          g.clampToArena(e);
          e.facing = Math.atan2(p.y - e.y, p.x - e.x);
          g.burst({ k: "shadow", x: e.x, y: e.y, n: 10, dir: 0, r: 2.1, color: 0xd02050 });
        } else {
          const d = makeDecoy(g, e, at, Math.atan2(p.y - at.y, p.x - at.x));
          g.clampToArena(d);
          d.facing = Math.atan2(p.y - d.y, p.x - d.x);
          g.enemies.push(d);
          g.burst({ k: "shadow", x: d.x, y: d.y, n: 10, dir: 0, r: 2.1, color: 0xd02050 });
        }
      }
      g.onBossDecoys(e);
      break;
    }
    case "guard":
      e.guardT = spec.dur ?? 2;
      break;
  }
}

function canSee(g: Game, e: Enemy, p: Vec, range: number) {
  const d = dist(e, p);
  if (d > range) return false;
  if (d > 2 && angleDiff(Math.atan2(p.y - e.y, p.x - e.x), e.facing) > FOV) return false;
  return g.lineOfSight(e, p, g.player.crouch);
}

function steerStep(g: Game, e: Enemy, heading: number, step: number): number {
  const bx = e.x;
  const by = e.y;
  g.moveBody(e, Math.cos(heading) * step, Math.sin(heading) * step, e.radius);
  const hx = Math.cos(heading);
  const hy = Math.sin(heading);
  const fwd = (e.x - bx) * hx + (e.y - by) * hy;
  if (fwd >= step * 0.55) return heading;

  const s0 = e.circleDir || 1;
  let bestX = e.x;
  let bestY = e.y;
  let bestMoved = Math.hypot(e.x - bx, e.y - by);
  let bestAngle = heading;
  for (const s of [s0, -s0]) {
    for (const mag of [0.7, 1.25, 1.55]) {
      e.x = bx;
      e.y = by;
      const a = heading + mag * s;
      g.moveBody(e, Math.cos(a) * step, Math.sin(a) * step, e.radius);
      const moved = Math.hypot(e.x - bx, e.y - by);
      if (moved >= step * 0.35) {
        e.circleDir = s;
        return a;
      }
      if (moved > bestMoved + 1e-4) {
        bestMoved = moved;
        bestX = e.x;
        bestY = e.y;
        bestAngle = a;
        e.circleDir = s;
      }
    }
  }
  e.x = bestX;
  e.y = bestY;
  return bestAngle;
}

function walkTo(g: Game, e: Enemy, to: Vec, speed: number, dt: number) {
  const dx = to.x - e.x;
  const dy = to.y - e.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.05) return d;
  const aim = Math.atan2(dy, dx);
  const step = Math.min(d, speed * dt);
  const steered = steerStep(g, e, aim, step);
  turn(e, steered, dt * 8);
  e.walk += step;
  return d;
}

function turn(e: Enemy, to: number, rate: number) {
  const diff = Math.atan2(Math.sin(to - e.facing), Math.cos(to - e.facing));
  e.facing += Math.max(-rate, Math.min(rate, diff));
}

function tryBossDodge(g: Game, e: Enemy, d: number, dx: number, dy: number): boolean {
  const b = e.boss;
  if (!b || b.dodgeStyle === "none" || e.dodgeCd > 0) return false;
  const p = g.player;
  const threatened = p.act.kind === "attack" && p.act.t < 0.16 && d < 4.6;
  const tooClose = !!b.kiteDist && d < b.kiteDist && e.cd > 0.12;
  if (!threatened && !tooClose) return false;
  const chance = threatened ? (b.dodgeChance ?? 0.5) : 0.65;
  if (Math.random() > chance) return false;

  const toPlayer = Math.atan2(dy, dx);
  const style = b.dodgeStyle ?? "sidestep";
  const side = e.circleDir || 1;
  e.circleDir *= -1;
  let dir = toPlayer + Math.PI;
  let dur = 0.32;
  let sp = 10.5;
  if (style === "backstep") {
    dir = toPlayer + Math.PI + (Math.random() - 0.5) * 0.4;
    dur = 0.34;
    sp = 10.2;
    g.burst({ k: "dust", x: e.x, y: e.y, n: 8, dir: toPlayer, r: 1.0 });
  } else if (style === "shadow") {
    dir = toPlayer + side * (Math.PI * 0.62);
    dur = 0.3;
    sp = 13.0;
    g.burst({ k: "shadow", x: e.x, y: e.y, n: 12, dir: 0, r: 2.0, color: 0xd02050 });
    const liveDecoys = g.enemies.filter((o) => o.decoy && o.state !== "dead").length;
    if (liveDecoys < 2) {
      const dec = makeDecoy(g, e, { x: e.x, y: e.y }, toPlayer);
      g.clampToArena(dec);
      g.enemies.push(dec);
    }
  } else {
    dir = threatened ? toPlayer + side * (Math.PI * 0.56) : toPlayer + Math.PI + side * 0.35;
    dur = 0.3;
    sp = 11.8;
    g.burst({ k: "ripple", x: e.x, y: e.y, n: 5, dir: toPlayer, r: 1.05 });
    g.burst({ k: "dust", x: e.x, y: e.y, n: 6, dir: dir + Math.PI, r: 0.8 });
  }
  e.state = "dodge";
  e.t = e.tw = dur;
  e.dodgeDir = dir;
  e.dodgeSpeed = sp;
  e.dodgeInvuln = dur * 0.85;
  e.dodgeCd = b.dodgeCd ?? 2.6;
  e.guardT = 0;
  sound.playSfx("dodge", { at: e, volume: 0.78, jitter: 0.08 });
  return true;
}

function beginWindup(g: Game, e: Enemy, d: number, dx: number, dy: number) {
  const enrage = e.phase2 ? 0.82 : 1;
  e.state = "windup";
  e.t = e.tw = e.atk.windup * enrage * (e.boss ? 0.9 : 1);
  e.aim = Math.atan2(dy, dx);
  e.facing = e.aim;
  e.blinked = false;
  if (e.atk.k === "combo") e.comboLeft = Math.max(0, (e.atk.hits ?? 3) - 1);
  else e.comboLeft = 0;
  if (e.atk.k === "leap") {
    const leapDist = Math.min(d, e.atk.reach);
    e.leapStartX = e.x;
    e.leapStartY = e.y;
    const tx = e.x + Math.cos(e.aim) * leapDist;
    const ty = e.y + Math.sin(e.aim) * leapDist;
    const tmp = { ...e, x: tx, y: ty };
    g.clampToArena(tmp);
    e.leapX = tmp.x;
    e.leapY = tmp.y;
    g.burst({ k: "dust", x: e.x, y: e.y, n: 8, dir: e.aim + Math.PI, r: 0.9 });
  }
  if (e.atk.perilous) {
    sound.playSfx("peril", { at: e, volume: 0.9 });
    if (e.arch === "brute" && !e.boss) g.onEnemyBruteCry(e);
  }
  if (e.boss) g.onBossSkill(e);
}

function updateEnemy(g: Game, e: Enemy, dt: number) {
  e.flash = Math.max(0, e.flash - dt);
  e.guardT = Math.max(0, e.guardT - dt);
  e.dodgeCd = Math.max(0, e.dodgeCd - dt);
  e.dodgeInvuln = Math.max(0, e.dodgeInvuln - dt);
  if (e.state === "dead") {
    e.deadT += dt;
    // The body is carried on by the killing blow before it drops.
    if (Math.abs(e.kx) + Math.abs(e.ky) > 0.05) {
      g.moveBody(e, e.kx * dt, e.ky * dt, e.radius * 0.6);
      e.kx *= Math.pow(0.04, dt);
      e.ky *= Math.pow(0.04, dt);
    }
    return;
  }
  if (e.object) return;
  // Knock-back slides to a halt.
  if (Math.abs(e.kx) + Math.abs(e.ky) > 0.05) {
    g.moveBody(e, e.kx * dt, e.ky * dt, e.radius);
    e.kx *= Math.pow(0.02, dt);
    e.ky *= Math.pow(0.02, dt);
  }
  if (e.poise > 0 && e.state !== "stagger") e.poise = Math.max(0, e.poise - e.maxPoise * 0.12 * dt);
  if (e.stun > 0) {
    e.stun -= dt;
    return;
  }
  const p = g.player;
  const tgt = g.targetFor(e);
  const dx = tgt.x - e.x;
  const dy = tgt.y - e.y;
  const d = Math.hypot(dx, dy) || 1;

  // Phase 2 transition: unlock signature escalated moves and burst aura.
  if (e.boss && !e.phase2 && e.hp < e.maxHp * 0.5) {
    e.phase2 = true;
    g.onBossEnrage(e);
    const pat = bossPattern(e);
    e.atkIdx = 0;
    e.atk = pat[0];
    e.cd = Math.min(e.cd, 0.2);
    g.burst({ k: "shadow", x: e.x, y: e.y, n: 16, dir: 0, r: 3.4, color: 0xff4028 });
    g.burst({ k: "ring", x: e.x, y: e.y, n: 1, dir: 0, r: 4.5, color: 0xff5a1f });
  }

  // Perception while unaware.
  if (!e.aware) {
    const range = (p.crouch ? SIGHT_CROUCHED : SIGHT) * (e.state === "search" ? 1.2 : 1);
    if (p.hp > 0 && canSee(g, e, p, range)) {
      const close = 1 - dist(e, p) / range;
      e.suspicion += dt * (0.6 + close * 2.6) * (p.crouch ? 0.6 : 1);
      e.lastSeen = { x: p.x, y: p.y };
      if (e.suspicion >= 1) alert(g, e, p);
      else if (e.suspicion > 0.35 && e.state !== "search") {
        e.state = "search";
        g.onEnemySearch(e);
      }
    } else {
      e.suspicion = Math.max(0, e.suspicion - dt * 0.12);
    }
    // Noise: running close by is heard (non-boss enemies only so walls aren't bypassed).
    if (!e.aware && !e.boss && !p.crouch && p.speed > 3 && dist(e, p) < 3.5) alert(g, e, p);
    // Escort and defend targets are attacked on sight.
    if (!e.aware && tgt !== p && d < 9) alert(g, e, tgt);
  }

  switch (e.state) {
    case "idle":
      if (e.boss) {
        if (d < 15 && g.lineOfSight(e, p, false)) {
          e.state = "chase";
          e.aware = true;
          g.bossIntro(e);
        }
      }
      break;
    case "patrol": {
      if (!e.patrol.length) break;
      const wp = e.patrol[e.patrolI];
      e.t += dt;
      if (walkTo(g, e, wp, e.speed * 0.32, dt) < 0.4) {
        if (e.t > 3) {
          e.patrolI = (e.patrolI + 1) % e.patrol.length;
          e.t = 0;
        }
      } else e.t = 0;
      break;
    }
    case "search": {
      const at = e.lastSeen ?? e.home;
      e.t += dt;
      if (walkTo(g, e, at, e.speed * 0.45, dt) < 0.6) {
        e.facing += Math.sin(g.time * 1.4 + e.id) * dt * 1.6;
        if (e.t > 6 && e.suspicion < 0.25) {
          e.state = e.patrol.length ? "patrol" : "idle";
          e.t = 0;
          g.onEnemyGiveUp(e);
        }
      }
      break;
    }
    case "home": {
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.3 * dt);
      if (walkTo(g, e, e.home, e.speed * 0.8, dt) < 0.8) {
        e.state = "patrol";
        e.aware = false;
        e.suspicion = 0;
      }
      break;
    }
    case "dodge": {
      const k = Math.max(0, e.t / Math.max(0.01, e.tw));
      const sp = e.dodgeSpeed * (0.35 + k * 0.9);
      steerStep(g, e, e.dodgeDir, sp * dt);
      g.clampToArena(e);
      turn(e, Math.atan2(dy, dx), dt * 14);
      e.walk += sp * dt;
      e.t -= dt;
      if (e.t <= 0) {
        e.state = "chase";
        e.dodgeInvuln = 0;
        e.cd = Math.min(e.cd, 0.22);
        e.chaseT = 0;
      }
      break;
    }
    case "sprint":
    case "chase":
    case "circle": {
      if (e.camp >= 0 && dist(e, e.home) > 38) {
        e.state = "home";
        e.token = false;
        break;
      }
      turn(e, Math.atan2(dy, dx), dt * (e.boss ? 6.5 : 7));
      if (tryBossDodge(g, e, d, dx, dy)) break;

      e.chaseT += dt;
      // A general who cannot reach the hero moves on to the next attack.
      if (e.boss && e.chaseT > 2.0) {
        const pat = bossPattern(e);
        e.atkIdx = (e.atkIdx + 1) % pat.length;
        e.atk = pat[e.atkIdx];
        e.chaseT = 0;
      }
      const mayAttack = e.boss || e.decoy || e.token || tgt !== p;
      e.cd -= dt;
      if (mayAttack && d < e.atk.reach + e.radius && e.cd <= 0) {
        beginWindup(g, e, d, dx, dy);
        break;
      }
      const ranged = e.arch === "ranged" && !e.boss;
      const sprintAt = e.boss?.sprintDist ?? 99;
      if (e.boss && d > sprintAt) {
        e.state = "sprint";
        const sp = e.speed * (e.phase2 ? 1.65 : 1.52);
        steerStep(g, e, Math.atan2(dy, dx), sp * dt);
        g.clampToArena(e);
        e.walk += sp * dt * 1.15;
        if (Math.random() < dt * 9) g.burst({ k: "dust", x: e.x, y: e.y, n: 2, dir: e.facing + Math.PI, r: 0.45 });
      } else if (!mayAttack || (ranged && d < 6)) {
        // Hold a ring around the hero, sidestepping, until it is our turn.
        e.state = "circle";
        const want = ranged ? 8 : 4.2;
        const radial = d > want + 0.6 ? 1 : d < want - 0.6 ? -1 : 0;
        const tx = -dy / d;
        const ty = dx / d;
        const sp = e.speed * 0.42;
        const mx = (dx / d) * radial + tx * e.circleDir * 0.7;
        const my = (dy / d) * radial + ty * e.circleDir * 0.7;
        g.moveBody(e, mx * sp * dt, my * sp * dt, e.radius);
        e.walk += sp * dt;
        if (Math.random() < dt * 0.25) e.circleDir *= -1;
      } else {
        e.state = "chase";
        const sp = e.speed * (d > 7 ? 1.05 : 0.82);
        steerStep(g, e, Math.atan2(dy, dx), sp * dt);
        if (e.boss) g.clampToArena(e);
        e.walk += sp * dt;
      }
      break;
    }
    case "windup": {
      e.t -= dt;
      const k = 1 - Math.max(0, e.t) / Math.max(0.01, e.tw);
      if (e.atk.k === "charge" && Math.random() < dt * 10) {
        g.burst({ k: "dust", x: e.x, y: e.y, n: 2, dir: e.aim + Math.PI, r: 0.45 });
      }
      if (e.atk.k === "leap" && e.leapX !== undefined && e.leapY !== undefined && e.leapStartX !== undefined && e.leapStartY !== undefined) {
        if (k < 0.28) {
          e.aim = e.facing = Math.atan2(dy, dx);
          const leapDist = Math.min(d, e.atk.reach);
          const tmp = { ...e, x: e.leapStartX + Math.cos(e.aim) * leapDist, y: e.leapStartY + Math.sin(e.aim) * leapDist };
          g.clampToArena(tmp);
          e.leapX = tmp.x;
          e.leapY = tmp.y;
        } else {
          const fly = Math.min(1, (k - 0.28) / 0.72);
          e.x = e.leapStartX + (e.leapX - e.leapStartX) * fly;
          e.y = e.leapStartY + (e.leapY - e.leapStartY) * fly;
          g.clampToArena(e);
        }
      } else if (e.atk.k === "blink") {
        if (!e.blinked && k >= 0.5) {
          e.blinked = true;
          g.burst({ k: "shadow", x: e.x, y: e.y, n: 12, dir: 0, r: 2.0, color: 0xd02050 });
          if (e.atk.leaveDecoy) {
            const dec = makeDecoy(g, e, { x: e.x, y: e.y }, e.aim);
            g.clampToArena(dec);
            g.enemies.push(dec);
          }
          e.x = p.x - Math.cos(p.facing) * 1.95;
          e.y = p.y - Math.sin(p.facing) * 1.95;
          g.clampToArena(e);
          e.aim = e.facing = Math.atan2(p.y - e.y, p.x - e.x);
          g.burst({ k: "shadow", x: e.x, y: e.y, n: 12, dir: e.aim, r: 2.0, color: 0xff4a18 });
          sound.playSfx("dodge", { at: e, volume: 0.9 });
        }
      } else if (e.t > e.tw * 0.5 && e.atk.k !== "charge") {
        e.aim = e.facing = Math.atan2(dy, dx);
      }
      if (e.t <= 0) {
        resolve(g, e);
        if (e.comboLeft > 0 && p.hp > 0) {
          e.comboLeft--;
          e.t = e.tw = e.phase2 ? 0.22 : 0.26;
          e.aim = e.facing = Math.atan2(p.y - e.y, p.x - e.x);
          break;
        }
        e.state = "recover";
        e.t = e.boss ? (e.phase2 ? 0.48 : 0.58) : 0.42;
        e.cd = e.boss ? (e.phase2 ? 0.18 : 0.28) : ARCH[e.arch].cd * (0.8 + Math.random() * 0.5);
        e.token = false;
        if (e.boss) {
          const pat = bossPattern(e);
          e.atkIdx = (e.atkIdx + 1) % pat.length;
          e.atk = pat[e.atkIdx];
        }
      }
      break;
    }
    case "recover":
      if (e.t < 0.25 && tryBossDodge(g, e, d, dx, dy)) break;
      e.t -= dt;
      if (e.t <= 0) {
        e.state = "chase";
        e.chaseT = 0;
      }
      break;
    case "stagger":
      e.t -= dt;
      if (e.t <= 0) {
        e.poise = 0;
        e.state = "chase";
        e.chaseT = 0;
      }
      break;
  }
}

/** Grants the attack tokens to the closest engaged enemies. */
function assignTokens(g: Game) {
  const p = g.player;
  const engaged = g.enemies.filter((e) => e.aware && !e.boss && !e.decoy && !e.object && e.state !== "dead" && e.state !== "home");
  const holding = engaged.filter((e) => e.token || e.state === "windup").length;
  if (holding >= TOKENS) return;
  const waiting = engaged.filter((e) => !e.token && e.state !== "windup" && e.state !== "stagger" && e.cd <= 0).sort((a, b) => dist(a, p) - dist(b, p));
  for (let i = 0; i < TOKENS - holding && i < waiting.length; i++) waiting[i].token = true;
}

export function updateEnemies(g: Game, dt: number) {
  assignTokens(g);
  for (const e of [...g.enemies]) updateEnemy(g, e, dt);
  g.enemies = g.enemies.filter((e) => e.state !== "dead" || e.deadT < 9);
  // Keep bodies from stacking on one another.
  const list = g.enemies;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.state === "dead") continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (b.state === "dead") continue;
      const min = a.radius + b.radius;
      const d = dist(a, b);
      if (d >= min || d < 0.001) continue;
      const push = (min - d) / 2;
      const nx = (b.x - a.x) / d;
      const ny = (b.y - a.y) / d;
      if (!a.object && !a.boss) {
        a.x -= nx * push;
        a.y -= ny * push;
      }
      if (!b.object && !b.boss) {
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }
}
