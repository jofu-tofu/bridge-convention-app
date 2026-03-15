import type {
  FactCatalogExtension,
  FactDefinition,
  FactEvaluatorFn,
} from "../../../core/contracts/fact-catalog";
import { fv } from "../../../core/contracts/fact-catalog";
import type { Hand } from "../../../engine/types";
import { Suit } from "../../../engine/types";

// ─── Helpers ────────────────────────────────────────────────

function suitLength(hand: Hand, suit: Suit): number {
  return hand.cards.filter((c) => c.suit === suit).length;
}

function longestSuitExcluding(
  hand: Hand,
  exclude: Suit[],
): { suit: Suit; length: number } {
  const suits = [Suit.Spades, Suit.Hearts, Suit.Diamonds, Suit.Clubs].filter(
    (s) => !exclude.includes(s),
  );
  if (suits.length === 0) return { suit: Suit.Clubs, length: 0 };
  let best = suits[0]!;
  let bestLen = suitLength(hand, best);
  for (const s of suits.slice(1)) {
    const len = suitLength(hand, s);
    if (len > bestLen) {
      best = s;
      bestLen = len;
    }
  }
  return { suit: best, length: bestLen };
}

// ─── DONT module facts ──────────────────────────────────────

const DONT_FACTS: readonly FactDefinition[] = [
  // Overcaller R1 facts
  {
    id: "module.dont.bothMajors",
    layer: "module-derived",
    world: "acting-hand",
    description: "H5+S4+ or S5+H4+ — both majors for 2H bid",
    valueType: "boolean",
    derivesFrom: [],
  },
  {
    id: "module.dont.diamondsAndMajor",
    layer: "module-derived",
    world: "acting-hand",
    description: "D5+ and (H4+ or S4+) — diamonds + a major for 2D bid",
    valueType: "boolean",
    derivesFrom: [],
  },
  {
    id: "module.dont.clubsAndHigher",
    layer: "module-derived",
    world: "acting-hand",
    description: "C5+ and (D4+ or H4+ or S4+) — clubs + higher suit for 2C bid",
    valueType: "boolean",
    derivesFrom: [],
  },
  {
    id: "module.dont.naturalSpades",
    layer: "module-derived",
    world: "acting-hand",
    description: "S6+ — natural spades for 2S bid",
    valueType: "boolean",
    derivesFrom: [],
  },
  {
    id: "module.dont.singleSuited",
    layer: "module-derived",
    world: "acting-hand",
    description: "One suit 6+, no other suit 4+, longest suit is not spades — for double",
    valueType: "boolean",
    derivesFrom: [],
  },

  // Overcaller reveal facts (after X → 2C)
  {
    id: "module.dont.singleSuitClubs",
    layer: "module-derived",
    world: "acting-hand",
    description: "The 6+ single suit is clubs",
    valueType: "boolean",
    derivesFrom: ["module.dont.singleSuited"],
  },
  {
    id: "module.dont.singleSuitDiamonds",
    layer: "module-derived",
    world: "acting-hand",
    description: "The 6+ single suit is diamonds",
    valueType: "boolean",
    derivesFrom: ["module.dont.singleSuited"],
  },
  {
    id: "module.dont.singleSuitHearts",
    layer: "module-derived",
    world: "acting-hand",
    description: "The 6+ single suit is hearts",
    valueType: "boolean",
    derivesFrom: ["module.dont.singleSuited"],
  },

  // 2C relay response facts (after 2C → 2D)
  {
    id: "module.dont.clubsHigherDiamonds",
    layer: "module-derived",
    world: "acting-hand",
    description: "With clubs as anchor, higher suit is diamonds",
    valueType: "boolean",
    derivesFrom: ["module.dont.clubsAndHigher"],
  },
  {
    id: "module.dont.clubsHigherHearts",
    layer: "module-derived",
    world: "acting-hand",
    description: "With clubs as anchor, higher suit is hearts",
    valueType: "boolean",
    derivesFrom: ["module.dont.clubsAndHigher"],
  },
  {
    id: "module.dont.clubsHigherSpades",
    layer: "module-derived",
    world: "acting-hand",
    description: "With clubs as anchor, higher suit is spades",
    valueType: "boolean",
    derivesFrom: ["module.dont.clubsAndHigher"],
  },

  // 2D relay response facts (after 2D → 2H)
  {
    id: "module.dont.diamondsMajorHearts",
    layer: "module-derived",
    world: "acting-hand",
    description: "With diamonds as anchor, the major is hearts",
    valueType: "boolean",
    derivesFrom: ["module.dont.diamondsAndMajor"],
  },
  {
    id: "module.dont.diamondsMajorSpades",
    layer: "module-derived",
    world: "acting-hand",
    description: "With diamonds as anchor, the major is spades",
    valueType: "boolean",
    derivesFrom: ["module.dont.diamondsAndMajor"],
  },

  // Advancer support facts
  {
    id: "module.dont.hasHeartSupport",
    layer: "module-derived",
    world: "acting-hand",
    description: "3+ hearts",
    valueType: "boolean",
    derivesFrom: [],
  },
  {
    id: "module.dont.hasSpadeSupport",
    layer: "module-derived",
    world: "acting-hand",
    description: "3+ spades",
    valueType: "boolean",
    derivesFrom: [],
  },
  {
    id: "module.dont.hasDiamondSupport",
    layer: "module-derived",
    world: "acting-hand",
    description: "3+ diamonds",
    valueType: "boolean",
    derivesFrom: [],
  },
  {
    id: "module.dont.hasClubSupport",
    layer: "module-derived",
    world: "acting-hand",
    description: "3+ clubs",
    valueType: "boolean",
    derivesFrom: [],
  },
  {
    id: "module.dont.hasLongMinor",
    layer: "module-derived",
    world: "acting-hand",
    description: "6+ in clubs or diamonds (for minor escape)",
    valueType: "boolean",
    derivesFrom: [],
  },
  {
    id: "module.dont.longMinorIsClubs",
    layer: "module-derived",
    world: "acting-hand",
    description: "Longer minor is clubs (for 3C escape)",
    valueType: "boolean",
    derivesFrom: ["module.dont.hasLongMinor"],
  },
  {
    id: "module.dont.longMinorIsDiamonds",
    layer: "module-derived",
    world: "acting-hand",
    description: "Longer minor is diamonds (for 3D escape)",
    valueType: "boolean",
    derivesFrom: ["module.dont.hasLongMinor"],
  },
];

