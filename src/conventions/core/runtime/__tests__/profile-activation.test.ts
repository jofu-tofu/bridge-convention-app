import { describe, it, expect } from "vitest";
import { resolveActiveModules } from "../profile-activation";
import type { SystemProfile, PublicConstraint } from "../../agreement-module";
import type { PublicSnapshot } from "../../module-surface";
import { buildAuction } from "../../../../engine/auction-helpers";
import { Seat } from "../../../../engine/types";
import { ForcingState } from "../../strategy-types";
import { BASE_SYSTEM_SAYC } from "../../../definitions/system-config";

/** Minimal PublicSnapshot for testing — only publicRegisters and publicCommitments matter. */
function makeSnapshot(overrides: Partial<PublicSnapshot> = {}): PublicSnapshot {
  return {
    activeModuleIds: [],
    forcingState: ForcingState.Nonforcing,
    obligation: { kind: "none", obligatedSide: "opener" },
    agreedStrain: { type: "none" },
    competitionMode: "uncontested",
    captain: "none",
    systemCapabilities: {},
    publicRegisters: {},
    ...overrides,
  };
}

describe("resolveActiveModules", () => {
  describe("whenPublic guard", () => {
    const auction = buildAuction(Seat.North, ["1NT", "P"]);

    function profileWithGuard(
      field: string,
      operator: "eq" | "neq" | "in" | "exists",
      value?: unknown,
    ): SystemProfile {
      return {
        profileId: "test-public-guard",
        baseSystem: "sayc",
        modules: [
          {
            moduleId: "guarded-mod",
            kind: "base-system",
            attachments: [{ whenPublic: { field, operator, value } }],
          },
        ],

      };
    }

    it("activates module when eq guard matches register value", () => {
      const profile = profileWithGuard("competitionMode", "eq", "competitive");
      const snapshot = makeSnapshot({
        publicRegisters: { competitionMode: "competitive" },
      });

      const result = resolveActiveModules(profile, auction, Seat.South, {}, snapshot);
      expect(result).toEqual(["guarded-mod"]);
    });

    it("excludes module when eq guard does not match register value", () => {
      const profile = profileWithGuard("competitionMode", "eq", "competitive");
      const snapshot = makeSnapshot({
        publicRegisters: { competitionMode: "uncontested" },
      });

      const result = resolveActiveModules(profile, auction, Seat.South, {}, snapshot);
      expect(result).toEqual([]);
    });

    it("activates module when neq guard does not match register value", () => {
      const profile = profileWithGuard("competitionMode", "neq", "competitive");
      const snapshot = makeSnapshot({
        publicRegisters: { competitionMode: "uncontested" },
      });

      const result = resolveActiveModules(profile, auction, Seat.South, {}, snapshot);
      expect(result).toEqual(["guarded-mod"]);
    });

    it("excludes module when neq guard matches register value", () => {
      const profile = profileWithGuard("competitionMode", "neq", "competitive");
      const snapshot = makeSnapshot({
        publicRegisters: { competitionMode: "competitive" },
      });

      const result = resolveActiveModules(profile, auction, Seat.South, {}, snapshot);
      expect(result).toEqual([]);
    });

    it("activates module when in guard finds value in array", () => {
      const profile = profileWithGuard("captain", "in", ["opener", "responder"]);
      const snapshot = makeSnapshot({
        publicRegisters: { captain: "responder" },
      });

      const result = resolveActiveModules(profile, auction, Seat.South, {}, snapshot);
      expect(result).toEqual(["guarded-mod"]);
    });

    it("excludes module when in guard does not find value in array", () => {
      const profile = profileWithGuard("captain", "in", ["opener", "responder"]);
      const snapshot = makeSnapshot({
        publicRegisters: { captain: "nobody" },
      });

      const result = resolveActiveModules(profile, auction, Seat.South, {}, snapshot);
      expect(result).toEqual([]);
    });

    it("activates module when exists guard finds the field", () => {
      const profile = profileWithGuard("competitionMode", "exists");
      const snapshot = makeSnapshot({
        publicRegisters: { competitionMode: "uncontested" },
      });

      const result = resolveActiveModules(profile, auction, Seat.South, {}, snapshot);
      expect(result).toEqual(["guarded-mod"]);
    });

    it("excludes module when exists guard does not find the field", () => {
      const profile = profileWithGuard("competitionMode", "exists");
      const snapshot = makeSnapshot({
        publicRegisters: {},
      });

      const result = resolveActiveModules(profile, auction, Seat.South, {}, snapshot);
      expect(result).toEqual([]);
    });

    it("excludes module when whenPublic is set but no publicSnapshot provided", () => {
      const profile = profileWithGuard("competitionMode", "eq", "competitive");

      const result = resolveActiveModules(profile, auction, Seat.South, {});
      expect(result).toEqual([]);
    });

    it("eq guard returns false when register field is missing", () => {
      const profile = profileWithGuard("missingField", "eq", "anything");
      const snapshot = makeSnapshot({ publicRegisters: {} });

      const result = resolveActiveModules(profile, auction, Seat.South, {}, snapshot);
      expect(result).toEqual([]);
    });
  });

  describe("requiresVisibleMeanings", () => {
    const auction = buildAuction(Seat.North, ["1NT", "P"]);

    function profileWithVisibleMeanings(
      meaningIds: readonly string[],
    ): SystemProfile {
      return {
        profileId: "test-visible-meanings",
        baseSystem: "sayc",
        modules: [
          {
            moduleId: "meaning-mod",
            kind: "base-system",
            attachments: [{ requiresVisibleMeanings: meaningIds }],
          },
        ],

      };
    }

    function commitment(sourceMeaning: string): PublicConstraint {
      return {
        subject: "responder",
        constraint: { factId: "hcp", operator: "gte", value: 10 },
        origin: "call-meaning",
        strength: "hard",
        sourceMeaning,
      };
    }

    it("activates module when required meaning is in publicCommitments", () => {
      const profile = profileWithVisibleMeanings(["stayman-ask"]);
      const snapshot = makeSnapshot({
        publicCommitments: [commitment("stayman-ask")],
      });

      const result = resolveActiveModules(profile, auction, Seat.South, {}, snapshot);
      expect(result).toEqual(["meaning-mod"]);
    });

    it("excludes module when required meaning is not in publicCommitments", () => {
      const profile = profileWithVisibleMeanings(["stayman-ask"]);
      const snapshot = makeSnapshot({
        publicCommitments: [commitment("transfer-hearts")],
      });

      const result = resolveActiveModules(profile, auction, Seat.South, {}, snapshot);
      expect(result).toEqual([]);
    });

    it("requires all meaning IDs to be present", () => {
      const profile = profileWithVisibleMeanings(["stayman-ask", "gerber-ace"]);
      const snapshot = makeSnapshot({
        publicCommitments: [commitment("stayman-ask")],
      });

      const result = resolveActiveModules(profile, auction, Seat.South, {}, snapshot);
      expect(result).toEqual([]);
    });

    it("activates when all required meaning IDs are present", () => {
      const profile = profileWithVisibleMeanings(["stayman-ask", "gerber-ace"]);
      const snapshot = makeSnapshot({
        publicCommitments: [
          commitment("stayman-ask"),
          commitment("gerber-ace"),
        ],
      });

      const result = resolveActiveModules(profile, auction, Seat.South, {}, snapshot);
      expect(result).toEqual(["meaning-mod"]);
    });

    it("excludes module when requiresVisibleMeanings set but no snapshot provided", () => {
      const profile = profileWithVisibleMeanings(["stayman-ask"]);

      const result = resolveActiveModules(profile, auction, Seat.South, {});
      expect(result).toEqual([]);
    });

    it("excludes module when publicCommitments is empty", () => {
      const profile = profileWithVisibleMeanings(["stayman-ask"]);
      const snapshot = makeSnapshot({ publicCommitments: [] });

      const result = resolveActiveModules(profile, auction, Seat.South, {}, snapshot);
      expect(result).toEqual([]);
    });

    it("excludes module when publicCommitments is undefined", () => {
      const profile = profileWithVisibleMeanings(["stayman-ask"]);
      const snapshot = makeSnapshot({ publicCommitments: undefined });

      const result = resolveActiveModules(profile, auction, Seat.South, {}, snapshot);
      expect(result).toEqual([]);
    });
  });

  describe("whenAuction: contains pattern", () => {
    it("activates when auction contains the specified call", () => {
      const profile: SystemProfile = {
        profileId: "test-contains",
        baseSystem: BASE_SYSTEM_SAYC,
        modules: [{
          moduleId: "mod-x",
          kind: "add-on",
          attachments: [{ whenAuction: { kind: "contains", call: "X" } }],
        }],

      };
      // Auction: 1H - X (double by East)
      const auction = buildAuction(Seat.North, ["1H", "X"]);
      expect(resolveActiveModules(profile, auction, Seat.South)).toEqual(["mod-x"]);
    });

    it("does not activate when auction does not contain the specified call", () => {
      const profile: SystemProfile = {
        profileId: "test-contains-miss",
        baseSystem: BASE_SYSTEM_SAYC,
        modules: [{
          moduleId: "mod-x",
          kind: "add-on",
          attachments: [{ whenAuction: { kind: "contains", call: "X" } }],
        }],

      };
      const auction = buildAuction(Seat.North, ["1H", "P"]);
      expect(resolveActiveModules(profile, auction, Seat.South)).toEqual([]);
    });

    it("activates when byRole restricts to a specific role", () => {
      const profile: SystemProfile = {
        profileId: "test-contains-role",
        baseSystem: BASE_SYSTEM_SAYC,
        modules: [{
          moduleId: "mod-x",
          kind: "add-on",
          attachments: [{ whenAuction: { kind: "contains", call: "X", byRole: "overcaller" } }],
        }],

      };
      // Auction: North=1H, East=X — East is overcaller (next after opener)
      const auction = buildAuction(Seat.North, ["1H", "X"]);
      expect(resolveActiveModules(profile, auction, Seat.South)).toEqual(["mod-x"]);
    });

    it("does not activate when call exists but by wrong role", () => {
      const profile: SystemProfile = {
        profileId: "test-contains-wrong-role",
        baseSystem: BASE_SYSTEM_SAYC,
        modules: [{
          moduleId: "mod-x",
          kind: "add-on",
          attachments: [{ whenAuction: { kind: "contains", call: "1H", byRole: "responder" } }],
        }],

      };
      // Auction: North=1H — 1H was by opener, not responder
      const auction = buildAuction(Seat.North, ["1H", "P"]);
      expect(resolveActiveModules(profile, auction, Seat.South)).toEqual([]);
    });

    it("returns empty when byRole cannot be resolved (no bids)", () => {
      const profile: SystemProfile = {
        profileId: "test-contains-no-opener",
        baseSystem: BASE_SYSTEM_SAYC,
        modules: [{
          moduleId: "mod-x",
          kind: "add-on",
          attachments: [{ whenAuction: { kind: "contains", call: "P", byRole: "opener" } }],
        }],

      };
      // Empty auction — no bids, so "opener" role can't be resolved
      const auction = buildAuction(Seat.North, []);
      expect(resolveActiveModules(profile, auction, Seat.South)).toEqual([]);
    });
  });

  describe("whenAuction: by-role pattern", () => {
    it("activates when last call by role matches", () => {
      const profile: SystemProfile = {
        profileId: "test-byrole",
        baseSystem: BASE_SYSTEM_SAYC,
        modules: [{
          moduleId: "mod-x",
          kind: "add-on",
          attachments: [{ whenAuction: { kind: "by-role", role: "opener", lastCall: "2H" } }],
        }],

      };
      // Auction: North=1H, East=P, South=2C, West=P, North=2H
      // Opener (North) last call is 2H.
      const auction = buildAuction(Seat.North, ["1H", "P", "2C", "P", "2H"]);
      expect(resolveActiveModules(profile, auction, Seat.South)).toEqual(["mod-x"]);
    });

    it("does not activate when last call by role does not match", () => {
      const profile: SystemProfile = {
        profileId: "test-byrole-miss",
        baseSystem: BASE_SYSTEM_SAYC,
        modules: [{
          moduleId: "mod-x",
          kind: "add-on",
          attachments: [{ whenAuction: { kind: "by-role", role: "opener", lastCall: "2H" } }],
        }],

      };
      // Opener's last call is 1H, not 2H
      const auction = buildAuction(Seat.North, ["1H", "P"]);
      expect(resolveActiveModules(profile, auction, Seat.South)).toEqual([]);
    });

    it("does not activate when role cannot be resolved", () => {
      const profile: SystemProfile = {
        profileId: "test-byrole-no-opener",
        baseSystem: BASE_SYSTEM_SAYC,
        modules: [{
          moduleId: "mod-x",
          kind: "add-on",
          attachments: [{ whenAuction: { kind: "by-role", role: "opener", lastCall: "1H" } }],
        }],

      };
      // Empty auction — no opener
      const auction = buildAuction(Seat.North, []);
      expect(resolveActiveModules(profile, auction, Seat.South)).toEqual([]);
    });

    it("checks the LAST call by the role, not the first", () => {
      const profile: SystemProfile = {
        profileId: "test-byrole-last",
        baseSystem: BASE_SYSTEM_SAYC,
        modules: [{
          moduleId: "mod-x",
          kind: "add-on",
          attachments: [{ whenAuction: { kind: "by-role", role: "responder", lastCall: "3C" } }],
        }],

      };
      // Auction: N=1H, E=P, S=2C, W=P, N=2H, E=P, S=3C
      // Responder (South) first bid 2C, then 3C. Last call is 3C.
      const auction = buildAuction(Seat.North, ["1H", "P", "2C", "P", "2H", "P", "3C"]);
      expect(resolveActiveModules(profile, auction, Seat.South)).toEqual(["mod-x"]);
    });

    it("does not activate when role seat never acted", () => {
      const profile: SystemProfile = {
        profileId: "test-byrole-never-acted",
        baseSystem: BASE_SYSTEM_SAYC,
        modules: [{
          moduleId: "mod-x",
          kind: "add-on",
          attachments: [{ whenAuction: { kind: "by-role", role: "advancer", lastCall: "P" } }],
        }],

      };
      // Auction: N=1H, E=X — advancer is West (partner of East), who hasn't acted yet
      const auction = buildAuction(Seat.North, ["1H", "X"]);
      expect(resolveActiveModules(profile, auction, Seat.South)).toEqual([]);
    });
  });
});


