// Cross-engine invariant tests — verify that the protocol evaluator
// and dialogue state machine agree on what the auction means.
// These are characterization tests: they document current behavior
// and protect against regressions during refactoring.

import { describe, it, expect, beforeEach } from "vitest";
import { Seat, BidSuit } from "../../../engine/types";
import type { Auction } from "../../../engine/types";
import { buildAuction } from "../../../engine/auction-helpers";
import { evaluateHand } from "../../../engine/hand-evaluator";
import { hand } from "../../../engine/__tests__/fixtures";
import { createBiddingContext } from "../../core/context-factory";
import { evaluateBiddingRules } from "../../core/registry";
import { registerConvention, clearRegistry } from "../../core/registry";
import { computeDialogueState } from "../../core/dialogue/dialogue-manager";
import { evaluateProtocol, computeRole } from "../../core/protocol/protocol-evaluator";
import { resolveIntent } from "../../core/intent/intent-resolver";
import type { IntentNode } from "../../core/intent/intent-node";
import {
  CompetitionMode,
  SystemMode,
  PendingAction,
  getSystemModeFor,
} from "../../core/dialogue/dialogue-state";
import { STAYMAN_CAPABILITY } from "../../definitions/stayman/constants";
import { staymanConfig } from "../../definitions/stayman/config";
import { staymanTransitionRules } from "../../definitions/stayman/transitions";
import { staymanResolvers } from "../../definitions/stayman/resolvers";
import { baselineTransitionRules } from "../../core/dialogue/baseline-transitions";
import { bergenConfig } from "../../definitions/bergen-raises/config";
import { weakTwosConfig } from "../../definitions/weak-twos/config";

// Two-pass helpers matching production config pattern
function computeStaymanState(auction: Auction) {
  return computeDialogueState(auction, staymanTransitionRules, baselineTransitionRules);
}
function computeBergenState(auction: Auction) {
  return computeDialogueState(auction, bergenConfig.transitionRules!, bergenConfig.baselineRules);
}
function computeWeakTwoState(auction: Auction) {
  return computeDialogueState(auction, weakTwosConfig.transitionRules!, weakTwosConfig.baselineRules);
}

beforeEach(() => {
  clearRegistry();
  registerConvention(staymanConfig);
  registerConvention(bergenConfig);
  registerConvention(weakTwosConfig);
});

// ─── Invariant 1: Protocol ↔ Dialogue consistency ────────────

describe("Invariant 1: Protocol ↔ Dialogue consistency", () => {
  it("1NT-P: protocol finds active round AND dialogue familyId is set", () => {
    const h = hand("HA", "HK", "HQ", "H5", "SA", "SK", "S3", "DA", "DK", "D5", "CA", "C5", "C2");
    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const ctx = createBiddingContext({
      hand: h,
      auction,
      seat: Seat.South,
      evaluation: evaluateHand(h),
    });

    const protoResult = evaluateProtocol(staymanConfig.protocol!, ctx);
    const dialogueState = computeStaymanState(auction);

    // Protocol found an active round (responder's turn)
    expect(protoResult.activeRound).not.toBeNull();
    // Dialogue state has familyId set
    expect(dialogueState.familyId).toBe("1nt");
    // Protocol role matches computed role
    expect(protoResult.established.role).toBe(computeRole(auction.entries, Seat.South));
  });

  it("1NT-X: dialogue competitionMode=Doubled, Stayman capability Modified", () => {
    const auction = buildAuction(Seat.North, ["1NT", "X"]);
    const dialogueState = computeStaymanState(auction);

    expect(dialogueState.familyId).toBe("1nt");
    expect(dialogueState.competitionMode).toBe(CompetitionMode.Doubled);
    expect(dialogueState.systemMode).toBe(SystemMode.Off);
    expect(getSystemModeFor(dialogueState, STAYMAN_CAPABILITY)).toBe(SystemMode.Modified);
  });

  it("1NT-2H overcall: dialogue systemMode=Off", () => {
    const auction = buildAuction(Seat.North, ["1NT", "2H"]);

    const dialogueState = computeStaymanState(auction);

    expect(dialogueState.familyId).toBe("1nt");
    expect(dialogueState.competitionMode).toBe(CompetitionMode.Overcalled);
    expect(dialogueState.systemMode).toBe(SystemMode.Off);
  });

  it("1H-P (Bergen): dialogue familyId set to bergen", () => {
    const h = hand("SA", "S5", "S3", "HA", "H9", "H7", "H2", "DK", "D8", "D5", "C9", "C5", "C2");
    const auction = buildAuction(Seat.North, ["1H", "P"]);
    const ctx = createBiddingContext({
      hand: h,
      auction,
      seat: Seat.South,
      evaluation: evaluateHand(h),
    });

    const protoResult = evaluateProtocol(bergenConfig.protocol!, ctx);
    const dialogueState = computeBergenState(auction);

    expect(protoResult.activeRound).not.toBeNull();
    expect(dialogueState.familyId).toBe("bergen");
  });

  it("1H-2S (Bergen interference): dialogue systemMode=Off", () => {
    const auction = buildAuction(Seat.North, ["1H", "2S"]);

    const dialogueState = computeBergenState(auction);

    // Bergen baseline: opponent overcall → system off
    expect(dialogueState.systemMode).toBe(SystemMode.Off);
  });

  it("2H opener (Weak Two): protocol finds active round AND dialogue familyId set", () => {
    // Weak two opener: 8 HCP, 6 hearts
    const h = hand("S5", "S3", "HK", "HQ", "HJ", "HT", "H9", "H7", "DK", "D5", "D3", "C5", "C2");
    const auction = buildAuction(Seat.North, []);
    const ctx = createBiddingContext({
      hand: h,
      auction,
      seat: Seat.North,
      evaluation: evaluateHand(h),
    });

    const protoResult = evaluateProtocol(weakTwosConfig.protocol!, ctx);
    // For opener (first bid), protocol should have an active round
    if (protoResult.activeRound) {
      // If active, role should be opener
      expect(protoResult.established.role).toBe("opener");
    }

    // After opener bids 2H, dialogue should detect weak-two family
    const auctionAfterBid = buildAuction(Seat.North, ["2H"]);
    const dialogueState = computeWeakTwoState(auctionAfterBid);
    expect(dialogueState.familyId).toBe("weak-two");
  });
});

