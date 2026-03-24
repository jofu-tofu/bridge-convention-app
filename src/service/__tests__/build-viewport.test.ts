import { describe, it, expect } from "vitest";
import { Seat, Vulnerability, BidSuit, Suit, Rank } from "../../engine/types";
import type { Auction, Call, Hand, Contract, PlayedCard, Trick, Card } from "../../engine/types";
import { makeSimpleTestDeal, makeCard, makeContract, ALL_RANKS } from "../../test-support/fixtures";
import {
  buildBiddingViewport,
  buildDeclarerPromptViewport,
  buildPlayingViewport,
  buildExplanationViewport,
  type BuildBiddingViewportInput,
  type BuildDeclarerPromptViewportInput,
  type BuildPlayingViewportInput,
  type BuildExplanationViewportInput,
} from "../build-viewport";
import type { BiddingViewport, DeclarerPromptViewport, PlayingViewport, ExplanationViewport } from "../response-types";
import type { EvaluationOracle } from "../evaluation-oracle";

// ── Helpers ──────────────────────────────────────────────────────────

const emptyAuction: Auction = { entries: [], isComplete: false };

function makeAuctionWithOneEntry(): Auction {
  return {
    entries: [{ seat: Seat.North, call: { type: "pass" } }],
    isComplete: false,
  };
}

function make1NTBid(): Call {
  return { type: "bid", level: 1, strain: BidSuit.NoTrump };
}

// ── buildBiddingViewport ─────────────────────────────────────────────

describe("buildBiddingViewport", () => {
  function makeInput(overrides: Partial<BuildBiddingViewportInput> = {}): BuildBiddingViewportInput {
    const deal = makeSimpleTestDeal(Seat.North);
    return {
      deal,
      userSeat: Seat.South,
      auction: emptyAuction,
      bidHistory: [],
      legalCalls: [{ type: "pass" }],
      faceUpSeats: new Set([Seat.South]),
      conventionName: "Test Convention",
      isUserTurn: true,
      currentBidder: Seat.South,
      ...overrides,
    };
  }

  it("returns the player's own hand", () => {
    const deal = makeSimpleTestDeal();
    const vp = buildBiddingViewport(makeInput({ deal, userSeat: Seat.South }));

    expect(vp.hand).toBe(deal.hands[Seat.South]);
  });

  it("includes only face-up seats in visibleHands", () => {
    const deal = makeSimpleTestDeal();
    const vp = buildBiddingViewport(
      makeInput({ deal, faceUpSeats: new Set([Seat.South]) }),
    );

    expect(vp.visibleHands[Seat.South]).toBe(deal.hands[Seat.South]);
    expect(vp.visibleHands[Seat.North]).toBeUndefined();
    expect(vp.visibleHands[Seat.East]).toBeUndefined();
    expect(vp.visibleHands[Seat.West]).toBeUndefined();
  });

  it("does not expose opponent hands when only user seat is face-up", () => {
    const deal = makeSimpleTestDeal();
    const vp = buildBiddingViewport(
      makeInput({ deal, userSeat: Seat.South, faceUpSeats: new Set([Seat.South]) }),
    );

    const visibleSeats = Object.keys(vp.visibleHands);
    expect(visibleSeats).toEqual([Seat.South]);
  });

  it("includes auction entries from the auction", () => {
    const auction = makeAuctionWithOneEntry();
    const vp = buildBiddingViewport(makeInput({ auction }));

    expect(vp.auctionEntries).toHaveLength(1);
    expect(vp.auctionEntries[0]!.seat).toBe(Seat.North);
    expect(vp.auctionEntries[0]!.call).toEqual({ type: "pass" });
  });

  it("passes through legal calls", () => {
    const legalCalls: Call[] = [{ type: "pass" }, make1NTBid()];
    const vp = buildBiddingViewport(makeInput({ legalCalls }));

    expect(vp.legalCalls).toBe(legalCalls);
  });

  it("includes hand evaluation with HCP and shape", () => {
    const vp = buildBiddingViewport(makeInput());

    expect(vp.handEvaluation).toBeDefined();
    expect(typeof vp.handEvaluation.hcp).toBe("number");
    expect(vp.handEvaluation.shape).toHaveLength(4);
    expect(typeof vp.handEvaluation.isBalanced).toBe("boolean");
  });

  it("includes a human-readable hand summary", () => {
    const vp = buildBiddingViewport(makeInput());

    expect(typeof vp.handSummary).toBe("string");
    expect(vp.handSummary.length).toBeGreaterThan(0);
  });

  it("passes through turn state fields", () => {
    const vp = buildBiddingViewport(
      makeInput({ isUserTurn: true, currentBidder: Seat.South }),
    );

    expect(vp.isUserTurn).toBe(true);
    expect(vp.currentBidder).toBe(Seat.South);
  });

  it("passes through deal metadata", () => {
    const deal = makeSimpleTestDeal(Seat.West);
    const vp = buildBiddingViewport(makeInput({ deal }));

    expect(vp.dealer).toBe(Seat.West);
    expect(vp.vulnerability).toBe(Vulnerability.None);
  });

  it("includes alert labels from bid history", () => {
    const auction: Auction = {
      entries: [{ seat: Seat.North, call: make1NTBid() }],
      isComplete: false,
    };
    const bidHistory = [
      { alertLabel: "15-17 HCP", annotationType: "announce" as const },
    ];
    const vp = buildBiddingViewport(makeInput({ auction, bidHistory }));

    expect(vp.auctionEntries[0]!.alertLabel).toBe("15-17 HCP");
    expect(vp.auctionEntries[0]!.annotationType).toBe("announce");
  });

  it("produces empty biddingOptions when no activeSurfaces provided", () => {
    const vp = buildBiddingViewport(makeInput());

    expect(vp.biddingOptions).toEqual([]);
  });
});

