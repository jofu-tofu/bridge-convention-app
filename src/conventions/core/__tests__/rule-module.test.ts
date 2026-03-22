import { describe, it, expect } from "vitest";
import type {
  RouteExpr,
  NegotiationExpr,
  Rule,
  PhaseTransition,
} from "../rule-module";
import type { ConventionModule } from "../convention-module";

describe("ConventionModule type construction", () => {
  it("constructs a minimal ConventionModule", () => {
    const mod: ConventionModule<"idle" | "active"> = {
      moduleId: "test-module",
      local: {
        initial: "idle",
        transitions: [],
      },
      rules: [],
      facts: { definitions: [], evaluators: new Map() },
      explanationEntries: [],
    };
    expect(mod.moduleId).toBe("test-module");
    expect(mod.local.initial).toBe("idle");
  });

  it("constructs PhaseTransitions with ObsPattern", () => {
    const transition: PhaseTransition<"idle" | "asked"> = {
      from: "idle",
      to: "asked",
      on: { act: "inquire", feature: "majorSuit" },
    };
    expect(transition.from).toBe("idle");
    expect(transition.on.act).toBe("inquire");
  });

  it("constructs PhaseTransition with multiple from phases", () => {
    const transition: PhaseTransition<"idle" | "asked" | "done"> = {
      from: ["idle", "asked"],
      to: "done",
      on: { act: "any" },
    };
    expect(transition.from).toEqual(["idle", "asked"]);
  });

  it("constructs RouteExpr variants", () => {
    const subseq: RouteExpr = {
      kind: "subseq",
      steps: [
        { act: "inquire", feature: "majorSuit" },
        { act: "deny", feature: "majorSuit" },
      ],
    };
    expect(subseq.kind).toBe("subseq");

    const last: RouteExpr = {
      kind: "last",
      pattern: { act: "open", strain: "notrump" },
    };
    expect(last.kind).toBe("last");

    const contains: RouteExpr = {
      kind: "contains",
      pattern: { act: "transfer", suit: "hearts" },
    };
    expect(contains.kind).toBe("contains");

    const combined: RouteExpr = {
      kind: "and",
      exprs: [
        { kind: "contains", pattern: { act: "open", strain: "notrump" } },
        { kind: "not", expr: { kind: "contains", pattern: { act: "overcall" } } },
      ],
    };
    expect(combined.kind).toBe("and");
  });

  it("constructs NegotiationExpr variants", () => {
    const fit: NegotiationExpr = { kind: "fit", strain: "hearts" };
    expect(fit.kind).toBe("fit");

    const noFit: NegotiationExpr = { kind: "no-fit" };
    expect(noFit.kind).toBe("no-fit");

    const forcing: NegotiationExpr = { kind: "forcing", level: "game" };
    expect(forcing.kind).toBe("forcing");

    const overcalled: NegotiationExpr = {
      kind: "overcalled",
      below: { level: 2, strain: "hearts" },
    };
    expect(overcalled.kind).toBe("overcalled");

    const combined: NegotiationExpr = {
      kind: "and",
      exprs: [
        { kind: "uncontested" },
        { kind: "not", expr: { kind: "forcing", level: "game" } },
      ],
    };
    expect(combined.kind).toBe("and");
  });

  it("constructs Rules with match conditions and claims", () => {
    const rule: Rule<"idle" | "asked"> = {
      match: {
        turn: "responder",
        local: "asked",
        kernel: { kind: "uncontested" },
        route: {
          kind: "last",
          pattern: { act: "deny", feature: "majorSuit" },
        },
      },
      claims: [
        {
          surface: {
            meaningId: "test",
            semanticClassId: "test:class",
            teachingLabel: "Test surface",
          // any: BidMeaning has many fields; test only exercises type compatibility
          } as never,
        },
      ],
    };
    expect(rule.match.turn).toBe("responder");
    expect(rule.claims).toHaveLength(1);
  });

  it("constructs claims with optional negotiationDelta", () => {
    const rule: Rule<"idle" | "active"> = {
      match: { local: "active", turn: "opener" },
      claims: [
        {
          surface: { meaningId: "test", semanticClassId: "test:class", teachingLabel: "Test" } as never,
          negotiationDelta: { forcing: "one-round", captain: "responder" },
        },
      ],
    };
    expect(rule.claims[0]!.negotiationDelta).toEqual({
      forcing: "one-round",
      captain: "responder",
    });
  });

  it("allows claims without negotiationDelta (backward compatible)", () => {
    const rule: Rule<"idle"> = {
      match: { local: "idle" },
      claims: [
        { surface: { meaningId: "test", semanticClassId: "test:class", teachingLabel: "Test" } as never },
      ],
    };
    expect(rule.claims[0]!.negotiationDelta).toBeUndefined();
  });
});
