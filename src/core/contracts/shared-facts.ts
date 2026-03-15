import type { FactDefinition } from "./fact-catalog";

// ─── Shared facts ────────────────────────────────────────────
// Shared facts: bridge-universal vocabulary. Promote to bridge.* only when 2+ modules
// use it AND it can be named without a convention name. Module-specific facts belong
// in their module's FactCatalogExtension, not here.

export const PRIMITIVE_FACTS: readonly FactDefinition[] = [
  {
    id: "hand.hcp",
    layer: "primitive",
    world: "acting-hand",
    description: "High card points",
    valueType: "number",
    derivesFrom: [],
  },
  {
    id: "hand.suitLength.spades",
    layer: "primitive",
    world: "acting-hand",
    description: "Number of spades",
    valueType: "number",
    derivesFrom: [],
  },
  {
    id: "hand.suitLength.hearts",
    layer: "primitive",
    world: "acting-hand",
    description: "Number of hearts",
    valueType: "number",
    derivesFrom: [],
  },
  {
    id: "hand.suitLength.diamonds",
    layer: "primitive",
    world: "acting-hand",
    description: "Number of diamonds",
    valueType: "number",
    derivesFrom: [],
  },
  {
    id: "hand.suitLength.clubs",
    layer: "primitive",
    world: "acting-hand",
    description: "Number of clubs",
    valueType: "number",
    derivesFrom: [],
  },
  {
    id: "hand.isBalanced",
    layer: "primitive",
    world: "acting-hand",
    description: "Hand is balanced (4-3-3-3, 4-4-3-2, 5-3-3-2)",
    valueType: "boolean",
    derivesFrom: [],
  },
];

export const BRIDGE_DERIVED_FACTS: readonly FactDefinition[] = [
  {
    id: "bridge.hasFourCardMajor",
    layer: "bridge-derived",
    world: "acting-hand",
    description: "Has at least one 4+ card major",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.spades", "hand.suitLength.hearts"],
  },
  {
    id: "bridge.hasFiveCardMajor",
    layer: "bridge-derived",
    world: "acting-hand",
    description: "Has at least one 5+ card major",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.spades", "hand.suitLength.hearts"],
  },
  {
    id: "bridge.majorPattern",
    layer: "bridge-derived",
    world: "acting-hand",
    description:
      "Major suit pattern classification (none, one-four, both-four, one-five, five-four, five-five)",
    valueType: "string",
    derivesFrom: ["hand.suitLength.spades", "hand.suitLength.hearts"],
  },
  {
    id: "bridge.supportForBoundSuit",
    layer: "bridge-derived",
    world: "acting-hand",
    description: "Length in the suit specified by $suit binding",
    valueType: "number",
    derivesFrom: ["hand.suitLength.spades", "hand.suitLength.hearts", "hand.suitLength.diamonds", "hand.suitLength.clubs"],
  },
  {
    id: "bridge.fitWithBoundSuit",
    layer: "bridge-derived",
    world: "acting-hand",
    description: "8+ combined cards in the bound suit (own length + partner's promised min)",
    valueType: "boolean",
    derivesFrom: ["bridge.supportForBoundSuit"],
  },
  {
    id: "bridge.hasShortage",
    layer: "bridge-derived",
    world: "acting-hand",
    description: "Has singleton or void in any suit (for splinter detection)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.spades", "hand.suitLength.hearts", "hand.suitLength.diamonds", "hand.suitLength.clubs"],
    metadata: { negatable: true, explainable: true },
  },
  {
    id: "bridge.shortageInSuit",
    layer: "bridge-derived",
    world: "acting-hand",
    description: "Has 0-1 cards in the suit specified by $suit binding",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.spades", "hand.suitLength.hearts", "hand.suitLength.diamonds", "hand.suitLength.clubs"],
  },
  {
    id: "bridge.totalPointsForRaise",
    layer: "bridge-derived",
    world: "acting-hand",
    description: "Dummy points (HCP + shortage points) for raising the bound suit",
    valueType: "number",
    derivesFrom: ["hand.hcp", "hand.suitLength.spades", "hand.suitLength.hearts", "hand.suitLength.diamonds", "hand.suitLength.clubs"],
  },
];

export const POSTERIOR_DERIVED_FACTS: readonly FactDefinition[] = [
  {
    id: "bridge.partnerHas4CardMajorLikely",
    layer: "bridge-derived",
    world: "acting-hand",
    description: "Posterior probability that partner has a 4+ card major in specified suit",
    valueType: "number",
    metadata: { inferable: true, explainable: true },
  },
  {
    id: "bridge.combinedHcpInRangeLikely",
    layer: "bridge-derived",
    world: "acting-hand",
    description: "Posterior probability that combined HCP falls in specified range",
    valueType: "number",
    metadata: { inferable: true, explainable: true },
  },
];

/** Shared facts (primitive + bridge-derived + posterior-derived). Module-derived facts live in FactCatalogExtensions. */
export const SHARED_FACTS: readonly FactDefinition[] = [
  ...PRIMITIVE_FACTS,
  ...BRIDGE_DERIVED_FACTS,
  ...POSTERIOR_DERIVED_FACTS,
];
