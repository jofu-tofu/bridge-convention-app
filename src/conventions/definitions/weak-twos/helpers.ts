import { BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import type { BiddingContext, HandCondition } from "../../core/types";
import { partnerOpeningStrain } from "../../core/conditions";

const pass: Call = { type: "pass" };

/** Map BidSuit strain to suit index (SUIT_ORDER: [0]=S, [1]=H, [2]=D, [3]=C). */
export function strainToSuitIndex(strain: BidSuit | null): number {
  if (strain === BidSuit.Spades) return 0;
  if (strain === BidSuit.Hearts) return 1;
  if (strain === BidSuit.Diamonds) return 2;
  if (strain === BidSuit.Clubs) return 3;
  return -1;
}

/** Map BidSuit strain to a human-readable suit name. */
export function strainToSuitName(strain: BidSuit | null): string {
  if (strain === BidSuit.Spades) return "spades";
  if (strain === BidSuit.Hearts) return "hearts";
  if (strain === BidSuit.Diamonds) return "diamonds";
  if (strain === BidSuit.Clubs) return "clubs";
  return "unknown";
}

/** Dynamic call: raise partner's weak two to game (4M for majors, 5m for minors). */
export function raiseToGame(ctx: BiddingContext): Call {
  const strain = partnerOpeningStrain(ctx);
  if (!strain || strain === BidSuit.NoTrump) return pass;
  const isMinor = strain === BidSuit.Clubs || strain === BidSuit.Diamonds;
  return { type: "bid", level: isMinor ? 5 : 4, strain };
}

/** Dynamic call: raise partner's weak two to 3M (invite). */
export function raiseToThree(ctx: BiddingContext): Call {
  const strain = partnerOpeningStrain(ctx);
  if (!strain || strain === BidSuit.NoTrump) return pass;
  return { type: "bid", level: 3, strain };
}

/** N+ cards in partner's opened suit (works for any suit, not just majors). */
export function partnerSuitSupport(n: number): HandCondition {
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
