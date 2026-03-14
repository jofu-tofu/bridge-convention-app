import { describe, it, expect, beforeEach } from "vitest";
import { createDrillConfig } from "../config-factory";
import { Seat } from "../../engine/types";
import { clearRegistry, registerConvention } from "../../conventions/core/registry";
import { clearBundleRegistry, registerBundle } from "../../conventions/core/bundle";
import { ntBundle } from "../../conventions/definitions/nt-bundle";
import { ntBundleConventionConfig } from "../../conventions/definitions/nt-bundle/convention-config";
import { bergenBundle } from "../../conventions/definitions/bergen-bundle";
import { bergenBundleConventionConfig } from "../../conventions/definitions/bergen-bundle/convention-config";

beforeEach(() => {
  clearRegistry();
  clearBundleRegistry();
});

describe("createDrillConfig", () => {
  it("assigns user seat as 'user'", () => {
    registerConvention(ntBundleConventionConfig);
    registerBundle(ntBundle);
    const config = createDrillConfig("nt-bundle", Seat.South);
    expect(config.seatStrategies[Seat.South]).toBe("user");
    expect(config.userSeat).toBe(Seat.South);
    expect(config.conventionId).toBe("nt-bundle");
  });

  it("assigns bundle strategy to N/S partner (North)", () => {
    registerConvention(ntBundleConventionConfig);
    registerBundle(ntBundle);
    const config = createDrillConfig("nt-bundle", Seat.South);
    const northStrategy = config.seatStrategies[Seat.North];
    expect(northStrategy).not.toBe("user");
    if (northStrategy !== "user") {
      expect(northStrategy.id).toContain("nt-bundle");
    }
  });

  it("assigns passStrategy to E/W seats", () => {
    registerConvention(ntBundleConventionConfig);
    registerBundle(ntBundle);
    const config = createDrillConfig("nt-bundle", Seat.South);
    // East and West are opponents — always passStrategy
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

  it("assigns bundle strategy to North for Bergen bundle", () => {
    registerConvention(bergenBundleConventionConfig);
    registerBundle(bergenBundle);
    const config = createDrillConfig("bergen-bundle", Seat.South);
    const northStrategy = config.seatStrategies[Seat.North];
    expect(northStrategy).not.toBe("user");
    if (northStrategy !== "user") {
      expect(northStrategy.id).toContain("bergen-bundle");
    }
    // East is opponent — always pass
    const eastStrategy = config.seatStrategies[Seat.East];
    expect(eastStrategy).not.toBe("user");
    if (eastStrategy !== "user") {
      expect(eastStrategy.id).toBe("pass");
    }
  });

  it("wraps N/S bundle strategy in a chain with natural fallback", () => {
    registerConvention(ntBundleConventionConfig);
    registerBundle(ntBundle);
    const config = createDrillConfig("nt-bundle", Seat.South);
    const northStrategy = config.seatStrategies[Seat.North];
    expect(northStrategy).not.toBe("user");
    if (northStrategy !== "user") {
      expect(northStrategy.id).toContain("chain:");
      expect(northStrategy.id).toContain("nt-bundle");
      expect(northStrategy.id).toContain("natural-fallback");
    }
  });

  it("throws when no bundle is registered for the convention ID", () => {
    // No bundle registered
    expect(() => createDrillConfig("missing-bundle", Seat.South))
      .toThrowError(/No bundle registered for "missing-bundle"/);
  });

  it("dispatches to meaning pipeline when user selects the bundle ID", () => {
    registerConvention(ntBundleConventionConfig);
    registerBundle(ntBundle);
    const config = createDrillConfig("nt-bundle", Seat.South);
    const northStrategy = config.seatStrategies[Seat.North];
    expect(northStrategy).not.toBe("user");
    if (northStrategy !== "user") {
      expect(northStrategy.id).toContain("nt-bundle");
    }
  });
});
