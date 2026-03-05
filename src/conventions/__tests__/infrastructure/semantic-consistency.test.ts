import { beforeEach, describe, expect, test } from "vitest";
import { Seat } from "../../../engine/types";
import { evaluateHand } from "../../../engine/hand-evaluator";
import { buildAuction } from "../../../engine/auction-helpers";
import { computeDialogueState } from "../../core/dialogue/dialogue-manager";
import { ForcingState } from "../../core/dialogue/dialogue-state";
import { clearRegistry, evaluateBiddingRules, registerConvention } from "../../core/registry";
import { staymanConfig } from "../../definitions/stayman";
import { bergenConfig } from "../../definitions/bergen-raises";
import { weakTwosConfig } from "../../definitions/weak-twos";
import { saycConfig } from "../../definitions/sayc";
import { hand, staymanOpener, staymanResponder } from "../fixtures";
import type { BiddingContext } from "../../core/types";

beforeEach(() => {
  clearRegistry();
  registerConvention(staymanConfig);
  registerConvention(bergenConfig);
  registerConvention(weakTwosConfig);
  registerConvention(saycConfig);
});

describe("semantic consistency harness", () => {
  test("Stayman 1NT-P: protocol and dialogue both identify nt-opening family", () => {
    const h = staymanResponder();
    const context: BiddingContext = {
      hand: h,
      auction: buildAuction(Seat.North, ["1NT", "P"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };

    const evaluated = evaluateBiddingRules(context, staymanConfig);
    expect(evaluated).not.toBeNull();
    expect(evaluated!.protocolResult?.activeRound?.name).toBe("nt-opening");

    const dialogue = computeDialogueState(
      context.auction,
      staymanConfig.transitionRules ?? [],
      staymanConfig.baselineRules,
    );
    expect(dialogue.familyId).toBe("1nt");
  });

  test("Stayman 1NT-P-2C-P: protocol round and forcing dialogue state align", () => {
    const h = staymanOpener();
    const context: BiddingContext = {
      hand: h,
      auction: buildAuction(Seat.North, ["1NT", "P", "2C", "P"]),
      seat: Seat.North,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };

    const evaluated = evaluateBiddingRules(context, staymanConfig);
    expect(evaluated).not.toBeNull();
    expect(evaluated!.protocolResult?.activeRound?.name).toBe("stayman-ask");

    const dialogue = computeDialogueState(
      context.auction,
      staymanConfig.transitionRules ?? [],
      staymanConfig.baselineRules,
    );
    expect(dialogue.familyId).toBe("1nt");
    expect(dialogue.forcingState).toBe(ForcingState.ForcingOneRound);
  });

  test("Bergen 1H-P-3C-P: protocol round and dialogue family align", () => {
    const h = hand(
      "SA", "SK", "S3",
      "HA", "HQ", "HJ", "H2", "H7",
      "DK", "D5", "D3",
      "C7", "C4",
    );
    const context: BiddingContext = {
      hand: h,
      auction: buildAuction(Seat.North, ["1H", "P", "3C", "P"]),
      seat: Seat.North,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };

    const evaluated = evaluateBiddingRules(context, bergenConfig);
    expect(evaluated).not.toBeNull();
    expect(evaluated!.protocolResult?.activeRound?.name).toBe("response");

    const dialogue = computeDialogueState(
      context.auction,
      bergenConfig.transitionRules ?? [],
      bergenConfig.baselineRules,
    );
    expect(dialogue.familyId).toBe("bergen");
  });

  test("Weak Twos 2H-P-2NT-P: protocol round and pending action align", () => {
    const h = hand(
      "S5", "S3", "S2",
      "HK", "HQ", "H9", "H7", "H5", "H3",
      "DQ", "C5", "C3", "C2",
    );
    const context: BiddingContext = {
      hand: h,
      auction: buildAuction(Seat.North, ["2H", "P", "2NT", "P"]),
      seat: Seat.North,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };

    const evaluated = evaluateBiddingRules(context, weakTwosConfig);
    expect(evaluated).not.toBeNull();
    expect(evaluated!.protocolResult?.activeRound?.name).toBe("ogust-rebid");

    const dialogue = computeDialogueState(
      context.auction,
      weakTwosConfig.transitionRules ?? [],
      weakTwosConfig.baselineRules,
    );
    expect(dialogue.familyId).toBe("weak-two");
  });

  test("SAYC opening: protocol and dialogue agree on SAYC family", () => {
    const h = hand("SA", "SK", "SQ", "S2", "HK", "H5", "H3", "DK", "D5", "D3", "C5", "C3", "C2");
    const context: BiddingContext = {
      hand: h,
      auction: buildAuction(Seat.South, []),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };

    const evaluated = evaluateBiddingRules(context, saycConfig);
    expect(evaluated).not.toBeNull();
    expect(evaluated!.protocolResult?.activeRound).not.toBeNull();

    const dialogue = computeDialogueState(
      buildAuction(Seat.North, ["1NT"]),
      saycConfig.transitionRules ?? [],
      saycConfig.baselineRules,
    );
    expect(dialogue.familyId).toBe("sayc-1nt");
  });
});
