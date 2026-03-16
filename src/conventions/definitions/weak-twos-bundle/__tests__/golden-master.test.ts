/**
 * Golden-master characterization test for the Weak Two bundle.
 *
 * Captures the current bundle shape before migration to ModulePackage[] +
 * compileProfileFromPackages(). If the migration changes any observable
 * property, this test will fail.
 */
import { describe, it, expect } from "vitest";
import { Seat } from "../../../../engine/types";
import { buildAuction } from "../../../../engine/auction-helpers";
import { evaluateMachine } from "../../../core/runtime/machine-evaluator";
import { weakTwoBundle } from "../config";

describe("Weak Two bundle golden-master", () => {
  // ── Identity ──────────────────────────────────────────────────

  it("has correct identity fields", () => {
    expect(weakTwoBundle.id).toBe("weak-two-bundle");
    expect(weakTwoBundle.name).toBe("Weak Two Bids Bundle");
    expect(weakTwoBundle.memberIds).toEqual(["weak-two-bundle", "weak-twos"]);
    expect(weakTwoBundle.description).toBe(
      "Weak Two Bids with Ogust 2NT response system",
    );
  });

  // ── Surface groups ────────────────────────────────────────────

  it("has 7 meaning surface groups", () => {
    expect(weakTwoBundle.meaningSurfaces).toHaveLength(7);
  });

  it("has the correct surface group IDs", () => {
    const groupIds = weakTwoBundle.meaningSurfaces!.map((g) => g.groupId);
    expect(groupIds).toEqual([
      "opener-r1",
      "responder-r2-hearts",
      "responder-r2-spades",
      "responder-r2-diamonds",
      "ogust-response-hearts",
      "ogust-response-spades",
      "ogust-response-diamonds",
    ]);
  });

  it("has correct surface counts per group", () => {
    const counts = weakTwoBundle.meaningSurfaces!.map((g) => ({
      groupId: g.groupId,
      count: g.surfaces.length,
    }));
    expect(counts).toEqual([
      { groupId: "opener-r1", count: 3 },
      { groupId: "responder-r2-hearts", count: 4 },
      { groupId: "responder-r2-spades", count: 4 },
      { groupId: "responder-r2-diamonds", count: 4 },
      { groupId: "ogust-response-hearts", count: 5 },
      { groupId: "ogust-response-spades", count: 5 },
      { groupId: "ogust-response-diamonds", count: 5 },
    ]);
  });

  it("has all expected meaningIds in R1", () => {
    const r1Group = weakTwoBundle.meaningSurfaces!.find(
      (g) => g.groupId === "opener-r1",
    );
    const ids = r1Group!.surfaces.map((s) => s.meaningId);
    expect(ids).toEqual([
      "weak-two:open-2h",
      "weak-two:open-2s",
      "weak-two:open-2d",
    ]);
  });

  it("has all expected meaningIds in R2 hearts", () => {
    const r2Group = weakTwoBundle.meaningSurfaces!.find(
      (g) => g.groupId === "responder-r2-hearts",
    );
    const ids = r2Group!.surfaces.map((s) => s.meaningId);
    expect(ids).toEqual([
      "weak-two:game-raise-hearts",
      "weak-two:ogust-ask-hearts",
      "weak-two:invite-raise-hearts",
      "weak-two:weak-pass-hearts",
    ]);
  });

  it("has all expected meaningIds in Ogust hearts", () => {
    const ogustGroup = weakTwoBundle.meaningSurfaces!.find(
      (g) => g.groupId === "ogust-response-hearts",
    );
    const ids = ogustGroup!.surfaces.map((s) => s.meaningId);
    expect(ids).toEqual([
      "weak-two:ogust-solid-hearts",
      "weak-two:ogust-min-bad-hearts",
      "weak-two:ogust-min-good-hearts",
      "weak-two:ogust-max-bad-hearts",
      "weak-two:ogust-max-good-hearts",
    ]);
  });

  // ── Fact extensions ───────────────────────────────────────────

  it("has exactly 1 fact extension", () => {
    expect(weakTwoBundle.factExtensions).toHaveLength(1);
  });

  it("fact extension has all required fact IDs", () => {
    const factIds = weakTwoBundle.factExtensions![0]!.definitions.map(
      (d) => d.id,
    );
    expect(factIds).toEqual([
      "module.weakTwo.topHonorCount.hearts",
      "module.weakTwo.topHonorCount.spades",
      "module.weakTwo.topHonorCount.diamonds",
      "module.weakTwo.isMinimum",
      "module.weakTwo.isMaximum",
      "module.weakTwo.isSolid.hearts",
      "module.weakTwo.isSolid.spades",
      "module.weakTwo.isSolid.diamonds",
    ]);
  });

  // ── Conversation machine ──────────────────────────────────────

  it("has a conversation machine with correct ID", () => {
    expect(weakTwoBundle.conversationMachine).toBeDefined();
    expect(weakTwoBundle.conversationMachine!.machineId).toBe(
      "weak-two-conversation",
    );
  });

  it("machine has all 12 expected states", () => {
    const stateIds = Array.from(
      weakTwoBundle.conversationMachine!.states.keys(),
    ).sort();
    expect(stateIds).toEqual([
      "idle",
      "ogust-response-d",
      "ogust-response-h",
      "ogust-response-s",
      "responder-r2-d",
      "responder-r2-h",
      "responder-r2-s",
      "terminal",
      "weak-two-contested",
      "weak-two-opened-d",
      "weak-two-opened-h",
      "weak-two-opened-s",
    ]);
  });

  // ── Machine behavior — idle state has 3 entry transitions ─────

  it("idle state has 3 entry transitions (2H, 2S, 2D)", () => {
    const idle = weakTwoBundle.conversationMachine!.states.get("idle");
    expect(idle).toBeDefined();
    expect(idle!.transitions).toHaveLength(3);
  });

  // ── Surface router produces correct surfaces for key auctions ─

  it("router returns R1 surfaces for empty auction", () => {
    const router = weakTwoBundle.surfaceRouter!;
    const auction = buildAuction(Seat.North, []);
    const surfaces = router(auction, Seat.North);
    expect(surfaces.length).toBe(3);
    expect(surfaces.map((s) => s.meaningId)).toEqual([
      "weak-two:open-2h",
      "weak-two:open-2s",
      "weak-two:open-2d",
    ]);
  });

  it("router returns R2 hearts surfaces after 2H-P", () => {
    const router = weakTwoBundle.surfaceRouter!;
    const auction = buildAuction(Seat.North, ["2H", "P"]);
    const surfaces = router(auction, Seat.South);
    expect(surfaces.length).toBe(4);
    expect(surfaces[0]!.meaningId).toBe("weak-two:game-raise-hearts");
  });

  it("router returns Ogust hearts surfaces after 2H-P-2NT-P", () => {
    const router = weakTwoBundle.surfaceRouter!;
    const auction = buildAuction(Seat.North, ["2H", "P", "2NT", "P"]);
    const surfaces = router(auction, Seat.North);
    expect(surfaces.length).toBe(5);
    expect(surfaces[0]!.meaningId).toBe("weak-two:ogust-solid-hearts");
  });

  it("router returns empty for contested state", () => {
    const router = weakTwoBundle.surfaceRouter!;
    const auction = buildAuction(Seat.North, ["2H", "X"]);
    const surfaces = router(auction, Seat.South);
    expect(surfaces.length).toBe(0);
  });

  // ── Machine state transitions (end-to-end through router) ─────

  it("machine produces correct states for full Ogust path", () => {
    const machine = weakTwoBundle.conversationMachine!;

    const a1 = buildAuction(Seat.North, ["2H"]);
    const r1 = evaluateMachine(machine, a1, Seat.South);
    expect(r1.context.currentStateId).toBe("weak-two-opened-h");

    const a2 = buildAuction(Seat.North, ["2H", "P"]);
    const r2 = evaluateMachine(machine, a2, Seat.South);
    expect(r2.context.currentStateId).toBe("responder-r2-h");
    expect(r2.context.registers.captain).toBe("responder");

    const a3 = buildAuction(Seat.North, ["2H", "P", "2NT", "P"]);
    const r3 = evaluateMachine(machine, a3, Seat.South);
    expect(r3.context.currentStateId).toBe("ogust-response-h");
    expect(r3.context.registers.captain).toBe("opener");

    const a4 = buildAuction(Seat.North, ["2H", "P", "2NT", "P", "3C"]);
    const r4 = evaluateMachine(machine, a4, Seat.South);
    expect(r4.context.currentStateId).toBe("terminal");
  });

  // ── Explanation catalog ───────────────────────────────────────

  it("has an explanation catalog", () => {
    expect(weakTwoBundle.explanationCatalog).toBeDefined();
  });

  // ── Pedagogical relations ─────────────────────────────────────

  it("has pedagogical relations", () => {
    expect(weakTwoBundle.pedagogicalRelations).toBeDefined();
    expect(weakTwoBundle.pedagogicalRelations!.length).toBeGreaterThan(0);
  });

  it("has same-family relations for opener bids", () => {
    const sameFamily = weakTwoBundle.pedagogicalRelations!.filter(
      (r) => r.kind === "same-family",
    );
    expect(sameFamily.length).toBeGreaterThan(0);
  });

  it("has stronger-than relations for responder strength chain", () => {
    const strongerThan = weakTwoBundle.pedagogicalRelations!.filter(
      (r) => r.kind === "stronger-than",
    );
    expect(strongerThan.length).toBeGreaterThan(0);
  });

  // ── Declared capabilities ─────────────────────────────────────

  it("declares the weak-two-opening capability", () => {
    expect(weakTwoBundle.declaredCapabilities).toBeDefined();
    expect(weakTwoBundle.declaredCapabilities!["opening.weak-two"]).toBe(
      "active",
    );
  });

  // ── System profile ────────────────────────────────────────────

  it("has a system profile", () => {
    expect(weakTwoBundle.systemProfile).toBeDefined();
    expect(weakTwoBundle.systemProfile!.profileId).toBe("weak-two-sayc");
  });
});
