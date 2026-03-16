import { describe, it, expect } from "vitest";
import { compileProfileFromPackages } from "../compile-from-packages";
import type { ModulePackage } from "../../modules";
import type { SystemProfileIR, AttachmentIR } from "../../../../core/contracts/agreement-module";
import type { MeaningSurface } from "../../../../core/contracts/meaning";
import type { MachineState, MachineTransition } from "../../runtime/machine-types";
import { BidSuit } from "../../../../engine/types";
import type { Call } from "../../../../engine/types";

// ─── Synthetic helpers ──────────────────────────────────────

let counter = 0;

function makeCall(level: 1 | 2 | 3 | 4 | 5 | 6 | 7, strain: BidSuit): Call {
  return { type: "bid", level, strain };
}

function makeSyntheticSurface(
  overrides: Partial<MeaningSurface> = {},
): MeaningSurface {
  counter++;
  return {
    meaningId: `test:surface-${counter}`,
    semanticClassId: `test:class-${counter}`,
    moduleId: "test-mod",
    encoding: { defaultCall: makeCall(2, BidSuit.Clubs) },
    clauses: [],
    ranking: {
      recommendationBand: "should",
      specificity: 1,
      modulePrecedence: 0,
      intraModuleOrder: 0,
    },
    sourceIntent: { type: "test", params: {} },
    teachingLabel: `Test surface ${counter}`,
    ...overrides,
  } as MeaningSurface;
}

function makeState(
  stateId: string,
  overrides: Partial<MachineState> = {},
): MachineState {
  return { stateId, parentId: null, transitions: [], ...overrides };
}

function makeTransition(
  target: string,
  overrides: Partial<MachineTransition> = {},
): MachineTransition {
  return {
    transitionId: `t-to-${target}`,
    match: { kind: "any-bid" },
    target,
    ...overrides,
  };
}

function makeAttachment(): AttachmentIR {
  return { whenAuction: { kind: "sequence", calls: [] } };
}

function makeProfile(
  moduleIds: string[],
  overrides: Partial<SystemProfileIR> = {},
): SystemProfileIR {
  return {
    profileId: "test-profile",
    baseSystem: "SAYC",
    modules: moduleIds.map((id) => ({
      moduleId: id,
      kind: "add-on" as const,
      attachments: [makeAttachment()],
    })),
    conflictPolicy: { activationDefault: "simultaneous" as const },
    ...overrides,
  };
}

function makePackage(
  moduleId: string,
  surfaces: MeaningSurface[] = [],
  options: {
    facts?: ModulePackage["exports"]["facts"];
    explanationEntries?: ModulePackage["exports"]["explanationEntries"];
    pedagogicalRelations?: ModulePackage["exports"]["pedagogicalRelations"];
    capabilities?: ModulePackage["exports"]["capabilities"];
    machineFragment?: ModulePackage["runtime"]["machineFragment"];
  } = {},
): ModulePackage {
  return {
    moduleId,
    exports: {
      surfaces: surfaces.length > 0
        ? [{ surfaceGroupId: `${moduleId}-group`, surfaces }]
        : [],
      facts: options.facts,
      explanationEntries: options.explanationEntries,
      pedagogicalRelations: options.pedagogicalRelations,
      capabilities: options.capabilities,
    },
    runtime: {
      machineFragment: options.machineFragment,
    },
  };
}

// ─── Tests ──────────────────────────────────────────────────

