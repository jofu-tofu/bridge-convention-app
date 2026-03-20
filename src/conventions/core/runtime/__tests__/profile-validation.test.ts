import { describe, it, expect } from "vitest";
import { validateProfile } from "../profile-validation";
import type { SystemProfileIR } from "../../../../core/contracts/agreement-module";
import { BASE_SYSTEM_SAYC } from "../../../../core/contracts/base-system-vocabulary";

describe("validateProfile", () => {
  it("emits diagnostic for conflicting semanticClassIds on same call", () => {
    const conflictingProfile: SystemProfileIR = {
      profileId: "test-conflict",
      baseSystem: BASE_SYSTEM_SAYC,
      modules: [
        {
          moduleId: "module-a",
          kind: "base-system",
          attachments: [{ whenAuction: { kind: "sequence", calls: ["1NT"] } }],
        },
        {
          moduleId: "module-b",
          kind: "add-on",
          attachments: [{ whenAuction: { kind: "sequence", calls: ["1NT"] } }],
        },
      ],
      conflictPolicy: { activationDefault: "simultaneous" },
    };

    const surfaceLookup = (moduleId: string) => {
      switch (moduleId) {
        case "module-a":
          return [
            { defaultCall: "2C", semanticClassId: "stayman:ask-major" },
          ];
        case "module-b":
          return [
            { defaultCall: "2C", semanticClassId: "clubs:natural" },
          ];
        default:
          return [];
      }
    };

    const diagnostics = validateProfile(conflictingProfile, surfaceLookup);
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics[0]!.level).toBe("error");
    expect(diagnostics[0]!.message).toContain("2C");
  });

  it("emits diagnostic when two modules share semanticClassId with different defaultCalls", () => {
    const profile: SystemProfileIR = {
      profileId: "test-semantic-collision",
      baseSystem: BASE_SYSTEM_SAYC,
      modules: [
        {
          moduleId: "module-a",
          kind: "base-system",
          attachments: [{ whenAuction: { kind: "sequence", calls: ["1NT"] } }],
        },
        {
          moduleId: "module-b",
          kind: "add-on",
          attachments: [{ whenAuction: { kind: "sequence", calls: ["1NT"] } }],
        },
      ],
      conflictPolicy: { activationDefault: "simultaneous" },
    };

    const surfaceLookup = (moduleId: string) => {
      switch (moduleId) {
        case "module-a":
          return [
            { defaultCall: "2D", semanticClassId: "transfer:hearts" },
          ];
        case "module-b":
          return [
            { defaultCall: "2H", semanticClassId: "transfer:hearts" },
          ];
        default:
          return [];
      }
    };

    const diagnostics = validateProfile(profile, surfaceLookup);
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics[0]!.level).toBe("error");
    expect(diagnostics[0]!.message).toContain("transfer:hearts");
    expect(diagnostics[0]!.message).toContain("module-a");
    expect(diagnostics[0]!.message).toContain("module-b");
  });

  it("no diagnostic when two modules share semanticClassId with same defaultCall", () => {
    const profile: SystemProfileIR = {
      profileId: "test-no-collision",
      baseSystem: BASE_SYSTEM_SAYC,
      modules: [
        {
          moduleId: "module-a",
          kind: "base-system",
          attachments: [{ whenAuction: { kind: "sequence", calls: ["1NT"] } }],
        },
        {
          moduleId: "module-b",
          kind: "add-on",
          attachments: [{ whenAuction: { kind: "sequence", calls: ["1NT"] } }],
        },
      ],
      conflictPolicy: { activationDefault: "simultaneous" },
    };

    const surfaceLookup = (moduleId: string) => {
      switch (moduleId) {
        case "module-a":
          return [
            { defaultCall: "2C", semanticClassId: "stayman:ask-major" },
          ];
        case "module-b":
          return [
            { defaultCall: "2C", semanticClassId: "stayman:ask-major" },
          ];
        default:
          return [];
      }
    };

    const diagnostics = validateProfile(profile, surfaceLookup);
    expect(diagnostics).toEqual([]);
  });
});
