import { createBundle } from "../../core/bundle";
import type { DealConstraints } from "../../../engine/types";
import { Seat, Suit } from "../../../engine/types";
import { CAP_OPENING_1NT } from "../../../core/contracts/capability-vocabulary";
import { ConventionCategory } from "../../core/types";
import { buildAuction } from "../../../engine/auction-helpers";
import { ntCrossConventionAlternatives } from "./alternatives";
import { NT_SAYC_PROFILE } from "./system-profile";
import { NT_CROSS_MODULE_RELATIONS } from "./pedagogical-relations";
import { composeNtModules } from "./compose";
import { staymanModule } from "./modules/stayman";
import { jacobyTransfersModule } from "./modules/jacoby-transfers";
import { smolenModule } from "./modules/smolen";
import { naturalNtModule } from "./modules/natural-nt";

const composed = composeNtModules(
  [naturalNtModule, jacobyTransfersModule, staymanModule, smolenModule],
  NT_CROSS_MODULE_RELATIONS,
);

const ntDealConstraints: DealConstraints = {
  seats: [
    { seat: Seat.North, minHcp: 15, maxHcp: 17, balanced: true },
    {
      seat: Seat.South,
      minHcp: 6,
      minLengthAny: { [Suit.Spades]: 4, [Suit.Hearts]: 4 },
    },
  ],
  dealer: Seat.North,
};

export const ntBundle = createBundle({
  id: "nt-bundle",
  name: "1NT Response Bundle",
  description: "Stayman + Jacoby Transfers responses to 1NT opening",
  category: ConventionCategory.Constructive,
  memberIds: ["jacoby-transfers", "stayman", "smolen"],
  dealConstraints: ntDealConstraints,
  defaultAuction: (seat) => {
    if (seat === Seat.South || seat === Seat.East) {
      return buildAuction(Seat.North, ["1NT", "P"]);
    }
    return undefined;
  },
  declaredCapabilities: { [CAP_OPENING_1NT]: "active" },
  meaningSurfaces: [
    { groupId: "responder-r1", surfaces: composed.entrySurfaces },
    ...composed.surfaceGroups,
  ],
  factExtensions: composed.factExtensions,
  surfaceRouter: composed.surfaceRouter,
  systemProfile: NT_SAYC_PROFILE,
  conversationMachine: composed.conversationMachine,
  explanationCatalog: composed.explanationCatalog,
  pedagogicalRelations: composed.pedagogicalRelations,
  acceptableAlternatives: ntCrossConventionAlternatives,
});
