import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { FXAAPass } from "three/examples/jsm/postprocessing/FXAAPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { NATIONS } from "../data/nations";
import type { Game } from "../engine/game";
import { dist, type Enemy, type Npc, type Vec } from "../engine/state";
import type { Env } from "../types";
import { bossLook, enemyLook, enemyPose, heroLook, heroPose, npcLook, npcPose } from "./anim";
import { buildCity, type CityScene } from "./city";
import { Effects } from "./effects";
import { GRADE_SHADER } from "./grade";
import { Labels } from "./labels";
import { Ambient } from "./ambient";
import { Crowd, Ground } from "./crowd";
import { Dressing } from "./dressing";
import { applyPose, buildRig, disposeRig, easeYaw, holdWeapon, setFlash, type Pose, type Rig } from "./rig";
import { Telegraph } from "./telegraph";
import { Trail } from "./trail";

// The third-person view of the simulation: a rain-soaked, neon-lit ruined New York.

const LIGHTS = 12;
const toYaw = (facing: number) => Math.PI / 2 - facing;

interface CharView {
  rig: Rig;
  key: string;
  trail: Trail | null;
  tele: Telegraph | null;
  /** Smoothed ground speed and its rate of change, for weight shifts on starts and stops. */
  speed: number;
  accel: number;
  /** Leg-cycle phase, advanced by distance over a stride that lengthens with speed. */
  stride: number;
  last: { x: number; y: number } | null;
  gait: number;
  /** Weapons let go by the dead, tumbling to the street. */
  drops: { obj: THREE.Object3D; vel: THREE.Vector3; spin: THREE.Vector3; rest: boolean }[];
}

/** The hero's blade: in hand or on the back, and the draw/sheathe motion between them. */
interface Blade {
  inHand: boolean;
  /** Seconds into a draw or sheathe, 0 when still. */
  anim: number;
  to: boolean;
  /** Seconds since the fight ended. */
  calm: number;
}

const DRAW_TIME = 0.42;

const _camMid = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _camPosWant = new THREE.Vector3();
const _camLookWant = new THREE.Vector3();

function detectSoftwareGl(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  try {
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (!ext) return false;
    const rendererStr = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? "");
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererStr);
  } catch {
    return false;
  }
}

