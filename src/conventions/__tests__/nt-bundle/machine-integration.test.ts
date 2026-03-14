import { describe, it, expect } from "vitest";
import { Seat, BidSuit } from "../../../engine/types";
import type { Call, Hand } from "../../../engine/types";
import { hand } from "../../../engine/__tests__/fixtures";
import { evaluateHand } from "../../../engine/hand-evaluator";
import { buildAuction } from "../../../engine/auction-helpers";
import { createBiddingContext } from "../../core";
import { createFactCatalog } from "../../../core/contracts/fact-catalog";
import { createSharedFactCatalog } from "../../core/pipeline/fact-evaluator";

// NT bundle
import { ntBundle } from "../../definitions/nt-bundle/config";
import { staymanFacts, transferFacts, ntResponseFacts } from "../../definitions/nt-bundle/facts";

// Strategy adapter (machine-aware)
import { meaningBundleToStrategy } from "../../../strategy/bidding/meaning-strategy";

// Runtime
import { bundleToRuntimeModules } from "../../core/runtime/bundle-adapter";
import { evaluate } from "../../core/runtime/evaluation-runtime";

// ─── Helpers ────────────────────────────────────────────────

function formatCall(call: Call): string {
  if (call.type === "bid") {
    const strainNames = new Map<BidSuit, string>([
      [BidSuit.Clubs, "C"],
      [BidSuit.Diamonds, "D"],
      [BidSuit.Hearts, "H"],
      [BidSuit.Spades, "S"],
      [BidSuit.NoTrump, "NT"],
    ]);
    return `${call.level}${strainNames.get(call.strain) ?? "?"}`;
  }
  return call.type;
}

function buildCatalog() {
  return createFactCatalog(createSharedFactCatalog(), staymanFacts, transferFacts, ntResponseFacts);
}

function buildMachineStrategy() {
  const catalog = buildCatalog();
  const moduleSurfaces = ntBundle.meaningSurfaces!.map((g) => ({
    moduleId: g.groupId,
    surfaces: g.surfaces,
  }));
  return meaningBundleToStrategy(moduleSurfaces, ntBundle.id, {
    name: ntBundle.name,
    factCatalog: catalog,
    conversationMachine: ntBundle.conversationMachine,
  });
}

function suggestBid(h: Hand, auctionCalls: string[], seat: Seat = Seat.South) {
  const strategy = buildMachineStrategy();
  const auction = buildAuction(Seat.North, auctionCalls);
  const ctx = createBiddingContext({
    hand: h,
    auction,
    seat,
    evaluation: evaluateHand(h),
  });
  const result = strategy.suggest(ctx);
  return { result, strategy };
}

// ═══════════════════════════════════════════════════════════════
// Machine Integration Tests — Gold Scenarios
// ═══════════════════════════════════════════════════════════════

