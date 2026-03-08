import { BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import {
  bidMade,
  bidMadeAtLevel,
  noPriorBid,
  isOpener,
  isResponder,
  lastEntryIsPass,
  passedAfter,
  biddingRound,
  hcpMin,
  hcpRange,
  suitMin,
  suitQuality,
  and,
  seatFirstBidStrain,
  partnerOpeningStrain,
} from "../../core/conditions";
import { handDecision, fallback } from "../../core/tree/rule-tree";
import type { HandNode } from "../../core/tree/rule-tree";
import type { HandCondition } from "../../core/types";
import { createIntentBidFactory } from "../../core/intent/intent-node";
import { SemanticIntentType } from "../../core/intent/semantic-intent";
import { protocol, round, semantic } from "../../core/protocol/protocol";
import type { ConventionProtocol, EstablishedContext } from "../../core/protocol/protocol";
import { raiseToGame, raiseToThree, strainToSuitIndex, strainToSuitName } from "./helpers";

const bid = createIntentBidFactory("weak-twos");
// SUIT_ORDER indices: [0]=Spades, [1]=Hearts, [2]=Diamonds, [3]=Clubs

// ─── Established context ────────────────────────────────────

interface WeakTwoEstablished extends EstablishedContext {
  openingSuit?: BidSuit;
}

// ─── Round 1: Opening ───────────────────────────────────────

const openingTree: HandNode = handDecision(
  "has-6-hearts",
  and(suitMin(1, "hearts", 6), hcpRange(5, 11)),
  bid("weak-two-opening-h", "Opens with a weak hand and long hearts",
    { type: SemanticIntentType.PreemptiveOpen, params: { suit: "hearts" } },
    (): Call => ({ type: "bid", level: 2, strain: BidSuit.Hearts })),
  handDecision(
    "has-6-spades",
    and(suitMin(0, "spades", 6), hcpRange(5, 11)),
    bid("weak-two-opening-s", "Opens with a weak hand and long spades",
      { type: SemanticIntentType.PreemptiveOpen, params: { suit: "spades" } },
      (): Call => ({ type: "bid", level: 2, strain: BidSuit.Spades })),
    handDecision(
      "has-6-diamonds",
      and(suitMin(2, "diamonds", 6), hcpRange(5, 11)),
      bid("weak-two-opening-d", "Opens with a weak hand and long diamonds",
        { type: SemanticIntentType.PreemptiveOpen, params: { suit: "diamonds" } },
        (): Call => ({ type: "bid", level: 2, strain: BidSuit.Diamonds })),
      fallback("no-weak-two"),
    ),
  ),
);

// ─── Round 2: Response ──────────────────────────────────────

/** N+ cards in partner's opened suit (works for any suit, not just majors). */
function partnerSuitSupport(n: number): HandCondition {
  return {
    name: `partner-suit-support-${n}`,
    label: `${n}+ in partner's opened suit`,
    category: "hand",
    test(ctx) {
      const strain = partnerOpeningStrain(ctx);
      const idx = strainToSuitIndex(strain);
      if (idx < 0) return false;
      return ctx.evaluation.shape[idx]! >= n;
    },
    describe(ctx) {
      const strain = partnerOpeningStrain(ctx);
      const idx = strainToSuitIndex(strain);
      const suitName = strainToSuitName(strain);
      if (idx < 0) return "Partner did not open a suit";
      const len = ctx.evaluation.shape[idx]!;
      return len >= n
        ? `${len} ${suitName} (${n}+ support)`
        : `Need ${n}+ ${suitName} (have ${len})`;
    },
  };
}

const responseTree: HandNode = handDecision(
  "game-strength-with-fit",
  and(hcpMin(16), partnerSuitSupport(3)),
  bid("weak-two-game-raise", "Raises to game with a strong hand and support",
    { type: SemanticIntentType.RaiseToGame, params: {} },
    raiseToGame),
  handDecision(
    "ogust-ask",
    hcpMin(16),
    bid("weak-two-ogust-ask", "Asks about hand quality using Ogust",
      { type: SemanticIntentType.AskHandQuality, params: {} },
      (): Call => ({ type: "bid", level: 2, strain: BidSuit.NoTrump })),
    handDecision(
      "invite-with-fit",
      and(hcpRange(14, 15), partnerSuitSupport(3)),
      bid("weak-two-invite", "Makes an invitational raise",
        { type: SemanticIntentType.InviteGame, params: {} },
        raiseToThree),
      fallback("weak-pass"),
    ),
  ),
);

// ─── Round 3: Ogust Rebid ───────────────────────────────────

/** Ogust rebid tree — opener classifies hand by HCP range and suit quality.
 *  Uses seatFirstBidStrain to identify which suit was opened. */
function ogustRebidTree(): HandNode {
  /** Dynamic suitQuality that checks this seat's opened suit. */
  function openedSuitQuality(minTopHonors: number): HandCondition {
    return {
      name: "opened-suit-quality",
      label: `${minTopHonors}+ top honors in opened suit`,
      category: "hand",
      test(ctx) {
        const strain = seatFirstBidStrain(ctx);
        const idx = strainToSuitIndex(strain);
        if (idx < 0) return false;
        return suitQuality(idx, strainToSuitName(strain), minTopHonors).test(ctx);
      },
      describe(ctx) {
        const strain = seatFirstBidStrain(ctx);
        const idx = strainToSuitIndex(strain);
        if (idx < 0) return "No previous bid found";
        return suitQuality(idx, strainToSuitName(strain), minTopHonors).describe(ctx);
      },
    };
  }

  // 3NT: solid suit (AKQ) — check first since it's most specific
  return handDecision(
    "solid-suit",
    openedSuitQuality(3),
    bid("ogust-solid", "Shows a solid suit with AKQ",
      { type: SemanticIntentType.ShowHandQuality, params: { strength: "max", suitQuality: "solid" } },
      (): Call => ({ type: "bid", level: 3, strain: BidSuit.NoTrump })),
    // min HCP range
    handDecision(
      "min-hcp",
      hcpRange(5, 8),
      // min + good/bad suit
      handDecision(
        "min-good-suit",
        openedSuitQuality(2),
        bid("ogust-min-good", "Shows minimum strength with a good suit",
          { type: SemanticIntentType.ShowHandQuality, params: { strength: "min", suitQuality: "good" } },
          (): Call => ({ type: "bid", level: 3, strain: BidSuit.Diamonds })),
        bid("ogust-min-bad", "Shows minimum strength with a weak suit",
          { type: SemanticIntentType.ShowHandQuality, params: { strength: "min", suitQuality: "bad" } },
          (): Call => ({ type: "bid", level: 3, strain: BidSuit.Clubs })),
      ),
      // max HCP range (9-11)
      handDecision(
        "max-good-suit",
        openedSuitQuality(2),
        bid("ogust-max-good", "Shows maximum strength with a good suit",
          { type: SemanticIntentType.ShowHandQuality, params: { strength: "max", suitQuality: "good" } },
          (): Call => ({ type: "bid", level: 3, strain: BidSuit.Spades })),
        bid("ogust-max-bad", "Shows maximum strength with a weak suit",
          { type: SemanticIntentType.ShowHandQuality, params: { strength: "max", suitQuality: "bad" } },
          (): Call => ({ type: "bid", level: 3, strain: BidSuit.Hearts })),
      ),
    ),
  );
}

// ─── Protocol ───────────────────────────────────────────────

export const weakTwosProtocol: ConventionProtocol<WeakTwoEstablished> = protocol<WeakTwoEstablished>("weak-twos", [
  // Round 1: Opening — opener opens with a weak hand and 6-card suit.
  // Two triggers: noPriorBid for the opening decision itself (empty auction),
  // and bidMadeAtLevel(2) for when the opening already happened (later rounds
  // need round 1 to match so the cursor can advance past it).
  round<WeakTwoEstablished>("opening", {
    triggers: [
      semantic<WeakTwoEstablished>(noPriorBid(), {}),
      semantic<WeakTwoEstablished>(bidMadeAtLevel(2), {}),
    ],
    handTree: openingTree,
    seatFilter: and(isOpener(), biddingRound(0)),
  }),
  // Round 2: Response — responder decides to raise, ask Ogust, or pass
  round<WeakTwoEstablished>("response", {
    triggers: [
      semantic<WeakTwoEstablished>(bidMadeAtLevel(2), {}),
    ],
    handTree: responseTree,
    seatFilter: and(isResponder(), lastEntryIsPass()),
  }),
  // Round 3: Ogust rebid — opener classifies hand quality
  round<WeakTwoEstablished>("ogust-rebid", {
    triggers: [
      semantic<WeakTwoEstablished>(bidMade(2, BidSuit.NoTrump), {}),
    ],
    handTree: ogustRebidTree(),
    seatFilter: and(isOpener(), passedAfter(2, BidSuit.NoTrump)),
  }),
]);
