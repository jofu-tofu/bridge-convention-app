import { describe, it, expect } from "vitest";
import {
  formatCallString,
  deriveEntailedDenials,
} from "../commitment-extractor";
import type { Auction, Call } from "../../../../engine/types";
import { Seat } from "../../../../engine/types";
import type { MeaningSurface } from "../../../../core/contracts/meaning-surface";
import type { ChoiceClosurePolicy } from "../../../../core/contracts/agreement-module";

describe("formatCallString", () => {
  it("formats contract bids as level+strain", () => {
    expect(
      formatCallString({ type: "bid", level: 1, strain: "NT" as never }),
    ).toBe("1NT");
    expect(
      formatCallString({ type: "bid", level: 2, strain: "C" as never }),
    ).toBe("2C");
  });

  it("formats pass as P", () => {
    expect(formatCallString({ type: "pass" })).toBe("P");
  });

  it("formats double as X", () => {
    expect(formatCallString({ type: "double" })).toBe("X");
  });

  it("formats redouble as XX", () => {
    expect(formatCallString({ type: "redouble" })).toBe("XX");
  });
});

// ─── deriveEntailedDenials domain kind tests ────────────────────────

function makeSurface(
  overrides: Partial<MeaningSurface> & { meaningId: string },
): MeaningSurface {
  return {
    moduleId: "test-module",
    encoding: {
      defaultCall: { type: "bid", level: 2, strain: "C" } as Call,
    },
    clauses: [],
    ranking: {
      recommendationBand: "should",
      specificity: 1,
      modulePrecedence: 1,
      intraModuleOrder: 1,
    },
    sourceIntent: { type: "test", params: {} },
    ...overrides,
  };
}

const surfaceA = makeSurface({
  meaningId: "meaning-a",
  semanticClassId: "class-a",
  familyId: "family-x",
  moduleId: "mod-alpha",
  encoding: { defaultCall: { type: "bid", level: 2, strain: "C" } as Call },
  publicConsequences: {
    promises: [
      { factId: "hand.hcp", operator: "gte", value: 10 },
    ],
  },
});

const surfaceB = makeSurface({
  meaningId: "meaning-b",
  semanticClassId: "class-b",
  familyId: "family-x",
  moduleId: "mod-alpha",
  encoding: { defaultCall: { type: "bid", level: 2, strain: "D" } as Call },
  publicConsequences: {
    promises: [
      { factId: "hand.suitLength.hearts", operator: "gte", value: 5 },
    ],
  },
});

const surfaceC = makeSurface({
  meaningId: "meaning-c",
  semanticClassId: "class-c",
  familyId: "family-y",
  moduleId: "mod-beta",
  encoding: { defaultCall: { type: "bid", level: 2, strain: "H" } as Call },
  publicConsequences: {
    promises: [
      { factId: "hand.suitLength.spades", operator: "gte", value: 4 },
    ],
  },
});

const surfaceNoConsequences = makeSurface({
  meaningId: "meaning-d",
  semanticClassId: "class-d",
  familyId: "family-x",
  moduleId: "mod-alpha",
  encoding: { defaultCall: { type: "bid", level: 2, strain: "S" } as Call },
});

const allTestSurfaces = [surfaceA, surfaceB, surfaceC, surfaceNoConsequences];

const testEntry = { seat: Seat.South, call: { type: "bid", level: 2, strain: "C" } as Call };
const emptyAuction: Auction = { entries: [], isComplete: false };
const testRouter = (_a: Auction, _s: Seat): readonly MeaningSurface[] => allTestSurfaces;

