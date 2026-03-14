import { describe, it, expect } from "vitest";
import {
  meaningToStrategy,
  meaningBundleToStrategy,
} from "../bidding/meaning-strategy";
import type { AlternativeGroup, IntentFamily } from "../../core/contracts/tree-evaluation";
import type { FactCatalogExtension } from "../../core/contracts/fact-catalog";
import { createFactCatalog } from "../../core/contracts/fact-catalog";
import { createSharedFactCatalog } from "../../conventions/core/pipeline/fact-evaluator";
import { hand } from "../../engine/__tests__/fixtures";
import { buildAuction } from "../../engine/auction-helpers";
import { Seat, BidSuit } from "../../engine/types";
import { makeTestSurface, makeContext, strongHandWith4Spades } from "./strategy-test-helpers";

// 5 HCP hand with 4 spades: S5 S4 S3 S2 HK H3 D5 D4 D3 D2 C5 C4 C3
const weakHandWith4Spades = hand(
  "S5", "S4", "S3", "S2",
  "HK", "H3",
  "D5", "D4", "D3", "D2",
  "C5", "C4", "C3",
);

describe("meaningToStrategy", () => {
  it("returns BidResult when hand satisfies all surface clauses", () => {
    const surface = makeTestSurface();
    const strategy = meaningToStrategy([surface], "test-module");
    const context = makeContext(strongHandWith4Spades);

    const result = strategy.suggest(context);

    expect(result).not.toBeNull();
    expect(result!.call).toEqual({
      type: "bid",
      level: 2,
      strain: BidSuit.Clubs,
    });
    expect(result!.ruleName).toBe("test:ask");
    expect(result!.meaning).toBe("test:ask");
    expect(result!.explanation).toBe("test:ask");
    expect(result!.handSummary).toBeTruthy();
  });

  it("returns null when hand does not satisfy clauses", () => {
    const surface = makeTestSurface();
    const strategy = meaningToStrategy([surface], "test-module");
    const context = makeContext(weakHandWith4Spades);

    const result = strategy.suggest(context);

    expect(result).toBeNull();
  });

  it("has correct id and name from options", () => {
    const strategy = meaningToStrategy([], "mod-id", {
      name: "My Module",
    });

    expect(strategy.id).toBe("mod-id");
    expect(strategy.name).toBe("My Module");
  });

  it("defaults name to moduleId when no name option", () => {
    const strategy = meaningToStrategy([], "mod-id");

    expect(strategy.name).toBe("mod-id");
  });

  it("returns null when no surfaces are provided", () => {
    const strategy = meaningToStrategy([], "empty");
    const context = makeContext(strongHandWith4Spades);

    const result = strategy.suggest(context);

    expect(result).toBeNull();
  });

  it("includes evaluationTrace with conventionId", () => {
    const surface = makeTestSurface();
    const strategy = meaningToStrategy([surface], "test-module");
    const context = makeContext(strongHandWith4Spades);

    const result = strategy.suggest(context);

    expect(result!.evaluationTrace).toBeDefined();
    expect(result!.evaluationTrace!.conventionId).toBe("test-module");
  });
});

