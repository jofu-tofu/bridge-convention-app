/**
 * Tests that deriveBundleDealConstraints() produces constraints equivalent
 * to the hand-authored ones for all bundles × system configs.
 */

import { describe, it, expect } from "vitest";

import { getBundleInput, resolveBundle } from "../../definitions/system-registry";
import { deriveBundleDealConstraints } from "../../definitions/derive-deal-constraints";
import {
  SAYC_SYSTEM_CONFIG,
  TWO_OVER_ONE_SYSTEM_CONFIG,
  ACOL_SYSTEM_CONFIG,
} from "../../../core/contracts/system-config";
import type { SystemConfig } from "../../../core/contracts/system-config";
import type { SeatConstraint , Suit } from "../../../engine/types";
import { Seat } from "../../../engine/types";

// ── Helpers ─────────────────────────────────────────────────────────

function findSeat(seats: readonly SeatConstraint[], seat: Seat) {
  return seats.find((s) => s.seat === seat);
}

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

// ── Tests ───────────────────────────────────────────────────────────

describe("deriveBundleDealConstraints", () => {
  for (const bundleId of BUNDLE_IDS) {
    describe(bundleId, () => {
      for (const { name, sys } of SYSTEM_CONFIGS) {
        describe(name, () => {
          const input = getBundleInput(bundleId)!;
          const bundle = resolveBundle(input, sys);
          const derived = deriveBundleDealConstraints(input, bundle.modules, sys);

          it("opener HCP matches", () => {
            const authored = bundle.dealConstraints;
            // Find the opener seat (not South)
            const openerAuthored = authored.seats.find((s) => s.seat !== Seat.South);
            const openerDerived = derived.dealConstraints.seats.find(
              (s) => s.seat !== Seat.South,
            );

            if (openerAuthored) {
              expect(openerDerived?.minHcp).toBe(openerAuthored.minHcp);
              expect(openerDerived?.maxHcp).toBe(openerAuthored.maxHcp);
              if (openerAuthored.balanced !== undefined) {
                expect(openerDerived?.balanced).toBe(openerAuthored.balanced);
              }
            }
          });

          it("practitioner HCP is equal or looser than authored", () => {
            const authored = findSeat(bundle.dealConstraints.seats, Seat.South);
            const derivedSouth = findSeat(derived.dealConstraints.seats, Seat.South);

            // Derived minHcp should be <= authored (equal or looser)
            // undefined means unconstrained, which is the loosest
            if (authored?.minHcp !== undefined && authored.minHcp > 0) {
              if (derivedSouth?.minHcp !== undefined) {
                expect(derivedSouth.minHcp).toBeLessThanOrEqual(authored.minHcp);
                // Allow at most 2 HCP difference (from totalPoints approximation)
                expect(derivedSouth.minHcp).toBeGreaterThanOrEqual(authored.minHcp - 2);
              }
              // If derived is undefined, that's looser — acceptable
            }
            if (authored?.maxHcp !== undefined) {
              if (derivedSouth?.maxHcp !== undefined) {
                expect(derivedSouth.maxHcp).toBeGreaterThanOrEqual(authored.maxHcp);
              }
            }
          });

          it("practitioner suit constraints are equal or looser than authored", () => {
            const authored = findSeat(bundle.dealConstraints.seats, Seat.South);
            const derivedSouth = findSeat(derived.dealConstraints.seats, Seat.South);

            if (authored?.minLengthAny && derivedSouth?.minLengthAny) {
              // Each derived suit threshold should be <= authored (equal or looser)
              for (const [suitKey, authoredVal] of Object.entries(authored.minLengthAny)) {
                const derivedVal = derivedSouth.minLengthAny[Number(suitKey) as unknown as Suit];
                if (derivedVal !== undefined) {
                  expect(derivedVal).toBeLessThanOrEqual(authoredVal);
                }
              }
            }
            // maxLength may differ structurally — derived may omit it when surfaces disagree
          });

          it("allowedDealers matches", () => {
            expect(derived.allowedDealers).toEqual(bundle.allowedDealers);
          });

          it("defaultAuction produces same results for South", () => {
            if (bundle.defaultAuction && derived.defaultAuction) {
              const authoredResult = bundle.defaultAuction(Seat.South);
              const derivedResult = derived.defaultAuction(Seat.South);
              expect(derivedResult).toEqual(authoredResult);
            }
          });
        });
      }
    });
  }
});
