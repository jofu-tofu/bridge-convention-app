import { FactLayer } from "./fact-layer";
import type { FactDefinition } from "./fact-catalog";
import {
  HAND_HCP,
  HAND_SUIT_LENGTH_SPADES,
  HAND_SUIT_LENGTH_HEARTS,
  HAND_SUIT_LENGTH_DIAMONDS,
  HAND_SUIT_LENGTH_CLUBS,
  HAND_IS_BALANCED,
  BRIDGE_IS_VULNERABLE,
  BRIDGE_HAS_FOUR_CARD_MAJOR,
  BRIDGE_HAS_FIVE_CARD_MAJOR,
  BRIDGE_MAJOR_PATTERN,
  BRIDGE_SUPPORT_FOR_BOUND_SUIT,
  BRIDGE_FIT_WITH_BOUND_SUIT,
  BRIDGE_HAS_SHORTAGE,
  BRIDGE_SHORTAGE_IN_SUIT,
  BRIDGE_TOTAL_POINTS_FOR_RAISE,
  BRIDGE_PARTNER_HAS_4_HEARTS_LIKELY,
  BRIDGE_PARTNER_HAS_4_SPADES_LIKELY,
  BRIDGE_PARTNER_HAS_4_DIAMONDS_LIKELY,
  BRIDGE_PARTNER_HAS_4_CLUBS_LIKELY,
  BRIDGE_COMBINED_HCP_IN_RANGE_LIKELY,
} from "./shared-fact-vocabulary";

// ─── Shared facts ────────────────────────────────────────────
// Shared facts: bridge-universal vocabulary. Promote to bridge.* only when 2+ modules
// use it AND it can be named without a convention name. Module-specific facts belong
// in their module's FactCatalogExtension, not here.

