import { describe, it, expect } from "vitest";
import { DONT_BASE_TRACK, DONT_SURFACE_FRAGMENTS } from "../base-track";
import { BidSuit } from "../../../../engine/types";

describe("DONT BaseTrackSpec", () => {
  // ── Identity ───────────────────────────────────────────────

  it("has correct id and name", () => {
    expect(DONT_BASE_TRACK.id).toBe("dont");
    expect(DONT_BASE_TRACK.name).toBe("DONT (Disturb Opponents' No Trump)");
  });

  // ── Opening patterns ───────────────────────────────────────

  it("has one opening pattern (opponent 1NT)", () => {
    expect(DONT_BASE_TRACK.openingPatterns).toHaveLength(1);
  });

  it("pattern matches opponent 1NT → overcaller-r1", () => {
    const pattern = DONT_BASE_TRACK.openingPatterns[0]!;
    expect(pattern.prefix).toHaveLength(1);
    expect(pattern.prefix[0]!.actor).toBe("opponent");
    expect(pattern.prefix[0]!.call).toEqual({
      type: "bid",
      level: 1,
      strain: BidSuit.NoTrump,
    });
    expect(pattern.startState).toBe("overcaller-r1");
  });

  // ── States ─────────────────────────────────────────────────

  it("has all expected states", () => {
    const expectedStates = [
      // R1 dispatch
      "overcaller-r1",
      // Wait states (opponent passes through)
      "wait-advancer-2h",
      "wait-advancer-2d",
      "wait-advancer-2c",
      "wait-advancer-2s",
      "wait-advancer-double",
      // Advancer responses
      "advancer-after-2h",
      "advancer-after-2d",
      "advancer-after-2c",
      "advancer-after-2s",
      "advancer-after-double",
      // Relay wait states
      "wait-reveal",
      "wait-2d-relay",
      "wait-2c-relay",
      // Overcaller reveal
      "overcaller-reveal",
      "overcaller-2d-relay",
      "overcaller-2c-relay",
      // Terminal states
      "terminal",
      "dont-contested",
    ];
    for (const stateId of expectedStates) {
      expect(DONT_BASE_TRACK.states[stateId], `missing state: ${stateId}`).toBeDefined();
      expect(DONT_BASE_TRACK.states[stateId]!.id).toBe(stateId);
    }
    expect(Object.keys(DONT_BASE_TRACK.states)).toHaveLength(expectedStates.length);
  });

  // ── Surface fragments ──────────────────────────────────────

  it("has 9 surface fragments", () => {
    // R1 overcaller + 5 advancer + 1 reveal + 2 relay
    expect(Object.keys(DONT_SURFACE_FRAGMENTS)).toHaveLength(9);
  });

  it("each surface fragment has relation compete and layerPriority 100", () => {
    for (const fragment of Object.values(DONT_SURFACE_FRAGMENTS)) {
      expect(fragment.relation).toBe("compete");
      expect(fragment.layerPriority).toBe(100);
      expect(fragment.actionCoverage).toBe("all");
    }
  });

  it("R1 surface has 6 surfaces (2H/2D/2C/2S/X/Pass)", () => {
    const fragment = DONT_SURFACE_FRAGMENTS["dont:overcaller-r1"]!;
    expect(fragment.surfaces.length).toBe(6);
  });

  it("advancer-after-2h surface has 4 surfaces", () => {
    const fragment = DONT_SURFACE_FRAGMENTS["dont:advancer-after-2h"]!;
    expect(fragment.surfaces.length).toBe(4); // accept hearts, prefer spades, escape clubs, escape diamonds
  });

  it("advancer-after-double surface has 1 surface (forced relay)", () => {
    const fragment = DONT_SURFACE_FRAGMENTS["dont:advancer-after-double"]!;
    expect(fragment.surfaces.length).toBe(1);
  });

  it("reveal surface has 3 surfaces (clubs/diamonds/hearts)", () => {
    const fragment = DONT_SURFACE_FRAGMENTS["dont:overcaller-reveal"]!;
    expect(fragment.surfaces.length).toBe(3);
  });

  it("2d-relay surface has 2 surfaces (hearts/spades)", () => {
    const fragment = DONT_SURFACE_FRAGMENTS["dont:overcaller-2d-relay"]!;
    expect(fragment.surfaces.length).toBe(2);
  });

  it("2c-relay surface has 3 surfaces (diamonds/hearts/spades)", () => {
    const fragment = DONT_SURFACE_FRAGMENTS["dont:overcaller-2c-relay"]!;
    expect(fragment.surfaces.length).toBe(3);
  });

  it("states with surfaces reference valid surface fragment IDs", () => {
    for (const state of Object.values(DONT_BASE_TRACK.states)) {
      if (state.surface) {
        expect(
          DONT_SURFACE_FRAGMENTS[state.surface],
          `missing fragment: ${state.surface}`,
        ).toBeDefined();
      }
    }
  });

  // ── Key transitions ────────────────────────────────────────

  it("overcaller-r1 has all 6 DONT action transitions + 2 interference", () => {
    const r1 = DONT_BASE_TRACK.states["overcaller-r1"]!;
    expect(r1.eventTransitions.length).toBe(8);

    const ids = r1.eventTransitions.map((t) => t.transitionId);
    expect(ids).toContain("r1-2h");
    expect(ids).toContain("r1-2d");
    expect(ids).toContain("r1-2c");
    expect(ids).toContain("r1-2s");
    expect(ids).toContain("r1-double");
    expect(ids).toContain("r1-pass");
  });

  it("R1 routes 2H to wait-advancer-2h", () => {
    const r1 = DONT_BASE_TRACK.states["overcaller-r1"]!;
    const t = r1.eventTransitions.find((t) => t.transitionId === "r1-2h")!;
    expect(t.when.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Hearts });
    expect(t.goto).toBe("wait-advancer-2h");
  });

  it("R1 routes double to wait-advancer-double", () => {
    const r1 = DONT_BASE_TRACK.states["overcaller-r1"]!;
    const t = r1.eventTransitions.find((t) => t.transitionId === "r1-double")!;
    expect(t.when.callType).toBe("double");
    expect(t.goto).toBe("wait-advancer-double");
  });

  it("R1 routes pass to terminal", () => {
    const r1 = DONT_BASE_TRACK.states["overcaller-r1"]!;
    const t = r1.eventTransitions.find((t) => t.transitionId === "r1-pass")!;
    expect(t.goto).toBe("terminal");
  });

  it("wait states route pass to advancer states", () => {
    const mappings = [
      ["wait-advancer-2h", "advancer-after-2h"],
      ["wait-advancer-2d", "advancer-after-2d"],
      ["wait-advancer-2c", "advancer-after-2c"],
      ["wait-advancer-2s", "advancer-after-2s"],
      ["wait-advancer-double", "advancer-after-double"],
    ] as const;
    for (const [waitId, targetId] of mappings) {
      const state = DONT_BASE_TRACK.states[waitId]!;
      const passT = state.eventTransitions.find(
        (t) => t.when.callType === "pass" && !t.when.actor,
      );
      expect(passT, `${waitId} missing pass transition`).toBeDefined();
      expect(passT!.goto).toBe(targetId);
    }
  });

  it("advancer-after-2d routes 2H relay to wait-2d-relay", () => {
    const state = DONT_BASE_TRACK.states["advancer-after-2d"]!;
    const t = state.eventTransitions.find((t) => t.transitionId === "adv-2d-2h-relay")!;
    expect(t.when.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Hearts });
    expect(t.goto).toBe("wait-2d-relay");
  });

  it("advancer-after-2c routes 2D relay to wait-2c-relay", () => {
    const state = DONT_BASE_TRACK.states["advancer-after-2c"]!;
    const t = state.eventTransitions.find((t) => t.transitionId === "adv-2c-2d-relay")!;
    expect(t.when.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Diamonds });
    expect(t.goto).toBe("wait-2c-relay");
  });

  it("advancer-after-double routes 2C relay to wait-reveal", () => {
    const state = DONT_BASE_TRACK.states["advancer-after-double"]!;
    const t = state.eventTransitions.find((t) => t.transitionId === "adv-dbl-2c-relay")!;
    expect(t.when.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Clubs });
    expect(t.goto).toBe("wait-reveal");
  });

  it("relay wait states route pass to overcaller reveal states", () => {
    const mappings = [
      ["wait-reveal", "overcaller-reveal"],
      ["wait-2d-relay", "overcaller-2d-relay"],
      ["wait-2c-relay", "overcaller-2c-relay"],
    ] as const;
    for (const [waitId, targetId] of mappings) {
      const state = DONT_BASE_TRACK.states[waitId]!;
      const passT = state.eventTransitions.find(
        (t) => t.when.callType === "pass" && !t.when.actor,
      );
      expect(passT, `${waitId} missing pass transition`).toBeDefined();
      expect(passT!.goto).toBe(targetId);
    }
  });

  it("overcaller-2c-relay has specific 2H and 2S transitions plus catchall", () => {
    const state = DONT_BASE_TRACK.states["overcaller-2c-relay"]!;
    const ids = state.eventTransitions.map((t) => t.transitionId);
    expect(ids).toContain("2c-relay-pass");
    expect(ids).toContain("2c-relay-2h");
    expect(ids).toContain("2c-relay-2s");
    expect(ids).toContain("2c-relay-any");
  });

  it("every active state has interference transitions", () => {
    const activeStates = Object.values(DONT_BASE_TRACK.states).filter(
      (s) => s.id !== "terminal" && s.id !== "dont-contested",
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

  it("overcaller-r1 sets competition mode on entry", () => {
    const state = DONT_BASE_TRACK.states["overcaller-r1"]!;
    expect(state.onEnter!.some(
      (e) => e.op === "setReg"
        && (e as { path: string }).path === "competition.mode"
        && (e as { value: unknown }).value === "contested",
    )).toBe(true);
  });

  it("dont-contested sets competition mode to doubled on entry", () => {
    const state = DONT_BASE_TRACK.states["dont-contested"]!;
    expect(state.onEnter!.some(
      (e) => e.op === "setReg"
        && (e as { path: string }).path === "competition.mode"
        && (e as { value: unknown }).value === "doubled",
    )).toBe(true);
  });

  it("advancer states set captain to responder on entry", () => {
    const advancerStates = [
      "advancer-after-2h",
      "advancer-after-2d",
      "advancer-after-2c",
      "advancer-after-2s",
      "advancer-after-double",
    ];
    for (const stateId of advancerStates) {
      const state = DONT_BASE_TRACK.states[stateId]!;
      expect(
        state.onEnter!.some(
          (e) => e.op === "setReg"
            && (e as { path: string }).path === "captain.side"
            && (e as { value: unknown }).value === "responder",
        ),
        `${stateId} missing captain=responder`,
      ).toBe(true);
    }
  });

  it("overcaller reveal states set captain to opener on entry", () => {
    const revealStates = [
      "overcaller-reveal",
      "overcaller-2d-relay",
      "overcaller-2c-relay",
    ];
    for (const stateId of revealStates) {
      const state = DONT_BASE_TRACK.states[stateId]!;
      expect(
        state.onEnter!.some(
          (e) => e.op === "setReg"
            && (e as { path: string }).path === "captain.side"
            && (e as { value: unknown }).value === "opener",
        ),
        `${stateId} missing captain=opener`,
      ).toBe(true);
    }
  });

  it("reveal transitions export agreement.final tag", () => {
    const state = DONT_BASE_TRACK.states["overcaller-reveal"]!;
    for (const t of state.eventTransitions) {
      if (t.when.actor === "opponent") continue; // skip interference
      expect(
        t.effects?.some((e) => e.op === "exportTag" && (e as { tag: string }).tag === "agreement.final"),
        `reveal transition ${t.transitionId} missing agreement.final`,
      ).toBe(true);
    }
  });

  // ── Facts ──────────────────────────────────────────────────

  it("references dontFacts catalog extension", () => {
    expect(DONT_BASE_TRACK.facts).toBeDefined();
    expect(DONT_BASE_TRACK.facts.definitions.length).toBeGreaterThan(0);
  });
});
