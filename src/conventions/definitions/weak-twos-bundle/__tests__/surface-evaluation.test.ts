import { describe, it, expect } from "vitest";
import { Seat, BidSuit } from "../../../../engine/types";
import type { Call, Hand } from "../../../../engine/types";
import { hand } from "../../../../engine/__tests__/fixtures";
import { evaluateHand } from "../../../../engine/hand-evaluator";
import { buildAuction } from "../../../../engine/auction-helpers";
import { createBiddingContext } from "../../../core";
import { createFactCatalog } from "../../../../core/contracts/fact-catalog";
import { createSharedFactCatalog } from "../../../core/pipeline/fact-evaluator";
import { evaluateFacts } from "../../../core/pipeline/fact-evaluator";
import { evaluateAllSurfaces } from "../../../core/pipeline/meaning-evaluator";
import { meaningBundleToStrategy } from "../../../../strategy/bidding/meaning-strategy";
import { weakTwoBundle } from "../config";
import { weakTwoFacts } from "../facts";
import {
  WEAK_TWO_R1_SURFACES,
  WEAK_TWO_OGUST_HEARTS_SURFACES,
} from "../meaning-surfaces";

// ─── Helpers ────────────────────────────────────────────────

function buildCatalog() {
  return createFactCatalog(createSharedFactCatalog(), weakTwoFacts);
}

