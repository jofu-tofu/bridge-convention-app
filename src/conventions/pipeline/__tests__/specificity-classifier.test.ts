import { describe, it, expect } from "vitest";
import { classifySpecificityBasis } from "../evaluation/specificity-classifier";
import { makeSurface } from "../../../test-support/convention-factories";
import { FactLayer } from '../../core/fact-layer';
import type { FactCatalogExtension, FactDefinition } from "../../core/fact-catalog";
import { EvaluationWorld } from "../../core/fact-catalog";
import type { BidMeaningClause } from "../evaluation/meaning";
import { FactOperator } from "../evaluation/meaning";

// ─── Helpers ────────────────────────────────────────────────

function clause(factId: string): BidMeaningClause {
  return {
    clauseId: `clause-${factId}`,
    factId,
    operator: FactOperator.Gte,
    value: 1,
  };
}

function boolClause(factId: string): BidMeaningClause {
  return {
    clauseId: `clause-${factId}`,
    factId,
    operator: FactOperator.Boolean,
    value: true,
  };
}

function makeExtension(definitions: FactDefinition[]): FactCatalogExtension {
  return {
    definitions,
    evaluators: new Map(),
  };
}

// ─── Shared facts extension (bridge-derived) ────────────────

const bridgeExtension = makeExtension([
  {
    id: "bridge.hasFourCardMajor",
    layer: FactLayer.BridgeDerived,
    world: EvaluationWorld.ActingHand,
    description: "Has at least one 4+ card major",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.spades", "hand.suitLength.hearts"],
    constrainsDimensions: ["suitIdentity"],
  },
  {
    id: "bridge.hasFiveCardMajor",
    layer: FactLayer.BridgeDerived,
    world: EvaluationWorld.ActingHand,
    description: "Has at least one 5+ card major",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.spades", "hand.suitLength.hearts"],
    constrainsDimensions: ["suitIdentity"],
  },
]);

// ─── Module extension with opaque facts (empty derivesFrom) ─

const opaqueModuleExtension = makeExtension([
  {
    id: "module.dont.bothMajors",
    layer: FactLayer.ModuleDerived,
    world: EvaluationWorld.ActingHand,
    description: "Both majors for DONT 2H",
    valueType: "boolean",
    derivesFrom: [],
    constrainsDimensions: ["suitIdentity", "suitLength", "suitRelation"],
  },
  {
    id: "module.dont.hasHeartSupport",
    layer: FactLayer.ModuleDerived,
    world: EvaluationWorld.ActingHand,
    description: "3+ hearts",
    valueType: "boolean",
    derivesFrom: [],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
]);

// ─── Module extension with transparent facts (derivesFrom populated to primitives) ─

const transparentModuleExtension = makeExtension([
  {
    id: "module.stayman.hasFourCardMajor",
    layer: FactLayer.ModuleDerived,
    world: EvaluationWorld.ActingHand,
    description: "Has 4+ card major (derived from primitives)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.spades", "hand.suitLength.hearts"],
    constrainsDimensions: ["suitIdentity"],
  },
]);

// ─── Module extension with transitive derivesFrom ──────────

const transitiveModuleExtension = makeExtension([
  {
    id: "module.dont.singleSuitClubs",
    layer: FactLayer.ModuleDerived,
    world: EvaluationWorld.ActingHand,
    description: "Single suit is clubs",
    valueType: "boolean",
    derivesFrom: ["module.dont.singleSuited"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: "module.dont.singleSuited",
    layer: FactLayer.ModuleDerived,
    world: EvaluationWorld.ActingHand,
    description: "Single-suited hand (opaque — derivesFrom is empty)",
    valueType: "boolean",
    derivesFrom: [],
    constrainsDimensions: ["shapeClass", "suitLength"],
  },
]);

// ─── Tests ──────────────────────────────────────────────────

describe("classifySpecificityBasis", () => {
  it('returns "derived" for a surface with only primitive facts (hand.*)', () => {
    const surface = makeSurface({
      clauses: [
        clause("hand.hcp"),
        clause("hand.suitLength.hearts"),
      ],
    });
    expect(classifySpecificityBasis(surface, [bridgeExtension])).toBe("derived");
  });

  it('returns "asserted" for a surface using module-derived facts with empty derivesFrom', () => {
    const surface = makeSurface({
      clauses: [
        boolClause("module.dont.bothMajors"),
        boolClause("module.dont.hasHeartSupport"),
      ],
    });
    expect(classifySpecificityBasis(surface, [opaqueModuleExtension])).toBe("asserted");
  });

  it('returns "partial" for a surface mixing primitive and opaque module facts', () => {
    const surface = makeSurface({
      clauses: [
        clause("hand.hcp"),
        boolClause("module.dont.bothMajors"),
      ],
    });
    expect(classifySpecificityBasis(surface, [opaqueModuleExtension])).toBe("partial");
  });

  it('returns "derived" for a surface with no clauses', () => {
    const surface = makeSurface({ clauses: [] });
    expect(classifySpecificityBasis(surface, [bridgeExtension])).toBe("derived");
  });

  it('returns "derived" for a surface using a bridge-derived fact with populated derivesFrom', () => {
    const surface = makeSurface({
      clauses: [
        boolClause("bridge.hasFourCardMajor"),
      ],
    });
    expect(classifySpecificityBasis(surface, [bridgeExtension])).toBe("derived");
  });

  it('returns "derived" for module facts with transparent derivesFrom chains to primitives', () => {
    const surface = makeSurface({
      clauses: [
        boolClause("module.stayman.hasFourCardMajor"),
      ],
    });
    expect(classifySpecificityBasis(surface, [transparentModuleExtension])).toBe("derived");
  });

  it('returns "asserted" for module facts with transitive derivesFrom leading to opaque root', () => {
    const surface = makeSurface({
      clauses: [
        boolClause("module.dont.singleSuitClubs"),
      ],
    });
    expect(classifySpecificityBasis(surface, [transitiveModuleExtension])).toBe("asserted");
  });

  it('returns "partial" when mixing bridge-derived transparent and module opaque facts', () => {
    const surface = makeSurface({
      clauses: [
        boolClause("bridge.hasFiveCardMajor"),
        boolClause("module.dont.bothMajors"),
      ],
    });
    expect(
      classifySpecificityBasis(surface, [bridgeExtension, opaqueModuleExtension]),
    ).toBe("partial");
  });
});
