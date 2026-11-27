import type { NationId, WeaponId } from "../types";

export const REN_IDLE_LINES: readonly string[] = [
  "I have to go. Every second I stand here, another district bleeds.",
  "Standing still won't forge Daybreak back together. Move.",
  "Come on, Ren... Daigo, Shun, Kai—they're not waiting for me.",
  "The rain isn't stopping. Neither can I.",
  "My boots are rotting into the concrete. Let's move.",
  "What am I waiting for? Nobody else is coming to finish this.",
];

export const REN_SPOT_ENEMY_LINES: readonly string[] = [
  "I'll kill you all!",
  "Come on! Every last one of you dies tonight!",
  "More dogs of the Five Fingers! Step up and bleed!",
  "You picked the wrong alley to guard!",
  "None of you walk out of this alive!",
  "Show me your steel! Let's see how fast you fall!",
];

export const REN_KILL_LINES: readonly string[] = [
  "One less traitor breathing.",
  "That one's for my brothers.",
  "Too slow. All of you are too slow.",
  "Fall, and stay down.",
  "Steel remembers every debt.",
];

export const REN_STEALTH_KILL_LINES: readonly string[] = [
  "Quiet. Just how Genryu taught me.",
  "Didn't even hear the blade.",
  "One shadow down. Keep moving.",
];

export const REN_BATTLE_WON_LINES: readonly string[] = [
  "Quiet again. Good.",
  "Anyone else want to die tonight?",
  "That's the last of them here. Keep moving.",
];

export const REN_LOW_HP_LINES: readonly string[] = [
  "Dammit... not like this. Not before all five fall!",
  "Just blood. I've survived worse in the flooded tunnels.",
  "Hold together, Ren! You're the only brother left!",
];

export const REN_HEAL_LINES: readonly string[] = [
  "Steady... breathe through the burn.",
  "Good. Back in the fight.",
];

export const REN_WEAPON_LINES: Record<WeaponId, readonly string[]> = {
  katana: [
    "Four shards. One blade.",
    "Cold steel in my hand. Let them come.",
  ],
  bo: [
    "I've got your back, Daigo.",
    "Heavy oak, heavy debt. Let's break some armor.",
  ],
  kusari: [
    "Quiet and tight, Shun.",
    "Nobody outruns your chain, brother.",
  ],
  nunchaku: [
    "Still fast as hell, Kai.",
    "Keep up with me, little brother.",
  ],
};

export const REN_EXPLORE_LINES: Record<NationId, readonly string[]> = {
  reeds: [
    "Flooded concrete and rust. Daigo would've hated this mud.",
    "Half of Queens is underwater, and the Ox still hoards the dry rations.",
  ],
  snow: [
    "Sleet cuts right through the shell. Don't slow down.",
    "Abbot Joshin hides behind bronze bells and dead monks.",
  ],
  tides: [
    "Salt and diesel. Kai knew every pier down in Red Hook.",
    "Black sails in the fog. Lady Namie won't outrun steel on dry land.",
  ],
  lanterns: [
    "Too many eyes behind neon glass. Stay sharp.",
    "Yashiro thinks shadows belong to him. Let's remind him who trained us.",
  ],
  ash: [
    "Ash in my throat... everything we protected burned right here.",
    "The Lantern Tower's right ahead. Master Genryu is waiting.",
  ],
};

export const REN_BOSS_LINES: Record<NationId, string> = {
  reeds: "Give me back Daigo's staff, Kuroda, or I tear it from your dead hands!",
  snow: "Heaven didn't order my brothers' deaths, Abbot. You did!",
  tides: "You drowned Kai at the water gate, Namie! Now choke on your own harbor!",
  lanterns: "No more masks, Yashiro! Face me with your real steel!",
  ash: "You raised me to guard this city, Genryu! Why did you burn it?!",
};

export const NPC_VILLAGER_GENERAL: Record<"Watchman" | "Townswoman" | "Lookout", readonly string[]> = {
  Watchman: [
    "Keep your hood low, ronin. Patrols sweep the overpass every hour.",
    "Thank the heavens someone's finally hitting back against the Five Fingers.",
    "Careful past the barricades. Those bastards shoot before they ask.",
    "When you walk down the block, even their sentries look over their shoulders.",
  ],
  Townswoman: [
    "We barely have dry rice left, let alone lamp oil for the week.",
    "People whisper that the Lantern Lord's ghost still walks the rooftops.",
    "You're really one of the four from the tower? We thought none of you survived.",
    "Don't mind the rain. At least it washes the blood off the asphalt.",
  ],
  Lookout: [
    "Two torches down the avenue just went dark. Stay sharp out there.",
    "Heard boots splashing near the culvert ten minutes ago, then dead silence.",
    "Your brothers held this neighborhood together once. Folks still remember.",
    "Don't die out in the dark, turtle. Nobody else is coming to pull us out.",
  ],
};

