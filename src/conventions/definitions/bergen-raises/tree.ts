import { BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import {
  bidMade,
  bidMadeAtLevel,
  biddingRound,
  hcpMin,
  hcpMax,
  hcpRange,
  majorSupport,
  hasShortage,
  and,
  or,
  not,
  isOpener,
  isResponder,
  partnerBidAt,
  opponentActed,
  notPassedHand,
} from "../../core/conditions";
import type { AuctionCondition } from "../../core/types";
import { decision, handDecision, fallback } from "../../core/rule-tree";
import type { HandNode, RuleNode } from "../../core/rule-tree";
import { createIntentBidFactory } from "../../core/intent/intent-node";
import { SemanticIntentType } from "../../core/intent/semantic-intent";
import { protocol, round, semantic } from "../../core/protocol";
import type { ConventionProtocol } from "../../core/protocol";
import {
  gameInOpenersMajor,
  threeOfOpenersMajor,
  gameTryAcceptCall,
  gameTryRejectCall,
  openerRebidGame,
  openerRebidSignoff,
  splinterCall,
  splinterRelayCall,
  splinterDisclosureCall,
  helpSuitGameTryCall,
} from "./helpers";
import {
  partnerRaisedToThreeOfMajor,
  partnerBidGameInMajor,
  partnerSignedOffInThreeMajor,
  partnerBidSplinter,
  partnerBidSplinterRelay,
} from "./conditions";

const bid = createIntentBidFactory("bergen");

// SUIT_ORDER indices: [0]=Spades, [1]=Hearts, [2]=Diamonds, [3]=Clubs

// ─── Hand subtrees ──────────────────────────────────────────

// Responder initial bids (after 1M-P)
const responderInitialBranch: HandNode = handDecision(
  "splinter-hcp",
  and(hcpMin(12), majorSupport(), hasShortage()),
  bid("bergen-splinter", "Shows a raise with a singleton or void",
    { type: SemanticIntentType.ShowShortage, params: {} },
    splinterCall),
  handDecision(
    "game-raise-hcp",
    and(hcpMin(13), majorSupport()),
    bid("bergen-game-raise", "Raises directly to game with support",
      { type: SemanticIntentType.ShowSupport, params: { strength: "game" } },
      gameInOpenersMajor),
    handDecision(
      "limit-raise-hcp",
      and(hcpRange(10, 12), majorSupport()),
      bid("bergen-limit-raise", "Shows a limit raise with support",
        { type: SemanticIntentType.ShowSupport, params: { strength: "limit" } },
        (): Call => ({ type: "bid", level: 3, strain: BidSuit.Diamonds })),
      handDecision(
        "constructive-hcp",
        and(hcpRange(7, 10), majorSupport()),
        bid("bergen-constructive-raise", "Shows a constructive raise with support",
          { type: SemanticIntentType.ShowSupport, params: { strength: "constructive" } },
          (): Call => ({ type: "bid", level: 3, strain: BidSuit.Clubs })),
        handDecision(
          "preemptive-hcp",
          and(hcpMax(6), majorSupport()),
          bid("bergen-preemptive-raise", "Makes a preemptive raise to consume bidding space",
            { type: SemanticIntentType.ShowSupport, params: { strength: "preemptive" } },
            threeOfOpenersMajor),
          fallback(),
        ),
      ),
    ),
  ),
);

// Opener rebids after constructive (1M P 3C P)
const openerAfterConstructive: HandNode = handDecision(
  "rebid-game-17+",
  hcpMin(17),
  bid("bergen-rebid-game-after-constructive", "Accepts and raises to game",
    { type: SemanticIntentType.AcceptInvitation, params: {} },
    openerRebidGame),
  handDecision(
    "rebid-try-14-16",
    hcpRange(14, 16),
    bid("bergen-rebid-try-after-constructive", "Makes a help-suit game try in weakest side suit",
      { type: SemanticIntentType.HelpSuitGameTry, params: {} },
      helpSuitGameTryCall),
    bid("bergen-rebid-signoff-after-constructive", "Signs off over the constructive raise",
      { type: SemanticIntentType.DeclineInvitation, params: {} },
      (): Call => ({ type: "pass" })),
  ),
);

// Opener rebids after limit (1M P 3D P)
const openerAfterLimit: HandNode = handDecision(
  "rebid-game-15+",
  hcpMin(15),
  bid("bergen-rebid-game-after-limit", "Accepts the limit raise and bids game",
    { type: SemanticIntentType.AcceptInvitation, params: {} },
    openerRebidGame),
  bid("bergen-rebid-signoff-after-limit", "Declines the limit raise and signs off",
    { type: SemanticIntentType.DeclineInvitation, params: {} },
    openerRebidSignoff),
);

// Opener rebids after preemptive (1M P 3M P)
const openerAfterPreemptive: HandNode = handDecision(
  "rebid-game-18+",
  hcpMin(18),
  bid("bergen-rebid-game-after-preemptive", "Bids game over the preemptive raise",
    { type: SemanticIntentType.RaiseToGame, params: {} },
    openerRebidGame),
  bid("bergen-rebid-pass-after-preemptive", "Passes over the preemptive raise",
    { type: SemanticIntentType.AcceptPartnerDecision, params: {} },
    (): Call => ({ type: "pass" })),
);

// Opener rebids after splinter
const openerAfterSplinter = bid(
  "bergen-splinter-relay",
  "Relays to ask responder to disclose shortage suit",
  { type: SemanticIntentType.AskShortage, params: {} },
  splinterRelayCall,
);

// Opener round 1 rebid dispatch — uses decision() for auction conditions
const openerRound1Branch: RuleNode = decision(
  "after-constructive-check",
  partnerBidAt(3, BidSuit.Clubs),
  openerAfterConstructive,
  decision(
    "after-limit-check",
    partnerBidAt(3, BidSuit.Diamonds),
    openerAfterLimit,
    decision(
      "after-preemptive-check",
      partnerRaisedToThreeOfMajor(),
      openerAfterPreemptive,
      decision(
        "after-splinter-check",
        partnerBidSplinter(),
        openerAfterSplinter,
        fallback("no-opener-round1"),
      ),
    ),
  ),
);

// Responder round 1 continuation dispatch
const responderRound1Branch: RuleNode = decision(
  "partner-bid-game-check",
  partnerBidGameInMajor(),
  bid("bergen-accept-game", "Accepts partner's game bid",
    { type: SemanticIntentType.AcceptPartnerDecision, params: {} },
    (): Call => ({ type: "pass" })),
  decision(
    "partner-signoff-check",
    partnerSignedOffInThreeMajor(),
    bid("bergen-accept-signoff", "Accepts partner's signoff",
      { type: SemanticIntentType.AcceptPartnerDecision, params: {} },
      (): Call => ({ type: "pass" })),
    decision(
      "splinter-relay-resp-check",
      partnerBidSplinterRelay(),
      bid("bergen-splinter-disclose", "Discloses the suit of shortage",
        { type: SemanticIntentType.ShowShortage, params: {} },
        splinterDisclosureCall),
      decision(
        "game-try-resp-check",
        partnerBidAt(3, BidSuit.Diamonds),
        handDecision(
          "try-accept-9-10",
          hcpRange(9, 10),
          bid("bergen-try-accept", "Accepts the game try and bids game",
            { type: SemanticIntentType.AcceptInvitation, params: {} },
            gameTryAcceptCall),
          bid("bergen-try-reject", "Rejects the game try and signs off",
            { type: SemanticIntentType.DeclineInvitation, params: {} },
            gameTryRejectCall),
        ),
        fallback("no-responder-round1"),
      ),
    ),
  ),
);

// ─── Protocol ────────────────────────────────────────────────

export const bergenProtocol: ConventionProtocol = protocol("bergen-raises", [
  // Round 1: Partner opens 1M — responder bids Bergen raise
  // seatFilter: responder who hasn't previously passed
  round("opening", {
    triggers: [
      semantic(or(bidMade(1, BidSuit.Hearts), bidMade(1, BidSuit.Spades)) as AuctionCondition, {}),
    ],
    handTree: responderInitialBranch,
    seatFilter: and(isResponder(), notPassedHand()) as AuctionCondition,
  }),
  // Round 2: Responder bid at 3-level — opener rebids (first rebid)
  // seatFilter: opener on their first rebid, uncontested
  round("response", {
    triggers: [
      semantic(bidMadeAtLevel(3), {}),
    ],
    handTree: openerRound1Branch as HandNode,
    seatFilter: and(isOpener(), biddingRound(1), not(opponentActed())) as AuctionCondition,
  }),
  // Round 3: Opener rebid — responder continues (first continuation)
  // seatFilter: responder on their first rebid, uncontested
  round("opener-rebid", {
    triggers: [
      semantic(or(bidMadeAtLevel(3), bidMadeAtLevel(4)) as AuctionCondition, {}),
    ],
    handTree: responderRound1Branch as HandNode,
    seatFilter: and(isResponder(), biddingRound(1), not(opponentActed())) as AuctionCondition,
  }),
  // Round 4: Responder made final decision — opener accepts (second rebid)
  // seatFilter: opener on their second rebid, uncontested
  round("continuation", {
    triggers: [
      semantic(or(bidMadeAtLevel(3), bidMadeAtLevel(4)) as AuctionCondition, {}),
    ],
    handTree: bid("bergen-opener-accept-after-try", "Accepts partner's decision on the game try",
      { type: SemanticIntentType.AcceptPartnerDecision, params: {} },
      (): Call => ({ type: "pass" })),
    seatFilter: and(isOpener(), biddingRound(2), not(opponentActed())) as AuctionCondition,
  }),
]);
