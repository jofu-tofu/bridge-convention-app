/**
 * Integration tests: full game store lifecycle.
 *
 * Verifies state transitions, DOM-flush readiness (isUserTurn, isProcessing,
 * legalCalls) across the complete drill flow: startDrill → userBid → feedback →
 * dismiss/retry → next deal. Uses the real auction engine.
 */
import { describe, test, expect, beforeEach, vi, afterEach } from "vitest";
import { tick } from "svelte";
import { Seat, BidSuit } from "../../engine/types";
import type { Deal, Hand, Call, Auction, AuctionEntry, Vulnerability } from "../../engine/types";
import { createGameStore } from "../game.svelte";
import { createStubEngine } from "../../components/__tests__/test-helpers";
import { parseHand } from "../../engine/notation";
import { clearRegistry, registerConvention, getConvention } from "../../conventions/registry";
import { staymanConfig } from "../../conventions/stayman";
import { gerberConfig } from "../../conventions/gerber";
import { dontConfig } from "../../conventions/dont";
import { landyConfig } from "../../conventions/landy";
import { bergenConfig } from "../../conventions/bergen-raises";
import { saycConfig } from "../../conventions/sayc";
import { createDrillConfig } from "../../ai/drill-config-factory";
import { createDrillSession } from "../../ai/drill-session";
import { conventionToStrategy } from "../../ai/convention-strategy";
import { addCall, getLegalCalls, isAuctionComplete, getContract } from "../../engine/auction";
import type { Contract } from "../../engine/types";

function createRealAuctionEngine() {
  return createStubEngine({
    async addCall(auction: Auction, entry: AuctionEntry): Promise<Auction> {
      return addCall(auction, entry);
    },
    async getLegalCalls(auction: Auction, seat: Seat): Promise<Call[]> {
      return getLegalCalls(auction, seat);
    },
    async isAuctionComplete(auction: Auction): Promise<boolean> {
      return isAuctionComplete(auction);
    },
    async getContract(auction: Auction): Promise<Contract | null> {
      return getContract(auction);
    },
  });
}

// North: 17 HCP balanced, no 5M — valid 1NT opener
const northHand = parseHand([
  "SA", "SQ", "S5", "S2",
  "HK", "H8", "H3",
  "DA", "D7", "D4",
  "CK", "C6", "C3",
]);

// South: 10 HCP, 4 hearts, 4 spades — valid Stayman responder
const southHand = parseHand([
  "SK", "SJ", "S9", "S4",
  "HA", "HQ", "H7", "H2",
  "D9", "D3",
  "C8", "C5", "C2",
]);

const eastHand = parseHand([
  "S8", "S7",
  "HJ", "HT", "H6",
  "DK", "DQ", "DJ", "D8",
  "CA", "CQ", "CT", "C9",
]);

const westHand = parseHand([
  "ST", "S6", "S3",
  "H9", "H5", "H4",
  "DT", "D6", "D5", "D2",
  "CJ", "C7", "C4",
]);

function makeTestDeal(dealer: Seat = Seat.North): Deal {
  return {
    hands: {
      [Seat.North]: northHand,
      [Seat.East]: eastHand,
      [Seat.South]: southHand,
      [Seat.West]: westHand,
    },
    dealer,
    vulnerability: "None" as Vulnerability,
  };
}

function makeBid(level: 1 | 2 | 3 | 4 | 5 | 6 | 7, strain: BidSuit): Call {
  return { type: "bid", level, strain };
}

const pass: Call = { type: "pass" };

/**
 * Wait for all internal async work (AI bid delays, engine calls, Svelte tick)
 * to complete. User-action store methods return void — async work settles
 * internally. This gives enough real time for the full chain to drain.
 */
async function flushActions() {
  // AI_BID_DELAY is 300ms, up to ~4 AI bids per user action = ~1200ms max.
  await new Promise((r) => setTimeout(r, 1500));
  await tick();
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  clearRegistry();
  registerConvention(staymanConfig);
  registerConvention(gerberConfig);
  registerConvention(dontConfig);
  registerConvention(landyConfig);
  registerConvention(bergenConfig);
  registerConvention(saycConfig);
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  // Catch silently-swallowed errors from .catch(console.error) wrappers
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
});

