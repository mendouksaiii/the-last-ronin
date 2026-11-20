import type { ActorId, SceneId } from "../types";

// Ink-brush palettes and character sheets for the drawn comic panels.

export interface SceneArt {
  sky: [string, string];
  sun: string;
  sunAt: [number, number, number];
  far: string;
  land: string;
  motif: "reeds" | "peaks" | "waves" | "roofs" | "volcano" | "fire" | "castle" | "torii" | "grave";
}

export const SCENES: Record<SceneId, SceneArt> = {
  reeds: { sky: ["hsl(200 10% 8%)", "hsl(200 8% 20%)"], sun: "hsl(30 10% 70%)", sunAt: [320, 50, 16], far: "hsl(200 8% 12%)", land: "hsl(200 8% 9%)", motif: "reeds" },
  snow: { sky: ["hsl(210 10% 10%)", "hsl(210 8% 28%)"], sun: "hsl(30 10% 80%)", sunAt: [90, 52, 18], far: "hsl(210 8% 14%)", land: "hsl(210 6% 22%)", motif: "peaks" },
  tides: { sky: ["hsl(200 12% 7%)", "hsl(14 40% 20%)"], sun: "hsl(18 90% 50%)", sunAt: [310, 120, 26], far: "hsl(200 10% 10%)", land: "hsl(200 12% 8%)", motif: "waves" },
  lanterns: { sky: ["hsl(350 30% 6%)", "hsl(350 40% 16%)"], sun: "hsl(350 60% 40%)", sunAt: [330, 46, 10], far: "hsl(350 10% 6%)", land: "hsl(350 10% 8%)", motif: "roofs" },
  ash: { sky: ["hsl(15 20% 8%)", "hsl(16 60% 26%)"], sun: "hsl(20 95% 50%)", sunAt: [200, 170, 70], far: "hsl(12 10% 7%)", land: "hsl(15 10% 9%)", motif: "volcano" },
  castle: { sky: ["hsl(350 45% 8%)", "hsl(12 80% 30%)"], sun: "hsl(20 90% 55%)", sunAt: [70, 44, 14], far: "hsl(350 20% 5%)", land: "hsl(350 20% 7%)", motif: "fire" },
  moon: { sky: ["hsl(220 12% 7%)", "hsl(220 10% 18%)"], sun: "hsl(40 15% 82%)", sunAt: [310, 54, 24], far: "hsl(220 10% 6%)", land: "hsl(220 10% 9%)", motif: "castle" },
  shrine: { sky: ["hsl(230 12% 7%)", "hsl(350 20% 16%)"], sun: "hsl(40 15% 82%)", sunAt: [200, 60, 30], far: "hsl(230 10% 6%)", land: "hsl(230 10% 9%)", motif: "torii" },
  grave: { sky: ["hsl(20 40% 30%)", "hsl(30 50% 58%)"], sun: "hsl(35 80% 80%)", sunAt: [200, 190, 80], far: "hsl(20 15% 20%)", land: "hsl(20 10% 14%)", motif: "grave" },
};

export interface Figure {
  turtle?: boolean;
  seated?: boolean;
  body: string;
  accent: string;
  w: number;
  h: number;
  head: "kasa" | "band" | "horns" | "bald" | "tail" | "mask" | "beard" | "eboshi" | "hood" | "visor" | "shawl";
  prop: "katana" | "bo" | "kusari" | "nunchaku" | "knives" | "club" | "naginata" | "sickle" | "lantern" | "biwa" | "crossbow" | "none";
}

export const FIGURES: Record<ActorId, Figure> = {
  ren: { turtle: true, body: "hsl(0 0% 12%)", accent: "hsl(352 82% 40%)", w: 1, h: 1, head: "kasa", prop: "katana" },
  daigo: { turtle: true, body: "hsl(0 0% 16%)", accent: "hsl(0 0% 46%)", w: 1.15, h: 1.08, head: "band", prop: "bo" },
  shun: { turtle: true, body: "hsl(0 0% 14%)", accent: "hsl(22 90% 48%)", w: 0.95, h: 1.04, head: "band", prop: "kusari" },
  kai: { turtle: true, body: "hsl(0 0% 13%)", accent: "hsl(352 70% 48%)", w: 0.92, h: 0.92, head: "band", prop: "nunchaku" },
  lord: { body: "hsl(0 0% 18%)", accent: "hsl(30 70% 55%)", w: 1, h: 1.08, head: "eboshi", prop: "lantern" },
  ox: { body: "hsl(12 30% 16%)", accent: "hsl(22 70% 45%)", w: 1.55, h: 1.12, head: "horns", prop: "club" },
  bell: { body: "hsl(25 50% 26%)", accent: "hsl(350 40% 25%)", w: 1.1, h: 1.08, head: "bald", prop: "naginata" },
  tide: { body: "hsl(200 20% 16%)", accent: "hsl(352 70% 42%)", w: 0.9, h: 1.02, head: "tail", prop: "sickle" },
  mask: { body: "hsl(350 40% 16%)", accent: "hsl(30 10% 70%)", w: 0.9, h: 1.04, head: "mask", prop: "knives" },
  genryu: { body: "hsl(30 6% 20%)", accent: "hsl(30 8% 62%)", w: 0.88, h: 1.06, head: "beard", prop: "katana" },
  biwa: { seated: true, body: "hsl(350 30% 16%)", accent: "hsl(30 50% 40%)", w: 1.1, h: 0.72, head: "shawl", prop: "biwa" },
  villager: { body: "hsl(30 6% 24%)", accent: "hsl(30 10% 34%)", w: 0.95, h: 0.9, head: "hood", prop: "none" },
  soldier: { body: "hsl(0 0% 14%)", accent: "hsl(352 70% 36%)", w: 1.05, h: 1, head: "visor", prop: "crossbow" },
};