describe("compileProfileFromPackages", () => {
  it("compiles a profile from packages without needing a skeleton", () => {
    const surface = makeSyntheticSurface({ moduleId: "mod-a" });
    const pkg = makePackage("mod-a", [surface]);
    const profile = makeProfile(["mod-a"]);

    const compiled = compileProfileFromPackages(profile, [pkg]);

    expect(compiled.profileId).toBe("test-profile");
    expect(compiled.profile).toBe(profile);
  });

  it("merged surfaces appear in resolvedModules", () => {
    const surfaceA = makeSyntheticSurface({ moduleId: "mod-a" });
    const surfaceB = makeSyntheticSurface({ moduleId: "mod-b" });
    const pkgA = makePackage("mod-a", [surfaceA]);
    const pkgB = makePackage("mod-b", [surfaceB]);
    const profile = makeProfile(["mod-a", "mod-b"]);

    const compiled = compileProfileFromPackages(profile, [pkgA, pkgB]);

    expect(compiled.resolvedModules).toHaveLength(2);
    expect(compiled.resolvedModules[0]!.moduleId).toBe("mod-a");
    expect(compiled.resolvedModules[0]!.surfaceGroups[0]!.surfaces).toContain(
      surfaceA,
    );
    expect(compiled.resolvedModules[1]!.moduleId).toBe("mod-b");
  });

  it("merged facts in registries.facts", () => {
    const pkg = makePackage("mod-a", [], {
      facts: {
        definitions: [
          {
            id: "module.test.flag",
            layer: "module-derived",
            world: "acting-hand",
            description: "Test",
            valueType: "boolean",
          },
        ],
        evaluators: new Map(),
      },
    });
    const profile = makeProfile(["mod-a"]);

    const compiled = compileProfileFromPackages(profile, [pkg]);

    expect(
      compiled.registries.facts.definitions.some(
        (d) => d.id === "module.test.flag",
      ),
    ).toBe(true);
  });

  it("merged explanations in registries.explanations", () => {
    const pkg = makePackage("mod-a", [], {
      explanationEntries: [
        {
          explanationId: "exp-1",
          templateKey: "tmpl.exp-1",
          preferredLevel: "semantic",
          roles: ["supporting"],
        },
      ],
    });
    const profile = makeProfile(["mod-a"]);

    const compiled = compileProfileFromPackages(profile, [pkg]);

    expect(compiled.registries.explanations.entries).toHaveLength(1);
    expect(compiled.registries.explanations.entries[0]!.explanationId).toBe(
      "exp-1",
    );
  });

  it("collects pedagogical relations from all packages", () => {
    const pkgA = makePackage("mod-a", [], {
      pedagogicalRelations: [{ kind: "same-family", a: "x", b: "y" }],
    });
    const pkgB = makePackage("mod-b", [], {
      pedagogicalRelations: [{ kind: "stronger-than", a: "p", b: "q" }],
    });
    const profile = makeProfile(["mod-a", "mod-b"]);

    const compiled = compileProfileFromPackages(profile, [pkgA, pkgB]);

    expect(compiled.pedagogicalRelations).toHaveLength(2);
  });

  it("builds activation index from profile modules", () => {
    const profile = makeProfile(["mod-a", "mod-b"]);
    const pkg = makePackage("mod-a");

    const compiled = compileProfileFromPackages(profile, [pkg]);

    expect(
      compiled.indexes.activation.moduleAttachments.has("mod-a"),
    ).toBe(true);
    expect(
      compiled.indexes.activation.moduleAttachments.has("mod-b"),
    ).toBe(true);
  });

  it("builds capability index from packages", () => {
    const pkgA = makePackage("mod-a", [], {
      capabilities: ["opening.1nt", "context.nt-rebid"],
    });
    const pkgB = makePackage("mod-b", [], {
      capabilities: ["opening.major"],
    });
    const profile = makeProfile(["mod-a", "mod-b"]);

    const compiled = compileProfileFromPackages(profile, [pkgA, pkgB]);

    expect(
      compiled.indexes.capabilities.moduleCapabilities.get("mod-a"),
    ).toEqual(["opening.1nt", "context.nt-rebid"]);
    expect(
      compiled.indexes.capabilities.moduleCapabilities.get("mod-b"),
    ).toEqual(["opening.major"]);
  });

  it("assembles conversation machine from package fragments", () => {
    const stateA = makeState("a-start", { surfaceGroupId: "mod-a-group" });
    const pkg = makePackage("mod-a", [], {
      machineFragment: {
        states: [stateA],
        entryTransitions: [
          makeTransition("a-start", {
            transitionId: "enter-a",
            match: { kind: "call", level: 2, strain: BidSuit.Clubs },
          }),
        ],
        exportedFrontiers: [],
      },
    });
    const profile = makeProfile(["mod-a"]);

    const compiled = compileProfileFromPackages(profile, [pkg]);

    expect(compiled.machine.machineId).toBe("test-profile");
    expect(compiled.machine.states.has("idle")).toBe(true);
    expect(compiled.machine.states.has("a-start")).toBe(true);
  });

  it("uses default priority class mapping when profile has none", () => {
    const profile = makeProfile(["mod-a"]);
    const pkg = makePackage("mod-a");

    const compiled = compileProfileFromPackages(profile, [pkg]);

    expect(compiled.policy.priorityClassMapping.obligatory).toBe("must");
    expect(compiled.policy.priorityClassMapping.preferredConventional).toBe(
      "should",
    );
  });

  it("uses profile priority class mapping when provided", () => {
    const profile = makeProfile(["mod-a"], {
      priorityClassMapping: {
        obligatory: "must",
        preferredConventional: "must",
        preferredNatural: "should",
        neutralCorrect: "may",
        fallbackCorrect: "avoid",
      },
    });
    const pkg = makePackage("mod-a");

    const compiled = compileProfileFromPackages(profile, [pkg]);

    expect(compiled.policy.priorityClassMapping.preferredConventional).toBe(
      "must",
    );
  });

  it("accepts machineId option override", () => {
    const profile = makeProfile(["mod-a"]);
    const pkg = makePackage("mod-a");

    const compiled = compileProfileFromPackages(profile, [pkg], {
      machineId: "custom-machine",
    });

    expect(compiled.machine.machineId).toBe("custom-machine");
  });
});
