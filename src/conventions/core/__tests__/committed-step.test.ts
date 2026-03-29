import { describe, it, expect } from "vitest";
import { Seat, BidSuit } from "../../../engine/types";
import type { ContractBid, SpecialCall } from "../../../engine/types";
import type {
  NegotiationState,
  NegotiationDelta,
  ClaimRef,
  CommittedStep,
  AuctionContext,
} from "../committed-step";
import { INITIAL_NEGOTIATION, ConfidenceLevel } from "../committed-step";
import { ObsSuit } from "../../pipeline/bid-action";

describe("INITIAL_NEGOTIATION", () => {
  it("has expected defaults", () => {
    expect(INITIAL_NEGOTIATION).toEqual({
      fitAgreed: null,
      forcing: "none",
      captain: "undecided",
      competition: "uncontested",
    });
  });

  it("is frozen (immutable)", () => {
    expect(Object.isFrozen(INITIAL_NEGOTIATION)).toBe(true);
  });
});

describe("type-level construction", () => {
  it("constructs a valid NegotiationState", () => {
    const kernel: NegotiationState = {
      fitAgreed: { strain: ObsSuit.Hearts, confidence: ConfidenceLevel.Tentative },
      forcing: "game",
      captain: "responder",
      competition: "uncontested",
    };
    expect(kernel.fitAgreed?.strain).toBe("hearts");
  });

  it("constructs NegotiationState with overcalled competition", () => {
    const kernel: NegotiationState = {
      fitAgreed: null,
      forcing: "none",
      captain: "undecided",
      competition: { kind: "overcalled", strain: ObsSuit.Hearts, level: 2 },
    };
    expect(kernel.competition).toEqual({
      kind: "overcalled",
      strain: ObsSuit.Hearts,
      level: 2,
    });
  });

  it("constructs a valid NegotiationDelta (partial)", () => {
    const delta: NegotiationDelta = { forcing: "game" };
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
      publicActions: [{ act: "inquire", feature: "majorSuit" }],
      negotiationDelta: {},
      stateAfter: INITIAL_NEGOTIATION,
      status: "resolved",
    };
    expect(step.status).toBe("resolved");
    expect(step.publicActions).toHaveLength(1);
  });

  it("constructs a CommittedStep with null claim (off-system)", () => {
    const step: CommittedStep = {
      actor: Seat.East,
      call: { type: "pass" } as SpecialCall,
      resolvedClaim: null,
      publicActions: [{ act: "pass" }],
      negotiationDelta: {},
      stateAfter: INITIAL_NEGOTIATION,
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
