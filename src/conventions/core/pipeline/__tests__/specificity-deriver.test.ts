import { describe, it, expect } from "vitest";
import { deriveSpecificity } from "../specificity-deriver";
import { makeSurface } from "../../../../test-support/convention-factories";
import type { FactCatalogExtension, FactDefinition } from "../../../../core/contracts/fact-catalog";
import type { BidMeaningClause } from "../../../../core/contracts/meaning";

// ─── Helpers ────────────────────────────────────────────────

function clause(factId: string, description = factId, value: number = 4): BidMeaningClause {
  return {
    clauseId: `clause-${factId}`,
    factId,
    operator: "gte",
    value,
    description,
  };
}

function boolClause(factId: string, description = factId): BidMeaningClause {
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

// ─── Shared fact extensions ─────────────────────────────────

const bridgeExtension = makeExtension([
  {
    id: "bridge.hasFourCardMajor",
    layer: "bridge-derived",
    world: "acting-hand",
    description: "Has at least one 4+ card major",
    valueType: "boolean",
    constrainsDimensions: ["suitIdentity"],
  },
  {
    id: "bridge.hasFiveCardMajor",
    layer: "bridge-derived",
    world: "acting-hand",
    description: "Has at least one 5+ card major",
    valueType: "boolean",
    constrainsDimensions: ["suitIdentity"],
  },
  {
    id: "bridge.hasShortage",
    layer: "bridge-derived",
    world: "acting-hand",
    description: "Has singleton or void",
    valueType: "boolean",
    constrainsDimensions: ["shapeClass"],
  },
]);

const dontExtension = makeExtension([
  {
    id: "module.dont.bothMajors",
    layer: "module-derived",
    world: "acting-hand",
    description: "Both majors",
    valueType: "boolean",
    constrainsDimensions: ["suitIdentity", "suitLength", "suitRelation"],
  },
  {
    id: "module.dont.singleSuited",
    layer: "module-derived",
    world: "acting-hand",
    description: "Single suited",
    valueType: "boolean",
    constrainsDimensions: ["shapeClass", "suitLength"],
  },
]);

const ntExtension = makeExtension([
  {
    id: "module.ntResponse.gameValues",
    layer: "module-derived",
    world: "acting-hand",
    description: "Game values",
    valueType: "boolean",
    constrainsDimensions: ["pointRange"],
  },
  {
    id: "module.ntResponse.inviteValues",
    layer: "module-derived",
    world: "acting-hand",
    description: "Invite values",
    valueType: "boolean",
    constrainsDimensions: ["pointRange"],
  },
]);

const allExtensions = [bridgeExtension, dontExtension, ntExtension];

// ─── Tests ──────────────────────────────────────────────────

describe("deriveSpecificity", () => {
  it("derives specificity 4 for a Bergen splinter surface with suit binding", () => {
    // Bergen splinter: hand.hcp + hand.suitLength.$suit + bridge.hasShortage
    // With suit binding, $suit resolves to a specific suit — suitIdentity IS counted.
    // hand.hcp → pointRange
    // hand.suitLength.$suit (→ hearts) → suitLength + suitIdentity
    // bridge.hasShortage → shapeClass
    // Total unique dimensions: pointRange, suitLength, suitIdentity, shapeClass = 4
    const surface = makeSurface({
      clauses: [
        clause("hand.hcp", "10+ HCP"),
        clause("hand.suitLength.$suit", "4+ in bound suit"),
        boolClause("bridge.hasShortage", "Has shortage"),
      ],
      surfaceBindings: { suit: "hearts" },
    });

    const result = deriveSpecificity(surface, allExtensions);
    expect(result.advisorySpecificity).toBe(4);
    expect(result.dimensions).toContain("pointRange");
    expect(result.dimensions).toContain("suitLength");
    expect(result.dimensions).toContain("suitIdentity");
    expect(result.dimensions).toContain("shapeClass");
  });

  it("derives specificity 3 for a DONT 2H surface (bothMajors)", () => {
    // module.dont.bothMajors → suitIdentity + suitLength + suitRelation
    const surface = makeSurface({
      clauses: [
        boolClause("module.dont.bothMajors", "Both majors"),
      ],
    });

    const result = deriveSpecificity(surface, allExtensions);
    expect(result.advisorySpecificity).toBe(3);
    expect(result.dimensions).toContain("suitIdentity");
    expect(result.dimensions).toContain("suitLength");
    expect(result.dimensions).toContain("suitRelation");
  });

  it("derives specificity 2 for a DONT single-suited surface", () => {
    // module.dont.singleSuited → shapeClass + suitLength
    const surface = makeSurface({
      clauses: [
        boolClause("module.dont.singleSuited", "Single suited"),
      ],
    });

    const result = deriveSpecificity(surface, allExtensions);
    expect(result.advisorySpecificity).toBe(2);
    expect(result.dimensions).toContain("shapeClass");
    expect(result.dimensions).toContain("suitLength");
  });

  it("derives specificity 0 for a surface with no clauses", () => {
    const surface = makeSurface({
      clauses: [],
    });

    const result = deriveSpecificity(surface, allExtensions);
    expect(result.advisorySpecificity).toBe(0);
    expect(result.dimensions.size).toBe(0);
  });

  it("derives specificity 1 for a surface with only hand.hcp", () => {
    // Bergen opener game after constructive: only hand.hcp → pointRange
    const surface = makeSurface({
      clauses: [
        clause("hand.hcp", "14+ HCP"),
      ],
    });

    const result = deriveSpecificity(surface, allExtensions);
    expect(result.advisorySpecificity).toBe(1);
    expect(result.dimensions).toContain("pointRange");
  });

  it("does not double-count dimensions from multiple facts in the same dimension", () => {
    // hand.hcp + module.ntResponse.gameValues both contribute pointRange
    // Should still only count pointRange once → specificity 1
    const surface = makeSurface({
      clauses: [
        clause("hand.hcp", "10+ HCP"),
        boolClause("module.ntResponse.gameValues", "Game values"),
      ],
    });

    const result = deriveSpecificity(surface, allExtensions);
    expect(result.advisorySpecificity).toBe(1);
    expect(result.dimensions).toContain("pointRange");
  });

  it("counts suitIdentity for specific suit in hand.suitLength.hearts (non-binding)", () => {
    // hand.suitLength.hearts with no $suit binding → suitLength + suitIdentity
    const surface = makeSurface({
      clauses: [
        clause("hand.suitLength.hearts", "5+ hearts", 5),
      ],
    });

    const result = deriveSpecificity(surface, allExtensions);
    expect(result.advisorySpecificity).toBe(2);
    expect(result.dimensions).toContain("suitLength");
    expect(result.dimensions).toContain("suitIdentity");
  });

  it("handles hand.isBalanced as shapeClass", () => {
    const surface = makeSurface({
      clauses: [
        boolClause("hand.isBalanced", "Balanced"),
        clause("hand.hcp", "15-17 HCP"),
      ],
    });

    const result = deriveSpecificity(surface, allExtensions);
    expect(result.advisorySpecificity).toBe(2);
    expect(result.dimensions).toContain("shapeClass");
    expect(result.dimensions).toContain("pointRange");
  });

  // ─── Inherited dimensions tests ───────────────────────────

  it("unions inherited dimensions with own dimensions", () => {
    // A post-Ogust surface with only hand.hcp → pointRange = 1
    // With inherited suitIdentity → pointRange + suitIdentity = 2
    const surface = makeSurface({
      clauses: [
        clause("hand.hcp", "17+ HCP"),
      ],
    });

    const result = deriveSpecificity(surface, allExtensions, ["suitIdentity"]);
    expect(result.advisorySpecificity).toBe(2);
    expect(result.dimensions).toContain("pointRange");
    expect(result.dimensions).toContain("suitIdentity");
  });

  it("inherited dimensions add to empty clause surfaces", () => {
    // A signoff surface with no clauses → 0 dimensions
    // With inherited suitIdentity → suitIdentity = 1
    const surface = makeSurface({
      clauses: [],
    });

    const result = deriveSpecificity(surface, allExtensions, ["suitIdentity"]);
    expect(result.advisorySpecificity).toBe(1);
    expect(result.dimensions).toContain("suitIdentity");
  });

  it("inherited dimensions do not double-count with own dimensions", () => {
    // Surface contributes pointRange from own clauses, inherited also has pointRange
    // Should still be 1 (union, not sum)
    const surface = makeSurface({
      clauses: [
        clause("hand.hcp", "10+ HCP"),
      ],
    });

    const result = deriveSpecificity(surface, allExtensions, ["pointRange"]);
    expect(result.advisorySpecificity).toBe(1);
    expect(result.dimensions).toContain("pointRange");
  });

  it("multiple inherited dimensions are all added", () => {
    // Surface with no clauses inherits suitIdentity + suitLength + pointRange
    const surface = makeSurface({
      clauses: [],
    });

    const result = deriveSpecificity(surface, allExtensions, ["suitIdentity", "suitLength", "pointRange"]);
    expect(result.advisorySpecificity).toBe(3);
    expect(result.dimensions).toContain("suitIdentity");
    expect(result.dimensions).toContain("suitLength");
    expect(result.dimensions).toContain("pointRange");
  });

  it("no inherited dimensions (undefined) leaves result unchanged", () => {
    const surface = makeSurface({
      clauses: [
        clause("hand.hcp", "10+ HCP"),
      ],
    });

    const withoutInherited = deriveSpecificity(surface, allExtensions);
    const withUndefined = deriveSpecificity(surface, allExtensions, undefined);
    expect(withoutInherited.advisorySpecificity).toBe(withUndefined.advisorySpecificity);
  });
});
