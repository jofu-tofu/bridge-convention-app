import { describe, it, expect } from "vitest";
import { Seat, BidSuit } from "../../../../engine/types";
import type { Call, Hand } from "../../../../engine/types";
import { hand } from "../../../../engine/__tests__/fixtures";
import { evaluateHand } from "../../../../engine/hand-evaluator";
import { buildAuction } from "../../../../engine/auction-helpers";
import { createBiddingContext } from "../../../core";
import { createFactCatalog } from "../../../../core/contracts/fact-catalog";
import { createSharedFactCatalog } from "../../../core/pipeline/fact-evaluator";
import { meaningBundleToStrategy } from "../../../../strategy/bidding/meaning-strategy";
import { dontBundle } from "../config";
import { dontFacts } from "../facts";

// ─── Helpers ────────────────────────────────────────────────

function buildCatalog() {
  return createFactCatalog(createSharedFactCatalog(), dontFacts);
}

function buildMachineStrategy() {
  const catalog = buildCatalog();
  const moduleSurfaces = dontBundle.meaningSurfaces!.map((g) => ({
    moduleId: g.groupId,
    surfaces: g.surfaces,
  }));
  return meaningBundleToStrategy(moduleSurfaces, dontBundle.id, {
    name: dontBundle.name,
    factCatalog: catalog,
    conversationMachine: dontBundle.conversationMachine,
  });
}

function suggestBid(
  h: Hand,
  auctionCalls: string[],
  seat: Seat = Seat.South,
) {
  const strategy = buildMachineStrategy();
  const auction = buildAuction(Seat.East, auctionCalls);
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

// ─── R1 Overcaller DONT action tests ────────────────────────

describe("DONT R1 overcaller action surfaces", () => {
  it("both majors (H5+S4) → 2H", () => {
    // SK(3) + SJ(1) + HK(3) + HQ(2) = 9 HCP, shape 4=5=2=2
    const h = hand(
      "SK", "SJ", "S8", "S4",
      "HK", "HQ", "H8", "H5", "H3",
      "DT", "D5",
      "C9", "C2",
    );
    const { result } = suggestBid(h, ["1NT"]);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("2H");
  });

  it("both majors (S5+H4) → 2H", () => {
    // SA(4) + HK(3) + HJ(1) = 8 HCP, shape 5=4=2=2
    const h = hand(
      "SA", "ST", "S8", "S5", "S3",
      "HK", "HJ", "H7", "H4",
      "D8", "D3",
      "C5", "C2",
    );
    const { result } = suggestBid(h, ["1NT"]);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("2H");
  });

  it("diamonds + major → 2D", () => {
    // SJ(1) + HK(3) + HJ(1) + DA(4) = 9 HCP, shape 2=4=5=2
    const h = hand(
      "SJ", "S3",
      "HK", "HJ", "H9", "H4",
      "DA", "DT", "D8", "D6", "D3",
      "C5", "C2",
    );
    const { result } = suggestBid(h, ["1NT"]);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("2D");
  });

  it("clubs + higher → 2C", () => {
    // DK(3) + DJ(1) + CA(4) = 8 HCP, shape 2=2=4=5
    const h = hand(
      "S8", "S3",
      "H5", "H2",
      "DK", "DJ", "D9", "D4",
      "CA", "CT", "C7", "C5", "C3",
    );
    const { result } = suggestBid(h, ["1NT"]);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("2C");
  });

  it("natural 6+ spades → 2S", () => {
    // SA(4) + SK(3) = 7 HCP, shape 6=2=2=3
    const h = hand(
      "SA", "SK", "ST", "S8", "S5", "S3",
      "H8", "H3",
      "DT", "D5",
      "C9", "C5", "C2",
    );
    const { result } = suggestBid(h, ["1NT"]);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("2S");
  });

  it("single suited 6+ (not spades) → double", () => {
    // HA(4) + HK(3) = 7 HCP, shape 2=6=2=3
    const h = hand(
      "S8", "S3",
      "HA", "HK", "HT", "H8", "H5", "H3",
      "DT", "D5",
      "C9", "C5", "C2",
    );
    const { result } = suggestBid(h, ["1NT"]);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("double");
  });

  it("6-4 hand (6C+4H) → 2C not double", () => {
    // HK(3) + HJ(1) + CA(4) = 8 HCP, shape 2=4=2=5
    const h = hand(
      "S3", "S2",
      "HK", "HJ", "H9", "H4",
      "D8", "D3",
      "CA", "CT", "C8", "C5", "C3",
    );
    const { result } = suggestBid(h, ["1NT"]);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("2C");
  });

  it("6S+4H → 2H not 2S", () => {
    // SA(4) + SK(3) + HK(3) + HJ(1) = 11 HCP, shape 6=4=2=1
    const h = hand(
      "SA", "SK", "ST", "S8", "S5", "S3",
      "HK", "HJ", "H9", "H4",
      "D8", "D3",
      "C2",
    );
    const { result } = suggestBid(h, ["1NT"]);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("2H");
  });
});

// ─── Overcaller reveal tests (after X → 2C relay) ──────────

describe("DONT overcaller reveal after double → 2C relay", () => {
  it("reveal clubs (pass)", () => {
    // CA(4) + CK(3) = 7 HCP, shape 2=2=3=6
    const h = hand(
      "S8", "S3",
      "H5", "H2",
      "D8", "D5", "D3",
      "CA", "CK", "CT", "C8", "C5", "C3",
    );
    const { result } = suggestBid(h, ["1NT", "X", "P", "2C", "P"]);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("pass");
  });

  it("reveal diamonds (2D)", () => {
    // DA(4) + DK(3) = 7 HCP, shape 2=2=6=3
    const h = hand(
      "S8", "S3",
      "H5", "H2",
      "DA", "DK", "DT", "D8", "D5", "D3",
      "C9", "C5", "C2",
    );
    const { result } = suggestBid(h, ["1NT", "X", "P", "2C", "P"]);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("2D");
  });

  it("reveal hearts (2H)", () => {
    // HA(4) + HK(3) = 7 HCP, shape 2=6=2=3
    const h = hand(
      "S8", "S3",
      "HA", "HK", "HT", "H8", "H5", "H3",
      "D5", "D3",
      "C9", "C5", "C2",
    );
    const { result } = suggestBid(h, ["1NT", "X", "P", "2C", "P"]);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("2H");
  });
});

// ─── 2D relay response tests ────────────────────────────────

describe("DONT 2D relay response (overcaller reveals major)", () => {
  it("2D relay: hearts (pass)", () => {
    // SJ(1) + HK(3) + HJ(1) + DA(4) = 9 HCP, shape 2=4=5=2
    const h = hand(
      "SJ", "S3",
      "HK", "HJ", "H9", "H4",
      "DA", "DT", "D8", "D6", "D3",
      "C5", "C2",
    );
    const { result } = suggestBid(h, ["1NT", "2D", "P", "2H", "P"]);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("pass");
  });

  it("2D relay: spades (2S)", () => {
    // SK(3) + SJ(1) + DA(4) = 8 HCP, shape 4=2=5=2
    const h = hand(
      "SK", "SJ", "S9", "S4",
      "H3", "H2",
      "DA", "DT", "D8", "D6", "D3",
      "C5", "C2",
    );
    const { result } = suggestBid(h, ["1NT", "2D", "P", "2H", "P"]);
    expect(result).not.toBeNull();
    expect(formatCall(result!.call)).toBe("2S");
  });
});