export const NPC_VILLAGER_DISTRICT: Record<NationId, readonly string[]> = {
  reeds: [
    "The Ox took half our ration barges last week. Nobody dares look him in the eye.",
    "Floodwater's up to the second-floor sills again. Only thugs have dry boots.",
  ],
  snow: [
    "Those monks ring that damned bronze bell till our windows shake in the frame.",
    "Up on the cathedral steps they preach mercy while freezing half the ward.",
  ],
  tides: [
    "Lady Namie's black sails shut the whole harbor before dawn.",
    "Press-gangs tore two dockhands out of their beds just for missing curfew.",
  ],
  lanterns: [
    "Yashiro's spies wear anybody's face down here. Trust no one behind the neon.",
    "Every teahouse lantern hides an informer counting who walks past.",
  ],
  ash: [
    "Nothing grows near the burnt tower anymore. Only cinders and old ghosts.",
    "Sometimes you can still smell smoke from the night the camellias burned.",
  ],
};

export const NPC_LIBERATED_LINES: Record<NationId, readonly string[]> = {
  reeds: [
    "First time in a year the ration boats landed without the Ox's taxmen!",
    "Folks in Queens are sleeping with their lamps lit tonight because of you.",
  ],
  snow: [
    "The cathedral bell finally shut up. Even the sleet feels quieter.",
    "People are coming down off the rooftops now the Abbot's gone.",
  ],
  tides: [
    "The harbor chain dropped into the bay! Fishing boats are heading out at dawn.",
    "Lady Namie's black sails burned all the way past the breakwater.",
  ],
  lanterns: [
    "Half the informers threw their masks in the gutter and bolted before sunrise.",
    "Neon feels a lot less crowded without Yashiro watching every doorway.",
  ],
  ash: [
    "Smoke's finally clearing off the tower girders. Maybe something can grow again.",
    "We buried flowers by the old steps today. The city breathes again, ronin.",
  ],
};

export const BIWA_AMBIENT_LINES: readonly string[] = [
  "A broken blade remembers the hand that swung it.",
  "The strings ache tonight, ronin. Rain always brings old names back.",
  "Three shadows walk beside you. Do you still hear their voices?",
];

export const FIXER_AMBIENT_LINES: Record<NationId, string> = {
  reeds: "Kuroda's thugs are bold tonight. Keep your steel loose, ronin.",
  snow: "Don't freeze out on the steps, turtle. Come talk when you're ready.",
  tides: "Tide's coming in fast over the piers. Stay dry where you can.",
  lanterns: "Watch the alleys behind you. Nobody walks Neon Gate unseen.",
  ash: "Every breath out there tastes like cinder. Come close when you need work.",
};

export type GhostSpeaker = "Daigo's voice" | "Shun's voice" | "Kai's voice";

export interface GhostExchange {
  speaker: GhostSpeaker;
  text: string;
  reply?: string;
}

export const GHOST_STEALTH_LINES: readonly GhostExchange[] = [
  {
    speaker: "Shun's voice",
    text: "Watch the rooftops, Ren. Two eyes miss what the ear catches.",
    reply: "I hear them, Shun. Stay quiet.",
  },
  {
    speaker: "Shun's voice",
    text: "Step inside their blind spot. One breath, one cut.",
  },
  {
    speaker: "Kai's voice",
    text: "Sneaking around again? Just kick the door off its hinges.",
    reply: "Not everything dies noisy, Kai.",
  },
];

export const GHOST_PARRY_LINES: readonly GhostExchange[] = [
  {
    speaker: "Kai's voice",
    text: "Hah! Left him spinning! Do it again!",
    reply: "Shut up and watch my flank, Kai.",
  },
  {
    speaker: "Daigo's voice",
    text: "Clean deflection. Now break his stance.",
  },
  {
    speaker: "Shun's voice",
    text: "Steel rang true, brother. Finish him.",
  },
];

