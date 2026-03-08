import { describe, it, expect } from "vitest";
import { BidSuit, Seat } from "../../../engine/types";
import { evaluateHand } from "../../../engine/hand-evaluator";
import { buildAuction } from "../../../engine/auction-helpers";
import { hand } from "../fixtures";
import type { BiddingContext, ConventionConfig } from "../../core/types";
import { ConventionCategory } from "../../core/types";
import { evaluateProtocol } from "../../core/protocol/protocol-evaluator";
import { treeResultToBiddingRuleResult } from "../../core/tree/tree-compat";
import {
  evaluateBiddingRules,
  computeTriggerOverridesForConfig,
  applyProtocolOverlays,
} from "../../core/registry";
import { staymanConfig } from "../../definitions/stayman";
import { protocol, round, semantic } from "../../core/protocol";
import { bidMade, isResponder } from "../../core/conditions";
import { intentBid } from "../../core/intent/intent-node";
import { SemanticIntentType } from "../../core/intent/semantic-intent";

describe("registry pipeline helpers", () => {
  it("computeTriggerOverridesForConfig returns overrides matching evaluateBiddingRules behavior", () => {
    const tree = intentBid(
      "open-after-2nt",
      "2NT path",
      { type: SemanticIntentType.NaturalBid, params: {} },
      () => ({ type: "bid" as const, level: 3 as const, strain: BidSuit.Clubs }),
    );
    const config: ConventionConfig = {
      id: "trigger-override-test",
      name: "Trigger Override Test",
      description: "Test protocol trigger overrides",
      category: ConventionCategory.Asking,
      dealConstraints: { seats: [] },
      protocol: protocol("trigger-override-test", [
        round("opening", {
          triggers: [semantic(bidMade(1, BidSuit.NoTrump), {})],
          handTree: tree,
          seatFilter: isResponder(),
        }),
      ]),
      overlays: [
        {
          id: "force-2nt-opening",
          roundName: "opening",
          matches: () => true,
          triggerOverrides: new Map([
            ["opening", [semantic(bidMade(2, BidSuit.NoTrump), {})]],
          ]),
        },
      ],
    };

    const h = hand("SA", "SK", "SQ", "SJ", "HA", "HK", "DA", "D5", "D3", "C5", "C4", "C3", "C2");
    const context: BiddingContext = {
      hand: h,
      auction: buildAuction(Seat.North, ["2NT", "P"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };

    const triggerOverrides = computeTriggerOverridesForConfig(config, context.auction);
    expect(triggerOverrides).toBeDefined();
    expect(triggerOverrides!.has("opening")).toBe(true);

    const protocolResult = evaluateProtocol(config.protocol!, context, triggerOverrides);
    const manual = treeResultToBiddingRuleResult(protocolResult.handResult, context);
    const evaluated = evaluateBiddingRules(context, config);

    expect(manual).not.toBeNull();
    expect(evaluated).not.toBeNull();
    expect(evaluated!.rule).toBe(manual!.rule);
    expect(evaluated!.call).toEqual(manual!.call);
  });

  it("applyProtocolOverlays returns replacement-tree evaluation when overlay is active", () => {
    const h = hand("SA", "SK", "SQ", "SJ", "HA", "HK", "DA", "D5", "D3", "C5", "C4", "C3", "C2");
    const context: BiddingContext = {
      hand: h,
      auction: buildAuction(Seat.North, ["1NT", "X"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };

    const protocolResult = evaluateProtocol(staymanConfig.protocol!, context);
    const overlaid = applyProtocolOverlays(staymanConfig, context, protocolResult);

    expect(protocolResult.handResult.matched?.name).toBe("stayman-ask");
    expect(overlaid.handResult.matched?.name).toBe("stayman-penalty-redouble");
  });
});
