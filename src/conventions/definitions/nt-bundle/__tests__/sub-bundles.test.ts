import { describe, it, expect } from "vitest";
import { resolveActiveModules } from "../../../core/runtime/profile-activation";
import { NT_SAYC_PROFILE } from "../system-profile";
import type { SystemProfile } from "../../../../core/contracts/agreement-module";
import { buildAuction } from "../../../../engine/auction-helpers";
import { Seat } from "../../../../engine/types";
import { CAP_OPENING_1NT } from "../../capability-vocabulary";

// ---------------------------------------------------------------------------
// Sub-profiles: prove that different profiles can select different subsets
// of the same NT surfaces, enabling Stayman-only and Transfer-only drill modes.
// ---------------------------------------------------------------------------

const STAYMAN_ONLY_PROFILE: SystemProfile = {
  profileId: "1nt-stayman-only",
  baseSystem: "sayc",
  modules: [
    {
      moduleId: "natural-nt",
      kind: "base-system",
      attachments: [{ whenAuction: { kind: "sequence", calls: ["1NT"] } }],
    },
    {
      moduleId: "stayman",
      kind: "add-on",
      attachments: [
        {
          whenAuction: { kind: "sequence", calls: ["1NT"] },
          requiresCapabilities: [CAP_OPENING_1NT],
        },
      ],
    },
  ],
  conflictPolicy: { activationDefault: "simultaneous" },
};

const TRANSFER_ONLY_PROFILE: SystemProfile = {
  profileId: "1nt-transfers-only",
  baseSystem: "sayc",
  modules: [
    {
      moduleId: "natural-nt",
      kind: "base-system",
      attachments: [{ whenAuction: { kind: "sequence", calls: ["1NT"] } }],
    },
    {
      moduleId: "jacoby-transfers",
      kind: "add-on",
      attachments: [
        {
          whenAuction: { kind: "sequence", calls: ["1NT"] },
          requiresCapabilities: [CAP_OPENING_1NT],
        },
      ],
    },
  ],
  conflictPolicy: { activationDefault: "simultaneous" },
};

// ---------------------------------------------------------------------------

describe("NT sub-bundle profiles", () => {
  const ntCapabilities = { [CAP_OPENING_1NT]: "active" };
  const auctionAfter1NT = buildAuction(Seat.North, ["1NT", "P"]);

  describe("full NT profile (reference)", () => {
    it("activates all three modules after 1NT P", () => {
      const result = resolveActiveModules(
        NT_SAYC_PROFILE,
        auctionAfter1NT,
        Seat.South,
        ntCapabilities,
      );
      expect(result).toEqual(["natural-nt", "stayman", "jacoby-transfers"]);
    });
  });

  describe("Stayman-only profile", () => {
    it("activates natural-nt and stayman after 1NT P", () => {
      const result = resolveActiveModules(
        STAYMAN_ONLY_PROFILE,
        auctionAfter1NT,
        Seat.South,
        ntCapabilities,
      );
      expect(result).toEqual(["natural-nt", "stayman"]);
    });

    it("does NOT activate jacoby-transfers", () => {
      const result = resolveActiveModules(
        STAYMAN_ONLY_PROFILE,
        auctionAfter1NT,
        Seat.South,
        ntCapabilities,
      );
      expect(result).not.toContain("jacoby-transfers");
    });

    it("returns empty for non-1NT auction", () => {
      const auction = buildAuction(Seat.North, ["1H", "P"]);
      const result = resolveActiveModules(
        STAYMAN_ONLY_PROFILE,
        auction,
        Seat.South,
        ntCapabilities,
      );
      expect(result).toEqual([]);
    });
  });

  describe("Transfer-only profile", () => {
    it("activates natural-nt and jacoby-transfers after 1NT P", () => {
      const result = resolveActiveModules(
        TRANSFER_ONLY_PROFILE,
        auctionAfter1NT,
        Seat.South,
        ntCapabilities,
      );
      expect(result).toEqual(["natural-nt", "jacoby-transfers"]);
    });

    it("does NOT activate stayman", () => {
      const result = resolveActiveModules(
        TRANSFER_ONLY_PROFILE,
        auctionAfter1NT,
        Seat.South,
        ntCapabilities,
      );
      expect(result).not.toContain("stayman");
    });
  });

  describe("profile composition proves module model", () => {
    it("same surfaces, different profiles -> different module sets", () => {
      const fullResult = resolveActiveModules(
        NT_SAYC_PROFILE,
        auctionAfter1NT,
        Seat.South,
        ntCapabilities,
      );
      const staymanResult = resolveActiveModules(
        STAYMAN_ONLY_PROFILE,
        auctionAfter1NT,
        Seat.South,
        ntCapabilities,
      );
      const transferResult = resolveActiveModules(
        TRANSFER_ONLY_PROFILE,
        auctionAfter1NT,
        Seat.South,
        ntCapabilities,
      );

      // Full profile = union of both sub-profiles (with natural-nt in both)
      expect(fullResult).toHaveLength(3);
      expect(staymanResult).toHaveLength(2);
      expect(transferResult).toHaveLength(2);

      // Each sub-profile is a strict subset of the full profile
      expect(staymanResult.every((id) => fullResult.includes(id))).toBe(true);
      expect(transferResult.every((id) => fullResult.includes(id))).toBe(true);
    });
  });
});
