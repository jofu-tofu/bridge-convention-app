import { describe, it, expect } from "vitest";
import { Seat } from "../../../engine/types";
import { evaluateHand } from "../../../engine/hand-evaluator";
import { buildAuction } from "../../../engine/auction-helpers";
import type { BiddingContext, ConventionConfig } from "../../core/types";
import { noMajorHand } from "../fixtures";
import { staymanConfig } from "../../definitions/stayman";
import { evaluateForInference } from "../../core/inference-api";

describe("evaluateForInference", () => {
  function makeOpenerResponseContext(): BiddingContext {
    const h = noMajorHand();
    return {
      hand: h,
      auction: buildAuction(Seat.North, ["1NT", "P", "2C", "P"]),
      seat: Seat.North,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };
  }

  it("returns rejected decisions needed for inference extraction", () => {
    const result = evaluateForInference(staymanConfig, makeOpenerResponseContext());

    expect(result).not.toBeNull();
    expect(result!.treeResult.rejectedDecisions.length).toBeGreaterThan(0);
    const rejectedNames = result!.treeResult.rejectedDecisions.map((entry) => entry.node.condition.name);
    expect(rejectedNames).toContain("hearts-min");
    expect(rejectedNames).toContain("spades-min");
  });

  it("returns null for convention configs without a protocol", () => {
    const noProtocolConfig: ConventionConfig = {
      ...staymanConfig,
      id: "stayman-no-protocol",
      protocol: undefined,
    };

    const result = evaluateForInference(noProtocolConfig, makeOpenerResponseContext());
    expect(result).toBeNull();
  });
});
