/**
 * Stayman 2NT resolver tests.
 *
 * Verifies that resolvers produce correct bid levels for 2NT Stayman
 * (3-level bids) vs 1NT Stayman (2-level bids).
 */

import { describe, test, expect } from "vitest";
import { refDescribe } from "../../../test-support/tiers";
import { BidSuit, Seat } from "../../../engine/types";
import { buildAuction } from "../../../engine/auction-helpers";
import { resolveIntent } from "../../core/intent/intent-resolver";
import type { ResolverResult } from "../../core/intent/intent-resolver";
import { SemanticIntentType } from "../../core/intent/semantic-intent";
import type { SemanticIntent } from "../../core/intent/semantic-intent";
import { computeDialogueState } from "../../core/dialogue";
import { staymanTransitionRules } from "../../definitions/stayman/transitions";
import { baselineTransitionRules } from "../../core/dialogue";
import { staymanResolvers } from "../../definitions/stayman/resolvers";
import { hand } from "../fixtures";
import { evaluateHand } from "../../../engine/hand-evaluator";
import type { BiddingContext } from "../../core/types";

// Dummy context — resolvers only need DialogueState, not hand/auction
const dummyHand = hand("SA", "SK", "SQ", "SJ", "HA", "H5", "H3", "D5", "D3", "D2", "C5", "C3", "C2");
const dummyContext: BiddingContext = {
  hand: dummyHand,
  auction: { entries: [], isComplete: false },
  seat: Seat.South,
  evaluation: evaluateHand(dummyHand),
  opponentConventionIds: [],
};

const transitionRules = [...staymanTransitionRules, ...baselineTransitionRules];

function stateAfter(bids: string[], dealer: Seat = Seat.North): ReturnType<typeof computeDialogueState> {
  const auction = buildAuction(dealer, bids);
  return computeDialogueState(auction, transitionRules);
}

/** Extract the first resolved call from a ResolverResult. */
function expectResolvedCall(result: ResolverResult | null) {
  expect(result).not.toBeNull();
  expect(result!.status).toBe("resolved");
  if (result!.status !== "resolved") throw new Error("unreachable");
  return result!.calls[0]!.call;
}

refDescribe("[ref:bridgebum/stayman]", "Stayman 2NT resolvers", () => {
  test("askForMajor after 2NT → 3C (not 2C)", () => {
    const state = stateAfter(["2NT", "P"]);
    const intent: SemanticIntent = { type: SemanticIntentType.AskForMajor, params: {} };
    const resolved = resolveIntent(intent, state, dummyContext, staymanResolvers);
    expect(expectResolvedCall(resolved)).toEqual({ type: "bid", level: 3, strain: BidSuit.Clubs });
  });

  test("showHeldSuit (hearts) after 2NT → 3H (not 2H)", () => {
    const state = stateAfter(["2NT", "P", "3C", "P"]);
    const intent: SemanticIntent = { type: SemanticIntentType.ShowHeldSuit, params: { suit: "hearts" } };
    const resolved = resolveIntent(intent, state, dummyContext, staymanResolvers);
    expect(expectResolvedCall(resolved)).toEqual({ type: "bid", level: 3, strain: BidSuit.Hearts });
  });

  test("showHeldSuit (spades) after 2NT → 3S (not 2S)", () => {
    const state = stateAfter(["2NT", "P", "3C", "P"]);
    const intent: SemanticIntent = { type: SemanticIntentType.ShowHeldSuit, params: { suit: "spades" } };
    const resolved = resolveIntent(intent, state, dummyContext, staymanResolvers);
    expect(expectResolvedCall(resolved)).toEqual({ type: "bid", level: 3, strain: BidSuit.Spades });
  });

  test("denyHeldSuit after 2NT → 3D (not 2D)", () => {
    const state = stateAfter(["2NT", "P", "3C", "P"]);
    const intent: SemanticIntent = { type: SemanticIntentType.DenyHeldSuit, params: {} };
    const resolved = resolveIntent(intent, state, dummyContext, staymanResolvers);
    expect(expectResolvedCall(resolved)).toEqual({ type: "bid", level: 3, strain: BidSuit.Diamonds });
  });

  test("askForMajor after 1NT → still 2C (regression)", () => {
    const state = stateAfter(["1NT", "P"]);
    const intent: SemanticIntent = { type: SemanticIntentType.AskForMajor, params: {} };
    const resolved = resolveIntent(intent, state, dummyContext, staymanResolvers);
    expect(expectResolvedCall(resolved)).toEqual({ type: "bid", level: 2, strain: BidSuit.Clubs });
  });

  test("showHeldSuit (hearts) after 1NT → still 2H (regression)", () => {
    const state = stateAfter(["1NT", "P", "2C", "P"]);
    const intent: SemanticIntent = { type: SemanticIntentType.ShowHeldSuit, params: { suit: "hearts" } };
    const resolved = resolveIntent(intent, state, dummyContext, staymanResolvers);
    expect(expectResolvedCall(resolved)).toEqual({ type: "bid", level: 2, strain: BidSuit.Hearts });
  });

  test("denyHeldSuit after 1NT → still 2D (regression)", () => {
    const state = stateAfter(["1NT", "P", "2C", "P"]);
    const intent: SemanticIntent = { type: SemanticIntentType.DenyHeldSuit, params: {} };
    const resolved = resolveIntent(intent, state, dummyContext, staymanResolvers);
    expect(expectResolvedCall(resolved)).toEqual({ type: "bid", level: 2, strain: BidSuit.Diamonds });
  });
});
