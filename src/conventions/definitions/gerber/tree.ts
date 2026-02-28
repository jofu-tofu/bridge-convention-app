import { BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import {
  bidMade,
  hcpMin,
  and,
  or,
  not,
  aceCount,
  kingCount,
  noVoid,
  gerberSignoffCondition,
  gerberKingAskCondition,
  isResponder,
  isOpener,
  seatHasActed,
  passedAfter,
} from "../../core/conditions";
import type { AuctionCondition } from "../../core/types";
import { handDecision, bid, fallback } from "../../core/rule-tree";
import type { HandNode } from "../../core/rule-tree";
import { protocol, round, semantic } from "../../core/protocol";
import type { ConventionProtocol } from "../../core/protocol";
import { gerberSignoffCall } from "./helpers";

// ─── Hand subtrees (unchanged) ──────────────────────────────

// Known limitations (documented in docs/conventions/gerber.md):
// - NT overcall trigger not supported (drill only generates 1NT/2NT openings)
// - Jump rebid of 4C after Stayman not supported (cross-convention out of scope)

// Gerber ask subtree: responder with 16+ HCP and no void bids 4C
const gerberAskBranch: HandNode = handDecision(
  "hcp-and-no-void",
  and(hcpMin(16), noVoid()),
  bid("gerber-ask", "Asks how many aces partner holds", (): Call => ({ type: "bid", level: 4, strain: BidSuit.Clubs })),
  fallback(),
);

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

// Default hand tree (king-ask and signoff checks)
const defaultBranch: HandNode = handDecision(
  "king-ask-check",
  gerberKingAskCondition(),
  bid("gerber-king-ask", "Asks how many kings partner holds", (): Call => ({ type: "bid", level: 5, strain: BidSuit.Clubs })),
  handDecision(
    "signoff-check",
    gerberSignoffCondition(),
    bid("gerber-signoff", "Signs off at the appropriate notrump level", gerberSignoffCall),
    fallback(),
  ),
);

// ─── Trigger conditions ──────────────────────────────────────

// Ace response trigger: any 4-level bid EXCEPT 4C (which is the Gerber ask itself)
const aceResponseMade: AuctionCondition = or(
  bidMade(4, BidSuit.Diamonds),
  bidMade(4, BidSuit.Hearts),
  bidMade(4, BidSuit.Spades),
  bidMade(4, BidSuit.NoTrump),
) as AuctionCondition;

// King response trigger: any 5-level bid EXCEPT 5C (which is the king ask itself)
const kingResponseMade: AuctionCondition = or(
  bidMade(5, BidSuit.Diamonds),
  bidMade(5, BidSuit.Hearts),
  bidMade(5, BidSuit.Spades),
  bidMade(5, BidSuit.NoTrump),
) as AuctionCondition;

// ─── Protocol ────────────────────────────────────────────────

export const gerberProtocol: ConventionProtocol = protocol("gerber", [
  // Round 1: Partner opens 1NT or 2NT — responder considers Gerber ask
  round("nt-opening", {
    triggers: [
      semantic(bidMade(1, BidSuit.NoTrump), {}),
      semantic(bidMade(2, BidSuit.NoTrump), {}),
    ],
    handTree: gerberAskBranch,
    seatFilter: and(
      isResponder(),
      not(seatHasActed()),
      or(passedAfter(1, BidSuit.NoTrump), passedAfter(2, BidSuit.NoTrump)),
    ) as AuctionCondition,
  }),
  // Round 2: Responder bid 4C (Gerber ask) — opener shows ace count
  round("gerber-ask", {
    triggers: [semantic(bidMade(4, BidSuit.Clubs), {})],
    handTree: aceResponseBranch,
    seatFilter: and(isOpener(), passedAfter(4, BidSuit.Clubs)) as AuctionCondition,
  }),
  // Round 3: Opener showed aces — responder decides king-ask or signoff
  round("ace-response", {
    triggers: [semantic(aceResponseMade, {})],
    handTree: defaultBranch,
    seatFilter: isResponder(),
  }),
  // Round 4: Responder bid 5C (king ask) — opener shows king count
  round("king-ask", {
    triggers: [semantic(bidMade(5, BidSuit.Clubs), {})],
    handTree: kingResponseBranch,
    seatFilter: and(isOpener(), passedAfter(5, BidSuit.Clubs)) as AuctionCondition,
  }),
  // Round 5: Opener showed kings — responder places final contract
  round("king-response", {
    triggers: [semantic(kingResponseMade, {})],
    handTree: defaultBranch,
    seatFilter: isResponder(),
  }),
]);
