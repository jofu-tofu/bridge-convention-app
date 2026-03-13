import { describe, it, expect } from "vitest";
import {
  extractCommitments,
  formatCallString,
  deriveEntailedDenials,
} from "../commitment-extractor";
import { buildAuction } from "../../../../engine/auction-helpers";
import type { Auction, Call } from "../../../../engine/types";
import { Seat } from "../../../../engine/types";
import type { MeaningSurface } from "../../../../core/contracts/meaning-surface";
import type { ChoiceClosurePolicy } from "../../../../core/contracts/agreement-module";
import {
  createNtSurfaceRouter,
  NT_ROUTED_SURFACES,
} from "../../../definitions/nt-bundle/surface-routing";
import { createNtConversationMachine } from "../../../definitions/nt-bundle/machine";

const surfaceRouter = createNtSurfaceRouter(NT_ROUTED_SURFACES, createNtConversationMachine());

describe("extractCommitments", () => {
  it("extracts commitments from Stayman 2C (1NT-P-2C)", () => {
    const auction = buildAuction(Seat.North, ["1NT", "P", "2C"]);
    const commitments = extractCommitments(auction, Seat.South, surfaceRouter);

    // 2C = Stayman ask: promises HCP >= 8 and hasFourCardMajor
    const responderCommitments = commitments.filter(
      (c) => c.subject === (Seat.South as string),
    );
    expect(responderCommitments).toHaveLength(2);

    const hcpCommitment = responderCommitments.find(
      (c) => c.constraint.factId === "hand.hcp",
    );
    expect(hcpCommitment).toBeDefined();
    expect(hcpCommitment!.constraint.operator).toBe("gte");
    expect(hcpCommitment!.constraint.value).toBe(8);
    expect(hcpCommitment!.origin).toBe("call-meaning");
    expect(hcpCommitment!.strength).toBe("hard");
    expect(hcpCommitment!.sourceCall).toBe("2C");
    expect(hcpCommitment!.sourceMeaning).toBe("stayman:ask-major");

    const majorCommitment = responderCommitments.find(
      (c) => c.constraint.factId === "bridge.hasFourCardMajor",
    );
    expect(majorCommitment).toBeDefined();
    expect(majorCommitment!.constraint.operator).toBe("boolean");
    expect(majorCommitment!.constraint.value).toBe(true);
  });

  it("extracts commitments from transfer 2D (1NT-P-2D)", () => {
    const auction = buildAuction(Seat.North, ["1NT", "P", "2D"]);
    const commitments = extractCommitments(auction, Seat.South, surfaceRouter);

    const responderCommitments = commitments.filter(
      (c) => c.subject === (Seat.South as string),
    );
    expect(responderCommitments).toHaveLength(1);
    expect(responderCommitments[0]!.constraint.factId).toBe(
      "hand.suitLength.hearts",
    );
    expect(responderCommitments[0]!.constraint.operator).toBe("gte");
    expect(responderCommitments[0]!.constraint.value).toBe(5);
    expect(responderCommitments[0]!.sourceCall).toBe("2D");
    expect(responderCommitments[0]!.sourceMeaning).toBe("transfer:to-hearts");
  });

  it("produces no commitments from passes", () => {
    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const commitments = extractCommitments(auction, Seat.South, surfaceRouter);

    // 1NT has no surface match (it's the opening, not a convention response),
    // Pass produces no commitments
    const passCommitments = commitments.filter(
      (c) => c.sourceCall === "P",
    );
    expect(passCommitments).toHaveLength(0);
  });

  it("extracts commitments for both 2C and 2H in 1NT-P-2C-P-2H", () => {
    const auction = buildAuction(Seat.North, [
      "1NT",
      "P",
      "2C",
      "P",
      "2H",
    ]);
    const commitments = extractCommitments(auction, Seat.South, surfaceRouter);

    // 2C: responder (South) promises HCP >= 8 + hasFourCardMajor
    const responderCommitments = commitments.filter(
      (c) => c.subject === (Seat.South as string),
    );
    expect(responderCommitments.length).toBeGreaterThanOrEqual(2);

    // 2H: opener (North) shows hearts (4+ hearts) + entailed denial (spades >= 4)
    const openerCommitments = commitments.filter(
      (c) => c.subject === (Seat.North as string),
    );
    expect(openerCommitments).toHaveLength(2);

    const heartsPromise = openerCommitments.find(
      (c) => c.origin === "call-meaning",
    );
    expect(heartsPromise).toBeDefined();
    expect(heartsPromise!.constraint.factId).toBe("hand.suitLength.hearts");
    expect(heartsPromise!.constraint.operator).toBe("gte");
    expect(heartsPromise!.constraint.value).toBe(4);
    expect(heartsPromise!.sourceCall).toBe("2H");
    expect(heartsPromise!.sourceMeaning).toBe("stayman:show-hearts");

    const spadesDenial = openerCommitments.find(
      (c) => c.origin === "entailed-denial",
    );
    expect(spadesDenial).toBeDefined();
    expect(spadesDenial!.constraint.factId).toBe("hand.suitLength.spades");
    expect(spadesDenial!.strength).toBe("entailed");
  });

  it("extracts deny-major commitment as explicit-denial", () => {
    const auction = buildAuction(Seat.North, [
      "1NT",
      "P",
      "2C",
      "P",
      "2D",
    ]);
    const commitments = extractCommitments(auction, Seat.South, surfaceRouter);

    // 2D = deny-major: denies hasFourCardMajor
    const openerDenials = commitments.filter(
      (c) => c.subject === (Seat.North as string) && c.origin === "explicit-denial",
    );
    expect(openerDenials).toHaveLength(1);
    expect(openerDenials[0]!.constraint.factId).toBe(
      "bridge.hasFourCardMajor",
    );
    expect(openerDenials[0]!.sourceMeaning).toBe("stayman:deny-major");
  });
});

