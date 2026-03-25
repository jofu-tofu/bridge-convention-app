import { FactLayer } from "../../../core/fact-layer";
import type {
  FactCatalogExtension,
  FactDefinition,
  FactEvaluatorFn,
  FactComposition,
} from "../../../core/fact-catalog";
import { fv } from "../../../pipeline/facts/fact-helpers";
import {
  defineBooleanFact,
  buildExtension,
} from "../../../pipeline/facts/fact-factory";
import type { FactEntry } from "../../../pipeline/facts/fact-factory";
import type { Hand } from "../../../../engine/types";
import { Suit } from "../../../../engine/types";
import { suitLengthOf } from "../../../../engine/hand-evaluator";
import { DONT_FACT_IDS } from "./ids";

// ─── Helpers ────────────────────────────────────────────────

function longestSuitExcluding(
  hand: Hand,
  exclude: Suit[],
): { suit: Suit; length: number } {
  const suits = [Suit.Spades, Suit.Hearts, Suit.Diamonds, Suit.Clubs].filter(
    (s) => !exclude.includes(s),
  );
  if (suits.length === 0) return { suit: Suit.Clubs, length: 0 };
  let best = suits[0]!;
  let bestLen = suitLengthOf(hand, best);
  for (const s of suits.slice(1)) {
    const len = suitLengthOf(hand, s);
    if (len > bestLen) {
      best = s;
      bestLen = len;
    }
  }
  return { suit: best, length: bestLen };
}

// ─── Factory-based facts (simple suit-length comparisons) ───

const naturalSpadesEntry = defineBooleanFact({
  id: DONT_FACT_IDS.NATURAL_SPADES,
  description: "S6+ — natural spades for 2S bid",
  factId: "hand.suitLength.spades",
  operator: "gte",
  value: 6,
  constrainsDimensions: ["suitIdentity", "suitLength"],
  derivesFrom: [],
});

const hasSpadeSupportEntry = defineBooleanFact({
  id: DONT_FACT_IDS.HAS_SPADE_SUPPORT,
  description: "3+ spades",
  factId: "hand.suitLength.spades",
  operator: "gte",
  value: 3,
  constrainsDimensions: ["suitIdentity", "suitLength"],
  derivesFrom: [],
});

const hasDiamondSupportEntry = defineBooleanFact({
  id: DONT_FACT_IDS.HAS_DIAMOND_SUPPORT,
  description: "3+ diamonds",
  factId: "hand.suitLength.diamonds",
  operator: "gte",
  value: 3,
  constrainsDimensions: ["suitIdentity", "suitLength"],
  derivesFrom: [],
});

const hasClubSupportEntry = defineBooleanFact({
  id: DONT_FACT_IDS.HAS_CLUB_SUPPORT,
  description: "3+ clubs",
  factId: "hand.suitLength.clubs",
  operator: "gte",
  value: 3,
  constrainsDimensions: ["suitIdentity", "suitLength"],
  derivesFrom: [],
});

// ─── Hand-written facts (complex evaluators with composition) ─

function handWrittenEntry(
  definition: FactDefinition,
  evaluator: FactEvaluatorFn,
): FactEntry {
  return { definition, evaluator: [definition.id, evaluator] };
}

// Composition: H5+S4+ OR S5+H4+ (loose activation prerequisite)
const BOTH_MAJORS_COMPOSITION: FactComposition = {
  kind: "or",
  operands: [
    { kind: "and", operands: [
      { kind: "primitive", clause: { factId: "hand.suitLength.hearts", operator: "gte", value: 5 } },
      { kind: "primitive", clause: { factId: "hand.suitLength.spades", operator: "gte", value: 4 } },
    ]},
    { kind: "and", operands: [
      { kind: "primitive", clause: { factId: "hand.suitLength.spades", operator: "gte", value: 5 } },
      { kind: "primitive", clause: { factId: "hand.suitLength.hearts", operator: "gte", value: 4 } },
    ]},
  ],
};

const bothMajorsEntry = handWrittenEntry(
  {
    id: DONT_FACT_IDS.BOTH_MAJORS,
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "H5+S4+ or S5+H4+ — both majors for 2H bid",
    valueType: "boolean",
    derivesFrom: [],
    constrainsDimensions: ["suitIdentity", "suitLength", "suitRelation"],
    composition: BOTH_MAJORS_COMPOSITION,
  },
  (h, _ev, _m) => {
    const hearts = suitLengthOf(h, Suit.Hearts);
    const spades = suitLengthOf(h, Suit.Spades);
    return fv(
      DONT_FACT_IDS.BOTH_MAJORS,
      (hearts >= 5 && spades >= 4) || (spades >= 5 && hearts >= 4),
    );
  },
);

