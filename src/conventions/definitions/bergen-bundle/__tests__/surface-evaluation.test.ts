import { describe, it, expect } from "vitest";
import { refDescribe } from "../../../../test-support/tiers";
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
import { bergenBundle } from "../config";
import { bergenFacts } from "../facts";
import {
  BERGEN_R1_HEARTS_SURFACES,
  BERGEN_R1_SPADES_SURFACES,
} from "../meaning-surfaces";

// ─── Helpers ────────────────────────────────────────────────

function buildCatalog() {
  return createFactCatalog(createSharedFactCatalog(), bergenFacts);
}

function buildMachineStrategy() {
  const catalog = buildCatalog();
  const moduleSurfaces = bergenBundle.meaningSurfaces!.map((g) => ({
    moduleId: g.groupId,
    surfaces: g.surfaces,
  }));
  return meaningBundleToStrategy(moduleSurfaces, bergenBundle.id, {
    name: bergenBundle.name,
    factCatalog: catalog,
    conversationMachine: bergenBundle.conversationMachine,
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

// ─── Surface binding resolution ─────────────────────────────

describe("Bergen surface binding resolution", () => {
  it("resolves $suit to hearts in hearts surfaces", () => {
    const catalog = buildCatalog();
    // 8 HCP, 4 hearts -- constructive raise
    const h = hand(
      "S8", "S5", "S2",
      "HK", "HT", "H6", "H2",
      "DK", "DQ", "D3",
      "C5", "C3", "C2",
    );
    const facts = evaluateFacts(h, evaluateHand(h), catalog);
    const proposals = evaluateAllSurfaces(BERGEN_R1_HEARTS_SURFACES, facts);

    // All proposals should have resolved factIds with 'hearts', not '$suit'
    for (const p of proposals) {
      for (const clause of p.clauses) {
        expect(clause.factId).not.toContain("$suit");
      }
    }
  });

  it("resolves $suit to spades in spades surfaces", () => {
    const catalog = buildCatalog();
    const h = hand(
      "SK", "ST", "S6", "S2",
      "H8", "H5", "H2",
      "DK", "DQ", "D3",
      "C5", "C3", "C2",
    );
    const facts = evaluateFacts(h, evaluateHand(h), catalog);
    const proposals = evaluateAllSurfaces(BERGEN_R1_SPADES_SURFACES, facts);

    for (const p of proposals) {
      for (const clause of p.clauses) {
        expect(clause.factId).not.toContain("$suit");
      }
    }
  });
});

// ─── Hearts R1 surface tests ────────────────────────────────

refDescribe("[ref:bridgebum]", "Bergen bundle -- hearts R1 surfaces", () => {
  it("5 HCP + 4 hearts -> preemptive raise (3H)", () => {
    // HK(3) + HQ(2) = 5 HCP, 4 hearts
    const h = hand(
      "S8", "S5", "S2",
      "HK", "HQ", "H6", "H2",
      "DT", "D7", "D3",
      "C5", "C3", "C2",
    );
    const { result } = suggestBid(h, ["1H", "P"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("bid");
    expect(formatCall(result!.call)).toBe("3H");
  });

  it("8 HCP + 4 hearts -> constructive raise (3C)", () => {
    // HK(3) + DK(3) + DQ(2) = 8 HCP, 4 hearts
    const h = hand(
      "S8", "S5", "S2",
      "HK", "HT", "H6", "H2",
      "DK", "DQ", "D3",
      "C5", "C3", "C2",
    );
    const { result } = suggestBid(h, ["1H", "P"]);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("3C");
  });

  it("11 HCP + 4 hearts -> limit raise (3D)", () => {
    // SA(4) + HK(3) + HJ(1) + DQ(2) + CJ(1) = 11 HCP, 4 hearts
    const h = hand(
      "SA", "S5", "S2",
      "HK", "HJ", "H6", "H2",
      "DQ", "D7", "D3",
      "CJ", "C3", "C2",
    );
    const { result } = suggestBid(h, ["1H", "P"]);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("3D");
  });

  it("14 HCP + 4 hearts -> game raise (4H)", () => {
    // SA(4) + SK(3) + HQ(2) + DK(3) + DQ(2) = 14 HCP, 4 hearts
    const h = hand(
      "SA", "SK", "S2",
      "HQ", "HT", "H6", "H2",
      "DK", "DQ", "D3",
      "C5", "C3", "C2",
    );
    const { result } = suggestBid(h, ["1H", "P"]);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("4H");
  });

  it("13 HCP + 4 hearts + shortage -> splinter (3S)", () => {
    // SA(4) + HK(3) + HQ(2) + DA(4) = 13 HCP, 4 hearts, singleton spade
    const h = hand(
      "SA",
      "HK", "HQ", "H7", "H3",
      "DA", "D5", "D3", "D2",
      "C5", "C4", "C3", "C2",
    );
    const { result } = suggestBid(h, ["1H", "P"]);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("3S");
  });

  it("13 HCP + 4 hearts + no shortage -> game raise (4H), not splinter", () => {
    // SA(4) + HK(3) + HQ(2) + DK(3) + CJ(1) = 13 HCP, 4 hearts, balanced
    const h = hand(
      "SA", "S5", "S3",
      "HK", "HQ", "H7", "H3",
      "DK", "D5", "D3",
      "CJ", "C5", "C2",
    );
    const { result } = suggestBid(h, ["1H", "P"]);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("4H");
  });

  it("no support (< 4 hearts) -> no surface matches (null result)", () => {
    // 8 HCP, only 3 hearts -- no Bergen raise
    const h = hand(
      "S8", "S5", "S2",
      "HK", "HT", "H6",
      "DK", "DQ", "D7", "D3",
      "C5", "C3", "C2",
    );
    const { result } = suggestBid(h, ["1H", "P"]);
    expect(result).toBeNull();
  });
});

// ─── Spades R1 surface tests ───────────────────────────────

refDescribe("[ref:bridgebum]", "Bergen bundle -- spades R1 surfaces", () => {
  it("4 HCP + 4 spades -> preemptive raise (3S)", () => {
    // SQ(2) + SJ(1) + DJ(1) = 4 HCP, 4 spades
    const h = hand(
      "SQ", "SJ", "S6", "S2",
      "H8", "H5", "H2",
      "DJ", "D7", "D3",
      "C5", "C3", "C2",
    );
    const { result } = suggestBid(h, ["1S", "P"]);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("3S");
  });

  it("8 HCP + 4 spades -> constructive raise (3C)", () => {
    // SK(3) + DK(3) + DQ(2) = 8 HCP, 4 spades
    const h = hand(
      "SK", "ST", "S6", "S2",
      "H8", "H5", "H2",
      "DK", "DQ", "D3",
      "C5", "C3", "C2",
    );
    const { result } = suggestBid(h, ["1S", "P"]);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("3C");
  });

  it("11 HCP + 4 spades -> limit raise (3D)", () => {
    // SK(3) + SJ(1) + HA(4) + DQ(2) + CJ(1) = 11 HCP, 4 spades
    const h = hand(
      "SK", "SJ", "S6", "S2",
      "HA", "H5", "H2",
      "DQ", "D7", "D3",
      "CJ", "C3", "C2",
    );
    const { result } = suggestBid(h, ["1S", "P"]);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("3D");
  });

  it("14 HCP + 4 spades -> game raise (4S)", () => {
    // SK(3) + SQ(2) + HA(4) + DK(3) + DQ(2) = 14 HCP, 4 spades
    const h = hand(
      "SK", "SQ", "S6", "S2",
      "HA", "H5", "H2",
      "DK", "DQ", "D3",
      "C5", "C3", "C2",
    );
    const { result } = suggestBid(h, ["1S", "P"]);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("4S");
  });

  it("12 HCP + 4 spades + shortage -> splinter (3H)", () => {
    // SK(3) + SQ(2) + HA(4) + DK(3) = 12 HCP, 4 spades, singleton heart
    const h = hand(
      "SK", "SQ", "S7", "S3",
      "HA",
      "DK", "D5", "D3", "D2",
      "C5", "C4", "C3", "C2",
    );
    const { result } = suggestBid(h, ["1S", "P"]);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("3H");
  });

  it("no support (< 4 spades) -> null result", () => {
    // 11 HCP, 3 spades
    const h = hand(
      "SK", "SQ", "S6",
      "HA", "H5", "H2",
      "DQ", "DJ", "D3",
      "CJ", "C3", "C2", "C4",
    );
    const { result } = suggestBid(h, ["1S", "P"]);
    expect(result).toBeNull();
  });
});

// ─── Wrong auction ─────────────────────────────────────────

describe("Bergen bundle -- wrong auction", () => {
  it("1NT-P auction -> no surfaces match", () => {
    const h = hand(
      "S8", "S5", "S2",
      "HK", "HT", "H6", "H2",
      "DK", "DQ", "D3",
      "C5", "C3", "C2",
    );
    const { result } = suggestBid(h, ["1NT", "P"]);
    expect(result).toBeNull();
  });

  it("1D-P auction -> no surfaces match", () => {
    const h = hand(
      "S8", "S5", "S2",
      "HK", "HT", "H6", "H2",
      "DK", "DQ", "D3",
      "C5", "C3", "C2",
    );
    const { result } = suggestBid(h, ["1D", "P"]);
    expect(result).toBeNull();
  });
});

// ─── HCP boundary tests ───────────────────────────────────

refDescribe("[ref:bridgebum]", "Bergen bundle -- HCP boundary tests", () => {
  it("exactly 6 HCP -> preemptive (0-6)", () => {
    // HK(3) + HQ(2) + CJ(1) = 6 HCP, 4 hearts
    const h = hand(
      "S8", "S5", "S2",
      "HK", "HQ", "H6", "H2",
      "DT", "D7", "D3",
      "CJ", "C5", "C2",
    );
    const { result } = suggestBid(h, ["1H", "P"]);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("3H");
  });

  it("exactly 7 HCP -> constructive (7-10)", () => {
    // HK(3) + HQ(2) + DJ(1) + CJ(1) = 7 HCP, 4 hearts
    const h = hand(
      "S8", "S5", "S2",
      "HK", "HQ", "H6", "H2",
      "DJ", "D7", "D3",
      "CJ", "C5", "C2",
    );
    const { result } = suggestBid(h, ["1H", "P"]);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("3C");
  });

  it("exactly 10 HCP -> limit raise wins (10-12) over constructive (7-10) by ranking", () => {
    // SA(4) + HJ(1) + DK(3) + DQ(2) = 10 HCP, 4 hearts
    const h = hand(
      "SA", "S5", "S2",
      "HJ", "H7", "H5", "H3",
      "DK", "DQ", "D3",
      "C5", "C3", "C2",
    );
    const { result } = suggestBid(h, ["1H", "P"]);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("3D");
  });

  it("exactly 12 HCP with shortage -> splinter (12+)", () => {
    // SK(3) + SQ(2) + HA(4) + DK(3) = 12 HCP, 4 spades, singleton heart
    const h = hand(
      "SK", "SQ", "S7", "S3",
      "HA",
      "DK", "D5", "D3", "D2",
      "C5", "C4", "C3", "C2",
    );
    const { result } = suggestBid(h, ["1S", "P"]);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("3H");
  });

  it("exactly 13 HCP without shortage -> game raise (not splinter)", () => {
    // SA(4) + SK(3) + HQ(2) + DK(3) + CJ(1) = 13 HCP, balanced, 4 hearts
    const h = hand(
      "SA", "SK", "S3",
      "HQ", "HT", "H6", "H2",
      "DK", "D5", "D3",
      "CJ", "C5", "C2",
    );
    const { result } = suggestBid(h, ["1H", "P"]);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("4H");
  });

  it("0 HCP + 4 hearts -> preemptive", () => {
    // 0 HCP, 4 hearts
    const h = hand(
      "S7", "S5", "S3",
      "H7", "H5", "H4", "H3",
      "D7", "D5", "D3",
      "C7", "C5", "C3",
    );
    const { result } = suggestBid(h, ["1H", "P"]);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("3H");
  });
});