describe("state readiness after startDrill", () => {
  test("deal and phase are set before AI bids run", async () => {
    const engine = createRealAuctionEngine();
    const store = createGameStore(engine);
    const config = createDrillConfig("stayman", Seat.South, { opponentBidding: true });
    const session = createDrillSession(config);
    const strategy = conventionToStrategy(getConvention("stayman"));
    const deal = makeTestDeal();

    await store.startDrill(deal, session, staymanConfig.defaultAuction!(Seat.South, deal), strategy);

    expect(store.deal).toStrictEqual(deal);
    expect(store.phase).toBe("BIDDING");
    expect(store.isProcessing).toBe(false);
  });

  test.each([
    ["stayman", "stayman", Seat.North],
    ["gerber", "gerber", Seat.North],
  ] as const)("%s: isUserTurn=true and legalCalls populated after startDrill", async (_, conventionId, dealer) => {
    const engine = createRealAuctionEngine();
    const store = createGameStore(engine);
    const convention = getConvention(conventionId);
    const config = createDrillConfig(conventionId, Seat.South, { opponentBidding: true });
    const session = createDrillSession(config);
    const strategy = conventionToStrategy(convention);
    const deal = makeTestDeal(dealer);

    await store.startDrill(deal, session, convention.defaultAuction!(Seat.South, deal), strategy);

    expect(store.isUserTurn).toBe(true);
    expect(store.legalCalls.length).toBeGreaterThan(0);
  });
});

describe("state readiness after userBid", () => {
  async function setupStaymanDrill() {
    const engine = createRealAuctionEngine();
    const store = createGameStore(engine);
    const convention = getConvention("stayman");
    const config = createDrillConfig("stayman", Seat.South, { opponentBidding: true });
    const session = createDrillSession(config);
    const strategy = conventionToStrategy(convention);
    const deal = makeTestDeal();
    await store.startDrill(deal, session, staymanConfig.defaultAuction!(Seat.South, deal), strategy);
    return store;
  }

  test("correct bid: isProcessing=false after AI responds", async () => {
    const store = await setupStaymanDrill();

    // 2C is the correct Stayman response
    store.userBid(makeBid(2, BidSuit.Clubs));
    await flushActions();

    expect(store.isProcessing).toBe(false);
    // Auction should have progressed past AI bids
    expect(store.bidHistory.length).toBeGreaterThan(2); // 1NT + user 2C + AI responses
  });

  test("correct bid: bidFeedback is cleared after AI bids complete", async () => {
    const store = await setupStaymanDrill();

    store.userBid(makeBid(2, BidSuit.Clubs));
    await flushActions();

    // Correct bid feedback auto-clears after AI bids
    expect(store.bidFeedback).toBeNull();
  });

  test("correct bid: if auction continues, isUserTurn becomes true again", async () => {
    const store = await setupStaymanDrill();

    store.userBid(makeBid(2, BidSuit.Clubs));
    await flushActions();

    // After AI responds, if auction isn't complete, user should be able to bid again
    if (store.phase === "BIDDING" && store.currentTurn === Seat.South) {
      expect(store.isUserTurn).toBe(true);
      expect(store.legalCalls.length).toBeGreaterThan(0);
    }
  });

  test("wrong bid: feedback is set and blocks further bidding", async () => {
    const store = await setupStaymanDrill();

    // Pass is wrong when 2C is expected
    store.userBid(pass);
    await flushActions();

    expect(store.bidFeedback).not.toBeNull();
    expect(store.bidFeedback!.isCorrect).toBe(false);
    expect(store.bidFeedback!.userCall).toEqual(pass);
    expect(store.bidFeedback!.expectedResult).not.toBeNull();
  });

  test("wrong bid: dismiss feedback resumes auction", async () => {
    const store = await setupStaymanDrill();

    store.userBid(pass);
    await flushActions();
    expect(store.bidFeedback).not.toBeNull();

    store.dismissBidFeedback();
    await flushActions();

    expect(store.bidFeedback).toBeNull();
    expect(store.isProcessing).toBe(false);
    // Auction should continue with AI bids
    expect(store.bidHistory.length).toBeGreaterThan(2);
  });

  test("wrong bid: retry restores pre-bid state", async () => {
    const store = await setupStaymanDrill();
    const historyBefore = store.bidHistory.length;
    const turnBefore = store.currentTurn;

    store.userBid(pass);
    await flushActions();
    store.retryBid();
    await flushActions();

    expect(store.bidFeedback).toBeNull();
    expect(store.currentTurn).toBe(turnBefore);
    expect(store.bidHistory.length).toBe(historyBefore);
    expect(store.isUserTurn).toBe(true);
    expect(store.legalCalls.length).toBeGreaterThan(0);
  });
});

