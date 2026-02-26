/**
 * Integration test: drill startup across conventions.
 *
 * Verifies the full chain: conventions → drill config → game store → isUserTurn.
 * Uses the pure TS auction engine (no HTTP server needed).
 */
import { describe, test, expect, beforeEach } from "vitest";
import { tick } from "svelte";
import { Seat, BidSuit } from "../../engine/types";
import type { Deal, Call, Auction, AuctionEntry, Vulnerability } from "../../engine/types";
import { createGameStore } from "../game.svelte";
import { createStubEngine } from "../../test-support/engine-stub";
import { parseHand } from "../../engine/notation";
import { clearRegistry, registerConvention, getConvention } from "../../conventions/core/registry";
import { staymanConfig } from "../../conventions/definitions/stayman";
import { gerberConfig } from "../../conventions/definitions/gerber";
import { dontConfig } from "../../conventions/definitions/dont";
import { landyConfig } from "../../conventions/definitions/landy";
import { bergenConfig } from "../../conventions/definitions/bergen-raises";
import { saycConfig } from "../../conventions/definitions/sayc";
import { createDrillConfig } from "../../drill/config-factory";
import { createDrillSession } from "../../drill/session";
import { conventionToStrategy } from "../../strategy/bidding/convention-strategy";
import { addCall, getLegalCalls, isAuctionComplete } from "../../engine/auction";

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

beforeEach(() => {
  clearRegistry();
  registerConvention(staymanConfig);
  registerConvention(gerberConfig);
  registerConvention(dontConfig);
  registerConvention(landyConfig);
  registerConvention(bergenConfig);
  registerConvention(saycConfig);
});

describe("drill startup — user can bid after init", () => {
  test("Stayman: isUserTurn true, legalCalls populated", async () => {
    const engine = createRealAuctionEngine();
    const gameStore = createGameStore(engine);
    const convention = getConvention("stayman");
    const config = createDrillConfig("stayman", Seat.South, { opponentBidding: true });
    const session = createDrillSession(config);
    const strategy = conventionToStrategy(convention);
    const deal = makeTestDeal();
    const initialAuction = staymanConfig.defaultAuction!(Seat.South, deal);

    await gameStore.startDrill(deal, session, initialAuction, strategy);

    expect(gameStore.phase).toBe("BIDDING");
    expect(gameStore.currentTurn).toBe(Seat.South);
    expect(gameStore.isUserTurn).toBe(true);
    expect(gameStore.isProcessing).toBe(false);
    expect(gameStore.legalCalls.length).toBeGreaterThan(0);
  });

  test("Stayman: 2C is a legal call", async () => {
    const engine = createRealAuctionEngine();
    const gameStore = createGameStore(engine);
    const config = createDrillConfig("stayman", Seat.South, { opponentBidding: true });
    const session = createDrillSession(config);
    const strategy = conventionToStrategy(getConvention("stayman"));
    const deal = makeTestDeal();

    await gameStore.startDrill(deal, session, staymanConfig.defaultAuction!(Seat.South, deal), strategy);

    const has2C = gameStore.legalCalls.some(
      (c: Call) => c.type === "bid" && c.level === 2 && c.strain === BidSuit.Clubs,
    );
    expect(has2C).toBe(true);
  });

  test("Gerber: isUserTurn true after init", async () => {
    const engine = createRealAuctionEngine();
    const gameStore = createGameStore(engine);
    const config = createDrillConfig("gerber", Seat.South, { opponentBidding: true });
    const session = createDrillSession(config);
    const strategy = conventionToStrategy(getConvention("gerber"));
    const deal = makeTestDeal();

    await gameStore.startDrill(deal, session, gerberConfig.defaultAuction!(Seat.South, deal), strategy);

    expect(gameStore.isUserTurn).toBe(true);
    expect(gameStore.isProcessing).toBe(false);
    expect(gameStore.legalCalls.length).toBeGreaterThan(0);
  });

  test("DONT: isUserTurn true after init", async () => {
    const engine = createRealAuctionEngine();
    const gameStore = createGameStore(engine);
    const config = createDrillConfig("dont", Seat.South, { opponentBidding: true });
    const session = createDrillSession(config);
    const strategy = conventionToStrategy(getConvention("dont"));
    const deal = makeTestDeal(Seat.East);

    await gameStore.startDrill(deal, session, dontConfig.defaultAuction!(Seat.South, deal), strategy);

    expect(gameStore.isUserTurn).toBe(true);
    expect(gameStore.isProcessing).toBe(false);
    expect(gameStore.legalCalls.length).toBeGreaterThan(0);
  });

  test("after user bids 2C, AI responds and game is not stuck", async () => {
    const engine = createRealAuctionEngine();
    const gameStore = createGameStore(engine);
    const config = createDrillConfig("stayman", Seat.South, { opponentBidding: true });
    const session = createDrillSession(config);
    const strategy = conventionToStrategy(getConvention("stayman"));
    const deal = makeTestDeal();

    await gameStore.startDrill(deal, session, staymanConfig.defaultAuction!(Seat.South, deal), strategy);

    gameStore.userBid({ type: "bid", level: 2, strain: BidSuit.Clubs });
    // AI_BID_DELAY is 300ms × up to 4 AI bids = 1200ms
    await new Promise((r) => setTimeout(r, 2500));
    await tick();

    expect(gameStore.isProcessing).toBe(false);
    if (gameStore.currentTurn === Seat.South) {
      expect(gameStore.isUserTurn).toBe(true);
    }
  });

  test("startDrill resolves within 2 seconds", async () => {
    const engine = createRealAuctionEngine();
    const gameStore = createGameStore(engine);
    const config = createDrillConfig("stayman", Seat.South, { opponentBidding: true });
    const session = createDrillSession(config);
    const strategy = conventionToStrategy(getConvention("stayman"));
    const deal = makeTestDeal();

    const start = Date.now();
    await gameStore.startDrill(deal, session, staymanConfig.defaultAuction!(Seat.South, deal), strategy);
    expect(Date.now() - start).toBeLessThan(2000);
  });
});
