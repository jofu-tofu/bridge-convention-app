import { describe, it, expect } from "vitest";
import {
  createFactCatalog,
} from "../fact-catalog";
import { SHARED_FACTS, POSTERIOR_DERIVED_FACTS } from "../shared-facts";
import { FactLayer } from '../fact-layer';
import type { FactCatalog, FactCatalogExtension } from "../fact-catalog";
import type { PosteriorFactEvaluatorFn, PosteriorFactEvaluator } from "../fact-catalog";
import { SHARED_POSTERIOR_FACT_IDS } from "../posterior";

describe("POSTERIOR_DERIVED_FACTS", () => {
  it("has exactly 5 shared entries (NT-specific facts moved to nt-bundle)", () => {
    expect(POSTERIOR_DERIVED_FACTS).toHaveLength(5);
  });

  it("all entries have world=acting-hand, layer=bridge-derived, valueType=number", () => {
    for (const fact of POSTERIOR_DERIVED_FACTS) {
      expect(fact.world).toBe("acting-hand");
      expect(fact.layer).toBe(FactLayer.BridgeDerived);
      expect(fact.valueType).toBe("number");
    }
  });

  it("all entries have inferable and explainable metadata", () => {
    for (const fact of POSTERIOR_DERIVED_FACTS) {
      expect(fact.metadata?.inferable).toBe(true);
      expect(fact.metadata?.explainable).toBe(true);
    }
  });
});

describe("SHARED_FACTS includes posterior facts", () => {
  it("has 20 entries (6 primitive + 9 bridge-derived + 5 shared posterior)", () => {
    expect(SHARED_FACTS).toHaveLength(20);
  });

  it("includes all shared posterior fact IDs", () => {
    const sharedIds = new Set(SHARED_FACTS.map((f) => f.id));
    for (const id of SHARED_POSTERIOR_FACT_IDS) {
      expect(sharedIds.has(id)).toBe(true);
    }
  });
});

describe("SHARED_POSTERIOR_FACT_IDS", () => {
  it("has exactly 5 entries matching POSTERIOR_DERIVED_FACTS", () => {
    expect(SHARED_POSTERIOR_FACT_IDS).toHaveLength(5);
    const definedIds = POSTERIOR_DERIVED_FACTS.map((f) => f.id);
    for (const id of SHARED_POSTERIOR_FACT_IDS) {
      expect(definedIds).toContain(id);
    }
  });
});

describe("createFactCatalog merges posteriorEvaluators", () => {
  it("merges posteriorEvaluators from extension into catalog", () => {
    const mockEvaluator: PosteriorFactEvaluatorFn = (_provider, req) => ({
      factId: req.factId,
      value: 0.5,
    });

    const base: FactCatalog = {
      definitions: [],
      evaluators: new Map(),
    };

    const ext: FactCatalogExtension = {
      definitions: [],
      evaluators: new Map(),
      posteriorEvaluators: new Map<string, PosteriorFactEvaluator>([
        ["bridge.partnerHas4HeartsLikely", { evaluate: mockEvaluator }],
      ]),
    };

    const result = createFactCatalog(base, ext);
    expect(result.posteriorEvaluators).toBeDefined();
    expect(result.posteriorEvaluators!.size).toBe(1);
    expect(result.posteriorEvaluators!.has("bridge.partnerHas4HeartsLikely")).toBe(true);
  });

  it("merges posteriorEvaluators from multiple extensions", () => {
    const mockEval1: PosteriorFactEvaluatorFn = (_p, r) => ({ factId: r.factId, value: 0.1 });
    const mockEval2: PosteriorFactEvaluatorFn = (_p, r) => ({ factId: r.factId, value: 0.9 });

    const base: FactCatalog = { definitions: [], evaluators: new Map() };

    const ext1: FactCatalogExtension = {
      definitions: [],
      evaluators: new Map(),
      posteriorEvaluators: new Map([["bridge.partnerHas4HeartsLikely", { evaluate: mockEval1 }]]),
    };
    const ext2: FactCatalogExtension = {
      definitions: [],
      evaluators: new Map(),
      posteriorEvaluators: new Map([["module.stayman.nsHaveEightCardFitLikely", { evaluate: mockEval2 }]]),
    };

    const result = createFactCatalog(base, ext1, ext2);
    expect(result.posteriorEvaluators!.size).toBe(2);
  });

  it("returns undefined posteriorEvaluators when no extensions have them", () => {
    const base: FactCatalog = { definitions: [], evaluators: new Map() };
    const ext: FactCatalogExtension = { definitions: [], evaluators: new Map() };
    const result = createFactCatalog(base, ext);
    expect(result.posteriorEvaluators).toBeUndefined();
  });
});
