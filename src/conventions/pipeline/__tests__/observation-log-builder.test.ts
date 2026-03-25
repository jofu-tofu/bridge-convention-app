import { describe, it, expect } from "vitest";
import { buildObservationLog } from "../observation/observation-log-builder";
import type { ObservationLogStep } from "../observation/observation-log-builder";
import { INITIAL_NEGOTIATION } from "../../core/committed-step";
import type { PipelineResult, PipelineCarrier } from "../pipeline-types";
import type { MachineRegisters } from "../../core/module-surface";
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

function makeProposal(overrides: Partial<MeaningProposal> = {}): MeaningProposal {
  return {
    meaningId: "test-meaning",
    semanticClassId: "test:class",
    moduleId: "test-module",
    clauses: [],
    ranking: {
      recommendationBand: "preferred",
      specificity: 3,
      modulePrecedence: 0,
      declarationOrder: 0,
    },
    evidence: { satisfied: [], unsatisfied: [] },
    sourceIntent: { type: "NTOpening", params: {} },
    ...overrides,
  } as MeaningProposal;
}

function makeResult(
  proposal: MeaningProposal,
  call: Call,
): PipelineResult {
  const carrier: PipelineCarrier = {
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

  return {
    selected: carrier,
    truthSet: [carrier],
    acceptableSet: [],
    recommended: [],
    eliminated: [],
    applicability: { factDependencies: [], evaluatedConditions: [] },
    activation: [],
    arbitration: [],
    handoffs: [],
  };
}

describe("buildObservationLog", () => {
  it("returns empty log for empty auction", () => {
    const log = buildObservationLog([]);
    expect(log).toEqual([]);
  });

  it("builds one step for 1NT opening", () => {
    const call = bid(1, BidSuit.NoTrump);
    const proposal = makeProposal({
      sourceIntent: { type: "NTOpening", params: {} },
      moduleId: "natural-nt",
      meaningId: "nt-opening",
      semanticClassId: "bridge:nt-open",
    });

    const steps: ObservationLogStep[] = [
      {
        actor: Seat.North,
        call,
        registers: makeRegisters(),
        pipelineResult: makeResult(proposal, call),
      },
    ];

    const log = buildObservationLog(steps);
    expect(log).toHaveLength(1);
    expect(log[0]!.actor).toBe(Seat.North);
    expect(log[0]!.status).toBe("resolved");
    expect(log[0]!.publicActions).toEqual([
      { act: "open", strain: "notrump" },
    ]);
    expect(log[0]!.stateAfter).toEqual(INITIAL_NEGOTIATION);
    expect(log[0]!.negotiationDelta).toEqual({});
  });

  it("builds three steps for 1NT-P-2C (Stayman) with kernel tracking", () => {
    const ntCall = bid(1, BidSuit.NoTrump);
    const staymanCall = bid(2, BidSuit.Clubs);

    const ntProposal = makeProposal({
      sourceIntent: { type: "NTOpening", params: {} },
      moduleId: "natural-nt",
      meaningId: "nt-opening",
      semanticClassId: "bridge:nt-open",
    });

    const staymanProposal = makeProposal({
      sourceIntent: { type: "StaymanAsk", params: {} },
      moduleId: "stayman",
      meaningId: "stayman-ask",
      semanticClassId: "stayman:ask-major",
    });

    const steps: ObservationLogStep[] = [
      {
        actor: Seat.North,
        call: ntCall,
        registers: makeRegisters(),
        pipelineResult: makeResult(ntProposal, ntCall),
      },
      {
        actor: Seat.East,
        call: pass,
        registers: makeRegisters(),
        pipelineResult: null,
      },
      {
        actor: Seat.South,
        call: staymanCall,
        registers: makeRegisters({
          forcingState: ForcingState.ForcingOneRound,
        }),
        pipelineResult: makeResult(staymanProposal, staymanCall),
      },
    ];

    const log = buildObservationLog(steps);
    expect(log).toHaveLength(3);

    // Step 0: 1NT opening
    expect(log[0]!.status).toBe("resolved");
    expect(log[0]!.publicActions[0]).toEqual({ act: "open", strain: "notrump" });

    // Step 1: opponent pass — off-system (null pipelineResult)
    expect(log[1]!.status).toBe("off-system");
    expect(log[1]!.publicActions).toEqual([]);
    expect(log[1]!.resolvedClaim).toBeNull();

    // Step 2: Stayman 2C
    expect(log[2]!.status).toBe("resolved");
    expect(log[2]!.publicActions[0]).toEqual({ act: "inquire", feature: "majorSuit" });
    // Kernel delta: forcing changed from none to one-round
    expect(log[2]!.negotiationDelta).toEqual({ forcing: "one-round" });
    expect(log[2]!.stateAfter.forcing).toBe("one-round");
  });

  it("threads kernel state through steps", () => {
    const call1 = bid(1, BidSuit.NoTrump);
    const call2 = bid(2, BidSuit.Clubs);

    const p1 = makeProposal({
      sourceIntent: { type: "NTOpening", params: {} },
    });
    const p2 = makeProposal({
      sourceIntent: { type: "StaymanAsk", params: {} },
    });

    const steps: ObservationLogStep[] = [
      {
        actor: Seat.North,
        call: call1,
        registers: makeRegisters({
          captain: "undecided",
        }),
        pipelineResult: makeResult(p1, call1),
      },
      {
        actor: Seat.South,
        call: call2,
        registers: makeRegisters({
          captain: "responder",
          forcingState: ForcingState.ForcingOneRound,
        }),
        pipelineResult: makeResult(p2, call2),
      },
    ];

    const log = buildObservationLog(steps);

    // Step 0: kernel is INITIAL (no delta)
    expect(log[0]!.negotiationDelta).toEqual({});

    // Step 1: delta from step 0's stateAfter
    expect(log[1]!.negotiationDelta).toEqual({
      captain: "responder",
      forcing: "one-round",
    });
  });
});
