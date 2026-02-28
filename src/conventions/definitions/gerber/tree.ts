import { BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import {
  auctionMatchesAny,
  hcpMin,
  and,
  aceCount,
  kingCount,
  noVoid,
  gerberSignoffCondition,
  gerberKingAskCondition,
} from "../../core/conditions";
import { auctionDecision, handDecision, bid, fallback } from "../../core/rule-tree";
import type { RuleNode, HandNode } from "../../core/rule-tree";
import { gerberSignoffCall, gerberAceAuctionPatterns, gerberKingAskAuctionPatterns } from "./helpers";

// ─── Rule Tree ────────────────────────────────────────────────
//
// Known limitations (documented in docs/conventions/gerber.md):
// - NT overcall trigger: Bridge Bum says Gerber applies after "any NT bid
//   (or overcall)" but we only handle 1NT/2NT openings. NT overcalls
//   (e.g., 1H-1NT-P-4C) are not supported because the drill infrastructure
//   generates hands where North opens 1NT/2NT — overcall sequences never arise.
// - Jump rebid of 4C: Bridge Bum says "a jump rebid of 4C in response to a
//   natural no-trump bid is Gerber" (e.g., 1NT-P-2C-P-2D-P-4C after Stayman).
//   Not supported because conventions drill independently — cross-convention
//   sequences (Stayman then Gerber) are out of scope for single-convention drills.

// Ace response subtree: chained binary decisions (3? → 2? → 1? → 0/4)
const aceResponseBranch: HandNode = handDecision(
  "ace-3",
  aceCount(3),
  bid("gerber-response-three", "Shows exactly 3 aces", (): Call => ({ type: "bid", level: 4, strain: BidSuit.NoTrump })),
  handDecision(
    "ace-2",
    aceCount(2),
    bid("gerber-response-two", "Shows exactly 2 aces", (): Call => ({ type: "bid", level: 4, strain: BidSuit.Spades })),
    handDecision(
      "ace-1",
      aceCount(1),
      bid("gerber-response-one", "Shows exactly 1 ace", (): Call => ({ type: "bid", level: 4, strain: BidSuit.Hearts })),
      bid("gerber-response-zero-four", "Shows 0 or 4 aces", (): Call => ({ type: "bid", level: 4, strain: BidSuit.Diamonds })),
    ),
  ),
);

// King response subtree: chained binary decisions (3? → 2? → 1? → 0/4)
const kingResponseBranch: HandNode = handDecision(
  "king-3",
  kingCount(3),
  bid("gerber-king-response-three", "Shows exactly 3 kings", (): Call => ({ type: "bid", level: 5, strain: BidSuit.NoTrump })),
  handDecision(
    "king-2",
    kingCount(2),
    bid("gerber-king-response-two", "Shows exactly 2 kings", (): Call => ({ type: "bid", level: 5, strain: BidSuit.Spades })),
    handDecision(
      "king-1",
      kingCount(1),
      bid("gerber-king-response-one", "Shows exactly 1 king", (): Call => ({ type: "bid", level: 5, strain: BidSuit.Hearts })),
      bid("gerber-king-response-zero-four", "Shows 0 or 4 kings", (): Call => ({ type: "bid", level: 5, strain: BidSuit.Diamonds })),
    ),
  ),
);

export const gerberRuleTree: RuleNode = auctionDecision(
  "after-nt-opening",
  auctionMatchesAny([["1NT", "P"], ["2NT", "P"]]),
  // YES: responder's turn after NT opening
  handDecision(
    "hcp-and-no-void",
    and(hcpMin(16), noVoid()),
    bid("gerber-ask", "Asks how many aces partner holds", (): Call => ({ type: "bid", level: 4, strain: BidSuit.Clubs })),
    fallback(),
  ),
  // NO: not after NT-P — auction checks before hand checks
  auctionDecision(
    "after-ace-ask",
    auctionMatchesAny(gerberAceAuctionPatterns),
    // YES: opener responding to ace ask
    aceResponseBranch,
    // NO: not after ace ask
    auctionDecision(
      "after-king-ask",
      auctionMatchesAny(gerberKingAskAuctionPatterns),
      // YES: opener responding to king ask
      kingResponseBranch,
      // NO: not after king ask — hand conditions follow
      handDecision(
        "king-ask-check",
        gerberKingAskCondition(),
        bid("gerber-king-ask", "Asks how many kings partner holds", (): Call => ({ type: "bid", level: 5, strain: BidSuit.Clubs })),
        // NO: not king-ask eligible
        handDecision(
          "signoff-check",
          gerberSignoffCondition(),
          bid("gerber-signoff", "Signs off at the appropriate notrump level", gerberSignoffCall),
          fallback(),
        ),
      ),
    ),
  ),
);
