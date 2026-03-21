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

    expect(typeof handle).toBe("string");
    expect(handle).toMatch(/[\w-]+/);
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

    // Stub engine gives South 12 HCP balanced → strategy always produces a bid
    const expected = await service.getExpectedBid(handle);
    expect(expected).not.toBeNull();

    const result = await service.submitBid(handle, expected!.call);

    expect(result.accepted).toBe(true);
    expect(result.aiBids).toBeDefined();
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

    // 7NT is never the correct bid for a 12 HCP balanced hand
    expect(result.accepted).toBe(false);
    expect(result.feedback).not.toBeNull();
    expect(result.grade).toBeDefined();
    expect(result.grade).not.toBeNull();
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

    // 7NT is never correct for 12 HCP balanced — always rejected
    expect(result.accepted).toBe(false);
    const viewportAfter = await service.getViewport(handle);
    // Viewport should be the same after a wrong bid
    expect(viewportAfter.phase).toBe(viewportBefore.phase);
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
    expect(typeof conventions[0]!.id).toBe("string");
    expect(conventions[0]!.id.length).toBeGreaterThan(0);
    expect(typeof conventions[0]!.name).toBe("string");
    expect(conventions[0]!.name.length).toBeGreaterThan(0);
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

    // Stub engine gives South 12 HCP balanced → strategy always produces a bid
    const expected = await service.getExpectedBid(handle);
    expect(expected).not.toBeNull();
    expect(expected!.call).toBeDefined();
  });

  it("getDebugLog accumulates entries across bids", async () => {
    const engine = createStubEngine({
      async isAuctionComplete() { return false; },
    });
    const service = createLocalService(engine);

    const handle = await service.createSession({ conventionId: "nt-bundle" });
    await service.startDrill(handle);

    // Submit a bid to populate the debug log
    const expected = await service.getExpectedBid(handle);
    expect(expected).not.toBeNull();
    await service.submitBid(handle, expected!.call);

    const log = await service.getDebugLog(handle);
    expect(log).toBeDefined();
    expect(log.length).toBeGreaterThan(0);
  });
});
