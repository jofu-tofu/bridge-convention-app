import { describe, it, expect } from "vitest";
import { moduleFactory } from "../index";
import { SAYC_SYSTEM_CONFIG } from "../../../system-config";
import { BLACKWOOD_MEANING_IDS, BLACKWOOD_FACT_IDS } from "../ids";
import { moduleSurfaces } from "../../../../core/convention-module";
import { Rank, type Hand, type Card, type Suit } from "../../../../../engine/types";

const mod = moduleFactory(SAYC_SYSTEM_CONFIG);

function makeHand(aces: number, kings: number): Hand {
  const cards: Card[] = [];
  const suits: Suit[] = ["S" as Suit, "H" as Suit, "D" as Suit, "C" as Suit];

  // Add aces
  for (let i = 0; i < aces && i < 4; i++) {
    cards.push({ suit: suits[i]!, rank: Rank.Ace });
  }
  // Add kings
  for (let i = 0; i < kings && i < 4; i++) {
    cards.push({ suit: suits[i]!, rank: Rank.King });
  }
  // Fill remaining cards with low cards
  const lowRanks = [Rank.Two, Rank.Three, Rank.Four, Rank.Five, Rank.Six, Rank.Seven, Rank.Eight, Rank.Nine, Rank.Ten];
  let rankIdx = 0;
  while (cards.length < 13) {
    const suitIdx = cards.length % 4;
    cards.push({ suit: suits[suitIdx]!, rank: lowRanks[rankIdx % lowRanks.length]! });
    rankIdx++;
  }

  return { cards };
}

describe("Blackwood module", () => {
  it("has moduleId 'blackwood'", () => {
    expect(mod.moduleId).toBe("blackwood");
  });

  it("has 5 state entries (idle, asked, responded, king-ask, king-responded)", () => {
    expect(mod.states).toHaveLength(5);
  });

  it("has surfaces for all Blackwood meanings", () => {
    const surfaces = moduleSurfaces(mod);
    const ids = surfaces.map((s) => s.meaningId);
    expect(ids).toContain(BLACKWOOD_MEANING_IDS.ASK_ACES);
    expect(ids).toContain(BLACKWOOD_MEANING_IDS.RESPONSE_0_ACES);
    expect(ids).toContain(BLACKWOOD_MEANING_IDS.RESPONSE_1_ACE);
    expect(ids).toContain(BLACKWOOD_MEANING_IDS.RESPONSE_2_ACES);
    expect(ids).toContain(BLACKWOOD_MEANING_IDS.RESPONSE_3_ACES);
    expect(ids).toContain(BLACKWOOD_MEANING_IDS.ASK_KINGS);
    expect(ids).toContain(BLACKWOOD_MEANING_IDS.SIGNOFF_SMALL_SLAM);
    expect(ids).toContain(BLACKWOOD_MEANING_IDS.SIGNOFF_GRAND_SLAM);
    expect(ids).toContain(BLACKWOOD_MEANING_IDS.SIGNOFF_5_LEVEL);
  });

  it("idle phase requires fit kernel", () => {
    const idle = mod.states!.find((s) => s.phase === "idle")!;
    expect(idle.kernel).toEqual({ kind: "fit" });
  });

  it("has teaching content", () => {
    expect(mod.teaching).toBeDefined();
    expect(mod.teaching!.tradeoff).toBeTruthy();
    expect(mod.teaching!.principle).toBeTruthy();
    expect(mod.teaching!.commonMistakes).toHaveLength(2);
  });
});

describe("Blackwood fact evaluators", () => {
  const evaluators = mod.facts.evaluators;

  it("slamInterest is true for 15+ HCP in SAYC", () => {
    const facts = new Map([
      ["hand.hcp", { factId: "hand.hcp", value: 15 }],
    ]);
    const result = evaluators.get(BLACKWOOD_FACT_IDS.SLAM_INTEREST)!(
      makeHand(0, 0), { hcp: 15, distribution: { shortness: 0, length: 0, total: 0 }, shape: [3, 3, 4, 3], totalPoints: 15, strategy: "hcp" }, facts,
    );
    expect(result.value).toBe(true);
  });

  it("slamInterest is false for 14 HCP in SAYC", () => {
    const facts = new Map([
      ["hand.hcp", { factId: "hand.hcp", value: 14 }],
    ]);
    const result = evaluators.get(BLACKWOOD_FACT_IDS.SLAM_INTEREST)!(
      makeHand(0, 0), { hcp: 14, distribution: { shortness: 0, length: 0, total: 0 }, shape: [3, 3, 4, 3], totalPoints: 14, strategy: "hcp" }, facts,
    );
    expect(result.value).toBe(false);
  });

  it("aceCount correctly counts aces in hand", () => {
    const facts = new Map<string, { factId: string; value: number | boolean }>();
    const hand2Aces = makeHand(2, 0);
    const result = evaluators.get(BLACKWOOD_FACT_IDS.ACE_COUNT)!(
      hand2Aces, { hcp: 8, distribution: { shortness: 0, length: 0, total: 0 }, shape: [3, 3, 4, 3], totalPoints: 8, strategy: "hcp" }, facts,
    );
    expect(result.value).toBe(2);
  });

  it("kingCount correctly counts kings in hand", () => {
    const facts = new Map<string, { factId: string; value: number | boolean }>();
    const hand3Kings = makeHand(0, 3);
    const result = evaluators.get(BLACKWOOD_FACT_IDS.KING_COUNT)!(
      hand3Kings, { hcp: 9, distribution: { shortness: 0, length: 0, total: 0 }, shape: [3, 3, 4, 3], totalPoints: 9, strategy: "hcp" }, facts,
    );
    expect(result.value).toBe(3);
  });
});
