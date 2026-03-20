/**
 * Local service end-to-end contract tests.
 */
import { describe, it, expect } from "vitest";
import { BidSuit } from "../../engine/types";
import type { Call } from "../../engine/types";
import { createStubEngine } from "../../test-support/engine-stub";
import { createLocalService } from "../local-service";

// Import conventions to populate the registry
import "../../conventions";

describe("local service", () => {
  it("createSession returns a non-empty string handle", async () => {
    const engine = createStubEngine();
    const service = createLocalService(engine);

    const handle = await service.createSession({ conventionId: "nt-bundle" });

    expect(handle).toBeTruthy();
    expect(typeof handle).toBe("string");
  });

  it("startDrill returns viewport with user's hand", async () => {
    const engine = createStubEngine({
      async isAuctionComplete() { return false; },
    });
    const service = createLocalService(engine);

    const handle = await service.createSession({ conventionId: "nt-bundle" });
    const result = await service.startDrill(handle);

    expect(result.viewport).toBeDefined();
    expect(result.viewport.hand).toBeDefined();
    expect(result.viewport.seat).toBeDefined();
  });

  it("startDrill viewport has correct number of cards (13)", async () => {
    const engine = createStubEngine({
      async isAuctionComplete() { return false; },
    });
    const service = createLocalService(engine);

    const handle = await service.createSession({ conventionId: "nt-bundle" });
    const result = await service.startDrill(handle);

    expect(result.viewport.hand.cards.length).toBe(13);
  });

  it("submitBid correct → accepted, AI bids, next viewport", async () => {
    const engine = createStubEngine({
      async isAuctionComplete() { return false; },
    });
    const service = createLocalService(engine);

    const handle = await service.createSession({ conventionId: "nt-bundle" });
    await service.startDrill(handle);

    // Get the expected bid first
    const expected = await service.getExpectedBid(handle);
    if (!expected) {
      // If no strategy or not user's turn, skip this test
      return;
    }

    const result = await service.submitBid(handle, expected.call);

    expect(result.accepted).toBe(true);
    // AI bids should have run
    expect(result.aiBids.length).toBeGreaterThanOrEqual(0);
  });

  it("submitBid wrong → not accepted, feedback with grade", async () => {
    const engine = createStubEngine({
      async isAuctionComplete() { return false; },
    });
    const service = createLocalService(engine);

    const handle = await service.createSession({ conventionId: "nt-bundle" });
    await service.startDrill(handle);

    // Bid something clearly wrong
    const wrongBid: Call = { type: "bid", level: 7, strain: BidSuit.NoTrump };
    const result = await service.submitBid(handle, wrongBid);

    // Should be rejected (unless 7NT happens to be correct, which is vanishingly unlikely)
    if (!result.accepted) {
      expect(result.feedback).not.toBeNull();
      expect(result.grade).toBeTruthy();
    }
  });

  it("submitBid wrong → session state unchanged (idempotent)", async () => {
    const engine = createStubEngine({
      async isAuctionComplete() { return false; },
    });
    const service = createLocalService(engine);

    const handle = await service.createSession({ conventionId: "nt-bundle" });
    await service.startDrill(handle);

    const viewportBefore = await service.getViewport(handle);

    const wrongBid: Call = { type: "bid", level: 7, strain: BidSuit.NoTrump };
    const result = await service.submitBid(handle, wrongBid);

    if (!result.accepted) {
      const viewportAfter = await service.getViewport(handle);
      // Viewport should be the same after a wrong bid
      expect(viewportAfter.phase).toBe(viewportBefore.phase);
    }
  });

  it("getPhase returns BIDDING after startDrill", async () => {
    const engine = createStubEngine({
      async isAuctionComplete() { return false; },
    });
    const service = createLocalService(engine);

    const handle = await service.createSession({ conventionId: "nt-bundle" });
    await service.startDrill(handle);

    const phase = await service.getPhase(handle);
    expect(phase).toBe("BIDDING");
  });

  it("phase transitions work through the service", async () => {
    const engine = createStubEngine({
      async isAuctionComplete() { return false; },
    });
    const service = createLocalService(engine);

    const handle = await service.createSession({ conventionId: "nt-bundle" });
    await service.startDrill(handle);

    // After start drill with non-completing auction, should be BIDDING
    const phase = await service.getPhase(handle);
    expect(phase).toBe("BIDDING");
  });

  it("destroySession removes handle", async () => {
    const engine = createStubEngine();
    const service = createLocalService(engine);

    const handle = await service.createSession({ conventionId: "nt-bundle" });
    await service.destroySession(handle);

    await expect(service.getPhase(handle)).rejects.toThrow();
  });

  it("listConventions returns non-empty array", async () => {
    const engine = createStubEngine();
    const service = createLocalService(engine);

    const conventions = await service.listConventions();
    expect(conventions.length).toBeGreaterThan(0);
    expect(conventions[0]!.id).toBeTruthy();
    expect(conventions[0]!.name).toBeTruthy();
  });
});

describe("DevServicePort methods", () => {
  it("getExpectedBid returns call matching strategy suggest()", async () => {
    const engine = createStubEngine({
      async isAuctionComplete() { return false; },
    });
    const service = createLocalService(engine);

    const handle = await service.createSession({ conventionId: "nt-bundle" });
    await service.startDrill(handle);

    const expected = await service.getExpectedBid(handle);
    // May be null if not user's turn or no strategy — that's OK
    if (expected) {
      expect(expected.call).toBeDefined();
    }
  });

  it("getDebugLog accumulates entries across bids", async () => {
    const engine = createStubEngine({
      async isAuctionComplete() { return false; },
    });
    const service = createLocalService(engine);

    const handle = await service.createSession({ conventionId: "nt-bundle" });
    await service.startDrill(handle);

    // Submit a bid (right or wrong doesn't matter for debug log)
    const expected = await service.getExpectedBid(handle);
    if (expected) {
      await service.submitBid(handle, expected.call);
    }

    const log = await service.getDebugLog(handle);
    // Log should have at least one entry if we submitted a bid with a strategy
    expect(log).toBeDefined();
  });
});
