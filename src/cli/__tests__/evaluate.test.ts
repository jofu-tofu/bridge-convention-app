import { describe, it, expect } from "vitest";
import { evaluateCommand } from "../commands/evaluate";
import { createCliDependencies } from "../engine-factory";
import type { CliDependencies, CommandResult } from "../types";
import type { HandEvaluation, Deal } from "../../engine/types";
import { Seat, Suit, Rank, Vulnerability } from "../../engine/types";
import { createHand } from "../../engine/constants";

const deps = createCliDependencies();

function createTestDepsWithStdin(stdinResult: CommandResult): CliDependencies {
  return {
    ...deps,
    readStdin: async () => stdinResult,
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
    expect(result.type).toBe("evaluation");
    const eval_ = result.data as HandEvaluation;
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
    const eval_ = result.data as HandEvaluation;
    expect(eval_.distribution.shortness).toBe(2);
    expect(eval_.distribution.length).toBe(1);
    expect(eval_.distribution.total).toBe(3);
  });

  it("throws when neither --hand nor --hand-from provided", async () => {
    await expect(
      evaluateCommand.handler({}, deps),
    ).rejects.toMatchObject({ code: "INVALID_ARGS" });
  });

  it("throws when --hand-from stdin without --seat", async () => {
    await expect(
      evaluateCommand.handler({ "hand-from": "stdin" }, deps),
    ).rejects.toMatchObject({ code: "INVALID_ARGS" });
  });

  it("throws when --hand-from stdin with invalid seat", async () => {
    await expect(
      evaluateCommand.handler({ "hand-from": "stdin", seat: "X" }, deps),
    ).rejects.toMatchObject({ code: "INVALID_ARGS" });
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
    expect(result.type).toBe("evaluation");
    const eval_ = result.data as HandEvaluation;
    // A=4, K=3, Q=2, J=1: spades (AKQJ)=10, hearts (AKQ)=9, diamonds (AKQ)=9, clubs (AKQ)=9
    expect(eval_.hcp).toBe(37);
    expect(eval_.shape).toEqual([4, 3, 3, 3]);
  });

  it("throws when stdin deal has no hand for given seat", async () => {
    const stdinDeps = createTestDepsWithStdin({
      type: "deal",
      data: { hands: {}, dealer: Seat.North, vulnerability: Vulnerability.None },
    });

    await expect(
      evaluateCommand.handler({ "hand-from": "stdin", seat: "S" }, stdinDeps),
    ).rejects.toMatchObject({ code: "PARSE_ERROR" });
  });
});

