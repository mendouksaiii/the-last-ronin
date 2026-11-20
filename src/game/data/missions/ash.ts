import { boss, collect, defend, destroy, kill, nationMissions, reach, scene, survive } from "./build";

const p = scene("ash");
const night = scene("castle");
const shrine = scene("shrine");

// Act V: the Ash Ward and the Sword Saint.
export const ASH = nationMissions("ash", [
  {
    title: "The Road of Cinders",
    cls: "Story",
    beat: "Ren comes home to the burnt heart of the city",
    intro: [
      p(["villager", "ren"], "The Gravekeeper's Shelter, in the Ash Ward.", "Hana: I buried three turtles under the camellias on the roof. I always wondered when the fourth would come for them."),
      p(["villager"], undefined, "Hana: Walk the Road of Cinders first. See what your teacher has made of the place."),
    ],
    steps: [
      reach("road", "Walk the Road of Cinders", "Ren: I learned to walk on this street."),
      kill("road", "melee", 4, "Defeat the Ash Guards on the road"),
      reach("camp", "Look upon the Garrison Yard", "Ren: They wear our old colours."),
    ],
    outro: [p(["ren"], "Lower Manhattan had not been rebuilt. It had only been swept, the way a dojo floor is swept.")],
  },
  {
    title: "Ghosts of the Garrison",
    cls: "Hunt",
    beat: "The old tower guard now serve Genryu",
    intro: [
      p(["soldier", "soldier"], "The tower guard who had opened the gates that night still drilled in the yard, in the same lines."),
      p(["ren"], undefined, "Ren: I know every one of your names. Tonight I will not use them."),
    ],
    steps: [
      kill("camp", "melee", 5, "Defeat the Ash Guards in the Garrison Yard"),
      kill("camp", "ranged", 3, "Defeat the Ember Crossbows"),
    ],
    outro: [p(["ren"], "The yard was empty. The drill had finally ended.")],
  },
  {
    title: "The Camellia Roof",
    cls: "Gather",
    beat: "Gather the brothers' keepsakes for burial",
    intro: [
      p(["villager", "ren"], undefined, "Hana: They had so little. A cup, a brush, a flute. I could not find them in the ash. Perhaps you know where to look."),
      p(["ren"], "The roof garden had grown back wild over the place where the camellias were cut."),
    ],
    steps: [collect("fields", "Keepsake", 3, 5, "Find your brothers' keepsakes in the Camellia Roof Garden", "Kai's voice: My flute is under the third planter. Do not laugh.")],
    outro: [p(["ren"], "Daigo's cup. Shun's brush. Kai's flute. Ren laid them on the three graves and did not laugh.")],
  },
  {
    title: "The Old Dojo",
    cls: "Aid",
    beat: "Defend the survivors sheltering in the dojo",
    intro: [
      p(["villager", "villager"], "The tower staff who had survived that night were hiding where the four brothers had learned to fight."),
      p(["ren"], undefined, "Ren: Nobody else dies in this house."),
    ],
    steps: [defend("ruin", "Survivors", 4, "Defend the survivors at the Old Dojo", "Ren: This floor, at least, I know.")],
    outro: [p(["villager"], "An old cook pressed a dumpling into Ren's hand.", "Cook: Daigo always took yours. I kept one back, in case.")],
  },
  {
    title: "The Blank Letter",
    cls: "Memory",
    beat: "Ren's own run to the shrine and back",
    playAs: "katana",
    intro: [
      p(["villager", "ren"], undefined, "Hana: You keep a letter in your shell that you never read aloud."),
      shrine(["ren"], "The Night of Red Camellias. Ren's own road.", "Ren: Open it at the shrine. Those were his words."),
    ],
    steps: [
      reach("throne", "Run to the Shrine", "Ren: Daigo at the gate. Shun at the post. Kai with the lord. A quiet night."),
      reach("fields", "Run back to the Tower Plaza", "Ren: Blank. Why is it blank? ...Smoke."),
      survive("fields", 3, "Fight through the burning plaza", "Ren: Daigo! Shun! Kai!"),
    ],
    outro: [
      night(["ren"], "He was too late for all of them."),
      p(["ren"], undefined, "Ren: Who writes a letter with nothing in it?"),
    ],
  },
  {
    title: "River of Embers",
    cls: "Sabotage",
    beat: "Destroy the forge that arms Genryu's men",
    intro: [
      p(["soldier"], "In the flooded subway under the ward, a forge on the River of Embers beat out blades day and night."),
      p(["ren"], undefined, "Ren: He taught me that a sword is the last answer. He is making a great many answers."),
    ],
    steps: [destroy("water", "Forge furnace", 4, 5, "Destroy the furnaces at the River of Embers", "Ren: Let it go cold.")],
    outro: [p(["ren"], "The forge went dark. For the first time in a year, the ruins were the only thing smoking.")],
  },
  {
    title: "My Brothers in Arms",
    cls: "Hunt",
    beat: "Face the students Ren once trained beside",
    intro: [
      p(["soldier", "ren"], "At the dojo gate stood Jubei, senior student, who had held the practice sword steady for four small turtles.", "Jubei: The Master said you would come. He said not to let you pass. He did not say it happily."),
      p(["ren"], undefined, "Ren: Then let us both disappoint him."),
    ],
    steps: [
      kill("ruin", "fast", 3, "Defeat Senior Student Jubei", { elite: "Senior Student Jubei" }),
      kill("ruin", "fast", 4, "Defeat the Fallen Students", { say: "Ren: Your stance is still too wide." }),
    ],
    outro: [p(["ren"], "Ren bowed to each of them, as the dojo required.")],
  },
  {
    title: "The Hundred-Man Stair",
    cls: "Stronghold",
    beat: "Fight up the tower stair",
    intro: [
      p(["soldier", "soldier", "soldier"], "A hundred men on a hundred steps: the last garrison of the Lantern Tower."),
      p(["ren"], undefined, "Daigo's voice: A hundred? I held more. Go on. I will count for you."),
    ],
    steps: [
      reach("outer", "Reach the foot of the Hundred-Man Stair"),
      survive("outer", 5, "Fight up the Hundred-Man Stair", "Ren: One step at a time."),
    ],
    outro: [p(["ren"], "At the top of the stair stood the doors of the banquet hall, still scorched.")],
  },
  {
    title: "The Banquet Hall",
    cls: "Stronghold",
    beat: "Genryu's last students guard the hall",
    intro: [
      p(["soldier"], "Genryu's First Blade knelt in the ruined hall, on the spot where the moon-viewing cushions had been."),
      p(["ren"], undefined, "Ren: You sit where my lord died. Stand up."),
    ],
    steps: [
      kill("inner", "fast", 5, "Defeat the students in the Banquet Hall"),
      kill("inner", "brute", 3, "Defeat Genryu's First Blade", { elite: "Genryu's First Blade" }),
    ],
    outro: [p(["genryu"], "At the far end of the hall, an old man set down his tea.", "Genryu: Let him through.")],
  },
  {
    title: "Daybreak",
    cls: "General",
    beat: "Master against student, and the truth of the letter",
    intro: [
      p(["genryu"], "Master Genryu sat where the Lantern Lord had sat, high above the drowned city.", "Genryu: A lantern cannot light five districts forever. I only chose which ones would burn."),
      p(["genryu", "ren"], undefined, "Genryu: The blank letter was his own, Ren. He knew the knives were coming. It carried no command, so that you would be free."),
    ],
    steps: [
      reach("inner", "Cross the Banquet Hall"),
      boss("throne", "Defeat the Sword Saint", "Genryu: Show me what I taught you. All of it."),
    ],
    outro: [],
  },
]);
