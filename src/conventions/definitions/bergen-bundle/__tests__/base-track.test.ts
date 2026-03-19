import { describe, it, expect } from "vitest";
import { BERGEN_BASE_TRACK, BERGEN_SURFACE_FRAGMENTS } from "../base-track";
import { BidSuit } from "../../../../engine/types";

describe("Bergen BaseTrackSpec", () => {
  // ── Identity ───────────────────────────────────────────────

  it("has correct id and name", () => {
    expect(BERGEN_BASE_TRACK.id).toBe("bergen-raises");
    expect(BERGEN_BASE_TRACK.name).toBe("Bergen Raises");
  });

  // ── Opening patterns ───────────────────────────────────────

  it("has two opening patterns (hearts and spades)", () => {
    expect(BERGEN_BASE_TRACK.openingPatterns).toHaveLength(2);
  });

  it("hearts pattern matches 1H-P → responder-r1-hearts", () => {
    const pattern = BERGEN_BASE_TRACK.openingPatterns[0]!;
    expect(pattern.prefix).toHaveLength(2);
    expect(pattern.prefix[0]!.call).toEqual({
      type: "bid",
      level: 1,
      strain: BidSuit.Hearts,
    });
    expect(pattern.prefix[1]!.callType).toBe("pass");
    expect(pattern.startState).toBe("responder-r1-hearts");
  });

  it("spades pattern matches 1S-P → responder-r1-spades", () => {
    const pattern = BERGEN_BASE_TRACK.openingPatterns[1]!;
    expect(pattern.prefix).toHaveLength(2);
    expect(pattern.prefix[0]!.call).toEqual({
      type: "bid",
      level: 1,
      strain: BidSuit.Spades,
    });
    expect(pattern.prefix[1]!.callType).toBe("pass");
    expect(pattern.startState).toBe("responder-r1-spades");
  });

  // ── States ─────────────────────────────────────────────────

  it("has all expected states", () => {
    const expectedStates = [
      // R1 dispatch
      "responder-r1-hearts",
      "responder-r1-spades",
      // R2 opener rebids
      "opener-after-constructive-hearts",
      "opener-after-constructive-spades",
      "opener-after-limit-hearts",
      "opener-after-limit-spades",
      "opener-after-preemptive-hearts",
      "opener-after-preemptive-spades",
      // R3 responder continuations
      "responder-after-game",
      "responder-after-signoff",
      "responder-after-game-try-hearts",
      "responder-after-game-try-spades",
      // R4 opener accepts
      "opener-r4-accept",
      // Terminal states
      "terminal",
      "bergen-contested",
    ];
    for (const stateId of expectedStates) {
      expect(BERGEN_BASE_TRACK.states[stateId], `missing state: ${stateId}`).toBeDefined();
      expect(BERGEN_BASE_TRACK.states[stateId]!.id).toBe(stateId);
    }
    expect(Object.keys(BERGEN_BASE_TRACK.states)).toHaveLength(expectedStates.length);
  });

  // ── Surface fragments ──────────────────────────────────────

  it("has 13 surface fragments (all surfaced states)", () => {
    expect(Object.keys(BERGEN_SURFACE_FRAGMENTS)).toHaveLength(13);
  });

  it("each surface fragment has relation compete and layerPriority 100", () => {
    for (const fragment of Object.values(BERGEN_SURFACE_FRAGMENTS)) {
      expect(fragment.relation).toBe("compete");
      expect(fragment.layerPriority).toBe(100);
      expect(fragment.actionCoverage).toBe("all");
    }
  });

  it("R1 surface fragments contain actual meaning surfaces", () => {
    const heartsFragment = BERGEN_SURFACE_FRAGMENTS["bergen:responder-r1-hearts"]!;
    expect(heartsFragment.surfaces.length).toBe(5); // splinter, game, limit, constructive, preemptive

    const spadesFragment = BERGEN_SURFACE_FRAGMENTS["bergen:responder-r1-spades"]!;
    expect(spadesFragment.surfaces.length).toBe(5);
  });

  it("R4 surface fragment contains accept-after-try surface", () => {
    const r4Fragment = BERGEN_SURFACE_FRAGMENTS["bergen:opener-r4-accept"]!;
    expect(r4Fragment.surfaces.length).toBe(1);
  });

  it("states with surfaces reference valid surface fragment IDs", () => {
    for (const state of Object.values(BERGEN_BASE_TRACK.states)) {
      if (state.surface) {
        expect(
          BERGEN_SURFACE_FRAGMENTS[state.surface],
          `missing fragment: ${state.surface}`,
        ).toBeDefined();
      }
    }
  });

  // ── Key transitions ────────────────────────────────────────

  it("R1 hearts has 5 Bergen responses + pass + 2 interference", () => {
    const r1 = BERGEN_BASE_TRACK.states["responder-r1-hearts"]!;
    expect(r1.eventTransitions.length).toBe(8); // 5 bids + pass + 2 interference

    const ids = r1.eventTransitions.map((t) => t.transitionId);
    expect(ids).toContain("r1-hearts-constructive");
    expect(ids).toContain("r1-hearts-limit");
    expect(ids).toContain("r1-hearts-preemptive");
    expect(ids).toContain("r1-hearts-splinter");
    expect(ids).toContain("r1-hearts-game");
    expect(ids).toContain("r1-hearts-pass");
  });

  it("constructive raise → opener-after-constructive-hearts", () => {
    const r1 = BERGEN_BASE_TRACK.states["responder-r1-hearts"]!;
    const t = r1.eventTransitions.find((t) => t.transitionId === "r1-hearts-constructive")!;
    expect(t.when.call).toEqual({ type: "bid", level: 3, strain: BidSuit.Clubs });
    expect(t.goto).toBe("opener-after-constructive-hearts");
  });

  it("splinter and game raise → terminal with agreement.final tag", () => {
    const r1 = BERGEN_BASE_TRACK.states["responder-r1-hearts"]!;

    const splinter = r1.eventTransitions.find((t) => t.transitionId === "r1-hearts-splinter")!;
    expect(splinter.goto).toBe("terminal");
    expect(splinter.effects).toBeDefined();
    expect(splinter.effects!.some((e) => e.op === "exportTag" && (e as { tag: string }).tag === "agreement.final")).toBe(true);

    const game = r1.eventTransitions.find((t) => t.transitionId === "r1-hearts-game")!;
    expect(game.goto).toBe("terminal");
    expect(game.effects!.some((e) => e.op === "exportTag" && (e as { tag: string }).tag === "agreement.final")).toBe(true);
  });

  it("every active state has interference transitions", () => {
    const activeStates = Object.values(BERGEN_BASE_TRACK.states).filter(
      (s) => s.id !== "terminal" && s.id !== "bergen-contested",
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

  it("R2 states have STAY self-loop for pass", () => {
    const r2States = [
      "opener-after-constructive-hearts",
      "opener-after-constructive-spades",
      "opener-after-limit-hearts",
      "opener-after-limit-spades",
      "opener-after-preemptive-hearts",
      "opener-after-preemptive-spades",
    ];
    for (const stateId of r2States) {
      const state = BERGEN_BASE_TRACK.states[stateId]!;
      const passTransition = state.eventTransitions.find(
        (t) => t.when.callType === "pass" && !t.when.actor,
      );
      expect(passTransition, `${stateId} missing pass self-loop`).toBeDefined();
      expect(passTransition!.goto).toBe("STAY");
    }
  });

  it("opener-after-constructive-hearts routes game try to responder-after-game-try-hearts", () => {
    const state = BERGEN_BASE_TRACK.states["opener-after-constructive-hearts"]!;
    const gameTry = state.eventTransitions.find(
      (t) => t.transitionId === "constructive-hearts-game-try",
    )!;
    expect(gameTry.when.callType).toBe("bid");
    expect(gameTry.goto).toBe("responder-after-game-try-hearts");
  });

  it("game-try states route bids to opener-r4-accept", () => {
    const heartsState = BERGEN_BASE_TRACK.states["responder-after-game-try-hearts"]!;
    const bidTransition = heartsState.eventTransitions.find(
      (t) => t.transitionId === "game-try-hearts-bid",
    )!;
    expect(bidTransition.goto).toBe("opener-r4-accept");
  });

  // ── Effects ────────────────────────────────────────────────

  it("R1 states set captain to responder on entry", () => {
    const r1Hearts = BERGEN_BASE_TRACK.states["responder-r1-hearts"]!;
    expect(r1Hearts.onEnter).toBeDefined();
    expect(r1Hearts.onEnter!.some(
      (e) => e.op === "setReg" && (e as { path: string }).path === "captain.side",
    )).toBe(true);
  });

  it("R2 states set captain to opener on entry", () => {
    const state = BERGEN_BASE_TRACK.states["opener-after-constructive-hearts"]!;
    expect(state.onEnter!.some(
      (e) => e.op === "setReg"
        && (e as { path: string }).path === "captain.side"
        && (e as { value: unknown }).value === "opener",
    )).toBe(true);
  });

  it("responder-after-game and responder-after-signoff export agreement.final tag", () => {
    expect(BERGEN_BASE_TRACK.states["responder-after-game"]!.exportTags).toContain("agreement.final");
    expect(BERGEN_BASE_TRACK.states["responder-after-signoff"]!.exportTags).toContain("agreement.final");
  });

  it("bergen-contested sets competition mode on entry", () => {
    const state = BERGEN_BASE_TRACK.states["bergen-contested"]!;
    expect(state.onEnter!.some(
      (e) => e.op === "setReg" && (e as { path: string }).path === "competition.mode",
    )).toBe(true);
  });

  // ── Facts ──────────────────────────────────────────────────

  it("references bergenFacts catalog extension", () => {
    expect(BERGEN_BASE_TRACK.facts).toBeDefined();
    expect(BERGEN_BASE_TRACK.facts.definitions.length).toBeGreaterThan(0);
  });
});
