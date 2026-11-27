import { sound } from "../audio/soundEngine";
import { MISSIONS } from "../data/missions";
import { NATIONS } from "../data/nations";
import {
  BIWA_AMBIENT_LINES,
  BOSS_DEFLECT_LINE,
  BOSS_EVADE_LINES,
  BOSS_HIT_TAUNTS,
  BOSS_INTRO_LINES,
  BOSS_MASK_DECOY_LINE,
  BOSS_PHASE2_LINES,
  BOSS_SKILL_CALLOUTS,
  BOSS_STAGGER_LINES,
  ENEMY_BRUTE_LINES,
  ENEMY_GIVEUP_LINES,
  ENEMY_PANIC_LINES,
  ENEMY_SEARCH_LINES,
  FIXER_AMBIENT_LINES,
  GHOST_LOW_HP_LINES,
  GHOST_PARRY_LINES,
  GHOST_STEALTH_LINES,
  GHOST_WANDER_LINES,
  GHOST_WEAPON_LINES,
  NPC_LIBERATED_LINES,
  NPC_VILLAGER_DISTRICT,
  NPC_VILLAGER_GENERAL,
  REN_BATTLE_WON_LINES,
  REN_BOSS_LINES,
  REN_EXPLORE_LINES,
  REN_HEAL_LINES,
  REN_IDLE_LINES,
  REN_KILL_LINES,
  REN_LOW_HP_LINES,
  REN_PARRY_BOSS_LINES,
  REN_SPOT_ENEMY_LINES,
  REN_STEALTH_KILL_LINES,
  REN_WEAPON_LINES,
  type GhostExchange,
  pickItem,
  pickOther,
} from "../data/reactiveDialogue";
import { EPILOGUE, actIntro, generalDefeat } from "../data/story";
import { lookupVoiceLine } from "../data/voiceManifest";
import { BROTHER, WEAPONS, WEAPON_ORDER } from "../data/weapons";
import { generalsSlain, nextMission, unlockedWeapons, writeSave, xpNeed } from "../save";
import { getSettings } from "../settings";
import type { ComicPage, GameEvent, HudState, Mission, NationId, SaveData, Stealth, WeaponId, ZoneId } from "../types";
import {
  MAX_STAMINA,
  MAX_STIMS,
  canBuffer,
  drinkStim,
  finisherTarget,
  hurtPlayer,
  idleAct,
  pressGuard,
  startAttack,
  startDodge,
  startFinisher,
  updateAct,
} from "./combat";
import { alert, makeBoss, makeEnemy, makeObject, updateEnemies } from "./enemies";
import { Input, type Action } from "./input";
import { hasParkourTargetAhead, moveBody3D, tryParkourJump, trySlideOrDrop, updateVerticalPhysics } from "./parkour";
import { dist, inRect, segHitsRect, type Active, type Bubble, type Burst, type Enemy, type Floater, type Npc, type Pickup, type Player, type Rect, type Shockwave, type Shot, type Vec, type Zone } from "./state";
import { buildZone } from "./world";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const PLAYER_R = 0.4;

const makeNpc = (name: string, role: Npc["role"], x: number, y: number, look: Npc["look"] = "villager", hp = 1): Npc => ({
  name,
  role,
  look,
  x,
  y,
  hp,
  maxHp: hp,
  facing: Math.PI / 2,
  home: { x, y },
  t: Math.random() * 4,
  walk: 0,
  pauseT: 0.5 + Math.random() * 2.5,
  goal: null,
  vx: 0,
  vy: 0,
});

/** The world simulation: the hero, enemies, missions and the frame loop. Rendering lives elsewhere. */
export class Game {
  zone!: Zone;
  /** Increments whenever the zone is rebuilt, so the renderer knows to rebuild its scene. */
  zoneVersion = 0;
  player: Player;
  enemies: Enemy[] = [];
  shots: Shot[] = [];
  shockwaves: Shockwave[] = [];
  npcs: Npc[] = [];
  pickups: Pickup[] = [];
  bursts: Burst[] = [];
  floaters: Floater[] = [];
  bubbles: Bubble[] = [];
  active: Active | null = null;
  input = new Input();
  paused = false;
  time = 0;
  ids = 1;
  /** Whose eyes the player sees through: Ren, or a brother during a Memory mission. */
  hero: WeaponId = "katana";
  lock: Enemy | null = null;
  /** The lock was taken by attacking (not by the lock key), so it lets go once the fight moves on. */
  lockAuto = false;
  lastSwing = -99;
  prompt: { text: string; run: () => void } | null = null;
  /** Camera heading, in radians on the ground plane. */
  camYaw = 0;
  /** Freezes the simulation for a few frames when a heavy blow lands. */
  hitstop = 0;
  shakeAmt = 0;
  /** Close-up camera for takedowns and a general's entrance. */
  cine: { t: number; on: Vec } | null = null;
  /** Called every frame after the simulation, with the real time step. */
  onFrame: ((dt: number) => void) | null = null;

  private solids: Rect[] = [];
  private raf = 0;
  private last = 0;
  private hudT = 0;
  private slowT = 0;
  private deathT = 0;
  private campT: number[] = [];
  private stillT = 0;
  private nextIdleAt = 6;
  private exploreT = 0;
  private nextExploreAt = 11;
  private ambientCd = 1.5;
  private renVoiceCd = 1;
  private spotCryCd = 0;
  private lowHpCd = 0;
  private weaponSwapCd = 0;
  private npcVoiceCd = 6;
  private ghostCd = 10;
  private bossTauntCd = 0;
  private enemyChatterCd = 4;
  private cityAmbSfxCd = 16;
  private enragedBossId = -1;
  private ghostWanderT = 0;
  private nextGhostWanderAt = 24;
  private stealthWhisperT = 0;
  private fightT = 0;
  private wasHunted = false;
  private lastRenLine = "";
  private lastBossLine = "";
  private lastNpcLine = "";
  private lastNpcSpeaker: Npc | null = null;
  private pendingLines: { t: number; line: string; on: Vec; priority: "mission" | "ambient"; waitVoice?: boolean }[] = [];

  constructor(
    readonly save: SaveData,
    private emit: (e: GameEvent) => void,
    private onHud: (h: HudState) => void,
  ) {
    this.player = {
      x: 0,
      y: 0,
      z: 0,
      vz: 0,
      grounded: true,
      airT: 0,
      fallPeakVz: 0,
      landT: 0,
      landDur: 0.2,
      landHeavy: false,
      coyoteT: 0,
      dropIgnoreT: 0,
      ledge: null,
      wallSide: 0,
      wallNx: 0,
      wallNy: 0,
      vx: 0,
      vy: 0,
      facing: 0,
      hp: 1,
      maxHp: 1,
      stamina: MAX_STAMINA,
      maxStamina: MAX_STAMINA,
      staminaT: 0,
      weapon: unlockedWeapons(save).includes(save.weapon) ? save.weapon : "katana",
      act: idleAct(),
      combo: 0,
      comboT: 0,
      buffer: null,
      bufferT: 0,
      specialCd: 0,
      stims: MAX_STIMS,
      parryT: 0,
      blocking: false,
      counterT: 0,
      invuln: 0,
      lastHurt: -10,
      flash: 0,
      crouch: false,
      speed: 0,
      walk: 0,
    };
    this.loadZone(save.nation);
  }

  // ---------- Lifecycle ----------

  private handleVisibility = () => {
    this.last = performance.now();
    if (document.hidden) {
      this.input.keys.clear();
      this.input.queue.length = 0;
      this.input.guardHeld = false;
    }
  };

