/**
 * Golden-master characterization test for NT bundle profile compilation.
 *
 * Records key structural properties of the NT bundle produced by the current
 * composition path (ConventionModule + BundleSkeleton + composeModules).
 * These assertions must pass BEFORE and AFTER migration to ModulePackage[]
 * + compileProfileFromPackages().
 */
import { describe, it, expect } from "vitest";
import { ntBundle } from "../config";
import { ntStaymanBundle, ntTransfersBundle } from "../sub-bundles";
import { buildAuction } from "../../../../engine/auction-helpers";
import { Seat, BidSuit } from "../../../../engine/types";

describe("NT bundle golden-master (characterization)", () => {
  // ── Surface groups ──────────────────────────────────────────────
  describe("surface group structure", () => {
    it("has the expected number of surface groups", () => {
      expect(ntBundle.meaningSurfaces).toBeDefined();
      expect(ntBundle.meaningSurfaces!.length).toBe(13);
    });

    it("has the expected surface count per group", () => {
      const counts = new Map(
        ntBundle.meaningSurfaces!.map((g) => [g.groupId, g.surfaces.length]),
      );

      // Entry: responder-r1 has 5 entry surfaces (Stayman 2C, Transfer 2D, Transfer 2H, 2NT invite, 3NT game)
      expect(counts.get("responder-r1")).toBe(5);

      // Opener 1NT (empty group from natural-nt)
      expect(counts.get("opener-1nt")).toBe(1);

      // Opener Stayman response
      expect(counts.get("opener-stayman-response")).toBe(3);

      // R3 after Stayman 2H
      expect(counts.get("responder-r3-after-stayman-2h")).toBe(4);

      // R3 after Stayman 2S
      expect(counts.get("responder-r3-after-stayman-2s")).toBe(4);

      // R3 after Stayman 2D (Stayman + Smolen surfaces merged)
      expect(counts.get("responder-r3-after-stayman-2d")).toBe(4);

      // Opener transfer accept (hearts)
      expect(counts.get("opener-transfer-accept")).toBe(1);
      expect(counts.get("opener-transfer-accept-spades")).toBe(1);

      // R3 after transfer
      expect(counts.get("responder-r3-after-transfer-hearts")).toBe(4);
      expect(counts.get("responder-r3-after-transfer-spades")).toBe(4);

      // Smolen opener placement
      expect(counts.get("opener-smolen-hearts")).toBe(2);
      expect(counts.get("opener-smolen-spades")).toBe(2);
    });

    it("total surface count across all groups", () => {
      const total = ntBundle.meaningSurfaces!.reduce(
        (sum, g) => sum + g.surfaces.length,
        0,
      );
      expect(total).toBe(36);
    });
  });

  // ── Fact extensions ─────────────────────────────────────────────
  describe("fact extensions", () => {
    it("has the expected number of fact extensions", () => {
      expect(ntBundle.factExtensions).toBeDefined();
      expect(ntBundle.factExtensions!.length).toBe(4);
    });

    it("each extension has definitions and evaluators", () => {
      for (const ext of ntBundle.factExtensions!) {
        expect(ext.definitions.length).toBeGreaterThan(0);
        expect(ext.evaluators.size).toBeGreaterThan(0);
      }
    });

    it("total fact definitions count", () => {
      const totalDefs = ntBundle.factExtensions!.reduce(
        (sum, ext) => sum + ext.definitions.length,
        0,
      );
      expect(totalDefs).toBe(17);
    });
  });

  // ── Conversation machine ────────────────────────────────────────
  describe("conversation machine", () => {
    it("has the expected machine ID", () => {
      expect(ntBundle.conversationMachine).toBeDefined();
      expect(ntBundle.conversationMachine!.machineId).toBe("nt-conversation");
    });

    it("has the expected number of states", () => {
      expect(ntBundle.conversationMachine!.states.size).toBe(21);
    });

    it("contains all expected state IDs", () => {
      const stateIds = Array.from(ntBundle.conversationMachine!.states.keys()).sort();
      expect(stateIds).toEqual([
        "idle",
        "nt-contested",
        "nt-opened",
        "opener-stayman",
        "opener-transfer-hearts",
        "opener-transfer-spades",
        "responder-r1",
        "responder-r3-stayman-2d",
        "responder-r3-stayman-2h",
        "responder-r3-stayman-2s",
        "responder-r3-transfer-hearts",
        "responder-r3-transfer-spades",
        "smolen-interrupted",
        "smolen-invoke-hearts",
        "smolen-invoke-spades",
        "smolen-scope",
        "stayman-interrupted",
        "stayman-scope",
        "terminal",
        "transfers-interrupted",
        "transfers-scope",
      ]);
    });

    it("initial state is idle", () => {
      expect(ntBundle.conversationMachine!.initialStateId).toBe("idle");
    });
  });

  // ── Explanation catalog ─────────────────────────────────────────
  describe("explanation catalog", () => {
    it("has entries", () => {
      expect(ntBundle.explanationCatalog).toBeDefined();
      expect(ntBundle.explanationCatalog!.entries.length).toBe(29);
    });
  });

  // ── Pedagogical relations ───────────────────────────────────────
  describe("pedagogical relations", () => {
    it("has the expected number of relations", () => {
      expect(ntBundle.pedagogicalRelations).toBeDefined();
      expect(ntBundle.pedagogicalRelations!.length).toBe(24);
    });
  });

  // ── Machine transitions (Smolen hookTransitions merged) ─────────
  describe("Smolen hook transitions are merged into Stayman 2D state", () => {
    it("responder-r3-stayman-2d has Smolen transitions prepended", () => {
      const state = ntBundle.conversationMachine!.states.get("responder-r3-stayman-2d");
      expect(state).toBeDefined();
      // Smolen transitions (3H→smolen-invoke-hearts, 3S→smolen-invoke-spades) are prepended
      // followed by Stayman's own transitions (3NT, 2NT, pass:self, pass:opponent, pass:partner)
      const transitions = state!.transitions;
      expect(transitions.length).toBe(7);
      expect(transitions[0]!.transitionId).toBe("r3-smolen-hearts");
      expect(transitions[1]!.transitionId).toBe("r3-smolen-spades");
      expect(transitions[2]!.transitionId).toBe("r3-3nt-after-denial");
    });
  });

  // ── Surface router ──────────────────────────────────────────────
  describe("surface router", () => {
    it("returns responder-r1 surfaces after 1NT P", () => {
      const auction = buildAuction(Seat.North, ["1NT", "P"]);
      const surfaces = ntBundle.surfaceRouter!(auction, Seat.South);
      expect(surfaces.length).toBe(5);
      const meaningIds = surfaces.map((s) => s.meaningId).sort();
      expect(meaningIds).toEqual([
        "bridge:nt-invite",
        "bridge:to-3nt",
        "stayman:ask-major",
        "transfer:to-hearts",
        "transfer:to-spades",
      ].sort());
    });

    it("returns opener Stayman response surfaces after 1NT P 2C P", () => {
      const auction = buildAuction(Seat.North, ["1NT", "P", "2C", "P"]);
      const surfaces = ntBundle.surfaceRouter!(auction, Seat.North);
      expect(surfaces.length).toBe(3);
    });

    it("returns R3 surfaces after Stayman 2D denial", () => {
      const auction = buildAuction(Seat.North, ["1NT", "P", "2C", "P", "2D", "P"]);
      const surfaces = ntBundle.surfaceRouter!(auction, Seat.South);
      expect(surfaces.length).toBe(4); // 2 Stayman + 2 Smolen
    });
  });

  // ── Idle state properties ───────────────────────────────────────
  describe("idle state", () => {
    it("has surfaceGroupId opener-1nt", () => {
      const idle = ntBundle.conversationMachine!.states.get("idle");
      expect(idle!.surfaceGroupId).toBe("opener-1nt");
    });

    it("has transition to nt-opened on 1NT", () => {
      const idle = ntBundle.conversationMachine!.states.get("idle");
      const ntTransition = idle!.transitions.find(
        (t) => t.match.kind === "call" && t.match.level === 1 && t.match.strain === BidSuit.NoTrump,
      );
      expect(ntTransition).toBeDefined();
      expect(ntTransition!.target).toBe("nt-opened");
    });
  });

  // ── Entry transition ordering ───────────────────────────────────
  describe("responder-r1 dispatch state", () => {
    it("has entry transitions from all modules", () => {
      const r1 = ntBundle.conversationMachine!.states.get("responder-r1");
      expect(r1).toBeDefined();
      // natural-nt contributes 3 (3NT, pass, 2NT), transfers 2, stayman 1 = 6
      expect(r1!.transitions.length).toBe(6);
    });
  });
});