// Composition: D5+ AND (H4+ OR S4+)
const DIAMONDS_AND_MAJOR_COMPOSITION: FactComposition = {
  kind: "and",
  operands: [
    { kind: "primitive", clause: { factId: "hand.suitLength.diamonds", operator: "gte", value: 5 } },
    { kind: "or", operands: [
      { kind: "primitive", clause: { factId: "hand.suitLength.hearts", operator: "gte", value: 4 } },
      { kind: "primitive", clause: { factId: "hand.suitLength.spades", operator: "gte", value: 4 } },
    ]},
  ],
};

const diamondsAndMajorEntry = handWrittenEntry(
  {
    id: DONT_FACT_IDS.DIAMONDS_AND_MAJOR,
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "D5+ and (H4+ or S4+) — diamonds + a major for 2D bid",
    valueType: "boolean",
    derivesFrom: [],
    constrainsDimensions: ["suitIdentity", "suitLength", "suitRelation"],
    composition: DIAMONDS_AND_MAJOR_COMPOSITION,
  },
  (h, _ev, _m) => {
    const diamonds = suitLengthOf(h, Suit.Diamonds);
    const hearts = suitLengthOf(h, Suit.Hearts);
    const spades = suitLengthOf(h, Suit.Spades);
    return fv(
      DONT_FACT_IDS.DIAMONDS_AND_MAJOR,
      diamonds >= 5 && (hearts >= 4 || spades >= 4),
    );
  },
);

// Composition: C5+ AND (D4+ OR H4+ OR S4+)
const CLUBS_AND_HIGHER_COMPOSITION: FactComposition = {
  kind: "and",
  operands: [
    { kind: "primitive", clause: { factId: "hand.suitLength.clubs", operator: "gte", value: 5 } },
    { kind: "or", operands: [
      { kind: "primitive", clause: { factId: "hand.suitLength.diamonds", operator: "gte", value: 4 } },
      { kind: "primitive", clause: { factId: "hand.suitLength.hearts", operator: "gte", value: 4 } },
      { kind: "primitive", clause: { factId: "hand.suitLength.spades", operator: "gte", value: 4 } },
    ]},
  ],
};

const clubsAndHigherEntry = handWrittenEntry(
  {
    id: DONT_FACT_IDS.CLUBS_AND_HIGHER,
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "C5+ and (D4+ or H4+ or S4+) — clubs + higher suit for 2C bid",
    valueType: "boolean",
    derivesFrom: [],
    constrainsDimensions: ["suitIdentity", "suitLength", "suitRelation"],
    composition: CLUBS_AND_HIGHER_COMPOSITION,
  },
  (h, _ev, _m) => {
    const clubs = suitLengthOf(h, Suit.Clubs);
    const diamonds = suitLengthOf(h, Suit.Diamonds);
    const hearts = suitLengthOf(h, Suit.Hearts);
    const spades = suitLengthOf(h, Suit.Spades);
    return fv(
      DONT_FACT_IDS.CLUBS_AND_HIGHER,
      clubs >= 5 && (diamonds >= 4 || hearts >= 4 || spades >= 4),
    );
  },
);

// Composition: loose approximation — one non-spade suit 6+ (evaluator also requires
// no other suit 4+ and longest ≠ spades, but composition only needs activation prerequisite)
const SINGLE_SUITED_COMPOSITION: FactComposition = {
  kind: "or",
  operands: [
    { kind: "primitive", clause: { factId: "hand.suitLength.clubs", operator: "gte", value: 6 } },
    { kind: "primitive", clause: { factId: "hand.suitLength.diamonds", operator: "gte", value: 6 } },
    { kind: "primitive", clause: { factId: "hand.suitLength.hearts", operator: "gte", value: 6 } },
  ],
};

const singleSuitedEntry = handWrittenEntry(
  {
    id: DONT_FACT_IDS.SINGLE_SUITED,
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "One suit 6+, no other suit 4+, longest suit is not spades — for double",
    valueType: "boolean",
    derivesFrom: [],
    constrainsDimensions: ["shapeClass", "suitLength", "suitIdentity"],
    composition: SINGLE_SUITED_COMPOSITION,
  },
  (h, _ev, _m) => {
    const lengths: { suit: Suit; length: number }[] = [
      { suit: Suit.Spades, length: suitLengthOf(h, Suit.Spades) },
      { suit: Suit.Hearts, length: suitLengthOf(h, Suit.Hearts) },
      { suit: Suit.Diamonds, length: suitLengthOf(h, Suit.Diamonds) },
      { suit: Suit.Clubs, length: suitLengthOf(h, Suit.Clubs) },
    ];
    const longest = lengths.reduce((a, b) => (b.length > a.length ? b : a));
    if (longest.length < 6 || longest.suit === Suit.Spades) {
      return fv(DONT_FACT_IDS.SINGLE_SUITED, false);
    }
    const otherHas4Plus = lengths.some(
      (l) => l.suit !== longest.suit && l.length >= 4,
    );
    return fv(DONT_FACT_IDS.SINGLE_SUITED, !otherHas4Plus);
  },
);

