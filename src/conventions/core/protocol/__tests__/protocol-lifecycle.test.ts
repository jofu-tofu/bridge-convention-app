import { describe, it, expect } from "vitest";
import { Seat, BidSuit } from "../../../../engine/types";
import type { Call, AuctionEntry } from "../../../../engine/types";
import type {
  BoolExpr,
  Ref,
  EffectSpec,
  ProtocolModuleSpec,
  ProtocolInstance,
  FrameStateSpec,
  RuntimeSnapshot,
  ProvenancedValue,
  PublicSemanticSchema,
  CapabilitySpec,
} from "../types";
import {
  evaluateBoolExpr,
  resolveRef,
  applyEffects,
  advanceProtocolState,
  settleProtocolLifecycle,
} from "../protocol-lifecycle";
import type { ExpressionContext } from "../protocol-lifecycle";

// ── Test Helpers ────────────────────────────────────────────────────

function makeContext(overrides?: Partial<ExpressionContext>): ExpressionContext {
  return {
    registers: {},
    activeTags: new Set(),
    history: [],
    actorSeat: Seat.North,
    baseState: undefined,
    protocolStates: new Map(),
    localState: undefined,
    ...overrides,
  };
}

function makeSnapshot(overrides?: Partial<RuntimeSnapshot>): RuntimeSnapshot {
  return {
    bootNodeId: "root",
    protocols: [],
    registers: {},
    activeTags: new Set<string>(),
    doneLatches: new Set<string>(),
    ply: 0,
    ...overrides,
  };
}

function makeProvenancedValue(value: unknown, ply = 0): ProvenancedValue {
  return {
    value,
    writtenAtPly: ply,
    writtenBy: { ownerType: "baseTrack", ownerId: "test", stateId: "s0" },
  };
}

function makeProtocolSpec(overrides?: Partial<ProtocolModuleSpec>): ProtocolModuleSpec {
  return {
    role: "protocol" as const,
    id: "test-proto",
    name: "Test Protocol",
    attachWhen: { op: "true" },
    initialStateId: "init",
    states: {
      init: {
        id: "init",
        mode: "overlay" as const,
        eventTransitions: [],
      },
    },
    ...overrides,
  } as ProtocolModuleSpec;
}

function makeInstance(overrides?: Partial<ProtocolInstance>): ProtocolInstance {
  return {
    protocolId: "test-proto",
    instanceKey: "test-proto",
    stateId: "init",
    anchor: "base",
    depth: 1,
    attachedAtPly: 0,
    localState: {},
    ...overrides,
  };
}

const emptySchema: PublicSemanticSchema = {
  registers: {},
  capabilities: {},
};

// ── evaluateBoolExpr ────────────────────────────────────────────────

