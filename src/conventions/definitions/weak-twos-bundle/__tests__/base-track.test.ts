import { describe, it, expect } from "vitest";
import { WEAK_TWO_BASE_TRACK, WEAK_TWO_SURFACE_FRAGMENTS } from "../base-track";
import { BidSuit } from "../../../../engine/types";

describe("Weak Two BaseTrackSpec", () => {
  // ── Identity ───────────────────────────────────────────────

  it("has correct id and name", () => {
    expect(WEAK_TWO_BASE_TRACK.id).toBe("weak-two-bids");
    expect(WEAK_TWO_BASE_TRACK.name).toBe("Weak Two Bids");
  });

  // ── Opening patterns ───────────────────────────────────────

  it("has three opening patterns (hearts, spades, diamonds)", () => {
    expect(WEAK_TWO_BASE_TRACK.openingPatterns).toHaveLength(3);
  });

  it("hearts pattern matches 2H → weak-2h-opened", () => {
    const pattern = WEAK_TWO_BASE_TRACK.openingPatterns[0]!;
    expect(pattern.prefix).toHaveLength(1);
    expect(pattern.prefix[0]!.call).toEqual({
      type: "bid",
      level: 2,
      strain: BidSuit.Hearts,
    });
    expect(pattern.startState).toBe("weak-2h-opened");
  });

  it("spades pattern matches 2S → weak-2s-opened", () => {
    const pattern = WEAK_TWO_BASE_TRACK.openingPatterns[1]!;
    expect(pattern.prefix[0]!.call).toEqual({
      type: "bid",
      level: 2,
      strain: BidSuit.Spades,
    });
    expect(pattern.startState).toBe("weak-2s-opened");
  });

  it("diamonds pattern matches 2D → weak-2d-opened", () => {
    const pattern = WEAK_TWO_BASE_TRACK.openingPatterns[2]!;
    expect(pattern.prefix[0]!.call).toEqual({
      type: "bid",
      level: 2,
      strain: BidSuit.Diamonds,
    });
    expect(pattern.startState).toBe("weak-2d-opened");
  });

  // ── States ─────────────────────────────────────────────────

  it("has all expected states", () => {
    const expectedStates = [
      // Wait states
      "weak-2h-opened",
      "weak-2s-opened",
      "weak-2d-opened",
      // R2 responder actions
      "responder-r2-h",
      "responder-r2-s",
      "responder-r2-d",
      // R3 Ogust response
      "ogust-response-h",
      "ogust-response-s",
      "ogust-response-d",
      // R4 post-Ogust
      "responder-after-ogust-h",
      "responder-after-ogust-s",
      "responder-after-ogust-d",
      // Terminal states
      "terminal",
      "weak-two-contested",
    ];
    for (const stateId of expectedStates) {
      expect(WEAK_TWO_BASE_TRACK.states[stateId], `missing state: ${stateId}`).toBeDefined();
      expect(WEAK_TWO_BASE_TRACK.states[stateId]!.id).toBe(stateId);
    }
    expect(Object.keys(WEAK_TWO_BASE_TRACK.states)).toHaveLength(expectedStates.length);
  });

  // ── Surface fragments ──────────────────────────────────────

  it("has 10 surface fragments", () => {
    // R1 opener + 3x R2 responder + 3x Ogust response + 3x post-Ogust
    expect(Object.keys(WEAK_TWO_SURFACE_FRAGMENTS)).toHaveLength(10);
  });

  it("each surface fragment has relation compete and layerPriority 100", () => {
    for (const fragment of Object.values(WEAK_TWO_SURFACE_FRAGMENTS)) {
      expect(fragment.relation).toBe("compete");
      expect(fragment.layerPriority).toBe(100);
      expect(fragment.actionCoverage).toBe("all");
    }
  });

  it("R1 opener surface fragment has 3 surfaces (one per suit)", () => {
    const r1Fragment = WEAK_TWO_SURFACE_FRAGMENTS["weak-two:opener-r1"]!;
    expect(r1Fragment.surfaces.length).toBe(3); // 2H, 2S, 2D
  });

  it("R2 responder surface fragments have 4 surfaces each", () => {
    for (const suit of ["hearts", "spades", "diamonds"] as const) {
      const fragment = WEAK_TWO_SURFACE_FRAGMENTS[`weak-two:responder-r2-${suit}`]!;
      expect(fragment.surfaces.length).toBe(4); // game raise, ogust ask, invite, pass
    }
  });

  it("Ogust response surface fragments have 5 surfaces each", () => {
    for (const suit of ["hearts", "spades", "diamonds"] as const) {
      const fragment = WEAK_TWO_SURFACE_FRAGMENTS[`weak-two:ogust-response-${suit}`]!;
      expect(fragment.surfaces.length).toBe(5); // solid, min/bad, min/good, max/bad, max/good
    }
  });

  it("states with surfaces reference valid surface fragment IDs", () => {
    for (const state of Object.values(WEAK_TWO_BASE_TRACK.states)) {
      if (state.surface) {
        expect(
          WEAK_TWO_SURFACE_FRAGMENTS[state.surface],
          `missing fragment: ${state.surface}`,
        ).toBeDefined();
      }
    }
  });

  it("has an openingSurface referencing R1 fragment", () => {
    expect(WEAK_TWO_BASE_TRACK.openingSurface).toBe("weak-two:opener-r1");
    expect(WEAK_TWO_SURFACE_FRAGMENTS["weak-two:opener-r1"]).toBeDefined();
  });

  // ── Key transitions ────────────────────────────────────────

  it("wait states route pass to responder states", () => {
    const mappings = [
      ["weak-2h-opened", "responder-r2-h"],
      ["weak-2s-opened", "responder-r2-s"],
      ["weak-2d-opened", "responder-r2-d"],
    ] as const;
    for (const [waitId, targetId] of mappings) {
      const state = WEAK_TWO_BASE_TRACK.states[waitId]!;
      const passTransition = state.eventTransitions.find(
        (t) => t.when.callType === "pass" && !t.when.actor,
      );
      expect(passTransition, `${waitId} missing pass transition`).toBeDefined();
      expect(passTransition!.goto).toBe(targetId);
    }
  });

  it("R2 hearts routes 4H (game raise) to terminal", () => {
    const state = WEAK_TWO_BASE_TRACK.states["responder-r2-h"]!;
    const t = state.eventTransitions.find((t) => t.transitionId === "r2-h-game-raise")!;
    expect(t.when.call).toEqual({ type: "bid", level: 4, strain: BidSuit.Hearts });
    expect(t.goto).toBe("terminal");
  });

  it("R2 diamonds game raise is at 5D (not 4D)", () => {
    const state = WEAK_TWO_BASE_TRACK.states["responder-r2-d"]!;
    const t = state.eventTransitions.find((t) => t.transitionId === "r2-d-game-raise")!;
    expect(t.when.call).toEqual({ type: "bid", level: 5, strain: BidSuit.Diamonds });
  });

  it("R2 routes 2NT Ogust ask to ogust-response state", () => {
    const mappings = [
      ["responder-r2-h", "ogust-response-h"],
      ["responder-r2-s", "ogust-response-s"],
      ["responder-r2-d", "ogust-response-d"],
    ] as const;
    for (const [r2Id, ogustId] of mappings) {
      const state = WEAK_TWO_BASE_TRACK.states[r2Id]!;
      const t = state.eventTransitions.find(
        (t) => t.when.call?.type === "bid" && (t.when.call as { strain: string }).strain === BidSuit.NoTrump,
      );
      expect(t, `${r2Id} missing Ogust transition`).toBeDefined();
      expect(t!.goto).toBe(ogustId);
    }
  });

  it("Ogust response states have STAY self-loop for pass", () => {
    for (const suit of ["h", "s", "d"] as const) {
      const state = WEAK_TWO_BASE_TRACK.states[`ogust-response-${suit}`]!;
      const passT = state.eventTransitions.find(
        (t) => t.when.callType === "pass" && !t.when.actor,
      );
      expect(passT).toBeDefined();
      expect(passT!.goto).toBe("STAY");
    }
  });

  it("Ogust response states route any bid to post-Ogust states", () => {
    const mappings = [
      ["ogust-response-h", "responder-after-ogust-h"],
      ["ogust-response-s", "responder-after-ogust-s"],
      ["ogust-response-d", "responder-after-ogust-d"],
    ] as const;
    for (const [ogustId, postId] of mappings) {
      const state = WEAK_TWO_BASE_TRACK.states[ogustId]!;
      // Find the non-interference bid transition (no actor restriction)
      const bidT = state.eventTransitions.find(
        (t) => t.when.callType === "bid" && !t.when.actor,
      );
      expect(bidT, `${ogustId} missing bid transition`).toBeDefined();
      expect(bidT!.goto).toBe(postId);
    }
  });

  it("every active state has interference transitions", () => {
    const activeStates = Object.values(WEAK_TWO_BASE_TRACK.states).filter(
      (s) => s.id !== "terminal" && s.id !== "weak-two-contested",
    );
    for (const state of activeStates) {
      const hasOppDouble = state.eventTransitions.some(
        (t) => t.when.actor === "opponent" && t.when.callType === "double",
      );
      const hasOppBid = state.eventTransitions.some(
        (t) => t.when.actor === "opponent" && t.when.callType === "bid",
      );
      expect(hasOppDouble, `${state.id} missing opp-double`).toBe(true);
      expect(hasOppBid, `${state.id} missing opp-bid`).toBe(true);
    }
  });

  // ── Effects ────────────────────────────────────────────────

  it("wait states set agreed strain on entry", () => {
    const suitMap = { h: "hearts", s: "spades", d: "diamonds" } as const;
    for (const [key, suit] of Object.entries(suitMap)) {
      const state = WEAK_TWO_BASE_TRACK.states[`weak-2${key}-opened`]!;
      const strainEffect = state.onEnter!.find(
        (e) => e.op === "setReg" && (e as { path: string }).path === "agreement.strain",
      );
      expect(strainEffect, `weak-2${key}-opened missing strain effect`).toBeDefined();
      expect((strainEffect as { value: { suit: string } }).value.suit).toBe(suit);
    }
  });

  it("game raise transitions export agreement.final tag", () => {
    const state = WEAK_TWO_BASE_TRACK.states["responder-r2-h"]!;
    const t = state.eventTransitions.find((t) => t.transitionId === "r2-h-game-raise")!;
    expect(t.effects!.some(
      (e) => e.op === "exportTag" && (e as { tag: string }).tag === "agreement.final",
    )).toBe(true);
  });

  it("Ogust ask transition exports verification.available tag", () => {
    const state = WEAK_TWO_BASE_TRACK.states["responder-r2-h"]!;
    const t = state.eventTransitions.find((t) => t.transitionId === "r2-h-ogust-ask")!;
    expect(t.effects!.some(
      (e) => e.op === "exportTag" && (e as { tag: string }).tag === "verification.available",
    )).toBe(true);
  });

  // ── Facts ──────────────────────────────────────────────────

  it("references weakTwoFacts catalog extension", () => {
    expect(WEAK_TWO_BASE_TRACK.facts).toBeDefined();
    expect(WEAK_TWO_BASE_TRACK.facts.definitions.length).toBeGreaterThan(0);
  });
});
