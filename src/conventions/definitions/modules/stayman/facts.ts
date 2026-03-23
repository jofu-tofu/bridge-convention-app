import { FactLayer } from "../../../../core/contracts/fact-layer";
import type {
  FactCatalogExtension,
  FactDefinition,
  FactEvaluatorFn,
} from "../../../../core/contracts/fact-catalog";
import { num, bool, fv } from "../../../pipeline/fact-helpers";
import { createPosteriorFactEvaluators } from "../../../../inference/posterior";

import type { SystemConfig } from "../../../../core/contracts/system-config";

// ─── Facts ───────────────────────────────────────────────────

const NT_POSTERIOR_FACTS: readonly FactDefinition[] = [
  {
    id: "module.stayman.nsHaveEightCardFitLikely",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Posterior probability that N/S have an 8+ card major fit",
    valueType: "number",
    constrainsDimensions: [],
  },
  {
    id: "module.stayman.openerStillBalancedLikely",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Posterior probability that opener has balanced shape",
    valueType: "number",
    constrainsDimensions: [],
  },
  {
    id: "module.stayman.openerHasSecondMajorLikely",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Posterior probability that opener has a second 4-card major",
    valueType: "number",
    constrainsDimensions: [],
  },
];

const STAYMAN_FACTS: readonly FactDefinition[] = [
  {
    id: "module.stayman.eligible",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Eligible for Stayman (4+ card major AND 8+ HCP)",
    valueType: "boolean",
    derivesFrom: ["bridge.hasFourCardMajor", "hand.hcp"],
    constrainsDimensions: ["suitIdentity"],
  },
  {
    id: "module.stayman.preferred",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Stayman preferred (eligible AND no 5-card major)",
    valueType: "boolean",
    derivesFrom: ["module.stayman.eligible", "bridge.hasFiveCardMajor"],
    constrainsDimensions: ["suitIdentity"],
  },
];

/** Factory: creates Stayman fact evaluators parameterized by system config. */
function createStaymanEvaluators(sys: SystemConfig): Map<string, FactEvaluatorFn> {
  const minHcp = sys.responderThresholds.inviteMin;
  return new Map<string, FactEvaluatorFn>([
    ["module.stayman.eligible", (_h, _ev, m) =>
      fv("module.stayman.eligible", bool(m, "bridge.hasFourCardMajor") && num(m, "hand.hcp") >= minHcp)],
    ["module.stayman.preferred", (_h, _ev, m) =>
      fv("module.stayman.preferred", bool(m, "module.stayman.eligible") && !bool(m, "bridge.hasFiveCardMajor"))],
  ]);
}

const posteriorEvaluators = createPosteriorFactEvaluators([
  "bridge.partnerHas4HeartsLikely",
  "bridge.partnerHas4SpadesLikely",
  "bridge.partnerHas4DiamondsLikely",
  "bridge.partnerHas4ClubsLikely",
  "bridge.combinedHcpInRangeLikely",
  "module.stayman.nsHaveEightCardFitLikely",
  "module.stayman.openerStillBalancedLikely",
  "module.stayman.openerHasSecondMajorLikely",
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
