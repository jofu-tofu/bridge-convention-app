import { describe, it, expect } from "vitest";
import { createSurface } from "../surface-builder";
import type { ModuleContext, SurfaceInput } from "../surface-builder";
import { BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import { SAME_FAMILY } from "../../definitions/teaching-vocabulary";

const bid = (level: number, strain: BidSuit): Call => ({
  type: "bid",
  level: level as 1 | 2 | 3 | 4 | 5 | 6 | 7,
  strain,
});

const CTX: ModuleContext = { moduleId: "test-module" };

function baseInput(overrides?: Partial<SurfaceInput>): SurfaceInput {
  return {
    meaningId: "test:surface",
    semanticClassId: "test:class",
    encoding: { defaultCall: bid(2, BidSuit.Clubs) },
    clauses: [
      { factId: "hand.hcp", operator: "gte", value: 12 },
    ],
    band: "must",
    declarationOrder: 0,
    sourceIntent: { type: "Test", params: {} },
    teachingLabel: "Test surface",
    ...overrides,
  };
}

describe("createSurface", () => {
  it("produces a valid BidMeaning with all fields populated", () => {
    const surface = createSurface(baseInput(), CTX);

    expect(surface.meaningId).toBe("test:surface");
    expect(surface.semanticClassId).toBe("test:class");
    expect(surface.moduleId).toBe("test-module");
    expect(surface.encoding.defaultCall).toEqual(bid(2, BidSuit.Clubs));
    expect(surface.ranking.recommendationBand).toBe("must");
    expect(surface.ranking.modulePrecedence).toBe(0);
    expect(surface.ranking.declarationOrder).toBe(0);
    expect(surface.sourceIntent).toEqual({ type: "Test", params: {} });
    expect(surface.teachingLabel).toBe("Test surface");
  });

  it("injects moduleId from ModuleContext", () => {
    const surface = createSurface(baseInput(), CTX);
    expect(surface.moduleId).toBe("test-module");
  });

  it("defaults modulePrecedence to 0 when no override provided", () => {
    const surface = createSurface(baseInput(), CTX);
    expect(surface.ranking.modulePrecedence).toBe(0);
  });

  it("input moduleId overrides ModuleContext", () => {
    const surface = createSurface(
      baseInput({ moduleId: "override" }),
      CTX,
    );
    expect(surface.moduleId).toBe("override");
  });

  it("precedenceOverride stamps modulePrecedence from composition layer", () => {
    const surface = createSurface(baseInput(), CTX, 5);
    expect(surface.ranking.modulePrecedence).toBe(5);
  });

  it("auto-derives clauseId from factId:operator:value", () => {
    const surface = createSurface(baseInput(), CTX);
    expect(surface.clauses[0]!.clauseId).toBe("hand.hcp:gte:12");
  });

  it("auto-derives description from factId/operator/value", () => {
    const surface = createSurface(baseInput(), CTX);
    expect(surface.clauses[0]!.description).toBe("HCP >= 12");
  });

  it("explicit description on SimplifiedClause overrides auto-derived value", () => {
    const surface = createSurface(
      baseInput({
        clauses: [
          {
            factId: "hand.hcp",
            operator: "gte",
            value: 12,
            description: "12+ HCP for splinter",
          },
        ],
      }),
      CTX,
    );
    expect(surface.clauses[0]!.description).toBe("12+ HCP for splinter");
    // clauseId is still auto-derived
    expect(surface.clauses[0]!.clauseId).toBe("hand.hcp:gte:12");
  });

  it("normalizes bare Call encoding into { defaultCall }", () => {
    const surface = createSurface(
      baseInput({ encoding: bid(3, BidSuit.Hearts) }),
      CTX,
    );
    expect(surface.encoding).toEqual({ defaultCall: bid(3, BidSuit.Hearts) });
  });

  it("passes through already-normalized encoding", () => {
    const enc = {
      defaultCall: bid(2, BidSuit.Diamonds),
      alternateEncodings: [{ call: bid(3, BidSuit.Diamonds) }],
    };
    const surface = createSurface(baseInput({ encoding: enc }), CTX);
    expect(surface.encoding).toEqual(enc);
  });

  it("surface without ModuleContext requires explicit moduleId", () => {
    expect(() => createSurface(baseInput())).toThrow(/moduleId required/);
  });

  it("surface with moduleId on input works without ModuleContext", () => {
    const surface = createSurface(baseInput({ moduleId: "standalone" }));
    expect(surface.moduleId).toBe("standalone");
    expect(surface.ranking.modulePrecedence).toBe(0); // defaults to 0
  });

  it("preserves isPublic on clauses", () => {
    const surface = createSurface(
      baseInput({
        clauses: [
          { factId: "bridge.hasFourCardMajor", operator: "boolean", value: true, isPublic: true },
        ],
      }),
      CTX,
    );
    expect(surface.clauses[0]!.isPublic).toBe(true);
  });

  it("preserves closurePolicy", () => {
    const policy = {
      exclusive: true,
      exhaustive: true,
      mandatory: true,
      domain: { kind: "semantic-class-set" as const, ids: ["a", "b"] },
    };
    const surface = createSurface(baseInput({ closurePolicy: policy }), CTX);
    expect(surface.closurePolicy).toEqual(policy);
  });

  it("preserves surfaceBindings", () => {
    const surface = createSurface(
      baseInput({ surfaceBindings: { suit: "hearts" } }),
      CTX,
    );
    expect(surface.surfaceBindings).toEqual({ suit: "hearts" });
  });

  it("preserves teachingTags", () => {
    const tags = [{ tag: SAME_FAMILY, scope: "test" }];
    const surface = createSurface(
      baseInput({ teachingTags: tags }),
      CTX,
    );
    expect(surface.teachingTags).toEqual(tags);
  });

  it("handles range clause correctly", () => {
    const surface = createSurface(
      baseInput({
        clauses: [
          { factId: "hand.hcp", operator: "range", value: { min: 10, max: 12 } },
        ],
      }),
      CTX,
    );
    expect(surface.clauses[0]!.clauseId).toBe("hand.hcp:range:10-12");
    expect(surface.clauses[0]!.description).toBe("HCP 10-12");
  });

  it("handles boolean clause correctly", () => {
    const surface = createSurface(
      baseInput({
        clauses: [
          { factId: "bridge.hasFiveCardMajor", operator: "boolean", value: false },
        ],
      }),
      CTX,
    );
    expect(surface.clauses[0]!.clauseId).toBe("bridge.hasFiveCardMajor:boolean:false");
    expect(surface.clauses[0]!.description).toBe("no has five card major");
  });

  it("handles multiple clauses", () => {
    const surface = createSurface(
      baseInput({
        clauses: [
          { factId: "hand.hcp", operator: "gte", value: 12 },
          { factId: "hand.suitLength.$suit", operator: "gte", value: 4 },
          { factId: "bridge.hasShortage", operator: "boolean", value: true },
        ],
      }),
      CTX,
    );
    expect(surface.clauses).toHaveLength(3);
    expect(surface.clauses[0]!.clauseId).toBe("hand.hcp:gte:12");
    expect(surface.clauses[1]!.clauseId).toBe("hand.suitLength.$suit:gte:4");
    expect(surface.clauses[2]!.clauseId).toBe("bridge.hasShortage:boolean:true");
  });

  it("handles empty clauses array", () => {
    const surface = createSurface(baseInput({ clauses: [] }), CTX);
    expect(surface.clauses).toHaveLength(0);
  });
});