describe("Machine Integration: full pipeline with FSM", () => {
  // ─── Gold Scenario 1: Weak balanced, no major → no convention bid ──
  it("[ref:bridge-basics] scenario 1 — weak balanced no major yields null", () => {
    // 5 HCP, 3-3-4-3, no 4-card major → neither Stayman nor transfer nor NT invite/game
    const h = hand(
      "S8", "S5", "S3", "HJ", "H7", "H4",
      "DQ", "D5", "D2", "C8", "C6", "C3", "C2",
    );
    const { result } = suggestBid(h, ["1NT", "P"]);
    // No convention bid — null (hand too weak and no major fit)
    expect(result).toBeNull();
  });

  // ─── Gold Scenario 2: Invitational, one 4-card major → Stayman ──
  it("[ref:bridgebum/stayman] scenario 2 — 10 HCP 4S 4H selects 2C Stayman", () => {
    const h = hand(
      "SK", "SQ", "S8", "S3", "HJ", "H7", "H4", "H2",
      "DA", "D5", "C8", "C3", "C2",
    );
    const { result } = suggestBid(h, ["1NT", "P"]);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("2C");
  });

  // ─── Gold Scenario 3: Weak, 5-card heart suit → transfer then pass ──
  it("[ref:bridgebum/jacoby-transfers] scenario 3 — weak 5H selects 2D transfer", () => {
    const h = hand(
      "S3", "S2", "HK", "HQ", "H8", "H7", "H5",
      "D6", "D4", "D2", "C7", "C5", "C3",
    );
    const { result } = suggestBid(h, ["1NT", "P"]);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("2D");
  });

  // ─── Gold Scenario 4: Game values, balanced, no major → 3NT ──
  it("[ref:bridge-basics] scenario 4 — game values balanced no major selects 3NT", () => {
    // 12 HCP, no 4-card major, no 5-card major → 3NT
    const h = hand(
      "SA", "S8", "S3", "HK", "H7", "H4",
      "DA", "DQ", "D5", "CK", "C8", "C3", "C2",
    );
    const { result } = suggestBid(h, ["1NT", "P"]);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("3NT");
  });

  // ─── Gold Scenario 5: 5-4 invitational — transfer preferred over Stayman ──
  it("[ref:bridgebum] scenario 5 — 5H 4S 10HCP selects 2D transfer", () => {
    // 5H 4S: Stayman clause "no 5-card major" fails, transfer wins
    const h = hand(
      "SK", "SJ", "S8", "S3", "HA", "HQ", "H7", "H5", "H2",
      "D8", "D4", "C6", "C3",
    );
    const { result, strategy } = suggestBid(h, ["1NT", "P"]);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("2D");

    // Transfer should be in truth set; Stayman eliminated by no-five-card-major clause
    const arb = strategy.getLastArbitration?.();
    expect(arb).not.toBeNull();
    const truthIds = arb!.truthSet.map((e) => e.proposal.meaningId);
    expect(truthIds).toContain("transfer:to-hearts");
  });

  // ─── Gold Scenario 6: 1NT-X system-off ──
  it("[policy] scenario 6 — 1NT-X yields null (no surfaces active)", () => {
    const h = hand(
      "SK", "SQ", "S8", "S3", "HJ", "H7", "H4", "H2",
      "DA", "D5", "C8", "C3", "C2",
    );
    const { result } = suggestBid(h, ["1NT", "X"]);
    // Machine moves to nt-contested — no surfaceGroupId, so no surfaces emitted
    expect(result).toBeNull();
  });

  // ─── Gold Scenario 7: Stayman answer — opener shows hearts ──
  it("[ref:bridgebum/stayman] scenario 7 — opener shows 4+H via 2H", () => {
    const h = hand(
      "SA", "SK", "S5", "HQ", "HJ", "H5", "H3",
      "DK", "DQ", "D7", "CA", "C8", "C4",
    );
    const { result } = suggestBid(h, ["1NT", "P", "2C", "P"], Seat.North);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("2H");
  });

  // ─── Gold Scenario 8: Transfer accept → opener accepts heart transfer ──
  it("[ref:bridgebum/jacoby-transfers] scenario 8 — opener accepts heart transfer with 2H", () => {
    const h = hand(
      "SA", "SQ", "S8", "S3", "HK", "H7", "H4", "H2",
      "DA", "DJ", "D5", "CQ", "C3",
    );
    const { result } = suggestBid(h, ["1NT", "P", "2D", "P"], Seat.North);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("2H");
  });
});

// ═══════════════════════════════════════════════════════════════
// Machine-driven snapshot verification
// ═══════════════════════════════════════════════════════════════

describe("Machine Integration: snapshot registers", () => {
  it("1NT-P snapshot has captain=responder from machine", () => {
    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const { modules, getActiveIds } = bundleToRuntimeModules(ntBundle);
    const activeIds = getActiveIds(auction, Seat.South);
    const result = evaluate(modules, auction, Seat.South, activeIds, {
      machine: ntBundle.conversationMachine,
      surfaceRouter: ntBundle.surfaceRouter,
    });

    expect(result.publicSnapshot.captain).toBe("responder");
  });

  it("1NT-P-2C-P snapshot has obligation ShowMajor from machine", () => {
    const auction = buildAuction(Seat.North, ["1NT", "P", "2C", "P"]);
    const { modules, getActiveIds } = bundleToRuntimeModules(ntBundle);
    const activeIds = getActiveIds(auction, Seat.North);
    const result = evaluate(modules, auction, Seat.North, activeIds, {
      machine: ntBundle.conversationMachine,
      surfaceRouter: ntBundle.surfaceRouter,
    });

    expect(result.publicSnapshot.obligation.kind).toBe("ShowMajor");
    expect(result.publicSnapshot.obligation.obligatedSide).toBe("opener");
  });

  it("1NT-P-2D-P-2H-P snapshot has agreedStrain hearts tentative from machine", () => {
    const auction = buildAuction(Seat.North, ["1NT", "P", "2D", "P", "2H", "P"]);
    const { modules, getActiveIds } = bundleToRuntimeModules(ntBundle);
    const activeIds = getActiveIds(auction, Seat.South);
    const result = evaluate(modules, auction, Seat.South, activeIds, {
      machine: ntBundle.conversationMachine,
      surfaceRouter: ntBundle.surfaceRouter,
    });

    expect(result.publicSnapshot.agreedStrain).toEqual({
      type: "suit",
      suit: "hearts",
      confidence: "tentative",
    });
  });

  it("1NT-X snapshot has competitionMode Doubled from machine", () => {
    const auction = buildAuction(Seat.North, ["1NT", "X"]);
    const { modules, getActiveIds } = bundleToRuntimeModules(ntBundle);
    const activeIds = getActiveIds(auction, Seat.South);
    const result = evaluate(modules, auction, Seat.South, activeIds, {
      machine: ntBundle.conversationMachine,
      surfaceRouter: ntBundle.surfaceRouter,
    });

    expect(result.publicSnapshot.competitionMode).toBe("Doubled");
  });
});

