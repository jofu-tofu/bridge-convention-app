import { describe, it, expect, beforeEach } from "vitest";
import { createDrillConfig } from "../config-factory";
import { Seat } from "../../engine/types";
import { clearRegistry, registerConvention } from "../../conventions/core/registry";
import { staymanConfig } from "../../conventions/definitions/stayman";
import { dontConfig } from "../../conventions/definitions/dont";

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

  it("assigns convention strategy to participant seats", () => {
    registerConvention(staymanConfig);
    const config = createDrillConfig("stayman", Seat.South);
    // Stayman: North (opener) and South (responder) are participants
    // South is user, so North should get convention strategy
    const northStrategy = config.seatStrategies[Seat.North];
    expect(northStrategy).not.toBe("user");
    expect(typeof northStrategy).toBe("object");
    if (northStrategy !== "user") {
      expect(northStrategy.id).toBe("convention:stayman");
    }
  });

  it("assigns passStrategy to non-participant seats", () => {
    registerConvention(staymanConfig);
    const config = createDrillConfig("stayman", Seat.South);
    // East and West are not participants in Stayman
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

  it("works with DONT convention (different participant seats)", () => {
    registerConvention(dontConfig);
    const config = createDrillConfig("dont", Seat.South);
    // DONT: East (1NT opener) and South (overcaller) are participants
    // South is user, East should get convention strategy
    const eastStrategy = config.seatStrategies[Seat.East];
    expect(eastStrategy).not.toBe("user");
    if (eastStrategy !== "user") {
      expect(eastStrategy.id).toBe("convention:dont");
    }
  });
});