describe("evaluateBoolExpr", () => {
  it("returns true for { op: 'true' }", () => {
    const ctx = makeContext();
    expect(evaluateBoolExpr({ op: "true" }, ctx)).toBe(true);
  });

  it("returns false for { op: 'false' }", () => {
    const ctx = makeContext();
    expect(evaluateBoolExpr({ op: "false" }, ctx)).toBe(false);
  });

  describe("activeTag", () => {
    it("returns true when tag is active", () => {
      const ctx = makeContext({ activeTags: new Set(["foo"]) });
      expect(evaluateBoolExpr({ op: "activeTag", tag: "foo" }, ctx)).toBe(true);
    });

    it("returns false when tag is not active", () => {
      const ctx = makeContext({ activeTags: new Set(["bar"]) });
      expect(evaluateBoolExpr({ op: "activeTag", tag: "foo" }, ctx)).toBe(false);
    });
  });

  describe("exists", () => {
    it("returns true when register exists", () => {
      const ctx = makeContext({
        registers: { "hcp.range": makeProvenancedValue([10, 12]) },
      });
      const expr: BoolExpr = { op: "exists", ref: { kind: "reg", path: "hcp.range" } };
      expect(evaluateBoolExpr(expr, ctx)).toBe(true);
    });

    it("returns false when register does not exist", () => {
      const ctx = makeContext();
      const expr: BoolExpr = { op: "exists", ref: { kind: "reg", path: "missing" } };
      expect(evaluateBoolExpr(expr, ctx)).toBe(false);
    });

    it("returns true when local state key exists", () => {
      const ctx = makeContext({ localState: { count: 3 } });
      const expr: BoolExpr = { op: "exists", ref: { kind: "local", path: "count" } };
      expect(evaluateBoolExpr(expr, ctx)).toBe(true);
    });

    it("returns false when no localState is set", () => {
      const ctx = makeContext();
      const expr: BoolExpr = { op: "exists", ref: { kind: "local", path: "count" } };
      expect(evaluateBoolExpr(expr, ctx)).toBe(false);
    });
  });

  describe("eq / neq", () => {
    it("eq returns true when register value matches", () => {
      const ctx = makeContext({
        registers: { "forcing.state": makeProvenancedValue("game") },
      });
      const expr: BoolExpr = {
        op: "eq",
        ref: { kind: "reg", path: "forcing.state" },
        value: "game",
      };
      expect(evaluateBoolExpr(expr, ctx)).toBe(true);
    });

    it("eq returns false when register value differs", () => {
      const ctx = makeContext({
        registers: { "forcing.state": makeProvenancedValue("oneRound") },
      });
      const expr: BoolExpr = {
        op: "eq",
        ref: { kind: "reg", path: "forcing.state" },
        value: "game",
      };
      expect(evaluateBoolExpr(expr, ctx)).toBe(false);
    });

    it("neq returns true when values differ", () => {
      const ctx = makeContext({
        registers: { "forcing.state": makeProvenancedValue("none") },
      });
      const expr: BoolExpr = {
        op: "neq",
        ref: { kind: "reg", path: "forcing.state" },
        value: "game",
      };
      expect(evaluateBoolExpr(expr, ctx)).toBe(true);
    });
  });

  describe("in", () => {
    it("returns true when value is in the list", () => {
      const ctx = makeContext({
        registers: { "agreement.strain": makeProvenancedValue("H") },
      });
      const expr: BoolExpr = {
        op: "in",
        ref: { kind: "reg", path: "agreement.strain" },
        values: ["H", "S"],
      };
      expect(evaluateBoolExpr(expr, ctx)).toBe(true);
    });

    it("returns false when value is not in the list", () => {
      const ctx = makeContext({
        registers: { "agreement.strain": makeProvenancedValue("C") },
      });
      const expr: BoolExpr = {
        op: "in",
        ref: { kind: "reg", path: "agreement.strain" },
        values: ["H", "S"],
      };
      expect(evaluateBoolExpr(expr, ctx)).toBe(false);
    });
  });

  describe("lt / gt", () => {
    it("lt returns true when value < threshold", () => {
      const ctx = makeContext({
        registers: { hcp: makeProvenancedValue(12) },
      });
      const expr: BoolExpr = {
        op: "lt",
        ref: { kind: "reg", path: "hcp" },
        value: 15,
      };
      expect(evaluateBoolExpr(expr, ctx)).toBe(true);
    });

    it("lt returns false for non-number values", () => {
      const ctx = makeContext({
        registers: { hcp: makeProvenancedValue("twelve") },
      });
      const expr: BoolExpr = {
        op: "lt",
        ref: { kind: "reg", path: "hcp" },
        value: 15,
      };
      expect(evaluateBoolExpr(expr, ctx)).toBe(false);
    });

    it("gt returns true when value > threshold", () => {
      const ctx = makeContext({
        registers: { hcp: makeProvenancedValue(18) },
      });
      const expr: BoolExpr = {
        op: "gt",
        ref: { kind: "reg", path: "hcp" },
        value: 15,
      };
      expect(evaluateBoolExpr(expr, ctx)).toBe(true);
    });
  });

  describe("and / or / not", () => {
    it("and returns true when all args are true", () => {
      const ctx = makeContext({ activeTags: new Set(["a", "b"]) });
      const expr: BoolExpr = {
        op: "and",
        args: [
          { op: "activeTag", tag: "a" },
          { op: "activeTag", tag: "b" },
        ],
      };
      expect(evaluateBoolExpr(expr, ctx)).toBe(true);
    });

    it("and returns false when any arg is false", () => {
      const ctx = makeContext({ activeTags: new Set(["a"]) });
      const expr: BoolExpr = {
        op: "and",
        args: [
          { op: "activeTag", tag: "a" },
          { op: "activeTag", tag: "b" },
        ],
      };
      expect(evaluateBoolExpr(expr, ctx)).toBe(false);
    });

    it("and with empty args returns true (vacuous truth)", () => {
      const ctx = makeContext();
      expect(evaluateBoolExpr({ op: "and", args: [] }, ctx)).toBe(true);
    });

    it("or returns true when any arg is true", () => {
      const ctx = makeContext({ activeTags: new Set(["b"]) });
      const expr: BoolExpr = {
        op: "or",
        args: [
          { op: "activeTag", tag: "a" },
          { op: "activeTag", tag: "b" },
        ],
      };
      expect(evaluateBoolExpr(expr, ctx)).toBe(true);
    });

    it("or returns false when no args are true", () => {
      const ctx = makeContext();
      const expr: BoolExpr = {
        op: "or",
        args: [
          { op: "activeTag", tag: "a" },
          { op: "activeTag", tag: "b" },
        ],
      };
      expect(evaluateBoolExpr(expr, ctx)).toBe(false);
    });

    it("or with empty args returns false", () => {
      const ctx = makeContext();
      expect(evaluateBoolExpr({ op: "or", args: [] }, ctx)).toBe(false);
    });

    it("not inverts the result", () => {
      const ctx = makeContext({ activeTags: new Set(["a"]) });
      expect(
        evaluateBoolExpr({ op: "not", arg: { op: "activeTag", tag: "a" } }, ctx),
      ).toBe(false);
      expect(
        evaluateBoolExpr({ op: "not", arg: { op: "activeTag", tag: "z" } }, ctx),
      ).toBe(true);
    });
  });
});

