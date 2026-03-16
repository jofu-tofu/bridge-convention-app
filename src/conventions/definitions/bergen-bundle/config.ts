import { createBundle } from "../../core/bundle";
import type { DealConstraints } from "../../../engine/types";
import { Seat, Suit } from "../../../engine/types";
import { ConventionCategory } from "../../core/types";
import { CAP_OPENING_MAJOR } from "../../../core/contracts/capability-vocabulary";
import { buildAuction } from "../../../engine/auction-helpers";
import { BERGEN_PROFILE } from "./system-profile";
import { BERGEN_ALTERNATIVE_GROUPS } from "./alternatives";
import { composeBergenModules } from "./compose";
import { bergenModule } from "./module";

const composed = composeBergenModules([bergenModule]);

const bergenBundleDealConstraints: DealConstraints = {
  seats: [
    // North = opener: 12-21 HCP, 5+ in a major
    {
      seat: Seat.North,
      minHcp: 12,
      maxHcp: 21,
      minLengthAny: { [Suit.Spades]: 5, [Suit.Hearts]: 5 },
    },
    // South = responder: 0+ HCP, 4+ in a major
    {
      seat: Seat.South,
      minHcp: 0,
      minLengthAny: { [Suit.Spades]: 4, [Suit.Hearts]: 4 },
    },
  ],
  dealer: Seat.North,
};

export const bergenBundle = createBundle({
  id: "bergen-bundle",
  name: "Bergen Raises Bundle",
  description: "Bergen Raises — constructive, limit, and preemptive responses to 1M opening",
  category: ConventionCategory.Constructive,
  memberIds: ["bergen-bundle", "bergen-raises"],
  declaredCapabilities: { [CAP_OPENING_MAJOR]: "active" },
  composed,
  dealConstraints: bergenBundleDealConstraints,
  defaultAuction: (seat) => {
    if (seat === Seat.South || seat === Seat.East) {
      return buildAuction(Seat.North, ["1H", "P"]);
    }
    return undefined;
  },
  systemProfile: BERGEN_PROFILE,
  acceptableAlternatives: BERGEN_ALTERNATIVE_GROUPS,
});