// ─── Evaluators ─────────────────────────────────────────────

const DONT_EVALUATORS = new Map<string, FactEvaluatorFn>([
  // Overcaller R1 facts
  ["module.dont.bothMajors", (h, _ev, _m) => {
    const hearts = suitLength(h, Suit.Hearts);
    const spades = suitLength(h, Suit.Spades);
    return fv(
      "module.dont.bothMajors",
      (hearts >= 5 && spades >= 4) || (spades >= 5 && hearts >= 4),
    );
  }],

  ["module.dont.diamondsAndMajor", (h, _ev, _m) => {
    const diamonds = suitLength(h, Suit.Diamonds);
    const hearts = suitLength(h, Suit.Hearts);
    const spades = suitLength(h, Suit.Spades);
    return fv(
      "module.dont.diamondsAndMajor",
      diamonds >= 5 && (hearts >= 4 || spades >= 4),
    );
  }],

  ["module.dont.clubsAndHigher", (h, _ev, _m) => {
    const clubs = suitLength(h, Suit.Clubs);
    const diamonds = suitLength(h, Suit.Diamonds);
    const hearts = suitLength(h, Suit.Hearts);
    const spades = suitLength(h, Suit.Spades);
    return fv(
      "module.dont.clubsAndHigher",
      clubs >= 5 && (diamonds >= 4 || hearts >= 4 || spades >= 4),
    );
  }],

  ["module.dont.naturalSpades", (h, _ev, _m) => {
    const spades = suitLength(h, Suit.Spades);
    return fv("module.dont.naturalSpades", spades >= 6);
  }],

  ["module.dont.singleSuited", (h, _ev, _m) => {
    const lengths: { suit: Suit; length: number }[] = [
      { suit: Suit.Spades, length: suitLength(h, Suit.Spades) },
      { suit: Suit.Hearts, length: suitLength(h, Suit.Hearts) },
      { suit: Suit.Diamonds, length: suitLength(h, Suit.Diamonds) },
      { suit: Suit.Clubs, length: suitLength(h, Suit.Clubs) },
    ];
    // Find the longest suit
    const longest = lengths.reduce((a, b) => (b.length > a.length ? b : a));
    // Must have 6+, must not be spades, no other suit may have 4+
    if (longest.length < 6 || longest.suit === Suit.Spades) {
      return fv("module.dont.singleSuited", false);
    }
    const otherHas4Plus = lengths.some(
      (l) => l.suit !== longest.suit && l.length >= 4,
    );
    return fv("module.dont.singleSuited", !otherHas4Plus);
  }],

  // Overcaller reveal facts (after X → 2C)
  ["module.dont.singleSuitClubs", (h, _ev, _m) => {
    const longest = longestSuitExcluding(h, []);
    return fv(
      "module.dont.singleSuitClubs",
      longest.suit === Suit.Clubs && longest.length >= 6,
    );
  }],

  ["module.dont.singleSuitDiamonds", (h, _ev, _m) => {
    const longest = longestSuitExcluding(h, []);
    return fv(
      "module.dont.singleSuitDiamonds",
      longest.suit === Suit.Diamonds && longest.length >= 6,
    );
  }],

  ["module.dont.singleSuitHearts", (h, _ev, _m) => {
    const longest = longestSuitExcluding(h, []);
    return fv(
      "module.dont.singleSuitHearts",
      longest.suit === Suit.Hearts && longest.length >= 6,
    );
  }],

  // 2C relay response facts (after 2C → 2D): among D, H, S find which has 4+
  // and is longest; ties broken by higher ranking (S > H > D)
  ["module.dont.clubsHigherDiamonds", (h, _ev, _m) => {
    const d = suitLength(h, Suit.Diamonds);
    const hr = suitLength(h, Suit.Hearts);
    const s = suitLength(h, Suit.Spades);
    // Diamonds is the higher suit if D4+ and D >= H and D >= S
    // But ties broken by higher ranking: S > H > D, so D must be strictly longer
    // than any 4+ suit ranked above it
    const isDiamonds = d >= 4 && d > hr && d > s;
    return fv("module.dont.clubsHigherDiamonds", isDiamonds);
  }],

  ["module.dont.clubsHigherHearts", (h, _ev, _m) => {
    const d = suitLength(h, Suit.Diamonds);
    const hr = suitLength(h, Suit.Hearts);
    const s = suitLength(h, Suit.Spades);
    // Hearts is the higher suit if H4+ and H >= D and H >= S
    // Ties broken by higher ranking: S > H, so hearts must be strictly longer
    // than spades if spades also qualifies, but beats diamonds on ties
    const isHearts = hr >= 4 && hr >= d && hr > s;
    return fv("module.dont.clubsHigherHearts", isHearts);
  }],

  ["module.dont.clubsHigherSpades", (h, _ev, _m) => {
    const d = suitLength(h, Suit.Diamonds);
    const hr = suitLength(h, Suit.Hearts);
    const s = suitLength(h, Suit.Spades);
    // Spades is the higher suit if S4+ and S >= H and S >= D
    // Spades wins ties as highest ranking
    const isSpades = s >= 4 && s >= hr && s >= d;
    return fv("module.dont.clubsHigherSpades", isSpades);
  }],

  // 2D relay response facts (after 2D → 2H): between H and S
  ["module.dont.diamondsMajorHearts", (h, _ev, _m) => {
    const hr = suitLength(h, Suit.Hearts);
    const s = suitLength(h, Suit.Spades);
    // Hearts is the major if H4+ and H > S (spades wins ties as higher ranking)
    return fv("module.dont.diamondsMajorHearts", hr >= 4 && hr > s);
  }],

  ["module.dont.diamondsMajorSpades", (h, _ev, _m) => {
    const hr = suitLength(h, Suit.Hearts);
    const s = suitLength(h, Suit.Spades);
    // Spades is the major if S4+ and S >= H (spades wins ties)
    return fv("module.dont.diamondsMajorSpades", s >= 4 && s >= hr);
  }],

  // Advancer support facts
  ["module.dont.hasHeartSupport", (h, _ev, _m) =>
    fv("module.dont.hasHeartSupport", suitLength(h, Suit.Hearts) >= 3)],

  ["module.dont.hasSpadeSupport", (h, _ev, _m) =>
    fv("module.dont.hasSpadeSupport", suitLength(h, Suit.Spades) >= 3)],

  ["module.dont.hasDiamondSupport", (h, _ev, _m) =>
    fv("module.dont.hasDiamondSupport", suitLength(h, Suit.Diamonds) >= 3)],

  ["module.dont.hasClubSupport", (h, _ev, _m) =>
    fv("module.dont.hasClubSupport", suitLength(h, Suit.Clubs) >= 3)],

  ["module.dont.hasLongMinor", (h, _ev, _m) => {
    const clubs = suitLength(h, Suit.Clubs);
    const diamonds = suitLength(h, Suit.Diamonds);
    return fv("module.dont.hasLongMinor", clubs >= 6 || diamonds >= 6);
  }],

  ["module.dont.longMinorIsClubs", (h, _ev, _m) => {
    const clubs = suitLength(h, Suit.Clubs);
    const diamonds = suitLength(h, Suit.Diamonds);
    return fv("module.dont.longMinorIsClubs", clubs >= 6 && clubs >= diamonds);
  }],

  ["module.dont.longMinorIsDiamonds", (h, _ev, _m) => {
    const clubs = suitLength(h, Suit.Clubs);
    const diamonds = suitLength(h, Suit.Diamonds);
    return fv("module.dont.longMinorIsDiamonds", diamonds >= 6 && diamonds > clubs);
  }],
]);

export const dontFacts: FactCatalogExtension = {
  definitions: DONT_FACTS,
  evaluators: DONT_EVALUATORS,
};
