/**
 * Characterization tests — golden masters for current NT bundle behavior.
 *
 * These tests capture the current surface selection, eligible bids, and
 * arbitration results for key auction sequences using the rule interpreter.
 *
 * Tested auction sequences:
 * - 1NT-P (R1 surfaces — responder's first bid)
 * - 1NT-P-2C-P (Stayman opener response)
 * - 1NT-P-2C-P-2D-P (Stayman R3 after denial)
 * - 1NT-P-2C-P-2H-P (Stayman R3 after hearts shown)
 * - 1NT-P-2D-P (Transfer accept)
 * - 1NT-P-2D-P-2H-P (Transfer R3)
 * - 1NT-P-2C-P-2D-P-3H (Smolen after denial)
 */

import { describe, it, expect } from "vitest";
import { buildAuction } from "../../../engine/auction-helpers";
import { hand } from "../../../engine/__tests__/fixtures";
import { evaluateHand } from "../../../engine/hand-evaluator";
import { Seat, Vulnerability } from "../../../engine/types";
import { ntBundle } from "../../definitions/nt-bundle";
import { createSharedFactCatalog } from "../../pipeline/shared-fact-catalog";
import { collectMatchingClaims } from "../../pipeline/rule-interpreter";
import { createFactCatalog } from "../../../core/contracts/fact-catalog";
import { createBiddingContext } from "../../core/context-factory";
import { runPipeline } from "../../pipeline/run-pipeline";
import { buildObservationLogViaRules } from "../../../strategy/bidding/protocol-adapter";
import type { AuctionContext } from "../../../core/contracts/committed-step";
import type { PublicSnapshot } from "../../../core/contracts/module-surface";
import type { ConventionModule } from "../../core/convention-module";

const ruleModules: readonly ConventionModule[] = ntBundle.modules;

// Build fact catalog from rule module fact extensions
const moduleFactExtensions = ruleModules
  .map((m) => m.facts)
  .filter((f) => f.definitions.length > 0 || f.evaluators.size > 0);

const catalog = moduleFactExtensions.length > 0
  ? createFactCatalog(createSharedFactCatalog(), ...moduleFactExtensions)
  : createSharedFactCatalog();

/**
 * Evaluate an auction position: rule interpreter surfaces + run pipeline.
 * Returns active surfaces and arbitration result.
 */
function evaluatePosition(
  bids: string[],
  testHand: ReturnType<typeof hand>,
  seat: Seat = Seat.South,
  dealer: Seat = Seat.North,
) {
  const auction = buildAuction(dealer, bids);
  const history = auction.entries.map((e) => ({
    call: e.call,
    seat: e.seat,
  }));

  // Use rule interpreter for surface selection
  const log = buildObservationLogViaRules(history, seat, ruleModules);
  const auctionCtx: AuctionContext = { snapshot: {} as PublicSnapshot, log };
  const results = collectMatchingClaims(ruleModules, auctionCtx, seat);
  const visibleSurfaces = results.flatMap((r) => r.claims.map((c) => c.surface));

  const ev = evaluateHand(testHand);
  const context = createBiddingContext({
    hand: testHand,
    auction,
    seat,
    evaluation: ev,
    vulnerability: Vulnerability.None,
    dealer,
  });

  if (visibleSurfaces.length === 0) {
    return {
      surfaceIds: [] as string[],
      arbitration: null,
      selectedMeaningId: null,
    };
  }

  const { result } = runPipeline({
    surfaces: visibleSurfaces,
    context,
    catalog,
  });

  return {
    surfaceIds: visibleSurfaces.map((s) => s.meaningId),
    arbitration: result,
    selectedMeaningId: result.selected?.proposal.meaningId ?? null,
  };
}

// Standard test hands
// 15-17 HCP balanced for opener
const openerHand = hand("SA", "SK", "HQ", "HJ", "H2", "DK", "DT", "D5", "D4", "CA", "C8", "C5", "C2");

// 10 HCP, 4-4 majors for Stayman responder
const staymanHand = hand("SK", "SJ", "S9", "S2", "HK", "HQ", "H7", "H3", "D8", "D6", "D4", "C7", "C3");

// 10 HCP, 5 hearts for transfer responder
const transferHand = hand("SA", "S2", "HK", "HQ", "H9", "H5", "H3", "D8", "D6", "D4", "C7", "C5", "C3");

// 10 HCP, 5-4 (5H, 4S) for Smolen responder
const smolenHand = hand("SK", "SJ", "S9", "S2", "HK", "HQ", "H9", "H5", "H3", "D8", "D6", "C7", "C3");

