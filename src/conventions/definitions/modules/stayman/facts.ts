import { FactLayer } from "../../../core/fact-layer";
import type {
  FactCatalogExtension,
  FactDefinition,
  FactEvaluatorFn,
} from "../../../core/fact-catalog";
import { num, bool, fv } from "../../../pipeline/facts/fact-helpers";
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
    description: "Stayman preferred (eligible AND either no 5-card major OR 5-4 in both majors)",
    valueType: "boolean",
    derivesFrom: [STAYMAN_FACT_IDS.ELIGIBLE, "bridge.hasFiveCardMajor", "hand.suitLength.hearts", "hand.suitLength.spades"],
    constrainsDimensions: ["suitIdentity"],
  },
];

/** Factory: creates Stayman fact evaluators parameterized by system config. */
function createStaymanEvaluators(sys: SystemConfig): Map<string, FactEvaluatorFn> {
  const minHcp = sys.responderThresholds.inviteMin;
  return new Map<string, FactEvaluatorFn>([
    [STAYMAN_FACT_IDS.ELIGIBLE, (_h, _ev, m) =>
      fv(STAYMAN_FACT_IDS.ELIGIBLE, bool(m, "bridge.hasFourCardMajor") && num(m, "hand.hcp") >= minHcp)],
    [STAYMAN_FACT_IDS.PREFERRED, (_h, _ev, m) => {
      const eligible = bool(m, STAYMAN_FACT_IDS.ELIGIBLE);
      if (!eligible) return fv(STAYMAN_FACT_IDS.PREFERRED, false);
      const hasFiveMajor = bool(m, "bridge.hasFiveCardMajor");
      if (!hasFiveMajor) return fv(STAYMAN_FACT_IDS.PREFERRED, true);
      // Has a 5-card major — prefer Stayman only with 5-4 in both majors
      const hearts = num(m, "hand.suitLength.hearts");
      const spades = num(m, "hand.suitLength.spades");
      return fv(STAYMAN_FACT_IDS.PREFERRED, hearts >= 4 && spades >= 4);
    }],
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
