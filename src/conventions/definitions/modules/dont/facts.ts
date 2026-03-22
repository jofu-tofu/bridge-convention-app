import { FactLayer } from "../../../../core/contracts/fact-layer";
import type {
  FactCatalogExtension,
  FactDefinition,
  FactEvaluatorFn,
} from "../../../../core/contracts/fact-catalog";
import { fv } from "../../../core/pipeline/fact-helpers";
import {
  defineBooleanFact,
  buildExtension,
} from "../../../core/pipeline/fact-factory";
import type { FactEntry } from "../../../core/pipeline/fact-factory";
import type { Hand } from "../../../../engine/types";
import { Suit } from "../../../../engine/types";
import { suitLengthOf } from "../../../../engine/hand-evaluator";

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
  id: "module.dont.naturalSpades",
  description: "S6+ — natural spades for 2S bid",
  factId: "hand.suitLength.spades",
  operator: "gte",
  value: 6,
  constrainsDimensions: ["suitIdentity", "suitLength"],
  derivesFrom: [],
});

const hasSpadeSupportEntry = defineBooleanFact({
  id: "module.dont.hasSpadeSupport",
  description: "3+ spades",
  factId: "hand.suitLength.spades",
  operator: "gte",
  value: 3,
  constrainsDimensions: ["suitIdentity", "suitLength"],
  derivesFrom: [],
});

const hasDiamondSupportEntry = defineBooleanFact({
  id: "module.dont.hasDiamondSupport",
  description: "3+ diamonds",
  factId: "hand.suitLength.diamonds",
  operator: "gte",
  value: 3,
  constrainsDimensions: ["suitIdentity", "suitLength"],
  derivesFrom: [],
});

const hasClubSupportEntry = defineBooleanFact({
  id: "module.dont.hasClubSupport",
  description: "3+ clubs",
  factId: "hand.suitLength.clubs",
  operator: "gte",
  value: 3,
  constrainsDimensions: ["suitIdentity", "suitLength"],
  derivesFrom: [],
});

// ─── Hand-written facts (complex evaluators) ────────────────

function handWrittenEntry(
  definition: FactDefinition,
  evaluator: FactEvaluatorFn,
): FactEntry {
  return { definition, evaluator: [definition.id, evaluator] };
}

const bothMajorsEntry = handWrittenEntry(
  {
    id: "module.dont.bothMajors",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "H5+S4+ or S5+H4+ — both majors for 2H bid",
    valueType: "boolean",
    derivesFrom: [],
    constrainsDimensions: ["suitIdentity", "suitLength", "suitRelation"],
  },
  (h, _ev, _m) => {
    const hearts = suitLengthOf(h, Suit.Hearts);
    const spades = suitLengthOf(h, Suit.Spades);
    return fv(
      "module.dont.bothMajors",
      (hearts >= 5 && spades >= 4) || (spades >= 5 && hearts >= 4),
    );
  },
);

const diamondsAndMajorEntry = handWrittenEntry(
  {
    id: "module.dont.diamondsAndMajor",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "D5+ and (H4+ or S4+) — diamonds + a major for 2D bid",
    valueType: "boolean",
    derivesFrom: [],
    constrainsDimensions: ["suitIdentity", "suitLength", "suitRelation"],
  },
  (h, _ev, _m) => {
    const diamonds = suitLengthOf(h, Suit.Diamonds);
    const hearts = suitLengthOf(h, Suit.Hearts);
    const spades = suitLengthOf(h, Suit.Spades);
    return fv(
      "module.dont.diamondsAndMajor",
      diamonds >= 5 && (hearts >= 4 || spades >= 4),
    );
  },
);

const clubsAndHigherEntry = handWrittenEntry(
  {
    id: "module.dont.clubsAndHigher",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "C5+ and (D4+ or H4+ or S4+) — clubs + higher suit for 2C bid",
    valueType: "boolean",
    derivesFrom: [],
    constrainsDimensions: ["suitIdentity", "suitLength", "suitRelation"],
  },
  (h, _ev, _m) => {
    const clubs = suitLengthOf(h, Suit.Clubs);
    const diamonds = suitLengthOf(h, Suit.Diamonds);
    const hearts = suitLengthOf(h, Suit.Hearts);
    const spades = suitLengthOf(h, Suit.Spades);
    return fv(
      "module.dont.clubsAndHigher",
      clubs >= 5 && (diamonds >= 4 || hearts >= 4 || spades >= 4),
    );
  },
);

const singleSuitedEntry = handWrittenEntry(
  {
    id: "module.dont.singleSuited",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "One suit 6+, no other suit 4+, longest suit is not spades — for double",
    valueType: "boolean",
    derivesFrom: [],
    constrainsDimensions: ["shapeClass", "suitLength", "suitIdentity"],
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
      return fv("module.dont.singleSuited", false);
    }
    const otherHas4Plus = lengths.some(
      (l) => l.suit !== longest.suit && l.length >= 4,
    );
    return fv("module.dont.singleSuited", !otherHas4Plus);
  },
);

