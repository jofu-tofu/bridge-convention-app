import type {
  FactCatalogExtension,
  FactDefinition,
  FactEvaluatorFn,
} from "../../../core/contracts/fact-catalog";
import { num, fv } from "../../../core/contracts/fact-catalog";
import { Rank, Suit } from "../../../engine/types";
import type { Hand } from "../../../engine/types";
import { SUIT_NAME_MAP } from "../../../engine/constants";

// ─── Top honor counting helper ──────────────────────────────

const TOP_HONORS = new Set([Rank.Ace, Rank.King, Rank.Queen]);

function countTopHonorsInSuit(hand: Hand, suitName: string): number {
  const suit = SUIT_NAME_MAP[suitName as keyof typeof SUIT_NAME_MAP] ?? Suit.Clubs;
  return hand.cards.filter(
    (c) => c.suit === suit && TOP_HONORS.has(c.rank),
  ).length;
}

// ─── Weak Two module facts ──────────────────────────────────

const WEAK_TWO_FACTS: readonly FactDefinition[] = [
  {
    id: "module.weakTwo.topHonorCount.hearts",
    layer: "module-derived",
    world: "acting-hand",
    description: "Count of A, K, Q in hearts",
    valueType: "number",
    derivesFrom: [],
    constrainsDimensions: ["suitIdentity", "suitQuality"],
  },
  {
    id: "module.weakTwo.topHonorCount.spades",
    layer: "module-derived",
    world: "acting-hand",
    description: "Count of A, K, Q in spades",
    valueType: "number",
    derivesFrom: [],
    constrainsDimensions: ["suitIdentity", "suitQuality"],
  },
  {
    id: "module.weakTwo.topHonorCount.diamonds",
    layer: "module-derived",
    world: "acting-hand",
    description: "Count of A, K, Q in diamonds",
    valueType: "number",
    derivesFrom: [],
    constrainsDimensions: ["suitIdentity", "suitQuality"],
  },
  {
    id: "module.weakTwo.isMinimum",
    layer: "module-derived",
    world: "acting-hand",
    description: "Opener is minimum for weak two (5-8 NV, 6-8 vul)",
    valueType: "boolean",
    derivesFrom: ["hand.hcp", "bridge.isVulnerable"],
    constrainsDimensions: ["pointRange"],
  },
  {
    id: "module.weakTwo.isMaximum",
    layer: "module-derived",
    world: "acting-hand",
    description: "Opener is maximum for weak two (9-11 HCP)",
    valueType: "boolean",
    derivesFrom: ["hand.hcp"],
    constrainsDimensions: ["pointRange"],
  },
  {
    id: "module.weakTwo.inOpeningHcpRange",
    layer: "module-derived",
    world: "acting-hand",
    description: "HCP in weak two opening range (5-11 NV, 6-11 vul)",
    valueType: "boolean",
    derivesFrom: ["hand.hcp", "bridge.isVulnerable"],
    constrainsDimensions: ["pointRange"],
  },
  {
    id: "module.weakTwo.isSolid.hearts",
    layer: "module-derived",
    world: "acting-hand",
    description: "All three top honors (AKQ) in hearts",
    valueType: "boolean",
    derivesFrom: ["module.weakTwo.topHonorCount.hearts"],
    constrainsDimensions: ["suitIdentity", "suitLength", "suitQuality", "shapeClass"],
  },
  {
    id: "module.weakTwo.isSolid.spades",
    layer: "module-derived",
    world: "acting-hand",
    description: "All three top honors (AKQ) in spades",
    valueType: "boolean",
    derivesFrom: ["module.weakTwo.topHonorCount.spades"],
    constrainsDimensions: ["suitIdentity", "suitLength", "suitQuality", "shapeClass"],
  },
  {
    id: "module.weakTwo.isSolid.diamonds",
    layer: "module-derived",
    world: "acting-hand",
    description: "All three top honors (AKQ) in diamonds",
    valueType: "boolean",
    derivesFrom: ["module.weakTwo.topHonorCount.diamonds"],
    constrainsDimensions: ["suitIdentity", "suitLength", "suitQuality", "shapeClass"],
  },
];

const WEAK_TWO_EVALUATORS = new Map<string, FactEvaluatorFn>([
  // Top honor counts per suit
  ["module.weakTwo.topHonorCount.hearts", (h, _ev, _m) =>
    fv("module.weakTwo.topHonorCount.hearts", countTopHonorsInSuit(h, "hearts"))],
  ["module.weakTwo.topHonorCount.spades", (h, _ev, _m) =>
    fv("module.weakTwo.topHonorCount.spades", countTopHonorsInSuit(h, "spades"))],
  ["module.weakTwo.topHonorCount.diamonds", (h, _ev, _m) =>
    fv("module.weakTwo.topHonorCount.diamonds", countTopHonorsInSuit(h, "diamonds"))],

  // Min/max classification (vulnerability-aware)
  ["module.weakTwo.isMinimum", (_h, _ev, m) => {
    const hcp = num(m, "hand.hcp");
    const vul = m.get("bridge.isVulnerable")?.value === true;
    const minHcp = vul ? 6 : 5;
    return fv("module.weakTwo.isMinimum", hcp >= minHcp && hcp <= 8);
  }],
  ["module.weakTwo.isMaximum", (_h, _ev, m) => {
    const hcp = num(m, "hand.hcp");
    return fv("module.weakTwo.isMaximum", hcp >= 9 && hcp <= 11);
  }],

  // Opening HCP range (vulnerability-aware)
  ["module.weakTwo.inOpeningHcpRange", (_h, _ev, m) => {
    const hcp = num(m, "hand.hcp");
    const vul = m.get("bridge.isVulnerable")?.value === true;
    const minHcp = vul ? 6 : 5;
    return fv("module.weakTwo.inOpeningHcpRange", hcp >= minHcp && hcp <= 11);
  }],

  // Solid (AKQ) per suit
  ["module.weakTwo.isSolid.hearts", (_h, _ev, m) =>
    fv("module.weakTwo.isSolid.hearts", num(m, "module.weakTwo.topHonorCount.hearts") === 3)],
  ["module.weakTwo.isSolid.spades", (_h, _ev, m) =>
    fv("module.weakTwo.isSolid.spades", num(m, "module.weakTwo.topHonorCount.spades") === 3)],
  ["module.weakTwo.isSolid.diamonds", (_h, _ev, m) =>
    fv("module.weakTwo.isSolid.diamonds", num(m, "module.weakTwo.topHonorCount.diamonds") === 3)],
]);

export const weakTwoFacts: FactCatalogExtension = {
  definitions: WEAK_TWO_FACTS,
  evaluators: WEAK_TWO_EVALUATORS,
};
