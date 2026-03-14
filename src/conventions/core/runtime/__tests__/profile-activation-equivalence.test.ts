import { describe, it, expect } from "vitest";
import { resolveActiveModules } from "../profile-activation";
import { NT_SAYC_PROFILE } from "../../../definitions/nt-bundle/system-profile";
import { BERGEN_PROFILE } from "../../../definitions/bergen-bundle/system-profile";
import { buildAuction } from "../../../../engine/auction-helpers";
import { Seat } from "../../../../engine/types";

describe("profile-driven activation (replaces legacy activationFilter)", () => {
  describe("NT bundle: profile activates correct modules", () => {
    const seat = Seat.North;
    const ntCapabilities = { ntOpenerContext: "active" } as const;

    it("after 1NT P — activates all three modules", () => {
      const auction = buildAuction(Seat.North, ["1NT", "P"]);
      const result = resolveActiveModules(
        NT_SAYC_PROFILE,
        auction,
        seat,
        ntCapabilities,
      );

      expect(result).toEqual(["natural-nt", "stayman", "jacoby-transfers"]);
    });

    it("after 1NT P 2C P — all modules remain active", () => {
      const auction = buildAuction(Seat.North, ["1NT", "P", "2C", "P"]);
      const result = resolveActiveModules(
        NT_SAYC_PROFILE,
        auction,
        seat,
        ntCapabilities,
      );

      expect(result).toEqual(["natural-nt", "stayman", "jacoby-transfers"]);
    });

    it("empty auction — returns nothing", () => {
      const auction = buildAuction(Seat.North, []);
      const result = resolveActiveModules(
        NT_SAYC_PROFILE,
        auction,
        seat,
        ntCapabilities,
      );

      expect(result).toEqual([]);
    });

    it("after 1C P — no 1NT, returns nothing", () => {
      const auction = buildAuction(Seat.North, ["1C", "P"]);
      const result = resolveActiveModules(
        NT_SAYC_PROFILE,
        auction,
        seat,
        ntCapabilities,
      );

      expect(result).toEqual([]);
    });

    it("after 1NT P 2C P 2H P (R3) — all modules still active", () => {
      const auction = buildAuction(Seat.North, [
        "1NT",
        "P",
        "2C",
        "P",
        "2H",
        "P",
      ]);
      const result = resolveActiveModules(
        NT_SAYC_PROFILE,
        auction,
        seat,
        ntCapabilities,
      );

      expect(result).toEqual(["natural-nt", "stayman", "jacoby-transfers"]);
    });

    it("without ntOpenerContext capability — only base module activates", () => {
      const auction = buildAuction(Seat.North, ["1NT", "P"]);
      const result = resolveActiveModules(
        NT_SAYC_PROFILE,
        auction,
        seat,
        {}, // no capabilities
      );

      expect(result).toEqual(["natural-nt"]);
    });
  });

  describe("Bergen bundle: profile activates correct modules", () => {
    const seat = Seat.South;

    it("after 1H P — activates bergen module", () => {
      const auction = buildAuction(Seat.North, ["1H", "P"]);
      const result = resolveActiveModules(BERGEN_PROFILE, auction, seat);

      expect(result).toEqual(["bergen"]);
    });

    it("after 1S P — activates bergen module", () => {
      const auction = buildAuction(Seat.North, ["1S", "P"]);
      const result = resolveActiveModules(BERGEN_PROFILE, auction, seat);

      expect(result).toEqual(["bergen"]);
    });

    it("after 1NT P — returns nothing for Bergen", () => {
      const auction = buildAuction(Seat.North, ["1NT", "P"]);
      const result = resolveActiveModules(BERGEN_PROFILE, auction, seat);

      expect(result).toEqual([]);
    });

    it("empty auction — returns nothing", () => {
      const auction = buildAuction(Seat.North, []);
      const result = resolveActiveModules(BERGEN_PROFILE, auction, seat);

      expect(result).toEqual([]);
    });

    it("after 1H P 3C P (R2) — bergen still active", () => {
      const auction = buildAuction(Seat.North, ["1H", "P", "3C", "P"]);
      const result = resolveActiveModules(BERGEN_PROFILE, auction, seat);

      expect(result).toEqual(["bergen"]);
    });

    it("after 1D P — minor opening does not activate bergen", () => {
      const auction = buildAuction(Seat.North, ["1D", "P"]);
      const result = resolveActiveModules(BERGEN_PROFILE, auction, seat);

      expect(result).toEqual([]);
    });

    it("after 1C P — minor opening does not activate bergen", () => {
      const auction = buildAuction(Seat.North, ["1C", "P"]);
      const result = resolveActiveModules(BERGEN_PROFILE, auction, seat);

      expect(result).toEqual([]);
    });
  });
});