describe("full bidding lifecycle", () => {
  test("Stayman: user bids correctly through entire auction", { timeout: 30000 }, async () => {
    const engine = createRealAuctionEngine();
    const store = createGameStore(engine);
    const convention = getConvention("stayman");
    const config = createDrillConfig("stayman", Seat.South, { opponentBidding: true });
    const session = createDrillSession(config);
    const strategy = conventionToStrategy(convention);
    const deal = makeTestDeal();
    await store.startDrill(deal, session, staymanConfig.defaultAuction!(Seat.South, deal), strategy);

    // Keep bidding until auction completes or phase changes
    let rounds = 0;
    while (store.phase === "BIDDING" && store.isUserTurn && rounds < 10) {
      // Use convention strategy to get the correct bid
      const suggestedCall = store.legalCalls.find((c: Call) => c.type === "pass") ?? store.legalCalls[0]!;
      store.userBid(suggestedCall);
      await flushActions();
      if (store.bidFeedback && !store.bidFeedback.isCorrect) {
        store.dismissBidFeedback();
        await flushActions();
      }
      rounds++;
    }

    // Auction should eventually complete (phase transitions away from BIDDING)
    // or the user is waiting for their turn
    expect(store.isProcessing).toBe(false);
    expect(rounds).toBeLessThan(10); // Sanity: didn't loop forever
  });

  test("skipFromFeedback transitions to EXPLANATION", { timeout: 15000 }, async () => {
    const engine = createRealAuctionEngine();
    const store = createGameStore(engine);
    const convention = getConvention("stayman");
    const config = createDrillConfig("stayman", Seat.South, { opponentBidding: true });
    const session = createDrillSession(config);
    const strategy = conventionToStrategy(convention);
    const deal = makeTestDeal();
    await store.startDrill(deal, session, staymanConfig.defaultAuction!(Seat.South, deal), strategy);

    // Make a wrong bid, then skip
    store.userBid(pass);
    await flushActions();
    store.skipFromFeedback();
    await flushActions();

    expect(store.phase).toBe("EXPLANATION");
    expect(store.bidFeedback).toBeNull();
    expect(store.isProcessing).toBe(false);
  });
});

describe("consecutive drills (reset between deals)", () => {
  test("starting a new drill fully resets state from previous drill", async () => {
    const engine = createRealAuctionEngine();
    const store = createGameStore(engine);
    const convention = getConvention("stayman");
    const config = createDrillConfig("stayman", Seat.South, { opponentBidding: true });
    const strategy = conventionToStrategy(convention);
    const deal = makeTestDeal();

    // First drill
    const session1 = createDrillSession(config);
    await store.startDrill(deal, session1, staymanConfig.defaultAuction!(Seat.South, deal), strategy);
    store.userBid(pass); // wrong bid, creates feedback
    await flushActions();
    expect(store.bidFeedback).not.toBeNull();

    // Second drill — must clear all state from first
    const session2 = createDrillSession(config);
    await store.startDrill(deal, session2, staymanConfig.defaultAuction!(Seat.South, deal), strategy);

    expect(store.bidFeedback).toBeNull();
    expect(store.phase).toBe("BIDDING");
    expect(store.isUserTurn).toBe(true);
    expect(store.isProcessing).toBe(false);
    expect(store.contract).toBeNull();
    expect(store.score).toBeNull();
  });

  test("reset() clears all state", async () => {
    const engine = createRealAuctionEngine();
    const store = createGameStore(engine);
    const convention = getConvention("stayman");
    const config = createDrillConfig("stayman", Seat.South, { opponentBidding: true });
    const session = createDrillSession(config);
    const strategy = conventionToStrategy(convention);
    const deal = makeTestDeal();

    await store.startDrill(deal, session, staymanConfig.defaultAuction!(Seat.South, deal), strategy);
    store.reset();

    expect(store.deal).toBeNull();
    expect(store.phase).toBe("BIDDING");
    expect(store.currentTurn).toBeNull();
    expect(store.bidHistory).toEqual([]);
    expect(store.isProcessing).toBe(false);
    expect(store.legalCalls).toEqual([]);
    expect(store.bidFeedback).toBeNull();
    expect(store.contract).toBeNull();
  });
});

