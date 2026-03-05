/**
 * Inference regression harness — captures current produceAnnotation() → applyAnnotation() outputs.
 * Documents the known limitation: convention inference returns empty via hollow adapter.
 * Phase 1a can prove equivalence or improvement against this baseline.
 */
import { describe, test, expect, beforeEach } from "vitest";
import { Seat, BidSuit } from "../../engine/types";
import type { AuctionEntry, Auction } from "../../engine/types";
import { registerConvention, clearRegistry } from "../../conventions/core/registry";
import { staymanConfig } from "../../conventions/definitions/stayman";
import { saycConfig } from "../../conventions/definitions/sayc";
import { createInitialBeliefState, applyAnnotation } from "../belief-accumulator";
import { produceAnnotation } from "../annotation-producer";
import { protocolInferenceExtractor } from "../protocol-inference-extractor";
import { createNaturalInferenceProvider } from "../natural-inference";
import type { BiddingRuleResult } from "../../conventions/core/registry";
import type { PublicBeliefState } from "../types";

beforeEach(() => {
  clearRegistry();
  registerConvention(staymanConfig);
  registerConvention(saycConfig);
});

const naturalProvider = createNaturalInferenceProvider();

/** Simulate the hollow adapter currently used in game.svelte.ts */
function toBiddingRuleResultLike(call: AuctionEntry["call"], ruleName: string): BiddingRuleResult {
  return {
    call,
    rule: ruleName,
    explanation: "test",
    meaning: "test",
    // No protocolResult, no treeEvalResult — convention inference extraction returns empty
  } as unknown as BiddingRuleResult;
}

function processAuction(entries: AuctionEntry[]): PublicBeliefState {
  let state = createInitialBeliefState();
  const entriesSoFar: AuctionEntry[] = [];

  for (const entry of entries) {
    const auctionBefore: Auction = { entries: [...entriesSoFar], isComplete: false };
    const ruleResult = entry.call.type === "bid"
      ? toBiddingRuleResultLike(entry.call, "test-rule")
      : null;
    const annotation = produceAnnotation(
      entry,
      ruleResult,
      ruleResult ? "stayman" : null,
      protocolInferenceExtractor,
      naturalProvider,
      auctionBefore,
    );
    state = applyAnnotation(state, annotation);
    entriesSoFar.push(entry);
  }
  return state;
}

describe("Inference regression: baseline behavior with hollow adapter", () => {
  test("1NT opening via convention produces empty inferences (hollow adapter)", () => {
    const entries: AuctionEntry[] = [
      { seat: Seat.North, call: { type: "bid", level: 1, strain: BidSuit.NoTrump } },
    ];
    const state = processAuction(entries);

    // Convention bid through hollow adapter → extractor reads no tree data → empty inferences
    // Natural inference won't fire because we passed a ruleResult
    const northInferences = state.beliefs[Seat.North].inferences;
    expect(northInferences).toHaveLength(0);
  });

  test("natural 1H bid produces natural inferences", () => {
    const entries: AuctionEntry[] = [
      { seat: Seat.North, call: { type: "bid", level: 1, strain: BidSuit.Hearts } },
    ];
    // Process as natural bid (null ruleResult)
    let state = createInitialBeliefState();
    const auctionBefore: Auction = { entries: [], isComplete: false };
    const annotation = produceAnnotation(
      entries[0]!,
      null, // no convention match → natural path
      null,
      protocolInferenceExtractor,
      naturalProvider,
      auctionBefore,
    );
    state = applyAnnotation(state, annotation);

    // Natural inference should produce something for a 1H bid
    const northInferences = state.beliefs[Seat.North].inferences;
    expect(northInferences.length).toBeGreaterThan(0);
  });

  test("pass produces empty inferences", () => {
    const entries: AuctionEntry[] = [
      { seat: Seat.North, call: { type: "pass" } },
    ];
    const state = processAuction(entries);
    expect(state.beliefs[Seat.North].inferences).toHaveLength(0);
  });

  test("Stayman auction: convention bids all produce empty inferences (known limitation)", () => {
    // 1NT - P - 2C - P
    const entries: AuctionEntry[] = [
      { seat: Seat.North, call: { type: "bid", level: 1, strain: BidSuit.NoTrump } },
      { seat: Seat.East, call: { type: "pass" } },
      { seat: Seat.South, call: { type: "bid", level: 2, strain: BidSuit.Clubs } },
      { seat: Seat.West, call: { type: "pass" } },
    ];
    const state = processAuction(entries);

    // All convention bids through hollow adapter → empty
    expect(state.beliefs[Seat.North].inferences).toHaveLength(0);
    expect(state.beliefs[Seat.South].inferences).toHaveLength(0);
    // Passes → empty
    expect(state.beliefs[Seat.East].inferences).toHaveLength(0);
    expect(state.beliefs[Seat.West].inferences).toHaveLength(0);
  });
});