describe("extractCommitments — entailed denials via closurePolicy", () => {
  it("1NT-P-2C-P-2D produces entailed denials for hearts >= 4 and spades >= 4", () => {
    const auction = buildAuction(Seat.North, [
      "1NT",
      "P",
      "2C",
      "P",
      "2D",
    ]);
    const commitments = extractCommitments(auction, Seat.South, surfaceRouter);

    // 2D = deny-major: unchosen show-hearts and show-spades surfaces' promises
    // become entailed denials
    const entailedDenials = commitments.filter(
      (c) => c.origin === "entailed-denial",
    );
    expect(entailedDenials.length).toBe(2);

    const heartsDenial = entailedDenials.find(
      (c) => c.constraint.factId === "hand.suitLength.hearts",
    );
    expect(heartsDenial).toBeDefined();
    expect(heartsDenial!.constraint.operator).toBe("gte");
    expect(heartsDenial!.constraint.value).toBe(4);
    expect(heartsDenial!.strength).toBe("entailed");
    expect(heartsDenial!.subject).toBe(Seat.North as string);
    expect(heartsDenial!.sourceCall).toBe("2D");
    expect(heartsDenial!.sourceMeaning).toBe("stayman:deny-major");

    const spadesDenial = entailedDenials.find(
      (c) => c.constraint.factId === "hand.suitLength.spades",
    );
    expect(spadesDenial).toBeDefined();
    expect(spadesDenial!.constraint.operator).toBe("gte");
    expect(spadesDenial!.constraint.value).toBe(4);
    expect(spadesDenial!.strength).toBe("entailed");
  });

  it("1NT-P-2C-P-2H produces entailed denial for spades >= 4 only", () => {
    const auction = buildAuction(Seat.North, [
      "1NT",
      "P",
      "2C",
      "P",
      "2H",
    ]);
    const commitments = extractCommitments(auction, Seat.South, surfaceRouter);

    const entailedDenials = commitments.filter(
      (c) => c.origin === "entailed-denial",
    );

    // Unchosen show-spades promises spades >= 4 → entailed denial
    // Unchosen deny-major has no promises (empty array) → no entailed denial from it
    expect(entailedDenials.length).toBe(1);

    const spadesDenial = entailedDenials[0]!;
    expect(spadesDenial.constraint.factId).toBe("hand.suitLength.spades");
    expect(spadesDenial.constraint.operator).toBe("gte");
    expect(spadesDenial.constraint.value).toBe(4);
    expect(spadesDenial.strength).toBe("entailed");
    expect(spadesDenial.subject).toBe(Seat.North as string);
    expect(spadesDenial.sourceCall).toBe("2H");
    expect(spadesDenial.sourceMeaning).toBe("stayman:show-hearts");
  });

  it("surfaces without closurePolicy produce no entailed denials", () => {
    // 1NT-P-2D: transfer to hearts, no closurePolicy on responder surfaces
    const auction = buildAuction(Seat.North, ["1NT", "P", "2D"]);
    const commitments = extractCommitments(auction, Seat.South, surfaceRouter);

    const entailedDenials = commitments.filter(
      (c) => c.origin === "entailed-denial",
    );
    expect(entailedDenials).toHaveLength(0);
  });
});

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
