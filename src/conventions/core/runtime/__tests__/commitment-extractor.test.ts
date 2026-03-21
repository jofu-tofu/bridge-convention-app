import { describe, it, expect } from "vitest";
import {
  formatCallString,
  deriveEntailedDenials,
  extractCommitments,
} from "../commitment-extractor";
import type { Auction, Call } from "../../../../engine/types";
import { Seat } from "../../../../engine/types";
import type { BidMeaning } from "../../../../core/contracts/meaning";
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
  overrides: Partial<BidMeaning> & { meaningId: string },
): BidMeaning {
  return {
    semanticClassId: "test:class",
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
    teachingLabel: "Test meaning",
    ...overrides,
  } as BidMeaning;
}

const surfaceA = makeSurface({
  meaningId: "meaning-a",
  semanticClassId: "class-a",
  moduleId: "mod-alpha",
  encoding: { defaultCall: { type: "bid", level: 2, strain: "C" } as Call },
  clauses: [
    { clauseId: "hcp-10", factId: "hand.hcp", operator: "gte", value: 10, description: "10+ HCP" },
  ],
});

const surfaceB = makeSurface({
  meaningId: "meaning-b",
  semanticClassId: "class-b",
  moduleId: "mod-alpha",
  encoding: { defaultCall: { type: "bid", level: 2, strain: "D" } as Call },
  clauses: [
    { clauseId: "hearts-5", factId: "hand.suitLength.hearts", operator: "gte", value: 5, description: "5+ hearts" },
  ],
});

const surfaceC = makeSurface({
  meaningId: "meaning-c",
  semanticClassId: "class-c",
  moduleId: "mod-beta",
  encoding: { defaultCall: { type: "bid", level: 2, strain: "H" } as Call },
  clauses: [
    { clauseId: "spades-4", factId: "hand.suitLength.spades", operator: "gte", value: 4, description: "4+ spades" },
  ],
});

const surfaceNoConsequences = makeSurface({
  meaningId: "meaning-d",
  semanticClassId: "class-d",
  moduleId: "mod-alpha",
  encoding: { defaultCall: { type: "bid", level: 2, strain: "S" } as Call },
});

const allTestSurfaces = [surfaceA, surfaceB, surfaceC, surfaceNoConsequences];