// ── resolveRef ──────────────────────────────────────────────────────

describe("resolveRef", () => {
  it("resolves reg ref to register value", () => {
    const ctx = makeContext({
      registers: { "agreement.strain": makeProvenancedValue("NT") },
    });
    expect(resolveRef({ kind: "reg", path: "agreement.strain" }, ctx)).toBe("NT");
  });

  it("returns undefined for missing register", () => {
    const ctx = makeContext();
    expect(resolveRef({ kind: "reg", path: "missing" }, ctx)).toBeUndefined();
  });

  it("resolves tag ref to boolean", () => {
    const ctx = makeContext({ activeTags: new Set(["active"]) });
    expect(resolveRef({ kind: "tag", tag: "active" }, ctx)).toBe(true);
    expect(resolveRef({ kind: "tag", tag: "missing" }, ctx)).toBe(false);
  });

  it("resolves local ref to protocol-local state", () => {
    const ctx = makeContext({ localState: { count: 42 } });
    expect(resolveRef({ kind: "local", path: "count" }, ctx)).toBe(42);
  });

  it("resolves base ref to base track info", () => {
    const ctx = makeContext({
      baseState: { trackId: "nt-track", stateId: "responder-choice" },
    });
    expect(resolveRef({ kind: "base", path: "trackId" }, ctx)).toBe("nt-track");
    expect(resolveRef({ kind: "base", path: "stateId" }, ctx)).toBe("responder-choice");
  });

  it("returns undefined for base ref when no base state", () => {
    const ctx = makeContext();
    expect(resolveRef({ kind: "base", path: "trackId" }, ctx)).toBeUndefined();
  });

  it("resolves protocol ref to protocol instance info", () => {
    const inst = makeInstance({ protocolId: "blackwood", stateId: "asking", instanceKey: "bw:1" });
    const ctx = makeContext({
      protocolStates: new Map([["blackwood", inst]]),
    });
    expect(resolveRef({ kind: "protocol", protocolId: "blackwood", path: "stateId" }, ctx)).toBe("asking");
    expect(resolveRef({ kind: "protocol", protocolId: "blackwood", path: "instanceKey" }, ctx)).toBe("bw:1");
  });

  it("resolves history ref for length", () => {
    const entries: AuctionEntry[] = [
      { seat: Seat.North, call: { type: "bid", level: 1, strain: BidSuit.NoTrump } },
      { seat: Seat.East, call: { type: "pass" } },
    ];
    const ctx = makeContext({ history: entries });
    expect(resolveRef({ kind: "history", path: "length" }, ctx)).toBe(2);
  });

  it("resolves actor ref for seat, team, party", () => {
    const ctx = makeContext({ actorSeat: Seat.East });
    expect(resolveRef({ kind: "actor", path: "seat" }, ctx)).toBe(Seat.East);
    expect(resolveRef({ kind: "actor", path: "team" }, ctx)).toBe("EW");
    expect(resolveRef({ kind: "actor", path: "party" }, ctx)).toBe("EW");
  });
});

