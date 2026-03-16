/**
 * Tests for ModulePackage types and the ConventionBundle ↔ ModulePackage adapter.
 *
 * Uses synthetic fixtures only — zero imports from convention definitions.
 */

import { describe, it, expect } from "vitest";
import { BidSuit } from "../../../../engine/types";
import type { Call } from "../../../../engine/types";
import type { MeaningSurface } from "../../../../core/contracts/meaning";
import type { FactCatalogExtension, FactEvaluatorFn } from "../../../../core/contracts/fact-catalog";
import type { ExplanationEntry } from "../../../../core/contracts/explanation-catalog";
import type { PedagogicalRelation } from "../../../../core/contracts/teaching-projection";
import type { MachineState } from "../../runtime/machine-types";
import { buildConversationMachine } from "../../runtime/machine-types";
import type { ConventionBundle } from "../../bundle/bundle-types";
import { ConventionCategory } from "../../types";
import type {
  ModulePackage,
} from "../module-package";
import type { MachineFragment, FrontierDeclaration } from "../machine-fragment";
import type { HandoffSpec, HandoffTrigger } from "../handoff";
import type { SurfaceEmitterSpec } from "../surface-emitter";
import {
  conventionBundleToPackages,
  packagesToConventionBundle,
} from "../legacy-adapter";

// ═══════════════════════════════════════════════════════════════
// Synthetic test data
// ═══════════════════════════════════════════════════════════════

const CALLS = {
  bid1NT: { type: "bid", level: 1, strain: BidSuit.NoTrump } as Call,
  bid2C: { type: "bid", level: 2, strain: BidSuit.Clubs } as Call,
  bid2H: { type: "bid", level: 2, strain: BidSuit.Hearts } as Call,
  bid3NT: { type: "bid", level: 3, strain: BidSuit.NoTrump } as Call,
  pass: { type: "pass" } as Call,
};

function makeSurface(overrides: Partial<MeaningSurface> = {}): MeaningSurface {
  return {
    meaningId: "test:surface",
    semanticClassId: "test:class",
    moduleId: "test-module",
    encoding: { defaultCall: CALLS.bid2C },
    clauses: [],
    ranking: {
      recommendationBand: "should",
      specificity: 1,
      modulePrecedence: 0,
      intraModuleOrder: 0,
    },
    sourceIntent: { type: "test", params: {} },
    teachingLabel: "Test surface",
    ...overrides,
  } as MeaningSurface;
}

function makeFactExtension(): FactCatalogExtension {
  const evaluator: FactEvaluatorFn = () => ({ factId: "module.test.flag", value: true });
  return {
    definitions: [
      {
        id: "module.test.flag",
        layer: "module-derived" as const,
        world: "acting-hand" as const,
        description: "Test flag",
        valueType: "boolean" as const,
      },
    ],
    evaluators: new Map([["module.test.flag", evaluator]]),
  };
}

function makeExplanationEntries(): ExplanationEntry[] {
  return [
    {
      explanationId: "test:explain-1",
      templateKey: "test.explain.1",
      preferredLevel: "semantic",
      roles: ["supporting"],
    },
  ];
}

function makePedagogicalRelations(): PedagogicalRelation[] {
  return [
    { kind: "same-family", a: "test:bid-a", b: "test:bid-b" },
  ];
}

function makeMachineStates(): MachineState[] {
  return [
    {
      stateId: "idle",
      parentId: null,
      transitions: [
        {
          transitionId: "detect-1nt",
          match: { kind: "call", level: 1, strain: BidSuit.NoTrump },
          target: "opened",
        },
      ],
    },
    {
      stateId: "opened",
      parentId: null,
      surfaceGroupId: "responder-r1",
      transitions: [
        {
          transitionId: "responder-bids",
          match: { kind: "any-bid" },
          target: "terminal",
        },
      ],
    },
    {
      stateId: "terminal",
      parentId: null,
      transitions: [],
    },
  ];
}

