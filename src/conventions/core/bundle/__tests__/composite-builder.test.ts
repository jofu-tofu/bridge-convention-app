import { describe, it, expect } from "vitest";
import { composeBundles } from "../composite-builder";
import type { ConventionBundle } from "../bundle-types";
import { BASE_SYSTEM_SAYC } from "../../../definitions/system-config";
import { ConventionCategory } from "../../convention-types";

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
    modules: [],
    dealConstraints: { seats: [] },
    derivedTeaching: { surfaceGroups: [] },
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

  it("returns empty arrays for derived teaching fields when no bundle provides them", () => {
    const a = makeBundle("a", []);
    const b = makeBundle("b", []);

    const composite = composeBundles("ab", "AB", [a, b]);

    expect(composite.derivedTeaching.surfaceGroups).toEqual([]);
    expect(composite.systemProfile).toBeUndefined();
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

      },
    });

    const composite = composeBundles("ab", "AB", [a, b]);

    expect(composite.systemProfile).toBeDefined();
    expect(composite.systemProfile!.profileId).toBe("prof-a"); // first wins
    expect(composite.systemProfile!.modules).toHaveLength(2);
    expect(composite.systemProfile!.modules[0]!.moduleId).toBe("mod-a");
    expect(composite.systemProfile!.modules[1]!.moduleId).toBe("mod-b");
  });

  it("concatenates surface groups from child bundles", () => {
    const a = makeBundle("a", [], {
      derivedTeaching: {
        surfaceGroups: [
          { id: "g1", label: "Group A", members: ["m1", "m2"], relationship: "mutually_exclusive" as const, description: "test" },
        ],
      },
    });
    const b = makeBundle("b", [], {
      derivedTeaching: {
        surfaceGroups: [
          { id: "g2", label: "Group B", members: ["m3"], relationship: "mutually_exclusive" as const, description: "test" },
        ],
      },
    });

    const composite = composeBundles("ab", "AB", [a, b]);

    expect(composite.derivedTeaching.surfaceGroups).toHaveLength(2);
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
