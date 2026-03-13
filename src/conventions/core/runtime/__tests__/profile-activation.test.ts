import { describe, it, expect } from "vitest";
import { resolveActiveModules, resolveModulePrecedence } from "../profile-activation";
import type { SystemProfileIR } from "../../../../core/contracts/agreement-module";
import { NT_SAYC_PROFILE } from "../../../definitions/nt-bundle/system-profile";
import { buildAuction } from "../../../../engine/auction-helpers";
import { Seat } from "../../../../engine/types";

describe("resolveActiveModules", () => {
  it("returns all 3 modules for 1NT-P auction with ntOpenerContext capability", () => {
    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const result = resolveActiveModules(
      NT_SAYC_PROFILE,
      auction,
      Seat.South,
      { ntOpenerContext: "active" },
    );
    expect(result).toEqual(["natural-nt", "stayman", "jacoby-transfers"]);
  });

  it("returns only natural-nt without capabilities (others require ntOpenerContext)", () => {
    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const result = resolveActiveModules(
      NT_SAYC_PROFILE,
      auction,
      Seat.South,
    );
    expect(result).toEqual(["natural-nt"]);
  });

  it("returns empty array for non-1NT auction", () => {
    const auction = buildAuction(Seat.North, ["1C", "P"]);
    const result = resolveActiveModules(
      NT_SAYC_PROFILE,
      auction,
      Seat.South,
      { ntOpenerContext: "active" },
    );
    expect(result).toEqual([]);
  });

  it("excludes module with unmet requiresCapabilities", () => {
    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const result = resolveActiveModules(
      NT_SAYC_PROFILE,
      auction,
      Seat.South,
      { someOtherCapability: "active" },
    );
    // Only natural-nt has no capability requirements
    expect(result).toEqual(["natural-nt"]);
  });

  it("keeps only the highest-precedence module per exclusivity group", () => {
    // Two modules in the same exclusivity group, both active.
    // Module at index 0 has higher precedence (lower index) than index 2.
    // Only the higher-precedence module should survive.
    const profile: SystemProfileIR = {
      profileId: "test-exclusive",
      baseSystem: "sayc",
      modules: [
        {
          moduleId: "mod-a",
          kind: "base-system",
          attachments: [{}], // always matches
        },
        {
          moduleId: "mod-b",
          kind: "add-on",
          attachments: [{}], // always matches
        },
        {
          moduleId: "mod-c",
          kind: "add-on",
          attachments: [{}], // always matches
        },
      ],
      conflictPolicy: {
        activationDefault: "simultaneous",
        exclusivityGroups: [
          { groupId: "responder-tools", memberModuleIds: ["mod-a", "mod-c"] },
        ],
      },
    };

    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const result = resolveActiveModules(profile, auction, Seat.South);

    // mod-a (index 0) beats mod-c (index 2) in the group; mod-b is unaffected
    expect(result).toEqual(["mod-a", "mod-b"]);
  });

  it("does not affect modules outside any exclusivity group", () => {
    const profile: SystemProfileIR = {
      profileId: "test-exclusive-2",
      baseSystem: "sayc",
      modules: [
        {
          moduleId: "mod-x",
          kind: "base-system",
          attachments: [{}],
        },
        {
          moduleId: "mod-y",
          kind: "add-on",
          attachments: [{}],
        },
      ],
      conflictPolicy: {
        activationDefault: "simultaneous",
        exclusivityGroups: [
          { groupId: "some-group", memberModuleIds: ["mod-z"] }, // mod-z not in profile
        ],
      },
    };

    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const result = resolveActiveModules(profile, auction, Seat.South);

    expect(result).toEqual(["mod-x", "mod-y"]);
  });

  it("handles multiple exclusivity groups independently", () => {
    const profile: SystemProfileIR = {
      profileId: "test-multi-group",
      baseSystem: "sayc",
      modules: [
        { moduleId: "a1", kind: "base-system", attachments: [{}] },
        { moduleId: "a2", kind: "add-on", attachments: [{}] },
        { moduleId: "b1", kind: "add-on", attachments: [{}] },
        { moduleId: "b2", kind: "add-on", attachments: [{}] },
      ],
      conflictPolicy: {
        activationDefault: "simultaneous",
        exclusivityGroups: [
          { groupId: "group-a", memberModuleIds: ["a1", "a2"] },
          { groupId: "group-b", memberModuleIds: ["b1", "b2"] },
        ],
      },
    };

    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const result = resolveActiveModules(profile, auction, Seat.South);

    // a1 wins group-a (index 0 < 1), b1 wins group-b (index 2 < 3)
    expect(result).toEqual(["a1", "b1"]);
  });
});

describe("resolveModulePrecedence", () => {
  it("assigns correct indices to modules", () => {
    const precedence = resolveModulePrecedence(NT_SAYC_PROFILE);
    expect(precedence.get("natural-nt")).toBe(0);
    expect(precedence.get("stayman")).toBe(1);
    expect(precedence.get("jacoby-transfers")).toBe(2);
  });
});
