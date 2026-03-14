import { describe, it, expect, beforeEach } from "vitest";
import { createDrillConfig } from "../config-factory";
import { Seat } from "../../engine/types";
import { clearRegistry, registerConvention } from "../../conventions/core/registry";
import { clearBundleRegistry, registerBundle } from "../../conventions/core/bundle";
import { staymanConfig } from "../../conventions/definitions/stayman";
import { bergenConfig } from "../../conventions/definitions/bergen-raises";
import { saycConfig } from "../../conventions/definitions/sayc";
import { ntBundle } from "../../conventions/definitions/nt-bundle";

beforeEach(() => {
  clearRegistry();
  clearBundleRegistry();
});

describe("createDrillConfig", () => {
  it("supports injected lookup without registry setup", () => {
    const localLookup = (id: string) => {
      if (id === "stayman") return staymanConfig;
      if (id === "sayc") return saycConfig;
      throw new Error(`missing local convention: ${id}`);
    };

    const config = createDrillConfig("stayman", Seat.South, { lookupConvention: localLookup });
    expect(config.seatStrategies[Seat.South]).toBe("user");
    const northStrategy = config.seatStrategies[Seat.North];
    expect(northStrategy).not.toBe("user");
    if (northStrategy !== "user") {
      expect(northStrategy.id).toContain("convention:stayman");
    }
  });

  it("propagates errors from injected lookup for missing IDs", () => {
    const throwingLookup = (id: string) => {
      throw new Error(`injected lookup failed: ${id}`);
    };

    expect(() => createDrillConfig("missing-injected", Seat.South, { lookupConvention: throwingLookup }))
      .toThrowError("injected lookup failed: missing-injected");
  });

  it("assigns user seat as 'user'", () => {
    registerConvention(staymanConfig);
    const config = createDrillConfig("stayman", Seat.South);
    expect(config.seatStrategies[Seat.South]).toBe("user");
    expect(config.userSeat).toBe(Seat.South);
    expect(config.conventionId).toBe("stayman");
  });

  it("assigns convention strategy to N/S partner (North)", () => {
    registerConvention(staymanConfig);
    const config = createDrillConfig("stayman", Seat.South);
    const northStrategy = config.seatStrategies[Seat.North];
    expect(northStrategy).not.toBe("user");
    if (northStrategy !== "user") {
      expect(northStrategy.id).toContain("convention:stayman");
    }
  });

  it("assigns opponent strategy to E/W seats", () => {
    registerConvention(staymanConfig);
    const config = createDrillConfig("stayman", Seat.South);
    // East and West are opponents — passStrategy by default
    const eastStrategy = config.seatStrategies[Seat.East];
    expect(eastStrategy).not.toBe("user");
    if (eastStrategy !== "user") {
      expect(eastStrategy.id).toBe("pass");
    }
    const westStrategy = config.seatStrategies[Seat.West];
    expect(westStrategy).not.toBe("user");
    if (westStrategy !== "user") {
      expect(westStrategy.id).toBe("pass");
    }
  });

  it("assigns convention strategy to North for constructive conventions (Bergen)", () => {
    registerConvention(bergenConfig);
    const config = createDrillConfig("bergen-raises", Seat.South);
    // North is South's partner — should use Bergen for opener rebids
    const northStrategy = config.seatStrategies[Seat.North];
    expect(northStrategy).not.toBe("user");
    if (northStrategy !== "user") {
      expect(northStrategy.id).toContain("convention:bergen-raises");
    }
    // East is opponent — should NOT use Bergen
    const eastStrategy = config.seatStrategies[Seat.East];
    expect(eastStrategy).not.toBe("user");
    if (eastStrategy !== "user") {
      expect(eastStrategy.id).toBe("pass");
    }
  });

  it("wraps N/S convention strategy in a chain with natural fallback", () => {
    registerConvention(staymanConfig);
    const config = createDrillConfig("stayman", Seat.South);
    const northStrategy = config.seatStrategies[Seat.North];
    expect(northStrategy).not.toBe("user");
    if (northStrategy !== "user") {
      expect(northStrategy.id).toContain("chain:");
      expect(northStrategy.id).toContain("convention:stayman");
      expect(northStrategy.id).toContain("natural-fallback");
    }
  });

  it("wraps E/W opponent strategy in a chain when opponent bidding enabled", () => {
    registerConvention(staymanConfig);
    registerConvention(saycConfig);
    const config = createDrillConfig("stayman", Seat.South, {
      opponentBidding: true,
      opponentConventionId: "sayc",
    });
    const eastStrategy = config.seatStrategies[Seat.East];
    expect(eastStrategy).not.toBe("user");
    if (eastStrategy !== "user") {
      expect(eastStrategy.id).toContain("chain:");
      expect(eastStrategy.id).toContain("convention:sayc");
      expect(eastStrategy.id).toContain("natural-fallback");
    }
  });

  it("dispatches to meaning pipeline when convention belongs to a registered bundle with meaningSurfaces", () => {
    registerConvention(staymanConfig);
    registerBundle(ntBundle);
    const config = createDrillConfig("stayman", Seat.South);
    const northStrategy = config.seatStrategies[Seat.North];
    expect(northStrategy).not.toBe("user");
    if (northStrategy !== "user") {
      // Meaning pipeline strategy ID uses the bundle ID
      expect(northStrategy.id).toContain("nt-bundle");
    }
  });

  it("falls back to tree pipeline when convention has no registered bundle", () => {
    registerConvention(staymanConfig);
    // Do NOT register ntBundle — no bundle available
    const config = createDrillConfig("stayman", Seat.South);
    const northStrategy = config.seatStrategies[Seat.North];
    expect(northStrategy).not.toBe("user");
    if (northStrategy !== "user") {
      // Tree pipeline uses convention:stayman ID
      expect(northStrategy.id).toContain("convention:stayman");
    }
  });

});
