import { FactLayer } from "../../../core/fact-layer";
import type {
  FactCatalogExtension,
  FactDefinition,
  FactEvaluatorFn,
} from "../../../core/fact-catalog";
import { num, bool, fv } from "../../../pipeline/fact-helpers";
import { createPosteriorFactEvaluators } from "../../../../inference/posterior";

import type { SystemConfig } from "../../system-config";
import { STAYMAN_FACT_IDS } from "./ids";

// ─── Facts ───────────────────────────────────────────────────

const NT_POSTERIOR_FACTS: readonly FactDefinition[] = [
  {
    id: STAYMAN_FACT_IDS.NS_HAVE_EIGHT_CARD_FIT_LIKELY,
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Posterior probability that N/S have an 8+ card major fit",
    valueType: "number",
    constrainsDimensions: [],
  },
  {
    id: STAYMAN_FACT_IDS.OPENER_STILL_BALANCED_LIKELY,
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Posterior probability that opener has balanced shape",
    valueType: "number",
    constrainsDimensions: [],
  },
  {
    id: STAYMAN_FACT_IDS.OPENER_HAS_SECOND_MAJOR_LIKELY,
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Posterior probability that opener has a second 4-card major",
    valueType: "number",
    constrainsDimensions: [],
  },
];

const STAYMAN_FACTS: readonly FactDefinition[] = [
  {
    id: STAYMAN_FACT_IDS.ELIGIBLE,
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Eligible for Stayman (4+ card major AND 8+ HCP)",
    valueType: "boolean",
    derivesFrom: ["bridge.hasFourCardMajor", "hand.hcp"],
    constrainsDimensions: ["suitIdentity"],
  },
  {
    id: STAYMAN_FACT_IDS.PREFERRED,
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Stayman preferred (eligible AND no 5-card major)",
    valueType: "boolean",
    derivesFrom: [STAYMAN_FACT_IDS.ELIGIBLE, "bridge.hasFiveCardMajor"],
    constrainsDimensions: ["suitIdentity"],
  },
];

/** Factory: creates Stayman fact evaluators parameterized by system config. */
function createStaymanEvaluators(sys: SystemConfig): Map<string, FactEvaluatorFn> {
  const minHcp = sys.responderThresholds.inviteMin;
  return new Map<string, FactEvaluatorFn>([
    [STAYMAN_FACT_IDS.ELIGIBLE, (_h, _ev, m) =>
      fv(STAYMAN_FACT_IDS.ELIGIBLE, bool(m, "bridge.hasFourCardMajor") && num(m, "hand.hcp") >= minHcp)],
    [STAYMAN_FACT_IDS.PREFERRED, (_h, _ev, m) =>
      fv(STAYMAN_FACT_IDS.PREFERRED, bool(m, STAYMAN_FACT_IDS.ELIGIBLE) && !bool(m, "bridge.hasFiveCardMajor"))],
  ]);
}

const posteriorEvaluators = createPosteriorFactEvaluators([
  "bridge.partnerHas4HeartsLikely",
  "bridge.partnerHas4SpadesLikely",
  "bridge.partnerHas4DiamondsLikely",
  "bridge.partnerHas4ClubsLikely",
  "bridge.combinedHcpInRangeLikely",
  STAYMAN_FACT_IDS.NS_HAVE_EIGHT_CARD_FIT_LIKELY,
  STAYMAN_FACT_IDS.OPENER_STILL_BALANCED_LIKELY,
  STAYMAN_FACT_IDS.OPENER_HAS_SECOND_MAJOR_LIKELY,
], new Map([
  ["bridge.partnerHas4HeartsLikely", ["H"]],
  ["bridge.partnerHas4SpadesLikely", ["S"]],
  ["bridge.partnerHas4DiamondsLikely", ["D"]],
  ["bridge.partnerHas4ClubsLikely", ["C"]],
  ["bridge.combinedHcpInRangeLikely", ["25", "40"]],
]));

/** Factory: creates Stayman facts parameterized by system config. */
export function createStaymanFacts(sys: SystemConfig): FactCatalogExtension {
  return {
    definitions: [...STAYMAN_FACTS, ...NT_POSTERIOR_FACTS],
    evaluators: createStaymanEvaluators(sys),
    posteriorEvaluators,
  };
}
