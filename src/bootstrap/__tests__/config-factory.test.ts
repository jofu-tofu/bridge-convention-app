import { describe, it, expect } from "vitest";
import { createProtocolDrillConfig } from "../config-factory";
import { Seat } from "../../engine/types";
import { BASE_SYSTEM_SAYC, BASE_SYSTEM_TWO_OVER_ONE, BASE_SYSTEM_ACOL } from "../../conventions/definitions/system-config";

describe("createProtocolDrillConfig", () => {
  it("assigns user seat as 'user'", () => {
    const config = createProtocolDrillConfig("nt-bundle", Seat.South, { baseSystem: BASE_SYSTEM_SAYC });
    expect(config.seatStrategies[Seat.South]).toBe("user");
    expect(config.userSeat).toBe(Seat.South);
    expect(config.conventionId).toBe("nt-bundle");
  });

  it("assigns protocol strategy to N/S partner (North)", () => {
    const config = createProtocolDrillConfig("nt-bundle", Seat.South, { baseSystem: BASE_SYSTEM_SAYC });
    const northStrategy = config.seatStrategies[Seat.North];
    expect(northStrategy).not.toBe("user");
    if (northStrategy !== "user") {
      expect(northStrategy.id).toBeDefined();
    }
  });

  it("assigns natural fallback strategy to E/W seats", () => {
    const config = createProtocolDrillConfig("nt-bundle", Seat.South, { baseSystem: BASE_SYSTEM_SAYC });
    const eastStrategy = config.seatStrategies[Seat.East];
    expect(eastStrategy).not.toBe("user");
    if (eastStrategy !== "user") {
      expect(eastStrategy.id).toContain("natural-fallback");
    }
    const westStrategy = config.seatStrategies[Seat.West];
    expect(westStrategy).not.toBe("user");
    if (westStrategy !== "user") {
      expect(westStrategy.id).toContain("natural-fallback");
    }
  });

  it("works for Bergen bundle", () => {
    const config = createProtocolDrillConfig("bergen-bundle", Seat.South, { baseSystem: BASE_SYSTEM_SAYC });
    expect(config.conventionId).toBe("bergen-bundle");
    expect(config.seatStrategies[Seat.South]).toBe("user");
  });

  it("throws when no bundle is registered", () => {
    expect(() => createProtocolDrillConfig("missing-spec", Seat.South, { baseSystem: BASE_SYSTEM_SAYC }))
      .toThrowError(/No bundle registered for "missing-spec"/);
  });

  it("accepts baseSystem override to select 2/1 system config", () => {
    const config = createProtocolDrillConfig("nt-bundle", Seat.South, {
      baseSystem: BASE_SYSTEM_TWO_OVER_ONE,
    });
    expect(config.conventionId).toBe("nt-bundle");
    expect(config.seatStrategies[Seat.South]).toBe("user");
    // Strategy should be created — no throw
    const northStrategy = config.seatStrategies[Seat.North];
    expect(northStrategy).not.toBe("user");
  });

  it("accepts baseSystem override to select Acol system config", () => {
    const config = createProtocolDrillConfig("nt-bundle", Seat.South, {
      baseSystem: BASE_SYSTEM_ACOL,
    });
    expect(config.conventionId).toBe("nt-bundle");
    expect(config.seatStrategies[Seat.South]).toBe("user");
    const northStrategy = config.seatStrategies[Seat.North];
    expect(northStrategy).not.toBe("user");
  });
});