export const GHOST_LOW_HP_LINES: readonly GhostExchange[] = [
  {
    speaker: "Daigo's voice",
    text: "Easy, Ren. Hold the line—don't swing from anger.",
    reply: "Anger is all that's keeping me upright, Daigo.",
  },
  {
    speaker: "Daigo's voice",
    text: "Get up, Ren. Don't die in the gutter.",
    reply: "I'm still standing. Watch me.",
  },
  {
    speaker: "Kai's voice",
    text: "Hey—breathe! You don't get to join us yet!",
  },
];

export const GHOST_WEAPON_LINES: Partial<Record<WeaponId, readonly GhostExchange[]>> = {
  bo: [
    {
      speaker: "Daigo's voice",
      text: "The oak still fits your hands, little brother.",
      reply: "I won't let you down, Daigo.",
    },
  ],
  kusari: [
    {
      speaker: "Shun's voice",
      text: "Wrap the chain tight. Never let go.",
      reply: "They're not escaping your shadow, Shun.",
    },
  ],
  nunchaku: [
    {
      speaker: "Kai's voice",
      text: "Spin 'em fast and crack some skulls for me!",
      reply: "Always, little brother.",
    },
  ],
};

export const GHOST_WANDER_LINES: readonly GhostExchange[] = [
  {
    speaker: "Shun's voice",
    text: "You kept moving when we couldn't. Keep going.",
    reply: "I won't stop until all five are in the ground.",
  },
  {
    speaker: "Daigo's voice",
    text: "Remember the oath beneath the Lantern Tower.",
    reply: "Every single night, brother.",
  },
  {
    speaker: "Kai's voice",
    text: "Tell me you didn't forget how to laugh in all this rain.",
    reply: "When Genryu falls, maybe I'll try.",
  },
];

export const BOSS_INTRO_LINES: Record<NationId, { speaker: string; text: string }> = {
  reeds: { speaker: "The Ox", text: "Step onto the planks, little shell. Let's hear your bones crack like oak!" },
  snow: { speaker: "The Bell", text: "Come forward, apostate. The cathedral bell tolls only for judgment!" },
  tides: { speaker: "The Tide", text: "Still chasing ghosts across my harbor? Let the water claim the last of you!" },
  lanterns: { speaker: "The Mask", text: "Ah, the final brother steps onstage. Tell me—which blade is real?" },
  ash: { speaker: "Genryu", text: "Draw your steel, Ren. Let's see what remains of my finest student." },
};

export const BOSS_PHASE2_LINES: Record<NationId, { speaker: string; text: string; reply: string }> = {
  reeds: {
    speaker: "The Ox",
    text: "Enough dancing, turtle! Come take the full weight of iron!",
    reply: "Swing harder, Kuroda—you're slowing down!",
  },
  snow: {
    speaker: "The Bell",
    text: "You dare bleed on sacred stone? Heaven, strike him down!",
    reply: "Your heaven is empty, Abbot!",
  },
  tides: {
    speaker: "The Tide",
    text: "You fight just like your youngest brother—and you'll drown the same way!",
    reply: "Say Kai's name again and I take your head!",
  },
  lanterns: {
    speaker: "The Mask",
    text: "A hundred eyes in the dark, and none of them pity you!",
    reply: "Then watch me cut through every last one!",
  },
  ash: {
    speaker: "Genryu",
    text: "Good! At last—show me the blade that survived the fire!",
    reply: "Everything you taught me ends in your blood, Master!",
  },
};

export const BOSS_MASK_DECOY_LINE = "Which shadow is real, ronin? Look behind you!";

export const BOSS_HIT_TAUNTS: Record<NationId, { speaker: string; lines: readonly string[] }> = {
  reeds: {
    speaker: "The Ox",
    lines: [
      "Ha! Your shell cracks like cheap pine!",
      "Stand your ground and take the iron, worm!",
      "Daigo broke under that club—and so will you!",
    ],
  },
  snow: {
    speaker: "The Bell",
    lines: [
      "Kneel before judgment, heretic!",
      "Repent in ash and frost!",
      "Sinners do not stand in heaven's light!",
    ],
  },
  tides: {
    speaker: "The Tide",
    lines: [
      "Slow! The harbor swallows softer blades than yours!",
      "Caught in the undertow, little turtle!",
      "My chains bite deeper than the winter sea!",
    ],
  },
  lanterns: {
    speaker: "The Mask",
    lines: [
      "Too predictable, little brother!",
      "Look left, look right—you're fighting ghosts!",
      "What a clumsy performance! Give me a real duel!",
    ],
  },
  ash: {
    speaker: "Genryu",
    lines: [
      "You hesitate, Ren! Rage blinds your footwork!",
      "I taught you better guard than that!",
      "Sloppy! Emotion will put you in the dirt!",
    ],
  },
};

