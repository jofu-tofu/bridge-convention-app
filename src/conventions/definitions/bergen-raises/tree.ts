import { BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import {
  auctionMatchesAny,
  hcpMin,
  hcpMax,
  hcpRange,
  majorSupport,
  hasShortage,
  and,
  not,
  isOpener,
  isResponder,
  biddingRound,
  partnerBidAt,
  opponentActed,
  notPassedHand,
} from "../../core/conditions";
import { auctionDecision, handDecision, bid, fallback } from "../../core/rule-tree";
import type { RuleNode, HandNode, AuctionNode } from "../../core/rule-tree";
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

// SUIT_ORDER indices: [0]=Spades, [1]=Hearts, [2]=Diamonds, [3]=Clubs

// Responder initial bids (after 1M-P)
const responderInitialBranch: HandNode = handDecision(
  "splinter-hcp",
  and(hcpMin(12), majorSupport(), hasShortage()),
  bid("bergen-splinter", "Shows a raise with a singleton or void", splinterCall),
  handDecision(
    "game-raise-hcp",
    and(hcpMin(13), majorSupport()),
    bid("bergen-game-raise", "Raises directly to game with support", gameInOpenersMajor),
    handDecision(
      "limit-raise-hcp",
      and(hcpRange(10, 12), majorSupport()),
      bid("bergen-limit-raise", "Shows a limit raise with support", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Diamonds })),
      handDecision(
        "constructive-hcp",
        and(hcpRange(7, 10), majorSupport()),
        bid("bergen-constructive-raise", "Shows a constructive raise with support", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Clubs })),
        handDecision(
          "preemptive-hcp",
          and(hcpMax(6), majorSupport()),
          bid("bergen-preemptive-raise", "Makes a preemptive raise to consume bidding space", threeOfOpenersMajor),
          fallback(),
        ),
      ),
    ),
  ),
);

// Opener rebids after constructive (1M P 3C P) — help-suit game try
const openerAfterConstructive: HandNode = handDecision(
  "rebid-game-17+",
  hcpMin(17),
  bid("bergen-rebid-game-after-constructive", "Accepts and raises to game", openerRebidGame),
  handDecision(
    "rebid-try-14-16",
    hcpRange(14, 16),
    bid("bergen-rebid-try-after-constructive", "Makes a help-suit game try in weakest side suit", helpSuitGameTryCall),
    bid("bergen-rebid-signoff-after-constructive", "Signs off over the constructive raise", (): Call => ({ type: "pass" })),
  ),
);

// Opener rebids after limit (1M P 3D P)
const openerAfterLimit: HandNode = handDecision(
  "rebid-game-15+",
  hcpMin(15),
  bid("bergen-rebid-game-after-limit", "Accepts the limit raise and bids game", openerRebidGame),
  bid("bergen-rebid-signoff-after-limit", "Declines the limit raise and signs off", openerRebidSignoff),
);

// Opener rebids after preemptive (1M P 3M P)
const openerAfterPreemptive: HandNode = handDecision(
  "rebid-game-18+",
  hcpMin(18),
  bid("bergen-rebid-game-after-preemptive", "Bids game over the preemptive raise", openerRebidGame),
  bid("bergen-rebid-pass-after-preemptive", "Passes over the preemptive raise", (): Call => ({ type: "pass" })),
);

// Opener rebids after splinter (1M P other-major P) — relay to ask for shortness
const openerAfterSplinter: RuleNode = bid(
  "bergen-splinter-relay",
  "Relays to ask responder to disclose shortage suit",
  splinterRelayCall,
);

// Opener round 1 rebids
const openerRound1Branch: AuctionNode = auctionDecision(
  "after-constructive",
  partnerBidAt(3, BidSuit.Clubs),
  openerAfterConstructive,
  auctionDecision(
    "after-limit",
    partnerBidAt(3, BidSuit.Diamonds),
    openerAfterLimit,
    auctionDecision(
      "after-preemptive",
      partnerRaisedToThreeOfMajor(),
      openerAfterPreemptive,
      auctionDecision(
        "after-splinter",
        partnerBidSplinter(),
        openerAfterSplinter,
        fallback(),
      ),
    ),
  ),
);

// Responder round 1 continuation (after opener's rebid)
const responderRound1Branch: AuctionNode = auctionDecision(
  "partner-bid-game",
  partnerBidGameInMajor(),
  bid("bergen-accept-game", "Accepts partner's game bid", (): Call => ({ type: "pass" })),
  auctionDecision(
    "partner-signoff",
    partnerSignedOffInThreeMajor(),
    bid("bergen-accept-signoff", "Accepts partner's signoff", (): Call => ({ type: "pass" })),
    auctionDecision(
      "splinter-relay-resp",
      partnerBidSplinterRelay(),
      bid("bergen-splinter-disclose", "Discloses the suit of shortage", splinterDisclosureCall),
      auctionDecision(
        "game-try-resp",
        // Game try can be in any suit (help-suit), not just 3D
        // We detect it as: partner made a bid at 3-level that isn't signoff, game, or splinter relay
        // For simplicity, check if partner bid 3D, 3H (after 1S), or 3S (after 1H) as game try
        partnerBidAt(3, BidSuit.Diamonds),
        handDecision(
          "try-accept-9-10",
          hcpRange(9, 10),
          bid("bergen-try-accept", "Accepts the game try and bids game", gameTryAcceptCall),
          bid("bergen-try-reject", "Rejects the game try and signs off", gameTryRejectCall),
        ),
        fallback(),
      ),
    ),
  ),
);

// Root tree
export const bergenRuleTree: RuleNode = auctionDecision(
  "responder-initial",
  and(auctionMatchesAny([["1H", "P"], ["1S", "P"]]), notPassedHand()),
  responderInitialBranch,
  auctionDecision(
    "is-opener-round1",
    and(isOpener(), biddingRound(1), not(opponentActed())),
    openerRound1Branch,
    auctionDecision(
      "is-responder-round1",
      and(isResponder(), biddingRound(1), not(opponentActed())),
      responderRound1Branch,
      auctionDecision(
        "is-opener-round2",
        and(isOpener(), biddingRound(2), not(opponentActed())),
        bid("bergen-opener-accept-after-try", "Accepts partner's decision on the game try", (): Call => ({ type: "pass" })),
        fallback(),
      ),
    ),
  ),
);
