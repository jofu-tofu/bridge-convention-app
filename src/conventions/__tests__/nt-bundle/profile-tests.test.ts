/**
 * NT-bundle-specific profile tests.
 *
 * These tests exercise profile-activation and profile-validation using the
 * real NT_SAYC_PROFILE from definitions/nt-bundle. They were extracted from
 * the core runtime tests to keep infrastructure tests free of convention-
 * specific dependencies.
 */
import { describe, it, expect } from "vitest";
import { resolveActiveModules, resolveModulePrecedence } from "../../core/runtime/profile-activation";
import { validateProfile } from "../../core/runtime/profile-validation";
import { NT_SAYC_PROFILE } from "../../definitions/nt-bundle/system-profile";
import { buildAuction } from "../../../engine/auction-helpers";
import { Seat } from "../../../engine/types";
import { CAP_OPENING_1NT } from "../../../core/contracts/capability-vocabulary";

// ═══════════════════════════════════════════════════════════════
// Profile Activation — NT SAYC
// ═══════════════════════════════════════════════════════════════

describe("resolveActiveModules (NT SAYC)", () => {
  it("returns all 3 modules for 1NT-P auction with opening.1nt capability", () => {
    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const result = resolveActiveModules(
      NT_SAYC_PROFILE,
      auction,
      Seat.South,
      { [CAP_OPENING_1NT]: "active" },
    );
    expect(result).toEqual(["natural-nt", "stayman", "jacoby-transfers"]);
  });

  it("returns only natural-nt without capabilities (others require opening.1nt)", () => {
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
      { [CAP_OPENING_1NT]: "active" },
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
});

// ═══════════════════════════════════════════════════════════════
// Module Precedence — NT SAYC
// ═══════════════════════════════════════════════════════════════

describe("resolveModulePrecedence (NT SAYC)", () => {
  it("assigns correct indices to modules", () => {
    const precedence = resolveModulePrecedence(NT_SAYC_PROFILE);
    expect(precedence.get("natural-nt")).toBe(0);
    expect(precedence.get("stayman")).toBe(1);
    expect(precedence.get("jacoby-transfers")).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════
// Profile Validation — NT SAYC
// ═══════════════════════════════════════════════════════════════

describe("validateProfile (NT SAYC)", () => {
  it("NT SAYC profile passes validation with no collisions", () => {
    // Stayman owns 2C, transfers own 2D/2H — no overlapping defaultCalls with different semanticClassIds
    const surfaceLookup = (moduleId: string) => {
      switch (moduleId) {
        case "natural-nt":
          return [
            { defaultCall: "P", semanticClassId: "bridge:pass" },
            { defaultCall: "2NT", semanticClassId: "bridge:nt-invite" },
            { defaultCall: "3NT", semanticClassId: "bridge:nt-game" },
          ];
        case "stayman":
          return [
            { defaultCall: "2C", semanticClassId: "stayman:ask-major" },
          ];
        case "jacoby-transfers":
          return [
            { defaultCall: "2D", semanticClassId: "transfer:hearts" },
            { defaultCall: "2H", semanticClassId: "transfer:spades" },
          ];
        default:
          return [];
      }
    };

    const diagnostics = validateProfile(NT_SAYC_PROFILE, surfaceLookup);
    expect(diagnostics).toEqual([]);
  });
});