describe("Characterization tests: NT bundle golden masters", () => {
  describe("1NT-P (R1 — responder surfaces)", () => {
    it("produces surfaces for responder with Stayman hand", () => {
      const { surfaceIds, selectedMeaningId, arbitration } = evaluatePosition(
        ["1NT", "P"],
        staymanHand,
      );

      // Should have visible surfaces
      expect(surfaceIds.length).toBeGreaterThan(0);

      // Should select something (Stayman 2C or other R1 bid)
      expect(selectedMeaningId).not.toBeNull();
      expect(arbitration).not.toBeNull();

      // Capture surface count and selected meaning as golden master
      expect(surfaceIds.length).toMatchSnapshot();
      expect(selectedMeaningId).toMatchSnapshot();
    });

    it("produces surfaces for responder with transfer hand", () => {
      const { surfaceIds, selectedMeaningId } = evaluatePosition(
        ["1NT", "P"],
        transferHand,
      );

      expect(surfaceIds.length).toBeGreaterThan(0);
      expect(selectedMeaningId).not.toBeNull();
      expect(surfaceIds.length).toMatchSnapshot();
      expect(selectedMeaningId).toMatchSnapshot();
    });
  });

  describe("1NT-P-2C-P (Stayman — opener response)", () => {
    it("produces opener response surfaces", () => {
      const { surfaceIds, selectedMeaningId } = evaluatePosition(
        ["1NT", "P", "2C", "P"],
        openerHand,
        Seat.North, // Opener is North
      );

      expect(surfaceIds.length).toBeGreaterThan(0);
      expect(selectedMeaningId).not.toBeNull();
      expect(surfaceIds.length).toMatchSnapshot();
      expect(selectedMeaningId).toMatchSnapshot();
    });
  });

  describe("1NT-P-2C-P-2D-P (Stayman R3 — after denial)", () => {
    it("produces R3 surfaces for Stayman responder after 2D denial", () => {
      const { surfaceIds, selectedMeaningId } = evaluatePosition(
        ["1NT", "P", "2C", "P", "2D", "P"],
        staymanHand,
      );

      expect(surfaceIds.length).toBeGreaterThan(0);
      expect(surfaceIds.length).toMatchSnapshot();
      expect(selectedMeaningId).toMatchSnapshot();
    });
  });

  describe("1NT-P-2C-P-2H-P (Stayman R3 — after hearts shown)", () => {
    it("produces R3 surfaces for Stayman responder after 2H", () => {
      const { surfaceIds, selectedMeaningId } = evaluatePosition(
        ["1NT", "P", "2C", "P", "2H", "P"],
        staymanHand,
      );

      expect(surfaceIds.length).toBeGreaterThan(0);
      expect(surfaceIds.length).toMatchSnapshot();
      expect(selectedMeaningId).toMatchSnapshot();
    });
  });

  describe("1NT-P-2D-P (Transfer — opener accepts)", () => {
    it("produces transfer accept surfaces for opener", () => {
      const { surfaceIds, selectedMeaningId } = evaluatePosition(
        ["1NT", "P", "2D", "P"],
        openerHand,
        Seat.North,
      );

      expect(surfaceIds.length).toBeGreaterThan(0);
      expect(surfaceIds.length).toMatchSnapshot();
      expect(selectedMeaningId).toMatchSnapshot();
    });
  });

  describe("1NT-P-2D-P-2H-P (Transfer R3 — after accept)", () => {
    it("produces R3 surfaces for transfer responder after accept", () => {
      const { surfaceIds, selectedMeaningId } = evaluatePosition(
        ["1NT", "P", "2D", "P", "2H", "P"],
        transferHand,
      );

      expect(surfaceIds.length).toBeGreaterThan(0);
      expect(surfaceIds.length).toMatchSnapshot();
      expect(selectedMeaningId).toMatchSnapshot();
    });
  });

  describe("1NT-P-2C-P-2D-P-3H (Smolen — after Stayman denial)", () => {
    it("produces Smolen surfaces for responder with 5-4 hand", () => {
      const { surfaceIds, selectedMeaningId } = evaluatePosition(
        ["1NT", "P", "2C", "P", "2D", "P"],
        smolenHand,
      );

      // Smolen should be among the active surfaces
      expect(surfaceIds.length).toBeGreaterThan(0);
      expect(surfaceIds.length).toMatchSnapshot();
      expect(selectedMeaningId).toMatchSnapshot();
    });
  });
});
