import { describe, it, expect } from "vitest";
import { buildCommittedStep } from "../observation/committed-step-builder";
import { INITIAL_NEGOTIATION } from "../../core/committed-step";
import type { MachineRegisters } from "../../core/module-surface";
import type { PipelineResult, PipelineCarrier } from "../pipeline-types";
import type { MeaningProposal } from "../evaluation/meaning";
import { ForcingState } from "../../core/strategy-types";
import { Seat, BidSuit } from "../../../engine/types";
import type { Call, ContractBid, SpecialCall } from "../../../engine/types";

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
      declarationOrder: 0,
    },
    evidence: { satisfied: [], unsatisfied: [] },
    sourceIntent: { type: "StaymanAsk", params: {} },
    ...overrides,
  } as MeaningProposal;
}

function makeCarrier(
  proposal: MeaningProposal,
  call: Call = bid(2, BidSuit.Clubs),
): PipelineCarrier {
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
    traces: {
      encoding: { encoderId: proposal.meaningId, encoderKind: "default-call", consideredCalls: [call], chosenCall: call, blockedCalls: [] },
      legality: { call, legal: true },
    },
  };
}

function makePipelineResult(
  selected: PipelineCarrier | null,
  truthSet: PipelineCarrier[] = [],
): PipelineResult {
  return {
    selected,
    truthSet,
    acceptableSet: [],
    recommended: [],
    eliminated: [],
    applicability: { factDependencies: [], evaluatedConditions: [] },
    activation: [],
    arbitration: [],
    handoffs: [],
  };
}

describe("buildCommittedStep", () => {
  it("builds a resolved step from a winning pipeline result", () => {
    const proposal = makeProposal();
    const carrier = makeCarrier(proposal);
    const result = makePipelineResult(carrier, [carrier]);
    const call = bid(2, BidSuit.Clubs);

    const step = buildCommittedStep(
      Seat.South,
      call,
      result,
      INITIAL_NEGOTIATION,
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
    expect(step.publicActions).toEqual([
      { act: "inquire", feature: "majorSuit" },
    ]);
    expect(step.stateAfter).toEqual(INITIAL_NEGOTIATION);
    expect(step.negotiationDelta).toEqual({});
  });

  it("builds an off-system step when pipeline result is null", () => {
    const call = bid(1, BidSuit.Hearts);

    const step = buildCommittedStep(
      Seat.West,
      call,
      null,
      INITIAL_NEGOTIATION,
      makeRegisters(),
    );

    expect(step.status).toBe("off-system");
    expect(step.resolvedClaim).toBeNull();
    expect(step.publicActions).toEqual([]);
  });

  it("builds an ambiguous step when truthSet exists but no selected", () => {
    const proposal = makeProposal();
    const carrier = makeCarrier(proposal);
    const result = makePipelineResult(null, [carrier]);

    const step = buildCommittedStep(
      Seat.South,
      bid(2, BidSuit.Clubs),
      result,
      INITIAL_NEGOTIATION,
      makeRegisters(),
    );

    expect(step.status).toBe("ambiguous");
  });

  it("computes kernel delta from register changes", () => {
    const proposal = makeProposal();
    const carrier = makeCarrier(proposal);
    const result = makePipelineResult(carrier, [carrier]);

    const step = buildCommittedStep(
      Seat.South,
      bid(2, BidSuit.Clubs),
      result,
      INITIAL_NEGOTIATION,
      makeRegisters({ forcingState: ForcingState.ForcingOneRound }),
    );

    expect(step.negotiationDelta).toEqual({ forcing: "one-round" });
    expect(step.stateAfter.forcing).toBe("one-round");
  });

  it("builds off-system step for pass with empty pipeline result", () => {
    const result = makePipelineResult(null, []);

    const step = buildCommittedStep(
      Seat.East,
      pass,
      result,
      INITIAL_NEGOTIATION,
      makeRegisters(),
    );

    expect(step.status).toBe("off-system");
  });
});