// ── buildDeclarerPromptViewport ──────────────────────────────────────

describe("buildDeclarerPromptViewport", () => {
  function makeInput(
    overrides: Partial<BuildDeclarerPromptViewportInput> = {},
  ): BuildDeclarerPromptViewportInput {
    return {
      deal: makeSimpleTestDeal(),
      userSeat: Seat.South,
      faceUpSeats: new Set([Seat.South, Seat.North]),
      auction: emptyAuction,
      bidHistory: [],
      contract: makeContract(Seat.South),
      promptMode: "south-declarer",
      ...overrides,
    };
  }

  it("shows dummy hand (North) when North is face-up", () => {
    const deal = makeSimpleTestDeal();
    const vp = buildDeclarerPromptViewport(
      makeInput({ deal, faceUpSeats: new Set([Seat.South, Seat.North]) }),
    );

    expect(vp.visibleHands[Seat.North]).toBe(deal.hands[Seat.North]);
    expect(vp.visibleHands[Seat.South]).toBe(deal.hands[Seat.South]);
  });

  it("hides opponent hands not in faceUpSeats", () => {
    const deal = makeSimpleTestDeal();
    const vp = buildDeclarerPromptViewport(
      makeInput({ deal, faceUpSeats: new Set([Seat.South, Seat.North]) }),
    );

    expect(vp.visibleHands[Seat.East]).toBeUndefined();
    expect(vp.visibleHands[Seat.West]).toBeUndefined();
  });

  it("includes contract information", () => {
    const contract = makeContract(Seat.South);
    const vp = buildDeclarerPromptViewport(makeInput({ contract }));

    expect(vp.contract).toBe(contract);
  });

  it("passes through promptMode", () => {
    const vp = buildDeclarerPromptViewport(
      makeInput({ promptMode: "defender" }),
    );

    expect(vp.promptMode).toBe("defender");
  });

  it("passes through deal metadata", () => {
    const deal = makeSimpleTestDeal(Seat.East);
    const vp = buildDeclarerPromptViewport(makeInput({ deal }));

    expect(vp.dealer).toBe(Seat.East);
    expect(vp.vulnerability).toBe(Vulnerability.None);
  });
});

// ── buildPlayingViewport ─────────────────────────────────────────────

