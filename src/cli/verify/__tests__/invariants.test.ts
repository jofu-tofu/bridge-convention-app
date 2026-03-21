import { describe, it, expect } from "vitest";
import { BidSuit, Seat } from "../../../engine/types";
import { INITIAL_NEGOTIATION } from "../../../core/contracts/committed-step";
import type { VerificationSnapshot } from "../types";
import type { NegotiationState, CommittedStep } from "../../../core/contracts/committed-step";
import type { BidMeaning } from "../../../core/contracts/meaning";
import type { BidAction } from "../../../core/contracts/bid-action";
import {
  checkArbitrationTotality,
  checkKernelConsistency,
  checkEncodingUniqueness,
  checkPhaseCoherence,
  checkDeterminism,
  ALL_INVARIANTS,
} from "../invariants";

function makeSnapshot(overrides: Partial<VerificationSnapshot> = {}): VerificationSnapshot {
  return {
    seed: 42,
    step: 0,
    auction: [],
    nextSeat: Seat.South,
    localPhases: new Map([["test-mod", "idle"]]),
    kernel: INITIAL_NEGOTIATION,
    claims: [],
    log: [],
    ...overrides,
  };
}

const openerObs: BidAction = { act: "open", strain: "notrump", strength: "strong" };

const openerLog: readonly CommittedStep[] = [
  {
    actor: Seat.North,
    call: { type: "bid" as const, level: 1 as const, strain: BidSuit.NoTrump },
    resolvedClaim: {
      moduleId: "test",
      meaningId: "open",
      semanticClassId: "test:open",
      sourceIntent: { type: "NTOpening", params: {} },
    },
    publicActions: [openerObs],
    negotiationDelta: {},
    stateAfter: INITIAL_NEGOTIATION,
    status: "resolved" as const,
  },
];

function makeSurface(overrides: Partial<BidMeaning> = {}): BidMeaning {
  return {
    meaningId: "test-meaning",
    semanticClassId: "test:meaning",
    moduleId: "test-mod",
    encoding: {
      defaultCall: { type: "bid", level: 2 as const, strain: BidSuit.Clubs },
    },
    clauses: [],
    ranking: { recommendationBand: "preferred" as const, intraModuleOrder: 0 },
    sourceIntent: { type: "TestIntent", params: {} },
    teachingLabel: "Test meaning",
    ...overrides,
  } as BidMeaning;
}

describe("arbitration-totality", () => {
  it("flags when convention player turn has no claims", () => {
    const snapshot = makeSnapshot({
      nextSeat: Seat.South,
      log: openerLog,
      claims: [],
    });
    const result = checkArbitrationTotality(snapshot);
    expect(result).not.toBeNull();
    expect(result!.invariant).toBe("arbitration-totality");
  });

  it("passes when convention player turn has claims with surfaces", () => {
    const snapshot = makeSnapshot({
      nextSeat: Seat.South,
      log: openerLog,
      claims: [
        {
          moduleId: "test-mod",
          surfaces: [makeSurface()],
        },
      ],
    });
    const result = checkArbitrationTotality(snapshot);
    expect(result).toBeNull();
  });

  it("does not flag opponent turn with no claims", () => {
    const snapshot = makeSnapshot({
      nextSeat: Seat.East,
      log: openerLog,
      claims: [],
    });
    const result = checkArbitrationTotality(snapshot);
    expect(result).toBeNull();
  });
});

describe("kernel-consistency", () => {
  it("passes with valid kernel", () => {
    const snapshot = makeSnapshot({ kernel: INITIAL_NEGOTIATION });
    const result = checkKernelConsistency(snapshot);
    expect(result).toBeNull();
  });

  it("flags invalid forcing value", () => {
    const badKernel = {
      ...INITIAL_NEGOTIATION,
      forcing: "invalid" as NegotiationState["forcing"],
    };
    const snapshot = makeSnapshot({ kernel: badKernel });
    const result = checkKernelConsistency(snapshot);
    expect(result).not.toBeNull();
    expect(result!.invariant).toBe("kernel-consistency");
    expect(result!.message).toContain("forcing");
  });

  it("flags invalid captain value", () => {
    const badKernel = {
      ...INITIAL_NEGOTIATION,
      captain: "nobody" as NegotiationState["captain"],
    };
    const snapshot = makeSnapshot({ kernel: badKernel });
    const result = checkKernelConsistency(snapshot);
    expect(result).not.toBeNull();
    expect(result!.invariant).toBe("kernel-consistency");
    expect(result!.message).toContain("captain");
  });

  it("flags invalid competition value", () => {
    const badKernel = {
      ...INITIAL_NEGOTIATION,
      competition: "something-else" as NegotiationState["competition"],
    };
    const snapshot = makeSnapshot({ kernel: badKernel });
    const result = checkKernelConsistency(snapshot);
    expect(result).not.toBeNull();
    expect(result!.invariant).toBe("kernel-consistency");
    expect(result!.message).toContain("competition");
  });

  it("accepts valid overcalled competition", () => {
    const kernel: NegotiationState = {
      ...INITIAL_NEGOTIATION,
      competition: { kind: "overcalled", level: 2, strain: "hearts" },
    };
    const snapshot = makeSnapshot({ kernel });
    const result = checkKernelConsistency(snapshot);
    expect(result).toBeNull();
  });

  it("flags invalid fitAgreed confidence", () => {
    const badKernel = {
      ...INITIAL_NEGOTIATION,
      fitAgreed: { strain: "hearts" as const, confidence: "maybe" as "tentative" | "final" },
    };
    const snapshot = makeSnapshot({ kernel: badKernel });
    const result = checkKernelConsistency(snapshot);
    expect(result).not.toBeNull();
    expect(result!.invariant).toBe("kernel-consistency");
    expect(result!.message).toContain("fitAgreed");
  });
});

