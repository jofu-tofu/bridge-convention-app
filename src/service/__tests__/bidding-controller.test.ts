/**
 * Bidding controller tests — pure logic extracted from bidding.svelte.ts.
 */
import { describe, it, expect } from "vitest";
import { BidSuit, Seat } from "../../engine/types";
import type { Call } from "../../engine/types";
import { createStubEngine } from "../../test-support/engine-stub";
import type { ConventionBiddingStrategy, BidResult } from "../../core/contracts";
import { makeDrillSession, makeSimpleTestDeal } from "../../test-support/fixtures";
import { createInferenceCoordinator } from "../../inference/inference-coordinator";
import { SessionState } from "../session-state";
import { processBid, runInitialAiBids, initializeAuction } from "../bidding-controller";
import type { DrillBundle } from "../../bootstrap/types";

/** Strategy that always suggests 2C. */
function make2CStrategy(): ConventionBiddingStrategy {
  return {
    id: "test-strategy",
    name: "Test Convention",
    getLastEvaluation() { return null; },
    suggest(): BidResult {
      return {
        call: { type: "bid", level: 2, strain: BidSuit.Clubs },
        ruleName: "stayman-ask",
        explanation: "Bid 2C to ask for a 4-card major",
      };
    },
  };
}

/** Strategy that never applies (returns null → correct bid is pass). */
function makeNoOpStrategy(): ConventionBiddingStrategy {
  return {
    id: "noop",
    name: "No-Op",
    getLastEvaluation() { return null; },
    suggest(): null { return null; },
  };
}

function makeBundle(overrides: Partial<DrillBundle> = {}): DrillBundle {
  return {
    deal: makeSimpleTestDeal(),
    session: makeDrillSession(),
    nsInferenceEngine: null,
    ewInferenceEngine: null,
    ...overrides,
  };
}

function makeState(overrides: Partial<DrillBundle> = {}): SessionState {
  const bundle = makeBundle(overrides);
  const coordinator = createInferenceCoordinator();
  return new SessionState(bundle, coordinator);
}