function makeSyntheticBundle(
  overrides: Partial<ConventionBundle> = {},
): ConventionBundle {
  const surface1 = makeSurface({
    meaningId: "test:ask",
    moduleId: "test-asking",
    semanticClassId: "test:ask-class",
    teachingLabel: "Test ask",
  });
  const surface2 = makeSurface({
    meaningId: "test:signoff",
    moduleId: "test-natural",
    semanticClassId: "test:signoff-class",
    encoding: { defaultCall: CALLS.bid3NT },
    teachingLabel: "Test signoff",
  });

  return {
    id: "test-bundle",
    name: "Test Bundle",
    memberIds: ["test-asking", "test-natural"],
    dealConstraints: { seats: [] },
    meaningSurfaces: [
      { groupId: "responder-r1", surfaces: [surface1] },
      { groupId: "opener-r2", surfaces: [surface2] },
    ],
    factExtensions: [makeFactExtension()],
    explanationCatalog: {
      version: "1.0.0",
      entries: makeExplanationEntries(),
    },
    pedagogicalRelations: makePedagogicalRelations(),
    conversationMachine: buildConversationMachine(
      "test-machine",
      makeMachineStates(),
    ),
    category: ConventionCategory.Asking,
    description: "Test bundle for module-package tests",
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// ModulePackage structural shape tests
// ═══════════════════════════════════════════════════════════════

describe("ModulePackage structural shape", () => {
  it("has required moduleId and exports fields", () => {
    const pkg: ModulePackage = {
      moduleId: "test-mod",
      exports: {},
      runtime: {},
    };
    expect(pkg.moduleId).toBe("test-mod");
    expect(pkg.exports).toBeDefined();
    expect(pkg.runtime).toBeDefined();
  });

  it("exports section accepts capabilities, facts, surfaces, explanations, relations, semanticClasses", () => {
    const pkg: ModulePackage = {
      moduleId: "test-mod",
      exports: {
        capabilities: ["cap-a", "cap-b"],
        facts: makeFactExtension(),
        surfaces: [
          {
            surfaceGroupId: "group-1",
            surfaces: [makeSurface()],
          },
        ],
        explanationEntries: makeExplanationEntries(),
        pedagogicalRelations: makePedagogicalRelations(),
        semanticClasses: ["test:class-a"],
      },
      runtime: {},
    };
    expect(pkg.exports.capabilities).toHaveLength(2);
    expect(pkg.exports.facts?.definitions).toHaveLength(1);
    expect(pkg.exports.surfaces).toHaveLength(1);
    expect(pkg.exports.explanationEntries).toHaveLength(1);
    expect(pkg.exports.pedagogicalRelations).toHaveLength(1);
    expect(pkg.exports.semanticClasses).toHaveLength(1);
  });

  it("runtime section accepts activation, machineFragment, surfaceEmitter, handoffs", () => {
    const fragment: MachineFragment = {
      states: makeMachineStates(),
      entryTransitions: [
        {
          transitionId: "entry-t",
          match: { kind: "call", level: 1, strain: BidSuit.NoTrump },
          target: "opened",
        },
      ],
      exportedFrontiers: [
        { frontierId: "test:deny-major", stateId: "terminal" },
      ],
    };

    const handoff: HandoffSpec = {
      trigger: { kind: "frontier", frontierId: "test:deny-major" },
      transitions: [
        {
          transitionId: "handoff-t",
          match: { kind: "any-bid" },
          target: "some-state",
        },
      ],
    };

    const emitter: SurfaceEmitterSpec = { kind: "group-match" };

    const pkg: ModulePackage = {
      moduleId: "test-mod",
      exports: {},
      runtime: {
        activation: [{ requiresCapabilities: ["opening.1nt"] }],
        machineFragment: fragment,
        surfaceEmitter: emitter,
        handoffs: [handoff],
      },
    };

    expect(pkg.runtime.activation).toHaveLength(1);
    expect(pkg.runtime.machineFragment?.states).toHaveLength(3);
    expect(pkg.runtime.machineFragment?.exportedFrontiers).toHaveLength(1);
    expect(pkg.runtime.surfaceEmitter?.kind).toBe("group-match");
    expect(pkg.runtime.handoffs).toHaveLength(1);
  });

  it("supports optional meta and requires fields", () => {
    const pkg: ModulePackage = {
      moduleId: "test-mod",
      meta: { description: "A test module", kind: "add-on" },
      requires: [
        { moduleId: "base-system", optional: false },
        { moduleId: "optional-dep", optional: true },
      ],
      exports: {},
      runtime: {},
    };
    expect(pkg.meta?.kind).toBe("add-on");
    expect(pkg.requires).toHaveLength(2);
    expect(pkg.requires?.[1]?.optional).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// MachineFragment structural tests
// ═══════════════════════════════════════════════════════════════

describe("MachineFragment", () => {
  it("can declare exported frontiers for cross-module handoff", () => {
    const frontier: FrontierDeclaration = {
      frontierId: "stayman:deny-major",
      stateId: "deny-state",
    };
    const fragment: MachineFragment = {
      states: [],
      entryTransitions: [],
      exportedFrontiers: [frontier],
    };
    expect(fragment.exportedFrontiers?.[0]?.frontierId).toBe("stayman:deny-major");
    expect(fragment.exportedFrontiers?.[0]?.stateId).toBe("deny-state");
  });

  it("holds submachines as a map from machineId to ConversationMachine", () => {
    const submachine = buildConversationMachine("sub-1", [
      { stateId: "sub-idle", parentId: null, transitions: [] },
    ], "sub-idle");

    const fragment: MachineFragment = {
      states: [],
      entryTransitions: [],
      submachines: new Map([["sub-1", submachine]]),
    };
    expect(fragment.submachines?.get("sub-1")?.machineId).toBe("sub-1");
  });
});

// ═══════════════════════════════════════════════════════════════
// HandoffSpec structural tests
// ═══════════════════════════════════════════════════════════════

describe("HandoffSpec", () => {
  it("supports frontier trigger", () => {
    const trigger: HandoffTrigger = { kind: "frontier", frontierId: "test:frontier" };
    const handoff: HandoffSpec = {
      trigger,
      transitions: [],
    };
    expect(handoff.trigger.kind).toBe("frontier");
  });

  it("supports capability trigger", () => {
    const trigger: HandoffTrigger = { kind: "capability", capabilityId: "opening.1nt" };
    const handoff: HandoffSpec = {
      trigger,
      transitions: [],
    };
    expect(handoff.trigger.kind).toBe("capability");
  });

  it("supports visible-meaning trigger", () => {
    const trigger: HandoffTrigger = {
      kind: "visible-meaning",
      semanticClassId: "bridge:game-invite",
    };
    const handoff: HandoffSpec = {
      trigger,
      transitions: [],
      surfaces: [makeSurface()],
    };
    expect(handoff.trigger.kind).toBe("visible-meaning");
    expect(handoff.surfaces).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// Legacy adapter: ConventionBundle → ModulePackage[]
// ═══════════════════════════════════════════════════════════════

describe("conventionBundleToPackages", () => {
  it("maps meaningSurfaces groups to surface contributions in exports", () => {
    const bundle = makeSyntheticBundle();
    const packages = conventionBundleToPackages(bundle);

    // Bundle has two surface groups → should produce a package with two surface contributions
    expect(packages.length).toBeGreaterThanOrEqual(1);
    const allSurfaces = packages.flatMap(p => p.exports.surfaces ?? []);
    expect(allSurfaces).toHaveLength(2);
    expect(allSurfaces[0]!.surfaceGroupId).toBe("responder-r1");
    expect(allSurfaces[1]!.surfaceGroupId).toBe("opener-r2");
  });

  it("maps factExtensions to exports.facts", () => {
    const bundle = makeSyntheticBundle();
    const packages = conventionBundleToPackages(bundle);

    const factsPackages = packages.filter(p => p.exports.facts !== undefined);
    expect(factsPackages.length).toBeGreaterThanOrEqual(1);
    const facts = factsPackages[0]!.exports.facts!;
    expect(facts.definitions).toHaveLength(1);
    expect(facts.definitions[0]!.id).toBe("module.test.flag");
  });

  it("maps explanationCatalog entries to exports.explanationEntries", () => {
    const bundle = makeSyntheticBundle();
    const packages = conventionBundleToPackages(bundle);

    const explPackages = packages.filter(p =>
      (p.exports.explanationEntries?.length ?? 0) > 0,
    );
    expect(explPackages.length).toBeGreaterThanOrEqual(1);
    expect(explPackages[0]!.exports.explanationEntries![0]!.explanationId)
      .toBe("test:explain-1");
  });

  it("maps pedagogicalRelations to exports.pedagogicalRelations", () => {
    const bundle = makeSyntheticBundle();
    const packages = conventionBundleToPackages(bundle);

    const relPackages = packages.filter(p =>
      (p.exports.pedagogicalRelations?.length ?? 0) > 0,
    );
    expect(relPackages.length).toBeGreaterThanOrEqual(1);
    expect(relPackages[0]!.exports.pedagogicalRelations![0]!.kind)
      .toBe("same-family");
  });

  it("maps conversationMachine states to runtime.machineFragment", () => {
    const bundle = makeSyntheticBundle();
    const packages = conventionBundleToPackages(bundle);

    const machinePackages = packages.filter(p =>
      p.runtime.machineFragment !== undefined,
    );
    expect(machinePackages.length).toBeGreaterThanOrEqual(1);
    const fragment = machinePackages[0]!.runtime.machineFragment!;
    expect(fragment.states.length).toBe(3);
    expect(fragment.states.map(s => s.stateId)).toContain("idle");
    expect(fragment.states.map(s => s.stateId)).toContain("opened");
    expect(fragment.states.map(s => s.stateId)).toContain("terminal");
  });

  it("extracts entry transitions from the initial state", () => {
    const bundle = makeSyntheticBundle();
    const packages = conventionBundleToPackages(bundle);

    const machinePackages = packages.filter(p =>
      p.runtime.machineFragment !== undefined,
    );
    const fragment = machinePackages[0]!.runtime.machineFragment!;
    expect(fragment.entryTransitions.length).toBeGreaterThan(0);
    expect(fragment.entryTransitions[0]!.transitionId).toBe("detect-1nt");
  });

  it("maps systemProfile attachments to runtime.activation", () => {
    const bundle = makeSyntheticBundle({
      systemProfile: {
        profileId: "test-profile",
        baseSystem: "test-system",
        modules: [
          {
            moduleId: "test-asking",
            kind: "base-system",
            attachments: [{ requiresCapabilities: ["opening.1nt"] }],
          },
        ],
        conflictPolicy: { activationDefault: "simultaneous" },
      },
    });

    const packages = conventionBundleToPackages(bundle);
    const activationPackages = packages.filter(p =>
      (p.runtime.activation?.length ?? 0) > 0,
    );
    expect(activationPackages.length).toBeGreaterThanOrEqual(1);
  });

  it("produces a package per memberIds when present", () => {
    const bundle = makeSyntheticBundle();
    const packages = conventionBundleToPackages(bundle);

    // The bundle has memberIds: ["test-asking", "test-natural"]
    // Plus the bundle itself acts as a container
    const moduleIds = packages.map(p => p.moduleId);
    expect(moduleIds).toContain("test-bundle");
  });

  it("handles bundle with no meaningSurfaces gracefully", () => {
    const bundle = makeSyntheticBundle({
      meaningSurfaces: undefined,
    });
    const packages = conventionBundleToPackages(bundle);
    expect(packages.length).toBeGreaterThanOrEqual(1);
    const allSurfaces = packages.flatMap(p => p.exports.surfaces ?? []);
    expect(allSurfaces).toHaveLength(0);
  });

  it("handles bundle with no conversationMachine gracefully", () => {
    const bundle = makeSyntheticBundle({
      conversationMachine: undefined,
    });
    const packages = conventionBundleToPackages(bundle);
    const machinePackages = packages.filter(p =>
      p.runtime.machineFragment !== undefined,
    );
    expect(machinePackages).toHaveLength(0);
  });

  it("collects semantic class IDs from surfaces into exports.semanticClasses", () => {
    const bundle = makeSyntheticBundle();
    const packages = conventionBundleToPackages(bundle);

    const allClasses = packages.flatMap(p => p.exports.semanticClasses ?? []);
    expect(allClasses).toContain("test:ask-class");
    expect(allClasses).toContain("test:signoff-class");
  });
});

// ═══════════════════════════════════════════════════════════════
// Round-trip: bundle → packages → bundle
// ═══════════════════════════════════════════════════════════════

describe("round-trip: bundle → packages → bundle", () => {
  it("preserves surface groups", () => {
    const original = makeSyntheticBundle();
    const packages = conventionBundleToPackages(original);
    const restored = packagesToConventionBundle(packages, {
      id: original.id,
      name: original.name,
      dealConstraints: original.dealConstraints,
    });

    expect(restored.meaningSurfaces).toHaveLength(2);
    expect(restored.meaningSurfaces![0]!.groupId).toBe("responder-r1");
    expect(restored.meaningSurfaces![1]!.groupId).toBe("opener-r2");
    expect(restored.meaningSurfaces![0]!.surfaces).toHaveLength(1);
    expect(restored.meaningSurfaces![1]!.surfaces).toHaveLength(1);
  });

  it("preserves fact extensions", () => {
    const original = makeSyntheticBundle();
    const packages = conventionBundleToPackages(original);
    const restored = packagesToConventionBundle(packages, {
      id: original.id,
      name: original.name,
      dealConstraints: original.dealConstraints,
    });

    expect(restored.factExtensions).toBeDefined();
    expect(restored.factExtensions!.length).toBeGreaterThanOrEqual(1);
    expect(restored.factExtensions![0]!.definitions[0]!.id).toBe("module.test.flag");
  });

  it("preserves explanation entries", () => {
    const original = makeSyntheticBundle();
    const packages = conventionBundleToPackages(original);
    const restored = packagesToConventionBundle(packages, {
      id: original.id,
      name: original.name,
      dealConstraints: original.dealConstraints,
    });

    expect(restored.explanationCatalog).toBeDefined();
    expect(restored.explanationCatalog!.entries).toHaveLength(1);
    expect(restored.explanationCatalog!.entries[0]!.explanationId).toBe("test:explain-1");
  });

  it("preserves pedagogical relations", () => {
    const original = makeSyntheticBundle();
    const packages = conventionBundleToPackages(original);
    const restored = packagesToConventionBundle(packages, {
      id: original.id,
      name: original.name,
      dealConstraints: original.dealConstraints,
    });

    expect(restored.pedagogicalRelations).toHaveLength(1);
    expect(restored.pedagogicalRelations![0]!.kind).toBe("same-family");
  });

  it("preserves surface content across round-trip", () => {
    const original = makeSyntheticBundle();
    const packages = conventionBundleToPackages(original);
    const restored = packagesToConventionBundle(packages, {
      id: original.id,
      name: original.name,
      dealConstraints: original.dealConstraints,
    });

    const originalSurface = original.meaningSurfaces![0]!.surfaces[0]!;
    const restoredSurface = restored.meaningSurfaces![0]!.surfaces[0]!;
    expect(restoredSurface.meaningId).toBe(originalSurface.meaningId);
    expect(restoredSurface.moduleId).toBe(originalSurface.moduleId);
    expect(restoredSurface.semanticClassId).toBe(originalSurface.semanticClassId);
  });
});