  start() {
    this.input.attach();
    document.addEventListener("visibilitychange", this.handleVisibility);
    sound.preloadGameplayAudio();
    this.syncAudio();
    this.last = performance.now();
    const loop = (ts: number) => {
      // Real time drives the game even when frames are slow: long frames are split into
      // small sub-steps instead of being clipped, so nothing ever runs in slow motion.
      const real = document.hidden ? 0 : Math.min(0.1, Math.max(0, (ts - this.last) / 1000));
      this.last = ts;
      if (this.paused || document.hidden) this.input.queue.length = 0;
      else {
        let left = real;
        while (left > 1e-4) {
          const h = Math.min(1 / 30, left);
          this.step(h);
          left -= h;
        }
      }
      this.syncAudio();
      if (!document.hidden) this.onFrame?.(real);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    if (!this.save.visited.includes(this.save.nation)) this.firstVisit();
    this.pushHud();
  }

  private syncAudio() {
    const p = this.player;
    sound.setListener(p.x, p.y, this.camYaw);
    sound.setDucked(this.paused || document.hidden || this.deathT > 0);
    const bossEngaged = this.enemies.some((e) => e.boss && e.aware && e.state !== "dead");
    const musicKey = bossEngaged ? "boss" : this.memory ? "ash" : this.save.nation;
    sound.setMusic(musicKey);
    sound.setAmbient(this.zone.env.precip);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    document.removeEventListener("visibilitychange", this.handleVisibility);
    this.input.detach();
    sound.stopGameplayAudio(0.4);
  }

  act(a: Action) {
    this.input.queue.push(a);
  }

  /** Advances the world by one real-time step, honouring hit-stop and slow motion. */
  step(real: number) {
    this.shakeAmt = Math.max(0, this.shakeAmt - real * 1.6);
    if (this.cine) {
      this.cine.t -= real;
      if (this.cine.t <= 0) this.cine = null;
    }
    if (this.hitstop > 0) {
      this.hitstop -= real;
      return;
    }
    let dt = real;
    if (this.slowT > 0) {
      this.slowT -= real;
      dt *= 0.35;
    }
    this.update(dt);
  }

  // ---------- Derived stats ----------

  generals() {
    return generalsSlain(this.save);
  }

  maxHp() {
    return 100 + 8 * (this.save.level - 1);
  }

  pdmg() {
    return 20 * (1 + 0.06 * (this.save.level - 1));
  }

  get memory() {
    return this.zone.id === "memory";
  }

  weapons(): WeaponId[] {
    return this.memory ? [this.hero] : unlockedWeapons(this.save);
  }

  // ---------- Zones and travel ----------

  private loadZone(id: ZoneId) {
    const nation = this.save.nation;
    this.zone = buildZone(id, nation, this.save.done.includes(`${nation}-7`));
    this.zoneVersion++;
    this.refreshSolids();
    this.enemies = [];
    this.shots = [];
    this.shockwaves = [];
    this.npcs = [];
    this.pickups = [];
    this.bubbles = [];
    this.bursts = [];
    this.floaters = [];
    this.lock = null;
    this.pendingLines = [];
    this.stillT = 0;
    this.nextIdleAt = 6 + Math.random() * 2;
    this.exploreT = 0;
    this.nextExploreAt = 10 + Math.random() * 5;
    this.fightT = 0;
    this.wasHunted = false;
    this.enragedBossId = -1;
    this.ghostWanderT = 0;
    this.nextGhostWanderAt = 22 + Math.random() * 10;
    this.stealthWhisperT = 0;
    this.npcVoiceCd = 5 + Math.random() * 4;
    this.respawn();
    if (id === "memory") return;
    const v = this.zone.pois.village;
    this.npcs.push(
      makeNpc(NATIONS[nation].giver, "giver", v.x - 2, v.y - 2),
      makeNpc("The Biwa Woman", "biwa", v.x + 5, v.y - 2.5, "biwa"),
      makeNpc("Watchman", "villager", v.x - 5, v.y + 3),
      makeNpc("Townswoman", "villager", v.x + 3, v.y + 5),
      makeNpc("Lookout", "villager", v.x + 7, v.y + 1),
    );
    this.campT = this.zone.camps.map(() => 0);
    this.zone.camps.forEach((_, i) => this.spawnCamp(i));
  }

  private refreshSolids() {
    const z = this.zone;
    this.solids = [...z.buildings, ...z.walls, ...z.cover, ...(z.gate ? [z.gate] : [])];
  }

  private respawn() {
    const v = this.zone.pois.village;
    const p = this.player;
    p.x = v.x + 1.5;
    p.y = v.y + 2.5;
    p.z = 0;
    p.vz = 0;
    p.grounded = true;
    p.airT = 0;
    p.fallPeakVz = 0;
    p.landT = 0;
    p.landDur = 0.2;
    p.landHeavy = false;
    p.coyoteT = 0;
    p.dropIgnoreT = 0;
    p.ledge = null;
    p.wallSide = 0;
    p.wallNx = 0;
    p.wallNy = 0;
    p.vx = p.vy = 0;
    p.maxHp = this.maxHp();
    p.hp = p.maxHp;
    p.stamina = MAX_STAMINA;
    p.stims = MAX_STIMS;
    // Start crouched/prone waking off the rain-soaked asphalt (`00:00 -> 00:02`), cancelable after 0.16s.
    p.act = { ...idleAct(), kind: "getup", dur: 0.92 };
    p.combo = 0;
    p.comboT = 0;
    p.buffer = null;
    p.bufferT = 0;
    p.specialCd = 0;
    p.parryT = 0;
    p.counterT = 0;
    p.blocking = false;
    p.flash = 0;
    p.invuln = 1;
    p.facing = 0;
    p.crouch = false;
    p.speed = 0;
    p.walk = 0;
    this.camYaw = 0;
    this.lock = null;
    this.lockAuto = false;
    this.deathT = 0;
    this.slowT = 0;
    this.hitstop = 0;
    this.cine = null;
    this.shakeAmt = 0;
    this.pendingLines = [];
    this.stillT = 0;
    this.fightT = 0;
    this.wasHunted = false;
  }

  private spawnCamp(i: number) {
    const c = this.zone.camps[i];
    (["melee", "melee", "ranged"] as const).forEach((arch) => {
      this.enemies.push(makeEnemy(this, arch, this.spot(c, 1.5, 5), { camp: i }));
    });
  }

  private firstVisit() {
    const id = this.save.nation;
    this.save.visited.push(id);
    writeSave(this.save);
    this.comic(actIntro(id), () => this.toast(NATIONS[id].name, `Find ${NATIONS[id].giver} at the hideout.`));
  }

  travel(nation: NationId) {
    this.abandon();
    this.save.nation = nation;
    writeSave(this.save);
    this.loadZone(nation);
    if (!this.save.visited.includes(nation)) this.firstVisit();
    this.emit({ type: "progress" });
  }

  /** Back to the hideout at once. In a memory this abandons the mission. */
  returnToVillage() {
    if (this.memory) {
      this.abandon();
      this.toast("The memory fades", "The mission can be taken again at the hideout.");
      return;
    }
    if (this.enemies.some((e) => e.aware && e.state !== "dead" && dist(e, this.player) < 20)) {
      this.toast("Not while you are hunted", "Lose your pursuers first.");
      return;
    }
    this.respawn();
    this.shots = [];
    this.shockwaves = [];
  }

  // ---------- Missions ----------

  accept(m: Mission) {
    this.comic([m.intro], () => this.begin(m));
  }

  private begin(m: Mission) {
    if (m.cls === "Memory") {
      this.hero = m.playAs ?? "katana";
      this.loadZone("memory");
      this.player.weapon = this.hero;
      sound.playSfx("biwaSting", { volume: 0.9 });
    }
    this.active = { m, i: 0, got: 0, need: 1, wave: 0, waveT: 0, started: false, friend: null, ambush: 0 };
    this.enterStep(0);
    this.emit({ type: "progress" });
  }

  private clearMission() {
    this.enemies = this.enemies.filter((e) => !e.mission);
    this.npcs = this.npcs.filter((n) => n.role !== "friend");
    this.pickups = [];
    this.shots = [];
    this.shockwaves = [];
    if (this.lock && !this.enemies.includes(this.lock)) this.lock = null;
  }

  private abandon() {
    if (!this.active && !this.memory) return;
    this.active = null;
    this.clearMission();
    if (this.memory) this.leaveMemory();
  }

  private leaveMemory() {
    this.hero = "katana";
    this.loadZone(this.save.nation);
    this.player.weapon = unlockedWeapons(this.save).includes(this.save.weapon) ? this.save.weapon : "katana";
  }

  /** The hero fell or the mission failed: back to the start of the mission. */
  private restart(title: string, text: string) {
    this.toast(title, text);
    const a = this.active;
    this.enragedBossId = -1;
    this.clearMission();
    // Camps forget the hero and return to their rounds.
    for (const e of this.enemies) {
      if (e.state === "dead") continue;
      Object.assign(e, { aware: false, suspicion: 0, state: "patrol", token: false, x: e.home.x, y: e.home.y, hp: e.maxHp });
    }
    this.respawn();
    if (a) {
      this.active = { ...a, friend: null };
      this.enterStep(0);
    }
  }

  die() {
    const p = this.player;
    p.hp = 0;
    p.vx = p.vy = 0;
    p.speed = 0;
    p.crouch = false;
    p.blocking = false;
    p.parryT = 0;
    p.counterT = 0;
    p.ledge = null;
    p.wallSide = 0;
    p.landT = 0;
    p.act = { ...idleAct(), kind: "broken", dur: 99 };
    this.deathT = 2.65;
    this.slow(0.45);
    this.lock = null;
    sound.playSfx("death", { volume: 0.95 });
    sound.playSfx("effortDeath", { volume: 0.9 });
  }

  private enterStep(i: number) {
    const a = this.active;
    if (!a) return;
    const s = a.m.steps[i];
    if (a.friend) this.npcs = this.npcs.filter((n) => n !== a.friend);
    this.pickups = [];
    Object.assign(a, { i, got: 0, need: 1, wave: 0, waveT: 0, started: false, friend: null, ambush: 0 });
    const at = this.zone.pois[s.kind === "escort" ? s.from : s.at];
    const friendHp = Math.round(220 * (1 + 0.35 * this.generals()));
    const guards = (count: number) => {
      for (let k = 0; k < count; k++) {
        this.enemies.push(makeEnemy(this, k % 3 === 2 ? "ranged" : "melee", this.spot(at, 3, 11), { mission: true }));
      }
    };
    switch (s.kind) {
      case "kill":
        a.need = s.count;
        for (let k = 0; k < s.count; k++) {
          const lead = !!s.elite && k === 0;
          const arch = s.elite && !lead && s.enemy === "brute" ? "melee" : s.enemy;
          this.enemies.push(makeEnemy(this, arch, this.spot(at, 1.5, 9), { mission: true, step: true, elite: lead ? s.elite : undefined }));
        }
        break;
      case "collect":
        a.need = s.count;
        for (let k = 0; k < s.count; k++) this.pickups.push({ ...this.spot(at, 3, 14), label: s.item, taken: false });
        guards(s.guards);
        break;
      case "destroy":
        a.need = s.count;
        for (let k = 0; k < s.count; k++) this.enemies.push(makeObject(this, s.target, this.spot(at, 2, 10)));
        guards(s.guards);
        break;
      case "escort":
        a.need = 0;
        a.friend = makeNpc(s.npc, "friend", at.x, at.y, "villager", friendHp);
        this.npcs.push(a.friend);
        break;
      case "defend":
        a.need = s.waves;
        a.friend = makeNpc(s.npc, "friend", at.x, at.y, /barge|cart|boat|crowd|cargo/i.test(s.npc) ? "cargo" : "villager", friendHp * 1.5);
        this.npcs.push(a.friend);
        break;
      case "survive":
        a.need = s.waves;
        break;
      case "boss":
        this.enemies.push(makeBoss(this, at));
        break;
      case "reach":
        a.need = 0;
        break;
    }
    if (s.say) this.say(s.say, this.player);
  }

  private nextStep() {
    const a = this.active;
    if (!a) return;
    if (a.i + 1 >= a.m.steps.length) this.complete();
    else this.enterStep(a.i + 1);
  }

  private spawnWave(center: Vec, w: number, step: boolean) {
    const list: ("melee" | "fast" | "ranged" | "brute")[] = ["fast"];
    for (let k = 0; k < 1 + Math.floor(w / 2); k++) list.push("melee");
    if (w >= 1) list.push("ranged");
    if (w >= 3) list.push("brute");
    for (const arch of list) {
      this.enemies.push(makeEnemy(this, arch, this.spot(center, 15, 21), { mission: true, step, chase: true }));
    }
  }

  private updateMission(dt: number) {
    const a = this.active;
    if (!a) return;
    const s = a.m.steps[a.i];
    const p = this.player;
    const pois = this.zone.pois;
    const alive = this.enemies.filter((e) => e.step && e.state !== "dead").length;
    switch (s.kind) {
      case "reach":
        if (dist(p, pois[s.at]) < 5.5) this.nextStep();
        break;
      case "kill":
      case "destroy":
        a.got = a.need - alive;
        if (!alive) this.nextStep();
        break;
      case "boss":
        if (!alive) {
          this.enemies = this.enemies.filter((e) => !e.mission || e.state === "dead");
          this.nextStep();
        }
        break;
      case "collect":
        for (const pk of this.pickups) {
          if (!pk.taken && dist(p, pk) < 1.6) {
            pk.taken = true;
            a.got++;
            sound.playSfx("pickup", { volume: 0.9 });
            this.float(pk, `${pk.label} ${a.got}/${a.need}`, "#ff8a1f");
            this.burst({ k: "ring", x: pk.x, y: pk.y, n: 1, dir: 0, r: 2.5, color: 0xff8a1f });
            this.burst({ k: "spark", x: pk.x, y: pk.y, n: 10, dir: 0, color: 0xffb840 });
          }
        }
        if (a.got >= a.need) this.nextStep();
        break;
      case "escort": {
        const f = a.friend;
        if (!f) break;
        if (f.hp <= 0) return this.restart("Mission failed", `${s.npc} has fallen. Ren returns to the hideout.`);
        const to = pois[s.to];
        const d = dist(f, to);
        const threat = this.enemies.some((e) => e.mission && e.state !== "dead" && dist(e, f) < 12);
        if (!threat && dist(p, f) < 15 && d > 3) {
          const want = Math.atan2(to.y - f.y, to.x - f.x);
          const step = Math.min(d, 3 * dt);
          const bx = f.x;
          const by = f.y;
          this.moveBody(f, Math.cos(want) * step, Math.sin(want) * step, 0.4);
          let steerAngle = want;
          const fwd = (f.x - bx) * Math.cos(want) + (f.y - by) * Math.sin(want);
          if (fwd < step * 0.55) {
            const s0 = f.steerDir || 1;
            let bestX = f.x;
            let bestY = f.y;
            let bestMoved = Math.hypot(f.x - bx, f.y - by);
            let doneSteer = false;
            for (const s of [s0, -s0]) {
              for (const mag of [0.7, 1.25, 1.55]) {
                f.x = bx;
                f.y = by;
                const a2 = want + mag * s;
                this.moveBody(f, Math.cos(a2) * step, Math.sin(a2) * step, 0.4);
                const moved = Math.hypot(f.x - bx, f.y - by);
                if (moved >= step * 0.35) {
                  f.steerDir = s;
                  steerAngle = a2;
                  doneSteer = true;
                  break;
                }
                if (moved > bestMoved + 1e-4) {
                  bestMoved = moved;
                  bestX = f.x;
                  bestY = f.y;
                  steerAngle = a2;
                  f.steerDir = s;
                }
              }
              if (doneSteer) break;
            }
            if (!doneSteer) {
              f.x = bestX;
              f.y = bestY;
            }
          }
          const diff = Math.atan2(Math.sin(steerAngle - f.facing), Math.cos(steerAngle - f.facing));
          f.facing += diff * (1 - Math.exp(-dt * 8));
          f.walk += Math.hypot(f.x - bx, f.y - by);
        }
        const frac = 1 - d / (dist(pois[s.from], to) || 1);
        if (a.ambush < s.waves && frac > (a.ambush + 1) / (s.waves + 1)) {
          this.spawnWave({ x: f.x + Math.cos(f.facing) * 6, y: f.y + Math.sin(f.facing) * 6 }, a.ambush, false);
          a.ambush++;
          this.say(`${s.npc}: Ambush!`, f);
        }
        if (d < 4) this.nextStep();
        break;
      }
      case "defend":
      case "survive": {
        const c = pois[s.at];
        if (a.friend && a.friend.hp <= 0 && s.kind === "defend") {
          return this.restart("Mission failed", `${s.npc} was lost. Ren returns to the hideout.`);
        }
        if (!a.started) {
          if (dist(p, c) < 16) {
            a.started = true;
            this.spawnWave(c, 0, true);
          }
          break;
        }
        if (alive) break;
        a.waveT += dt;
        if (a.waveT > 2.5) {
          a.waveT = 0;
          a.wave++;
          a.got = a.wave;
          if (a.wave >= s.waves) this.nextStep();
          else this.spawnWave(c, a.wave, true);
        }
        break;
      }
    }
  }

  private complete() {
    const a = this.active;
    if (!a) return;
    const m = a.m;
    this.active = null;
    this.clearMission();
    if (!this.save.done.includes(m.id)) this.save.done.push(m.id);
    this.gainXp(70 + 14 * m.n + 30 * this.generals());
    this.player.stims = MAX_STIMS;
    if (this.memory) this.leaveMemory();
    const pages: ComicPage[] = m.outro.length ? [m.outro] : [];
    const general = m.cls === "General";
    const finale = general && this.generals() === 5;
    if (general) pages.push(...generalDefeat(m.nation));
    if (finale) pages.push(...EPILOGUE);
    if (m.n === 7 && this.zone.gate) {
      this.zone.gate = null;
      this.refreshSolids();
      this.zoneVersion++;
    }
    writeSave(this.save);
    this.comic(pages, () => {
      const reward = general ? NATIONS[m.nation].reward : undefined;
      if (reward) this.toast(`${WEAPONS[reward].owner}'s ${WEAPONS[reward].name} recovered`, `${WEAPONS[reward].role} Press ${WEAPON_ORDER.indexOf(reward) + 1} to wield it.`);
      else this.toast("Mission complete", m.title);
      this.emit({ type: finale ? "ending" : "progress" });
    });
  }

  /** The point the objective marker leads to. */
  objectivePoint(): Vec | null {
    const a = this.active;
    if (!a) return null;
    const s = a.m.steps[a.i];
    const p = this.player;
    const nearest = <T extends Vec>(list: T[]) => list.reduce<T | null>((best, e) => (!best || dist(p, e) < dist(p, best) ? e : best), null);
    switch (s.kind) {
      case "reach":
        return this.zone.pois[s.at];
      case "defend":
      case "survive":
        if (a.started && dist(p, this.zone.pois[s.at]) < 18) {
          return nearest(this.enemies.filter((e) => e.step && e.state !== "dead")) ?? this.zone.pois[s.at];
        }
        return this.zone.pois[s.at];
      case "collect":
        return nearest(this.pickups.filter((k) => !k.taken)) ?? this.zone.pois[s.at];
      case "escort":
        return a.friend && dist(p, a.friend) > 15 ? a.friend : this.zone.pois[s.to];
      default:
        return nearest(this.enemies.filter((e) => e.step && e.state !== "dead")) ?? this.zone.pois[s.at];
    }
  }

  // ---------- Helpers used by enemies, combat and steps ----------

  /** A free point near a centre. Inside the fortress, points stay in the same room. */
  spot(center: Vec, rMin: number, rMax: number): Vec {
    const z = this.zone;
    const inFort = !!z.fortress && inRect(center, z.fortress);
    const inHall = !!z.hall && inRect(center, z.hall);
    const k = inFort ? 0.55 : 1;
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = (rMin + Math.random() * (rMax - rMin)) * k;
      const pt = { x: center.x + Math.cos(a) * r, y: center.y + Math.sin(a) * r };
      if (pt.x < 2.8 || pt.y < 2.8 || pt.x > z.w - 2.8 || pt.y > z.h - 2.8) continue;
      if (z.fortress && inRect(pt, z.fortress, 1.5) !== inFort) continue;
      if (z.hall && inRect(pt, z.hall) !== inHall) continue;
      if (this.solids.some((s) => inRect(pt, s, 1))) continue;
      return pt;
    }
    return { x: center.x, y: center.y };
  }

