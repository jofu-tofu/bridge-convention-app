import { describe, expect, test } from "vitest";
import { BidSuit } from "../../engine/types";
import type { Call } from "../../engine/types";
import { projectTeaching } from "../teaching-projection-builder";
import type {
  ArbitrationResult,
  EncodedProposal,
  EliminationRecord,
} from "../../core/contracts/module-surface";
import type { DecisionProvenance } from "../../core/contracts/provenance";
import type { ExplanationCatalog } from "../../core/contracts/explanation-catalog";
import { createExplanationCatalog } from "../../core/contracts/explanation-catalog";
import type { TeachingRelation } from "../../core/contracts/teaching-projection";

import {
  makeCall,
  makeRankingMetadata as makeRanking,
  makeClause,
  makeProposal,
  makeEligibility,
  makeEncoded,
  makeArbitration,
  makeProvenance,
} from "../../test-support/convention-factories";

// -- Tests --

describe("projectTeaching", () => {
  test("single winner: one meaning supports one call produces single-rationale CallProjection", () => {
    const proposal = makeProposal({
      meaningId: "stayman:ask-major",
      moduleId: "stayman",
    });
    const encoded = makeEncoded({
      proposal,
      call: makeCall(2, BidSuit.Clubs),
    });
    const arbitration = makeArbitration({
      selected: encoded,
      truthSet: [encoded],
      recommended: [encoded],
    });
    const provenance = makeProvenance({
      applicability: {
        factDependencies: ["hand.hcp"],
        evaluatedConditions: [{ conditionId: "hand.hcp", satisfied: true }],
      },
    });

    const projection = projectTeaching(arbitration, provenance);

    // Single call view with truth status and single-rationale kind
    expect(projection.callViews).toHaveLength(1);
    const callView = projection.callViews[0]!;
    expect(callView.status).toBe("truth");
    expect(callView.projectionKind).toBe("single-rationale");
    expect(callView.supportingMeanings).toEqual(["stayman:ask-major"]);
    expect(callView.primaryMeaning).toBe("stayman:ask-major");

    // One meaning view with live status
    expect(projection.meaningViews).toHaveLength(1);
    expect(projection.meaningViews[0]!.meaningId).toBe("stayman:ask-major");
    expect(projection.meaningViews[0]!.status).toBe("live");

    // One convention contribution
    expect(projection.conventionsApplied).toHaveLength(1);
    expect(projection.conventionsApplied[0]!.moduleId).toBe("stayman");
    expect(projection.conventionsApplied[0]!.role).toBe("primary");
    expect(projection.conventionsApplied[0]!.meaningsProposed).toEqual(["stayman:ask-major"]);

    // No whyNot entries (only one call in truthSet, no alternatives to explain)
    expect(projection.whyNot).toEqual([]);
  });

  test("multi-module: meanings from different modules produce multiple ConventionContribution entries", () => {
    const staymanProposal = makeProposal({
      meaningId: "stayman:ask-major",
      moduleId: "stayman",
      semanticClassId: "bridge:major-explore",
    });
    const transferProposal = makeProposal({
      meaningId: "transfer:hearts",
      moduleId: "jacoby-transfers",
      semanticClassId: "bridge:suit-transfer",
      clauses: [makeClause({ factId: "hand.suitLength.hearts", description: "Hearts >= 5", value: 5 })],
    });
    const staymanEncoded = makeEncoded({
      proposal: staymanProposal,
      call: makeCall(2, BidSuit.Clubs),
    });
    const transferEncoded = makeEncoded({
      proposal: transferProposal,
      call: makeCall(2, BidSuit.Diamonds),
    });
    const arbitration = makeArbitration({
      selected: staymanEncoded,
      truthSet: [staymanEncoded, transferEncoded],
      recommended: [staymanEncoded, transferEncoded],
    });
    const provenance = makeProvenance({
      activation: [
        { moduleId: "stayman", activated: true, reason: "NT opening" },
        { moduleId: "jacoby-transfers", activated: true, reason: "NT opening" },
      ],
    });

    const projection = projectTeaching(arbitration, provenance);

    // Two call views (different calls)
    expect(projection.callViews).toHaveLength(2);
    const staymanView = projection.callViews.find(cv =>
      cv.call.type === "bid" && cv.call.strain === BidSuit.Clubs,
    );
    const transferView = projection.callViews.find(cv =>
      cv.call.type === "bid" && cv.call.strain === BidSuit.Diamonds,
    );
    expect(staymanView).toBeDefined();
    expect(transferView).toBeDefined();
    expect(staymanView!.status).toBe("truth");
    expect(transferView!.status).toBe("truth");

    // Two meaning views
    expect(projection.meaningViews).toHaveLength(2);
    const staymanMeaning = projection.meaningViews.find(mv => mv.meaningId === "stayman:ask-major");
    const transferMeaning = projection.meaningViews.find(mv => mv.meaningId === "transfer:hearts");
    expect(staymanMeaning!.status).toBe("live");
    expect(transferMeaning!.status).toBe("live");

    // Two convention contributions from different modules
    expect(projection.conventionsApplied).toHaveLength(2);
    const staymanContrib = projection.conventionsApplied.find(cc => cc.moduleId === "stayman");
    const transferContrib = projection.conventionsApplied.find(cc => cc.moduleId === "jacoby-transfers");
    expect(staymanContrib).toBeDefined();
    expect(transferContrib).toBeDefined();
    expect(staymanContrib!.role).toBe("primary");
    // jacoby-transfers is also in the truth set — its role is "alternative" since it wasn't the selected winner
    expect(transferContrib!.role).toBe("alternative");
    expect(staymanContrib!.meaningsProposed).toEqual(["stayman:ask-major"]);
    expect(transferContrib!.meaningsProposed).toEqual(["transfer:hearts"]);
  });

  test("rejected meanings: eliminated meanings appear in meaningViews with eliminated status", () => {
    const liveProposal = makeProposal({
      meaningId: "stayman:ask-major",
      moduleId: "stayman",
    });
    const liveEncoded = makeEncoded({
      proposal: liveProposal,
      call: makeCall(2, BidSuit.Clubs),
    });

    // A meaning was eliminated at applicability stage
    const eliminations: EliminationRecord[] = [
      {
        candidateBidName: "transfer:hearts",
        moduleId: "jacoby-transfers",
        reason: "One or more clauses not satisfied",
        gateId: "semantic-applicability",
      },
    ];

    const arbitration = makeArbitration({
      selected: liveEncoded,
      truthSet: [liveEncoded],
      recommended: [liveEncoded],
      eliminations,
    });
    const provenance = makeProvenance({
      eliminations: [
        {
          candidateId: "transfer:hearts",
          stage: "applicability",
          reason: "One or more clauses not satisfied",
          evidence: [{ conditionId: "hand.suitLength.hearts", satisfied: false }],
          strength: "entailed",
        },
      ],
    });

    const projection = projectTeaching(arbitration, provenance);

    // Two meaning views: one live, one eliminated
    expect(projection.meaningViews).toHaveLength(2);
    const liveMeaning = projection.meaningViews.find(mv => mv.meaningId === "stayman:ask-major");
    const eliminatedMeaning = projection.meaningViews.find(mv => mv.meaningId === "transfer:hearts");
    expect(liveMeaning!.status).toBe("live");
    expect(eliminatedMeaning!.status).toBe("eliminated");
    expect(eliminatedMeaning!.eliminationReason).toBe("One or more clauses not satisfied");
    expect(eliminatedMeaning!.supportingEvidence).toHaveLength(1);
    expect(eliminatedMeaning!.supportingEvidence[0]!.conditionId).toBe("hand.suitLength.hearts");
    expect(eliminatedMeaning!.supportingEvidence[0]!.satisfied).toBe(false);
  });

  test("near-miss: acceptable set candidates produce WhyNotEntry with near-miss grade", () => {
    const winnerProposal = makeProposal({
      meaningId: "nt:game-raise",
      moduleId: "natural-nt",
    });
    const winnerEncoded = makeEncoded({
      proposal: winnerProposal,
      call: makeCall(3, BidSuit.NoTrump),
    });

    // Near-miss: hand conditions partially satisfied, in acceptable set
    const nearMissProposal = makeProposal({
      meaningId: "nt:invite",
      moduleId: "natural-nt",
      clauses: [
        makeClause({ factId: "hand.hcp", value: 8, satisfied: false, description: "HCP >= 8" }),
        makeClause({ factId: "hand.hcp", value: 9, operator: "lte", satisfied: true, description: "HCP <= 9" }),
      ],
    });
    const nearMissEncoded = makeEncoded({
      proposal: nearMissProposal,
      call: makeCall(2, BidSuit.NoTrump),
      eligibility: makeEligibility({
        hand: {
          satisfied: false,
          failedConditions: [{ name: "hand.hcp", description: "HCP >= 8" }],
        },
      }),
    });

    const arbitration = makeArbitration({
      selected: winnerEncoded,
      truthSet: [winnerEncoded],
      acceptableSet: [nearMissEncoded],
      recommended: [winnerEncoded],
    });
    const provenance = makeProvenance({
      eliminations: [
        {
          candidateId: "nt:invite",
          stage: "applicability",
          reason: "One or more clauses not satisfied",
          evidence: [{ conditionId: "hand.hcp", satisfied: false }],
          strength: "preference",
        },
      ],
    });

    const projection = projectTeaching(arbitration, provenance);

    // WhyNot entry for the eliminated call (no ped graph → grade "wrong")
    expect(projection.whyNot).toHaveLength(1);
    const whyNot = projection.whyNot[0]!;
    expect(whyNot.call).toEqual(makeCall(2, BidSuit.NoTrump));
    expect(whyNot.grade).toBe("wrong");
    expect(whyNot.eliminationStage).toBe("applicability");
    expect(whyNot.explanation.length).toBeGreaterThan(0);
  });

  test("no selection: empty truth set produces all WhyNotEntry and no call views with truth status", () => {
    const eliminatedProposal = makeProposal({
      meaningId: "stayman:ask-major",
      moduleId: "stayman",
    });
    const eliminatedEncoded = makeEncoded({
      proposal: eliminatedProposal,
      call: makeCall(2, BidSuit.Clubs),
      eligibility: makeEligibility({
        hand: {
          satisfied: false,
          failedConditions: [{ name: "hand.hcp", description: "HCP >= 15" }],
        },
      }),
    });

    const eliminations: EliminationRecord[] = [
      {
        candidateBidName: "stayman:ask-major",
        moduleId: "stayman",
        reason: "One or more clauses not satisfied",
        gateId: "semantic-applicability",
      },
    ];

    const arbitration = makeArbitration({
      selected: null,
      truthSet: [],
      acceptableSet: [eliminatedEncoded],
      recommended: [],
      eliminations,
    });
    const provenance = makeProvenance({
      eliminations: [
        {
          candidateId: "stayman:ask-major",
          stage: "applicability",
          reason: "One or more clauses not satisfied",
          evidence: [{ conditionId: "hand.hcp", satisfied: false }],
          strength: "entailed",
        },
      ],
    });

    const projection = projectTeaching(arbitration, provenance);

    // No truth-status call views
    const truthViews = projection.callViews.filter(cv => cv.status === "truth");
    expect(truthViews).toHaveLength(0);

    // WhyNot entry for the eliminated call
    expect(projection.whyNot).toHaveLength(1);
    expect(projection.whyNot[0]!.call).toEqual(makeCall(2, BidSuit.Clubs));
    expect(projection.whyNot[0]!.grade).toBe("wrong");

    // Meaning view shows eliminated
    expect(projection.meaningViews).toHaveLength(1);
    expect(projection.meaningViews[0]!.status).toBe("eliminated");
  });

  test("merged-equivalent: multiple meanings with same semanticClassId encoding to same call", () => {
    const proposal1 = makeProposal({
      meaningId: "nt:quantitative-invite-a",
      moduleId: "natural-nt",
      semanticClassId: "bridge:nt-invite",
    });
    const proposal2 = makeProposal({
      meaningId: "nt:quantitative-invite-b",
      moduleId: "natural-nt",
      semanticClassId: "bridge:nt-invite",
    });
    const call = makeCall(2, BidSuit.NoTrump);
    const encoded1 = makeEncoded({ proposal: proposal1, call });
    const encoded2 = makeEncoded({ proposal: proposal2, call });

    const arbitration = makeArbitration({
      selected: encoded1,
      truthSet: [encoded1, encoded2],
      recommended: [encoded1, encoded2],
    });
    const provenance = makeProvenance();

    const projection = projectTeaching(arbitration, provenance);

    // Merged into a single call view with merged-equivalent kind
    const ntViews = projection.callViews.filter(cv =>
      cv.call.type === "bid" && cv.call.strain === BidSuit.NoTrump && cv.call.level === 2,
    );
    expect(ntViews).toHaveLength(1);
    expect(ntViews[0]!.projectionKind).toBe("merged-equivalent");
    expect(ntViews[0]!.supportingMeanings).toContain("nt:quantitative-invite-a");
    expect(ntViews[0]!.supportingMeanings).toContain("nt:quantitative-invite-b");
    expect(ntViews[0]!.status).toBe("truth");
  });

  test("multi-rationale-same-call: distinct semantic classes encoding to same call", () => {
    const proposal1 = makeProposal({
      meaningId: "nt:quantitative-invite",
      moduleId: "natural-nt",
      semanticClassId: "bridge:nt-invite",
    });
    const proposal2 = makeProposal({
      meaningId: "stayman:stopper-probe",
      moduleId: "stayman",
      semanticClassId: "stayman:stopper-probe",
    });
    const call = makeCall(2, BidSuit.NoTrump);
    const encoded1 = makeEncoded({ proposal: proposal1, call });
    const encoded2 = makeEncoded({ proposal: proposal2, call });

    const arbitration = makeArbitration({
      selected: encoded1,
      truthSet: [encoded1, encoded2],
      recommended: [encoded1, encoded2],
    });
    const provenance = makeProvenance();

    const projection = projectTeaching(arbitration, provenance);

    const ntViews = projection.callViews.filter(cv =>
      cv.call.type === "bid" && cv.call.strain === BidSuit.NoTrump && cv.call.level === 2,
    );
    expect(ntViews).toHaveLength(1);
    expect(ntViews[0]!.projectionKind).toBe("multi-rationale-same-call");
    expect(ntViews[0]!.supportingMeanings).toHaveLength(2);
    expect(ntViews[0]!.status).toBe("truth");
  });

  test("primary explanation nodes are populated from provenance applicability evidence", () => {
    const proposal = makeProposal({ meaningId: "stayman:ask-major" });
    const encoded = makeEncoded({ proposal, call: makeCall(2, BidSuit.Clubs) });
    const arbitration = makeArbitration({
      selected: encoded,
      truthSet: [encoded],
      recommended: [encoded],
    });
    const provenance = makeProvenance({
      applicability: {
        factDependencies: ["hand.hcp"],
        evaluatedConditions: [
          { conditionId: "hand.hcp", satisfied: true },
          { conditionId: "hand.suitLength.hearts", satisfied: true },
        ],
      },
    });

    const projection = projectTeaching(arbitration, provenance);

    expect(projection.primaryExplanation.length).toBeGreaterThan(0);
    // Condition nodes reflect the evaluated conditions
    const conditionNodes = projection.primaryExplanation.filter(n => n.kind === "condition");
    expect(conditionNodes.length).toBe(2);
    expect(conditionNodes[0]!.passed).toBe(true);
    expect(conditionNodes[1]!.passed).toBe(true);
  });

  test("hand space summary provides defaults when no posterior data available", () => {
    const encoded = makeEncoded();
    const arbitration = makeArbitration({
      selected: encoded,
      truthSet: [encoded],
      recommended: [encoded],
    });
    const provenance = makeProvenance();

    const projection = projectTeaching(arbitration, provenance);

    expect(projection.handSpace.seatLabel).toBe("South");
    expect(projection.handSpace.hcpRange.min).toBeLessThanOrEqual(projection.handSpace.hcpRange.max);
    expect(typeof projection.handSpace.shapeDescription).toBe("string");
  });

  test("with catalog: primary explanation nodes get explanationId and templateKey enrichment", () => {
    const catalog: ExplanationCatalog = createExplanationCatalog([
      {
        explanationId: "nt.hcp.base",
        factId: "hand.hcp",
        templateKey: "nt.hcp.base.mechanical",
        preferredLevel: "mechanical",
        roles: ["supporting"],
      },
      {
        explanationId: "nt.suit.fourCardMajor",
        factId: "bridge.hasFourCardMajor",
        templateKey: "nt.suit.fourCardMajor.supporting",
        contrastiveTemplateKey: "nt.suit.fourCardMajor.whyNot",
        preferredLevel: "mechanical",
        roles: ["supporting", "blocking"],
      },
    ]);

    const proposal = makeProposal({ meaningId: "stayman:ask-major" });
    const encoded = makeEncoded({ proposal, call: makeCall(2, BidSuit.Clubs) });
    const arbitration = makeArbitration({
      selected: encoded,
      truthSet: [encoded],
      recommended: [encoded],
    });
    const provenance = makeProvenance({
      applicability: {
        factDependencies: ["hand.hcp", "bridge.hasFourCardMajor"],
        evaluatedConditions: [
          { conditionId: "hand.hcp", satisfied: true },
          { conditionId: "bridge.hasFourCardMajor", satisfied: true },
        ],
      },
    });

    const projection = projectTeaching(arbitration, provenance, { explanationCatalog: catalog });

    const conditionNodes = projection.primaryExplanation.filter(n => n.kind === "condition");
    expect(conditionNodes.length).toBe(2);

    // hand.hcp is matched by catalog and resolved to template string
    const hcpNode = conditionNodes.find(n => n.explanationId === "nt.hcp.base");
    expect(hcpNode).toBeDefined();
    expect(hcpNode!.templateKey).toBe("nt.hcp.base.mechanical");

    // bridge.hasFourCardMajor is matched by catalog and resolved to template string
    const majorNode = conditionNodes.find(n => n.explanationId === "nt.suit.fourCardMajor");
    expect(majorNode).toBeDefined();
    expect(majorNode!.templateKey).toBe("nt.suit.fourCardMajor.supporting");
  });

  test("with catalog: whyNot explanation nodes use contrastiveTemplateKey when available", () => {
    const catalog: ExplanationCatalog = createExplanationCatalog([
      {
        explanationId: "nt.hcp.invite",
        factId: "hand.hcp",
        templateKey: "nt.hcp.invite.supporting",
        contrastiveTemplateKey: "nt.hcp.invite.whyNot",
        preferredLevel: "semantic",
        roles: ["supporting", "blocking"],
      },
    ]);

    const winnerProposal = makeProposal({
      meaningId: "nt:game-raise",
      moduleId: "natural-nt",
    });
    const winnerEncoded = makeEncoded({
      proposal: winnerProposal,
      call: makeCall(3, BidSuit.NoTrump),
    });

    const nearMissProposal = makeProposal({
      meaningId: "nt:invite",
      moduleId: "natural-nt",
      clauses: [makeClause({ factId: "hand.hcp", satisfied: false, description: "HCP >= 8" })],
    });
    const nearMissEncoded = makeEncoded({
      proposal: nearMissProposal,
      call: makeCall(2, BidSuit.NoTrump),
    });

    const arbitration = makeArbitration({
      selected: winnerEncoded,
      truthSet: [winnerEncoded],
      acceptableSet: [nearMissEncoded],
      recommended: [winnerEncoded],
    });
    const provenance = makeProvenance({
      eliminations: [
        {
          candidateId: "nt:invite",
          stage: "applicability",
          reason: "One or more clauses not satisfied",
          evidence: [{ conditionId: "hand.hcp", satisfied: false }],
          strength: "preference",
        },
      ],
    });

    const projection = projectTeaching(arbitration, provenance, { explanationCatalog: catalog });

    expect(projection.whyNot).toHaveLength(1);
    const whyNotConditions = projection.whyNot[0]!.explanation.filter(n => n.kind === "condition");
    expect(whyNotConditions).toHaveLength(1);
    expect(whyNotConditions[0]!.explanationId).toBe("nt.hcp.invite");
    // Uses contrastiveTemplateKey for whyNot context
    expect(whyNotConditions[0]!.templateKey).toBe("nt.hcp.invite.whyNot");
  });

  test("without catalog: explanation nodes have no explanationId or templateKey (backward compat)", () => {
    const proposal = makeProposal({ meaningId: "stayman:ask-major" });
    const encoded = makeEncoded({ proposal, call: makeCall(2, BidSuit.Clubs) });
    const arbitration = makeArbitration({
      selected: encoded,
      truthSet: [encoded],
      recommended: [encoded],
    });
    const provenance = makeProvenance({
      applicability: {
        factDependencies: ["hand.hcp"],
        evaluatedConditions: [
          { conditionId: "hand.hcp", satisfied: true },
        ],
      },
    });

    const projection = projectTeaching(arbitration, provenance);

    const conditionNodes = projection.primaryExplanation.filter(n => n.kind === "condition");
    expect(conditionNodes.length).toBe(1);
    expect(conditionNodes[0]!.explanationId).toBeUndefined();
    expect(conditionNodes[0]!.templateKey).toBeUndefined();
  });

  test("with teachingRelations: near-miss WhyNotEntry gets familyRelation populated", () => {
    const winnerProposal = makeProposal({
      meaningId: "stayman:ask-major",
      moduleId: "stayman",
    });
    const winnerEncoded = makeEncoded({
      proposal: winnerProposal,
      call: makeCall(2, BidSuit.Clubs),
    });

    const nearMissProposal = makeProposal({
      meaningId: "transfer:to-hearts",
      moduleId: "jacoby-transfers",
      clauses: [makeClause({ factId: "hand.suitLength.hearts", satisfied: false, description: "Hearts >= 5" })],
    });
    const nearMissEncoded = makeEncoded({
      proposal: nearMissProposal,
      call: makeCall(2, BidSuit.Diamonds),
    });

    const arbitration = makeArbitration({
      selected: winnerEncoded,
      truthSet: [winnerEncoded],
      acceptableSet: [nearMissEncoded],
      recommended: [winnerEncoded],
    });
    const provenance = makeProvenance({
      eliminations: [
        {
          candidateId: "transfer:to-hearts",
          stage: "applicability",
          reason: "Hearts not long enough",
          evidence: [{ conditionId: "hand.suitLength.hearts", satisfied: false }],
          strength: "preference",
        },
      ],
    });

    const relations: TeachingRelation[] = [
      { kind: "near-miss-of", a: "stayman:ask-major", b: "transfer:to-hearts" },
    ];

    const projection = projectTeaching(arbitration, provenance, {
      teachingRelations: relations,
    });

    expect(projection.whyNot).toHaveLength(1);
    const whyNot = projection.whyNot[0]!;
    expect(whyNot.grade).toBe("near-miss");
    expect(whyNot.familyRelation).toBeDefined();
    expect(whyNot.familyRelation!.kind).toBe("near-miss-of");
    expect(whyNot.familyRelation!.a).toBe("stayman:ask-major");
    expect(whyNot.familyRelation!.b).toBe("transfer:to-hearts");
  });

  test("without teachingRelations: WhyNotEntry has no familyRelation (backward compat)", () => {
    const winnerProposal = makeProposal({
      meaningId: "stayman:ask-major",
      moduleId: "stayman",
    });
    const winnerEncoded = makeEncoded({
      proposal: winnerProposal,
      call: makeCall(2, BidSuit.Clubs),
    });

    const nearMissProposal = makeProposal({
      meaningId: "transfer:to-hearts",
      moduleId: "jacoby-transfers",
      clauses: [makeClause({ factId: "hand.suitLength.hearts", satisfied: false })],
    });
    const nearMissEncoded = makeEncoded({
      proposal: nearMissProposal,
      call: makeCall(2, BidSuit.Diamonds),
    });

    const arbitration = makeArbitration({
      selected: winnerEncoded,
      truthSet: [winnerEncoded],
      acceptableSet: [nearMissEncoded],
      recommended: [winnerEncoded],
    });
    const provenance = makeProvenance();

    const projection = projectTeaching(arbitration, provenance);

    expect(projection.whyNot).toHaveLength(1);
    expect(projection.whyNot[0]!.familyRelation).toBeUndefined();
  });

  test("with teachingRelations: eliminated meaningView gets eliminationReason enriched", () => {
    const winnerProposal = makeProposal({
      meaningId: "bridge:to-3nt",
      moduleId: "natural-nt",
    });
    const winnerEncoded = makeEncoded({
      proposal: winnerProposal,
      call: makeCall(3, BidSuit.NoTrump),
    });

    const eliminations: EliminationRecord[] = [
      {
        candidateBidName: "bridge:nt-invite",
        moduleId: "natural-nt",
        reason: "Too many HCP for invite",
        gateId: "semantic-applicability",
      },
    ];

    const arbitration = makeArbitration({
      selected: winnerEncoded,
      truthSet: [winnerEncoded],
      recommended: [winnerEncoded],
      eliminations,
    });
    const provenance = makeProvenance({
      eliminations: [
        {
          candidateId: "bridge:nt-invite",
          stage: "applicability",
          reason: "Too many HCP for invite",
          evidence: [{ conditionId: "hand.hcp", satisfied: false }],
          strength: "entailed",
        },
      ],
    });

    const relations: TeachingRelation[] = [
      { kind: "stronger-than", a: "bridge:to-3nt", b: "bridge:nt-invite" },
    ];

    const projection = projectTeaching(arbitration, provenance, {
      teachingRelations: relations,
    });

    const eliminatedMeaning = projection.meaningViews.find(mv => mv.meaningId === "bridge:nt-invite");
    expect(eliminatedMeaning).toBeDefined();
    expect(eliminatedMeaning!.status).toBe("eliminated");
    // The eliminationReason should be enriched with the relation context
    expect(eliminatedMeaning!.eliminationReason).toContain("Too many HCP for invite");
  });

  test("with catalog: meaning-level entries produce convention-reference nodes", () => {
    const catalog: ExplanationCatalog = createExplanationCatalog([
      {
        explanationId: "nt.stayman.eligible",
        factId: "module.stayman.eligible",
        templateKey: "nt.stayman.eligible.supporting",
        preferredLevel: "semantic",
        roles: ["supporting"],
      },
      {
        explanationId: "nt.stayman.askMajor",
        meaningId: "stayman:ask-major",
        templateKey: "nt.stayman.askMajor.semantic",
        preferredLevel: "semantic",
        roles: ["pedagogical"],
      },
    ]);

    const proposal = makeProposal({ meaningId: "stayman:ask-major" });
    const encoded = makeEncoded({ proposal, call: makeCall(2, BidSuit.Clubs) });
    const arbitration = makeArbitration({
      selected: encoded,
      truthSet: [encoded],
      recommended: [encoded],
    });
    const provenance = makeProvenance({
      applicability: {
        factDependencies: ["module.stayman.eligible"],
        evaluatedConditions: [
          { conditionId: "module.stayman.eligible", satisfied: true },
        ],
      },
    });

    const projection = projectTeaching(arbitration, provenance, { explanationCatalog: catalog });

    // Should NOT produce convention-reference nodes because the fact entry has no meaningId
    // (the fact entry "nt.stayman.eligible" has factId but no meaningId)
    const refNodes = projection.primaryExplanation.filter(n => n.kind === "convention-reference");
    expect(refNodes).toHaveLength(0);

    // Condition node should be enriched
    const conditionNodes = projection.primaryExplanation.filter(n => n.kind === "condition");
    expect(conditionNodes).toHaveLength(1);
    expect(conditionNodes[0]!.explanationId).toBe("nt.stayman.eligible");
  });
});
