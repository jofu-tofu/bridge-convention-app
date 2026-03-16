/**
 * NT-bundle integration tests for commitment extraction.
 *
 * These tests exercise extractCommitments with real NT convention surfaces
 * and machine. Moved from core/runtime/__tests__/commitment-extractor.test.ts
 * to separate convention-specific tests from core infrastructure tests.
 */
import { describe, it, expect } from "vitest";
import {
  extractCommitments,
} from "../../core/runtime/commitment-extractor";
import { buildAuction } from "../../../engine/auction-helpers";
import { Seat } from "../../../engine/types";
import {
  createNtSurfaceRouter,
  NT_ROUTED_SURFACES,
} from "../../definitions/nt-bundle/surface-routing";
import { createNtConversationMachine } from "../../definitions/nt-bundle/machine";

const surfaceRouter = createNtSurfaceRouter(NT_ROUTED_SURFACES, createNtConversationMachine());

describe("extractCommitments (NT bundle)", () => {
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

  it("extracts deny-major commitment as entailed-denial via closure policy", () => {
    const auction = buildAuction(Seat.North, [
      "1NT",
      "P",
      "2C",
      "P",
      "2D",
    ]);
    const commitments = extractCommitments(auction, Seat.South, surfaceRouter);

    // 2D = deny-major: closure policy entails denial of 4-card majors
    const openerDenials = commitments.filter(
      (c) => c.subject === (Seat.North as string) && c.origin === "entailed-denial",
    );
    // Closure policy produces entailed denials for hearts >= 4 and spades >= 4
    expect(openerDenials.length).toBeGreaterThanOrEqual(2);
    const heartsDenial = openerDenials.find(
      (c) => c.constraint.factId === "hand.suitLength.hearts",
    );
    const spadesDenial = openerDenials.find(
      (c) => c.constraint.factId === "hand.suitLength.spades",
    );
    expect(heartsDenial).toBeDefined();
    expect(spadesDenial).toBeDefined();
  });
});

describe("extractCommitments — entailed denials via closurePolicy (NT bundle)", () => {
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
