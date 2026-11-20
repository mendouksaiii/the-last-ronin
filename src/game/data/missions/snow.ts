import { boss, collect, destroy, escort, kill, nationMissions, reach, scene, survive } from "./build";

const p = scene("snow");
const night = scene("castle");

// Act II: the Cathedral Heights and the Bell.
export const SNOW = nationMissions("snow", [
  {
    title: "A Thousand Steps",
    cls: "Story",
    beat: "Ren begins the climb to the cathedral",
    intro: [
      p(["villager", "ren"], "The Bodega Shelter, in the Cathedral Heights.", "Brother Enzan: The Abbot says heaven ordered the lord's death. Heaven did not consult the rest of us."),
      p(["villager"], undefined, "Brother Enzan: Climb the Thousand Steps, if you want to see what his heaven looks like."),
    ],
    steps: [
      reach("road", "Begin the climb at the Thousand Steps", "Ren: Shun counted these once. He lost count at four hundred."),
      kill("road", "melee", 3, "Defeat the warrior monks on the steps"),
      reach("ruin", "Reach the Burnt Library", "Ren: They burned their own books."),
    ],
    outro: [p(["ren"], "The library where the true monks kept the city's records was a field of sleet and char.")],
  },
  {
    title: "Hounds Below the Cathedral",
    cls: "Hunt",
    beat: "Clear the hounds loosed on refugees",
    intro: [
      p(["villager", "ren"], undefined, "Brother Enzan: The Bell's men loosed feral hounds in Riverside Woods. Hungry beasts keep hungry people indoors."),
      p(["ren"], "Seven sets of tracks led into the dead trees."),
    ],
    steps: [kill("fields", "fast", 7, "Hunt the hounds in Riverside Woods", { say: "Ren: You did not choose this either." })],
    outro: [p(["ren"], "The woods were quiet. Ren left the hounds where the sleet would cover them.")],
  },
  {
    title: "Records in the Sleet",
    cls: "Gather",
    beat: "Collect the scattered archive drives",
    intro: [
      p(["villager", "ren"], undefined, "Brother Enzan: When the library burned, the wind took the archive. Six drives may have survived in the ruins."),
      p(["soldier"], "The Bell's monks were hunting for them too, to finish the fire's work."),
    ],
    steps: [collect("ruin", "Archive drive", 6, 3, "Collect the archive drives in the Burnt Library", "Shun's voice: Read them before you hand them over. You never read anything.")],
    outro: [p(["villager", "ren"], "Six drives, scorched but whole.", "Brother Enzan: A city can remember itself from less than this.")],
  },
  {
    title: "The Silent Pilgrims",
    cls: "Aid",
    beat: "Escort refugees through the woods",
    intro: [
      p(["villager", "villager"], "Refugees under a vow of silence waited in the woods. They would not ask for help. They would not refuse it."),
      p(["ren"], undefined, "Ren: Walk. I will make the noise."),
    ],
    steps: [escort("fields", "ruin", "The pilgrims", 3, "Escort the pilgrims from Riverside Woods to the Burnt Library", "Ren: Keep to my tracks.")],
    outro: [p(["villager"], "At the library, the eldest pilgrim broke her vow with a single word.", "Pilgrim: Shellguard.")],
  },
  {
    title: "The Post That Burned",
    cls: "Memory",
    beat: "Shun's last stand at the watch post",
    playAs: "kusari",
    intro: [
      p(["ren"], "On the bridge, Ren found a scorched chain weight frozen into the ice, and the night came back."),
      night(["shun"], "The Night of Red Camellias. The watch post above the plaza.", "Shun: An order to watch the north road alone. Whoever wrote this knows I do not ask questions."),
    ],
    steps: [
      reach("water", "Climb to the Watch Post", "Shun: The gate is too quiet. Daigo is never quiet."),
      survive("water", 4, "Hold the Watch Post", "Shun: Three metres of chain. Let us see how far it reaches."),
    ],
    outro: [
      night(["shun", "bell"], "When they could not reach him, the monks brought fire.", "Shun: Ren. Count the steps for me."),
      p(["ren"], undefined, "Ren: Four hundred and one, brother. I am still counting."),
    ],
  },
  {
    title: "The Cable Bridge",
    cls: "Sabotage",
    beat: "Cut the Bell's supply line",
    intro: [
      p(["villager", "ren"], undefined, "Brother Enzan: Every crate the Abbot eats crosses one cable bridge. His monks cannot chant on empty stomachs."),
      p(["soldier"], "Three great cables, and the guards who walked them."),
    ],
    steps: [
      kill("water", "melee", 3, "Clear the guards from the Cable Bridge"),
      destroy("water", "Bridge cable", 3, 2, "Cut the cables of the supply bridge", "Ren: Let heaven carry his food."),
    ],
    outro: [p(["ren"], "The bridge dropped into the fog over the river without a sound.")],
  },
  {
    title: "The Crossbow Monks",
    cls: "Hunt",
    beat: "Defeat the abbot's marksmen",
    intro: [
      p(["soldier", "soldier"], "On Crossbow Terrace stood the monks who had shot fire into Shun's post."),
      p(["ren"], undefined, "Shun's voice: Close the distance, Ren. Marksmen hate that. I certainly did."),
    ],
    steps: [kill("camp", "ranged", 6, "Defeat the Crossbow Monks on Crossbow Terrace", { say: "Ren: You shoot well. My brother reached further." })],
    outro: [p(["ren"], "Six crossbows lay broken on the terrace. Above it the cathedral doors stood open, as if expecting him.")],
  },
  {
    title: "The Hall of Saints",
    cls: "Stronghold",
    beat: "The guardian of the nave",
    intro: [
      p(["soldier"], "The nave was lined with stone saints twice the height of a man. One of them was breathing."),
      p(["ren"], undefined, "Ren: I thought so."),
    ],
    steps: [
      reach("outer", "Enter the Hall of Saints"),
      kill("outer", "brute", 3, "Defeat the Stone Saint", { elite: "The Stone Saint", say: "Ren: Which of you is carved, and which only obeys?" }),
    ],
    outro: [p(["ren"], "The guardian fell among the statues, and could not be told from them.")],
  },
  {
    title: "The Frozen Bell Tower",
    cls: "Stronghold",
    beat: "Climb the tower",
    intro: [
      p(["bell"], "At the top of the tower, Abbot Joshin prayed beside the great bell, with Shun's chain laid before it as an offering."),
      p(["ren"], undefined, "Ren: That is not yours to offer."),
    ],
    steps: [
      kill("inner", "melee", 5, "Fight up the Bell Tower Stair"),
      kill("inner", "ranged", 4, "Defeat the crossbowmen on the landing"),
      destroy("inner", "Tower seal", 1, 2, "Break the seal on the bell chamber"),
    ],
    outro: [p(["ren"], "The seal split. Beyond it, the chanting stopped.")],
  },
  {
    title: "The Bell Tolls Once",
    cls: "General",
    beat: "Reclaim Shun's kusari-fundo",
    intro: [
      p(["bell"], undefined, "The Bell: Peace made men soft, little shell. Heaven asked me to wake them. I rang, and the city woke."),
      p(["ren", "bell"], undefined, "Ren: You burned a quiet man at his post and called it heaven. Ring it again. See who answers."),
    ],
    steps: [
      reach("inner", "Climb to the bell chamber"),
      boss("throne", "Defeat the Bell", "The Bell: Heaven hears this bell. It will hear you break."),
    ],
    outro: [],
  },
]);
