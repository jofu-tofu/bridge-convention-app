// Barrel re-export — all public symbols from the conditions subsystem.
// Consumers import from "../conditions" (resolves to this index.ts).

export {
  conditionedRule,
  not,
  and,
  or,
} from "./rule-builders";

export {
  // Leaf auction condition factories
  auctionMatches,
  auctionMatchesAny,
  // Relational condition factories
  isOpener,
  isResponder,
  partnerOpened,
  partnerOpenedAt,
  opponentBid,
  noPriorBid,
  biddingRound,
  partnerBidAt,
  seatHasBid,
  advanceAfterDouble,
  // Seat-agnostic milestone conditions
  bidMade,
  doubleMade,
  bidMadeAtLevel,
  // Seat-specific conditions for seatFilters
  opponentOpenedAt,
  seatHasActed,
  seatDoubled,
  seatBidAt,
  partnerLastBidAtLevel,
  partnerDoubled,
  // Interference protection conditions
  passedAfter,
  passedAfterDouble,
  // SAYC query helpers (data-returning)
  partnerOpeningStrain,
  seatFirstBidStrain,
  partnerRespondedMajor,
  lastBid,
  bidIsHigher,
  // Pure auction condition factories
  notPassedHand,
  opponentActed,
  partnerOpenedMajor,
  partnerOpenedMinor,
  lastEntryIsPass,
} from "./auction-conditions";

export {
  // Counting helpers
  countAcesInHand,
  countKingsInHand,
  // Vulnerability conditions
  isVulnerable,
  isNotVulnerable,
  favorableVulnerability,
  unfavorableVulnerability,
  // HCP conditions
  hcpMin,
  hcpMax,
  hcpRange,
  // Suit length conditions
  suitMin,
  suitBelow,
  anySuitMin,
  // Counting conditions
  aceCount,
  aceCountAny,
  kingCount,
  kingCountAny,
  // Shape conditions
  hasShortage,
  noVoid,
  isBalanced,
  noFiveCardMajor,
  longerMajor,
  hasFourCardMajor,
  // Convention-specific compound conditions
  majorSupport,
  hasSingleLongSuit,
  isTwoSuited,
  // Gerber-specific compound conditions
  gerberSignoffCondition,
  gerberKingAskCondition,
  // DONT-specific conditions
  bothMajors,
  diamondsPlusMajor,
  clubsPlusHigher,
  advanceSupportFor,
  advanceLackSupport,
  // SAYC-extracted condition factories
  majorSupportN,
  partnerRaisedOurMajor,
  partnerRespondedMajorWithSupport,
  sixPlusInOpenedSuit,
  goodSuitAtLevel,
} from "./hand-conditions";
