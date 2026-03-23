import { describe, it, expect } from "vitest";
import { BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import {
  buildClauseDescriptionIndex,
  buildPrimaryExplanation,
} from "../explanation-builder";
import type {
  ArbitrationResult,
  EncodedProposal,
} from "../../pipeline/pipeline-types";
import type { DecisionProvenance } from "../../../core/contracts/provenance";
import type { FactExplanationEntry, MeaningExplanationEntry } from "../../../core/contracts/explanation-catalog";
import type { CatalogIndex } from "../teaching-projection-builder";

import {
  makeCall,
  makeRankingMetadata as makeRanking,
  makeClause,
  makeProposal,
  makeEligibility,
  makeEncoded,
  makeArbitration,
  makeProvenance,
  makeCatalogEntry,
} from "../../../test-support/convention-factories";

function makeCatalogIndex(
  byFactId: [string, FactExplanationEntry][] = [],
  byMeaningId: [string, MeaningExplanationEntry][] = [],
): CatalogIndex {
  return {
    byFactId: new Map(byFactId),
    byMeaningId: new Map(byMeaningId),
  };
}

// -- Tests: buildClauseDescriptionIndex --

describe("buildClauseDescriptionIndex", () => {
  it("selected proposal clauses produce a map from factId to description", () => {
    const selected = makeEncoded({
      proposal: makeProposal({
        clauses: [
          makeClause({ factId: "hand.hcp", description: "HCP >= 15" }),
          makeClause({ factId: "hand.length.spades", description: "Spades >= 4" }),
        ],
      }),
    });
    const arbitration = makeArbitration({ selected });

    const index = buildClauseDescriptionIndex(arbitration);

    expect(index.get("hand.hcp")).toBe("HCP >= 15");
    expect(index.get("hand.length.spades")).toBe("Spades >= 4");
    expect(index.size).toBe(2);
  });

  it("truth set clauses fill gaps when selected proposal does not cover them", () => {
    const selected = makeEncoded({
      proposal: makeProposal({
        clauses: [makeClause({ factId: "hand.hcp", description: "HCP >= 15" })],
      }),
    });
    const truthEntry = makeEncoded({
      proposal: makeProposal({
        clauses: [makeClause({ factId: "hand.shape", description: "Balanced" })],
      }),
    });
    const arbitration = makeArbitration({ selected, truthSet: [truthEntry] });

    const index = buildClauseDescriptionIndex(arbitration);

    expect(index.get("hand.hcp")).toBe("HCP >= 15");
    expect(index.get("hand.shape")).toBe("Balanced");
  });

  it("selected clause wins over truth set clause for the same factId", () => {
    const selected = makeEncoded({
      proposal: makeProposal({
        clauses: [makeClause({ factId: "hand.hcp", description: "HCP >= 15 (selected)" })],
      }),
    });
    const truthEntry = makeEncoded({
      proposal: makeProposal({
        clauses: [makeClause({ factId: "hand.hcp", description: "HCP >= 12 (truth)" })],
      }),
    });
    const arbitration = makeArbitration({ selected, truthSet: [truthEntry] });

    const index = buildClauseDescriptionIndex(arbitration);

    expect(index.get("hand.hcp")).toBe("HCP >= 15 (selected)");
  });

  it("no selection produces a map from truth set clauses only", () => {
    const truthEntry = makeEncoded({
      proposal: makeProposal({
        clauses: [makeClause({ factId: "hand.hcp", description: "HCP >= 12" })],
      }),
    });
    const arbitration = makeArbitration({ selected: null, truthSet: [truthEntry] });

    const index = buildClauseDescriptionIndex(arbitration);

    expect(index.get("hand.hcp")).toBe("HCP >= 12");
    expect(index.size).toBe(1);
  });

  it("no selection and empty truth set produces empty map", () => {
    const arbitration = makeArbitration({ selected: null, truthSet: [] });

    const index = buildClauseDescriptionIndex(arbitration);

    expect(index.size).toBe(0);
  });
});

// -- Tests: buildPrimaryExplanation --

describe("buildPrimaryExplanation", () => {
  it("provenance conditions produce ExplanationNode[] with kind, content, and passed", () => {
    const provenance = makeProvenance({
      applicability: {
        factDependencies: ["hand.hcp"],
        evaluatedConditions: [
          { conditionId: "hand.hcp", satisfied: true },
          { conditionId: "hand.shape", satisfied: false },
        ],
      },
    });

    const nodes = buildPrimaryExplanation(provenance);

    expect(nodes).toHaveLength(2);
    expect(nodes[0]!.kind).toBe("condition");
    expect(nodes[0]!.content).toBe("hand.hcp"); // falls back to conditionId
    expect(nodes[0]!.passed).toBe(true);
    expect(nodes[1]!.kind).toBe("condition");
    expect(nodes[1]!.content).toBe("hand.shape");
    expect(nodes[1]!.passed).toBe(false);
  });

  it("with catalog index, nodes get templateKey and explanationId", () => {
    const entry = makeCatalogEntry({
      explanationId: "nt.hcp.base",
      factId: "hand.hcp",
      templateKey: "nt.hcp.base.mechanical",
      displayText: "High card points",
    });
    const catalogIndex = makeCatalogIndex([["hand.hcp", entry]]);
    const provenance = makeProvenance({
      applicability: {
        factDependencies: ["hand.hcp"],
        evaluatedConditions: [{ conditionId: "hand.hcp", satisfied: true }],
      },
    });

    const nodes = buildPrimaryExplanation(provenance, catalogIndex);

    expect(nodes).toHaveLength(1);
    expect(nodes[0]!.explanationId).toBe("nt.hcp.base");
    expect(nodes[0]!.templateKey).toBe("nt.hcp.base.mechanical");
    expect(nodes[0]!.content).toBe("High card points");
  });

  it("clause descriptions take priority over catalog displayText", () => {
    const entry = makeCatalogEntry({
      explanationId: "nt.hcp.base",
      factId: "hand.hcp",
      templateKey: "nt.hcp.base.mechanical",
      displayText: "High card points (catalog)",
    });
    const catalogIndex = makeCatalogIndex([["hand.hcp", entry]]);
    const clauseDescriptions = new Map([["hand.hcp", "HCP >= 15 (clause)"]]);
    const provenance = makeProvenance({
      applicability: {
        factDependencies: ["hand.hcp"],
        evaluatedConditions: [{ conditionId: "hand.hcp", satisfied: true }],
      },
    });

    const nodes = buildPrimaryExplanation(provenance, catalogIndex, clauseDescriptions);

    expect(nodes[0]!.content).toBe("HCP >= 15 (clause)");
    // Still gets catalog enrichment
    expect(nodes[0]!.explanationId).toBe("nt.hcp.base");
  });

  it("fact entries produce condition nodes with catalog enrichment", () => {
    const factEntry = makeCatalogEntry({
      explanationId: "nt.stayman.eligible",
      factId: "module.stayman.eligible",
      templateKey: "nt.stayman.eligible.supporting",
      displayText: "Eligible for Stayman",
    });
    const catalogIndex = makeCatalogIndex(
      [["module.stayman.eligible", factEntry]],
    );
    const provenance = makeProvenance({
      applicability: {
        factDependencies: ["module.stayman.eligible"],
        evaluatedConditions: [
          { conditionId: "module.stayman.eligible", satisfied: true },
        ],
      },
    });

    const nodes = buildPrimaryExplanation(provenance, catalogIndex);

    expect(nodes).toHaveLength(1);
    expect(nodes[0]!.kind).toBe("condition");
    expect(nodes[0]!.content).toBe("Eligible for Stayman");
    expect(nodes[0]!.explanationId).toBe("nt.stayman.eligible");
    expect(nodes[0]!.templateKey).toBe("nt.stayman.eligible.supporting");
  });

  it("multiple fact entries each produce condition nodes", () => {
    const factEntry1 = makeCatalogEntry({
      explanationId: "nt.stayman.eligible",
      factId: "module.stayman.eligible",
      templateKey: "nt.stayman.eligible.supporting",
      displayText: "Eligible for Stayman",
    });
    const factEntry2 = makeCatalogEntry({
      explanationId: "nt.stayman.fourCard",
      factId: "bridge.hasFourCardMajor",
      templateKey: "nt.stayman.fourCard.supporting",
      displayText: "Has a 4-card major",
    });
    const catalogIndex = makeCatalogIndex(
      [
        ["module.stayman.eligible", factEntry1],
        ["bridge.hasFourCardMajor", factEntry2],
      ],
    );
    const provenance = makeProvenance({
      applicability: {
        factDependencies: ["module.stayman.eligible", "bridge.hasFourCardMajor"],
        evaluatedConditions: [
          { conditionId: "module.stayman.eligible", satisfied: true },
          { conditionId: "bridge.hasFourCardMajor", satisfied: true },
        ],
      },
    });

    const nodes = buildPrimaryExplanation(provenance, catalogIndex);

    const conditionNodes = nodes.filter(n => n.kind === "condition");
    expect(conditionNodes).toHaveLength(2);
    expect(conditionNodes[0]!.content).toBe("Eligible for Stayman");
    expect(conditionNodes[1]!.content).toBe("Has a 4-card major");
  });

  it("without catalog, nodes have no explanationId or templateKey", () => {
    const provenance = makeProvenance({
      applicability: {
        factDependencies: ["hand.hcp"],
        evaluatedConditions: [{ conditionId: "hand.hcp", satisfied: true }],
      },
    });

    const nodes = buildPrimaryExplanation(provenance);

    expect(nodes).toHaveLength(1);
    expect(nodes[0]!.explanationId).toBeUndefined();
    expect(nodes[0]!.templateKey).toBeUndefined();
  });

  it("empty evaluatedConditions produce empty node array", () => {
    const provenance = makeProvenance({
      applicability: { factDependencies: [], evaluatedConditions: [] },
    });

    const nodes = buildPrimaryExplanation(provenance);

    expect(nodes).toEqual([]);
  });
});
