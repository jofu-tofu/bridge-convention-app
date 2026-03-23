import { FactLayer } from "./fact-layer";
import type { FactDefinition } from "./fact-catalog";

// ─── Shared facts ────────────────────────────────────────────
// Shared facts: bridge-universal vocabulary. Promote to bridge.* only when 2+ modules
// use it AND it can be named without a convention name. Module-specific facts belong
// in their module's FactCatalogExtension, not here.

export const PRIMITIVE_FACTS: readonly FactDefinition[] = [
  {
    id: "hand.hcp",
    layer: FactLayer.Primitive,
    world: "acting-hand",
    description: "High card points",
    valueType: "number",
    derivesFrom: [],
    constrainsDimensions: ["pointRange"],
  },
  {
    id: "hand.suitLength.spades",
    layer: FactLayer.Primitive,
    world: "acting-hand",
    description: "Number of spades",
    valueType: "number",
    derivesFrom: [],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: "hand.suitLength.hearts",
    layer: FactLayer.Primitive,
    world: "acting-hand",
    description: "Number of hearts",
    valueType: "number",
    derivesFrom: [],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: "hand.suitLength.diamonds",
    layer: FactLayer.Primitive,
    world: "acting-hand",
    description: "Number of diamonds",
    valueType: "number",
    derivesFrom: [],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: "hand.suitLength.clubs",
    layer: FactLayer.Primitive,
    world: "acting-hand",
    description: "Number of clubs",
    valueType: "number",
    derivesFrom: [],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: "hand.isBalanced",
    layer: FactLayer.Primitive,
    world: "acting-hand",
    description: "Hand is balanced (4-3-3-3, 4-4-3-2, 5-3-3-2)",
    valueType: "boolean",
    derivesFrom: [],
    constrainsDimensions: ["shapeClass"],
  },
];

export const BRIDGE_DERIVED_FACTS: readonly FactDefinition[] = [
  // NOTE: bridge.isVulnerable is context-seeded, not evaluator-derived.
  // It is pre-seeded from EvaluateFactsOptions.isVulnerable in fact-evaluator.ts
  // (computed from seat + deal vulnerability, not from hand analysis).
  // It has no evaluator in shared-fact-catalog.ts. Callers must provide the
  // isVulnerable option if modules depend on it (e.g., weak-twos uses it
  // to adjust opening HCP range: 5-11 NV vs 6-11 vul).
  {
    id: "bridge.isVulnerable",
    layer: FactLayer.BridgeDerived,
    world: "acting-hand",
    description: "Whether the acting player's side is vulnerable (context-seeded, not evaluator-derived)",
    valueType: "boolean",
    derivesFrom: [],
    constrainsDimensions: [],
  },
  {
    id: "bridge.hasFourCardMajor",
    layer: FactLayer.BridgeDerived,
    world: "acting-hand",
    description: "Has at least one 4+ card major",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.spades", "hand.suitLength.hearts"],
    constrainsDimensions: ["suitIdentity"],
  },
  {
    id: "bridge.hasFiveCardMajor",
    layer: FactLayer.BridgeDerived,
    world: "acting-hand",
    description: "Has at least one 5+ card major",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.spades", "hand.suitLength.hearts"],
    constrainsDimensions: ["suitIdentity"],
  },
  {
    id: "bridge.majorPattern",
    layer: FactLayer.BridgeDerived,
    world: "acting-hand",
    description:
      "Major suit pattern classification (none, one-four, both-four, one-five, five-four, five-five)",
    valueType: "string",
    derivesFrom: ["hand.suitLength.spades", "hand.suitLength.hearts"],
    constrainsDimensions: ["suitIdentity", "suitRelation"],
  },
  {
    id: "bridge.supportForBoundSuit",
    layer: FactLayer.BridgeDerived,
    world: "acting-hand",
    description: "Length in the suit specified by $suit binding",
    valueType: "number",
    derivesFrom: ["hand.suitLength.spades", "hand.suitLength.hearts", "hand.suitLength.diamonds", "hand.suitLength.clubs"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: "bridge.fitWithBoundSuit",
    layer: FactLayer.BridgeDerived,
    world: "acting-hand",
    description: "8+ combined cards in the bound suit (own length + partner's promised min)",
    valueType: "boolean",
    derivesFrom: ["bridge.supportForBoundSuit"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: "bridge.hasShortage",
    layer: FactLayer.BridgeDerived,
    world: "acting-hand",
    description: "Has singleton or void in any suit (for splinter detection)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.spades", "hand.suitLength.hearts", "hand.suitLength.diamonds", "hand.suitLength.clubs"],
    constrainsDimensions: ["shapeClass"],
  },
  {
    id: "bridge.shortageInSuit",
    layer: FactLayer.BridgeDerived,
    world: "acting-hand",
    description: "Has 0-1 cards in the suit specified by $suit binding",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.spades", "hand.suitLength.hearts", "hand.suitLength.diamonds", "hand.suitLength.clubs"],
    constrainsDimensions: ["suitIdentity", "shapeClass"],
  },
  {
    id: "bridge.totalPointsForRaise",
    layer: FactLayer.BridgeDerived,
    world: "acting-hand",
    description: "Dummy points (HCP + shortage points) for raising the bound suit",
    valueType: "number",
    derivesFrom: ["hand.hcp", "hand.suitLength.spades", "hand.suitLength.hearts", "hand.suitLength.diamonds", "hand.suitLength.clubs"],
    constrainsDimensions: ["pointRange"],
  },
];

// Posterior-derived facts compute probabilities over hand samples.
// The computation logic (e.g., "count hands with 4+ hearts") is bridge-universal
// and system-agnostic — they belong in bridge-derived. The *prior* hand space
// (constraints on partner's hand from the auction) may be system-dependent,
// but that's handled by the posterior engine, not by these fact definitions.
export const POSTERIOR_DERIVED_FACTS: readonly FactDefinition[] = [
  {
    id: "bridge.partnerHas4HeartsLikely",
    layer: FactLayer.BridgeDerived,
    world: "acting-hand",
    description: "Posterior probability that partner has 4+ hearts",
    valueType: "number",
    constrainsDimensions: [],
  },
  {
    id: "bridge.partnerHas4SpadesLikely",
    layer: FactLayer.BridgeDerived,
    world: "acting-hand",
    description: "Posterior probability that partner has 4+ spades",
    valueType: "number",
    constrainsDimensions: [],
  },
  {
    id: "bridge.partnerHas4DiamondsLikely",
    layer: FactLayer.BridgeDerived,
    world: "acting-hand",
    description: "Posterior probability that partner has 4+ diamonds",
    valueType: "number",
    constrainsDimensions: [],
  },
  {
    id: "bridge.partnerHas4ClubsLikely",
    layer: FactLayer.BridgeDerived,
    world: "acting-hand",
    description: "Posterior probability that partner has 4+ clubs",
    valueType: "number",
    constrainsDimensions: [],
  },
  {
    id: "bridge.combinedHcpInRangeLikely",
    layer: FactLayer.BridgeDerived,
    world: "acting-hand",
    description: "Posterior probability that combined HCP falls in specified range",
    valueType: "number",
    constrainsDimensions: [],
  },
];

/** Shared facts (primitive + bridge-derived + posterior-derived). Module-derived facts live in FactCatalogExtensions. */
export const SHARED_FACTS: readonly FactDefinition[] = [
  ...PRIMITIVE_FACTS,
  ...BRIDGE_DERIVED_FACTS,
  ...POSTERIOR_DERIVED_FACTS,
];
