import { describe, it, expect } from "vitest";
import type {
  RouteExpr,
  NegotiationExpr,
  StateEntry,
  PhaseTransition,
} from "../rule-module";
import { TurnRole } from "../rule-module";
import type { ConventionModule } from "../convention-module";
import { bidName, bidSummary, moduleDescription, modulePurpose, teachingTradeoff, teachingPrinciple } from "../authored-text";
import type { TeachingLabel } from "../authored-text";
import { ObsSuit } from "../../pipeline/bid-action";
import { HandStrength } from "../../pipeline/bid-action";

const tl = (name: string): TeachingLabel => ({ name: bidName(name), summary: bidSummary("[TODO] test") });

describe("ConventionModule type construction", () => {
  it("constructs a minimal ConventionModule", () => {
    const mod: ConventionModule<"idle" | "active"> = {
      moduleId: "test-module",
      description: moduleDescription("test module description for rule module"),
      purpose: modulePurpose("test purpose for rule module tests"),
      teaching: { tradeoff: teachingTradeoff("test tradeoff for module"), principle: teachingPrinciple("test principle for module"), commonMistakes: [] },
      local: {
        initial: "idle",
        transitions: [],
      },
      states: [],
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
      pattern: { act: "transfer", suit: ObsSuit.Hearts },
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
    const fit: NegotiationExpr = { kind: "fit", strain: ObsSuit.Hearts };
    expect(fit.kind).toBe("fit");

    const noFit: NegotiationExpr = { kind: "no-fit" };
    expect(noFit.kind).toBe("no-fit");

    const forcing: NegotiationExpr = { kind: "forcing", level: HandStrength.Game };
    expect(forcing.kind).toBe("forcing");

    const overcalled: NegotiationExpr = {
      kind: "overcalled",
      below: { level: 2, strain: ObsSuit.Hearts },
    };
    expect(overcalled.kind).toBe("overcalled");

    const combined: NegotiationExpr = {
      kind: "and",
      exprs: [
        { kind: "uncontested" },
        { kind: "not", expr: { kind: "forcing", level: HandStrength.Game } },
      ],
    };
    expect(combined.kind).toBe("and");
  });

  it("constructs StateEntry with match conditions and surfaces", () => {
    const entry: StateEntry<"idle" | "asked"> = {
      phase: "asked",
      turn: TurnRole.Responder,
      kernel: { kind: "uncontested" },
      route: {
        kind: "last",
        pattern: { act: "deny", feature: "majorSuit" },
      },
      surfaces: [
        {
          meaningId: "test",
          semanticClassId: "test:class",
          teachingLabel: tl("Test surface"),
        // any: BidMeaning has many fields; test only exercises type compatibility
        } as never,
      ],
    };
    expect(entry.turn).toBe(TurnRole.Responder);
    expect(entry.surfaces).toHaveLength(1);
  });

  it("constructs StateEntry with optional negotiationDelta", () => {
    const entry: StateEntry<"idle" | "active"> = {
      phase: "active",
      turn: TurnRole.Opener,
      surfaces: [
        { meaningId: "test", semanticClassId: "test:class", teachingLabel: tl("Test") } as never,
      ],
      negotiationDelta: { forcing: "one-round", captain: "responder" },
    };
    expect(entry.negotiationDelta).toEqual({
      forcing: "one-round",
      captain: "responder",
    });
  });

  it("allows StateEntry without negotiationDelta", () => {
    const entry: StateEntry<"idle"> = {
      phase: "idle",
      surfaces: [
        { meaningId: "test", semanticClassId: "test:class", teachingLabel: tl("Test") } as never,
      ],
    };
    expect(entry.negotiationDelta).toBeUndefined();
  });
});
