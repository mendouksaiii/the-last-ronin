import type { ActorId, Archetype, ComicPage, Mission, MissionClass, NationId, Panel, PoiKey, SceneId, Step, WeaponId } from "../../types";

// Small builders that keep the fifty mission scripts short and readable.

/** A comic panel builder bound to one scene. */
export const scene =
  (s: SceneId) =>
  (actors: ActorId[], caption?: string, speech?: string): Panel => ({ scene: s, actors, caption, speech });

export const reach = (at: PoiKey, text: string, say?: string): Step => ({ kind: "reach", at, text, say });

export const kill = (at: PoiKey, enemy: Archetype, count: number, text: string, opts: { elite?: string; say?: string } = {}): Step => ({
  kind: "kill",
  at,
  enemy,
  count,
  text,
  ...opts,
});

export const collect = (at: PoiKey, item: string, count: number, guards: number, text: string, say?: string): Step => ({
  kind: "collect",
  at,
  item,
  count,
  guards,
  text,
  say,
});

export const destroy = (at: PoiKey, target: string, count: number, guards: number, text: string, say?: string): Step => ({
  kind: "destroy",
  at,
  target,
  count,
  guards,
  text,
  say,
});

export const escort = (from: PoiKey, to: PoiKey, npc: string, waves: number, text: string, say?: string): Step => ({
  kind: "escort",
  from,
  to,
  npc,
  waves,
  text,
  say,
});

export const defend = (at: PoiKey, npc: string, waves: number, text: string, say?: string): Step => ({
  kind: "defend",
  at,
  npc,
  waves,
  text,
  say,
});

export const survive = (at: PoiKey, waves: number, text: string, say?: string): Step => ({ kind: "survive", at, waves, text, say });

export const boss = (at: PoiKey, text: string, say?: string): Step => ({ kind: "boss", at, text, say });

interface Script {
  title: string;
  cls: MissionClass;
  beat: string;
  intro: ComicPage;
  steps: Step[];
  outro: ComicPage;
  playAs?: WeaponId;
}

/** Turns ten scripts into the ten numbered missions of a nation. */
export function nationMissions(nation: NationId, scripts: Script[]): Mission[] {
  return scripts.map((s, i) => ({ ...s, nation, n: i + 1, id: `${nation}-${i + 1}` }));
}
