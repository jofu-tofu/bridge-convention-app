import { FactLayer } from "../../../core/fact-layer";
import type {
  FactCatalogExtension,
  FactDefinition,
  FactEvaluatorFn,
} from "../../../core/fact-catalog";
import { num, fv } from "../../../pipeline/facts/fact-helpers";
import { Rank } from "../../../../engine/types";

import type { SystemConfig } from "../../system-config";
import { BLACKWOOD_FACT_IDS } from "./ids";

// ─── Facts ───────────────────────────────────────────────────

const BLACKWOOD_FACTS: readonly FactDefinition[] = [
  {
    id: BLACKWOOD_FACT_IDS.SLAM_INTEREST,
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Hand has slam-level values (HCP meets system slam threshold)",
    valueType: "boolean",
    derivesFrom: ["hand.hcp"],
    constrainsDimensions: ["pointRange"],
    composition: {
      kind: "primitive",
      clause: { factId: "hand.hcp", operator: "gte", value: 15 },
    },
  },
  {
    id: BLACKWOOD_FACT_IDS.ACE_COUNT,
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Number of aces held in hand (0-4)",
    valueType: "number",
    constrainsDimensions: [],
  },
  {
    id: BLACKWOOD_FACT_IDS.KING_COUNT,
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Number of kings held in hand (0-4)",
    valueType: "number",
    constrainsDimensions: [],
  },
];

/** Factory: creates Blackwood fact evaluators parameterized by system config. */
function createBlackwoodEvaluators(sys: SystemConfig): Map<string, FactEvaluatorFn> {
  const slamMin = sys.responderThresholds.slamMin;
  return new Map<string, FactEvaluatorFn>([
    [BLACKWOOD_FACT_IDS.SLAM_INTEREST, (_h, _ev, m) =>
      fv(BLACKWOOD_FACT_IDS.SLAM_INTEREST, num(m, "hand.hcp") >= slamMin)],
    [BLACKWOOD_FACT_IDS.ACE_COUNT, (h) =>
      fv(BLACKWOOD_FACT_IDS.ACE_COUNT, h.cards.filter(c => c.rank === Rank.Ace).length)],
    [BLACKWOOD_FACT_IDS.KING_COUNT, (h) =>
      fv(BLACKWOOD_FACT_IDS.KING_COUNT, h.cards.filter(c => c.rank === Rank.King).length)],
  ]);
}

/** Factory: creates Blackwood facts parameterized by system config. */
export function createBlackwoodFacts(sys: SystemConfig): FactCatalogExtension {
  return {
    definitions: BLACKWOOD_FACTS,
    evaluators: createBlackwoodEvaluators(sys),
  };
}
