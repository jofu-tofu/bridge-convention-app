import { describe, it, expect } from "vitest";
import { ntBaseTrack, NT_SURFACE_FRAGMENTS } from "../base-track";
import { BidSuit } from "../../../../engine/types";
import type { TransitionSpec, EffectSpec } from "../../../core/protocol/types";

// ── Helpers ──────────────────────────────────────────────────────────

/** Find a transition in a state by matching a specific call pattern. */
function findBidTransition(
  transitions: readonly TransitionSpec[],
  level: number,
  strain: BidSuit,
): TransitionSpec | undefined {
  return transitions.find(
    (t) =>
      t.when.call?.type === "bid" &&
      t.when.call?.level === level &&
      (t.when.call as { strain: string }).strain === strain,
  );
}

/** Find a transition by callType. */
function findCallTypeTransition(
  transitions: readonly TransitionSpec[],
  callType: string,
): TransitionSpec | undefined {
  return transitions.find(
    (t) => t.when.callType === callType && !t.when.actor && !t.when.call,
  );
}

// ── Tests ────────────────────────────────────────────────────────────

describe("ntBaseTrack", () => {

  // ── Opening pattern ──────────────────────────────────────────

  describe("opening pattern", () => {
    it("has exactly one opening pattern for 1NT", () => {
      expect(ntBaseTrack.openingPatterns).toHaveLength(1);
      const pattern = ntBaseTrack.openingPatterns[0]!;
      expect(pattern.prefix).toHaveLength(1);
      expect(pattern.prefix[0]!.call).toEqual({
        type: "bid",
        level: 1,
        strain: BidSuit.NoTrump,
      });
      expect(pattern.startState).toBe("nt-opened");
    });

    it("sets the opening surface to the opener-1nt fragment", () => {
      expect(ntBaseTrack.openingSurface).toBe("sf:opener-1nt");
    });

    it("has initialStateId matching the opening pattern startState", () => {
      expect(ntBaseTrack.initialStateId).toBe("nt-opened");
    });
  });

  // ── States ───────────────────────────────────────────────────

  describe("states", () => {
    const expectedStates = [
      // Core skeleton
      "nt-opened",
      "responder-r1",
      "terminal",
      "nt-contested",
      // Stayman
      "opener-stayman",
      "responder-r3-stayman-2h",
      "responder-r3-stayman-2s",
      "responder-r3-stayman-2d",
      "stayman-interrupted",
      // Jacoby Transfers
      "opener-transfer-hearts",
      "opener-transfer-spades",
      "responder-r3-transfer-hearts",
      "responder-r3-transfer-spades",
      "transfers-interrupted",
      // Smolen (inlined from submachine)
      "smolen-invoke-hearts",
      "smolen-invoke-spades",
      "opener-place-hearts",
      "opener-place-spades",
      "smolen-interrupted",
    ];

    it("contains all expected states", () => {
      for (const stateId of expectedStates) {
        expect(
          ntBaseTrack.states[stateId],
          `missing state: ${stateId}`,
        ).toBeDefined();
      }
    });

    it("every state has a matching id field", () => {
      for (const [key, state] of Object.entries(ntBaseTrack.states)) {
        expect(state.id).toBe(key);
      }
    });
  });

  // ── responder-r1 transitions ─────────────────────────────────

  describe("responder-r1 transitions", () => {
    const r1 = ntBaseTrack.states["responder-r1"]!;

    it("has a Stayman transition on 2C", () => {
      const t = findBidTransition(r1.eventTransitions, 2, BidSuit.Clubs);
      expect(t).toBeDefined();
      expect(t!.goto).toBe("opener-stayman");
    });

    it("has Jacoby transfer to hearts on 2D", () => {
      const t = findBidTransition(r1.eventTransitions, 2, BidSuit.Diamonds);
      expect(t).toBeDefined();
      expect(t!.goto).toBe("opener-transfer-hearts");
    });

    it("has Jacoby transfer to spades on 2H", () => {
      const t = findBidTransition(r1.eventTransitions, 2, BidSuit.Hearts);
      expect(t).toBeDefined();
      expect(t!.goto).toBe("opener-transfer-spades");
    });

    it("has natural 3NT to terminal", () => {
      const t = findBidTransition(r1.eventTransitions, 3, BidSuit.NoTrump);
      expect(t).toBeDefined();
      expect(t!.goto).toBe("terminal");
    });

    it("has natural 2NT invite to terminal", () => {
      const t = findBidTransition(r1.eventTransitions, 2, BidSuit.NoTrump);
      expect(t).toBeDefined();
      expect(t!.goto).toBe("terminal");
    });

    it("has pass to terminal", () => {
      const t = findCallTypeTransition(r1.eventTransitions, "pass");
      expect(t).toBeDefined();
      expect(t!.goto).toBe("terminal");
    });

    it("has opponent interrupt to nt-contested", () => {
      const t = r1.eventTransitions.find(
        (t) => t.when.actor === "opponent" && !t.when.callType && !t.when.call,
      );
      expect(t).toBeDefined();
      expect(t!.goto).toBe("nt-contested");
    });
  });

  // ── Stayman continuation transitions ──────────────────────────

  describe("opener-stayman transitions", () => {
    const state = ntBaseTrack.states["opener-stayman"]!;

    it("transitions to r3-2h on 2H", () => {
      const t = findBidTransition(state.eventTransitions, 2, BidSuit.Hearts);
      expect(t!.goto).toBe("responder-r3-stayman-2h");
    });

    it("transitions to r3-2s on 2S", () => {
      const t = findBidTransition(state.eventTransitions, 2, BidSuit.Spades);
      expect(t!.goto).toBe("responder-r3-stayman-2s");
    });

    it("transitions to r3-2d on 2D", () => {
      const t = findBidTransition(state.eventTransitions, 2, BidSuit.Diamonds);
      expect(t!.goto).toBe("responder-r3-stayman-2d");
    });
  });

  describe("responder-r3-stayman-2d includes Smolen hooks", () => {
    const state = ntBaseTrack.states["responder-r3-stayman-2d"]!;

    it("has 3H → smolen-invoke-hearts", () => {
      const t = findBidTransition(state.eventTransitions, 3, BidSuit.Hearts);
      expect(t).toBeDefined();
      expect(t!.goto).toBe("smolen-invoke-hearts");
    });

    it("has 3S → smolen-invoke-spades", () => {
      const t = findBidTransition(state.eventTransitions, 3, BidSuit.Spades);
      expect(t).toBeDefined();
      expect(t!.goto).toBe("smolen-invoke-spades");
    });
  });

  // ── Surface fragments ─────────────────────────────────────────

  describe("surface fragments", () => {
    it("references correct surfaces for responder-r1", () => {
      const r1 = ntBaseTrack.states["responder-r1"]!;
      expect(r1.surface).toBe("sf:responder-r1");
      const frag = NT_SURFACE_FRAGMENTS["sf:responder-r1"]!;
      expect(frag).toBeDefined();
      expect(frag.surfaces.length).toBeGreaterThan(0);
    });

    it("opener-stayman references the stayman response surface", () => {
      const state = ntBaseTrack.states["opener-stayman"]!;
      expect(state.surface).toBe("sf:opener-stayman-response");
      const frag = NT_SURFACE_FRAGMENTS["sf:opener-stayman-response"]!;
      expect(frag).toBeDefined();
      // Show hearts, show spades, deny major
      expect(frag.surfaces).toHaveLength(3);
    });

    it("transfer accept states have surfaces", () => {
      expect(
        NT_SURFACE_FRAGMENTS["sf:opener-transfer-accept"]!.surfaces.length,
      ).toBeGreaterThan(0);
      expect(
        NT_SURFACE_FRAGMENTS["sf:opener-transfer-accept-spades"]!.surfaces.length,
      ).toBeGreaterThan(0);
    });

    it("Smolen placement states reference opener-smolen fragments", () => {
      expect(ntBaseTrack.states["opener-place-hearts"]!.surface).toBe(
        "sf:opener-smolen-hearts",
      );
      expect(ntBaseTrack.states["opener-place-spades"]!.surface).toBe(
        "sf:opener-smolen-spades",
      );
      expect(
        NT_SURFACE_FRAGMENTS["sf:opener-smolen-hearts"]!.surfaces.length,
      ).toBeGreaterThan(0);
      expect(
        NT_SURFACE_FRAGMENTS["sf:opener-smolen-spades"]!.surfaces.length,
      ).toBeGreaterThan(0);
    });

    it("all fragments use compete relation and base layer priority 100", () => {
      for (const [id, frag] of Object.entries(NT_SURFACE_FRAGMENTS)) {
        expect(frag.relation, `${id} relation`).toBe("compete");
        expect(frag.layerPriority, `${id} priority`).toBe(100);
      }
    });

    it("every state.surface ID exists in NT_SURFACE_FRAGMENTS", () => {
      for (const [stateId, state] of Object.entries(ntBaseTrack.states)) {
        if (state.surface) {
          expect(
            NT_SURFACE_FRAGMENTS[state.surface],
            `state ${stateId} references undefined surface ${state.surface}`,
          ).toBeDefined();
        }
      }
    });
  });

  // ── Entry effects (register writes) ───────────────────────────

  describe("entry effects", () => {
    it("responder-r1 sets captain to responder", () => {
      const r1 = ntBaseTrack.states["responder-r1"]!;
      expect(r1.onEnter).toContainEqual({
        op: "setReg",
        path: "captain.side",
        value: "responder",
      });
    });

    it("opener-stayman sets obligation.kind to ShowMajor", () => {
      const state = ntBaseTrack.states["opener-stayman"]!;
      expect(state.onEnter).toContainEqual({
        op: "setReg",
        path: "obligation.kind",
        value: "ShowMajor",
      });
    });

    it("opener-stayman sets obligation.side to opener", () => {
      const state = ntBaseTrack.states["opener-stayman"]!;
      expect(state.onEnter).toContainEqual({
        op: "setReg",
        path: "obligation.side",
        value: "opener",
      });
    });

    it("nt-contested sets competition.mode to doubled", () => {
      const state = ntBaseTrack.states["nt-contested"]!;
      expect(state.onEnter).toContainEqual({
        op: "setReg",
        path: "competition.mode",
        value: "doubled",
      });
    });

    it("stayman-interrupted sets competition.mode to contested", () => {
      const state = ntBaseTrack.states["stayman-interrupted"]!;
      expect(state.onEnter).toContainEqual({
        op: "setReg",
        path: "competition.mode",
        value: "contested",
      });
    });

    it("opener-transfer-hearts sets agreement strain to hearts", () => {
      const state = ntBaseTrack.states["opener-transfer-hearts"]!;
      expect(state.onEnter).toContainEqual({
        op: "setReg",
        path: "agreement.strain",
        value: { type: "suit", suit: "hearts" },
      });
      expect(state.onEnter).toContainEqual({
        op: "setReg",
        path: "agreement.status",
        value: "tentative",
      });
    });

    it("smolen-invoke-hearts sets forcing state to game", () => {
      const state = ntBaseTrack.states["smolen-invoke-hearts"]!;
      expect(state.onEnter).toContainEqual({
        op: "setReg",
        path: "forcing.state",
        value: "game",
      });
    });

    it("opener-place-hearts sets captain to opener", () => {
      const state = ntBaseTrack.states["opener-place-hearts"]!;
      expect(state.onEnter).toContainEqual({
        op: "setReg",
        path: "captain.side",
        value: "opener",
      });
    });
  });

  // ── Tags ──────────────────────────────────────────────────────

  describe("semantic tags", () => {
    it("responder-r1 exports agreement.pending", () => {
      expect(ntBaseTrack.states["responder-r1"]!.exportTags).toContain(
        "agreement.pending",
      );
    });

    it("opener-stayman exports agreement.pending", () => {
      expect(ntBaseTrack.states["opener-stayman"]!.exportTags).toContain(
        "agreement.pending",
      );
    });

    it("transfer accept states export agreement.tentative", () => {
      expect(
        ntBaseTrack.states["opener-transfer-hearts"]!.exportTags,
      ).toContain("agreement.tentative");
      expect(
        ntBaseTrack.states["opener-transfer-spades"]!.exportTags,
      ).toContain("agreement.tentative");
    });

    it("Smolen placement states export agreement.final", () => {
      expect(ntBaseTrack.states["opener-place-hearts"]!.exportTags).toContain(
        "agreement.final",
      );
      expect(ntBaseTrack.states["opener-place-spades"]!.exportTags).toContain(
        "agreement.final",
      );
    });

    it("terminal has no export tags", () => {
      expect(
        ntBaseTrack.states["terminal"]!.exportTags,
      ).toBeUndefined();
    });
  });

  // ── State walk ────────────────────────────────────────────────

  describe("state walk: opening → nt-opened → responder-r1 → opener-stayman", () => {
    it("follows the correct path through the spec", () => {
      // 1. Opening pattern selects this track, entering nt-opened
      const pattern = ntBaseTrack.openingPatterns[0]!;
      expect(pattern.startState).toBe("nt-opened");
      const startState = ntBaseTrack.states[pattern.startState]!;
      expect(startState).toBeDefined();

      // 2. Opponent passes → nt-opened transitions to responder-r1
      const passTransition = startState.eventTransitions.find(
        (t) => t.when.callType === "pass",
      );
      expect(passTransition).toBeDefined();
      expect(passTransition!.goto).toBe("responder-r1");
      const r1State = ntBaseTrack.states[passTransition!.goto as string]!;
      expect(r1State).toBeDefined();

      // 3. Responder bids 2C → responder-r1 transitions to opener-stayman
      const staymanTransition = findBidTransition(
        r1State.eventTransitions,
        2,
        BidSuit.Clubs,
      );
      expect(staymanTransition).toBeDefined();
      expect(staymanTransition!.goto).toBe("opener-stayman");
      const staymanState =
        ntBaseTrack.states[staymanTransition!.goto as string]!;
      expect(staymanState).toBeDefined();

      // 4. Verify the final state has the expected surface and effects
      expect(staymanState.surface).toBe("sf:opener-stayman-response");
      expect(staymanState.onEnter).toBeDefined();
      expect(staymanState.onEnter!.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── Facts ─────────────────────────────────────────────────────

  describe("merged facts", () => {
    it("includes fact definitions from all modules", () => {
      const factIds = ntBaseTrack.facts.definitions.map((d) => d.id);
      // natural-nt facts are now system-level (system.responder.*), not module-level
      // From stayman
      expect(factIds).toContain("module.stayman.eligible");
      // From jacoby-transfers
      expect(factIds).toContain("module.transfer.targetSuit");
      // From smolen
      expect(factIds).toContain("module.smolen.hasFiveHearts");
    });

    it("includes evaluators from all modules", () => {
      // natural-nt evaluators are now system-level, not module-level
      expect(
        ntBaseTrack.facts.evaluators.has("module.stayman.eligible"),
      ).toBe(true);
      expect(
        ntBaseTrack.facts.evaluators.has("module.transfer.targetSuit"),
      ).toBe(true);
      expect(
        ntBaseTrack.facts.evaluators.has("module.smolen.hasFiveHearts"),
      ).toBe(true);
    });

    it("includes posterior evaluators from stayman", () => {
      expect(ntBaseTrack.facts.posteriorEvaluators).toBeDefined();
    });
  });
});
