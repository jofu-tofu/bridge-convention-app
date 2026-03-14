import type { ConventionBundle } from "../../core/bundle/bundle-types";
import type { DealConstraints } from "../../../engine/types";
import { Seat, Suit, BidSuit } from "../../../engine/types";
import { ConventionCategory } from "../../core/types";
import { buildAuction } from "../../../engine/auction-helpers";
import {
  BERGEN_R1_HEARTS_SURFACES,
  BERGEN_R1_SPADES_SURFACES,
  BERGEN_R2_AFTER_CONSTRUCTIVE_HEARTS_SURFACES,
  BERGEN_R2_AFTER_CONSTRUCTIVE_SPADES_SURFACES,
  BERGEN_R2_AFTER_LIMIT_HEARTS_SURFACES,
  BERGEN_R2_AFTER_LIMIT_SPADES_SURFACES,
  BERGEN_R2_AFTER_PREEMPTIVE_HEARTS_SURFACES,
  BERGEN_R2_AFTER_PREEMPTIVE_SPADES_SURFACES,
  BERGEN_R3_AFTER_GAME_SURFACES,
  BERGEN_R3_AFTER_SIGNOFF_SURFACES,
  BERGEN_R3_AFTER_GAME_TRY_HEARTS_SURFACES,
  BERGEN_R3_AFTER_GAME_TRY_SPADES_SURFACES,
  BERGEN_R4_SURFACES,
} from "./meaning-surfaces";
import { bergenFacts } from "./facts";
import { BERGEN_PROFILE } from "./system-profile";
import { BERGEN_ROUTED_SURFACES, createBergenSurfaceRouter } from "./surface-routing";
import { createBergenConversationMachine } from "./machine";
import { BERGEN_EXPLANATION_CATALOG } from "./explanation-catalog";

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
  memberIds: ["bergen-bundle", "bergen-raises"],
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
    // R1: Responder initial bids
    { groupId: "responder-r1-hearts", surfaces: BERGEN_R1_HEARTS_SURFACES },
    { groupId: "responder-r1-spades", surfaces: BERGEN_R1_SPADES_SURFACES },
    // R2: Opener rebids
    { groupId: "opener-after-constructive-hearts", surfaces: BERGEN_R2_AFTER_CONSTRUCTIVE_HEARTS_SURFACES },
    { groupId: "opener-after-constructive-spades", surfaces: BERGEN_R2_AFTER_CONSTRUCTIVE_SPADES_SURFACES },
    { groupId: "opener-after-limit-hearts", surfaces: BERGEN_R2_AFTER_LIMIT_HEARTS_SURFACES },
    { groupId: "opener-after-limit-spades", surfaces: BERGEN_R2_AFTER_LIMIT_SPADES_SURFACES },
    { groupId: "opener-after-preemptive-hearts", surfaces: BERGEN_R2_AFTER_PREEMPTIVE_HEARTS_SURFACES },
    { groupId: "opener-after-preemptive-spades", surfaces: BERGEN_R2_AFTER_PREEMPTIVE_SPADES_SURFACES },
    // R3: Responder continuations
    { groupId: "responder-after-game", surfaces: BERGEN_R3_AFTER_GAME_SURFACES },
    { groupId: "responder-after-signoff", surfaces: BERGEN_R3_AFTER_SIGNOFF_SURFACES },
    { groupId: "responder-after-game-try-hearts", surfaces: BERGEN_R3_AFTER_GAME_TRY_HEARTS_SURFACES },
    { groupId: "responder-after-game-try-spades", surfaces: BERGEN_R3_AFTER_GAME_TRY_SPADES_SURFACES },
    // R4: Opener final acceptance
    { groupId: "opener-r4-accept", surfaces: BERGEN_R4_SURFACES },
  ],
  factExtensions: [bergenFacts],
  surfaceRouter: createBergenSurfaceRouter(BERGEN_ROUTED_SURFACES),
  systemProfile: BERGEN_PROFILE,
  conversationMachine: createBergenConversationMachine(),
  explanationCatalog: BERGEN_EXPLANATION_CATALOG,
};