// Overcaller reveal facts (after X → 2C)
const singleSuitClubsEntry = handWrittenEntry(
  {
    id: DONT_FACT_IDS.SINGLE_SUIT_CLUBS,
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "The 6+ single suit is clubs",
    valueType: "boolean",
    derivesFrom: [DONT_FACT_IDS.SINGLE_SUITED],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  (h, _ev, _m) => {
    const longest = longestSuitExcluding(h, []);
    return fv(
      DONT_FACT_IDS.SINGLE_SUIT_CLUBS,
      longest.suit === Suit.Clubs && longest.length >= 6,
    );
  },
);

const singleSuitDiamondsEntry = handWrittenEntry(
  {
    id: DONT_FACT_IDS.SINGLE_SUIT_DIAMONDS,
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "The 6+ single suit is diamonds",
    valueType: "boolean",
    derivesFrom: [DONT_FACT_IDS.SINGLE_SUITED],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  (h, _ev, _m) => {
    const longest = longestSuitExcluding(h, []);
    return fv(
      DONT_FACT_IDS.SINGLE_SUIT_DIAMONDS,
      longest.suit === Suit.Diamonds && longest.length >= 6,
    );
  },
);

const singleSuitHeartsEntry = handWrittenEntry(
  {
    id: DONT_FACT_IDS.SINGLE_SUIT_HEARTS,
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "The 6+ single suit is hearts",
    valueType: "boolean",
    derivesFrom: [DONT_FACT_IDS.SINGLE_SUITED],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  (h, _ev, _m) => {
    const longest = longestSuitExcluding(h, []);
    return fv(
      DONT_FACT_IDS.SINGLE_SUIT_HEARTS,
      longest.suit === Suit.Hearts && longest.length >= 6,
    );
  },
);

// 2C relay response facts
const clubsHigherDiamondsEntry = handWrittenEntry(
  {
    id: DONT_FACT_IDS.CLUBS_HIGHER_DIAMONDS,
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "With clubs as anchor, higher suit is diamonds",
    valueType: "boolean",
    derivesFrom: [DONT_FACT_IDS.CLUBS_AND_HIGHER],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  (h, _ev, _m) => {
    const d = suitLengthOf(h, Suit.Diamonds);
    const hr = suitLengthOf(h, Suit.Hearts);
    const s = suitLengthOf(h, Suit.Spades);
    const isDiamonds = d >= 4 && d > hr && d > s;
    return fv(DONT_FACT_IDS.CLUBS_HIGHER_DIAMONDS, isDiamonds);
  },
);

const clubsHigherHeartsEntry = handWrittenEntry(
  {
    id: DONT_FACT_IDS.CLUBS_HIGHER_HEARTS,
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "With clubs as anchor, higher suit is hearts",
    valueType: "boolean",
    derivesFrom: [DONT_FACT_IDS.CLUBS_AND_HIGHER],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  (h, _ev, _m) => {
    const d = suitLengthOf(h, Suit.Diamonds);
    const hr = suitLengthOf(h, Suit.Hearts);
    const s = suitLengthOf(h, Suit.Spades);
    const isHearts = hr >= 4 && hr >= d && hr > s;
    return fv(DONT_FACT_IDS.CLUBS_HIGHER_HEARTS, isHearts);
  },
);

const clubsHigherSpadesEntry = handWrittenEntry(
  {
    id: DONT_FACT_IDS.CLUBS_HIGHER_SPADES,
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "With clubs as anchor, higher suit is spades",
    valueType: "boolean",
    derivesFrom: [DONT_FACT_IDS.CLUBS_AND_HIGHER],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  (h, _ev, _m) => {
    const d = suitLengthOf(h, Suit.Diamonds);
    const hr = suitLengthOf(h, Suit.Hearts);
    const s = suitLengthOf(h, Suit.Spades);
    const isSpades = s >= 4 && s >= hr && s >= d;
    return fv(DONT_FACT_IDS.CLUBS_HIGHER_SPADES, isSpades);
  },
);

// 2D relay response facts
const diamondsMajorHeartsEntry = handWrittenEntry(
  {
    id: DONT_FACT_IDS.DIAMONDS_MAJOR_HEARTS,
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "With diamonds as anchor, the major is hearts",
    valueType: "boolean",
    derivesFrom: [DONT_FACT_IDS.DIAMONDS_AND_MAJOR],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  (h, _ev, _m) => {
    const hr = suitLengthOf(h, Suit.Hearts);
    const s = suitLengthOf(h, Suit.Spades);
    return fv(DONT_FACT_IDS.DIAMONDS_MAJOR_HEARTS, hr >= 4 && hr > s);
  },
);

const diamondsMajorSpadesEntry = handWrittenEntry(
  {
    id: DONT_FACT_IDS.DIAMONDS_MAJOR_SPADES,
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "With diamonds as anchor, the major is spades",
    valueType: "boolean",
    derivesFrom: [DONT_FACT_IDS.DIAMONDS_AND_MAJOR],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  (h, _ev, _m) => {
    const hr = suitLengthOf(h, Suit.Hearts);
    const s = suitLengthOf(h, Suit.Spades);
    return fv(DONT_FACT_IDS.DIAMONDS_MAJOR_SPADES, s >= 4 && s >= hr);
  },
);

// Advancer support facts (complex)
const hasHeartSupportEntry = handWrittenEntry(
  {
    id: DONT_FACT_IDS.HAS_HEART_SUPPORT,
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "3+ hearts, or equal length in both majors (2-2)",
    valueType: "boolean",
    derivesFrom: [],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  (h, _ev, _m) => {
    const hearts = suitLengthOf(h, Suit.Hearts);
    const spades = suitLengthOf(h, Suit.Spades);
    return fv(DONT_FACT_IDS.HAS_HEART_SUPPORT, hearts >= 3 || (hearts >= 2 && hearts >= spades));
  },
);

const hasLongMinorEntry = handWrittenEntry(
  {
    id: DONT_FACT_IDS.HAS_LONG_MINOR,
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "6+ in clubs or diamonds (for minor escape)",
    valueType: "boolean",
    derivesFrom: [],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  (h, _ev, _m) => {
    const clubs = suitLengthOf(h, Suit.Clubs);
    const diamonds = suitLengthOf(h, Suit.Diamonds);
    return fv(DONT_FACT_IDS.HAS_LONG_MINOR, clubs >= 6 || diamonds >= 6);
  },
);

const longMinorIsClubsEntry = handWrittenEntry(
  {
    id: DONT_FACT_IDS.LONG_MINOR_IS_CLUBS,
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Longer minor is clubs (for 3C escape)",
    valueType: "boolean",
    derivesFrom: [DONT_FACT_IDS.HAS_LONG_MINOR],
    constrainsDimensions: ["suitIdentity", "suitLength", "shapeClass"],
  },
  (h, _ev, _m) => {
    const clubs = suitLengthOf(h, Suit.Clubs);
    const diamonds = suitLengthOf(h, Suit.Diamonds);
    return fv(DONT_FACT_IDS.LONG_MINOR_IS_CLUBS, clubs >= 6 && clubs >= diamonds);
  },
);

const longMinorIsDiamondsEntry = handWrittenEntry(
  {
    id: DONT_FACT_IDS.LONG_MINOR_IS_DIAMONDS,
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Longer minor is diamonds (for 3D escape)",
    valueType: "boolean",
    derivesFrom: [DONT_FACT_IDS.HAS_LONG_MINOR],
    constrainsDimensions: ["suitIdentity", "suitLength", "shapeClass"],
  },
  (h, _ev, _m) => {
    const clubs = suitLengthOf(h, Suit.Clubs);
    const diamonds = suitLengthOf(h, Suit.Diamonds);
    return fv(DONT_FACT_IDS.LONG_MINOR_IS_DIAMONDS, diamonds >= 6 && diamonds > clubs);
  },
);

// ─── Compose extension ──────────────────────────────────────

const { definitions, evaluators } = buildExtension([
  // Overcaller R1 facts
  bothMajorsEntry,
  diamondsAndMajorEntry,
  clubsAndHigherEntry,
  naturalSpadesEntry,
  singleSuitedEntry,
  // Overcaller reveal facts
  singleSuitClubsEntry,
  singleSuitDiamondsEntry,
  singleSuitHeartsEntry,
  // 2C relay response facts
  clubsHigherDiamondsEntry,
  clubsHigherHeartsEntry,
  clubsHigherSpadesEntry,
  // 2D relay response facts
  diamondsMajorHeartsEntry,
  diamondsMajorSpadesEntry,
  // Advancer support facts
  hasHeartSupportEntry,
  hasSpadeSupportEntry,
  hasDiamondSupportEntry,
  hasClubSupportEntry,
  hasLongMinorEntry,
  longMinorIsClubsEntry,
  longMinorIsDiamondsEntry,
]);

export const dontFacts: FactCatalogExtension = {
  definitions,
  evaluators,
};