describe("encoding-uniqueness", () => {
  it("flags two modules claiming the same call", () => {
    const snapshot = makeSnapshot({
      claims: [
        {
          moduleId: "mod-a",
          surfaces: [
            makeSurface({
              moduleId: "mod-a",
              meaningId: "a1",
              encoding: { defaultCall: { type: "bid", level: 2 as const, strain: BidSuit.Clubs } },
            }),
          ],
        },
        {
          moduleId: "mod-b",
          surfaces: [
            makeSurface({
              moduleId: "mod-b",
              meaningId: "b1",
              encoding: { defaultCall: { type: "bid", level: 2 as const, strain: BidSuit.Clubs } },
            }),
          ],
        },
      ],
    });
    const result = checkEncodingUniqueness(snapshot);
    expect(result).not.toBeNull();
    expect(result!.invariant).toBe("encoding-uniqueness");
    expect(result!.message).toContain("2C");
  });

  it("passes when different calls are used", () => {
    const snapshot = makeSnapshot({
      claims: [
        {
          moduleId: "mod-a",
          surfaces: [
            makeSurface({
              moduleId: "mod-a",
              meaningId: "a1",
              encoding: { defaultCall: { type: "bid", level: 2 as const, strain: BidSuit.Clubs } },
            }),
          ],
        },
        {
          moduleId: "mod-b",
          surfaces: [
            makeSurface({
              moduleId: "mod-b",
              meaningId: "b1",
              encoding: { defaultCall: { type: "bid", level: 2 as const, strain: BidSuit.Diamonds } },
            }),
          ],
        },
      ],
    });
    const result = checkEncodingUniqueness(snapshot);
    expect(result).toBeNull();
  });
});

describe("phase-coherence", () => {
  it("flags module in claims but not in localPhases", () => {
    const snapshot = makeSnapshot({
      localPhases: new Map([["other-mod", "idle"]]),
      claims: [
        {
          moduleId: "missing-mod",
          surfaces: [makeSurface({ moduleId: "missing-mod" })],
        },
      ],
    });
    const result = checkPhaseCoherence(snapshot);
    expect(result).not.toBeNull();
    expect(result!.invariant).toBe("phase-coherence");
    expect(result!.message).toContain("missing-mod");
  });

  it("passes when all claim modules have phase entries", () => {
    const snapshot = makeSnapshot({
      localPhases: new Map([["test-mod", "idle"]]),
      claims: [
        {
          moduleId: "test-mod",
          surfaces: [makeSurface({ moduleId: "test-mod" })],
        },
      ],
    });
    const result = checkPhaseCoherence(snapshot);
    expect(result).toBeNull();
  });
});

describe("determinism", () => {
  it("always returns null (placeholder)", () => {
    const snapshot = makeSnapshot();
    const result = checkDeterminism(snapshot);
    expect(result).toBeNull();
  });
});

describe("ALL_INVARIANTS", () => {
  it("exports all 5 invariants", () => {
    expect(ALL_INVARIANTS).toHaveLength(5);
    const ids = ALL_INVARIANTS.map((inv) => inv.id);
    expect(ids).toContain("arbitration-totality");
    expect(ids).toContain("kernel-consistency");
    expect(ids).toContain("encoding-uniqueness");
    expect(ids).toContain("phase-coherence");
    expect(ids).toContain("determinism");
  });

  it("each invariant has a check function", () => {
    for (const inv of ALL_INVARIANTS) {
      expect(typeof inv.check).toBe("function");
    }
  });
});
