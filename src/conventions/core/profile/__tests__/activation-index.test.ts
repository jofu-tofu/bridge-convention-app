import { describe, it, expect } from "vitest";
import { buildActivationIndex, buildCapabilityIndex } from "../compile-from-packages";
import type { SystemProfileIR, AttachmentIR } from "../../../../core/contracts/agreement-module";
import type { ModulePackage } from "../../modules";

// ─── Helpers ────────────────────────────────────────────────

function makeProfile(moduleIds: string[]): SystemProfileIR {
  return {
    profileId: "test-profile",
    baseSystem: "SAYC",
    modules: moduleIds.map((id) => ({
      moduleId: id,
      kind: "add-on" as const,
      attachments: [
        {
          whenAuction: { kind: "sequence", calls: [] },
          requiresCapabilities: [`cap-${id}`],
        } satisfies AttachmentIR,
      ],
    })),
    conflictPolicy: { activationDefault: "simultaneous" as const },
  };
}

function makePackage(
  moduleId: string,
  capabilities: string[] = [],
): ModulePackage {
  return {
    moduleId,
    exports: {
      surfaces: [],
      capabilities: capabilities.length > 0 ? capabilities : undefined,
    },
    runtime: {},
  };
}

// ─── Tests ──────────────────────────────────────────────────

describe("buildActivationIndex", () => {
  it("maps each module to its profile attachments", () => {
    const profile = makeProfile(["mod-a", "mod-b"]);
    const index = buildActivationIndex(profile);

    expect(index.moduleAttachments.has("mod-a")).toBe(true);
    expect(index.moduleAttachments.has("mod-b")).toBe(true);
    expect(index.moduleAttachments.get("mod-a")![0]).toHaveProperty(
      "requiresCapabilities",
      ["cap-mod-a"],
    );
  });

  it("handles empty profile", () => {
    const profile = makeProfile([]);
    const index = buildActivationIndex(profile);
    expect(index.moduleAttachments.size).toBe(0);
  });
});

describe("buildCapabilityIndex", () => {
  it("maps each package to its capabilities", () => {
    const pkgA = makePackage("mod-a", ["cap-1", "cap-2"]);
    const pkgB = makePackage("mod-b", ["cap-3"]);
    const index = buildCapabilityIndex([pkgA, pkgB]);

    expect(index.moduleCapabilities.get("mod-a")).toEqual(["cap-1", "cap-2"]);
    expect(index.moduleCapabilities.get("mod-b")).toEqual(["cap-3"]);
  });

  it("defaults to empty array when package has no capabilities", () => {
    const pkg = makePackage("mod-a");
    const index = buildCapabilityIndex([pkg]);

    expect(index.moduleCapabilities.get("mod-a")).toEqual([]);
  });
});
