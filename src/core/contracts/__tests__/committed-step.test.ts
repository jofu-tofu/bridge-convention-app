import { describe, it, expect } from "vitest";
import { Seat, BidSuit } from "../../../engine/types";
import type { ContractBid, SpecialCall } from "../../../engine/types";
import type {
  KernelState,
  KernelDelta,
  ClaimRef,
  CommittedStep,
  AuctionContext,
} from "../committed-step";
import { INITIAL_KERNEL } from "../committed-step";

describe("INITIAL_KERNEL", () => {
  it("has expected defaults", () => {
    expect(INITIAL_KERNEL).toEqual({
      fitAgreed: null,
      forcing: "none",
      captain: "undecided",
      competition: "uncontested",
    });
  });

  it("is frozen (immutable)", () => {
    expect(Object.isFrozen(INITIAL_KERNEL)).toBe(true);
  });
});

describe("type-level construction", () => {
  it("constructs a valid KernelState", () => {
    const kernel: KernelState = {
      fitAgreed: { strain: "hearts", confidence: "tentative" },
      forcing: "game",
      captain: "responder",
      competition: "uncontested",
    };
    expect(kernel.fitAgreed?.strain).toBe("hearts");
  });

  it("constructs KernelState with overcalled competition", () => {
    const kernel: KernelState = {
      fitAgreed: null,
      forcing: "none",
      captain: "undecided",
      competition: { kind: "overcalled", strain: "hearts", level: 2 },
    };
    expect(kernel.competition).toEqual({
      kind: "overcalled",
      strain: "hearts",
      level: 2,
    });
  });

  it("constructs a valid KernelDelta (partial)", () => {
    const delta: KernelDelta = { forcing: "game" };
    expect(delta.forcing).toBe("game");
    expect(delta.fitAgreed).toBeUndefined();
  });

  it("constructs a valid ClaimRef", () => {
    const claim: ClaimRef = {
      moduleId: "stayman",
      meaningId: "stayman-ask",
      semanticClassId: "stayman:ask-major",
      sourceIntent: { type: "StaymanAsk", params: {} },
    };
    expect(claim.moduleId).toBe("stayman");
  });

  it("constructs a valid CommittedStep", () => {
    const step: CommittedStep = {
      actor: Seat.South,
      call: { type: "bid", level: 2, strain: BidSuit.Clubs } as ContractBid,
      resolvedClaim: {
        moduleId: "stayman",
        meaningId: "stayman-ask",
        semanticClassId: "stayman:ask-major",
        sourceIntent: { type: "StaymanAsk", params: {} },
      },
      publicObs: [{ act: "inquire", feature: "majorSuit" }],
      kernelDelta: {},
      postKernel: INITIAL_KERNEL,
      status: "resolved",
    };
    expect(step.status).toBe("resolved");
    expect(step.publicObs).toHaveLength(1);
  });

  it("constructs a CommittedStep with null claim (off-system)", () => {
    const step: CommittedStep = {
      actor: Seat.East,
      call: { type: "pass" } as SpecialCall,
      resolvedClaim: null,
      publicObs: [{ act: "pass" }],
      kernelDelta: {},
      postKernel: INITIAL_KERNEL,
      status: "off-system",
    };
    expect(step.resolvedClaim).toBeNull();
  });

  it("constructs a valid AuctionContext", () => {
    const ctx: AuctionContext = {
      snapshot: {} as AuctionContext["snapshot"],
      log: [],
    };
    expect(ctx.log).toHaveLength(0);
  });
});
