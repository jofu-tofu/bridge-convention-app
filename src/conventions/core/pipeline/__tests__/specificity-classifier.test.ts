import { describe, it, expect } from "vitest";
import { classifySpecificityBasis } from "../specificity-classifier";
import { makeSurface } from "../../../../test-support/convention-factories";
import type { FactCatalogExtension, FactDefinition } from "../../../../core/contracts/fact-catalog";
import type { MeaningSurfaceClause } from "../../../../core/contracts/meaning";

// ─── Helpers ────────────────────────────────────────────────

function clause(factId: string, description = factId): MeaningSurfaceClause {
  return {
    clauseId: `clause-${factId}`,
    factId,
    operator: "gte",
    value: 1,
    description,
  };
}

function boolClause(factId: string, description = factId): MeaningSurfaceClause {
  return {
    clauseId: `clause-${factId}`,
    factId,
    operator: "boolean",
    value: true,
    description,
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
    layer: "bridge-derived",
    world: "acting-hand",
    description: "Has at least one 4+ card major",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.spades", "hand.suitLength.hearts"],
    constrainsDimensions: ["suitIdentity"],
  },
  {
    id: "bridge.hasFiveCardMajor",
    layer: "bridge-derived",
    world: "acting-hand",
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
    layer: "module-derived",
    world: "acting-hand",
    description: "Both majors for DONT 2H",
    valueType: "boolean",
    derivesFrom: [],
    constrainsDimensions: ["suitIdentity", "suitLength", "suitRelation"],
  },
  {
    id: "module.dont.hasHeartSupport",
    layer: "module-derived",
    world: "acting-hand",
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
    layer: "module-derived",
    world: "acting-hand",
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
    layer: "module-derived",
    world: "acting-hand",
    description: "Single suit is clubs",
    valueType: "boolean",
    derivesFrom: ["module.dont.singleSuited"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: "module.dont.singleSuited",
    layer: "module-derived",
    world: "acting-hand",
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
        clause("hand.hcp", "8+ HCP"),
        clause("hand.suitLength.hearts", "4+ hearts"),
      ],
    });
    expect(classifySpecificityBasis(surface, [bridgeExtension])).toBe("derived");
  });

  it('returns "asserted" for a surface using module-derived facts with empty derivesFrom', () => {
    const surface = makeSurface({
      clauses: [
        boolClause("module.dont.bothMajors", "Both majors"),
        boolClause("module.dont.hasHeartSupport", "Heart support"),
      ],
    });
    expect(classifySpecificityBasis(surface, [opaqueModuleExtension])).toBe("asserted");
  });

  it('returns "partial" for a surface mixing primitive and opaque module facts', () => {
    const surface = makeSurface({
      clauses: [
        clause("hand.hcp", "8+ HCP"),
        boolClause("module.dont.bothMajors", "Both majors"),
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
        boolClause("bridge.hasFourCardMajor", "Has 4+ card major"),
      ],
    });
    expect(classifySpecificityBasis(surface, [bridgeExtension])).toBe("derived");
  });

  it('returns "derived" for module facts with transparent derivesFrom chains to primitives', () => {
    const surface = makeSurface({
      clauses: [
        boolClause("module.stayman.hasFourCardMajor", "Stayman 4-card major"),
      ],
    });
    expect(classifySpecificityBasis(surface, [transparentModuleExtension])).toBe("derived");
  });

  it('returns "asserted" for module facts with transitive derivesFrom leading to opaque root', () => {
    const surface = makeSurface({
      clauses: [
        boolClause("module.dont.singleSuitClubs", "Single suit clubs"),
      ],
    });
    expect(classifySpecificityBasis(surface, [transitiveModuleExtension])).toBe("asserted");
  });

  it('returns "partial" when mixing bridge-derived transparent and module opaque facts', () => {
    const surface = makeSurface({
      clauses: [
        boolClause("bridge.hasFiveCardMajor", "Has 5+ card major"),
        boolClause("module.dont.bothMajors", "Both majors"),
      ],
    });
    expect(
      classifySpecificityBasis(surface, [bridgeExtension, opaqueModuleExtension]),
    ).toBe("partial");
  });
});