// Overcaller reveal facts (after X → 2C)
const singleSuitClubsEntry = handWrittenEntry(
  {
    id: "module.dont.singleSuitClubs",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "The 6+ single suit is clubs",
    valueType: "boolean",
    derivesFrom: ["module.dont.singleSuited"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  (h, _ev, _m) => {
    const longest = longestSuitExcluding(h, []);
    return fv(
      "module.dont.singleSuitClubs",
      longest.suit === Suit.Clubs && longest.length >= 6,
    );
  },
);

const singleSuitDiamondsEntry = handWrittenEntry(
  {
    id: "module.dont.singleSuitDiamonds",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "The 6+ single suit is diamonds",
    valueType: "boolean",
    derivesFrom: ["module.dont.singleSuited"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  (h, _ev, _m) => {
    const longest = longestSuitExcluding(h, []);
    return fv(
      "module.dont.singleSuitDiamonds",
      longest.suit === Suit.Diamonds && longest.length >= 6,
    );
  },
);

const singleSuitHeartsEntry = handWrittenEntry(
  {
    id: "module.dont.singleSuitHearts",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "The 6+ single suit is hearts",
    valueType: "boolean",
    derivesFrom: ["module.dont.singleSuited"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  (h, _ev, _m) => {
    const longest = longestSuitExcluding(h, []);
    return fv(
      "module.dont.singleSuitHearts",
      longest.suit === Suit.Hearts && longest.length >= 6,
    );
  },
);

// 2C relay response facts
const clubsHigherDiamondsEntry = handWrittenEntry(
  {
    id: "module.dont.clubsHigherDiamonds",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "With clubs as anchor, higher suit is diamonds",
    valueType: "boolean",
    derivesFrom: ["module.dont.clubsAndHigher"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  (h, _ev, _m) => {
    const d = suitLengthOf(h, Suit.Diamonds);
    const hr = suitLengthOf(h, Suit.Hearts);
    const s = suitLengthOf(h, Suit.Spades);
    const isDiamonds = d >= 4 && d > hr && d > s;
    return fv("module.dont.clubsHigherDiamonds", isDiamonds);
  },
);

const clubsHigherHeartsEntry = handWrittenEntry(
  {
    id: "module.dont.clubsHigherHearts",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "With clubs as anchor, higher suit is hearts",
    valueType: "boolean",
    derivesFrom: ["module.dont.clubsAndHigher"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  (h, _ev, _m) => {
    const d = suitLengthOf(h, Suit.Diamonds);
    const hr = suitLengthOf(h, Suit.Hearts);
    const s = suitLengthOf(h, Suit.Spades);
    const isHearts = hr >= 4 && hr >= d && hr > s;
    return fv("module.dont.clubsHigherHearts", isHearts);
  },
);

const clubsHigherSpadesEntry = handWrittenEntry(
  {
    id: "module.dont.clubsHigherSpades",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "With clubs as anchor, higher suit is spades",
    valueType: "boolean",
    derivesFrom: ["module.dont.clubsAndHigher"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  (h, _ev, _m) => {
    const d = suitLengthOf(h, Suit.Diamonds);
    const hr = suitLengthOf(h, Suit.Hearts);
    const s = suitLengthOf(h, Suit.Spades);
    const isSpades = s >= 4 && s >= hr && s >= d;
    return fv("module.dont.clubsHigherSpades", isSpades);
  },
);

// 2D relay response facts
const diamondsMajorHeartsEntry = handWrittenEntry(
  {
    id: "module.dont.diamondsMajorHearts",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "With diamonds as anchor, the major is hearts",
    valueType: "boolean",
    derivesFrom: ["module.dont.diamondsAndMajor"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  (h, _ev, _m) => {
    const hr = suitLengthOf(h, Suit.Hearts);
    const s = suitLengthOf(h, Suit.Spades);
    return fv("module.dont.diamondsMajorHearts", hr >= 4 && hr > s);
  },
);

const diamondsMajorSpadesEntry = handWrittenEntry(
  {
    id: "module.dont.diamondsMajorSpades",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "With diamonds as anchor, the major is spades",
    valueType: "boolean",
    derivesFrom: ["module.dont.diamondsAndMajor"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  (h, _ev, _m) => {
    const hr = suitLengthOf(h, Suit.Hearts);
    const s = suitLengthOf(h, Suit.Spades);
    return fv("module.dont.diamondsMajorSpades", s >= 4 && s >= hr);
  },
);

// Advancer support facts (complex)
const hasHeartSupportEntry = handWrittenEntry(
  {
    id: "module.dont.hasHeartSupport",
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
    return fv("module.dont.hasHeartSupport", hearts >= 3 || (hearts >= 2 && hearts >= spades));
  },
);

const hasLongMinorEntry = handWrittenEntry(
  {
    id: "module.dont.hasLongMinor",
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
    return fv("module.dont.hasLongMinor", clubs >= 6 || diamonds >= 6);
  },
);

const longMinorIsClubsEntry = handWrittenEntry(
  {
    id: "module.dont.longMinorIsClubs",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Longer minor is clubs (for 3C escape)",
    valueType: "boolean",
    derivesFrom: ["module.dont.hasLongMinor"],
    constrainsDimensions: ["suitIdentity", "suitLength", "shapeClass"],
  },
  (h, _ev, _m) => {
    const clubs = suitLengthOf(h, Suit.Clubs);
    const diamonds = suitLengthOf(h, Suit.Diamonds);
    return fv("module.dont.longMinorIsClubs", clubs >= 6 && clubs >= diamonds);
  },
);

const longMinorIsDiamondsEntry = handWrittenEntry(
  {
    id: "module.dont.longMinorIsDiamonds",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Longer minor is diamonds (for 3D escape)",
    valueType: "boolean",
    derivesFrom: ["module.dont.hasLongMinor"],
    constrainsDimensions: ["suitIdentity", "suitLength", "shapeClass"],
  },
  (h, _ev, _m) => {
    const clubs = suitLengthOf(h, Suit.Clubs);
    const diamonds = suitLengthOf(h, Suit.Diamonds);
    return fv("module.dont.longMinorIsDiamonds", diamonds >= 6 && diamonds > clubs);
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
