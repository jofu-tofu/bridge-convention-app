import { describe, it, expect, vi } from "vitest";
import { composeBundles } from "../composite-builder";
import type { ConventionBundle } from "../bundle-types";
import type { FactCatalogExtension } from "../../../../core/contracts/fact-catalog";
import type { ExplanationCatalogIR } from "../../../../core/contracts/explanation-catalog";
import type { MeaningSurface } from "../../../../core/contracts/meaning";

function makeBundle(
  id: string,
  memberIds: string[] = [],
  extras: Partial<ConventionBundle> = {},
): ConventionBundle {
  return {
    id,
    name: `Bundle ${id}`,
    memberIds,
    dealConstraints: { seats: [] },
    ...extras,
  };
}

describe("composeBundles", () => {
  it("throws when given zero bundles", () => {
    expect(() => composeBundles("empty", "Empty", [])).toThrow(
      "composeBundles requires at least one bundle",
    );
  });

  it("composes two minimal bundles", () => {
    const a = makeBundle("bundle-a", ["conv-a1", "conv-a2"]);
    const b = makeBundle("bundle-b", ["conv-b1"]);

    const composite = composeBundles("composite-ab", "AB Composite", [a, b]);

    expect(composite.id).toBe("composite-ab");
    expect(composite.name).toBe("AB Composite");
  });

  it("merges member IDs from all bundles", () => {
    const a = makeBundle("a", ["conv-1", "conv-2"]);
    const b = makeBundle("b", ["conv-3"]);
    const c = makeBundle("c", ["conv-4", "conv-5"]);

    const composite = composeBundles("abc", "ABC", [a, b, c]);

    expect(composite.memberIds).toEqual([
      "conv-1",
      "conv-2",
      "conv-3",
      "conv-4",
      "conv-5",
    ]);
  });

  it("concatenates meaning surfaces from all bundles", () => {
    const surfaceA = { surfaceId: "s-a" } as unknown as MeaningSurface;
    const surfaceB = { surfaceId: "s-b" } as unknown as MeaningSurface;

    const a = makeBundle("a", [], {
      meaningSurfaces: [{ groupId: "g-a", surfaces: [surfaceA] }],
    });
    const b = makeBundle("b", [], {
      meaningSurfaces: [{ groupId: "g-b", surfaces: [surfaceB] }],
    });

    const composite = composeBundles("ab", "AB", [a, b]);

    expect(composite.meaningSurfaces).toHaveLength(2);
    expect(composite.meaningSurfaces![0]!.groupId).toBe("g-a");
    expect(composite.meaningSurfaces![1]!.groupId).toBe("g-b");
  });

  it("concatenates fact extensions from all bundles", () => {
    const extA: FactCatalogExtension = {
      definitions: [
        {
          id: "fact-a",
          layer: "module-derived",
          world: "acting-hand",
          description: "Fact A",
          valueType: "number",
        },
      ],
      evaluators: new Map(),
    };
    const extB: FactCatalogExtension = {
      definitions: [
        {
          id: "fact-b",
          layer: "module-derived",
          world: "acting-hand",
          description: "Fact B",
          valueType: "boolean",
        },
      ],
      evaluators: new Map(),
    };

    const a = makeBundle("a", [], { factExtensions: [extA] });
    const b = makeBundle("b", [], { factExtensions: [extB] });

    const composite = composeBundles("ab", "AB", [a, b]);

    expect(composite.factExtensions).toHaveLength(2);
    expect(composite.factExtensions![0]).toBe(extA);
    expect(composite.factExtensions![1]).toBe(extB);
  });

  it("returns undefined for optional fields when no bundle provides them", () => {
    const a = makeBundle("a", []);
    const b = makeBundle("b", []);

    const composite = composeBundles("ab", "AB", [a, b]);

    expect(composite.meaningSurfaces).toBeUndefined();
    expect(composite.factExtensions).toBeUndefined();
    expect(composite.pedagogicalRelations).toBeUndefined();
    expect(composite.acceptableAlternatives).toBeUndefined();
    expect(composite.explanationCatalog).toBeUndefined();
    expect(composite.systemProfile).toBeUndefined();
    expect(composite.conversationMachine).toBeUndefined();
    expect(composite.surfaceRouter).toBeUndefined();
  });

  it("merges explanation catalog entries with deduplication", () => {
    const catA: ExplanationCatalogIR = {
      version: "1.0.0",
      entries: [
        {
          explanationId: "exp-1",
          templateKey: "tpl-1",
          preferredLevel: "semantic",
          roles: ["supporting"],
        },
        {
          explanationId: "exp-shared",
          templateKey: "tpl-shared-a",
          preferredLevel: "semantic",
          roles: ["supporting"],
        },
      ],
    };
    const catB: ExplanationCatalogIR = {
      version: "1.0.0",
      entries: [
        {
          explanationId: "exp-2",
          templateKey: "tpl-2",
          preferredLevel: "mechanical",
          roles: ["blocking"],
        },
        {
          explanationId: "exp-shared",
          templateKey: "tpl-shared-b",
          preferredLevel: "mechanical",
          roles: ["blocking"],
        },
      ],
    };

    const a = makeBundle("a", [], { explanationCatalog: catA });
    const b = makeBundle("b", [], { explanationCatalog: catB });

    const composite = composeBundles("ab", "AB", [a, b]);

    expect(composite.explanationCatalog).toBeDefined();
    expect(composite.explanationCatalog!.entries).toHaveLength(3); // exp-1, exp-shared (from A), exp-2
    const ids = composite.explanationCatalog!.entries.map((e) => e.explanationId);
    expect(ids).toEqual(["exp-1", "exp-shared", "exp-2"]);
    // First occurrence wins for duplicates
    expect(
      composite.explanationCatalog!.entries.find((e) => e.explanationId === "exp-shared")!
        .templateKey,
    ).toBe("tpl-shared-a");
  });

  it("warns when multiple conversation machines exist", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const machineA = {
      machineId: "m-a",
      states: new Map(),
      initialStateId: "init-a",
      seatRole: () => "self" as const,
    };
    const machineB = {
      machineId: "m-b",
      states: new Map(),
      initialStateId: "init-b",
      seatRole: () => "self" as const,
    };

    const a = makeBundle("a", [], { conversationMachine: machineA });
    const b = makeBundle("b", [], { conversationMachine: machineB });

    const composite = composeBundles("ab", "AB", [a, b]);

    expect(composite.conversationMachine).toBe(machineA);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0]![0]).toContain("Multiple conversation machines");

    warnSpy.mockRestore();
  });

  it("merges system profiles by concatenating modules", () => {
    const a = makeBundle("a", [], {
      systemProfile: {
        profileId: "prof-a",
        baseSystem: "2/1",
        modules: [
          {
            moduleId: "mod-a",
            kind: "add-on",
            attachments: [],
          },
        ],
        conflictPolicy: { activationDefault: "simultaneous" },
      },
    });
    const b = makeBundle("b", [], {
      systemProfile: {
        profileId: "prof-b",
        baseSystem: "2/1",
        modules: [
          {
            moduleId: "mod-b",
            kind: "add-on",
            attachments: [],
          },
        ],
        conflictPolicy: { activationDefault: "simultaneous" },
      },
    });

    const composite = composeBundles("ab", "AB", [a, b]);

    expect(composite.systemProfile).toBeDefined();
    expect(composite.systemProfile!.profileId).toBe("prof-a"); // first wins
    expect(composite.systemProfile!.modules).toHaveLength(2);
    expect(composite.systemProfile!.modules[0]!.moduleId).toBe("mod-a");
    expect(composite.systemProfile!.modules[1]!.moduleId).toBe("mod-b");
  });

  it("concatenates pedagogical relations", () => {
    const a = makeBundle("a", [], {
      pedagogicalRelations: [
        { kind: "stronger-than" as const, a: "bid-1", b: "bid-2" },
      ],
    });
    const b = makeBundle("b", [], {
      pedagogicalRelations: [
        { kind: "same-family" as const, a: "bid-3", b: "bid-4" },
      ],
    });

    const composite = composeBundles("ab", "AB", [a, b]);

    expect(composite.pedagogicalRelations).toHaveLength(2);
  });

  it("concatenates acceptable alternatives", () => {
    const a = makeBundle("a", [], {
      acceptableAlternatives: [
        { label: "group-a", members: ["m1", "m2"], tier: "preferred" as const },
      ],
    });
    const b = makeBundle("b", [], {
      acceptableAlternatives: [
        { label: "group-b", members: ["m3"], tier: "alternative" as const },
      ],
    });

    const composite = composeBundles("ab", "AB", [a, b]);

    expect(composite.acceptableAlternatives).toHaveLength(2);
  });

  it("composes surface routers by concatenating results", () => {
    const surfaceA = { surfaceId: "s-a" } as unknown as MeaningSurface;
    const surfaceB = { surfaceId: "s-b" } as unknown as MeaningSurface;

    const a = makeBundle("a", [], {
      surfaceRouter: () => [surfaceA],
    });
    const b = makeBundle("b", [], {
      surfaceRouter: () => [surfaceB],
    });

    const composite = composeBundles("ab", "AB", [a, b]);

    expect(composite.surfaceRouter).toBeDefined();
    const result = composite.surfaceRouter!([] as any, "N" as any);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(surfaceA);
    expect(result[1]).toBe(surfaceB);
  });

  it("merges declared capabilities from all bundles", () => {
    const a = makeBundle("a", [], {
      declaredCapabilities: { "cap-a": "value-a" },
    });
    const b = makeBundle("b", [], {
      declaredCapabilities: { "cap-b": "value-b" },
    });

    const composite = composeBundles("ab", "AB", [a, b]);

    expect(composite.declaredCapabilities).toEqual({
      "cap-a": "value-a",
      "cap-b": "value-b",
    });
  });
});