describe("meaningToStrategy accessors and extensions", () => {
  it("getLastProvenance() returns provenance after suggest", () => {
    const surface = makeTestSurface();
    const strategy = meaningToStrategy([surface], "test-module");
    const context = makeContext(strongHandWith4Spades);

    const result = strategy.suggest(context);

    expect(result).not.toBeNull();
    const provenance = strategy.getLastProvenance();
    expect(provenance).not.toBeNull();
    expect(provenance!.applicability).toBeDefined();
    expect(provenance!.arbitration.length).toBeGreaterThan(0);
  });

  it("getLastArbitration() returns arbitration result after suggest", () => {
    const surface = makeTestSurface();
    const strategy = meaningToStrategy([surface], "test-module");
    const context = makeContext(strongHandWith4Spades);

    strategy.suggest(context);

    const arbitration = strategy.getLastArbitration();
    expect(arbitration).not.toBeNull();
    expect(arbitration!.selected).not.toBeNull();
    expect(arbitration!.truthSet.length).toBeGreaterThan(0);
  });

  it("getLastProvenance() is null before first suggest", () => {
    const strategy = meaningToStrategy([], "test-module");
    expect(strategy.getLastProvenance()).toBeNull();
  });

  it("getLastArbitration() is null before first suggest", () => {
    const strategy = meaningToStrategy([], "test-module");
    expect(strategy.getLastArbitration()).toBeNull();
  });

  it("getLastProvenance() resets to null on no-match suggest", () => {
    const surface = makeTestSurface();
    const strategy = meaningToStrategy([surface], "test-module");

    // First: match
    strategy.suggest(makeContext(strongHandWith4Spades));
    expect(strategy.getLastProvenance()).not.toBeNull();

    // Second: no match → provenance still populated (provenance is always set)
    strategy.suggest(makeContext(weakHandWith4Spades));
    // Provenance should still be populated even when no candidate selected
    const prov = strategy.getLastProvenance();
    expect(prov).not.toBeNull();
    expect(prov!.eliminations.length).toBeGreaterThan(0);
  });

  it("getAcceptableAlternatives() returns configured alternatives", () => {
    const alts: readonly AlternativeGroup[] = [
      {
        label: "Test group",
        members: ["test:ask"],
        tier: "preferred",
      },
    ];
    const strategy = meaningToStrategy([], "test-module", {
      acceptableAlternatives: alts,
    });

    expect(strategy.getAcceptableAlternatives()).toBe(alts);
  });

  it("getIntentFamilies() returns configured families", () => {
    const families: readonly IntentFamily[] = [
      {
        id: "test-family",
        label: "Test Family",
        description: "Test family description",
        relationship: "mutually_exclusive",
        members: ["test:ask"],
      },
    ];
    const strategy = meaningToStrategy([], "test-module", {
      intentFamilies: families,
    });

    expect(strategy.getIntentFamilies()).toBe(families);
  });

  it("uses provided factCatalog extension", () => {
    // Create a surface that checks a module fact
    const moduleSurface = makeTestSurface({
      meaningId: "mod:custom",
      clauses: [
        {
          clauseId: "custom-fact",
          factId: "module.custom.check",
          operator: "boolean",
          value: true,
          description: "Custom module fact",
        },
      ],
    });

    // Extension that always evaluates to true
    const ext: FactCatalogExtension = {
      definitions: [{
        id: "module.custom.check",
        layer: "module-derived" as const,
        world: "acting-hand" as const,
        description: "Custom",
        valueType: "boolean" as const,
        derivesFrom: [],
      }],
      evaluators: new Map([
        ["module.custom.check", () => ({ factId: "module.custom.check", value: true })],
      ]),
    };

    const catalog = createFactCatalog(createSharedFactCatalog(), ext);

    const strategy = meaningToStrategy([moduleSurface], "custom-mod", {
      factCatalog: catalog,
    });

    const result = strategy.suggest(makeContext(strongHandWith4Spades));
    expect(result).not.toBeNull();
    expect(result!.ruleName).toBe("mod:custom");
  });
});