// ── applyEffects ────────────────────────────────────────────────────

describe("applyEffects", () => {
  it("setReg writes register with provenance", () => {
    const snapshot = makeSnapshot();
    const effects: EffectSpec[] = [
      { op: "setReg", path: "forcing.state", value: "game" },
    ];
    const result = applyEffects(effects, snapshot, {
      ownerType: "protocol",
      ownerId: "stayman",
      stateId: "asking",
    }, 3);

    expect(result.registers["forcing.state"]).toEqual({
      value: "game",
      writtenAtPly: 3,
      writtenBy: {
        ownerType: "protocol",
        ownerId: "stayman",
        stateId: "asking",
      },
    });
  });

  it("clearReg removes register", () => {
    const snapshot = makeSnapshot({
      registers: { "forcing.state": makeProvenancedValue("game") },
    });
    const result = applyEffects(
      [{ op: "clearReg", path: "forcing.state" }],
      snapshot,
      { ownerType: "baseTrack", ownerId: "nt", stateId: "s0" },
      0,
    );
    expect(result.registers["forcing.state"]).toBeUndefined();
  });

  it("exportTag adds tag to activeTags", () => {
    const snapshot = makeSnapshot({ activeTags: new Set(["existing"]) });
    const result = applyEffects(
      [{ op: "exportTag", tag: "agreement.final" }],
      snapshot,
      { ownerType: "baseTrack", ownerId: "nt", stateId: "s0" },
      0,
    );
    expect(result.activeTags.has("agreement.final")).toBe(true);
    expect(result.activeTags.has("existing")).toBe(true);
  });

  it("removeTag removes tag from activeTags", () => {
    const snapshot = makeSnapshot({ activeTags: new Set(["a", "b"]) });
    const result = applyEffects(
      [{ op: "removeTag", tag: "a" }],
      snapshot,
      { ownerType: "baseTrack", ownerId: "nt", stateId: "s0" },
      0,
    );
    expect(result.activeTags.has("a")).toBe(false);
    expect(result.activeTags.has("b")).toBe(true);
  });

  it("setLocal writes to protocol-local state", () => {
    const snapshot = makeSnapshot({
      protocols: [makeInstance({ protocolId: "blackwood" })],
    });
    const result = applyEffects(
      [{ op: "setLocal", path: "keycards", value: 3 }],
      snapshot,
      { ownerType: "protocol", ownerId: "blackwood", stateId: "asking" },
      1,
    );
    const inst = result.protocols.find((p) => p.protocolId === "blackwood");
    expect(inst?.localState["keycards"]).toBe(3);
  });

  it("clearLocal removes from protocol-local state", () => {
    const snapshot = makeSnapshot({
      protocols: [
        makeInstance({
          protocolId: "blackwood",
          localState: { keycards: 3, queens: 1 },
        }),
      ],
    });
    const result = applyEffects(
      [{ op: "clearLocal", path: "keycards" }],
      snapshot,
      { ownerType: "protocol", ownerId: "blackwood", stateId: "s0" },
      1,
    );
    const inst = result.protocols.find((p) => p.protocolId === "blackwood");
    expect(inst?.localState["keycards"]).toBeUndefined();
    expect(inst?.localState["queens"]).toBe(1);
  });

  it("setReg resolves Ref values", () => {
    const snapshot = makeSnapshot({
      registers: { source: makeProvenancedValue("hearts") },
    });
    const effects: EffectSpec[] = [
      {
        op: "setReg",
        path: "agreement.strain",
        value: { kind: "reg", path: "source" } as Ref,
      },
    ];
    const result = applyEffects(effects, snapshot, {
      ownerType: "protocol",
      ownerId: "test",
      stateId: "s0",
    }, 1);
    expect(result.registers["agreement.strain"]?.value).toBe("hearts");
  });
});

