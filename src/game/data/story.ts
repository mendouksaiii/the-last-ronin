import type { ComicPage, NationId, Panel } from "../types";
import { ART, GENERAL_ART } from "./art";
import { NATIONS } from "./nations";
import { WEAPONS } from "./weapons";

// The prologue, the opening page of each act, the generals' death poems and the epilogue.

export const PROLOGUE: ComicPage[] = [
  [
    {
      scene: "moon",
      actors: ["lord"],
      caption: "After the waters rose, what was left of New York was held together by one man: Lord Hoshikawa Tadanobu, the Lantern Lord, from the top of his tower.",
    },
    {
      scene: "moon",
      actors: ["ox", "bell", "tide", "mask", "genryu"],
      caption: "Five generals served him. They were called the Five Fingers of his hand.",
    },
  ],
  [
    {
      scene: "moon",
      actors: ["daigo", "shun", "kai", "ren"],
      caption: "His guards were four turtle brothers found in the flooded tunnels below the city, and raised to the blade by the sword master Genryu.",
    },
    {
      scene: "moon",
      actors: ["lord", "ren"],
      caption: "On the night of the moon-viewing banquet, the lord gave Ren a sealed letter.",
      speech: "Lord Tadanobu: Take it to the shrine, Ren. Open it there.",
    },
  ],
  [
    {
      scene: "shrine",
      actors: ["ren"],
      caption: "At the shrine, Ren broke the seal.",
      speech: "Ren: ...The page is blank.",
    },
    {
      scene: "castle",
      image: ART.prologue,
      caption: "He ran back to find the Lantern Tower burning and the camellias on its roof cut down whole.",
    },
  ],
  [
    {
      scene: "castle",
      actors: ["ren"],
      caption: "His lord was dead. So were Daigo, Shun and Kai, each at a different post.",
    },
    {
      scene: "castle",
      actors: ["ox", "bell", "tide", "mask", "genryu"],
      caption: "The lord's sword, Daybreak, was broken into five shards. Each general took one as a trophy.",
    },
    {
      scene: "grave",
      actors: ["biwa"],
      speech: "The Biwa Woman: A hand closed into a fist that night, and the fist held nothing but ash.",
    },
    {
      scene: "reeds",
      actors: ["ren"],
      caption: "By morning the city was five districts at war, and Ren was the last ronin: a samurai with no lord.",
    },
  ],
];

const ACT_LINES: Record<NationId, [string, string]> = {
  reeds: [
    "Queens, under water: fog, flooded lots and empty ration depots. Here rules Kuroda Gonzaemon, the Ox, who once carried the lord's shield.",
    "Ren: Daigo's bo staff hangs over his table. I will take it down.",
  ],
  snow: [
    "Upper Manhattan: a frozen cathedral above the sleet. Abbot Joshin, the Bell, swears heaven itself ordered the lord's death.",
    "Ren: His monks burned the post Shun was holding. I can still smell the smoke.",
  ],
  tides: [
    "Red Hook: rusting piers, container stacks and black sails. Lady Namie, the Tide, killed her lord to unchain her fleets.",
    "Ren: She closed the water gate on Kai. He was the youngest of us.",
  ],
  lanterns: [
    "The Lower East Side: endless night under neon. Yashiro Sosuke, the Mask, forged the orders that split four brothers apart.",
    "Ren: In this city nobody is who they seem. Good. Neither am I.",
  ],
  ash: [
    "Lower Manhattan: the old seat of power, burnt to the girders beneath the Lantern Tower. Its ruler is Master Genryu, the Sword Saint, who raised the four brothers.",
    "Ren: Home. Four shards of Daybreak on my back, and one left to take from the man who taught me to hold a sword.",
  ],
};

export function actIntro(id: NationId): ComicPage[] {
  const n = NATIONS[id];
  const [caption, speech] = ACT_LINES[id];
  return [
    [
      { scene: id, actors: [n.general.actor], caption: `${n.act}: ${n.name}. ${caption}` },
      { scene: id, actors: ["ren"], speech },
    ],
  ];
}

/** The page shown when a general falls: the death poem, then what Ren takes back. */
export function generalDefeat(id: NationId): ComicPage[] {
  const n = NATIONS[id];
  const g = n.general;
  const poem: Panel = {
    scene: id,
    actors: [g.actor],
    image: GENERAL_ART[id] || undefined,
    caption: `${g.title}'s death poem`,
    speech: `${g.title}: ${g.poem.join(" / ")}`,
  };
  const reward: Panel = n.reward
    ? {
        scene: id,
        actors: ["ren"],
        caption: `A shard of Daybreak returns to Ren, and with it ${WEAPONS[n.reward].owner}'s ${WEAPONS[n.reward].name.toLowerCase()}.`,
        speech: `${WEAPONS[n.reward].owner}'s voice: Took you long enough, little brother.`,
      }
    : {
        scene: id,
        actors: ["ren"],
        caption: "A shard of Daybreak returns to Ren.",
      };
  return [[poem, reward]];
}

export const EPILOGUE: ComicPage[] = [
  [
    {
      scene: "grave",
      actors: ["ren"],
      caption: "Ren reforged Daybreak and laid it on his lord's grave, with the bo, the chain and the nunchaku beside it.",
    },
    {
      scene: "grave",
      actors: ["daigo", "shun", "kai"],
      caption: "For a moment the voices he had carried were quiet.",
    },
  ],
  [
    {
      scene: "grave",
      actors: ["ren"],
      caption: "He unfolded the blank letter one last time, and walked out into the rain, masterless and finally free.",
    },
    {
      scene: "grave",
      actors: ["biwa"],
      speech: "The Biwa Woman: Some say he wrote a single word upon that page. Some say he left it white as snow. The camellias on the roof, at least, bloom again.",
    },
  ],
];
