import { describe, it, expect } from "vitest";
import { Seat } from "../../../engine/types";
import { evaluateHand } from "../../../engine/hand-evaluator";
import { buildAuction } from "../../../engine/auction-helpers";
import { staymanResponder, staymanOpener } from "../fixtures";
import type { BiddingContext } from "../../core/types";
import { buildEffectiveContext } from "../../core/pipeline/effective-context";
import { evaluateProtocol } from "../../core/protocol/protocol-evaluator";
import { staymanConfig } from "../../definitions/stayman";
import { InterferenceKind, SystemMode } from "../../core/dialogue/dialogue-state";
import { ConventionCategory } from "../../core/types";
import type { ConventionConfig } from "../../core/types";

describe("buildEffectiveContext", () => {
  it("uses injected lookup and works without registry setup", () => {
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
    const protoResult = evaluateProtocol(staymanConfig.protocol!, context);
    const effective = buildEffectiveContext(context, staymanConfig, protoResult, undefined, localLookup);

    expect(effective.dialogueState.interferenceDetail).toBeDefined();
    expect(effective.dialogueState.interferenceDetail!.kind).toBe(InterferenceKind.TakeoutDouble);
    expect(effective.dialogueState.interferenceDetail!.isNatural).toBe(false);
  });

  it("propagates errors from injected lookup for missing IDs", () => {
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
    const protoResult = evaluateProtocol(staymanConfig.protocol!, context);

    expect(() =>
      buildEffectiveContext(context, staymanConfig, protoResult, undefined, throwingLookup))
      .toThrowError("injected lookup failed: missing-injected");
  });

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

  it("classifies interference from registered opponent convention signatures", () => {
    const opponentConvention: ConventionConfig = {
      id: "opponent-test-signatures",
      name: "Opponent Test Signatures",
      description: "Synthetic opponent convention for interference classification",
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
      opponentConventionIds: ["opponent-test-signatures"],
    };
    const protoResult = evaluateProtocol(staymanConfig.protocol!, context);
    const effective = buildEffectiveContext(context, staymanConfig, protoResult, undefined, localLookup);

    expect(effective.dialogueState.interferenceDetail).toBeDefined();
    expect(effective.dialogueState.interferenceDetail!.kind).toBe(InterferenceKind.TakeoutDouble);
    expect(effective.dialogueState.interferenceDetail!.isNatural).toBe(false);
  });

  it("no-op classification when opponentConventionIds is empty", () => {
    const h = staymanResponder();
    const context: BiddingContext = {
      hand: h,
      auction: buildAuction(Seat.North, ["1NT", "X"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };
    const protoResult = evaluateProtocol(staymanConfig.protocol!, context);
    const effective = buildEffectiveContext(context, staymanConfig, protoResult);

    expect(effective.dialogueState.interferenceDetail).toBeDefined();
    expect(effective.dialogueState.interferenceDetail!.kind).toBe(InterferenceKind.Unknown);
    expect(effective.dialogueState.interferenceDetail!.isNatural).toBe(true);
  });
});