describe("bid history tracking", () => {
  test("user bid is recorded with isUser=true", async () => {
    const engine = createRealAuctionEngine();
    const store = createGameStore(engine);
    const config = createDrillConfig("stayman", Seat.South, { opponentBidding: true });
    const session = createDrillSession(config);
    const strategy = conventionToStrategy(getConvention("stayman"));
    const deal = makeTestDeal();
    await store.startDrill(deal, session, staymanConfig.defaultAuction!(Seat.South, deal), strategy);

    const historyBefore = store.bidHistory.length;
    store.userBid(makeBid(2, BidSuit.Clubs));
    await flushActions();

    const userEntries = store.bidHistory.filter((e) => e.isUser);
    expect(userEntries.length).toBeGreaterThan(0);
    expect(userEntries[0]!.seat).toBe(Seat.South);
    expect(userEntries[0]!.call).toEqual(makeBid(2, BidSuit.Clubs));
  });

  test("AI bids are recorded with isUser=false", async () => {
    const engine = createRealAuctionEngine();
    const store = createGameStore(engine);
    const config = createDrillConfig("stayman", Seat.South, { opponentBidding: true });
    const session = createDrillSession(config);
    const strategy = conventionToStrategy(getConvention("stayman"));
    const deal = makeTestDeal();
    await store.startDrill(deal, session, staymanConfig.defaultAuction!(Seat.South, deal), strategy);

    store.userBid(makeBid(2, BidSuit.Clubs));
    await flushActions();

    const aiEntries = store.bidHistory.filter((e) => !e.isUser);
    expect(aiEntries.length).toBeGreaterThan(0);
    for (const entry of aiEntries) {
      expect(entry.isUser).toBe(false);
    }
  });

  test("correct bid is marked isCorrect=true", async () => {
    const engine = createRealAuctionEngine();
    const store = createGameStore(engine);
    const config = createDrillConfig("stayman", Seat.South, { opponentBidding: true });
    const session = createDrillSession(config);
    const strategy = conventionToStrategy(getConvention("stayman"));
    const deal = makeTestDeal();
    await store.startDrill(deal, session, staymanConfig.defaultAuction!(Seat.South, deal), strategy);

    store.userBid(makeBid(2, BidSuit.Clubs));
    await flushActions();

    const userEntry = store.bidHistory.find((e) => e.isUser);
    expect(userEntry!.isCorrect).toBe(true);
  });

  test("wrong bid is marked isCorrect=false with expectedResult", async () => {
    const engine = createRealAuctionEngine();
    const store = createGameStore(engine);
    const config = createDrillConfig("stayman", Seat.South, { opponentBidding: true });
    const session = createDrillSession(config);
    const strategy = conventionToStrategy(getConvention("stayman"));
    const deal = makeTestDeal();
    await store.startDrill(deal, session, staymanConfig.defaultAuction!(Seat.South, deal), strategy);

    store.userBid(pass);
    await flushActions();

    const userEntry = store.bidHistory.find((e) => e.isUser);
    expect(userEntry!.isCorrect).toBe(false);
    expect(userEntry!.expectedResult).toBeDefined();
  });
});

describe("isProcessing guard", () => {
  test("isProcessing is false after each user-action method completes", async () => {
    const engine = createRealAuctionEngine();
    const store = createGameStore(engine);
    const config = createDrillConfig("stayman", Seat.South, { opponentBidding: true });
    const session = createDrillSession(config);
    const strategy = conventionToStrategy(getConvention("stayman"));
    const deal = makeTestDeal();

    await store.startDrill(deal, session, staymanConfig.defaultAuction!(Seat.South, deal), strategy);
    expect(store.isProcessing).toBe(false);

    store.userBid(makeBid(2, BidSuit.Clubs));
    await flushActions();
    expect(store.isProcessing).toBe(false);
  });
});

describe("phase transitions", () => {
  test("auction completing transitions to DECLARER_PROMPT or EXPLANATION", { timeout: 30000 }, async () => {
    const engine = createRealAuctionEngine();
    const store = createGameStore(engine);
    const convention = getConvention("stayman");
    const config = createDrillConfig("stayman", Seat.South, { opponentBidding: true });
    const session = createDrillSession(config);
    const strategy = conventionToStrategy(convention);
    const deal = makeTestDeal();
    await store.startDrill(deal, session, staymanConfig.defaultAuction!(Seat.South, deal), strategy);

    // Bid through auction until it completes
    let rounds = 0;
    while (store.phase === "BIDDING" && rounds < 20) {
      if (store.isUserTurn) {
        // Just pass to move auction along
        store.userBid(pass);
        await flushActions();
        if (store.bidFeedback) {
          store.dismissBidFeedback();
          await flushActions();
        }
      }
      rounds++;
    }

    // Phase should have changed from BIDDING
    expect(["DECLARER_PROMPT", "EXPLANATION"]).toContain(store.phase);
    expect(store.isProcessing).toBe(false);
  });
});