describe("meaningBundleToStrategy", () => {
  it("arbitrates across multiple modules and selects best", () => {
    const surface1 = makeTestSurface({
      meaningId: "mod-a:ask",
      moduleId: "mod-a",
      ranking: {
        recommendationBand: "should",
        specificity: 2,
        modulePrecedence: 2,
        intraModuleOrder: 0,
      },
    });

    const surface2 = makeTestSurface({
      meaningId: "mod-b:ask",
      moduleId: "mod-b",
      encoding: {
        defaultCall: { type: "bid", level: 2, strain: BidSuit.Diamonds },
      },
      ranking: {
        recommendationBand: "must",
        specificity: 2,
        modulePrecedence: 1,
        intraModuleOrder: 0,
      },
    });

    const strategy = meaningBundleToStrategy(
      [
        { moduleId: "mod-a", surfaces: [surface1] },
        { moduleId: "mod-b", surfaces: [surface2] },
      ],
      "test-bundle",
      { name: "Test Bundle" },
    );

    const context = makeContext(strongHandWith4Spades);
    const result = strategy.suggest(context);

    expect(result).not.toBeNull();
    // mod-b has "must" band vs mod-a "should" — mod-b wins
    expect(result!.ruleName).toBe("mod-b:ask");
    expect(result!.call).toEqual({
      type: "bid",
      level: 2,
      strain: BidSuit.Diamonds,
    });
  });

  it("returns null when no surface in any module matches", () => {
    const surface = makeTestSurface({
      moduleId: "mod-a",
      clauses: [
        {
          clauseId: "hcp",
          factId: "hand.hcp",
          operator: "gte",
          value: 30,
          description: "30+ HCP",
        },
      ],
    });

    const strategy = meaningBundleToStrategy(
      [{ moduleId: "mod-a", surfaces: [surface] }],
      "test-bundle",
    );

    const context = makeContext(strongHandWith4Spades);
    const result = strategy.suggest(context);

    expect(result).toBeNull();
  });

  it("has correct id and name", () => {
    const strategy = meaningBundleToStrategy([], "bundle-id", {
      name: "Bundle Name",
    });

    expect(strategy.id).toBe("bundle-id");
    expect(strategy.name).toBe("Bundle Name");
  });

  it("returns null when no candidate (defers to chain)", () => {
    const surface = makeTestSurface({
      clauses: [
        {
          clauseId: "impossible",
          factId: "hand.hcp",
          operator: "gte",
          value: 40,
          description: "40+ HCP (impossible)",
        },
      ],
    });

    const strategy = meaningBundleToStrategy(
      [{ moduleId: "mod-a", surfaces: [surface] }],
      "test-bundle",
    );

    const context = makeContext(strongHandWith4Spades);
    const result = strategy.suggest(context);

    expect(result).toBeNull();
  });

  it("getLastProvenance() and getLastArbitration() populated after suggest", () => {
    const surface = makeTestSurface();
    const strategy = meaningBundleToStrategy(
      [{ moduleId: "mod-a", surfaces: [surface] }],
      "test-bundle",
    );

    const context = makeContext(strongHandWith4Spades);
    strategy.suggest(context);

    expect(strategy.getLastProvenance()).not.toBeNull();
    expect(strategy.getLastArbitration()).not.toBeNull();
    expect(strategy.getLastArbitration()!.selected).not.toBeNull();
  });

  it("surfaceRouter filters surfaces by auction position", () => {
    const surfaceA = makeTestSurface({
      meaningId: "mod-a:filtered-in",
      moduleId: "mod-a",
    });
    const surfaceB = makeTestSurface({
      meaningId: "mod-b:filtered-out",
      moduleId: "mod-b",
      encoding: {
        defaultCall: { type: "bid", level: 2, strain: BidSuit.Diamonds },
      },
    });

    // Router that only returns surfaceA
    const router = (_auction: ReturnType<typeof buildAuction>, _seat: Seat) => [surfaceA];

    const strategy = meaningBundleToStrategy(
      [
        { moduleId: "mod-a", surfaces: [surfaceA] },
        { moduleId: "mod-b", surfaces: [surfaceB] },
      ],
      "routed-bundle",
      { surfaceRouter: router },
    );

    const context = makeContext(strongHandWith4Spades);
    const result = strategy.suggest(context);

    // Only surfaceA is evaluated, so mod-a:filtered-in should win
    expect(result).not.toBeNull();
    expect(result!.ruleName).toBe("mod-a:filtered-in");
  });

  it("surfaceRouter returning empty array → null result", () => {
    const surface = makeTestSurface();

    const emptyRouter = () => [] as const;

    const strategy = meaningBundleToStrategy(
      [{ moduleId: "mod-a", surfaces: [surface] }],
      "empty-route-bundle",
      { surfaceRouter: emptyRouter },
    );

    const context = makeContext(strongHandWith4Spades);
    const result = strategy.suggest(context);

    expect(result).toBeNull();
  });

  it("getAcceptableAlternatives() and getIntentFamilies() return configured values", () => {
    const alts: readonly AlternativeGroup[] = [
      { label: "G1", members: ["x"], tier: "preferred" },
    ];
    const families: readonly IntentFamily[] = [
      { id: "f1", label: "F", description: "Test", relationship: "mutually_exclusive", members: ["x"] },
    ];

    const strategy = meaningBundleToStrategy([], "test-bundle", {
      acceptableAlternatives: alts,
      intentFamilies: families,
    });

    expect(strategy.getAcceptableAlternatives()).toBe(alts);
    expect(strategy.getIntentFamilies()).toBe(families);
  });
});