  moveBody(b: Vec, dx: number, dy: number, r: number, sub = 0.3) {
    const z = this.zone;
    const edge = 1.6 + r;
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / sub));
    for (let i = 0; i < n; i++) {
      b.x = clamp(b.x + dx / n, edge, z.w - edge);
      b.y = clamp(b.y + dy / n, edge, z.h - edge);
      for (const s of this.solids) {
        if (b.x < s.x - r || b.x > s.x + s.w + r || b.y < s.y - r || b.y > s.y + s.h + r) continue;
        const cx = clamp(b.x, s.x, s.x + s.w);
        const cy = clamp(b.y, s.y, s.y + s.h);
        const ox = b.x - cx;
        const oy = b.y - cy;
        const d = Math.hypot(ox, oy);
        if (d >= r) continue;
        if (d > 0.0001) {
          b.x = cx + (ox / d) * r;
          b.y = cy + (oy / d) * r;
        } else {
          // Inside the rectangle: leave by the nearest side.
          const opts = [
            [s.x - r - b.x, 0],
            [s.x + s.w + r - b.x, 0],
            [0, s.y - r - b.y],
            [0, s.y + s.h + r - b.y],
          ];
          opts.sort((u, v) => Math.abs(u[0] + u[1]) - Math.abs(v[0] + v[1]));
          b.x += opts[0][0];
          b.y += opts[0][1];
        }
      }
    }
  }

  /** Whether a can see b. Cars and barriers hide a crouching body. */
  lineOfSight(a: Vec, b: Vec, low: boolean) {
    const z = this.zone;
    for (const r of z.buildings) if (segHitsRect(a, b, r)) return false;
    for (const r of z.walls) if (segHitsRect(a, b, r)) return false;
    if (z.gate && segHitsRect(a, b, z.gate)) return false;
    if (low) for (const r of z.cover) if (segHitsRect(a, b, r)) return false;
    return true;
  }

  clampToArena(e: Enemy) {
    const z = this.zone;
    const area = z.hall && inRect(e.home, z.hall, 2) ? z.hall : { x: 0, y: 0, w: z.w, h: z.h };
    const m = z.hall && inRect(e.home, z.hall, 2) ? e.radius + 0.6 : 1.6 + e.radius + 0.4;
    e.x = clamp(e.x, area.x + m, area.x + area.w - m);
    e.y = clamp(e.y, area.y + m, area.y + area.h - m);
  }

  targetFor(e: Enemy): Vec {
    const f = this.active?.friend;
    return f && e.mission && f.hp > 0 && dist(e, f) < dist(e, this.player) ? f : this.player;
  }

  hitFriends(e: Enemy, test: (p: Vec, r: number) => boolean, dmg: number, perilous: boolean) {
    if (test(this.player, PLAYER_R)) hurtPlayer(this, dmg, e, perilous, e);
    const f = this.active?.friend;
    if (f && f.hp > 0 && test(f, 0.5)) {
      f.hp -= dmg * 0.6;
      this.float(f, `${Math.round(dmg * 0.6)}`, "#e0102a");
    }
  }

  kill(e: Enemy, by: "takedown" | "blow") {
    e.state = "dead";
    e.deadT = 0;
    e.killedBy = by;
    e.token = false;
    if (this.lock === e) {
      // Mid-fight, the lock passes to the next attacker close by.
      const next = this.lockAuto ? this.engageTarget(this.player.facing, 9, e) : null;
      this.lock = next;
      if (!next) this.lockAuto = false;
    }
    if (e.object) {
      this.burst({ k: "shatter", x: e.x, y: e.y, n: 22, dir: 0 });
    } else if (e.decoy) {
      this.burst({ k: "shadow", x: e.x, y: e.y, n: 14, dir: 0, r: 2.2, color: 0xc02060 });
    } else if (e.boss) {
      this.burst({ k: "shadow", x: e.x, y: e.y, n: 24, dir: 0, r: 4.8, color: 0xff5a1f });
      this.burst({ k: "spark", x: e.x, y: e.y, n: 18, dir: 0, color: 0xffc840 });
    } else {
      if (by !== "takedown" && Math.random() < 0.65) sound.playSfx("enemyDie", { at: e, volume: 0.78 });
      if (!this.memory) {
        if (by === "takedown" && Math.random() < 0.85) {
          this.renAmbient(pickOther(REN_STEALTH_KILL_LINES, this.lastRenLine), 0.3, 4.5);
        } else if (Math.random() < 0.6) {
          this.renAmbient(pickOther(REN_KILL_LINES, this.lastRenLine), 0.2, 4.5);
        }
        const allies = this.enemies.filter((o) => o !== e && o.aware && !o.boss && !o.decoy && !o.object && o.state !== "dead" && dist(this.player, o) < 20);
        if ((allies.length === 1 || allies.length === 2) && this.time >= this.enemyChatterCd && Math.random() < 0.5) {
          const ally = allies[0];
          const line = pickItem(ENEMY_PANIC_LINES);
          if (this.say(`${ally.name}: ${line}`, ally, { priority: "ambient" })) {
            this.enemyChatterCd = this.time + 12;
          }
        }
      }
      this.burst({ k: "shadow", x: e.x, y: e.y, n: 6, dir: 0, r: 1.5, color: 0x901428 });
    }
    if (e.xp) this.gainXp(e.xp);
  }

  burst(b: Burst) {
    this.bursts.push(b);
  }

  shake(n: number) {
    if (getSettings().screenShake) this.shakeAmt = Math.max(this.shakeAmt, n);
  }

  slow(t: number) {
    this.slowT = Math.max(this.slowT, t);
  }

  cinematic(t: number, on: Vec) {
    this.cine = { t, on };
  }

  bossIntro(e: Enemy) {
    const g = NATIONS[this.zone.nation].general;
    const intro = BOSS_INTRO_LINES[this.zone.nation];
    this.cinematic(2.4, e);
    this.slow(0.6);
    this.float(e, `${g.name}, ${g.title}`, "#e0102a", true);
    sound.playSfx("bossIntro", { volume: 1.0 });
    this.bossTauntCd = this.time + 8;
    this.pendingLines.push({
      t: 0.25,
      line: `${intro.speaker}: ${intro.text}`,
      on: e,
      priority: "mission",
    });
    this.pendingLines.push({
      t: 0.5,
      line: `Ren: ${REN_BOSS_LINES[this.zone.nation]}`,
      on: this.player,
      priority: "mission",
      waitVoice: true,
    });
  }

  float(at: Vec, text: string, color: string, big = false) {
    this.floaters.push({ x: at.x + (Math.random() - 0.5) * 0.6, y: at.y, text, t: 0, color, big });
  }

  say(line: string, on: Vec, opts?: { priority?: "mission" | "ambient"; reply?: boolean }): boolean {
    const priority = opts?.priority ?? "mission";
    if (priority === "ambient") {
      if (
        sound.isVoicePlaying() ||
        this.deathT > 0 ||
        this.cine ||
        (!opts?.reply && (this.time < this.ambientCd || this.bubbles.some((b) => b.on === on)))
      ) {
        return false;
      }
      this.ambientCd = this.time + 2.5;
    }
    const idx = line.indexOf(": ");
    const speaker = idx > 0 ? line.slice(0, idx) : "";
    const text = idx > 0 ? line.slice(idx + 2) : line;
    const ghost = /voice/i.test(speaker);
    this.bubbles = this.bubbles.filter((b) => b.on !== on);
    this.bubbles.push({ speaker, text, t: 3 + text.length * 0.045, ghost, on });
    if (ghost) sound.playSfx("ghostChime", { volume: 0.45 });
    const voiceUrl = lookupVoiceLine(speaker || "Narrator", text) ?? lookupVoiceLine("Enemy", text);
    if (voiceUrl) {
      sound.playVoice(voiceUrl, ghost ? { volume: 0.95 } : { volume: 0.95, at: on });
    }
    return true;
  }

  private ghostExchange(ex: GhostExchange): boolean {
    if (this.memory || this.cine || this.player.hp <= 0 || this.time < this.ghostCd) return false;
    if (!this.say(`${ex.speaker}: ${ex.text}`, this.player, { priority: "ambient" })) return false;
    this.ghostCd = this.time + 18;
    this.renVoiceCd = Math.max(this.renVoiceCd, this.time + 6);
    if (ex.reply) {
      this.lastRenLine = ex.reply;
      this.pendingLines.push({ t: 0.35, line: `Ren: ${ex.reply}`, on: this.player, priority: "ambient", waitVoice: true });
    }
    return true;
  }

  private renAmbient(text: string, delay = 0, cooldown = 5.5) {
    if (this.memory || !text || this.player.hp <= 0) return;
    if (this.time < this.renVoiceCd && delay === 0) return;
    if (delay > 0) {
      if (this.pendingLines.some((q) => q.on === this.player)) return;
      this.pendingLines.push({ t: delay, line: `Ren: ${text}`, on: this.player, priority: "ambient" });
      this.lastRenLine = text;
      this.renVoiceCd = this.time + cooldown;
      return;
    }
    if (this.say(`Ren: ${text}`, this.player, { priority: "ambient" })) {
      this.lastRenLine = text;
      this.renVoiceCd = this.time + cooldown;
    }
  }

  onEnemyAlerted(e: Enemy) {
    if (this.memory || this.time < this.spotCryCd || dist(this.player, e) > 22) return;
    this.spotCryCd = this.time + 9;
    this.renAmbient(pickOther(REN_SPOT_ENEMY_LINES, this.lastRenLine), 0.35, 4.5);
  }

  onPerfectParry(attacker: Enemy | null) {
    if (this.memory || this.cine || this.player.hp <= 0) return;
    if (attacker?.boss && Math.random() < 0.72) {
      this.renAmbient(pickOther(REN_PARRY_BOSS_LINES, this.lastRenLine), 0.15, 4.5);
      return;
    }
    if (this.time >= this.ghostCd && Math.random() < 0.55) {
      this.ghostExchange(pickItem(GHOST_PARRY_LINES));
    }
  }

  onPlayerHurt(_taken: number, attacker?: Enemy | null) {
    const p = this.player;
    if (this.memory || p.hp <= 0) return;
    if (attacker?.boss && _taken >= 20 && this.time >= this.bossTauntCd && !sound.isVoicePlaying()) {
      const t = BOSS_HIT_TAUNTS[this.zone.nation];
      const line = pickOther(t.lines, this.lastBossLine);
      if (this.say(`${t.speaker}: ${line}`, attacker, { priority: "ambient" })) {
        this.lastBossLine = line;
        this.bossTauntCd = this.time + 10;
        return;
      }
    }
    if (p.hp > p.maxHp * 0.38 || this.time < this.lowHpCd) return;
    this.lowHpCd = this.time + 16;
    if (this.time >= this.ghostCd && Math.random() < 0.5 && this.ghostExchange(pickItem(GHOST_LOW_HP_LINES))) {
      return;
    }
    this.renAmbient(pickOther(REN_LOW_HP_LINES, this.lastRenLine), 0.25, 5);
  }

  onBossEnrage(boss: Enemy) {
    if (this.enragedBossId === boss.id) return;
    this.enragedBossId = boss.id;
    this.bossTauntCd = Math.max(this.bossTauntCd, this.time + 8);
    const p2 = BOSS_PHASE2_LINES[this.zone.nation];
    this.float(boss, p2.speaker, "#ff4030", true);
    this.say(`${p2.speaker}: ${p2.text}`, boss, { priority: "mission" });
    this.pendingLines.push({ t: 0.4, line: `Ren: ${p2.reply}`, on: this.player, priority: "mission", waitVoice: true });
  }

  onBossDecoys(boss: Enemy) {
    if (this.time < this.bossTauntCd || sound.isVoicePlaying()) return;
    if (this.say(`The Mask: ${BOSS_MASK_DECOY_LINE}`, boss, { priority: "ambient" })) {
      this.bossTauntCd = this.time + 10;
    }
  }

  onBossEvade(boss: Enemy) {
    if (this.memory || this.cine || this.time < this.bossTauntCd || sound.isVoicePlaying()) return;
    const line = BOSS_EVADE_LINES[this.zone.nation];
    if (this.say(`${line.speaker}: ${line.text}`, boss, { priority: "ambient" })) {
      this.bossTauntCd = this.time + 10;
    }
  }

  onBossDeflect(boss: Enemy) {
    if (this.memory || this.cine || this.time < this.bossTauntCd || sound.isVoicePlaying()) return;
    if (this.say(`${BOSS_DEFLECT_LINE.speaker}: ${BOSS_DEFLECT_LINE.text}`, boss, { priority: "ambient" })) {
      this.bossTauntCd = this.time + 10;
    }
  }

  onBossStaggered(boss: Enemy) {
    if (this.memory || this.cine || this.time < this.bossTauntCd || sound.isVoicePlaying()) return;
    const line = BOSS_STAGGER_LINES[this.zone.nation];
    if (this.say(`${line.speaker}: ${line.text}`, boss, { priority: "ambient" })) {
      this.bossTauntCd = this.time + 10;
    }
  }

  onBossSkill(boss: Enemy) {
    if (this.memory || this.cine || this.time < this.bossTauntCd || sound.isVoicePlaying()) return;
    const cfg = BOSS_SKILL_CALLOUTS[this.zone.nation];
    const line = boss.atk.name ? cfg.map[boss.atk.name] : undefined;
    if (!line) return;
    if (this.say(`${cfg.speaker}: ${line}`, boss, { priority: "ambient" })) {
      this.bossTauntCd = this.time + 12;
    }
  }

  onEnemySearch(e: Enemy) {
    if (this.memory || this.cine || sound.isVoicePlaying() || this.time < this.enemyChatterCd || dist(this.player, e) > 22) return;
    if (this.say(`${e.name}: ${pickItem(ENEMY_SEARCH_LINES)}`, e, { priority: "ambient" })) {
      this.enemyChatterCd = this.time + 11;
    }
  }

  onEnemyGiveUp(e: Enemy) {
    if (this.memory || this.cine || sound.isVoicePlaying() || this.time < this.enemyChatterCd || dist(this.player, e) > 22) return;
    if (this.say(`${e.name}: ${pickItem(ENEMY_GIVEUP_LINES)}`, e, { priority: "ambient" })) {
      this.enemyChatterCd = this.time + 11;
    }
  }

  onEnemyBruteCry(e: Enemy) {
    if (this.memory || this.cine || sound.isVoicePlaying() || this.time < this.enemyChatterCd || dist(this.player, e) > 22) return;
    if (this.say(`${e.name}: ${pickItem(ENEMY_BRUTE_LINES)}`, e, { priority: "ambient" })) {
      this.enemyChatterCd = this.time + 10;
    }
  }

  onStimHealed() {
    if (this.memory || Math.random() > 0.9) return;
    this.renAmbient(pickOther(REN_HEAL_LINES, this.lastRenLine), 0.15, 5);
  }

  private toast(title: string, text?: string) {
    this.emit({ type: "toast", title, text });
  }

  private comic(pages: ComicPage[], then: () => void) {
    if (!pages.length) return then();
    this.emit({ type: "comic", pages, then });
  }

  // ---------- Player ----------

  private gainXp(n: number) {
    const s = this.save;
    s.xp += n;
    while (s.xp >= xpNeed(s.level)) {
      s.xp -= xpNeed(s.level);
      s.level++;
      this.player.maxHp = this.maxHp();
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 20);
      this.float(this.player, `Level ${s.level}`, "#ff8a1f", true);
      sound.playSfx("levelup", { volume: 0.95 });
      this.burst({ k: "heal", x: this.player.x, y: this.player.y, z: this.player.z, n: 22, dir: 0, r: 3.6, color: 0xffc840 });
      this.burst({ k: "spark", x: this.player.x, y: this.player.y, z: this.player.z, n: 14, dir: 0, color: 0xffe080 });
    }
  }

  /** Desired movement in world space, from keys or stick, relative to the camera. */
  moveInput(): Vec {
    const ax = this.input.axis();
    const fx = Math.cos(this.camYaw);
    const fy = Math.sin(this.camYaw);
    return { x: -fy * ax.x + fx * ax.y, y: fx * ax.x + fy * ax.y };
  }

  setWeapon(id: WeaponId) {
    const p = this.player;
    if (!this.weapons().includes(id) || p.act.kind !== "idle" || p.weapon === id) return;
    p.weapon = id;
    p.combo = 0;
    sound.playSfx("drawBlade", { volume: 0.72 });
    if (!this.memory) {
      this.save.weapon = id;
      writeSave(this.save);
      if (this.time >= this.weaponSwapCd && Math.random() < 0.85) {
        this.weaponSwapCd = this.time + 8;
        const ghostPool = GHOST_WEAPON_LINES[id];
        if (ghostPool && this.time >= this.ghostCd && Math.random() < 0.55 && this.ghostExchange(pickItem(ghostPool))) {
          return;
        }
        this.renAmbient(pickOther(REN_WEAPON_LINES[id], this.lastRenLine), 0.2, 4.5);
      }
    }
  }

  /** The fighter an attack should turn towards: close, in sight and roughly ahead. */
  engageTarget(dir: number, range = 11, skip: Enemy | null = null): Enemy | null {
    const p = this.player;
    let best: Enemy | null = null;
    let score = Infinity;
    for (const e of this.enemies) {
      if (e === skip || e.state === "dead" || e.object) continue;
      const d = dist(p, e);
      if (d > range || !this.lineOfSight(p, e, false)) continue;
      const a = Math.atan2(e.y - p.y, e.x - p.x) - dir;
      const off = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
      if (off > 1.9 && d > 4) continue;
      const s = d + off * 4 - (e.aware ? 2 : 0);
      if (s < score) {
        score = s;
        best = e;
      }
    }
    return best;
  }

  toggleLock() {
    this.lockAuto = false;
    if (this.lock) {
      this.lock = null;
      return;
    }
    const p = this.player;
    let best: Enemy | null = null;
    let score = Infinity;
    for (const e of this.enemies) {
      if (e.state === "dead" || e.object) continue;
      const d = dist(p, e);
      if (d > 20 || !this.lineOfSight(p, e, false)) continue;
      const off = Math.abs(Math.atan2(Math.sin(Math.atan2(e.y - p.y, e.x - p.x) - this.camYaw), Math.cos(Math.atan2(e.y - p.y, e.x - p.x) - this.camYaw)));
      const s = d + off * 8;
      if (s < score) {
        score = s;
        best = e;
      }
    }
    this.lock = best;
  }

  private handle(action: Action) {
    const p = this.player;
    if (p.hp <= 0) return;
    if (p.act.kind === "getup" && p.act.t > 0.14 && action !== "lock" && action !== "interact") {
      p.act = idleAct();
    }
    const busy = p.act.kind !== "idle";
    const attackTail = p.act.kind === "attack" && p.act.move && p.act.landed >= (p.act.move.hits ?? 1);
    const shouldParkourSpace =
      p.act.kind === "hang" ||
      p.act.kind === "wallrun" ||
      p.act.kind === "slide" ||
      !p.grounded ||
      p.z > 0.35 ||
      this.input.sprinting() ||
      (!this.lock && (hasParkourTargetAhead(this) || Math.hypot(p.vx, p.vy) > 4.2));

    switch (action) {
      case "light":
      case "heavy":
      case "special":
        if ((!busy || (p.act.kind === "slide" && p.act.t > 0.1)) && p.grounded) {
          if (p.act.kind === "slide") p.act = idleAct();
          startAttack(this, action);
        } else if (canBuffer(this)) {
          p.buffer = action;
          p.bufferT = 0.6;
        }
        break;
      case "jump":
        if (p.act.kind === "hang" || p.act.kind === "wallrun" || p.act.kind === "slide" || !busy || p.act.kind === "parkour_roll") {
          tryParkourJump(this);
        } else if (canBuffer(this)) {
          p.buffer = "jump";
          p.bufferT = 0.35;
        }
        break;
      case "space":
        if (shouldParkourSpace) {
          if (p.act.kind === "hang" || p.act.kind === "wallrun" || p.act.kind === "slide" || !busy || p.act.kind === "parkour_roll") {
            tryParkourJump(this);
          } else if (canBuffer(this)) {
            p.buffer = "jump";
            p.bufferT = 0.35;
          }
        } else if (!busy || attackTail) startDodge(this);
        else if (canBuffer(this)) {
          p.buffer = "dodge";
          p.bufferT = 0.35;
        }
        break;
      case "dodge":
        if (!busy || attackTail) startDodge(this);
        else if (canBuffer(this)) {
          p.buffer = "dodge";
          p.bufferT = 0.35;
        }
        break;
      case "guard":
        pressGuard(this);
        break;
      case "stim":
        drinkStim(this);
        break;
      case "crouch":
        trySlideOrDrop(this);
        break;
      case "lock":
        this.toggleLock();
        break;
      case "interact":
        this.prompt?.run();
        break;
      case "weapon1":
      case "weapon2":
      case "weapon3":
      case "weapon4":
        this.setWeapon(WEAPON_ORDER[Number(action.slice(-1)) - 1]);
        break;
    }
  }

  private updatePlayer(dt: number) {
    const p = this.player;
    const inp = this.input;
    for (const action of inp.queue.splice(0)) this.handle(action);

    p.parryT = Math.max(0, p.parryT - dt);
    p.counterT = Math.max(0, p.counterT - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    p.flash = Math.max(0, p.flash - dt);
    p.comboT = Math.max(0, p.comboT - dt);
    p.specialCd = Math.max(0, p.specialCd - dt);
    p.bufferT -= dt;
    if (p.bufferT <= 0) p.buffer = null;
    if (p.comboT <= 0 && p.act.kind !== "attack") p.combo = 0;

    const free = updateAct(this, dt) && p.hp > 0;
    if (free && p.buffer) {
      const b = p.buffer;
      p.buffer = null;
      if (b === "dodge") startDodge(this);
      else if (b === "jump") tryParkourJump(this);
      else startAttack(this, b);
    }

    p.blocking = free && p.grounded && p.act.kind === "idle" && inp.guarding();
    const want = this.moveInput();
    const mag = Math.hypot(want.x, want.y);
    // A lock taken by attacking lets go when the hero sprints off or stops fighting for a while.
    if (this.lock && this.lockAuto && p.act.kind === "idle" && ((inp.sprinting() && mag > 0.1) || this.time - this.lastSwing > 4.5)) {
      this.lock = null;
      this.lockAuto = false;
    }
    const sprint = !p.crouch && !p.blocking && inp.sprinting() && p.stamina > 1 && !this.lock;
    let speed = p.blocking ? 2.6 : p.crouch ? 3.3 : sprint ? 8.8 : 6;
    if (this.lock && !sprint) speed = Math.min(speed, 4.8);
    const keepParkourMom = p.act.kind === "slide" || p.act.kind === "vault" || p.act.kind === "wallrun" || p.act.kind === "ledgehop" || p.act.kind === "parkour_roll" || p.act.kind === "hang";
    if (free) {
      const tvx = want.x * speed;
      const tvy = want.y * speed;
      // Grounded inertia vs softer mid-air steering.
      const k = 1 - Math.exp(-dt * (p.grounded ? (mag > 0.1 ? 10.5 : 13.5) : 3.2));
      p.vx += (tvx - p.vx) * k;
      p.vy += (tvy - p.vy) * k;
      const before = { x: p.x, y: p.y };
      const prevWalk = p.walk;
      moveBody3D(this, p, p.vx * dt, p.vy * dt, PLAYER_R, p.z);
      const moved = dist(before, p);
      if (p.grounded) p.walk += moved;
      p.speed = moved / Math.max(1e-4, dt);
      if (p.grounded && p.speed > 2.2 && Math.floor(prevWalk / 1.15) < Math.floor(p.walk / 1.15)) {
        const wet = this.zone.env.precip === "rain";
        sound.playSfx(wet ? "stepWet" : "stepDry", { volume: p.crouch ? 0.34 : sprint ? 0.72 : 0.52 });
        if (p.speed > 3.6) {
          if (wet) {
            this.burst({ k: "ripple", x: p.x, y: p.y, z: p.z, n: sprint ? 3 : 1, dir: p.facing + Math.PI, r: sprint ? 0.62 : 0.44 });
          } else if (sprint && p.speed > 6.8) {
            this.burst({ k: "dust", x: p.x, y: p.y, z: p.z, n: 2, dir: p.facing + Math.PI, r: 0.4 });
          }
        }
      }
    } else if (!keepParkourMom) {
      p.speed = 0;
      p.vx = p.vy = 0;
    }
    updateVerticalPhysics(this, dt, want);
    if (sprint && p.grounded && p.speed > 4.5) {
      p.stamina -= 14 * dt;
      p.staminaT = this.time + 0.5;
      if (p.crouch) p.crouch = false;
    }

    // Facing: smooth exponential sweep towards lock target or travel heading.
    if (free) {
      let want: number | null = null;
      if (this.lock) want = Math.atan2(this.lock.y - p.y, this.lock.x - p.x);
      else if (mag > 0.1) want = Math.atan2(p.vy, p.vx);
      if (want !== null) {
        const d = Math.atan2(Math.sin(want - p.facing), Math.cos(want - p.facing));
        p.facing += d * (1 - Math.exp(-dt * (this.lock ? 16 : 14)));
      }
    }

    // Stamina: recovers after a pause, slower while guarding.
    if (this.time > p.staminaT) p.stamina = Math.min(p.maxStamina, p.stamina + dt * (p.blocking ? 14 : 34));
    p.stamina = Math.max(-20, p.stamina);

    // Out of combat, wounds slowly close.
    const hunted = this.enemies.some((e) => e.aware && e.state !== "dead" && !e.object && dist(e, p) < 25);
    if (!hunted && p.hp > 0 && this.time - p.lastHurt > 8) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.03 * dt);
  }

  private updateCamera(dt: number) {
    const inp = this.input;
    const k = inp.keys;
    this.camYaw += inp.look.x * 0.004 * getSettings().mouseSensitivity;
    inp.look.x = 0;
    inp.look.y = 0;
    const turn = (k.has("arrowright") ? 1 : 0) - (k.has("arrowleft") ? 1 : 0);
    this.camYaw += turn * dt * 2.2;
    const t = this.lock;
    if (t) {
      if (t.state === "dead" || dist(t, this.player) > 24) this.lock = null;
      else {
        const want = Math.atan2(t.y - this.player.y, t.x - this.player.x);
        const d = Math.atan2(Math.sin(want - this.camYaw), Math.cos(want - this.camYaw));
        this.camYaw += d * Math.min(1, dt * 6);
      }
    }
  }

  // ---------- Frame update ----------

  private update(dt: number) {
    this.time += dt;
    const p = this.player;

    this.updateCamera(dt);
    this.updatePrompt();
    this.updatePlayer(dt);

    if (this.deathT > 0) {
      this.deathT -= dt;
      if (this.deathT <= 0) {
        const who = BROTHER[this.hero];
        this.restart(`${who} has fallen`, this.memory ? "The memory begins again." : "Ren wakes in the hideout. The mission begins again.");
      }
    }

    updateEnemies(this, dt);
    this.updateShots(dt);

    for (const n of this.npcs) {
      n.t += dt;
      if (n.role === "giver") {
        // Quest givers turn attentively toward Ren when nearby and settle back calmly.
        const dHero = dist(n, p);
        const want = dHero < 8 ? Math.atan2(p.y - n.y, p.x - n.x) : Math.PI * 0.45;
        const diff = Math.atan2(Math.sin(want - n.facing), Math.cos(want - n.facing));
        n.facing += diff * (1 - Math.exp(-dt * 5));
        continue;
      }
      if (n.role !== "villager") continue;
      if ((n.pauseT ?? 0) > 0) {
        n.pauseT = (n.pauseT ?? 0) - dt;
        const damp = Math.exp(-dt * 6);
        n.vx = (n.vx ?? 0) * damp;
        n.vy = (n.vy ?? 0) * damp;
        if (dist(n, p) < 4.5) {
          const want = Math.atan2(p.y - n.y, p.x - n.x);
          const diff = Math.atan2(Math.sin(want - n.facing), Math.cos(want - n.facing));
          n.facing += diff * (1 - Math.exp(-dt * 4));
        }
        if ((n.pauseT ?? 0) <= 0) n.goal = this.spot(n.home, 1.5, 4.8);
        continue;
      }
      if (!n.goal) n.goal = this.spot(n.home, 1.5, 4.8);
      const gx = n.goal.x - n.x;
      const gy = n.goal.y - n.y;
      const gd = Math.hypot(gx, gy);
      if (gd < 0.45) {
        n.goal = null;
        n.pauseT = 2.2 + Math.random() * 3.8;
        continue;
      }
      const pace = 1.25;
      const tvx = (gx / gd) * pace;
      const tvy = (gy / gd) * pace;
      const k = 1 - Math.exp(-dt * 5);
      n.vx = (n.vx ?? 0) + (tvx - (n.vx ?? 0)) * k;
      n.vy = (n.vy ?? 0) + (tvy - (n.vy ?? 0)) * k;
      const before = { x: n.x, y: n.y };
      this.moveBody(n, n.vx * dt, n.vy * dt, 0.38);
      const moved = dist(before, n);
      n.walk += moved;
      if (moved < 0.004 * (dt * 60)) {
        n.goal = null;
        n.pauseT = 1.5 + Math.random() * 2;
      } else {
        const want = Math.atan2(n.vy, n.vx);
        const diff = Math.atan2(Math.sin(want - n.facing), Math.cos(want - n.facing));
        n.facing += diff * (1 - Math.exp(-dt * 6));
      }
    }

    this.updateMission(dt);
    this.updateLivingDialogue(dt);

    for (const f of this.floaters) f.t += dt;
    this.floaters = this.floaters.filter((f) => f.t < 1.1);
    for (const b of this.bubbles) b.t -= dt;
    this.bubbles = this.bubbles.filter((b) => b.t > 0);

    this.zone.camps.forEach((c, i) => {
      if (this.enemies.some((e) => e.camp === i && e.state !== "dead")) return;
      this.campT[i] += dt;
      if (this.campT[i] > 60 && dist(p, c) > 35) {
        this.campT[i] = 0;
        this.enemies = this.enemies.filter((e) => e.camp !== i);
        this.spawnCamp(i);
      }
    });

    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.08;
      this.pushHud();
    }
  }

  private updateShots(dt: number) {
    const p = this.player;
    const friend = this.active?.friend;
    for (const s of this.shots) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      const projColor = s.blade ? 0xffe07a : s.pull ? 0xff2880 : 0xff7028;
      if (this.solids.some((r) => inRect(s, r))) {
        s.life = 0;
        this.burst({ k: "spark", x: s.x, y: s.y, n: 5, dir: Math.atan2(-s.vy, -s.vx), color: projColor });
        this.burst({ k: "ring", x: s.x, y: s.y, z: 1.0, n: 1, dir: 0, r: 0.85, color: projColor });
        continue;
      }
      if (dist(s, p) < PLAYER_R + s.r && p.z < 2.2 && !(p.act.kind === "slide" && p.act.t < 0.38)) {
        s.life = 0;
        this.burst({ k: s.blade ? "slash" : "spark", x: s.x, y: s.y, z: p.z, n: s.blade ? 9 : 6, dir: Math.atan2(-s.vy, -s.vx), color: projColor });
        this.burst({ k: "ring", x: s.x, y: s.y, z: p.z + 1.0, n: 1, dir: 0, r: s.blade ? 1.4 : 1.05, color: projColor });
        const before = p.hp;
        hurtPlayer(this, s.dmg, { x: s.sx, y: s.sy }, false, null);
        if (s.pull && p.hp < before && p.hp > 0) this.moveBody(p, (s.sx - p.x) * 0.6, (s.sy - p.y) * 0.6, PLAYER_R);
      } else if (friend && friend.hp > 0 && dist(s, friend) < 0.5 + s.r) {
        s.life = 0;
        this.burst({ k: "spark", x: s.x, y: s.y, n: 5, dir: Math.atan2(-s.vy, -s.vx), color: projColor });
        friend.hp -= s.dmg * 0.6;
      }
    }
    this.shots = this.shots.filter((s) => s.life > 0);
    for (const w of this.shockwaves) {
      w.delay -= dt;
      if (w.delay <= 0 && !w.hit) {
        w.hit = true;
        this.burst({ k: "ring", x: w.x, y: w.y, n: 1, dir: 0, r: w.maxR, color: w.color });
        this.burst({ k: "dust", x: w.x, y: w.y, n: 16, dir: 0, r: w.maxR });
        sound.playSfx("hitHeavy", { at: w, volume: 0.78 });
        this.shake(0.24);
        const dp = dist(w, p);
        if (dp < w.maxR + PLAYER_R && dp > w.maxR * 0.32 && p.z < 0.68) {
          hurtPlayer(this, w.dmg, w, w.perilous, w.owner);
        }
      }
    }
    this.shockwaves = this.shockwaves.filter((w) => !w.hit);
  }

  private npcCommentLine(n: Npc): string {
    const nation = this.save.nation;
    if (n.role === "biwa") return pickOther(BIWA_AMBIENT_LINES, this.lastNpcLine);
    if (n.role === "giver") return FIXER_AMBIENT_LINES[nation];
    const roleName = (n.name === "Watchman" || n.name === "Townswoman" || n.name === "Lookout" ? n.name : "Watchman") as
      | "Watchman"
      | "Townswoman"
      | "Lookout";
    const liberated = this.save.done.includes(`${nation}-7`);
    const pool = [
      ...NPC_VILLAGER_GENERAL[roleName],
      ...(liberated ? NPC_LIBERATED_LINES[nation] : NPC_VILLAGER_DISTRICT[nation]),
    ];
    return pickOther(pool, this.lastNpcLine);
  }

  private updateLivingDialogue(dt: number) {
    const p = this.player;
    if (p.hp <= 0) return;

    const ready: typeof this.pendingLines = [];
    const keep: typeof this.pendingLines = [];
    for (const item of this.pendingLines) {
      if (item.waitVoice && sound.isVoicePlaying()) {
        keep.push(item);
        continue;
      }
      item.t -= dt;
      if (item.t <= 0) ready.push(item);
      else keep.push(item);
    }
    this.pendingLines = keep;
    for (const item of ready) this.say(item.line, item.on, { priority: item.priority, reply: item.waitVoice });

    const hunted = this.enemies.some((e) => e.aware && e.state !== "dead" && !e.object && dist(e, p) < 25);
    if (hunted) {
      this.fightT += dt;
      this.stillT = 0;
      this.wasHunted = true;
    } else if (this.wasHunted) {
      this.wasHunted = false;
      if (!this.memory && this.fightT > 1.5 && Math.random() < 0.9) {
        this.renAmbient(pickOther(REN_BATTLE_WON_LINES, this.lastRenLine), 0.85, 5.5);
      }
      this.fightT = 0;
    }

    if (this.memory || this.cine) return;

    // Distant 3D city atmosphere cues (crows & night gusts) while moving through the districts.
    if (!hunted && this.time >= this.cityAmbSfxCd) {
      this.cityAmbSfxCd = this.time + 20 + Math.random() * 14;
      const a = Math.random() * Math.PI * 2;
      const r = 18 + Math.random() * 14;
      const at = { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r };
      sound.playSfx(Math.random() < 0.55 ? "crowCaw" : "nightWind", { at, volume: 0.48, jitter: 0.08 });
    }

    // Fallen brother stealth whispers when crouching near unaware foes.
    if (!hunted && p.crouch && this.time >= this.ghostCd && !sound.isVoicePlaying()) {
      const nearFoe = this.enemies.some((e) => !e.object && e.state !== "dead" && dist(p, e) < 15);
      if (nearFoe) {
        this.stealthWhisperT += dt;
        if (this.stealthWhisperT >= 2.2) {
          this.stealthWhisperT = 0;
          this.ghostExchange(pickItem(GHOST_STEALTH_LINES));
        }
      } else {
        this.stealthWhisperT = 0;
      }
    } else {
      this.stealthWhisperT = 0;
    }

    // When Ren spots unaware enemies ahead while advancing (not crouched in stealth), bark a challenge.
    if (!hunted && !p.crouch && p.speed > 2.2 && this.time >= this.spotCryCd && this.time >= this.renVoiceCd) {
      const seenFoe = this.enemies.find(
        (e) => !e.object && !e.boss && !e.decoy && e.state !== "dead" && dist(p, e) < 13 && this.lineOfSight(p, e, false),
      );
      if (seenFoe) {
        this.spotCryCd = this.time + 9;
        this.renAmbient(pickOther(REN_SPOT_ENEMY_LINES, this.lastRenLine), 0, 5);
      }
    }

    // Self-aware idle restlessness when the player leaves Ren standing still too long.
    if (!hunted && p.speed < 0.35 && p.act.kind === "idle" && p.grounded && !p.blocking) {
      this.stillT += dt;
      if (this.stillT >= this.nextIdleAt) {
        this.renAmbient(pickOther(REN_IDLE_LINES, this.lastRenLine), 0, 6);
        this.stillT = 0;
        this.nextIdleAt = 10 + Math.random() * 5;
      }
    } else if (p.speed > 0.75 || p.act.kind !== "idle") {
      this.stillT = 0;
      this.nextIdleAt = 6 + Math.random() * 2.5;
    }

    // District reflections & fallen brother memories while traversing out of combat.
    if (!hunted && p.speed > 1.5 && dist(p, this.zone.pois.village) > 9) {
      this.exploreT += dt;
      this.ghostWanderT += dt;
      if (this.ghostWanderT >= this.nextGhostWanderAt && this.time >= this.ghostCd && !sound.isVoicePlaying()) {
        this.ghostWanderT = 0;
        this.nextGhostWanderAt = 26 + Math.random() * 14;
        this.ghostExchange(pickItem(GHOST_WANDER_LINES));
      } else if (this.exploreT >= this.nextExploreAt) {
        this.exploreT = 0;
        this.nextExploreAt = 14 + Math.random() * 8;
        this.renAmbient(pickOther(REN_EXPLORE_LINES[this.zone.nation], this.lastRenLine), 0, 6.5);
      }
    }

    // Random ambient NPC remarks around the hideout.
    if (!hunted && this.time >= this.npcVoiceCd && this.time >= this.ambientCd && !sound.isVoicePlaying()) {
      const nearby = this.npcs.filter(
        (n) => (n.role === "villager" || n.role === "biwa" || n.role === "giver") && dist(p, n) < 10.5,
      );
      if (nearby.length) {
        const locals = nearby.filter((n) => n.role === "villager" || n.role === "biwa");
        const candidates = locals.length ? locals : nearby;
        const fresh = candidates.filter((n) => n !== this.lastNpcSpeaker);
        const pick = (fresh.length ? fresh : candidates)[Math.floor(Math.random() * (fresh.length ? fresh.length : candidates.length))];
        const line = this.npcCommentLine(pick);
        if (this.say(`${pick.name}: ${line}`, pick, { priority: "ambient" })) {
          this.lastNpcLine = line;
          this.lastNpcSpeaker = pick;
          this.npcVoiceCd = this.time + 15 + Math.random() * 9;
        }
      }
    }
  }

  private updatePrompt() {
    this.prompt = null;
    const fin = finisherTarget(this);
    if (fin) {
      this.prompt = { text: fin.kind === "takedown" ? "Stealth takedown" : "Execute", run: () => startFinisher(this, fin) };
      return;
    }
    if (this.memory) return;
    const nation = this.save.nation;
    for (const n of this.npcs) {
      if (dist(this.player, n) > 3) continue;
      if (n.role === "giver" && !this.active) {
        const m = nextMission(this.save, nation);
        if (m) this.prompt = { text: `Talk to ${n.name}`, run: () => this.emit({ type: "offer", mission: m }) };
        else {
          this.prompt = { text: `Talk to ${n.name}`, run: () => this.say(`${n.name}: ${NATIONS[nation].name} is free. Go well, ronin.`, n) };
        }
        return;
      } else if (n.role === "biwa") {
        this.prompt = { text: "Listen to the Biwa Woman", run: () => this.comic(actIntro(nation), () => undefined) };
        return;
      }
    }
    if (!this.active) {
      const villager = this.npcs.find((n) => n.role === "villager" && dist(this.player, n) < 2.6);
      if (villager) {
        this.prompt = {
          text: `Talk to ${villager.name}`,
          run: () => {
            const line = this.npcCommentLine(villager);
            this.lastNpcLine = line;
            this.lastNpcSpeaker = villager;
            this.say(`${villager.name}: ${line}`, villager);
          },
        };
      }
    }
  }

  stealth(): Stealth | null {
    const p = this.player;
    let sus = 0;
    for (const e of this.enemies) {
      if (e.state === "dead" || e.object || dist(e, p) > 30) continue;
      if (e.aware) return "detected";
      sus = Math.max(sus, e.suspicion);
    }
    if (sus > 0.15) return "suspicious";
    return p.crouch ? "hidden" : null;
  }

  private pushHud() {
    const p = this.player;
    const a = this.active;
    const boss = this.enemies.find((e) => e.boss && e.state !== "dead");
    this.onHud({
      hp: Math.max(0, Math.round(p.hp)),
      maxHp: p.maxHp,
      stamina: Math.max(0, Math.round(p.stamina)),
      maxStamina: p.maxStamina,
      stims: p.stims,
      maxStims: MAX_STIMS,
      level: this.save.level,
      xp: this.save.xp,
      xpNeed: xpNeed(this.save.level),
      weapon: p.weapon,
      weapons: this.weapons(),
      specialCd: clamp(p.specialCd / WEAPONS[p.weapon].special.cd, 0, 1),
      crouched: p.crouch,
      stealth: this.stealth(),
      locked: !!this.lock,
      cinematic: !!this.cine,
      zone: this.memory ? "The Night of Red Camellias" : `${NATIONS[this.save.nation].name}, ${NATIONS[this.save.nation].realm}`,
      nation: this.save.nation,
      memory: this.memory,
      hero: BROTHER[this.hero],
      objective: a ? { title: a.m.title, cls: a.m.cls, text: a.m.steps[a.i].text, got: a.got, need: a.need } : null,
      prompt: this.prompt?.text ?? null,
      boss: boss && boss.aware ? { name: `${NATIONS[this.zone.nation].general.name}, ${boss.name}`, hp: Math.max(0, boss.hp), maxHp: boss.maxHp } : null,
      friend: a?.friend ? { name: a.friend.name, hp: Math.max(0, a.friend.hp), maxHp: a.friend.maxHp } : null,
    });
  }

  /** Runs the prompt shown to the player (used by the on-screen interact button). */
  interact() {
    this.prompt?.run();
  }

  /** Raises the alarm in every enemy near a point (used when an object is broken loudly). */
  noise(at: Vec, r: number) {
    for (const e of this.enemies) if (e.state !== "dead" && !e.object && dist(e, at) < r) alert(this, e, this.player);
  }
}