// ═══════════════════════════════════════════════════════════════
// Epistemic layers populated
// ═══════════════════════════════════════════════════════════════

describe("Machine Integration: epistemic layers", () => {
  it("publicRecord populated with all auction entries", () => {
    const auction = buildAuction(Seat.North, ["1NT", "P", "2C", "P"]);
    const { modules, getActiveIds } = bundleToRuntimeModules(ntBundle);
    const activeIds = getActiveIds(auction, Seat.North);
    const result = evaluate(modules, auction, Seat.North, activeIds, {
      machine: ntBundle.conversationMachine,
      surfaceRouter: ntBundle.surfaceRouter,
    });

    expect(result.publicSnapshot.publicRecord).toHaveLength(4);
    expect(result.publicSnapshot.publicRecord![0]!.call).toBe("1NT");
    expect(result.publicSnapshot.publicRecord![1]!.call).toBe("P");
    expect(result.publicSnapshot.publicRecord![2]!.call).toBe("2C");
    expect(result.publicSnapshot.publicRecord![3]!.call).toBe("P");
  });

  it("publicCommitments populated from surface consequences", () => {
    const auction = buildAuction(Seat.North, ["1NT", "P", "2C", "P"]);
    const { modules, getActiveIds } = bundleToRuntimeModules(ntBundle);
    const activeIds = getActiveIds(auction, Seat.North);
    const result = evaluate(modules, auction, Seat.North, activeIds, {
      machine: ntBundle.conversationMachine,
      surfaceRouter: ntBundle.surfaceRouter,
    });

    expect(result.publicSnapshot.publicCommitments).toBeDefined();
    expect(result.publicSnapshot.publicCommitments!.length).toBeGreaterThan(0);

    // 2C Stayman promises HCP >= 8
    const hcpCommitment = result.publicSnapshot.publicCommitments!.find(
      (c) => c.constraint.factId === "hand.hcp" && c.sourceCall === "2C",
    );
    expect(hcpCommitment).toBeDefined();
    expect(hcpCommitment!.origin).toBe("call-meaning");
  });

  it("publicCommitments includes entailed denials after 1NT-P-2C-P-2D", () => {
    const auction = buildAuction(Seat.North, [
      "1NT",
      "P",
      "2C",
      "P",
      "2D",
      "P",
    ]);
    const { modules, getActiveIds } = bundleToRuntimeModules(ntBundle);
    const activeIds = getActiveIds(auction, Seat.South);
    const result = evaluate(modules, auction, Seat.South, activeIds, {
      machine: ntBundle.conversationMachine,
      surfaceRouter: ntBundle.surfaceRouter,
    });

    expect(result.publicSnapshot.publicCommitments).toBeDefined();

    // Entailed denials: opener does NOT have 4+ hearts AND does NOT have 4+ spades
    const entailedDenials = result.publicSnapshot.publicCommitments!.filter(
      (c) => c.origin === "entailed-denial",
    );
    expect(entailedDenials.length).toBe(2);

    const heartsDenial = entailedDenials.find(
      (c) => c.constraint.factId === "hand.suitLength.hearts",
    );
    expect(heartsDenial).toBeDefined();
    expect(heartsDenial!.strength).toBe("entailed");

    const spadesDenial = entailedDenials.find(
      (c) => c.constraint.factId === "hand.suitLength.spades",
    );
    expect(spadesDenial).toBeDefined();
    expect(spadesDenial!.strength).toBe("entailed");
  });

  it("publicBeliefs is empty array (stub)", () => {
    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const { modules, getActiveIds } = bundleToRuntimeModules(ntBundle);
    const activeIds = getActiveIds(auction, Seat.South);
    const result = evaluate(modules, auction, Seat.South, activeIds, {
      machine: ntBundle.conversationMachine,
      surfaceRouter: ntBundle.surfaceRouter,
    });

    expect(result.publicSnapshot.publicBeliefs).toEqual([]);
  });
});