export class Renderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(58, 1, 0.1, 1000);
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private grade: ShaderPass;
  private labels: Labels;
  private moon: THREE.DirectionalLight;
  private pool: THREE.PointLight[] = [];
  private fill: THREE.PointLight;
  private hemi: THREE.HemisphereLight;
  private ao: GTAOPass | null = null;
  private crowd: Crowd | null = null;
  private ambient: Ambient | null = null;
  private dressing: Dressing | null = null;
  private frameAvg = 1 / 60;
  private adaptT = 3;
  private rim: THREE.PointLight;
  private city: CityScene | null = null;
  private effects: Effects | null = null;
  private zoneVersion = -1;
  private hero: CharView | null = null;
  private blade: Blade = { inHand: false, anim: 0, to: false, calm: 99 };
  private enemies = new Map<number, CharView>();
  private npcs = new Map<Npc, CharView>();
  private objects = new Map<number, THREE.Group>();
  private shots: THREE.Mesh[] = [];
  private pickups: THREE.Group[] = [];
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private lightT = 0;
  private time = 0;
  private hurt = 0;
  private lastHp = 0;
  private resizeObs: ResizeObserver;
  private w = 1;
  private h = 1;
  private first = true;
  private softwareGl = false;
  private lean = false;
  private contextLost = false;
  private nearLights: { l: CityScene["lights"][number]; d: number }[] = [];

  private shotGeo = new THREE.BoxGeometry(0.7, 0.04, 0.04);
  private shotMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.4, 0.2), toneMapped: false });
  private pickupCanGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.6, 10);
  private pickupCanMat = new THREE.MeshStandardMaterial({ color: 0x2a2624, emissive: new THREE.Color(1.6, 0.5, 0.1), emissiveIntensity: 0.6, metalness: 0.5, roughness: 0.4 });
  private pickupBeamGeo = new THREE.CylinderGeometry(0.35, 0.35, 8, 12, 1, true);
  private pickupBeamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 0.45, 0.1), transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  private objBodyGeo = new THREE.BoxGeometry(1.3, 1.2, 1.1);
  private objBodyMat = new THREE.MeshStandardMaterial({ color: 0x3a3634, metalness: 0.6, roughness: 0.5 });
  private objStripeGeo = new THREE.BoxGeometry(1.32, 0.15, 1.12);
  private objStripeMat = new THREE.MeshStandardMaterial({ color: 0x8a1a10, emissive: 0x400000 });
  private objLampGeo = new THREE.SphereGeometry(0.12, 8, 6);
  private objLampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.2, 0.1), toneMapped: false });
  private handleContextLost: (ev: Event) => void;
  private handleContextRestored: () => void;

  constructor(
    private host: HTMLElement,
    private game: Game,
    private lowPower: boolean,
    private onContextLost?: (lost: boolean) => void,
  ) {
    const r = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    this.softwareGl = detectSoftwareGl(r.getContext());
    this.lean = lowPower || this.softwareGl;
    r.setPixelRatio(Math.min(window.devicePixelRatio, this.lean ? 1 : 1.5));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.3;
    r.domElement.className = "absolute inset-0 h-full w-full";
    host.appendChild(r.domElement);
    this.renderer = r;

    this.handleContextLost = (ev: Event) => {
      ev.preventDefault();
      this.contextLost = true;
      this.onContextLost?.(true);
    };
    this.handleContextRestored = () => {
      this.contextLost = false;
      this.onContextLost?.(false);
      this.zoneVersion = -1;
      this.resize();
    };
    r.domElement.addEventListener("webglcontextlost", this.handleContextLost);
    r.domElement.addEventListener("webglcontextrestored", this.handleContextRestored);

    // Overcast night sky light plus warm bounce from the city below keeps every street readable.
    this.hemi = new THREE.HemisphereLight(0x9fb2cc, 0x4a3c32, 2.2);
    this.moon = new THREE.DirectionalLight(0xc8d4e8, 2.2);
    this.moon.castShadow = true;
    this.moon.shadow.mapSize.setScalar(this.lean ? 1024 : 2048);
    const sc = this.moon.shadow.camera;
    sc.left = sc.bottom = -40;
    sc.right = sc.top = 40;
    sc.near = 1;
    sc.far = 320;
    this.moon.shadow.bias = -0.0004;
    this.moon.shadow.normalBias = 0.03;
    this.scene.add(this.hemi, this.moon, this.moon.target);
    for (let i = 0; i < LIGHTS; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 10, 2);
      this.pool.push(l);
      this.scene.add(l);
    }
    // A soft key light from the camera side and a red rim from behind keep the hero readable.
    this.fill = new THREE.PointLight(0xffe8d4, 4, 10, 2);
    this.rim = new THREE.PointLight(0xe0303a, 6, 7, 2);
    this.scene.add(this.fill, this.rim);
    this.scene.environment = this.cityEnvironment();
    this.scene.environmentIntensity = 1;

    this.composer = new EffectComposer(r);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    if (!this.lean) {
      // Contact shadows in corners, under cars and between characters and the street.
      this.ao = new GTAOPass(this.scene, this.camera, 512, 512);
      this.ao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.5, thickness: 1.5, scale: 1.2, samples: 12 });
      this.ao.blendIntensity = 0.85;
      this.composer.addPass(this.ao);
    }
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.6, 0.9);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GRADE_SHADER);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
    this.composer.addPass(new FXAAPass());

    this.labels = new Labels(host);
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(host);
    this.resize();
  }

  /** A district-tailored night sky & neon reflection dome blurred into PMREM for wet streets, glass and steel. */
  private cityEnvironment(zoneEnv?: Env) {
    const env = new THREE.Scene();
    const skyTop = zoneEnv?.sky ?? 0x1c2836;
    const skyMid = zoneEnv?.fog ?? 0x5a6470;
    const skyLow = zoneEnv?.ground ?? 0x3a3230;
    const neons = zoneEnv?.neon ?? [0xc8102e, 0xff5a1f, 0xc8102e];
    const lampCol = zoneEnv?.lampColor ?? 0xffa860;
    const moonCol = zoneEnv?.moonColor ?? 0xb8c8e0;

    const sky = new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ map: skyTexture(skyTop, skyMid, skyLow), side: THREE.BackSide }));
    env.add(sky);
    const panel = (color: number, k: number, x: number, y: number, z: number, w: number, h: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
      m.position.set(x, y, z);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    const neonBoost = zoneEnv ? Math.max(2.2, zoneEnv.bloom * 6) : 3.5;
    panel(neons[0] ?? 0xc8102e, neonBoost, 6, 2, 0, 3.2, 1.2);
    panel(neons[1] ?? neons[0] ?? 0xff5a1f, neonBoost * 0.85, -5, 3, 4, 2.4, 1.1);
    panel(neons[2] ?? neons[0] ?? 0xc8102e, neonBoost * 0.85, 0, 2, -6, 4, 0.9);
    panel(lampCol, 3.8, -4, 4, -4, 1.6, 1.6);
    panel(lampCol, 3.8, 5, 4, 5, 1.6, 1.6);
    panel(moonCol, 1.35, 0, 9, 0, 12, 12);
    const pm = new THREE.PMREMGenerator(this.renderer);
    const tex = pm.fromScene(env, 0.04).texture;
    pm.dispose();
    env.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.MeshBasicMaterial | undefined;
      mat?.map?.dispose();
      mat?.dispose();
    });
    return tex;
  }

  private resize() {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.w = w;
    this.h = h;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w / 2, h / 2);
    this.ao?.setSize(w * this.renderer.getPixelRatio(), h * this.renderer.getPixelRatio());
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.effects?.resize(h * this.renderer.getPixelRatio());
    this.grade.uniforms.aspect.value = w / h;
  }

  // ---------- Zone ----------

  private rebuildZone() {
    const g = this.game;
    this.zoneVersion = g.zoneVersion;
    if (this.city) {
      this.scene.remove(this.city.group);
      this.city.dispose();
    }
    const precipChanged = !this.effects || this.effects.precip !== g.zone.env.precip;
    if (precipChanged) {
      if (this.effects) {
        this.scene.remove(this.effects.group);
        this.effects.dispose();
      }
      this.effects = new Effects(g.zone.env.precip);
      this.effects.resize(this.h * this.renderer.getPixelRatio());
      this.scene.add(this.effects.group);
    }
    this.city = buildCity(g.zone);
    this.scene.add(this.city.group);
    // The living city: people, birds, traffic, drones, litter, billboards and lanterns.
    for (const old of [this.crowd, this.ambient, this.dressing]) {
      if (!old) continue;
      this.scene.remove(old.group);
      old.dispose();
    }
    const ground = new Ground(g.zone);
    this.crowd = new Crowd(ground, this.city, g.zone.env.precip !== "ash", this.lean);
    this.ambient = new Ambient(ground, this.lean);
    this.dressing = new Dressing(g.zone, this.city, ground, this.lean);
    this.scene.add(this.crowd.group, this.ambient.group, this.dressing.group);
    const env = g.zone.env;
    this.scene.fog = new THREE.FogExp2(env.fog, env.fogDensity);
    if (this.scene.background instanceof THREE.Texture) this.scene.background.dispose();
    this.scene.background = skyTexture(env.sky, env.fog, env.ground);
    if (this.scene.environment instanceof THREE.Texture) this.scene.environment.dispose();
    this.scene.environment = this.cityEnvironment(env);

    // District lighting, bloom, hero rim light, and split-tone color grade.
    this.hemi.color.set(env.hemiSky);
    this.hemi.groundColor.set(env.hemiGround);
    this.moon.color.set(env.moonColor);
    this.moon.intensity = env.moonIntensity;
    this.bloom.strength = env.bloom;
    this.grade.uniforms.shadowTint.value.set(...env.gradeShadow);
    this.grade.uniforms.highTint.value.set(...env.gradeHigh);
    const rimColors: Record<typeof g.zone.nation, number> = {
      reeds: 0xe06a30,
      snow: 0x8cc8ff,
      tides: 0x38d8c8,
      lanterns: 0xff2090,
      ash: 0xff4a18,
    };
    const nation = g.zone.id === "memory" ? "ash" : g.zone.nation;
    this.rim.color.set(rimColors[nation]);

    for (const v of this.enemies.values()) this.dropChar(v);
    this.enemies.clear();
    for (const v of this.npcs.values()) this.dropChar(v);
    this.npcs.clear();
    for (const o of this.objects.values()) this.scene.remove(o);
    this.objects.clear();
    this.nearLights.length = 0;
    this.lightT = 0;
    this.first = true;
    if (!this.softwareGl && !this.contextLost) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  private dropChar(v: CharView) {
    this.scene.remove(v.rig.root);
    if (v.trail) {
      this.scene.remove(v.trail.mesh);
      v.trail.dispose();
    }
    if (v.tele) {
      this.scene.remove(v.tele.group);
      v.tele.dispose();
    }
    disposeRig(v.rig);
  }

  private makeChar(key: string, rig: Rig, trail: boolean, tele: boolean): CharView {
    this.scene.add(rig.root);
    const v: CharView = { rig, key, trail: trail ? new Trail() : null, tele: tele ? new Telegraph() : null, speed: 0, accel: 0, stride: 0, last: null, gait: 0, drops: [] };
    if (v.trail) this.scene.add(v.trail.mesh);
    if (v.tele) this.scene.add(v.tele.group);
    return v;
  }

  // ---------- Frame ----------

  /** Adaptive resolution: lowers the render scale when frames run long, raises it when there is headroom. */
  private adapt(dt: number) {
    if (dt <= 0) return;
    this.frameAvg += (Math.min(dt, 0.1) - this.frameAvg) * 0.05;
    this.adaptT -= dt;
    if (this.adaptT > 0) return;
    this.adaptT = 1.5;
    const max = Math.min(window.devicePixelRatio, this.lean ? 1 : 1.5);
    let ratio = this.renderer.getPixelRatio();
    if (this.frameAvg > 1 / 42 && ratio > 0.6) ratio = Math.max(0.6, ratio - 0.15);
    else if (this.frameAvg < 1 / 57 && ratio < max) ratio = Math.min(max, ratio + 0.1);
    else return;
    this.renderer.setPixelRatio(ratio);
    this.composer.setPixelRatio(ratio);
    this.resize();
  }

  frame(dt: number) {
    if (this.contextLost) return;
    const g = this.game;
    this.adapt(dt);
    if (g.zoneVersion !== this.zoneVersion) this.rebuildZone();
    this.time += dt;
    // Simulation is frozen during hit-stop and pauses, so animation follows the game's clock.
    const simDt = g.paused || g.hitstop > 0 ? 0 : dt;

    this.updateHero(simDt);
    this.updateEnemies(simDt);
    this.updateNpcs(simDt);
    this.crowd?.update(simDt, g, this.time);
    this.ambient?.update(simDt, g, this.time);
    this.dressing?.update(this.time);
    this.updateShots();
    this.updatePickups();
    this.updateCamera(dt);
    this.updateLights(dt);

    const fx = this.effects;
    if (fx) {
      for (const b of g.bursts) fx.burst(b);
      fx.update(simDt, this.camera.position, this.city?.emitters ?? [], this.time);
    }
    g.bursts.length = 0;

    // Damage vignette and low-health pulse.
    const p = g.player;
    if (p.hp < this.lastHp) this.hurt = Math.min(1, this.hurt + 0.6);
    this.lastHp = p.hp;
    this.hurt = Math.max(0, this.hurt - dt * 1.4);
    const low = p.hp > 0 && p.hp / p.maxHp < 0.3 ? 0.35 + Math.sin(this.time * 5) * 0.15 : p.hp <= 0 ? 0.8 : 0;
    const u = this.grade.uniforms;
    u.time.value = this.time;
    u.hurt.value = Math.max(this.hurt, low);
    u.cine.value += ((g.cine ? 1 : 0) - u.cine.value) * Math.min(1, dt * 6);
    u.stealth.value += ((p.crouch ? 1 : 0) - u.stealth.value) * Math.min(1, dt * 4);

    this.composer.render(dt);
    this.labels.update(g, this.camera, this.w, this.h, (on) => this.heightOf(on));
  }

  private heightOf(on: object) {
    const g = this.game;
    if (on === g.player) return g.player.crouch ? 1.4 : 1.9;
    const e = on as Enemy;
    const v = this.enemies.get(e.id);
    if (v) return (v.rig.look.beast ? 0.8 : 1.85) * v.rig.look.scale;
    return 1.85;
  }

  /**
   * Advances a character's leg cycle from how far it really moved. Steps lengthen with speed
   * (about 0.7 m walking, 1.3 m running, 1.7 m sprinting), so cadence stays natural.
   */
  private stride(v: CharView, at: Vec, dt: number) {
    if (dt <= 0) return v.stride;
    const moved = v.last ? Math.hypot(at.x - v.last.x, at.y - v.last.y) : 0;
    v.last = { x: at.x, y: at.y };
    const speed = moved > 3 ? 0 : moved / dt;
    v.gait += (speed - v.gait) * (1 - Math.exp(-dt * 10));
    const step = Math.min(1.8, Math.max(0.62, 0.62 + v.gait * 0.13));
    v.stride += (Math.min(moved, 3) / step) * Math.PI;
    return v.stride;
  }

  /**
   * Moves a character like a body with weight: the model sweeps round to its heading instead of
   * snapping, banks into turns, pitches forward as it accelerates and settles back as it stops.
   */
  private move(v: CharView, at: Vec, facing: number, speed: number, pose: Pose, dt: number, turnRate: number) {
    v.rig.root.position.set(at.x, 0, at.y);
    const { yaw, turn } = easeYaw(v.rig, toYaw(facing), dt, turnRate);
    v.rig.root.rotation.y = yaw;
    if (dt > 0) {
      const prev = v.speed;
      v.speed += (speed - v.speed) * (1 - Math.exp(-dt * 10));
      v.accel += ((v.speed - prev) / dt - v.accel) * (1 - Math.exp(-dt * 8));
    }
    const clamp = (x: number, m: number) => Math.max(-m, Math.min(m, x));
    pose.bank += clamp(-turn * v.speed * 0.035, 0.22);
    pose.lean += clamp(v.accel * 0.035, 0.18);
  }

  private updateHero(dt: number) {
    const g = this.game;
    const p = g.player;
    const key = p.weapon;
    if (!this.hero || this.hero.key !== key) {
      if (this.hero) this.dropChar(this.hero);
      this.hero = this.makeChar(key, buildRig(heroLook(p.weapon)), true, false);
      this.blade = { inHand: false, anim: 0, to: false, calm: 99 };
    }
    const v = this.hero;
    const sprint = g.input.sprinting() && !p.crouch;
    const combat = !!g.lock || p.act.kind !== "idle" || g.enemies.some((e) => e.aware && e.state !== "dead" && !e.object && dist(e, p) < 16);
    const reach = this.updateBlade(v.rig, combat, dt);
    const hp = heroPose(p, this.time, sprint, combat, this.stride(v, p, dt), this.blade.inHand || !v.rig.sheath, reach);
    const turnRate = p.hp <= 0 ? 4 : p.act.kind === "dodge" ? 40 : p.act.kind === "attack" ? 28 : p.act.kind === "takedown" ? 30 : p.speed > 0.5 ? 15 : 20;
    this.move(v, p, hp.yaw ?? p.facing, p.speed, hp.pose, dt, turnRate);
    applyPose(v.rig, hp.pose, dt, p.hp <= 0 ? 24 : p.act.kind === "attack" ? 34 : 20);
    if (v.rig.tails) {
      if (p.hp <= 0) {
        v.rig.tails.rotation.x = -0.14 + Math.sin(this.time * 2) * 0.025;
        v.rig.tails.rotation.y = Math.cos(this.time * 1.4) * 0.02;
      } else {
        v.rig.tails.rotation.x = -0.25 - Math.min(0.95, p.speed * 0.13) + Math.sin(this.time * 7.5) * (0.05 + p.speed * 0.012);
        v.rig.tails.rotation.y = Math.cos(this.time * 5.2) * (0.04 + p.speed * 0.015);
      }
    }
    setFlash(v.rig, p.flash > 0 ? p.flash * 4 : p.counterT > 0 ? 0.15 + Math.sin(this.time * 20) * 0.1 : 0);
    for (const m of v.rig.glow) m.emissiveIntensity = v.rig.look.eyeGlow * (p.hp <= 0 ? Math.max(0, 1 - p.act.t * 1.4) : 1);
    v.rig.root.visible = !(p.invuln > 0 && p.act.kind === "idle" && Math.floor(this.time * 20) % 2 === 0 && p.hp > 0);
    if (p.hp <= 0) {
      this.dropWeapons(v, p.act.t, dt);
    } else if (v.drops.length) {
      if (v.rig.weapon) {
        v.rig.armR.end.add(v.rig.weapon.group);
        v.rig.weapon.group.position.set(0, 0, 0);
        v.rig.weapon.group.quaternion.identity();
        holdWeapon(v.rig, this.blade.inHand);
      }
      v.drops.length = 0;
    }
    v.rig.root.updateMatrixWorld(true);
    v.trail?.update(dt, v.rig.weapon, hp.trail, p.counterT > 0 || p.act.bonus > 1 ? 0xff6a1a : 0xd8dce4);
  }

  /**
   * Out of a fight the katana rides in its scabbard on the hero's back. When a fight starts he
   * reaches over his shoulder and draws it; a few seconds after it ends he puts it away. An
   * attack or guard while it is sheathed draws it at once, as part of the move.
   */
  private updateBlade(rig: Rig, fight: boolean, dt: number) {
    const b = this.blade;
    if (!rig.sheath) return 0;
    const p = this.game.player;
    if (p.hp <= 0) return 0;
    b.calm = fight || p.blocking ? 0 : b.calm + dt;
    const want = b.calm < 3;
    const quick = p.act.kind === "attack" || p.act.kind === "takedown" || p.act.kind === "block" || p.blocking;
    if (quick && !b.inHand) {
      b.inHand = true;
      b.anim = 0;
      holdWeapon(rig, true);
      return 0;
    }
    if (!b.anim && want !== b.inHand && p.act.kind === "idle") {
      b.anim = 1e-4;
      b.to = want;
    }
    if (!b.anim) return 0;
    b.anim += dt;
    const k = Math.min(1, b.anim / DRAW_TIME);
    if (k >= 0.5 && b.inHand !== b.to) {
      b.inHand = b.to;
      holdWeapon(rig, b.to);
    }
    if (k >= 1) b.anim = 0;
    return Math.sin(k * Math.PI);
  }

  /** The dead let go of their weapons, which tumble and clatter onto the street. */
  private dropWeapons(v: CharView, deadT: number, dt: number) {
    const rig = v.rig;
    if (deadT > 0.32) {
      for (const w of [rig.weapon, rig.off]) {
        if (!w || w.group.parent === rig.root || w.group.parent === rig.sheath?.back) continue;
        rig.root.updateMatrixWorld(true);
        rig.root.attach(w.group);
        if (w.laser) w.laser.visible = false;
        // Velocity is in the body's own frame: flung out to one side and a little behind.
        const side = Math.random() < 0.5 ? -1 : 1;
        v.drops.push({
          obj: w.group,
          vel: new THREE.Vector3(side * 0.9, 1.6, -0.6),
          spin: new THREE.Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 10),
          rest: false,
        });
      }
    }
    for (const d of v.drops) {
      if (d.rest || dt <= 0) continue;
      d.vel.y -= 9.8 * dt;
      d.obj.position.addScaledVector(d.vel, dt);
      d.obj.rotation.x += d.spin.x * dt;
      d.obj.rotation.y += d.spin.y * dt;
      d.obj.rotation.z += d.spin.z * dt;
      if (d.obj.position.y <= 0.04) {
        // A bounce, then it lies flat.
        d.obj.position.y = 0.04;
        if (Math.abs(d.vel.y) > 1.2) {
          d.vel.set(d.vel.x * 0.4, -d.vel.y * 0.3, d.vel.z * 0.4);
          d.spin.multiplyScalar(0.4);
        } else {
          d.rest = true;
          d.obj.rotation.set(0, d.obj.rotation.y, Math.PI / 2);
        }
      }
    }
  }

  private updateEnemies(dt: number) {
    const g = this.game;
    const seen = new Set<number>();
    const general = NATIONS[g.zone.nation].general;
    for (const e of g.enemies) {
      if (e.object) {
        this.updateObject(e);
        seen.add(e.id);
        continue;
      }
      seen.add(e.id);
      let v = this.enemies.get(e.id);
      if (!v) {
        const look = e.boss ? bossLook(e) : e.decoy ? bossLook({ ...e, boss: general.boss }) : enemyLook(e, e.beast);
        v = this.makeChar(`${e.id}`, buildRig(look), !!e.boss || e.elite || e.decoy, true);
        this.enemies.set(e.id, v);
      }
      const far = dist(e, g.player) > 70;
      v.rig.root.visible = !far;
      if (far) {
        if (v.tele) v.tele.group.visible = false;
        if (v.trail) v.trail.mesh.visible = false;
        continue;
      }
      const ep = enemyPose(e, this.time, this.stride(v, e, dt));
      const moving = ["patrol", "search", "chase", "circle", "home"].includes(e.state);
      this.move(v, e, e.state === "windup" ? e.aim : e.facing, moving ? (e.state === "chase" ? e.speed : e.speed * 0.4) : 0, ep.pose, dt, e.state === "windup" || e.state === "recover" ? 22 : 12);
      applyPose(v.rig, ep.pose, dt, e.state === "recover" ? 32 : 20);
      setFlash(v.rig, e.flash > 0 ? e.flash * 6 : 0);
      for (const m of v.rig.glow) m.emissiveIntensity = v.rig.look.eyeGlow * (1 + ep.telegraph * 2.5) * (e.state === "dead" ? Math.max(0, 1 - e.deadT) : 1);
      if (v.rig.weapon?.laser) v.rig.weapon.laser.visible = ep.laser;
      if (v.rig.weapon?.steel) v.rig.weapon.steel.emissive.setRGB(ep.telegraph * (e.atk.perilous ? 2 : 0.8), ep.telegraph * (e.atk.perilous ? 0.5 : 0.1), 0);
      if (e.state === "dead") {
        this.dropWeapons(v, e.deadT, dt);
        // Sink into the street after lying still a while.
        if (e.deadT > 7.2) v.rig.root.position.y = -(e.deadT - 7.2) * 0.45;
      }
      v.rig.root.updateMatrixWorld(true);
      v.trail?.update(dt, v.rig.weapon, ep.trail, e.atk.perilous ? 0xff5a1f : 0xc8102e);
      v.tele?.update(e, e.state === "windup" ? ep.telegraph : -1, this.time);
    }
    for (const [id, v] of this.enemies) {
      if (!seen.has(id)) {
        this.dropChar(v);
        this.enemies.delete(id);
      }
    }
    for (const [id, o] of this.objects) {
      if (!seen.has(id)) {
        this.scene.remove(o);
        this.objects.delete(id);
      }
    }
  }

  /** Sabotage targets: generators, caches and engines with a red warning lamp. */
  private updateObject(e: Enemy) {
    let o = this.objects.get(e.id);
    if (!o) {
      o = new THREE.Group();
      const body = new THREE.Mesh(this.objBodyGeo, this.objBodyMat);
      body.position.y = 0.6;
      body.castShadow = true;
      const stripe = new THREE.Mesh(this.objStripeGeo, this.objStripeMat);
      stripe.position.y = 0.95;
      const lamp = new THREE.Mesh(this.objLampGeo, this.objLampMat);
      lamp.position.y = 1.35;
      lamp.name = "lamp";
      o.add(body, stripe, lamp);
      this.scene.add(o);
      this.objects.set(e.id, o);
    }
    o.position.set(e.x, 0, e.y);
    o.visible = e.state !== "dead";
    const lamp = o.getObjectByName("lamp");
    if (lamp) lamp.visible = Math.floor(this.time * 3 + e.id) % 2 === 0;
    o.rotation.z = e.flash > 0 ? Math.sin(this.time * 80) * 0.04 : 0;
  }

  private updateNpcs(dt: number) {
    const g = this.game;
    const seen = new Set<Npc>();
    for (const n of g.npcs) {
      seen.add(n);
      let v = this.npcs.get(n);
      if (!v) {
        if (n.look === "cargo") {
          const rig = buildRig({ ...npcLook(n), scale: 1 });
          rig.root.visible = false;
          v = this.makeChar("cargo", rig, false, false);
          const cart = new THREE.Group();
          const crateGeo = new THREE.BoxGeometry(1, 0.8, 1);
          const crateMat = new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 0.9 });
          for (let i = 0; i < 3; i++) {
            const c = new THREE.Mesh(crateGeo, crateMat);
            c.position.set((i - 1) * 1.05, 0.4 + (i === 1 ? 0.8 : 0), 0);
            c.castShadow = true;
            if (i === 0) c.userData.own = true;
            cart.add(c);
          }
          v.rig.root.add(cart);
          v.rig.body.visible = false;
          rig.root.visible = true;
        } else v = this.makeChar("npc", buildRig(npcLook(n)), false, false);
        this.npcs.set(n, v);
      }
      const phase = this.stride(v, n, dt);
      const dHero = dist(n, g.player);
      const relAngle = Math.atan2(Math.sin(Math.atan2(g.player.y - n.y, g.player.x - n.x) - n.facing), Math.cos(Math.atan2(g.player.y - n.y, g.player.x - n.x) - n.facing));
      const np = npcPose(n, this.time, phase, v.gait, { angle: relAngle, dist: dHero });
      this.move(v, n, n.facing, v.gait, np, dt, 6);
      applyPose(v.rig, np, dt, 10);
    }
    for (const [n, v] of this.npcs) {
      if (!seen.has(n)) {
        this.dropChar(v);
        this.npcs.delete(n);
      }
    }
  }

  private updateShots() {
    const g = this.game;
    while (this.shots.length < g.shots.length) {
      const m = new THREE.Mesh(this.shotGeo, this.shotMat);
      this.scene.add(m);
      this.shots.push(m);
    }
    for (let i = 0; i < this.shots.length; i++) {
      const m = this.shots[i];
      const s = g.shots[i];
      m.visible = !!s;
      if (!s) continue;
      m.position.set(s.x, 1.25, s.y);
      m.rotation.y = -Math.atan2(s.vy, s.vx);
      m.scale.set(s.pull ? 0.5 : 1, s.pull ? 3 : 1, s.pull ? 3 : 1);
    }
  }

  private updatePickups() {
    const g = this.game;
    while (this.pickups.length < g.pickups.length) {
      const grp = new THREE.Group();
      const can = new THREE.Mesh(this.pickupCanGeo, this.pickupCanMat);
      can.position.y = 0.5;
      can.name = "can";
      const beam = new THREE.Mesh(this.pickupBeamGeo, this.pickupBeamMat);
      beam.position.y = 4;
      grp.add(can, beam);
      this.scene.add(grp);
      this.pickups.push(grp);
    }
    for (let i = 0; i < this.pickups.length; i++) {
      const grp = this.pickups[i];
      const pk = g.pickups[i];
      grp.visible = !!pk && !pk.taken;
      if (!pk) continue;
      grp.position.set(pk.x, 0, pk.y);
      const can = grp.getObjectByName("can");
      if (can) {
        can.rotation.y = this.time * 1.5;
        can.position.y = 0.5 + Math.sin(this.time * 3 + i) * 0.08;
      }
    }
  }

  // ---------- Camera ----------

  private blocked(from: THREE.Vector3, to: THREE.Vector3) {
    const blockers = this.city?.blockers ?? [];
    let best = 1;
    const steps = 16;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = from.x + (to.x - from.x) * t;
      const y = from.y + (to.y - from.y) * t;
      const z = from.z + (to.z - from.z) * t;
      for (const b of blockers) {
        if (y < b.top && x > b.x - 0.4 && x < b.x + b.w + 0.4 && z > b.y - 0.4 && z < b.y + b.h + 0.4) {
          best = Math.min(best, (i - 1) / steps);
          return best;
        }
      }
    }
    return best;
  }

  private updateCamera(dt: number) {
    const g = this.game;
    const p = g.player;
    const cam = this.camera;
    const yaw = g.camYaw;
    const fx = Math.cos(yaw);
    const fz = Math.sin(yaw);
    const rx = -fz;
    const rz = fx;
    let fov = 58;
    if (g.cine) {
      // Close, low side angle on the moment, drifting slowly around it.
      const on = g.cine.on;
      _camMid.set((p.x + on.x) * 0.5, 1.1, (p.y + on.y) * 0.5);
      const a = Math.atan2(on.y - p.y, on.x - p.x) + Math.PI / 2 + Math.sin(this.time * 0.6) * 0.25;
      _camPosWant.set(_camMid.x + Math.cos(a) * 3.6, 1.35, _camMid.z + Math.sin(a) * 3.6);
      _camLookWant.copy(_camMid);
      fov = 42;
    } else if (p.hp <= 0) {
      // Lower cleanly to street height and drift around the fallen body.
      const k = Math.min(1, p.act.t / 1.0);
      const a = yaw + Math.PI + Math.sin(this.time * 0.45) * 0.22 + k * 0.38;
      _camTarget.set(p.x, 0.35, p.y);
      _camPosWant.set(p.x + Math.cos(a) * 3.2, 1.25 - k * 0.15, p.y + Math.sin(a) * 3.2);
      _camLookWant.set(p.x, 0.24, p.y);
      const blk = this.blocked(_camTarget, _camPosWant);
      if (blk < 1) _camPosWant.lerpVectors(_camTarget, _camPosWant, Math.max(0.3, blk));
      fov = 48;
    } else {
      const lock = g.lock;
      const crouch = p.crouch ? -0.35 : 0;
      const back = lock ? 5.4 : p.speed > 5 ? 5.0 : 4.4;
      const shoulder = lock ? 0.35 : 0.65;
      _camTarget.set(p.x + rx * shoulder, 1.55 + crouch, p.y + rz * shoulder);
      _camPosWant.set(_camTarget.x - fx * back, 2.35 + crouch, _camTarget.z - fz * back);
      if (lock) _camLookWant.set((p.x * 2 + lock.x) / 3, 1.3, (p.y * 2 + lock.y) / 3);
      else _camLookWant.set(_camTarget.x + fx * 4, 1.25 + crouch, _camTarget.z + fz * 4);
      const k = this.blocked(_camTarget, _camPosWant);
      if (k < 1) _camPosWant.lerpVectors(_camTarget, _camPosWant, Math.max(0.25, k));
      if (p.act.kind === "dodge") fov = 62;
      else if (p.speed > 5) fov = 64;
    }
    const s = this.first ? 1 : 1 - Math.exp(-dt * (g.cine ? 5 : 10));
    this.first = false;
    this.camPos.lerp(_camPosWant, s);
    this.camLook.lerp(_camLookWant, s);
    cam.position.copy(this.camPos);
    // A faint hand-held drift so the camera never feels locked to a rail.
    cam.position.y += Math.sin(this.time * 0.9) * 0.025 + Math.min(1, p.speed / 6) * Math.sin(p.walk * 7) * 0.02;
    cam.position.x += Math.sin(this.time * 0.63) * 0.02;
    if (g.shakeAmt > 0) {
      const k = g.shakeAmt * 0.35;
      cam.position.x += (Math.random() - 0.5) * k;
      cam.position.y += (Math.random() - 0.5) * k;
      cam.position.z += (Math.random() - 0.5) * k;
    }
    cam.lookAt(this.camLook);
    cam.fov += (fov - cam.fov) * Math.min(1, dt * 5);
    cam.updateProjectionMatrix();

    // Lights that follow the hero.
    this.fill.position.set(p.x - fx * 2.5 + rx * 1.2, 2.6, p.y - fz * 2.5 + rz * 1.2);
    this.rim.position.set(p.x + fx * 1.6 - rx * 0.8, 2.1, p.y + fz * 1.6 - rz * 0.8);
    // High enough to sit above the tallest towers, so their shadows fall whole.
    this.moon.position.set(p.x + 70, 150, p.y - 52);
    this.moon.target.position.set(p.x, 0, p.y);
  }

  private updateLights(dt: number) {
    const city = this.city;
    if (!city) return;
    const p = this.game.player;
    this.lightT -= dt;
    if (this.lightT <= 0) {
      this.lightT = 0.3;
      const srcLights = city.lights;
      const buf = this.nearLights;
      for (let i = 0; i < srcLights.length; i++) {
        const l = srcLights[i];
        const dx = l.pos.x - p.x;
        const dz = l.pos.z - p.y;
        const d = dx * dx + dz * dz;
        if (i < buf.length) {
          buf[i].l = l;
          buf[i].d = d;
        } else {
          buf.push({ l, d });
        }
      }
      buf.length = srcLights.length;
      // Selection-find the nearest LIGHTS entries in-place to avoid sorting the full array.
      const limit = Math.min(LIGHTS, buf.length);
      for (let i = 0; i < limit; i++) {
        let best = i;
        let bestD = buf[i].d;
        for (let j = i + 1; j < buf.length; j++) {
          if (buf[j].d < bestD) {
            bestD = buf[j].d;
            best = j;
          }
        }
        if (best !== i) {
          const tmp = buf[i];
          buf[i] = buf[best];
          buf[best] = tmp;
        }
      }
      for (let i = 0; i < this.pool.length; i++) {
        const pl = this.pool[i];
        const src = i < limit ? buf[i].l : null;
        pl.userData.src = src;
        if (!src) {
          pl.intensity = 0;
          continue;
        }
        pl.position.copy(src.pos);
        pl.color.set(src.color);
        pl.distance = src.distance;
      }
    }
    for (const pl of this.pool) {
      const src = pl.userData.src as CityScene["lights"][number] | null;
      if (!src) continue;
      let k = 1;
      if (src.flicker === 1) k = 0.75 + Math.sin(this.time * 13 + src.seed) * 0.12 + Math.sin(this.time * 31 + src.seed * 2) * 0.1;
      else if (src.flicker === 2) k = Math.sin(this.time * 2 + src.seed) > 0.9 && Math.sin(this.time * 47) > 0 ? 0.1 : 1;
      pl.intensity = src.intensity * k;
    }
    for (const s of city.signs) {
      const off = Math.sin(this.time * 1.3 + s.seed) > 0.97 && Math.sin(this.time * 41 + s.seed) > 0;
      s.mat.opacity = off ? 0.15 : 1;
    }
    for (const f of city.flames) {
      const seed = f.userData.seed as number;
      f.scale.set(1 + Math.sin(this.time * 17 + seed) * 0.15, 0.8 + Math.sin(this.time * 11 + seed) * 0.3, 1 + Math.cos(this.time * 13 + seed) * 0.15);
      f.rotation.y = this.time * 3;
    }
  }

  dispose() {
    this.resizeObs.disconnect();
    this.renderer.domElement.removeEventListener("webglcontextlost", this.handleContextLost);
    this.renderer.domElement.removeEventListener("webglcontextrestored", this.handleContextRestored);
    if (this.hero) this.dropChar(this.hero);
    this.hero = null;
    for (const v of this.enemies.values()) this.dropChar(v);
    this.enemies.clear();
    for (const v of this.npcs.values()) this.dropChar(v);
    this.npcs.clear();
    for (const o of this.objects.values()) this.scene.remove(o);
    this.objects.clear();
    for (const m of this.shots) this.scene.remove(m);
    this.shots.length = 0;
    for (const grp of this.pickups) this.scene.remove(grp);
    this.pickups.length = 0;
    this.shotGeo.dispose();
    this.shotMat.dispose();
    this.pickupCanGeo.dispose();
    this.pickupCanMat.dispose();
    this.pickupBeamGeo.dispose();
    this.pickupBeamMat.dispose();
    this.objBodyGeo.dispose();
    this.objBodyMat.dispose();
    this.objStripeGeo.dispose();
    this.objStripeMat.dispose();
    this.objLampGeo.dispose();
    this.objLampMat.dispose();
    if (this.city) this.city.dispose();
    this.crowd?.dispose();
    this.ambient?.dispose();
    this.dressing?.dispose();
    this.effects?.dispose();
    if (this.scene.background instanceof THREE.Texture) this.scene.background.dispose();
    if (this.scene.environment instanceof THREE.Texture) this.scene.environment.dispose();
    this.labels.dispose();
    this.ao?.dispose();
    this.bloom.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  get canvas() {
    return this.renderer.domElement;
  }
}

/** A vertical gradient sky (zenith to horizon to ground), mapped as an equirectangular backdrop. */
function skyTexture(top: number, horizon: number, below: number) {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 256;
  const ctx = c.getContext("2d");
  if (ctx) {
    const css = (hex: number) => `#${hex.toString(16).padStart(6, "0")}`;
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, css(top));
    g.addColorStop(0.42, css(horizon));
    g.addColorStop(0.5, css(horizon));
    g.addColorStop(1, css(below));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 256);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}