function buildMachineStrategy() {
  const catalog = buildCatalog();
  const moduleSurfaces = weakTwoBundle.meaningSurfaces!.map((g) => ({
    moduleId: g.groupId,
    surfaces: g.surfaces,
  }));
  return meaningBundleToStrategy(moduleSurfaces, weakTwoBundle.id, {
    name: weakTwoBundle.name,
    factCatalog: catalog,
    conversationMachine: weakTwoBundle.conversationMachine,
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

// ─── R1 Opener tests ────────────────────────────────────────

describe("Weak Two R1 opener surfaces", () => {
  it("hand with 6 hearts 7 HCP → opens 2H", () => {
    // HK(3) + HQ(2) + DJ(1) + CJ(1) = 7 HCP, 6 hearts
    const h = hand(
      "S5", "S3",
      "HA", "HT", "H9", "H7", "H5", "H3",
      "DJ", "D5", "D3",
      "C5", "C3",
    );
    const catalog = buildCatalog();
    const facts = evaluateFacts(h, evaluateHand(h), catalog);
    const proposals = evaluateAllSurfaces(WEAK_TWO_R1_SURFACES, facts);

    // Should have at least one true proposal for 2H
    const trueProposals = proposals.filter((p) =>
      p.clauses.every((c) => c.satisfied),
    );
    expect(trueProposals.length).toBeGreaterThanOrEqual(1);
    // First true proposal should be 2H (hearts has highest priority)
    expect(trueProposals[0]!.meaningId).toBe("weak-two:open-2h");
  });

  it("hand with 6 spades 9 HCP → opens 2S", () => {
    // SK(3) + SQ(2) + SA(4) = 9 HCP, but that's too many. Let me fix:
    // SK(3) + SJ(1) + HQ(2) + DK(3) = 9 HCP, 6 spades
    const h = hand(
      "SK", "SJ", "ST", "S8", "S6", "S4",
      "HQ", "H5",
      "DK", "D5", "D3",
      "C5", "C3",
    );
    const catalog = buildCatalog();
    const facts = evaluateFacts(h, evaluateHand(h), catalog);
    const proposals = evaluateAllSurfaces(WEAK_TWO_R1_SURFACES, facts);

    const trueProposals = proposals.filter((p) =>
      p.clauses.every((c) => c.satisfied),
    );
    expect(trueProposals.length).toBeGreaterThanOrEqual(1);
    expect(trueProposals[0]!.meaningId).toBe("weak-two:open-2s");
  });

  it("$suit bindings resolve correctly (no unresolved $suit in proposals)", () => {
    const h = hand(
      "S5", "S3",
      "HA", "HT", "H9", "H7", "H5", "H3",
      "DJ", "D5", "D3",
      "C5", "C3",
    );
    const catalog = buildCatalog();
    const facts = evaluateFacts(h, evaluateHand(h), catalog);
    const proposals = evaluateAllSurfaces(WEAK_TWO_R1_SURFACES, facts);
    for (const p of proposals) {
      for (const clause of p.clauses) {
        expect(clause.factId).not.toContain("$suit");
      }
    }
  });
});

// ─── R2 Responder tests ─────────────────────────────────────

describe("Weak Two R2 responder surfaces", () => {
  it("responder with 16 HCP + 3-card fit → game raise (4H)", () => {
    // SA(4) + SK(3) + HA(4) + DK(3) + DQ(2) = 16 HCP, 3 hearts
    const h = hand(
      "SA", "SK", "S5",
      "HA", "H7", "H3",
      "DK", "DQ", "D5",
      "C7", "C5", "C3", "C2",
    );
    const { result } = suggestBid(h, ["2H", "P"]);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("4H");
  });

  it("responder with 14 HCP + 3-card fit → invite raise (3H)", () => {
    // SA(4) + SK(3) + DK(3) + DA(4) = 14 HCP, 3 hearts
    const h = hand(
      "SA", "SK", "S5",
      "H7", "H5", "H3",
      "DK", "DA", "D5",
      "C7", "C5", "C3", "C2",
    );
    const { result } = suggestBid(h, ["2H", "P"]);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("3H");
  });

  it("responder with 10 HCP → pass (no action in 10-13 range)", () => {
    // SA(4) + DK(3) + DQ(2) + CJ(1) = 10 HCP, 3 hearts
    const h = hand(
      "SA", "S5", "S3",
      "H7", "H5", "H3",
      "DK", "DQ", "D5",
      "CJ", "C7", "C5", "C3",
    );
    const { result } = suggestBid(h, ["2H", "P"]);
    // Only the fallback pass surface matches (no game/ogust/invite conditions met)
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("pass");
  });

  it("responder with 16 HCP + no fit → Ogust ask (2NT)", () => {
    // SA(4) + SK(3) + DA(4) + DK(3) + CQ(2) = 16 HCP, only 2 hearts
    const h = hand(
      "SA", "SK", "S5", "S3",
      "H7", "H5",
      "DA", "DK", "D5",
      "CQ", "C7", "C5", "C3",
    );
    const { result } = suggestBid(h, ["2H", "P"]);
    expect(result).not.toBeNull();
    // Game raise requires 3+ fit, so Ogust 2NT should be suggested
    expect(formatCall(result!.call)).toBe("2NT");
  });
});

// ─── Ogust R3 tests ─────────────────────────────────────────

describe("Weak Two Ogust R3 surfaces", () => {
  it("Ogust: min bad hand (6 HCP, 1 top honor) → 3C", () => {
    // HK(3) + DJ(1) + CQ(2) = 6 HCP, only HK as top honor in hearts
    const h = hand(
      "S5", "S3",
      "HK", "HT", "H9", "H7", "H5", "H3",
      "DJ", "D5",
      "CQ", "C5", "C3",
    );
    const catalog = buildCatalog();
    const facts = evaluateFacts(h, evaluateHand(h), catalog);
    const proposals = evaluateAllSurfaces(WEAK_TWO_OGUST_HEARTS_SURFACES, facts);

    const trueProposals = proposals.filter((p) =>
      p.clauses.every((c) => c.satisfied),
    );
    expect(trueProposals.length).toBeGreaterThanOrEqual(1);
    // Min bad → 3C
    const minBad = trueProposals.find((p) => p.meaningId === "weak-two:ogust-min-bad-hearts");
    expect(minBad).toBeDefined();
  });

  it("Ogust: min good hand (7 HCP, 2 top honors) → 3D", () => {
    // HK(3) + HQ(2) + DJ(1) + CJ(1) = 7 HCP, HK+HQ = 2 top honors
    const h = hand(
      "S5", "S3",
      "HK", "HQ", "HT", "H9", "H7", "H5",
      "DJ", "D5",
      "CJ", "C5", "C3",
    );
    const catalog = buildCatalog();
    const facts = evaluateFacts(h, evaluateHand(h), catalog);
    const proposals = evaluateAllSurfaces(WEAK_TWO_OGUST_HEARTS_SURFACES, facts);

    const trueProposals = proposals.filter((p) =>
      p.clauses.every((c) => c.satisfied),
    );
    const minGood = trueProposals.find((p) => p.meaningId === "weak-two:ogust-min-good-hearts");
    expect(minGood).toBeDefined();
  });

  it("Ogust: max bad hand (10 HCP, 1 top honor) → 3H", () => {
    // HA(4) + DK(3) + DQ(2) + CJ(1) = 10 HCP, only HA as top honor in hearts
    const h = hand(
      "S5", "S3",
      "HA", "HT", "H9", "H7", "H5", "H3",
      "DK", "DQ",
      "CJ", "C5", "C3",
    );
    const catalog = buildCatalog();
    const facts = evaluateFacts(h, evaluateHand(h), catalog);
    const proposals = evaluateAllSurfaces(WEAK_TWO_OGUST_HEARTS_SURFACES, facts);

    const trueProposals = proposals.filter((p) =>
      p.clauses.every((c) => c.satisfied),
    );
    const maxBad = trueProposals.find((p) => p.meaningId === "weak-two:ogust-max-bad-hearts");
    expect(maxBad).toBeDefined();
  });

  it("Ogust: max good hand (9 HCP, 2 top honors) → 3S", () => {
    // HK(3) + HQ(2) + DA(4) = 9 HCP, HK+HQ = 2 top honors
    const h = hand(
      "S5", "S3",
      "HK", "HQ", "HT", "H9", "H7", "H5",
      "DA", "D5",
      "C5", "C3", "C2",
    );
    const catalog = buildCatalog();
    const facts = evaluateFacts(h, evaluateHand(h), catalog);
    const proposals = evaluateAllSurfaces(WEAK_TWO_OGUST_HEARTS_SURFACES, facts);

    const trueProposals = proposals.filter((p) =>
      p.clauses.every((c) => c.satisfied),
    );
    const maxGood = trueProposals.find((p) => p.meaningId === "weak-two:ogust-max-good-hearts");
    expect(maxGood).toBeDefined();
  });

  it("Ogust: solid hand (AKQ in hearts) → 3NT", () => {
    // HA(4) + HK(3) + HQ(2) = 9 HCP, AKQ = solid
    const h = hand(
      "S5", "S3",
      "HA", "HK", "HQ", "HT", "H9", "H7",
      "D5", "D3",
      "C5", "C3", "C2",
    );
    const catalog = buildCatalog();
    const facts = evaluateFacts(h, evaluateHand(h), catalog);
    const proposals = evaluateAllSurfaces(WEAK_TWO_OGUST_HEARTS_SURFACES, facts);

    const trueProposals = proposals.filter((p) =>
      p.clauses.every((c) => c.satisfied),
    );
    // Solid (AKQ) should match
    const solid = trueProposals.find((p) => p.meaningId === "weak-two:ogust-solid-hearts");
    expect(solid).toBeDefined();
    // Solid should be highest priority (specificity 4 vs 3)
    expect(trueProposals[0]!.meaningId).toBe("weak-two:ogust-solid-hearts");
  });
});
