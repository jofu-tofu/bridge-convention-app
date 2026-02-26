import { describe, test, expect, beforeEach } from "vitest";
import { Seat } from "../../../engine/types";
import {
  registerConvention,
  clearRegistry,
  listConventions,
} from "../../core/registry";
import { saycConfig } from "../../definitions/sayc";
import { filterConventions } from "../../../display/filter-conventions";
import { createDrillConfig } from "../../../drill/config-factory";

beforeEach(() => {
  clearRegistry();
  registerConvention(saycConfig);
});

describe("SAYC drillability", () => {
  test("config is NOT internal", () => {
    expect(saycConfig.internal).not.toBe(true);
  });

  test("deal constraints require South 10+ HCP", () => {
    const southConstraint = saycConfig.dealConstraints.seats.find(
      (s) => s.seat === Seat.South,
    );
    expect(southConstraint).toBeDefined();
    expect(southConstraint!.minHcp).toBe(10);
  });

  test("appears in filtered convention list", () => {
    const filtered = filterConventions(listConventions(), "", null);
    const sayc = filtered.find((c) => c.id === "sayc");
    expect(sayc).toBeDefined();
  });

  test("drill config wires user as South with AI partners", () => {
    const config = createDrillConfig("sayc", Seat.South, {
      opponentBidding: true,
    });
    expect(config.userSeat).toBe(Seat.South);
    expect(config.seatStrategies[Seat.South]).toBe("user");
    // All other seats should be BiddingStrategy objects (not "user")
    expect(typeof config.seatStrategies[Seat.North]).toBe("object");
    expect(typeof config.seatStrategies[Seat.East]).toBe("object");
    expect(typeof config.seatStrategies[Seat.West]).toBe("object");
  });

  test("defaultAuction returns undefined", () => {
    expect(saycConfig.defaultAuction?.(Seat.South)).toBeUndefined();
  });
});