// ── Sub-bundle golden masters ───────────────────────────────────────

describe("NT Stayman-only sub-bundle golden-master", () => {
  it("has the expected surface groups (no transfer groups)", () => {
    expect(ntStaymanBundle.meaningSurfaces).toBeDefined();
    const groupIds = ntStaymanBundle.meaningSurfaces!.map((g) => g.groupId).sort();
    expect(groupIds).not.toContain("opener-transfer-accept");
    expect(groupIds).not.toContain("responder-r3-after-transfer-hearts");
  });

  it("has responder-r1 with Stayman + natural surfaces only", () => {
    const r1Group = ntStaymanBundle.meaningSurfaces!.find((g) => g.groupId === "responder-r1");
    expect(r1Group).toBeDefined();
    const moduleIds = new Set(r1Group!.surfaces.map((s) => s.moduleId));
    expect(moduleIds).toContain("stayman");
    expect(moduleIds).toContain("natural-nt");
    expect(moduleIds).not.toContain("jacoby-transfers");
  });

  it("machine has no transfer states", () => {
    expect(ntStaymanBundle.conversationMachine).toBeDefined();
    const stateIds = Array.from(ntStaymanBundle.conversationMachine!.states.keys());
    expect(stateIds).not.toContain("opener-transfer-hearts");
    expect(stateIds).not.toContain("responder-r3-transfer-hearts");
  });
});

describe("NT Transfers-only sub-bundle golden-master", () => {
  it("has the expected surface groups (no stayman groups)", () => {
    expect(ntTransfersBundle.meaningSurfaces).toBeDefined();
    const groupIds = ntTransfersBundle.meaningSurfaces!.map((g) => g.groupId).sort();
    expect(groupIds).not.toContain("opener-stayman-response");
    expect(groupIds).not.toContain("responder-r3-after-stayman-2h");
  });

  it("has responder-r1 with transfer + natural surfaces only", () => {
    const r1Group = ntTransfersBundle.meaningSurfaces!.find((g) => g.groupId === "responder-r1");
    expect(r1Group).toBeDefined();
    const moduleIds = new Set(r1Group!.surfaces.map((s) => s.moduleId));
    expect(moduleIds).toContain("jacoby-transfers");
    expect(moduleIds).toContain("natural-nt");
    expect(moduleIds).not.toContain("stayman");
  });

  it("machine has no stayman states", () => {
    expect(ntTransfersBundle.conversationMachine).toBeDefined();
    const stateIds = Array.from(ntTransfersBundle.conversationMachine!.states.keys());
    expect(stateIds).not.toContain("opener-stayman");
    expect(stateIds).not.toContain("responder-r3-stayman-2h");
  });
});