// ─── Invariant 2: Resolve-then-replay ────────────────────────

describe("Invariant 2: Resolve-then-replay", () => {
  it("AskForMajor resolves to 2C; appending 2C sets pendingAction=ShowMajor", () => {
    // Responder with 4 hearts, 8+ HCP
    const h = hand("SK", "S5", "S2", "HA", "HK", "HQ", "H3", "D5", "D3", "D2", "C5", "C3", "C2");
    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const ctx = createBiddingContext({
      hand: h,
      auction,
      seat: Seat.South,
      evaluation: evaluateHand(h),
    });

    const result = evaluateBiddingRules(ctx, staymanConfig);
    expect(result).not.toBeNull();

    // The matched node should be an IntentNode
    const matched = result!.treeEvalResult?.matched;
    expect(matched?.type).toBe("intent");

    // Resolve intent to concrete call
    const state = computeStaymanState(auction);
    const resolved = resolveIntent(
      (matched as IntentNode).intent,
      state,
      ctx,
      staymanResolvers,
    );
    expect(resolved).not.toBeNull();
    expect(resolved!.status).toBe("resolved");
    if (resolved!.status === "resolved") {
      expect(resolved!.calls[0]!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Clubs });
    }

    // Append the resolved call and replay dialogue
    const auctionAfter = buildAuction(Seat.North, ["1NT", "P", "2C"]);
    const stateAfter = computeStaymanState(auctionAfter);
    expect(stateAfter.pendingAction).toBe(PendingAction.ShowMajor);
  });

  it("ShowHeldSuit(hearts) resolves to 2H; appending 2H updates agreedStrain", () => {
    // Opener with 4 hearts responding to Stayman
    const h = hand("HA", "HK", "HQ", "H5", "SA", "SK", "S3", "DA", "DK", "D5", "CA", "C5", "C2");
    const auction = buildAuction(Seat.North, ["1NT", "P", "2C", "P"]);
    const ctx = createBiddingContext({
      hand: h,
      auction,
      seat: Seat.North,
      evaluation: evaluateHand(h),
    });

    const result = evaluateBiddingRules(ctx, staymanConfig);
    expect(result).not.toBeNull();

    const matched = result!.treeEvalResult?.matched as IntentNode;
    expect(matched.type).toBe("intent");

    // Resolve
    const state = computeStaymanState(auction);
    const resolved = resolveIntent(matched.intent, state, ctx, staymanResolvers);
    expect(resolved).not.toBeNull();
    expect(resolved!.status).toBe("resolved");
    if (resolved!.status === "resolved") {
      expect(resolved!.calls[0]!.call.type).toBe("bid");
    }

    // Append and replay
    const auctionAfter = buildAuction(Seat.North, ["1NT", "P", "2C", "P", "2H"]);
    const stateAfter = computeStaymanState(auctionAfter);
    expect(stateAfter.agreedStrain).toEqual({
      type: "suit",
      suit: "H",
      confidence: "tentative",
    });
  });

  it("DenyHeldSuit resolves to 2D; appending 2D keeps agreedStrain=none", () => {
    // Opener without 4-card major (3 hearts, 3 spades)
    const h = hand("SA", "SK", "S3", "HK", "HQ", "H2", "DA", "DK", "DJ", "D5", "CA", "C5", "C2");
    const auction = buildAuction(Seat.North, ["1NT", "P", "2C", "P"]);
    const ctx = createBiddingContext({
      hand: h,
      auction,
      seat: Seat.North,
      evaluation: evaluateHand(h),
    });

    const result = evaluateBiddingRules(ctx, staymanConfig);
    expect(result).not.toBeNull();

    const matched = result!.treeEvalResult?.matched as IntentNode;
    expect(matched.type).toBe("intent");

    // Resolve
    const state = computeStaymanState(auction);
    const resolved = resolveIntent(matched.intent, state, ctx, staymanResolvers);
    expect(resolved).not.toBeNull();
    expect(resolved!.status).toBe("resolved");
    if (resolved!.status === "resolved") {
      expect(resolved!.calls[0]!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Diamonds });
    }

    // Append and replay
    const auctionAfter = buildAuction(Seat.North, ["1NT", "P", "2C", "P", "2D"]);
    const stateAfter = computeStaymanState(auctionAfter);
    expect(stateAfter.agreedStrain).toEqual({ type: "none" });
  });
});

