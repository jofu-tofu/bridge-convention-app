import { describe, it, expect } from "vitest";
import { createProtocolDrillConfig } from "../config-factory";
import { Seat } from "../../engine/types";

describe("createProtocolDrillConfig", () => {
  it("assigns user seat as 'user'", () => {
    const config = createProtocolDrillConfig("nt-bundle", Seat.South);
    expect(config.seatStrategies[Seat.South]).toBe("user");
    expect(config.userSeat).toBe(Seat.South);
    expect(config.conventionId).toBe("nt-bundle");
  });

  it("assigns protocol strategy to N/S partner (North)", () => {
    const config = createProtocolDrillConfig("nt-bundle", Seat.South);
    const northStrategy = config.seatStrategies[Seat.North];
    expect(northStrategy).not.toBe("user");
    if (northStrategy !== "user") {
      expect(northStrategy.id).toBeDefined();
    }
  });

  it("assigns natural fallback strategy to E/W seats", () => {
    const config = createProtocolDrillConfig("nt-bundle", Seat.South);
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
    const config = createProtocolDrillConfig("bergen-bundle", Seat.South);
    expect(config.conventionId).toBe("bergen-bundle");
    expect(config.seatStrategies[Seat.South]).toBe("user");
  });

  it("throws when no system is registered", () => {
    expect(() => createProtocolDrillConfig("missing-spec", Seat.South))
      .toThrowError(/No BiddingSystem registered for "missing-spec"/);
  });
});
