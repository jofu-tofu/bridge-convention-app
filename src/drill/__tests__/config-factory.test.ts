import { describe, it, expect, beforeEach } from "vitest";
import { createDrillConfig } from "../config-factory";
import { Seat } from "../../engine/types";
import { clearRegistry, registerConvention } from "../../conventions/core/registry";
import { staymanConfig } from "../../conventions/definitions/stayman";
import { dontConfig } from "../../conventions/definitions/dont";
import { landyConfig } from "../../conventions/definitions/landy";

beforeEach(() => {
  clearRegistry();
});

describe("createDrillConfig", () => {
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
      expect(northStrategy.id).toBe("convention:stayman");
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

  it("assigns convention strategy to North for defensive conventions (DONT)", () => {
    registerConvention(dontConfig);
    const config = createDrillConfig("dont", Seat.South);
    // North is South's partner — should use DONT for advancer responses
    const northStrategy = config.seatStrategies[Seat.North];
    expect(northStrategy).not.toBe("user");
    if (northStrategy !== "user") {
      expect(northStrategy.id).toBe("convention:dont");
    }
    // East is opponent — should NOT use DONT
    const eastStrategy = config.seatStrategies[Seat.East];
    expect(eastStrategy).not.toBe("user");
    if (eastStrategy !== "user") {
      expect(eastStrategy.id).toBe("pass");
    }
  });

  it("assigns convention strategy to North for Landy", () => {
    registerConvention(landyConfig);
    const config = createDrillConfig("landy", Seat.South);
    // North is South's partner — should use Landy for advancer responses
    const northStrategy = config.seatStrategies[Seat.North];
    expect(northStrategy).not.toBe("user");
    if (northStrategy !== "user") {
      expect(northStrategy.id).toBe("convention:landy");
    }
    // East opens 1NT but is an opponent — should NOT use Landy
    const eastStrategy = config.seatStrategies[Seat.East];
    expect(eastStrategy).not.toBe("user");
    if (eastStrategy !== "user") {
      expect(eastStrategy.id).toBe("pass");
    }
  });
});