describe("buildPlayingViewport", () => {
  function makeInput(
    overrides: Partial<BuildPlayingViewportInput> = {},
  ): BuildPlayingViewportInput {
    return {
      deal: makeSimpleTestDeal(),
      userSeat: Seat.South,
      faceUpSeats: new Set([Seat.South, Seat.North]),
      rotated: false,
      contract: makeContract(Seat.South),
      currentPlayer: Seat.South,
      currentTrick: [],
      trumpSuit: undefined,
      legalPlays: [],
      userControlledSeats: [Seat.South],
      remainingCards: {},
      tricks: [],
      declarerTricksWon: 0,
      defenderTricksWon: 0,
      ...overrides,
    };
  }

  it("shows hands for face-up seats only", () => {
    const deal = makeSimpleTestDeal();
    const vp = buildPlayingViewport(
      makeInput({ deal, faceUpSeats: new Set([Seat.South, Seat.North]) }),
    );

    expect(vp.visibleHands[Seat.South]).toBe(deal.hands[Seat.South]);
    expect(vp.visibleHands[Seat.North]).toBe(deal.hands[Seat.North]);
    expect(vp.visibleHands[Seat.East]).toBeUndefined();
    expect(vp.visibleHands[Seat.West]).toBeUndefined();
  });

  it("hides all hands when faceUpSeats is empty", () => {
    const vp = buildPlayingViewport(
      makeInput({ faceUpSeats: new Set() }),
    );

    expect(Object.keys(vp.visibleHands)).toHaveLength(0);
  });

  it("includes trick and play state", () => {
    const playedCard: PlayedCard = {
      card: makeCard(Suit.Hearts, Rank.Ace),
      seat: Seat.South,
    };
    const vp = buildPlayingViewport(
      makeInput({
        currentTrick: [playedCard],
        declarerTricksWon: 3,
        defenderTricksWon: 2,
      }),
    );

    expect(vp.currentTrick).toEqual([playedCard]);
    expect(vp.declarerTricksWon).toBe(3);
    expect(vp.defenderTricksWon).toBe(2);
  });

  it("passes through contract and trump suit", () => {
    const contract = makeContract(Seat.South);
    const vp = buildPlayingViewport(
      makeInput({ contract, trumpSuit: Suit.Spades }),
    );

    expect(vp.contract).toBe(contract);
    expect(vp.trumpSuit).toBe(Suit.Spades);
  });

  it("passes through legal plays and user-controlled seats", () => {
    const legalPlays: Card[] = [makeCard(Suit.Hearts, Rank.Ace)];
    const vp = buildPlayingViewport(
      makeInput({
        legalPlays,
        userControlledSeats: [Seat.South, Seat.North],
      }),
    );

    expect(vp.legalPlays).toBe(legalPlays);
    expect(vp.userControlledSeats).toEqual([Seat.South, Seat.North]);
  });

  it("includes auction entries when auction is provided", () => {
    const auction = makeAuctionWithOneEntry();
    const vp = buildPlayingViewport(makeInput({ auction, bidHistory: [] }));

    expect(vp.auctionEntries).toHaveLength(1);
  });

  it("omits auction entries when auction is not provided", () => {
    const vp = buildPlayingViewport(makeInput());

    expect(vp.auctionEntries).toBeUndefined();
  });
});

// ── buildExplanationViewport ─────────────────────────────────────────

describe("buildExplanationViewport", () => {
  function makeInput(
    overrides: Partial<BuildExplanationViewportInput> = {},
  ): BuildExplanationViewportInput {
    return {
      deal: makeSimpleTestDeal(),
      userSeat: Seat.South,
      auction: emptyAuction,
      bidHistory: [],
      contract: makeContract(Seat.South),
      score: 90,
      declarerTricksWon: 7,
      ...overrides,
    };
  }

  it("exposes all four hands", () => {
    const deal = makeSimpleTestDeal();
    const vp = buildExplanationViewport(makeInput({ deal }));

    expect(vp.allHands[Seat.North]).toBe(deal.hands[Seat.North]);
    expect(vp.allHands[Seat.East]).toBe(deal.hands[Seat.East]);
    expect(vp.allHands[Seat.South]).toBe(deal.hands[Seat.South]);
    expect(vp.allHands[Seat.West]).toBe(deal.hands[Seat.West]);
  });

  it("includes score and trick count", () => {
    const vp = buildExplanationViewport(
      makeInput({ score: 120, declarerTricksWon: 8 }),
    );

    expect(vp.score).toBe(120);
    expect(vp.declarerTricksWon).toBe(8);
  });

  it("includes contract", () => {
    const contract = makeContract(Seat.North);
    const vp = buildExplanationViewport(makeInput({ contract }));

    expect(vp.contract).toBe(contract);
  });

  it("includes auction entries", () => {
    const auction = makeAuctionWithOneEntry();
    const vp = buildExplanationViewport(makeInput({ auction }));

    expect(vp.auctionEntries).toHaveLength(1);
  });

  it("handles null contract and null score", () => {
    const vp = buildExplanationViewport(
      makeInput({ contract: null, score: null }),
    );

    expect(vp.contract).toBeNull();
    expect(vp.score).toBeNull();
  });
});

