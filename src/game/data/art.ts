import type { NationId } from "../types";

// Painted illustrations used for key moments. Drawn comic art is used everywhere else.
export const ART = {
  title: "https://cdn.enter.pro/resources/uid_100728836/last-ronin-title_5a81f484.png",
  prologue: "https://cdn.enter.pro/resources/uid_100728836/last-ronin-prologue_5d190c4c.png",
};

/** Painted portraits for each general's defeat page. */
export const GENERAL_ART: Record<NationId, string> = {
  reeds: "https://cdn.enter.pro/resources/uid_100728836/general-ox_f63ce87c.png",
  snow: "https://cdn.enter.pro/resources/uid_100728836/general-bell_4b1ec10c.png",
  tides: "https://cdn.enter.pro/resources/uid_100728836/general-tide_b87bf8ff.png",
  lanterns: "https://cdn.enter.pro/resources/uid_100728836/general-mask_3a3b3e57.png",
  ash: "https://cdn.enter.pro/resources/uid_100728836/general-saint_18bcbab7.png",
};