describe("bidding controller", () => {
  it("processBid with correct call returns accepted: true", async () => {
    const engine = createStubEngine({ async isAuctionComplete() { return false; } });
    const state = makeState({ strategy: make2CStrategy() });

    // Run initial AI bids to get to user's turn
    await runInitialAiBids(state, engine);

    const correctCall: Call = { type: "bid", level: 2, strain: BidSuit.Clubs };
    const result = await processBid(state, correctCall, engine);

    expect(result.accepted).toBe(true);
  });

  it("processBid with wrong call returns accepted: false + feedback", async () => {
    const engine = createStubEngine({ async isAuctionComplete() { return false; } });
    const state = makeState({ strategy: make2CStrategy() });

    await runInitialAiBids(state, engine);

    const wrongCall: Call = { type: "pass" };
    const result = await processBid(state, wrongCall, engine);

    expect(result.accepted).toBe(false);
    expect(result.feedback).not.toBeNull();
    expect(result.viewportFeedback).not.toBeNull();
  });

  it("processBid with correct call includes AI bids in aiBids list", async () => {
    const engine = createStubEngine({ async isAuctionComplete() { return false; } });
    const state = makeState({ strategy: make2CStrategy() });

    await runInitialAiBids(state, engine);

    const correctCall: Call = { type: "bid", level: 2, strain: BidSuit.Clubs };
    const result = await processBid(state, correctCall, engine);

    expect(result.accepted).toBe(true);
    // 3 AI seats should have bid (N, E, W pass)
    expect(result.aiBids.length).toBeGreaterThan(0);
  });

  it("processBid returns phaseTransition when auction completes", async () => {
    let callCount = 0;
    const engine = createStubEngine({
      async isAuctionComplete() {
        callCount++;
        // Complete after user's bid (the 3rd call: N bid, E bid, then user bid)
        return callCount >= 3;
      },
      async getContract() { return null; }, // passout
    });
    const state = makeState({ strategy: make2CStrategy() });

    // Run initial AI bids (N, E bid, then user's turn)
    await runInitialAiBids(state, engine);

    const correctCall: Call = { type: "bid", level: 2, strain: BidSuit.Clubs };
    const result = await processBid(state, correctCall, engine);

    expect(result.accepted).toBe(true);
    expect(result.auctionComplete).toBe(true);
    expect(result.phaseTransition).not.toBeNull();
    expect(result.phaseTransition!.to).toBe("EXPLANATION");
  });

  it("processBid with null strategy accepts any bid", async () => {
    const engine = createStubEngine({ async isAuctionComplete() { return false; } });
    const state = makeState(); // no strategy

    await runInitialAiBids(state, engine);

    const anyCall: Call = { type: "pass" };
    const result = await processBid(state, anyCall, engine);

    expect(result.accepted).toBe(true);
    expect(result.feedback).toBeNull();
  });

  it("processBid with convention-exhausted (null suggest) expects Pass", async () => {
    const engine = createStubEngine({ async isAuctionComplete() { return false; } });
    const state = makeState({ strategy: makeNoOpStrategy() });

    await runInitialAiBids(state, engine);

    // Pass should be accepted
    const passResult = await processBid(state, { type: "pass" }, engine);
    expect(passResult.accepted).toBe(true);
  });

  it("processBid with convention-exhausted rejects non-pass", async () => {
    const engine = createStubEngine({ async isAuctionComplete() { return false; } });
    const state = makeState({ strategy: makeNoOpStrategy() });

    await runInitialAiBids(state, engine);

    // Non-pass should be rejected
    const bidResult = await processBid(state, { type: "bid", level: 1, strain: BidSuit.Clubs }, engine);
    expect(bidResult.accepted).toBe(false);
  });

  it("AI bids stop at user's next turn", async () => {
    const engine = createStubEngine({ async isAuctionComplete() { return false; } });
    const state = makeState({ strategy: make2CStrategy() });

    await runInitialAiBids(state, engine);

    const correctCall: Call = { type: "bid", level: 2, strain: BidSuit.Clubs };
    const result = await processBid(state, correctCall, engine);

    // After user's bid, 3 AI bids should run (N, E, W), then stop at user (S)
    expect(result.aiBids.length).toBe(3);
    for (const ai of result.aiBids) {
      expect(ai.seat).not.toBe(Seat.South);
    }
  });

  it("processBid calls processBid on state for each bid (user + AI)", async () => {
    const engine = createStubEngine({ async isAuctionComplete() { return false; } });
    const state = makeState({ strategy: make2CStrategy() });

    await runInitialAiBids(state, engine);
    const entriesBefore = state.auction.entries.length;

    const correctCall: Call = { type: "bid", level: 2, strain: BidSuit.Clubs };
    await processBid(state, correctCall, engine);

    // User's bid + 3 AI bids = 4 new entries
    expect(state.auction.entries.length).toBe(entriesBefore + 4);
  });

  it("runInitialAiBids runs bids before user turn", async () => {
    const engine = createStubEngine({ async isAuctionComplete() { return false; } });
    const state = makeState(); // dealer is North, user is South

    const result = await runInitialAiBids(state, engine);

    // N, E should have bid (all pass), then stop at S (user) — bridge order is N→E→S→W
    expect(result.aiBids.length).toBe(2);
    expect(result.auctionComplete).toBe(false);
    expect(state.legalCalls.length).toBeGreaterThan(0);
  });

  it("initializeAuction replays entries into bidHistory", () => {
    const state = makeState({ strategy: make2CStrategy() });
    const initialAuction = {
      entries: [
        { seat: Seat.North, call: { type: "bid" as const, level: 1 as const, strain: BidSuit.NoTrump } },
      ],
      isComplete: false,
    };

    initializeAuction(state, initialAuction);

    expect(state.bidHistory.length).toBe(1);
    expect(state.bidHistory[0]!.call).toEqual({ type: "bid", level: 1, strain: BidSuit.NoTrump });
    expect(state.bidHistory[0]!.isUser).toBe(false);
  });

  it("no svelte imports in bidding-controller", async () => {
    const { readFileSync } = await import("fs");
    const content = readFileSync("src/service/bidding-controller.ts", "utf-8");
    expect(content).not.toContain("from \"svelte\"");
    expect(content).not.toContain("from 'svelte'");
    // Verify no actual tick() calls (comments are OK)
    const codeLines = content.split("\n").filter(l => !l.trimStart().startsWith("*") && !l.trimStart().startsWith("//"));
    const codeOnly = codeLines.join("\n");
    expect(codeOnly).not.toMatch(/\btick\s*\(/);
  });
});
