import { boss, collect, defend, destroy, escort, kill, nationMissions, reach, scene, survive } from "./build";

const p = scene("reeds");
const night = scene("castle");

// Act I: the Drowned Borough and the Ox.
export const REEDS = nationMissions("reeds", [
  {
    title: "The Empty Depot",
    cls: "Story",
    beat: "Ren arrives among starving survivors",
    intro: [
      p(["villager", "ren"], "The Culvert Hideout, in the Drowned Borough.", "Sae the Fixer: A turtle with a katana. Either the rain is playing tricks, or the Lantern Lord's guard still walks."),
      p(["villager"], undefined, "Sae the Fixer: The Ox took every ration in Queens. Go look at the old depot, if you want to know what kind of man he is."),
    ],
    steps: [
      reach("ruin", "Walk to the Old Ration Depot", "Ren: Empty. Every last crate."),
      kill("ruin", "melee", 3, "Drive off the toll enforcers", { say: "Ren: You are taxing rust now?" }),
    ],
    outro: [p(["ren"], "The depot held nothing but an enforcer's ledger and the smell of wet cardboard.", "Ren: Then I start with the ones who carried it away.")],
  },
  {
    title: "Scarecrows That Bleed",
    cls: "Hunt",
    beat: "Blades hide among the scarecrows of the flooded lots",
    intro: [
      p(["villager", "ren"], undefined, "Sae the Fixer: The scarecrows in the flooded lots move at night. Whoever goes to check does not come back."),
      p(["soldier"], "The Ox's men had learned to stand very still in the rain."),
    ],
    steps: [kill("fields", "fast", 6, "Cut down the Reed Blades in the Flooded Lots", { say: "Ren: Straw does not breathe." })],
    outro: [p(["ren"], "Six scarecrows lay face down in the black water. Not one of them was stuffed with straw.")],
  },
  {
    title: "Fog on the Lots",
    cls: "Gather",
    beat: "Recover the seed stock hidden in the fog",
    intro: [
      p(["villager", "ren"], undefined, "Sae the Fixer: We sank our seed canisters in the lots before the collectors came. Without them the rooftop gardens die."),
      p(["ren"], "Six canisters, somewhere in the fog, and the Ox's men still walking the levees."),
    ],
    steps: [collect("fields", "Seed canister", 6, 3, "Recover the hidden seed canisters in the Flooded Lots", "Daigo's voice: Slow down. You always rush the fog.")],
    outro: [p(["villager", "ren"], "The seed stock came home on a turtle's back.", "Sae the Fixer: You carry it like your brother carried the gate bar.")],
  },
  {
    title: "The Ferryman's Debt",
    cls: "Aid",
    beat: "Escort the ferryman past the toll guards",
    intro: [
      p(["villager", "ren"], undefined, "Ferryman Goro: The Ox says I owe him a toll for every crossing my father ever made. I only want to reach my boat."),
      p(["soldier"], "The toll guards were waiting along Toll Boulevard."),
    ],
    steps: [escort("road", "water", "Ferryman Goro", 3, "Escort Ferryman Goro from Toll Boulevard to the Ferry Slip", "Ren: Stay behind my shell.")],
    outro: [p(["villager"], "The ferry ran that night for the first time in a season.", "Ferryman Goro: No toll for turtles. Ever.")],
  },
  {
    title: "The Gate That Held",
    cls: "Memory",
    beat: "Daigo's last stand at the Tower Gate",
    playAs: "bo",
    intro: [
      p(["ren"], "By the ferry, Ren found a steel staff cap rusting in the reeds, and the night came back."),
      night(["daigo"], "The Night of Red Camellias. The gate of the Lantern Tower.", "Daigo: An order to hold the gate alone? Strange. But a gate is a simple thing. Nobody passes."),
    ],
    steps: [
      reach("road", "Take your post at the Tower Gate", "Daigo: Where are my brothers tonight?"),
      survive("road", 4, "Hold the Tower Gate", "Daigo: Come, then. One at a time or all at once."),
    ],
    outro: [
      night(["daigo", "ox"], "The gate held until the Ox himself came through it.", "Daigo: Ren... do not wait up."),
      p(["ren"], undefined, "Ren: He held it alone. I was not there."),
    ],
  },
  {
    title: "Burning the Ledger",
    cls: "Sabotage",
    beat: "Destroy the Ox's debt records",
    intro: [
      p(["villager", "ren"], undefined, "Sae the Fixer: Every debt in the borough is kept in the Ledger House servers. Burn them and nobody owes the Ox a crumb."),
      p(["soldier"], "Four server cabinets. Rather more than four guards."),
    ],
    steps: [destroy("camp", "Ledger server", 4, 4, "Destroy the ledger servers at the Ledger House", "Ren: Let us settle the accounts.")],
    outro: [p(["ren"], "The smoke from the Ledger House could be seen from every rooftop in Queens.")],
  },
  {
    title: "The Ration Barge",
    cls: "Aid",
    beat: "Bring a seized barge safely to the survivors",
    intro: [
      p(["villager", "ren"], undefined, "Ferryman Goro: A barge full of our rations is tied up at the slip, bound for the Ox's table."),
      p(["ren"], undefined, "Ren: Then it has come far enough."),
    ],
    steps: [
      kill("water", "melee", 4, "Seize the ration barge from its guards"),
      defend("water", "Ration barge", 3, "Hold the barge while the survivors unload", "Ren: Unload it. I will hold them."),
    ],
    outro: [p(["villager"], "That night the borough ate its own food.", "Sae the Fixer: Now he will send the Brothers of the Yoke. He must.")],
  },
  {
    title: "Brothers of the Yoke",
    cls: "Stronghold",
    beat: "The Ox's twin lieutenants at the depot wall",
    intro: [
      p(["soldier", "soldier"], "Ichi and Ni of the Yoke: twin brutes who once dragged the Ox's armoured truck by chains, and broke whatever stood in front of it."),
      p(["ren"], undefined, "Ren: Two brothers at a gate. I know how this is done."),
    ],
    steps: [
      reach("outer", "Breach the Depot Wall"),
      kill("outer", "brute", 3, "Defeat Ichi of the Yoke", { elite: "Ichi of the Yoke", say: "Ren: Which one are you?" }),
      kill("outer", "brute", 3, "Defeat Ni of the Yoke", { elite: "Ni of the Yoke" }),
    ],
    outro: [p(["ren"], "The yoke chains lay broken at the wall. Beyond them stood the Great Depot.")],
  },
  {
    title: "The Depot Shutters",
    cls: "Stronghold",
    beat: "Break into the Great Depot",
    intro: [
      p(["soldier"], "Behind steel shutters sat every ration the Ox had taken in three years."),
      p(["ren"], undefined, "Daigo's voice: A gate is a simple thing, little brother. Go through it."),
    ],
    steps: [
      kill("outer", "melee", 5, "Clear the yard inside the Depot Wall"),
      destroy("inner", "Shutter lock", 2, 4, "Break the shutter locks of the Great Depot"),
      kill("inner", "ranged", 4, "Defeat the crossbowmen inside"),
    ],
    outro: [p(["ren"], "The shutters rolled up. From the hall beyond came the sound of a man eating.")],
  },
  {
    title: "The Ox at Table",
    cls: "General",
    beat: "Reclaim Daigo's bo staff",
    intro: [
      p(["ox"], "General Kuroda Gonzaemon sat alone at a table laid for forty, under a single hanging bulb.", "The Ox: The little shell. Sit. Eat. Your brother never would."),
      p(["ren", "ox"], undefined, "Ren: That is his staff on your wall. I have come to take it down."),
    ],
    steps: [
      reach("inner", "Cross the Great Depot"),
      boss("throne", "Defeat the Ox", "The Ox: Then I will hang your shell beside it!"),
    ],
    outro: [],
  },
]);
