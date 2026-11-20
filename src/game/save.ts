import { MISSIONS } from "./data/missions";
import { NATION_ORDER, NATIONS } from "./data/nations";
import { WEAPONS } from "./data/weapons";
import type { Mission, NationId, SaveData, WeaponId } from "./types";

// Progress is kept on this device only.
const KEY = "last-ronin-save-v1";

export function newSave(): SaveData {
  return { level: 1, xp: 0, done: [], nation: "reeds", visited: [], prologue: false, weapon: "katana" };
}

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const save = { ...newSave(), ...(JSON.parse(raw) as Partial<SaveData>) };
    if (!(save.weapon in WEAPONS)) save.weapon = "katana";
    return save;
  } catch {
    return null;
  }
}

export function writeSave(save: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // Storage can be unavailable (private mode); the game still runs for this session.
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}

export const generalSlain = (save: SaveData, nation: NationId) => save.done.includes(`${nation}-10`);

export const generalsSlain = (save: SaveData) => NATION_ORDER.filter((n) => generalSlain(save, n)).length;

export const nationProgress = (save: SaveData, nation: NationId) => save.done.filter((id) => id.startsWith(`${nation}-`)).length;

/** The Ash Ward stays sealed until the other four generals are dead. */
export const nationOpen = (save: SaveData, nation: NationId) =>
  nation !== "ash" || NATION_ORDER.filter((n) => n !== "ash").every((n) => generalSlain(save, n));

export function nextMission(save: SaveData, nation: NationId): Mission | null {
  return MISSIONS[nation].find((m) => !save.done.includes(m.id)) ?? null;
}

export function unlockedWeapons(save: SaveData): WeaponId[] {
  const list: WeaponId[] = ["katana"];
  for (const n of NATION_ORDER) {
    const reward = NATIONS[n].reward;
    if (reward && generalSlain(save, n)) list.push(reward);
  }
  return list;
}

export const xpNeed = (level: number) => 60 + 40 * level;