// ── advanceProtocolState ────────────────────────────────────────────

describe("advanceProtocolState", () => {
  const bid1NT: Call = { type: "bid", level: 1, strain: BidSuit.NoTrump };
  const bid2C: Call = { type: "bid", level: 2, strain: BidSuit.Clubs };
  const pass: Call = { type: "pass" };

  it("returns null when no transition matches", () => {
    const spec = makeProtocolSpec({
      states: {
        init: {
          id: "init",
          mode: "overlay" as const,
          eventTransitions: [
            {
              transitionId: "t1",
              when: { call: bid2C },
              goto: "asked",
            },
          ],
        },
      },
    });
    const instance = makeInstance();
    const ctx = makeContext({ actorSeat: Seat.North });

    const result = advanceProtocolState(instance, spec, pass, Seat.North, ctx);
    expect(result).toBeNull();
  });

  it("matches a transition and returns updated instance", () => {
    const spec = makeProtocolSpec({
      states: {
        init: {
          id: "init",
          mode: "overlay" as const,
          eventTransitions: [
            {
              transitionId: "t1",
              when: { call: bid2C },
              goto: "asked",
              effects: [
                { op: "exportTag", tag: "stayman.active" },
              ],
            },
          ],
        },
        asked: {
          id: "asked",
          mode: "overlay" as const,
          eventTransitions: [],
        },
      },
    });
    const instance = makeInstance({ stateId: "init" });
    const ctx = makeContext({ actorSeat: Seat.North });

    const result = advanceProtocolState(instance, spec, bid2C, Seat.North, ctx);
    expect(result).not.toBeNull();
    expect(result!.instance.stateId).toBe("asked");
    expect(result!.effects).toHaveLength(1);
    expect(result!.effects[0]).toEqual({ op: "exportTag", tag: "stayman.active" });
  });

  it("respects the consumed flag (default is consume)", () => {
    const spec = makeProtocolSpec({
      states: {
        init: {
          id: "init",
          mode: "overlay" as const,
          eventTransitions: [
            {
              transitionId: "t1",
              when: { callType: "bid" },
              goto: "STAY",
            },
          ],
        },
      },
    });
    const instance = makeInstance();
    const ctx = makeContext({ actorSeat: Seat.North });

    const result = advanceProtocolState(instance, spec, bid1NT, Seat.North, ctx);
    expect(result).not.toBeNull();
    expect(result!.consumed).toBe(true);
  });

  it("sets consumed to false when routing is 'observe'", () => {
    const spec = makeProtocolSpec({
      states: {
        init: {
          id: "init",
          mode: "overlay" as const,
          eventTransitions: [
            {
              transitionId: "t1",
              when: { callType: "bid" },
              goto: "STAY",
              routing: "observe",
            },
          ],
        },
      },
    });
    const instance = makeInstance();
    const ctx = makeContext({ actorSeat: Seat.North });

    const result = advanceProtocolState(instance, spec, bid1NT, Seat.North, ctx);
    expect(result).not.toBeNull();
    expect(result!.consumed).toBe(false);
  });

  it("evaluates guard conditions", () => {
    const spec = makeProtocolSpec({
      states: {
        init: {
          id: "init",
          mode: "overlay" as const,
          eventTransitions: [
            {
              transitionId: "guarded",
              when: { callType: "bid" },
              goto: "next",
              guard: { op: "activeTag", tag: "agreement.final" },
            },
            {
              transitionId: "fallback",
              when: { callType: "bid" },
              goto: "fallback-state",
            },
          ],
        },
        next: { id: "next", mode: "overlay" as const, eventTransitions: [] },
        "fallback-state": { id: "fallback-state", mode: "overlay" as const, eventTransitions: [] },
      },
    });
    const instance = makeInstance();

    // Without the tag: guard fails, fallback matches.
    const ctx1 = makeContext({ actorSeat: Seat.North });
    const result1 = advanceProtocolState(instance, spec, bid2C, Seat.North, ctx1);
    expect(result1).not.toBeNull();
    expect(result1!.instance.stateId).toBe("fallback-state");

    // With the tag: guard passes, guarded transition matches.
    const ctx2 = makeContext({
      actorSeat: Seat.North,
      activeTags: new Set(["agreement.final"]),
    });
    const result2 = advanceProtocolState(instance, spec, bid2C, Seat.North, ctx2);
    expect(result2).not.toBeNull();
    expect(result2!.instance.stateId).toBe("next");
  });

  it("handles STAY — stateId does not change", () => {
    const spec = makeProtocolSpec({
      states: {
        init: {
          id: "init",
          mode: "overlay" as const,
          eventTransitions: [
            { transitionId: "t1", when: { callType: "pass" }, goto: "STAY" },
          ],
        },
      },
    });
    const instance = makeInstance({ stateId: "init" });
    const ctx = makeContext({ actorSeat: Seat.North });

    const result = advanceProtocolState(instance, spec, pass, Seat.North, ctx);
    expect(result).not.toBeNull();
    expect(result!.instance.stateId).toBe("init");
  });

  it("handles POP — stateId set to 'POP'", () => {
    const spec = makeProtocolSpec({
      states: {
        init: {
          id: "init",
          mode: "overlay" as const,
          eventTransitions: [
            { transitionId: "t1", when: { callType: "pass" }, goto: "POP" },
          ],
        },
      },
    });
    const instance = makeInstance({ stateId: "init" });
    const ctx = makeContext({ actorSeat: Seat.North });

    const result = advanceProtocolState(instance, spec, pass, Seat.North, ctx);
    expect(result).not.toBeNull();
    expect(result!.instance.stateId).toBe("POP");
  });

  it("matches actor patterns correctly", () => {
    const spec = makeProtocolSpec({
      states: {
        init: {
          id: "init",
          mode: "overlay" as const,
          eventTransitions: [
            {
              transitionId: "partner-bid",
              when: { actor: "partner", callType: "bid" },
              goto: "partner-responded",
            },
          ],
        },
        "partner-responded": {
          id: "partner-responded",
          mode: "overlay" as const,
          eventTransitions: [],
        },
      },
    });
    const instance = makeInstance();
    const ctx = makeContext({ actorSeat: Seat.North });

    // South is partner of North — should match.
    const result1 = advanceProtocolState(instance, spec, bid2C, Seat.South, ctx);
    expect(result1).not.toBeNull();
    expect(result1!.instance.stateId).toBe("partner-responded");

    // East is opponent — should not match.
    const result2 = advanceProtocolState(instance, spec, bid2C, Seat.East, ctx);
    expect(result2).toBeNull();
  });
});