export const BOSS_EVADE_LINES: Record<NationId, { speaker: string; text: string }> = {
  reeds: { speaker: "The Ox", text: "Missed! Keep dancing, turtle!" },
  snow: { speaker: "The Bell", text: "Heaven turns aside your wrath!" },
  tides: { speaker: "The Tide", text: "Like swinging at sea foam!" },
  lanterns: { speaker: "The Mask", text: "Did you think I was standing there?" },
  ash: { speaker: "Genryu", text: "Too telegraphed, boy!" },
};

export const BOSS_DEFLECT_LINE = {
  speaker: "Genryu",
  text: "Still water turns the blade—now taste your own opening!",
} as const;

export const BOSS_STAGGER_LINES: Record<NationId, { speaker: string; text: string }> = {
  reeds: { speaker: "The Ox", text: "Ugh—heavy little bastard...!" },
  snow: { speaker: "The Bell", text: "Impossible... the faith holds!" },
  tides: { speaker: "The Tide", text: "Tch—don't get cocky, boy!" },
  lanterns: { speaker: "The Mask", text: "Heh... sharp eyes after all!" },
  ash: { speaker: "Genryu", text: "Good! Now strike like you mean it!" },
};

export const BOSS_SKILL_CALLOUTS: Record<NationId, { speaker: string; map: Record<string, string> }> = {
  reeds: {
    speaker: "The Ox",
    map: {
      "Earthshaker Leap": "Crush you flat!",
      "Tectonic Crash": "Crush you flat!",
      "Seismic Breaker": "Feel the sky fall!",
      "Iron Club": "Feel the sky fall!",
    },
  },
  snow: {
    speaker: "The Bell",
    map: {
      "The Bell Tolls": "Hear the great bell ring!",
      "Cathedral Resonance": "Hear the great bell ring!",
      "Heaven's Descent": "Shatter beneath heaven's weight!",
      "Naginata Cyclone": "Shatter beneath heaven's weight!",
    },
  },
  tides: {
    speaker: "The Tide",
    map: {
      "Phantom Undertow": "Nowhere to run on my deck!",
      "Harpoon Snare": "Nowhere to run on my deck!",
      "Riptide Surge": "Nowhere to run on my deck!",
      "Maelstrom Spin": "Drown in iron!",
      "Drowning Flurry": "Drown in iron!",
    },
  },
  lanterns: {
    speaker: "The Mask",
    map: {
      "Stage Vanish": "Behind you, ronin!",
      "Backstage Execution": "Behind you, ronin!",
    },
  },
  ash: {
    speaker: "Genryu",
    map: {
      "Phantom Flash": "Blink and die, Ren!",
      "Iai Dash Cut": "Blink and die, Ren!",
      "Helm Splitter": "Witness the Sword Saint's steel!",
      "Thousand Cuts": "Witness the Sword Saint's steel!",
      "Twin Vacuum Waves": "Witness the Sword Saint's steel!",
    },
  },
};

export const REN_PARRY_BOSS_LINES: readonly string[] = [
  "Your guard's wide open!",
  "Not so untouchable now!",
  "That steel's mine!",
];

export const ENEMY_SEARCH_LINES: readonly string[] = [
  "Wait... did something move over there?",
  "Hey! Who's creeping in the alley?!",
  "Thought I heard steel...",
];

export const ENEMY_GIVEUP_LINES: readonly string[] = [
  "Must've been a rat. Back to post.",
  "Nothing. Damn rain's playing tricks on me.",
];

export const ENEMY_PANIC_LINES: readonly string[] = [
  "Watch his blade—he's carving right through us!",
  "Surround the turtle! Don't let him breathe!",
  "Back off—he fights like a demon!",
];

export const ENEMY_BRUTE_LINES: readonly string[] = [
  "Hold still so I can crush that shell!",
  "Break him in half!",
];

export function pickOther(pool: readonly string[], last?: string): string {
  if (pool.length <= 1) return pool[0] ?? "";
  const candidates = last ? pool.filter((l) => l !== last) : pool;
  return candidates[Math.floor(Math.random() * candidates.length)] ?? pool[0];
}

export function pickItem<T>(pool: readonly T[]): T {
  return pool[Math.floor(Math.random() * pool.length)];
}

