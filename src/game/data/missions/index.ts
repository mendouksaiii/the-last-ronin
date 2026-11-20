import type { Mission, NationId } from "../../types";
import { ASH } from "./ash";
import { LANTERNS } from "./lanterns";
import { REEDS } from "./reeds";
import { SNOW } from "./snow";
import { TIDES } from "./tides";

// All fifty missions, ten per nation, in story order.
export const MISSIONS: Record<NationId, Mission[]> = {
  reeds: REEDS,
  snow: SNOW,
  tides: TIDES,
  lanterns: LANTERNS,
  ash: ASH,
};
