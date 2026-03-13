import type { MeaningSurface } from "../../../core/contracts/meaning-surface";
import { BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import { BERGEN_CLASSES } from "./semantic-classes";

function bid(level: 1 | 2 | 3 | 4 | 5 | 6 | 7, strain: BidSuit): Call {
  return { type: "bid", level, strain };
}

function suitToBidSuit(suit: "hearts" | "spades"): BidSuit {
  return suit === "hearts" ? BidSuit.Hearts : BidSuit.Spades;
}

function otherMajorBidSuit(suit: "hearts" | "spades"): BidSuit {
  return suit === "hearts" ? BidSuit.Spades : BidSuit.Hearts;
}

/**
 * Create the 5 Bergen Raises R1 surfaces for a given major suit.
 *
 * Surfaces use surfaceBindings to parameterize by suit -- clauses reference
 * `hand.suitLength.$suit` which resolves via the binding infrastructure
 * in meaning-evaluator.ts before fact lookup.
 *
 * Encodings are statically determined per suit instantiation:
 * - Splinter: 3 of the other major (3S after 1H, 3H after 1S)
 * - Game raise: 4 of the opened major
 * - Limit raise: always 3D
 * - Constructive: always 3C
 * - Preemptive: 3 of the opened major
 */
export function createBergenR1Surfaces(
  suit: "hearts" | "spades",
): readonly MeaningSurface[] {
  const bindings = { suit } as const;
  const majorStrain = suitToBidSuit(suit);
  const otherMajor = otherMajorBidSuit(suit);

  return [
    // 1. Splinter -- 12+ HCP, 4+ support, shortage (singleton or void)
    // Highest priority: checked first (intraModuleOrder 0)
    {
      meaningId: `bergen:splinter-${suit}`,
      semanticClassId: BERGEN_CLASSES.SPLINTER,
      moduleId: "bergen",
      encoding: { defaultCall: bid(3, otherMajor) },
      clauses: [
        {
          clauseId: "hcp-12-plus",
          factId: "hand.hcp",
          operator: "gte",
          value: 12,
          description: "12+ HCP for splinter",
        },
        {
          clauseId: "support-4-plus",
          factId: "hand.suitLength.$suit",
          operator: "gte",
          value: 4,
          description: `4+ ${suit} support`,
        },
        {
          clauseId: "has-shortage",
          factId: "bridge.hasShortage",
          operator: "boolean",
          value: true,
          description: "Singleton or void in at least one suit",
        },
      ],
      ranking: {
        recommendationBand: "must",
        specificity: 4,
        modulePrecedence: 0,
        intraModuleOrder: 0,
      },
      sourceIntent: { type: "Splinter", params: { suit } },
      teachingLabel: `Splinter (3${suit === "hearts" ? "S" : "H"})`,
      surfaceBindings: bindings,
    },

    // 2. Game raise -- 13+ HCP, 4+ support
    {
      meaningId: `bergen:game-raise-${suit}`,
      semanticClassId: BERGEN_CLASSES.GAME_RAISE,
      moduleId: "bergen",
      encoding: { defaultCall: bid(4, majorStrain) },
      clauses: [
        {
          clauseId: "hcp-13-plus",
          factId: "hand.hcp",
          operator: "gte",
          value: 13,
          description: "13+ HCP for game raise",
        },
        {
          clauseId: "support-4-plus",
          factId: "hand.suitLength.$suit",
          operator: "gte",
          value: 4,
          description: `4+ ${suit} support`,
        },
      ],
      ranking: {
        recommendationBand: "must",
        specificity: 3,
        modulePrecedence: 0,
        intraModuleOrder: 1,
      },
      sourceIntent: { type: "GameRaise", params: { suit } },
      teachingLabel: `Game raise (4${suit === "hearts" ? "H" : "S"})`,
      surfaceBindings: bindings,
    },

    // 3. Limit raise -- 10-12 HCP, 4+ support
    {
      meaningId: `bergen:limit-raise-${suit}`,
      semanticClassId: BERGEN_CLASSES.LIMIT_RAISE,
      moduleId: "bergen",
      encoding: { defaultCall: bid(3, BidSuit.Diamonds) },
      clauses: [
        {
          clauseId: "hcp-10-12",
          factId: "hand.hcp",
          operator: "range",
          value: { min: 10, max: 12 },
          description: "10-12 HCP for limit raise",
        },
        {
          clauseId: "support-4-plus",
          factId: "hand.suitLength.$suit",
          operator: "gte",
          value: 4,
          description: `4+ ${suit} support`,
        },
      ],
      ranking: {
        recommendationBand: "should",
        specificity: 3,
        modulePrecedence: 0,
        intraModuleOrder: 2,
      },
      sourceIntent: { type: "LimitRaise", params: { suit } },
      teachingLabel: "Limit raise (3D)",
      surfaceBindings: bindings,
    },

    // 4. Constructive raise -- 7-10 HCP, 4+ support
    {
      meaningId: `bergen:constructive-raise-${suit}`,
      semanticClassId: BERGEN_CLASSES.CONSTRUCTIVE_RAISE,
      moduleId: "bergen",
      encoding: { defaultCall: bid(3, BidSuit.Clubs) },
      clauses: [
        {
          clauseId: "hcp-7-10",
          factId: "hand.hcp",
          operator: "range",
          value: { min: 7, max: 10 },
          description: "7-10 HCP for constructive raise",
        },
        {
          clauseId: "support-4-plus",
          factId: "hand.suitLength.$suit",
          operator: "gte",
          value: 4,
          description: `4+ ${suit} support`,
        },
      ],
      ranking: {
        recommendationBand: "should",
        specificity: 2,
        modulePrecedence: 0,
        intraModuleOrder: 3,
      },
      sourceIntent: { type: "ConstructiveRaise", params: { suit } },
      teachingLabel: "Constructive raise (3C)",
      surfaceBindings: bindings,
    },

    // 5. Preemptive raise -- 0-6 HCP, 4+ support
    {
      meaningId: `bergen:preemptive-raise-${suit}`,
      semanticClassId: BERGEN_CLASSES.PREEMPTIVE_RAISE,
      moduleId: "bergen",
      encoding: { defaultCall: bid(3, majorStrain) },
      clauses: [
        {
          clauseId: "hcp-0-6",
          factId: "hand.hcp",
          operator: "lte",
          value: 6,
          description: "0-6 HCP for preemptive raise",
        },
        {
          clauseId: "support-4-plus",
          factId: "hand.suitLength.$suit",
          operator: "gte",
          value: 4,
          description: `4+ ${suit} support`,
        },
      ],
      ranking: {
        recommendationBand: "may",
        specificity: 2,
        modulePrecedence: 0,
        intraModuleOrder: 4,
      },
      sourceIntent: { type: "PreemptiveRaise", params: { suit } },
      teachingLabel: `Preemptive raise (3${suit === "hearts" ? "H" : "S"})`,
      surfaceBindings: bindings,
    },
  ];
}

/** Pre-instantiated surfaces for hearts and spades. */
export const BERGEN_R1_HEARTS_SURFACES = createBergenR1Surfaces("hearts");
export const BERGEN_R1_SPADES_SURFACES = createBergenR1Surfaces("spades");
