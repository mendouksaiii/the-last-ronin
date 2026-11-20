import { boss, collect, defend, destroy, kill, nationMissions, reach, scene } from "./build";

const p = scene("lanterns");
const moon = scene("moon");

// Act IV: the Neon Quarter and the Mask.
export const LANTERNS = nationMissions("lanterns", [
  {
    title: "The Neon Gate",
    cls: "Story",
    beat: "Ren enters the quarter of endless night",
    intro: [
      p(["villager", "ren"], "Sign-Makers' Alley, in the Neon Quarter.", "Okiku: Down here the sun is a rumour. The Mask prefers us lit by neon. It hides the eyes."),
      p(["villager"], undefined, "Okiku: Walk through the Neon Gate and down Theatre Street. Count how many people are watching you."),
    ],
    steps: [
      reach("road", "Pass through the Neon Gate", "Ren: A thousand signs, and not one face I can read."),
      reach("fields", "Walk down Theatre Street", "Ren: Eleven. No. Twelve."),
      kill("fields", "fast", 3, "Defeat the Shadow Actors who followed you"),
    ],
    outro: [p(["ren"], "The three who fell wore the faces of a baker, a priest and a child's nurse. None of the faces were theirs.")],
  },
  {
    title: "A Face in the Crowd",
    cls: "Hunt",
    beat: "Unmask the assassins following him",
    intro: [
      p(["villager", "ren"], undefined, "Okiku: He knows you are here. He will send the Smiling Follower. You will not see him until he wants you to."),
      p(["mask"], "Somewhere above the street, a man with no face of his own chose one for the evening."),
    ],
    steps: [
      kill("road", "fast", 5, "Unmask the Shadow Actors at the Neon Gate"),
      kill("fields", "fast", 3, "Defeat the Smiling Follower", { elite: "The Smiling Follower", say: "Ren: There you are." }),
    ],
    outro: [p(["ren"], "Under the Follower's smile was another smile, painted on. Under that, Ren did not look.")],
  },
  {
    title: "The Informer's Teahouse",
    cls: "Gather",
    beat: "Piece together the torn forged orders",
    intro: [
      p(["villager", "ren"], undefined, "Okiku: The Mask's informers meet at a teahouse and burn what they are told to burn. One of them was lazy, and only tore it."),
      p(["ren"], "Six scraps of paper, with a seal Ren knew as well as his own name."),
    ],
    steps: [collect("ruin", "Torn order", 6, 4, "Collect the torn orders at the Informer's Teahouse", "Ren: Three orders. Three posts. Whose hand is this?")],
    outro: [p(["ren"], "Pieced together, the scraps read: hold the gate alone. Watch the north road alone. Take the lord by river, alone.")],
  },
  {
    title: "The Night Market",
    cls: "Aid",
    beat: "Protect the crowd from an ambush",
    intro: [
      p(["villager", "villager"], "On market night the whole quarter filled Festival Square. The Mask meant to remind them who held the strings."),
      p(["ren"], undefined, "Ren: Keep the lights on. Whatever you hear behind you."),
    ],
    steps: [defend("water", "Market crowd", 4, "Protect the crowd in Festival Square", "Ren: Not tonight.")],
    outro: [p(["villager"], "Paper lanterns went up over the rooftops. For one night the quarter was lit from above.")],
  },
  {
    title: "Four Cups of Tea",
    cls: "Memory",
    beat: "The brothers' last evening together, and the orders that split them",
    playAs: "katana",
    intro: [
      p(["ren"], "Holding the forged orders, Ren remembered the evening they arrived."),
      moon(["daigo", "shun", "kai", "ren"], "The last evening. Four cups of tea on a rooftop.", "Kai: To the four of us. May we be bored forever."),
    ],
    steps: [
      reach("camp", "Join your brothers at the Tea House", "Kai's voice: You are late, Ren. Daigo has eaten your dumplings."),
      reach("road", "Walk Daigo to the Tower Gate", "Daigo's voice: An order is an order. Do not wait up."),
      reach("water", "Walk Shun to the Watch Post", "Shun's voice: Count the steps for me."),
      reach("ruin", "Walk Kai to the Water Gate", "Kai's voice: Tomorrow I will beat you sparring. Tomorrow."),
    ],
    outro: [
      moon(["ren"], "Three brothers, three posts, three forged orders. And for Ren, a letter with nothing on it."),
      p(["ren"], undefined, "Ren: He split us apart so that none of us could save another."),
    ],
  },
  {
    title: "The Puppet Theatre",
    cls: "Sabotage",
    beat: "Destroy the heart of the spy network",
    intro: [
      p(["villager", "ren"], undefined, "Okiku: Every informer in the quarter reports to the Puppet Theatre. Smash the relays and the strings go slack."),
      p(["soldier"], "The puppets were the size of men. Some of them were men."),
    ],
    steps: [destroy("camp", "Signal relay", 4, 4, "Destroy the signal relays in the Puppet Theatre", "Ren: Let us see who falls down.")],
    outro: [p(["ren"], "All over the quarter, people who had been watching Ren found somewhere else to look.")],
  },
  {
    title: "Seven Decoys",
    cls: "Hunt",
    beat: "Seven men wear the Mask's face",
    intro: [
      p(["mask", "mask", "mask"], "Seven men walked down Theatre Street that night, each in the Mask's coat, each with the Mask's walk."),
      p(["ren"], undefined, "Ren: Seven masks. One of you had better be him."),
    ],
    steps: [kill("fields", "melee", 7, "Defeat the seven decoys on Theatre Street")],
    outro: [p(["ren"], "None of them was him. But the seventh, dying, looked towards the great theatre.")],
  },
  {
    title: "Backstage Knives",
    cls: "Stronghold",
    beat: "The stage master and his troupe",
    intro: [
      p(["soldier"], "Behind the great stage, the Stage Master kept the knives sharp and the actors sharper."),
      p(["ren"], undefined, "Ren: I am not here for the performance."),
    ],
    steps: [
      reach("outer", "Slip Backstage"),
      kill("outer", "ranged", 4, "Defeat the Stage Master", { elite: "The Stage Master", say: "Ren: Cue the turtle." }),
    ],
    outro: [p(["ren"], "The troupe scattered. A single corridor of mirrors led towards the stage.")],
  },
  {
    title: "The Hall of Mirrors",
    cls: "Stronghold",
    beat: "Find the way to the real stage",
    intro: [
      p(["mask"], "In every mirror stood the Mask. In every mirror he bowed."),
      p(["ren"], undefined, "Daigo's voice: When you cannot find the door, little brother, make one."),
    ],
    steps: [
      destroy("inner", "Mirror", 5, 3, "Break the mirrors to find the true path"),
      kill("inner", "fast", 5, "Defeat the Shadow Actors behind the glass"),
    ],
    outro: [p(["ren"], "The last mirror broke, and behind it there was a curtain, already rising.")],
  },
  {
    title: "The Final Performance",
    cls: "General",
    beat: "Learn that the Mask never wrote the blank letter",
    intro: [
      p(["mask"], undefined, "The Mask: Every face that was ever loved, I have worn. Yours, even. It did not suit me."),
      p(["ren", "mask"], undefined, "Ren: You wrote three orders. Tonight you answer for them."),
    ],
    steps: [
      reach("inner", "Walk out onto the stage"),
      boss("throne", "Defeat the Mask", "The Mask: Welcome to the last act. I play every part."),
    ],
    outro: [p(["mask", "ren"], undefined, "The Mask: Three orders I forged, little shell. Not four. I never wrote your blank letter.")],
  },
]);
