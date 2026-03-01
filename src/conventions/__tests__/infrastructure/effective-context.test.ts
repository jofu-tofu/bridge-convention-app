import { describe, it, expect, beforeEach } from "vitest";
import { Seat } from "../../../engine/types";
import { evaluateHand } from "../../../engine/hand-evaluator";
import { buildAuction } from "../../../engine/auction-helpers";
import { staymanResponder, staymanOpener } from "../fixtures";
import type { BiddingContext } from "../../core/types";
import { buildEffectiveContext } from "../../core/effective-context";
import { evaluateProtocol } from "../../core/protocol-evaluator";
import { staymanConfig } from "../../definitions/stayman";
import { registerConvention, clearRegistry } from "../../core/registry";
import { SystemMode } from "../../core/dialogue/dialogue-state";

beforeEach(() => {
  clearRegistry();
  registerConvention(staymanConfig);
});

describe("buildEffectiveContext", () => {
  it("produces correct dialogueState for Stayman 1NT-P-2C auction", () => {
    // Opener's perspective after 1NT-P-2C-P (opener responds to Stayman)
    const h = staymanOpener();
    const context: BiddingContext = {
      hand: h,
      auction: buildAuction(Seat.North, ["1NT", "P", "2C", "P"]),
      seat: Seat.North,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };
    const protoResult = evaluateProtocol(staymanConfig.protocol!, context);
    const effective = buildEffectiveContext(context, staymanConfig, protoResult);

    // Stayman transitions set familyId to "1nt" on 1NT opening
    expect(effective.dialogueState.familyId).toBe("1nt");
    expect(effective.dialogueState.systemMode).not.toBe(SystemMode.Off);
  });

  it("falls back to baseline transitions when config has no transitionRules", () => {
    // Build a minimal config with no transitionRules
    const h = staymanResponder();
    const context: BiddingContext = {
      hand: h,
      auction: buildAuction(Seat.North, ["1NT", "P"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };
    const protoResult = evaluateProtocol(staymanConfig.protocol!, context);

    // Create a config clone without transitionRules
    const configNoRules = { ...staymanConfig, transitionRules: undefined };
    const effective = buildEffectiveContext(context, configNoRules, protoResult);

    // Baseline transitions still detect 1NT opening
    expect(effective.dialogueState.familyId).toBe("1nt");
  });

  it("preserves raw BiddingContext identity", () => {
    const h = staymanResponder();
    const context: BiddingContext = {
      hand: h,
      auction: buildAuction(Seat.North, ["1NT", "P"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };
    const protoResult = evaluateProtocol(staymanConfig.protocol!, context);
    const effective = buildEffectiveContext(context, staymanConfig, protoResult);

    expect(effective.raw).toBe(context);
  });

  it("preserves config and protocolResult references", () => {
    const h = staymanResponder();
    const context: BiddingContext = {
      hand: h,
      auction: buildAuction(Seat.North, ["1NT", "P"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };
    const protoResult = evaluateProtocol(staymanConfig.protocol!, context);
    const effective = buildEffectiveContext(context, staymanConfig, protoResult);

    expect(effective.config).toBe(staymanConfig);
    expect(effective.protocolResult).toBe(protoResult);
  });

  it("protocolResult.established is always present", () => {
    const h = staymanResponder();
    const context: BiddingContext = {
      hand: h,
      auction: buildAuction(Seat.North, ["1NT", "P"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };
    const protoResult = evaluateProtocol(staymanConfig.protocol!, context);
    const effective = buildEffectiveContext(context, staymanConfig, protoResult);

    expect(effective.protocolResult.established).toBeDefined();
    expect(effective.protocolResult.established.role).toBeDefined();
  });
});
