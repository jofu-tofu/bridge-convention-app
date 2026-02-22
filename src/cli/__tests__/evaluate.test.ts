import { describe, it, expect } from "vitest";
import { evaluateCommand } from "../commands/evaluate";
import { createCliDependencies } from "../engine-factory";
import type { CliDependencies } from "../types";
import { ok } from "../types";
import type { HandEvaluation, Deal } from "../../engine/types";
import { Seat, Suit, Rank, Vulnerability } from "../../engine/types";
import { createHand } from "../../engine/constants";

const deps = createCliDependencies();

function createTestDepsWithStdin(stdinData: {
  type: string;
  data: unknown;
}): CliDependencies {
  return {
    ...deps,
    readStdin: async () => ok(stdinData),
  };
}

function card(suit: Suit, rank: Rank) {
  return { suit, rank };
}

describe("evaluate command", () => {
  it("evaluates a hand from --hand notation", async () => {
    const result = await evaluateCommand.handler(
      { hand: "SA SK SQ SJ HK HT H9 DA D7 D6 D5 C8 C7" },
      deps,
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.type).toBe("evaluation");
    const eval_ = result.value.data as HandEvaluation;
    expect(eval_.hcp).toBe(17);
    expect(eval_.shape).toEqual([4, 3, 4, 2]);
    expect(eval_.strategy).toBe("HCP");
  });

  it("calculates distribution points correctly", async () => {
    // 5-4-3-1 shape = 2 shortness (singleton) + 1 length (5-card suit)
    const result = await evaluateCommand.handler(
      { hand: "SA SK SQ SJ S9 HA HK HQ HJ DA DK DQ C2" },
      deps,
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    const eval_ = result.value.data as HandEvaluation;
    expect(eval_.distribution.shortness).toBe(2);
    expect(eval_.distribution.length).toBe(1);
    expect(eval_.distribution.total).toBe(3);
  });

  it("returns error when neither --hand nor --hand-from provided", async () => {
    const result = await evaluateCommand.handler({}, deps);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("INVALID_ARGS");
  });

  it("returns error when --hand-from stdin without --seat", async () => {
    const result = await evaluateCommand.handler(
      { "hand-from": "stdin" },
      deps,
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("INVALID_ARGS");
  });

  it("returns error when --hand-from stdin with invalid seat", async () => {
    const result = await evaluateCommand.handler(
      { "hand-from": "stdin", seat: "X" },
      deps,
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("INVALID_ARGS");
  });

  it("evaluates hand from stdin piped deal", async () => {
    const northHand = createHand([
      card(Suit.Spades, Rank.Ace),
      card(Suit.Spades, Rank.King),
      card(Suit.Spades, Rank.Queen),
      card(Suit.Spades, Rank.Jack),
      card(Suit.Hearts, Rank.Ace),
      card(Suit.Hearts, Rank.King),
      card(Suit.Hearts, Rank.Queen),
      card(Suit.Diamonds, Rank.Ace),
      card(Suit.Diamonds, Rank.King),
      card(Suit.Diamonds, Rank.Queen),
      card(Suit.Clubs, Rank.Ace),
      card(Suit.Clubs, Rank.King),
      card(Suit.Clubs, Rank.Queen),
    ]);

    const fakeDeal: Deal = {
      hands: {
        [Seat.North]: northHand,
        [Seat.East]: northHand,
        [Seat.South]: northHand,
        [Seat.West]: northHand,
      },
      dealer: Seat.North,
      vulnerability: Vulnerability.None,
    };

    const stdinDeps = createTestDepsWithStdin({
      type: "deal",
      data: fakeDeal,
    });

    const result = await evaluateCommand.handler(
      { "hand-from": "stdin", seat: "N" },
      stdinDeps,
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.type).toBe("evaluation");
    const eval_ = result.value.data as HandEvaluation;
    // A=4, K=3, Q=2, J=1: spades (AKQJ)=10, hearts (AKQ)=9, diamonds (AKQ)=9, clubs (AKQ)=9
    expect(eval_.hcp).toBe(37);
    expect(eval_.shape).toEqual([4, 3, 3, 3]);
  });

  it("returns error when stdin deal has no hand for given seat", async () => {
    const stdinDeps = createTestDepsWithStdin({
      type: "deal",
      data: {
        hands: {},
        dealer: Seat.North,
        vulnerability: Vulnerability.None,
      },
    });

    const result = await evaluateCommand.handler(
      { "hand-from": "stdin", seat: "S" },
      stdinDeps,
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("PARSE_ERROR");
  });
});
