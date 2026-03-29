/**
 * Integration test: Bergen FSM advances correctly when natural-bids provides
 * the winning opening claim.
 *
 * When both modules are active (e.g., Bergen practice with base modules),
 * natural-bids's 1H/1S surfaces have real clauses (HCP + suit length → higher
 * specificity) and win arbitration over Bergen's stub opening surfaces. Bergen's
 * FSM must still advance to opened-hearts/opened-spades because FSM matching is
 * based on observations (publicActions), not surface ownership.
 */

import { describe, it, expect } from "vitest";
import { collectMatchingClaims } from "../pipeline/observation/rule-interpreter";
import type { ConventionModule } from "../core/convention-module";
import type { AuctionContext, CommittedStep, NegotiationState } from "../core/committed-step";
import { INITIAL_NEGOTIATION } from "../core/committed-step";
import type { PublicSnapshot } from "../core/module-surface";
import { Seat } from "../../engine/types";
import { getModules } from "../definitions/module-registry";
import { ObsSuit } from "../pipeline/bid-action";

// Both modules active (simulates Bergen practice with base modules)
const modules: ConventionModule[] = [
  ...getModules(["natural-bids", "bergen"]),
];

function makeStep(
  actor: Seat,
  obs: CommittedStep["publicActions"],
  kernelOverrides: Partial<NegotiationState> = {},
): CommittedStep {
  return {
    actor,
    call: { type: "pass" },
    resolvedClaim: null,
    publicActions: obs,
    negotiationDelta: {},
    stateAfter: { ...INITIAL_NEGOTIATION, ...kernelOverrides },
    status: obs.length > 0 ? "resolved" : "raw-only",
  };
}

function passStep(actor: Seat): CommittedStep {
  return {
    actor,
    call: { type: "pass" },
    resolvedClaim: null,
    publicActions: [],
    negotiationDelta: {},
    stateAfter: INITIAL_NEGOTIATION,
    status: "raw-only",
  };
}

function makeContext(log: readonly CommittedStep[]): AuctionContext {
  return { snapshot: {} as PublicSnapshot, log };
}

/** Flatten resolved surfaces from all module results. */
function allSurfaces(log: readonly CommittedStep[], nextSeat: Seat) {
  const results = collectMatchingClaims(modules, makeContext(log), nextSeat);
  return results.flatMap((r) => r.resolved.map((c) => ({
    moduleId: r.moduleId,
    meaningId: c.surface.meaningId,
    intentType: c.surface.sourceIntent.type,
    clauseCount: c.surface.clauses.length,
  })));
}

describe("Bergen + natural-bids integration", () => {
  it("both modules produce opening claims at idle", () => {
    const surfaces = allSurfaces([], Seat.South);
    // natural-bids provides 1H, 1S (plus 1C, 1D, 1NT)
    // Bergen provides stub 1H, 1S
    const heartClaims = surfaces.filter(
      (s) => s.intentType === "SuitOpen" && s.meaningId === "bridge:1h-opening" ||
             s.intentType === "MajorOpen" && s.meaningId.includes("hearts"),
    );
    expect(heartClaims.length).toBeGreaterThanOrEqual(1);
  });

  it("natural-bids 1H surface has clauses; Bergen stub has zero", () => {
    const surfaces = allSurfaces([], Seat.South);
    const naturalBidsHeart = surfaces.find(
      (s) => s.intentType === "SuitOpen" && s.meaningId === "bridge:1h-opening",
    );
    const bergenStubHeart = surfaces.find(
      (s) => s.moduleId === "bergen" && s.intentType === "MajorOpen",
    );
    expect(naturalBidsHeart).toBeDefined();
    expect(bergenStubHeart).toBeDefined();
    // Natural-open has real clauses (HCP + length), Bergen stub has zero
    expect(naturalBidsHeart!.clauseCount).toBeGreaterThan(0);
    expect(bergenStubHeart!.clauseCount).toBe(0);
  });

  it("Bergen FSM advances to opened-hearts after 1H open observation", () => {
    const log: CommittedStep[] = [
      makeStep(Seat.South, [{ act: "open", strain: ObsSuit.Hearts }]),
      passStep(Seat.West),
    ];

    const surfaces = allSurfaces(log, Seat.North);
    // Bergen should have advanced to opened-hearts and produce R1 surfaces
    const bergenClaims = surfaces.filter((s) => s.moduleId === "bergen");
    expect(bergenClaims.length).toBeGreaterThan(0);
  });

  it("Bergen FSM advances to opened-spades after 1S open observation", () => {
    const log: CommittedStep[] = [
      makeStep(Seat.South, [{ act: "open", strain: ObsSuit.Spades }]),
      passStep(Seat.West),
    ];

    const surfaces = allSurfaces(log, Seat.North);
    const bergenClaims = surfaces.filter((s) => s.moduleId === "bergen");
    expect(bergenClaims.length).toBeGreaterThan(0);
  });

  it("natural-bids FSM advances to opened-suit (no response surfaces)", () => {
    const log: CommittedStep[] = [
      makeStep(Seat.South, [{ act: "open", strain: ObsSuit.Hearts }]),
      passStep(Seat.West),
    ];

    const surfaces = allSurfaces(log, Seat.North);
    // natural-bids in opened-suit phase has no surfaces
    const naturalBidsClaims = surfaces.filter((s) => s.moduleId === "natural-bids");
    expect(naturalBidsClaims).toHaveLength(0);
  });
});