export const PRIMITIVE_FACTS: readonly FactDefinition[] = [
  {
    id: HAND_HCP,
    layer: FactLayer.Primitive,
    world: "acting-hand",
    description: "High card points",
    valueType: "number",
    derivesFrom: [],
    constrainsDimensions: ["pointRange"],
  },
  {
    id: HAND_SUIT_LENGTH_SPADES,
    layer: FactLayer.Primitive,
    world: "acting-hand",
    description: "Number of spades",
    valueType: "number",
    derivesFrom: [],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: HAND_SUIT_LENGTH_HEARTS,
    layer: FactLayer.Primitive,
    world: "acting-hand",
    description: "Number of hearts",
    valueType: "number",
    derivesFrom: [],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: HAND_SUIT_LENGTH_DIAMONDS,
    layer: FactLayer.Primitive,
    world: "acting-hand",
    description: "Number of diamonds",
    valueType: "number",
    derivesFrom: [],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: HAND_SUIT_LENGTH_CLUBS,
    layer: FactLayer.Primitive,
    world: "acting-hand",
    description: "Number of clubs",
    valueType: "number",
    derivesFrom: [],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: HAND_IS_BALANCED,
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
    id: BRIDGE_IS_VULNERABLE,
    layer: FactLayer.BridgeDerived,
    world: "acting-hand",
    description: "Whether the acting player's side is vulnerable (context-seeded, not evaluator-derived)",
    valueType: "boolean",
    derivesFrom: [],
    constrainsDimensions: [],
  },
  {
    id: BRIDGE_HAS_FOUR_CARD_MAJOR,
    layer: FactLayer.BridgeDerived,
    world: "acting-hand",
    description: "Has at least one 4+ card major",
    valueType: "boolean",
    derivesFrom: [HAND_SUIT_LENGTH_SPADES, HAND_SUIT_LENGTH_HEARTS],
    constrainsDimensions: ["suitIdentity"],
  },
  {
    id: BRIDGE_HAS_FIVE_CARD_MAJOR,
    layer: FactLayer.BridgeDerived,
    world: "acting-hand",
    description: "Has at least one 5+ card major",
    valueType: "boolean",
    derivesFrom: [HAND_SUIT_LENGTH_SPADES, HAND_SUIT_LENGTH_HEARTS],
    constrainsDimensions: ["suitIdentity"],
  },
  {
    id: BRIDGE_MAJOR_PATTERN,
    layer: FactLayer.BridgeDerived,
    world: "acting-hand",
    description:
      "Major suit pattern classification (none, one-four, both-four, one-five, five-four, five-five)",
    valueType: "string",
    derivesFrom: [HAND_SUIT_LENGTH_SPADES, HAND_SUIT_LENGTH_HEARTS],
    constrainsDimensions: ["suitIdentity", "suitRelation"],
  },
  {
    id: BRIDGE_SUPPORT_FOR_BOUND_SUIT,
    layer: FactLayer.BridgeDerived,
    world: "acting-hand",
    description: "Length in the suit specified by $suit binding",
    valueType: "number",
    derivesFrom: [HAND_SUIT_LENGTH_SPADES, HAND_SUIT_LENGTH_HEARTS, HAND_SUIT_LENGTH_DIAMONDS, HAND_SUIT_LENGTH_CLUBS],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: BRIDGE_FIT_WITH_BOUND_SUIT,
    layer: FactLayer.BridgeDerived,
    world: "acting-hand",
    description: "8+ combined cards in the bound suit (own length + partner's promised min)",
    valueType: "boolean",
    derivesFrom: [BRIDGE_SUPPORT_FOR_BOUND_SUIT],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: BRIDGE_HAS_SHORTAGE,
    layer: FactLayer.BridgeDerived,
    world: "acting-hand",
    description: "Has singleton or void in any suit (for splinter detection)",
    valueType: "boolean",
    derivesFrom: [HAND_SUIT_LENGTH_SPADES, HAND_SUIT_LENGTH_HEARTS, HAND_SUIT_LENGTH_DIAMONDS, HAND_SUIT_LENGTH_CLUBS],
    constrainsDimensions: ["shapeClass"],
  },
  {
    id: BRIDGE_SHORTAGE_IN_SUIT,
    layer: FactLayer.BridgeDerived,
    world: "acting-hand",
    description: "Has 0-1 cards in the suit specified by $suit binding",
    valueType: "boolean",
    derivesFrom: [HAND_SUIT_LENGTH_SPADES, HAND_SUIT_LENGTH_HEARTS, HAND_SUIT_LENGTH_DIAMONDS, HAND_SUIT_LENGTH_CLUBS],
    constrainsDimensions: ["suitIdentity", "shapeClass"],
  },
  {
    id: BRIDGE_TOTAL_POINTS_FOR_RAISE,
    layer: FactLayer.BridgeDerived,
    world: "acting-hand",
    description: "Dummy points (HCP + shortage points) for raising the bound suit",
    valueType: "number",
    derivesFrom: [HAND_HCP, HAND_SUIT_LENGTH_SPADES, HAND_SUIT_LENGTH_HEARTS, HAND_SUIT_LENGTH_DIAMONDS, HAND_SUIT_LENGTH_CLUBS],
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
    id: BRIDGE_PARTNER_HAS_4_HEARTS_LIKELY,
    layer: FactLayer.BridgeDerived,
    world: "acting-hand",
    description: "Posterior probability that partner has 4+ hearts",
    valueType: "number",
    constrainsDimensions: [],
  },
  {
    id: BRIDGE_PARTNER_HAS_4_SPADES_LIKELY,
    layer: FactLayer.BridgeDerived,
    world: "acting-hand",
    description: "Posterior probability that partner has 4+ spades",
    valueType: "number",
    constrainsDimensions: [],
  },
  {
    id: BRIDGE_PARTNER_HAS_4_DIAMONDS_LIKELY,
    layer: FactLayer.BridgeDerived,
    world: "acting-hand",
    description: "Posterior probability that partner has 4+ diamonds",
    valueType: "number",
    constrainsDimensions: [],
  },
  {
    id: BRIDGE_PARTNER_HAS_4_CLUBS_LIKELY,
    layer: FactLayer.BridgeDerived,
    world: "acting-hand",
    description: "Posterior probability that partner has 4+ clubs",
    valueType: "number",
    constrainsDimensions: [],
  },
  {
    id: BRIDGE_COMBINED_HCP_IN_RANGE_LIKELY,
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
