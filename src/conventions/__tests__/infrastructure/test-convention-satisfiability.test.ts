import { beforeEach, describe, expect, test } from "vitest";
import { Seat } from "../../../engine/types";
import { hand } from "../../../engine/__tests__/fixtures";
import { evaluateHand } from "../../../engine/hand-evaluator";
import { buildAuction } from "../../../engine/auction-helpers";
import { clearRegistry, evaluateBiddingRules, registerConvention } from "../../core/registry";
import type { BiddingContext, ConventionConfig } from "../../core/types";
import { buildEffectiveContext } from "../../core/pipeline/effective-context";
import { generateCandidates } from "../../core/pipeline/candidate-generator";
import { selectMatchedCandidate } from "../../core/pipeline/candidate-selector";
import { lebensohlLiteConfig } from "../../definitions/lebensohl-lite";

beforeEach(() => {
  clearRegistry();
});

describe("test convention satisfiability", () => {
  test("Lebensohl Lite: suppressing matched weak signoff does not allow unsatisfied preferred selection", () => {
    const suppressWeakSignoffConfig: ConventionConfig = {
      ...lebensohlLiteConfig,
      id: "lebensohl-lite-suppress-test",
      name: "Lebensohl Lite Suppress Test",
      overlays: [
        {
          id: "suppress-weak-signoff",
          roundName: "overcall",
          matches: () => true,
          suppressIntent: proposal => proposal.nodeName === "lebensohl-weak-signoff",
        },
      ],
    };
    registerConvention(suppressWeakSignoffConfig);

    const h = hand(
      "SK", "S7", "S4",
      "HQ", "H7", "H3",
      "D7", "D6", "D4",
      "C8", "C6", "C4", "C2",
    ); // weak hand, no strong actions should be satisfiable
    const context: BiddingContext = {
      hand: h,
      auction: buildAuction(Seat.North, ["1NT", "2H"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };

    const evaluated = evaluateBiddingRules(context, suppressWeakSignoffConfig);
    expect(evaluated).not.toBeNull();

    const effective = buildEffectiveContext(context, suppressWeakSignoffConfig, evaluated!.protocolResult!);
    const generated = generateCandidates(
      evaluated!.treeRoot!,
      evaluated!.treeEvalResult!,
      effective,
    );

    const unsatisfied = generated.candidates.find(c => c.failedConditions.length > 0);
    expect(unsatisfied).toBeDefined();

    const promoted = { ...unsatisfied!, priority: "preferred" as const };
    expect(selectMatchedCandidate([promoted])).toBeNull();
  });
});