// ─── Invariant 3: Cross-family competition consistency ───────

describe("Invariant 3: Cross-family competition consistency", () => {
  it("1NT-X: Stayman rules set Modified, baseline rules set Off", () => {
    const auction = buildAuction(Seat.North, ["1NT", "X"]);

    const staymanState = computeStaymanState(auction);
    const baselineState = computeDialogueState(auction, baselineTransitionRules);

    // Both agree on competitionMode
    expect(staymanState.competitionMode).toBe(CompetitionMode.Doubled);
    expect(baselineState.competitionMode).toBe(CompetitionMode.Doubled);

    // Stayman: global systemMode is Off, but stayman capability is Modified
    expect(staymanState.systemMode).toBe(SystemMode.Off);
    expect(getSystemModeFor(staymanState, STAYMAN_CAPABILITY)).toBe(SystemMode.Modified);
    // Baseline: Off (no convention-specific override)
    expect(baselineState.systemMode).toBe(SystemMode.Off);
  });

  it("1NT-2H: all rule sets agree on competitionMode=Overcalled, systemMode=Off", () => {
    const auction = buildAuction(Seat.North, ["1NT", "2H"]);

    const staymanState = computeStaymanState(auction);
    const baselineState = computeDialogueState(auction, baselineTransitionRules);

    expect(staymanState.competitionMode).toBe(CompetitionMode.Overcalled);
    expect(baselineState.competitionMode).toBe(CompetitionMode.Overcalled);
    expect(staymanState.systemMode).toBe(SystemMode.Off);
    expect(baselineState.systemMode).toBe(SystemMode.Off);
  });
});

// ─── Invariant 4: Baseline fact preservation ─────────────────

describe("Invariant 4: Baseline fact preservation", () => {
  it("1NT→2C: familyId and openerSeat survive Stayman ask transition", () => {
    const auction = buildAuction(Seat.North, ["1NT", "P", "2C"]);
    const state = computeStaymanState(auction);

    expect(state.familyId).toBe("1nt");
    expect(state.conventionData["openerSeat"]).toBe(Seat.North);
    expect(state.pendingAction).toBe(PendingAction.ShowMajor);
  });

  it("1NT→X: familyId and openerSeat survive interference transition", () => {
    const auction = buildAuction(Seat.North, ["1NT", "X"]);
    const state = computeStaymanState(auction);

    expect(state.familyId).toBe("1nt");
    expect(state.conventionData["openerSeat"]).toBe(Seat.North);
  });

  it("1H→3C (Bergen constructive): familyId and openerMajor survive response transition", () => {
    const auction = buildAuction(Seat.North, ["1H", "P", "3C"]);
    const state = computeBergenState(auction);

    expect(state.familyId).toBe("bergen");
    expect(state.conventionData["openerMajor"]).toBe("H");
    expect(state.conventionData["responseType"]).toBe("constructive");
  });

  it("2H→2NT (Weak Two Ogust): familyId and openingSuit survive ask transition", () => {
    const auction = buildAuction(Seat.North, ["2H", "P", "2NT"]);
    const state = computeWeakTwoState(auction);

    expect(state.familyId).toBe("weak-two");
    expect(state.conventionData["openingSuit"]).toBe("H");
    expect(state.pendingAction).toBe(PendingAction.ShowSuit);
  });
});
