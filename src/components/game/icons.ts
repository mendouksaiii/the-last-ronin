import {
  ChevronsRight,
  Crosshair,
  EyeOff,
  Flame,
  Gem,
  HeartHandshake,
  History,
  Link,
  ScrollText,
  Shield,
  Skull,
  Slash,
  Sparkles,
  Sword,
  Swords,
  Syringe,
  Footprints,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { MissionClass, WeaponId } from "@/game/types";

export const WEAPON_ICONS: Record<WeaponId, LucideIcon> = {
  katana: Sword,
  bo: Slash,
  nunchaku: Zap,
  kusari: Link,
};

/** Icons for the combat actions shown on buttons and in the control hints. */
export const ACTION_ICONS = {
  heavy: Swords,
  special: Sparkles,
  dodge: ChevronsRight,
  guard: Shield,
  stim: Syringe,
  crouch: EyeOff,
  lock: Crosshair,
} satisfies Record<string, LucideIcon>;

export const CLASS_ICONS: Record<MissionClass, LucideIcon> = {
  Story: ScrollText,
  Hunt: Swords,
  Gather: Gem,
  Aid: HeartHandshake,
  Sabotage: Flame,
  Memory: History,
  Stronghold: Footprints,
  General: Skull,
};
