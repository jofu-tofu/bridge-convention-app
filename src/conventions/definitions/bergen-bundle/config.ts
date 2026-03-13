import type { ConventionBundle } from "../../core/bundle/bundle-types";
import type { DealConstraints } from "../../../engine/types";
import { Seat, Suit, BidSuit } from "../../../engine/types";
import { ConventionCategory } from "../../core/types";
import { buildAuction } from "../../../engine/auction-helpers";
import {
  BERGEN_R1_HEARTS_SURFACES,
  BERGEN_R1_SPADES_SURFACES,
} from "./meaning-surfaces";
import { bergenFacts } from "./facts";
import { BERGEN_PROFILE } from "./system-profile";
import { BERGEN_ROUTED_SURFACES, createBergenSurfaceRouter } from "./surface-routing";
import { createBergenConversationMachine } from "./machine";

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

export const bergenBundle: ConventionBundle = {
  id: "bergen-bundle",
  name: "Bergen Raises Bundle",
  description: "Bergen Raises — constructive, limit, and preemptive responses to 1M opening",
  category: ConventionCategory.Constructive,
  memberIds: ["bergen-raises"],
  // internal: parity testing against tree-based bergen-raises;
  // both pipelines coexist until the meaning pipeline is fully validated
  internal: true,
  dealConstraints: bergenBundleDealConstraints,
  defaultAuction: (seat) => {
    if (seat === Seat.South || seat === Seat.East) {
      return buildAuction(Seat.North, ["1H", "P"]);
    }
    return undefined;
  },
  activationFilter: (auction) => {
    const has1Major = auction.entries.some(
      (e) =>
        e.call.type === "bid" &&
        e.call.level === 1 &&
        (e.call.strain === BidSuit.Hearts || e.call.strain === BidSuit.Spades),
    );
    if (!has1Major) return [];
    return ["bergen-raises"];
  },
  meaningSurfaces: [
    { groupId: "responder-r1-hearts", surfaces: BERGEN_R1_HEARTS_SURFACES },
    { groupId: "responder-r1-spades", surfaces: BERGEN_R1_SPADES_SURFACES },
  ],
  factExtensions: [bergenFacts],
  surfaceRouter: createBergenSurfaceRouter(BERGEN_ROUTED_SURFACES),
  systemProfile: BERGEN_PROFILE,
  conversationMachine: createBergenConversationMachine(),
};
