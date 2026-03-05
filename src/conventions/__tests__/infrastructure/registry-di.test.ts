import { describe, test, expect, beforeEach } from "vitest";
import { Seat } from "../../../engine/types";
import { evaluateHand } from "../../../engine/hand-evaluator";
import { buildAuction } from "../../../engine/auction-helpers";
import type { BiddingContext, ConventionConfig } from "../../core/types";
import { ConventionCategory } from "../../core/types";
import { evaluateBiddingRules, clearRegistry } from "../../core/registry";
import { staymanResponder } from "../fixtures";
import { staymanConfig } from "../../definitions/stayman";
import { InterferenceKind } from "../../core/dialogue/dialogue-state";

describe("evaluateBiddingRules DI", () => {
  beforeEach(() => {
    clearRegistry();
  });

  test("supports injected lookup without registry setup", () => {
    const opponentConvention: ConventionConfig = {
      id: "opponent-local-map",
      name: "Opponent Local Map",
      description: "Synthetic opponent convention for injected lookup tests",
      category: ConventionCategory.Competitive,
      dealConstraints: { seats: [] },
      protocol: staymanConfig.protocol,
      interferenceSignatures: [
        {
          kind: InterferenceKind.TakeoutDouble,
          isNatural: false,
          matches(call) {
            return call.type === "double";
          },
        },
      ],
    };
    const localLookup = (id: string): ConventionConfig => {
      if (id === opponentConvention.id) return opponentConvention;
      throw new Error(`missing local convention: ${id}`);
    };

    const h = staymanResponder();
    const context: BiddingContext = {
      hand: h,
      auction: buildAuction(Seat.North, ["1NT", "X"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [opponentConvention.id],
    };

    const result = evaluateBiddingRules(context, staymanConfig, localLookup);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-penalty-redouble");
  });

  test("propagates errors from injected lookup for missing IDs", () => {
    const throwingLookup = (id: string): ConventionConfig => {
      throw new Error(`injected lookup failed: ${id}`);
    };
    const h = staymanResponder();
    const context: BiddingContext = {
      hand: h,
      auction: buildAuction(Seat.North, ["1NT", "X"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: ["missing-injected"],
    };

    expect(() => evaluateBiddingRules(context, staymanConfig, throwingLookup))
      .toThrowError("injected lookup failed: missing-injected");
  });
});