// ── Information boundary: EvaluationOracle fields never leak ─────────

describe("information boundary", () => {
  // Build one of each viewport type and assert none contain oracle fields.
  const deal = makeSimpleTestDeal();

  const oracleFields = ["expectedCall", "bidResult", "expectedSurfaceId", "expectedAlert",
    "teachingResolution", "strategyEvaluation", "teachingProjection"] as const;

  function assertNoOracleFields(viewport: Record<string, unknown>, label: string) {
    for (const field of oracleFields) {
      expect(viewport).not.toHaveProperty(field);
    }
    // allHands is allowed ONLY on ExplanationViewport — check it's absent on others
    if (label !== "ExplanationViewport") {
      expect(viewport).not.toHaveProperty("allHands");
    }
  }

  it("BiddingViewport does not contain EvaluationOracle fields", () => {
    const vp = buildBiddingViewport({
      deal,
      userSeat: Seat.South,
      auction: emptyAuction,
      bidHistory: [],
      legalCalls: [{ type: "pass" }],
      faceUpSeats: new Set([Seat.South]),
      conventionName: "Test",
      isUserTurn: true,
      currentBidder: Seat.South,
    });
    assertNoOracleFields(vp as unknown as Record<string, unknown>, "BiddingViewport");
  });

  it("DeclarerPromptViewport does not contain EvaluationOracle fields", () => {
    const vp = buildDeclarerPromptViewport({
      deal,
      userSeat: Seat.South,
      faceUpSeats: new Set([Seat.South, Seat.North]),
      auction: emptyAuction,
      bidHistory: [],
      contract: makeContract(Seat.South),
      promptMode: "south-declarer",
    });
    assertNoOracleFields(vp as unknown as Record<string, unknown>, "DeclarerPromptViewport");
  });

  it("PlayingViewport does not contain EvaluationOracle fields", () => {
    const vp = buildPlayingViewport({
      deal,
      userSeat: Seat.South,
      faceUpSeats: new Set([Seat.South, Seat.North]),
      rotated: false,
      contract: makeContract(Seat.South),
      currentPlayer: Seat.South,
      currentTrick: [],
      trumpSuit: undefined,
      legalPlays: [],
      userControlledSeats: [Seat.South],
      remainingCards: {},
      tricks: [],
      declarerTricksWon: 0,
      defenderTricksWon: 0,
    });
    assertNoOracleFields(vp as unknown as Record<string, unknown>, "PlayingViewport");
  });

  it("ExplanationViewport does not contain EvaluationOracle fields (except allHands)", () => {
    const vp = buildExplanationViewport({
      deal,
      userSeat: Seat.South,
      auction: emptyAuction,
      bidHistory: [],
      contract: null,
      score: null,
      declarerTricksWon: 0,
    });
    assertNoOracleFields(vp as unknown as Record<string, unknown>, "ExplanationViewport");
    // ExplanationViewport DOES have allHands — that's expected in review phase
    expect(vp.allHands).toBeDefined();
  });

  it("BiddingViewport.visibleHands excludes seats not in faceUpSeats even when deal has all four", () => {
    // Specifically verify that the raw deal's opponents don't leak through
    const vp = buildBiddingViewport({
      deal,
      userSeat: Seat.South,
      auction: emptyAuction,
      bidHistory: [],
      legalCalls: [],
      faceUpSeats: new Set([Seat.South]),
      conventionName: "Test",
      isUserTurn: true,
      currentBidder: Seat.South,
    });

    // The deal has all 4 hands, but the viewport should only show South
    expect(Object.keys(deal.hands)).toHaveLength(4);
    expect(Object.keys(vp.visibleHands)).toHaveLength(1);
    expect(vp.visibleHands[Seat.South]).toBeDefined();
  });
});
