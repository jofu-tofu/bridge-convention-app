// Weak Twos interference overlays — how the convention adapts when
// opponents interfere after a weak two opening.

import { CompetitionMode } from "../../core/dialogue/dialogue-state";
import type { ConventionOverlayPatch } from "../../core/overlay/overlay";
import { handDecision, fallback } from "../../core/tree/rule-tree";
import type { HandNode } from "../../core/tree/rule-tree";
import { createIntentBidFactory } from "../../core/intent/intent-node";
import { SemanticIntentType } from "../../core/intent/semantic-intent";
import { hcpMin, and, partnerOpeningStrain } from "../../core/conditions";
import type { HandCondition, BiddingContext } from "../../core/types";
import type { Call } from "../../../engine/types";
import { BidSuit } from "../../../engine/types";
import { strainToSuitIndex, strainToSuitName } from "./helpers";

const bid = createIntentBidFactory("weak-twos-overlay");

// ─── Shared conditions ──────────────────────────────────────

/** N+ cards in partner's opened suit. */
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

/** Dynamic call: raise partner's suit to game (4M for majors, 5m for minors). */
function raiseToGame(ctx: BiddingContext): Call {
  const strain = partnerOpeningStrain(ctx);
  if (!strain || strain === BidSuit.NoTrump) return { type: "pass" };
  const isMinor = strain === BidSuit.Clubs || strain === BidSuit.Diamonds;
  return { type: "bid", level: isMinor ? 5 : 4, strain };
}

/** Dynamic call: competitive raise to 3 in partner's suit. */
function raiseToThree(ctx: BiddingContext): Call {
  const strain = partnerOpeningStrain(ctx);
  if (!strain || strain === BidSuit.NoTrump) return { type: "pass" };
  return { type: "bid", level: 3, strain };
}

// ─── Replacement trees ──────────────────────────────────────

/** After opponent doubles weak two: redouble (10+ HCP), raise with fit, or pass. */
const responseAfterDouble: HandNode = handDecision(
  "doubled-game-values",
  and(hcpMin(16), partnerSuitSupport(3)),
  bid("weak-two-doubled-game-raise", "Raises to game despite the double — strong hand with fit",
    { type: SemanticIntentType.RaiseToGame, params: {} },
    raiseToGame),
  handDecision(
    "doubled-competitive-raise",
    and(hcpMin(8), partnerSuitSupport(3)),
    bid("weak-two-doubled-compete", "Competitive raise after double — support with some values",
      { type: SemanticIntentType.ShowSupport, params: {} },
      raiseToThree),
    handDecision(
      "doubled-redouble",
      hcpMin(10),
      bid("weak-two-penalty-redouble", "Redouble shows 10+ HCP — penalty-oriented",
        { type: SemanticIntentType.PenaltyRedouble, params: {} },
        (): Call => ({ type: "redouble" })),
      fallback("doubled-pass"),
    ),
  ),
);

/** After opponent overcalls weak two: raise with fit, or pass. */
const responseAfterOvercall: HandNode = handDecision(
  "overcalled-game-values",
  and(hcpMin(16), partnerSuitSupport(3)),
  bid("weak-two-overcalled-game-raise", "Raises to game despite overcall — strong hand with fit",
    { type: SemanticIntentType.RaiseToGame, params: {} },
    raiseToGame),
  handDecision(
    "overcalled-competitive-raise",
    and(hcpMin(8), partnerSuitSupport(3)),
    bid("weak-two-overcalled-compete", "Competitive raise after overcall — support with values",
      { type: SemanticIntentType.ShowSupport, params: {} },
      raiseToThree),
    fallback("overcalled-pass"),
  ),
);

// ─── Overlay patches ────────────────────────────────────────

export const weakTwoOverlays: readonly ConventionOverlayPatch[] = [
  {
    id: "weak-two-doubled",
    roundName: "response",
    matches: (state) => state.competitionMode === CompetitionMode.Doubled,
    replacementTree: responseAfterDouble,
  },
  {
    id: "weak-two-overcalled",
    roundName: "response",
    matches: (state) => state.competitionMode === CompetitionMode.Overcalled,
    replacementTree: responseAfterOvercall,
  },
];
