import { describe, it, expect } from "vitest";
import { buildCommittedStep } from "../committed-step-builder";
import { INITIAL_KERNEL } from "../../../../core/contracts/committed-step";
import type { MachineRegisters } from "../../../../core/contracts/module-surface";
import type { ArbitrationResult, EncodedProposal } from "../../../../core/contracts/module-surface";
import type { MeaningProposal } from "../../../../core/contracts/meaning";
import { ForcingState } from "../../../../core/contracts/bidding";
import { Seat, BidSuit } from "../../../../engine/types";
import type { Call, ContractBid, SpecialCall } from "../../../../engine/types";

function bid(level: ContractBid["level"], strain: BidSuit): ContractBid {
  return { type: "bid", level, strain };
}

const pass: SpecialCall = { type: "pass" };

function makeRegisters(
  overrides: Partial<MachineRegisters> = {},
): MachineRegisters {
  return {
    forcingState: ForcingState.Nonforcing,
    obligation: { kind: "none", obligatedSide: "opener" },
    agreedStrain: { type: "none" },
    competitionMode: "Uncontested",
    captain: "undecided",
    systemCapabilities: {},
    ...overrides,
  };
}

function makeProposal(
  overrides: Partial<MeaningProposal> = {},
): MeaningProposal {
  return {
    meaningId: "stayman-ask",
    semanticClassId: "stayman:ask-major",
    moduleId: "stayman",
    clauses: [],
    ranking: {
      recommendationBand: "preferred",
      specificity: 3,
      modulePrecedence: 0,
      intraModuleOrder: 0,
    },
    evidence: { satisfied: [], unsatisfied: [] },
    sourceIntent: { type: "StaymanAsk", params: {} },
    ...overrides,
  } as MeaningProposal;
}

function makeEncodedProposal(
  proposal: MeaningProposal,
  call: Call = bid(2, BidSuit.Clubs),
): EncodedProposal {
  return {
    proposal,
    call,
    isDefaultEncoding: true,
    legal: true,
    allEncodings: [{ call, legal: true }],
    eligibility: {
      hand: { satisfied: true, failedConditions: [] },
      encoding: { legal: true },
      pedagogical: { acceptable: true, reasons: [] },
    },
  };
}

function makeArbitrationResult(
  selected: EncodedProposal | null,
  truthSet: EncodedProposal[] = [],
): ArbitrationResult {
  return {
    selected,
    truthSet,
    acceptableSet: [],
    recommended: [],
    eliminations: [],
  };
}

describe("buildCommittedStep", () => {
  it("builds a resolved step from a winning arbitration", () => {
    const proposal = makeProposal();
    const encoded = makeEncodedProposal(proposal);
    const arb = makeArbitrationResult(encoded, [encoded]);
    const call = bid(2, BidSuit.Clubs);

    const step = buildCommittedStep(
      Seat.South,
      call,
      arb,
      INITIAL_KERNEL,
      makeRegisters(),
    );

    expect(step.actor).toBe(Seat.South);
    expect(step.call).toBe(call);
    expect(step.status).toBe("resolved");
    expect(step.resolvedClaim).toEqual({
      moduleId: "stayman",
      meaningId: "stayman-ask",
      semanticClassId: "stayman:ask-major",
      sourceIntent: { type: "StaymanAsk", params: {} },
    });
    expect(step.publicObs).toEqual([
      { act: "inquire", feature: "majorSuit" },
    ]);
    expect(step.postKernel).toEqual(INITIAL_KERNEL);
    expect(step.kernelDelta).toEqual({});
  });

  it("builds an off-system step when arbitration is null", () => {
    const call = bid(1, BidSuit.Hearts);

    const step = buildCommittedStep(
      Seat.West,
      call,
      null,
      INITIAL_KERNEL,
      makeRegisters(),
    );

    expect(step.status).toBe("off-system");
    expect(step.resolvedClaim).toBeNull();
    expect(step.publicObs).toEqual([]);
  });

  it("builds an ambiguous step when truthSet exists but no selected", () => {
    const proposal = makeProposal();
    const encoded = makeEncodedProposal(proposal);
    const arb = makeArbitrationResult(null, [encoded]);

    const step = buildCommittedStep(
      Seat.South,
      bid(2, BidSuit.Clubs),
      arb,
      INITIAL_KERNEL,
      makeRegisters(),
    );

    expect(step.status).toBe("ambiguous");
  });

  it("computes kernel delta from register changes", () => {
    const proposal = makeProposal();
    const encoded = makeEncodedProposal(proposal);
    const arb = makeArbitrationResult(encoded, [encoded]);

    const step = buildCommittedStep(
      Seat.South,
      bid(2, BidSuit.Clubs),
      arb,
      INITIAL_KERNEL,
      makeRegisters({ forcingState: ForcingState.ForcingOneRound }),
    );

    expect(step.kernelDelta).toEqual({ forcing: "one-round" });
    expect(step.postKernel.forcing).toBe("one-round");
  });

  it("builds off-system step for pass with empty arbitration", () => {
    const arb = makeArbitrationResult(null, []);

    const step = buildCommittedStep(
      Seat.East,
      pass,
      arb,
      INITIAL_KERNEL,
      makeRegisters(),
    );

    expect(step.status).toBe("off-system");
  });
});