describe("deriveEntailedDenials — domain kind: surface", () => {
  const policy: ChoiceClosurePolicy = {
    exclusive: true,
    exhaustive: true,
    mandatory: true,
    domain: { kind: "surface" },
  };

  it("derives denials for all unchosen surfaces' promises on the same router output", () => {
    const denials = deriveEntailedDenials(surfaceA, policy, testEntry, testRouter, emptyAuction);

    // surfaceB and surfaceC have promises, surfaceNoConsequences does not
    expect(denials).toHaveLength(2);

    const heartsDenial = denials.find(
      (d) => d.constraint.factId === "hand.suitLength.hearts",
    );
    expect(heartsDenial).toBeDefined();
    expect(heartsDenial!.origin).toBe("entailed-denial");
    expect(heartsDenial!.strength).toBe("entailed");
    expect(heartsDenial!.sourceMeaning).toBe("meaning-a");

    const spadesDenial = denials.find(
      (d) => d.constraint.factId === "hand.suitLength.spades",
    );
    expect(spadesDenial).toBeDefined();
    expect(spadesDenial!.origin).toBe("entailed-denial");
  });

  it("skips surfaces without publicConsequences", () => {
    const denials = deriveEntailedDenials(surfaceA, policy, testEntry, testRouter, emptyAuction);
    // surfaceNoConsequences has no publicConsequences → no denial from it
    const meaningDDenial = denials.find(
      (d) => d.sourceMeaning === "meaning-d",
    );
    expect(meaningDDenial).toBeUndefined();
  });

  it("returns empty when closure is not exclusive+exhaustive+mandatory", () => {
    const partial: ChoiceClosurePolicy = {
      exclusive: true,
      exhaustive: false,
      mandatory: true,
      domain: { kind: "surface" },
    };
    const denials = deriveEntailedDenials(surfaceA, partial, testEntry, testRouter, emptyAuction);
    expect(denials).toHaveLength(0);
  });
});

describe("deriveEntailedDenials — domain kind: meaning-family", () => {
  const policy: ChoiceClosurePolicy = {
    exclusive: true,
    exhaustive: true,
    mandatory: true,
    domain: { kind: "meaning-family", ids: ["family-x"] },
  };

  it("derives denials only for unchosen surfaces within the named family", () => {
    const denials = deriveEntailedDenials(surfaceA, policy, testEntry, testRouter, emptyAuction);

    // surfaceB is in family-x → denial for hearts >= 5
    // surfaceC is in family-y → excluded
    // surfaceNoConsequences is in family-x but has no promises → skipped
    expect(denials).toHaveLength(1);
    expect(denials[0]!.constraint.factId).toBe("hand.suitLength.hearts");
    expect(denials[0]!.origin).toBe("entailed-denial");
    expect(denials[0]!.strength).toBe("entailed");
  });

  it("excludes surfaces outside the named families", () => {
    const denials = deriveEntailedDenials(surfaceA, policy, testEntry, testRouter, emptyAuction);
    const spadesDenial = denials.find(
      (d) => d.constraint.factId === "hand.suitLength.spades",
    );
    expect(spadesDenial).toBeUndefined();
  });
});

describe("deriveEntailedDenials — domain kind: semantic-class-set", () => {
  const policy: ChoiceClosurePolicy = {
    exclusive: true,
    exhaustive: true,
    mandatory: true,
    domain: { kind: "semantic-class-set", ids: ["class-a", "class-b"] },
  };

  it("derives denials only for unchosen surfaces within the named semantic classes", () => {
    const denials = deriveEntailedDenials(surfaceA, policy, testEntry, testRouter, emptyAuction);

    // surfaceB has semanticClassId "class-b" (in the set) → denial
    // surfaceC has semanticClassId "class-c" (not in set) → excluded
    expect(denials).toHaveLength(1);
    expect(denials[0]!.constraint.factId).toBe("hand.suitLength.hearts");
    expect(denials[0]!.origin).toBe("entailed-denial");
  });
});

describe("deriveEntailedDenials — domain kind: module-frontier", () => {
  const policy: ChoiceClosurePolicy = {
    exclusive: true,
    exhaustive: true,
    mandatory: true,
    domain: { kind: "module-frontier", id: "mod-alpha" },
  };

  it("derives denials only for unchosen surfaces within the named module", () => {
    const denials = deriveEntailedDenials(surfaceA, policy, testEntry, testRouter, emptyAuction);

    // surfaceB is in mod-alpha → denial for hearts >= 5
    // surfaceC is in mod-beta → excluded
    // surfaceNoConsequences is in mod-alpha but has no promises → skipped
    expect(denials).toHaveLength(1);
    expect(denials[0]!.constraint.factId).toBe("hand.suitLength.hearts");
    expect(denials[0]!.origin).toBe("entailed-denial");
    expect(denials[0]!.strength).toBe("entailed");
  });

  it("excludes surfaces from other modules", () => {
    const denials = deriveEntailedDenials(surfaceA, policy, testEntry, testRouter, emptyAuction);
    const spadesDenial = denials.find(
      (d) => d.constraint.factId === "hand.suitLength.spades",
    );
    expect(spadesDenial).toBeUndefined();
  });
});