// ── settleProtocolLifecycle ─────────────────────────────────────────

describe("settleProtocolLifecycle", () => {
  it("evaluates capabilities and adds cap:* tags", () => {
    const schema: PublicSemanticSchema = {
      registers: {},
      capabilities: {
        canSlam: {
          id: "canSlam",
          when: { op: "activeTag", tag: "agreement.final" },
          description: "Slam investigation available",
        },
      },
    };
    const snapshot = makeSnapshot({
      activeTags: new Set(["agreement.final"]),
    });

    const result = settleProtocolLifecycle(snapshot, [], schema);
    expect(result.activeTags.has("cap:canSlam")).toBe(true);
  });

  it("removes cap:* tags when capability condition no longer met", () => {
    const schema: PublicSemanticSchema = {
      registers: {},
      capabilities: {
        canSlam: {
          id: "canSlam",
          when: { op: "activeTag", tag: "agreement.final" },
          description: "Slam investigation available",
        },
      },
    };
    // Tag "agreement.final" NOT present, but cap:canSlam was previously set.
    const snapshot = makeSnapshot({
      activeTags: new Set(["cap:canSlam"]),
    });

    const result = settleProtocolLifecycle(snapshot, [], schema);
    expect(result.activeTags.has("cap:canSlam")).toBe(false);
  });

  it("attaches protocol when attachWhen condition is met", () => {
    const spec = makeProtocolSpec({
      id: "slam",
      attachWhen: { op: "activeTag", tag: "agreement.final" },
      initialStateId: "investigating",
      states: {
        investigating: {
          id: "investigating",
          mode: "overlay" as const,
          eventTransitions: [],
        },
      },
    });
    const snapshot = makeSnapshot({
      activeTags: new Set(["agreement.final"]),
    });

    const result = settleProtocolLifecycle(snapshot, [spec], emptySchema);
    expect(result.protocols).toHaveLength(1);
    expect(result.protocols[0]!.protocolId).toBe("slam");
    expect(result.protocols[0]!.stateId).toBe("investigating");
  });

  it("does not attach when attachWhen is false", () => {
    const spec = makeProtocolSpec({
      id: "slam",
      attachWhen: { op: "activeTag", tag: "agreement.final" },
    });
    const snapshot = makeSnapshot();

    const result = settleProtocolLifecycle(snapshot, [spec], emptySchema);
    expect(result.protocols).toHaveLength(0);
  });

  it("does not re-attach after done latch", () => {
    const spec = makeProtocolSpec({
      id: "slam",
      attachWhen: { op: "true" },
      completion: {
        doneLatchUntil: { op: "false" }, // Never clears
      },
    });
    // The protocol is done-latched.
    const snapshot = makeSnapshot({
      doneLatches: new Set(["slam:slam"]),
    });

    const result = settleProtocolLifecycle(snapshot, [spec], emptySchema);
    expect(result.protocols).toHaveLength(0);
  });

  it("clears done latch when doneLatchUntil becomes true", () => {
    const spec = makeProtocolSpec({
      id: "slam",
      attachWhen: { op: "true" },
      completion: {
        doneLatchUntil: { op: "activeTag", tag: "new-deal" },
      },
    });
    const snapshot = makeSnapshot({
      doneLatches: new Set(["slam:slam"]),
      activeTags: new Set(["new-deal"]),
    });

    const result = settleProtocolLifecycle(snapshot, [spec], emptySchema);
    // Latch should be cleared.
    expect(result.doneLatches.has("slam:slam")).toBe(false);
    // Protocol should re-attach.
    expect(result.protocols).toHaveLength(1);
    expect(result.protocols[0]!.protocolId).toBe("slam");
  });

  describe("scope key deduplication", () => {
    it("does not create duplicate instances for same scope key", () => {
      const spec = makeProtocolSpec({
        id: "verify",
        attachWhen: { op: "true" },
        scopeKey: "verify:hearts",
      });
      const existingInstance = makeInstance({
        protocolId: "verify",
        instanceKey: "verify:hearts",
        stateId: "init",
      });
      const snapshot = makeSnapshot({
        protocols: [existingInstance],
      });

      const result = settleProtocolLifecycle(snapshot, [spec], emptySchema);
      // Should still be only one instance.
      expect(result.protocols).toHaveLength(1);
    });

    it("interpolates scope key with register values", () => {
      const spec = makeProtocolSpec({
        id: "verify",
        attachWhen: { op: "true" },
        scopeKey: "verify:${reg.agreement.suit}",
      });
      const snapshot = makeSnapshot({
        registers: {
          "agreement.suit": makeProvenancedValue("hearts"),
        },
      });

      const result = settleProtocolLifecycle(snapshot, [spec], emptySchema);
      expect(result.protocols).toHaveLength(1);
      expect(result.protocols[0]!.instanceKey).toBe("verify:hearts");
    });
  });

  describe("mutex group resolution", () => {
    it("keeps only higher priority protocol within a mutex group", () => {
      const specA = makeProtocolSpec({
        id: "blackwood",
        attachWhen: { op: "true" },
        coexistence: { mutexGroup: "slam", priority: 1 },
        initialStateId: "init",
        states: {
          init: { id: "init", mode: "overlay" as const, eventTransitions: [] },
        },
      });
      const specB = makeProtocolSpec({
        id: "cuebid",
        attachWhen: { op: "true" },
        coexistence: { mutexGroup: "slam", priority: 2 },
        initialStateId: "init",
        states: {
          init: { id: "init", mode: "overlay" as const, eventTransitions: [] },
        },
      });
      const snapshot = makeSnapshot();

      const result = settleProtocolLifecycle(snapshot, [specA, specB], emptySchema);
      // Only blackwood (priority 1, lower wins) should survive.
      expect(result.protocols).toHaveLength(1);
      expect(result.protocols[0]!.protocolId).toBe("blackwood");
    });

    it("keeps all protocols without mutex groups", () => {
      const specA = makeProtocolSpec({
        id: "proto-a",
        attachWhen: { op: "true" },
      });
      const specB = makeProtocolSpec({
        id: "proto-b",
        attachWhen: { op: "true" },
      });
      const snapshot = makeSnapshot();

      const result = settleProtocolLifecycle(snapshot, [specA, specB], emptySchema);
      expect(result.protocols).toHaveLength(2);
    });
  });

  describe("exit via reactions", () => {
    it("exits protocol when reaction with POP fires", () => {
      const spec = makeProtocolSpec({
        id: "test-exit",
        attachWhen: { op: "true" },
        initialStateId: "active",
        completion: {
          doneLatchUntil: { op: "false" },
        },
        states: {
          active: {
            id: "active",
            mode: "overlay" as const,
            eventTransitions: [],
            reactions: [
              {
                reactionId: "exit-when-done",
                when: { op: "activeTag", tag: "done-signal" },
                goto: "POP",
              },
            ],
          },
        },
      });
      const instance = makeInstance({
        protocolId: "test-exit",
        instanceKey: "test-exit",
        stateId: "active",
      });
      const snapshot = makeSnapshot({
        protocols: [instance],
        activeTags: new Set(["done-signal"]),
      });

      const result = settleProtocolLifecycle(snapshot, [spec], emptySchema);
      // Protocol should be removed.
      expect(result.protocols).toHaveLength(0);
      // Done latch should be set.
      expect(result.doneLatches.has("test-exit:test-exit")).toBe(true);
    });

    it("applies reaction effects on exit", () => {
      const spec = makeProtocolSpec({
        id: "verify",
        attachWhen: { op: "true" },
        initialStateId: "active",
        states: {
          active: {
            id: "active",
            mode: "overlay" as const,
            eventTransitions: [],
            reactions: [
              {
                reactionId: "exit-with-effect",
                when: { op: "true" },
                goto: "POP",
                effects: [
                  { op: "setReg", path: "verification.result", value: "passed" },
                ],
              },
            ],
          },
        },
      });
      const instance = makeInstance({
        protocolId: "verify",
        instanceKey: "verify",
        stateId: "active",
      });
      const snapshot = makeSnapshot({ protocols: [instance] });

      const result = settleProtocolLifecycle(snapshot, [spec], emptySchema);
      expect(result.registers["verification.result"]?.value).toBe("passed");
    });
  });

  describe("no-reentry rule", () => {
    it("protocol that exits cannot re-attach in the same settle pass", () => {
      const spec = makeProtocolSpec({
        id: "cycler",
        attachWhen: { op: "true" }, // Would always attach
        initialStateId: "active",
        states: {
          active: {
            id: "active",
            mode: "overlay" as const,
            eventTransitions: [],
            reactions: [
              {
                reactionId: "exit-immediately",
                when: { op: "true" },
                goto: "POP",
              },
            ],
          },
        },
      });
      const instance = makeInstance({
        protocolId: "cycler",
        instanceKey: "cycler",
        stateId: "active",
      });
      const snapshot = makeSnapshot({ protocols: [instance] });

      const result = settleProtocolLifecycle(snapshot, [spec], emptySchema);
      // Should exit AND not re-attach, despite attachWhen being true.
      expect(result.protocols).toHaveLength(0);
    });

    it("no-reentry applies even without done latch configured", () => {
      const spec = makeProtocolSpec({
        id: "one-shot",
        attachWhen: { op: "true" },
        initialStateId: "active",
        // No completion.doneLatchUntil — so no done latch
        states: {
          active: {
            id: "active",
            mode: "overlay" as const,
            eventTransitions: [],
            reactions: [
              {
                reactionId: "exit",
                when: { op: "true" },
                goto: "POP",
              },
            ],
          },
        },
      });
      const instance = makeInstance({
        protocolId: "one-shot",
        instanceKey: "one-shot",
        stateId: "active",
      });
      const snapshot = makeSnapshot({ protocols: [instance] });

      const result = settleProtocolLifecycle(snapshot, [spec], emptySchema);
      // Exited, no re-attach in same pass.
      expect(result.protocols).toHaveLength(0);
      // No done latch since doneLatchUntil not configured.
      expect(result.doneLatches.has("one-shot:one-shot")).toBe(false);
    });
  });
});