const testEntry = { seat: Seat.South, call: { type: "bid", level: 2, strain: "C" } as Call };
const emptyAuction: Auction = { entries: [], isComplete: false };
const testRouter = (_a: Auction, _s: Seat): readonly BidMeaning[] => allTestSurfaces;

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

  it("skips surfaces without primitive hand fact clauses", () => {
    const denials = deriveEntailedDenials(surfaceA, policy, testEntry, testRouter, emptyAuction);
    // surfaceNoConsequences has no clauses → no denial from it
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

// ─── extractCommitments ─────────────────────────────────────────

describe("extractCommitments", () => {
  it("returns empty for empty auction", () => {
    const result = extractCommitments(emptyAuction, Seat.South, testRouter);
    expect(result).toEqual([]);
  });

  it("extracts promise constraints from matching surface", () => {
    // surfaceA matches 2C — it has primitive hand fact clauses
    const auction: Auction = {
      entries: [
        { seat: Seat.South, call: { type: "bid", level: 2, strain: "C" } as Call },
      ],
      isComplete: false,
    };

    const result = extractCommitments(auction, Seat.South, testRouter);

    const promises = result.filter(c => c.origin === "call-meaning");
    expect(promises.length).toBeGreaterThanOrEqual(1);
    expect(promises[0]!.constraint.factId).toBe("hand.hcp");
    expect(promises[0]!.strength).toBe("hard");
    expect(promises[0]!.subject).toBe(Seat.South);
    expect(promises[0]!.sourceCall).toBe("2C");
    expect(promises[0]!.sourceMeaning).toBe("meaning-a");
  });

  it("no commitments when auction entry does not match any surface", () => {
    // 1NT doesn't match any of allTestSurfaces (which have 2C, 2D, 2H, 2S)
    const auction: Auction = {
      entries: [
        { seat: Seat.South, call: { type: "bid", level: 1, strain: "NT" } as Call },
      ],
      isComplete: false,
    };

    const result = extractCommitments(auction, Seat.South, testRouter);
    expect(result).toEqual([]);
  });

  it("no commitments from surface without primitive clauses", () => {
    // surfaceNoConsequences matches 2S but has no primitive hand fact clauses
    const routerOnlyNoConsequences = (_a: Auction, _s: Seat) => [surfaceNoConsequences];
    const auction: Auction = {
      entries: [
        { seat: Seat.South, call: { type: "bid", level: 2, strain: "S" } as Call },
      ],
      isComplete: false,
    };

    const result = extractCommitments(auction, Seat.South, routerOnlyNoConsequences);
    expect(result).toEqual([]);
  });

  it("surfaceRouter receives sub-auction (entries 0..i-1) for entry i", () => {
    const routerCalls: Auction[] = [];
    const captureRouter = (a: Auction, _s: Seat): readonly BidMeaning[] => {
      routerCalls.push(a);
      return allTestSurfaces;
    };

    const auction: Auction = {
      entries: [
        { seat: Seat.South, call: { type: "bid", level: 2, strain: "C" } as Call },
        { seat: Seat.West, call: { type: "pass" } },
      ],
      isComplete: false,
    };

    extractCommitments(auction, Seat.South, captureRouter);

    // First call: sub-auction has 0 entries (before entry 0)
    expect(routerCalls[0]!.entries).toHaveLength(0);
    // Second call: sub-auction has 1 entry (before entry 1)
    expect(routerCalls[1]!.entries).toHaveLength(1);
  });

  it("accumulates commitments across multiple matching entries", () => {
    // 2C matches surfaceA, 2D matches surfaceB
    const auction: Auction = {
      entries: [
        { seat: Seat.South, call: { type: "bid", level: 2, strain: "C" } as Call },
        { seat: Seat.North, call: { type: "bid", level: 2, strain: "D" } as Call },
      ],
      isComplete: false,
    };

    const result = extractCommitments(auction, Seat.South, testRouter);

    const promises = result.filter(c => c.origin === "call-meaning");
    expect(promises.length).toBeGreaterThanOrEqual(2);
    // One from surfaceA (hand.hcp) and one from surfaceB (hand.suitLength.hearts)
    const hcpPromise = promises.find(c => c.constraint.factId === "hand.hcp");
    const heartPromise = promises.find(c => c.constraint.factId === "hand.suitLength.hearts");
    expect(hcpPromise).toBeDefined();
    expect(heartPromise).toBeDefined();
  });

  it("extracts entailed denials when surface has closurePolicy", () => {
    const surfaceWithClosure = makeSurface({
      meaningId: "closure-surface",
      encoding: { defaultCall: { type: "bid", level: 2, strain: "C" } as Call },
      clauses: [
        { clauseId: "hcp-8", factId: "hand.hcp", operator: "gte", value: 8, description: "8+ HCP" },
      ],
      closurePolicy: {
        exclusive: true,
        exhaustive: true,
        mandatory: true,
        domain: { kind: "surface" },
      },
    });

    const peerSurface = makeSurface({
      meaningId: "peer-surface",
      encoding: { defaultCall: { type: "bid", level: 2, strain: "D" } as Call },
      clauses: [
        { clauseId: "diamonds-5", factId: "hand.suitLength.diamonds", operator: "gte", value: 5, description: "5+ diamonds" },
      ],
    });

    const closureRouter = (_a: Auction, _s: Seat) => [surfaceWithClosure, peerSurface];
    const auction: Auction = {
      entries: [
        { seat: Seat.South, call: { type: "bid", level: 2, strain: "C" } as Call },
      ],
      isComplete: false,
    };

    const result = extractCommitments(auction, Seat.South, closureRouter);

    const entailed = result.filter(c => c.origin === "entailed-denial");
    expect(entailed.length).toBeGreaterThanOrEqual(1);
    expect(entailed[0]!.constraint.factId).toBe("hand.suitLength.diamonds");
    expect(entailed[0]!.strength).toBe("entailed");
  });
});
