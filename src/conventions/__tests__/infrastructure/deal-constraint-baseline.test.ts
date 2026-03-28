/**
 * Phase 0: Characterization tests for deal constraints.
 *
 * Snapshots current deal constraint behavior for all 6 bundles × 3 system configs.
 * These tests assert CURRENT behavior and must stay green through the entire
 * derivation migration (Phases 1–5).
 */

import { describe, it, expect } from "vitest";

import { getBundleInput, resolveBundle } from "../../definitions/system-registry";
import {
  SAYC_SYSTEM_CONFIG,
  TWO_OVER_ONE_SYSTEM_CONFIG,
  ACOL_SYSTEM_CONFIG,
} from "../../definitions/system-config";
import type { SystemConfig } from "../../definitions/system-config";
import type { DealConstraints } from "../../../engine/types";
import { Seat, Suit } from "../../../engine/types";

// ── Helpers ─────────────────────────────────────────────────────────

/** Strip non-serializable fields (customCheck, rng) for snapshot comparison. */
function serializableConstraints(dc: DealConstraints): unknown {
  return {
    ...dc,
    seats: dc.seats.map((sc) => {
      const { customCheck, ...rest } = sc as unknown as Record<string, unknown>;
      return rest;
    }),
  };
}

/** Extract key constraint properties for structural assertions. */
function extractSeatConstraint(dc: DealConstraints, seat: Seat) {
  const sc = dc.seats.find((s) => s.seat === seat);
  if (!sc) return undefined;
  return {
    seat: sc.seat,
    minHcp: sc.minHcp,
    maxHcp: sc.maxHcp,
    balanced: sc.balanced,
    minLength: sc.minLength,
    maxLength: sc.maxLength,
    minLengthAny: sc.minLengthAny,
    hasCustomCheck: sc.customCheck !== undefined,
  };
}

// ── Bundle IDs ──────────────────────────────────────────────────────

const BUNDLE_IDS = [
  "nt-bundle",
  "nt-stayman",
  "nt-transfers",
  "bergen-bundle",
  "dont-bundle",
  "weak-twos-bundle",
] as const;

const SYSTEM_CONFIGS: readonly { name: string; sys: SystemConfig }[] = [
  { name: "SAYC", sys: SAYC_SYSTEM_CONFIG },
  { name: "2/1", sys: TWO_OVER_ONE_SYSTEM_CONFIG },
  { name: "Acol", sys: ACOL_SYSTEM_CONFIG },
];

// ── Characterization tests ──────────────────────────────────────────

describe("deal constraint baseline", () => {
  for (const bundleId of BUNDLE_IDS) {
    describe(bundleId, () => {
      for (const { name, sys } of SYSTEM_CONFIGS) {
        describe(name, () => {
          const input = getBundleInput(bundleId)!;
          const bundle = resolveBundle(input, sys);

          it("dealConstraints snapshot", () => {
            expect(serializableConstraints(bundle.dealConstraints)).toMatchSnapshot();
          });

          it("dealConstraints structural properties", () => {
            const dc = bundle.dealConstraints;
            // Every bundle has at least one seat constraint
            expect(dc.seats.length).toBeGreaterThanOrEqual(1);

            // Snapshot per-seat constraints for structural verification
            for (const sc of dc.seats) {
              expect(extractSeatConstraint(dc, sc.seat)).toMatchSnapshot();
            }
          });

          if (bundle.offConventionConstraints) {
            it("offConventionConstraints snapshot", () => {
              expect(
                serializableConstraints(bundle.offConventionConstraints!),
              ).toMatchSnapshot();
            });
          }

          it("defaultAuction output", () => {
            if (bundle.defaultAuction) {
              // Test with typical seats
              const southResult = bundle.defaultAuction(Seat.South);
              const northResult = bundle.defaultAuction(Seat.North);
              expect({ south: southResult, north: northResult }).toMatchSnapshot();
            }
          });

          it("allowedDealers", () => {
            expect(bundle.allowedDealers).toMatchSnapshot();
          });
        });
      }
    });
  }
});

// ── Specific structural assertions (not just snapshots) ─────────────

