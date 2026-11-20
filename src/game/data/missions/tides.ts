import { boss, collect, defend, destroy, kill, nationMissions, reach, scene, survive } from "./build";

const p = scene("tides");
const night = scene("castle");

// Act III: the Red Hook Docks and the Tide.
export const TIDES = nationMissions("tides", [
  {
    title: "Low Tide Landing",
    cls: "Story",
    beat: "Ren comes ashore at the pirate docks",
    intro: [
      p(["villager", "ren"], "Net-Menders' Row, on the Red Hook Docks.", "Net-Mender Ume: Nobody sails in or out without the Tide's leave. You walked in across the shallows. She will like that."),
      p(["villager"], undefined, "Net-Mender Ume: Go and see the Fish Market. See what her freedom costs the rest of us."),
    ],
    steps: [
      reach("fields", "Cross the Shallows", "Ren: Kai would have swum it."),
      kill("fields", "melee", 3, "Defeat the pirates on the shallows"),
      reach("road", "Follow the gulls to the Fish Market", "Ren: Empty stalls. Full ships."),
    ],
    outro: [p(["ren"], "Every catch in Brooklyn went to the black ships first. The docks ate what was left.")],
  },
  {
    title: "The Fish Market Brawl",
    cls: "Hunt",
    beat: "Drive the press-gangs from the market",
    intro: [
      p(["soldier", "villager"], "The press-gangs came to the market each morning, and took whoever looked strong enough to haul cargo."),
      p(["ren"], undefined, "Ren: I look strong enough. Take me."),
    ],
    steps: [
      kill("road", "melee", 5, "Drive the pirates from the Fish Market"),
      kill("road", "brute", 2, "Defeat the Press-Gangers", { say: "Ren: Haul it yourselves." }),
    ],
    outro: [p(["villager"], "That morning nobody was taken.", "Net-Mender Ume: First time in a year my son has come home for supper.")],
  },
  {
    title: "Smugglers' Cove",
    cls: "Gather",
    beat: "Recover the dockworkers' stolen cargo",
    intro: [
      p(["villager", "ren"], undefined, "Net-Mender Ume: Our nets, our fuel, our winter stores. All of it sits in crates in Smugglers' Cove."),
      p(["soldier"], "Six crates, and the men who had been paid to forget whose they were."),
    ],
    steps: [collect("ruin", "Cargo crate", 6, 4, "Recover the stolen cargo in Smugglers' Cove", "Kai's voice: Six crates and one shell to carry them. Pace yourself, old man.")],
    outro: [p(["ren"], "The crates went home by night, on the backs of those who owned them.")],
  },
  {
    title: "The Divers' Revolt",
    cls: "Aid",
    beat: "Defend the salvage divers who rise up",
    intro: [
      p(["villager", "villager"], "The salvage divers threw their tanks into the harbour and refused to dive for the Tide."),
      p(["ren"], "The black ships sent boats. Ren waded out to meet them.", "Ren: Stay behind me. All of you."),
    ],
    steps: [defend("fields", "Salvage divers", 4, "Defend the salvage divers on the Shallows", "Ren: Let them come in on the tide.")],
    outro: [p(["villager"], "The divers kept their salvage, and found they had made an army by accident.")],
  },
  {
    title: "The Water Gate",
    cls: "Memory",
    beat: "Kai's last stand on the river",
    playAs: "nunchaku",
    intro: [
      p(["ren"], "In the shallows, Ren found a nunchaku stick, green with weed, and the night came back."),
      night(["kai", "lord"], "The Night of Red Camellias. The river road under the Lantern Tower.", "Kai: Lean on me, my lord. The river is quicker than the road."),
    ],
    steps: [
      reach("ruin", "Carry the lord to the Water Gate", "Kai: Almost there. Daigo will scold us both for being late."),
      survive("ruin", 4, "Hold the Water Gate", "Kai: The gate is closed. Then we dance here."),
    ],
    outro: [
      night(["kai", "tide"], "The Tide's boats had closed the water gate from the outside.", "Kai: Tell Ren I was not afraid. It will not be true, but tell him."),
      p(["ren"], undefined, "Ren: He was the youngest of us. He should have been last."),
    ],
  },
  {
    title: "The Chain Across the Harbour",
    cls: "Sabotage",
    beat: "Break the chain that traps the fishing boats",
    intro: [
      p(["villager", "ren"], undefined, "Net-Mender Ume: She who hated chains has strung one across our harbour. Three winches hold it up."),
      p(["ren"], undefined, "Ren: Then three winches will let it down."),
    ],
    steps: [destroy("water", "Chain winch", 3, 4, "Destroy the winches of the Harbour Chain", "Ren: She should know better than anyone.")],
    outro: [p(["ren"], "The chain sank. By dawn there were forty fishing boats on open water.")],
  },
  {
    title: "Fire Ships",
    cls: "Sabotage",
    beat: "Burn the pirate fleet at anchor",
    intro: [
      p(["soldier", "soldier"], "The Tide's fleet lay at anchor, hull to hull, fuelled and dry."),
      p(["ren"], undefined, "Kai's voice: Oh, do it. Please do it. I always wanted to see that."),
    ],
    steps: [destroy("camp", "Pirate hull", 5, 5, "Set fire to the hulls at the Pirate Anchorage", "Ren: For the water gate.")],
    outro: [p(["ren"], "Five ships burned to the waterline. Only the black flagship, far out, was left.")],
  },
  {
    title: "Storm Deck",
    cls: "Stronghold",
    beat: "The first mate, fought in a storm",
    intro: [
      p(["soldier"], "First Mate Sazanami had never lost a fight on a moving deck. She waited for Ren in the rain."),
      p(["ren"], undefined, "Ren: I was raised in a flooded sewer. I do not mind the wet."),
    ],
    steps: [
      reach("outer", "Board the Storm Deck"),
      kill("outer", "fast", 4, "Defeat First Mate Sazanami", { elite: "First Mate Sazanami", say: "Ren: Your deck. My pace." }),
    ],
    outro: [p(["ren"], "The first mate went over the rail still smiling. The flagship's lights came on one by one.")],
  },
  {
    title: "The Black Flagship",
    cls: "Stronghold",
    beat: "Board the flagship",
    intro: [
      p(["tide"], "On the admiral's deck, Lady Namie watched a turtle fight his way up her ship, and poured two cups of whisky."),
      p(["ren"], undefined, "Ren: I can see Kai's nunchaku at her belt from here."),
    ],
    steps: [
      kill("outer", "ranged", 4, "Clear the harpooners from the Storm Deck"),
      kill("inner", "melee", 6, "Fight across the Black Flagship"),
      destroy("inner", "Cabin door", 1, 2, "Break down the cabin door"),
    ],
    outro: [p(["ren"], "The door gave way. She had not bothered to lock it.")],
  },
  {
    title: "The Tide Goes Out",
    cls: "General",
    beat: "Reclaim Kai's nunchaku",
    intro: [
      p(["tide"], undefined, "The Tide: He chained my fleets for his precious peace. I only wanted the sea back. I am sorry it cost your brother."),
      p(["ren", "tide"], undefined, "Ren: I believe you. Draw."),
    ],
    steps: [
      reach("inner", "Cross the Black Flagship"),
      boss("throne", "Defeat the Tide", "The Tide: Your brother danced well, little shell. Do you?"),
    ],
    outro: [],
  },
]);
