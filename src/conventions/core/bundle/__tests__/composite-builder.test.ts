import { describe, it, expect } from "vitest";
import { composeBundles } from "../composite-builder";
import type { ConventionBundle } from "../bundle-types";
import type { FactCatalogExtension } from "../../../../core/contracts/fact-catalog";
import type { ExplanationCatalog } from "../../../../core/contracts/explanation-catalog";
import { BASE_SYSTEM_SAYC } from "../../../../core/contracts/base-system-vocabulary";
import { ConventionCategory } from "../../../../core/contracts/convention";
import { FactLayer } from "../../../../core/contracts/fact-layer";

function makeBundle(
  id: string,
  memberIds: string[] = [],
  extras: Partial<ConventionBundle> = {},
): ConventionBundle {
  return {
    id,
    name: `Bundle ${id}`,
    category: ConventionCategory.Constructive,
    description: "test",
    memberIds,
    dealConstraints: { seats: [] },
    explanationCatalog: { version: "1.0.0", entries: [] },
    teachingRelations: [],
    acceptableAlternatives: [],
    intentFamilies: [],
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

  it("concatenates fact extensions from all bundles", () => {
    const extA: FactCatalogExtension = {
      definitions: [
        {
          id: "fact-a",
          layer: FactLayer.ModuleDerived,
          world: "acting-hand",
          description: "Fact A",
          valueType: "number",
          constrainsDimensions: [],
        },
      ],
      evaluators: new Map(),
    };
    const extB: FactCatalogExtension = {
      definitions: [
        {
          id: "fact-b",
          layer: FactLayer.ModuleDerived,
          world: "acting-hand",
          description: "Fact B",
          valueType: "boolean",
          constrainsDimensions: [],
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

  it("returns empty arrays/catalogs for required fields when no bundle provides them", () => {
    const a = makeBundle("a", []);
    const b = makeBundle("b", []);

    const composite = composeBundles("ab", "AB", [a, b]);

    expect(composite.factExtensions).toBeUndefined();
    expect(composite.teachingRelations).toEqual([]);
    expect(composite.acceptableAlternatives).toEqual([]);
    expect(composite.intentFamilies).toEqual([]);
    expect(composite.explanationCatalog).toEqual({ version: "1.0.0", entries: [] });
    expect(composite.systemProfile).toBeUndefined();
  });

  it("merges explanation catalog entries with deduplication", () => {
    const catA: ExplanationCatalog = {
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
    const catB: ExplanationCatalog = {
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

  it("merges system profiles by concatenating modules", () => {
    const a = makeBundle("a", [], {
      systemProfile: {
        profileId: "prof-a",
        baseSystem: BASE_SYSTEM_SAYC,
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
        baseSystem: BASE_SYSTEM_SAYC,
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
      teachingRelations: [
        { kind: "stronger-than" as const, a: "bid-1", b: "bid-2" },
      ],
    });
    const b = makeBundle("b", [], {
      teachingRelations: [
        { kind: "same-family" as const, a: "bid-3", b: "bid-4" },
      ],
    });

    const composite = composeBundles("ab", "AB", [a, b]);

    expect(composite.teachingRelations).toHaveLength(2);
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