describe("deal constraint structural invariants", () => {
  describe("nt-bundle SAYC", () => {
    const bundle = resolveBundle(getBundleInput("nt-bundle")!, SAYC_SYSTEM_CONFIG);

    it("opener is North 15-17 balanced", () => {
      const north = extractSeatConstraint(bundle.dealConstraints, Seat.North);
      expect(north).toEqual(expect.objectContaining({
        seat: Seat.North,
        minHcp: 15,
        maxHcp: 17,
        balanced: true,
      }));
    });

    it("responder HCP is unconstrained (transfers have no HCP floor)", () => {
      const south = extractSeatConstraint(bundle.dealConstraints, Seat.South);
      // Derived: undefined (transfers have no HCP clause) — unconstrained
      expect(south?.minHcp).toBeUndefined();
    });

    it("off-convention uses customCheck negation", () => {
      const south = extractSeatConstraint(bundle.offConventionConstraints!, Seat.South);
      expect(south?.hasCustomCheck).toBe(true);
    });
  });

  describe("nt-stayman SAYC", () => {
    const bundle = resolveBundle(getBundleInput("nt-stayman")!, SAYC_SYSTEM_CONFIG);

    it("responder has 8+ HCP with 4-card major", () => {
      const south = extractSeatConstraint(bundle.dealConstraints, Seat.South);
      expect(south?.minHcp).toBe(8);
      expect(south?.minLengthAny).toEqual({ [Suit.Spades]: 4, [Suit.Hearts]: 4 });
    });
  });

  describe("nt-transfers SAYC", () => {
    const bundle = resolveBundle(getBundleInput("nt-transfers")!, SAYC_SYSTEM_CONFIG);

    it("responder has 5+ card major (no HCP floor from transfers)", () => {
      const south = extractSeatConstraint(bundle.dealConstraints, Seat.South);
      // Transfers have no HCP clause — derivation produces unconstrained
      expect(south?.minLengthAny).toEqual({ [Suit.Spades]: 5, [Suit.Hearts]: 5 });
    });
  });

  describe("bergen-bundle SAYC", () => {
    const bundle = resolveBundle(getBundleInput("bergen-bundle")!, SAYC_SYSTEM_CONFIG);

    it("opener has 12-21 HCP with 5+ major", () => {
      const north = extractSeatConstraint(bundle.dealConstraints, Seat.North);
      expect(north?.minHcp).toBe(12);
      expect(north?.maxHcp).toBe(21);
      expect(north?.minLengthAny).toEqual({ [Suit.Hearts]: 5, [Suit.Spades]: 5 });
    });

    it("responder has 4-card major support", () => {
      const south = extractSeatConstraint(bundle.dealConstraints, Seat.South);
      expect(south?.minLengthAny).toEqual({ [Suit.Hearts]: 4, [Suit.Spades]: 4 });
    });
  });

  describe("dont-bundle SAYC", () => {
    const bundle = resolveBundle(getBundleInput("dont-bundle")!, SAYC_SYSTEM_CONFIG);

    it("opponent East is 15-17 HCP", () => {
      const east = extractSeatConstraint(bundle.dealConstraints, Seat.East);
      expect(east?.minHcp).toBe(15);
      expect(east?.maxHcp).toBe(17);
    });

    it("overcaller South has 8-15 HCP", () => {
      const south = extractSeatConstraint(bundle.dealConstraints, Seat.South);
      expect(south?.minHcp).toBe(8);
      expect(south?.maxHcp).toBe(15);
    });

    it("overcaller South has suit-length constraints from compositions", () => {
      const south = extractSeatConstraint(bundle.dealConstraints, Seat.South);
      // Derived from composition inversion — may be slightly looser than hand-authored
      expect(south?.minLengthAny).toBeDefined();
      // Must include all 4 suits (every DONT variant needs distributional shape)
      const suits = Object.keys(south?.minLengthAny ?? {});
      expect(suits.length).toBe(4);
    });

    it("allowed dealers is East only", () => {
      expect(bundle.allowedDealers).toEqual([Seat.East]);
    });
  });

  describe("weak-twos-bundle SAYC", () => {
    const bundle = resolveBundle(getBundleInput("weak-twos-bundle")!, SAYC_SYSTEM_CONFIG);

    it("opener North is 5-10 HCP with 6+ in D/H/S", () => {
      const north = extractSeatConstraint(bundle.dealConstraints, Seat.North);
      expect(north?.minHcp).toBe(5);
      expect(north?.maxHcp).toBe(10);
      expect(north?.minLengthAny).toEqual({
        [Suit.Diamonds]: 6,
        [Suit.Hearts]: 6,
        [Suit.Spades]: 6,
      });
    });

    it("responder South has HCP floor from totalPoints approximation", () => {
      const south = extractSeatConstraint(bundle.dealConstraints, Seat.South);
      // bridge.totalPointsForRaise >= 6 (preemptive raise) → approx hand.hcp >= 4
      expect(south?.minHcp).toBe(4);
    });

    it("allowed dealers is North only", () => {
      expect(bundle.allowedDealers).toEqual([Seat.North]);
    });
  });

  // Cross-system variation tests
  describe("Acol system variation", () => {
    it("nt-bundle Acol uses 12-14 HCP for opener", () => {
      const bundle = resolveBundle(getBundleInput("nt-bundle")!, ACOL_SYSTEM_CONFIG);
      const north = extractSeatConstraint(bundle.dealConstraints, Seat.North);
      expect(north?.minHcp).toBe(12);
      expect(north?.maxHcp).toBe(14);
    });

    it("nt-stayman Acol responder needs 10+ HCP (inviteMin)", () => {
      const bundle = resolveBundle(getBundleInput("nt-stayman")!, ACOL_SYSTEM_CONFIG);
      const south = extractSeatConstraint(bundle.dealConstraints, Seat.South);
      expect(south?.minHcp).toBe(10);
    });
  });
});
