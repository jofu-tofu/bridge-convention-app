/**
 * End-to-end test: Bergen bundle through config-factory dispatch.
 *
 * Verifies that when the user selects "bergen-bundle" as a convention ID,
 * the config-factory dispatches to the meaning pipeline and produces correct results.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Seat } from "../../../../engine/types";
import { hand } from "../../../../engine/__tests__/fixtures";
import { evaluateHand, calculateHcp } from "../../../../engine/hand-evaluator";
import { buildAuction } from "../../../../engine/auction-helpers";
import { createBiddingContext } from "../../../core";
import {
  registerConvention,
  clearRegistry,
} from "../../../core/registry";
import { registerBundle, clearBundleRegistry, getBundle } from "../../../core/bundle";
import { bergenBundle } from "../config";
import { bergenBundleConventionConfig } from "../convention-config";
import { createDrillConfig } from "../../../../bootstrap/config-factory";

// ─── Setup ──────────────────────────────────────────────────

beforeEach(() => {
  clearRegistry();
  clearBundleRegistry();
  registerConvention(bergenBundleConventionConfig);
  registerBundle(bergenBundle);
});

// ─── Tests ──────────────────────────────────────────────────

describe("Bergen bundle end-to-end via config-factory", () => {
  it("bundle is registered and retrievable", () => {
    const bundle = getBundle("bergen-bundle");
    expect(bundle).toBeDefined();
    expect(bundle!.id).toBe("bergen-bundle");
    expect(bundle!.meaningSurfaces).toBeDefined();
    expect(bundle!.meaningSurfaces!.length).toBeGreaterThanOrEqual(2);
  });

  it("config-factory dispatches bergen-bundle to meaning pipeline", () => {
    const drillConfig = createDrillConfig("bergen-bundle", Seat.South);
    expect(drillConfig.conventionId).toBe("bergen-bundle");
    // The North strategy should be a chain containing a meaning-pipeline strategy
    const northStrategy = drillConfig.seatStrategies[Seat.North];
    expect(northStrategy).not.toBe("user");
  });

  it("meaning pipeline produces correct result for constructive hand (8 HCP, 4H)", () => {
    // This tests that the FULL dispatch path works:
    // config-factory → buildBundleStrategy → meaningBundleToStrategy → suggest
    const h = hand("S8","S5","S2","HK","HT","H6","H2","DK","DQ","D3","C5","C3","C2");
    expect(calculateHcp(h)).toBe(8);

    const auction = buildAuction(Seat.North, ["1H", "P"]);
    const ctx = createBiddingContext({
      hand: h,
      auction,
      seat: Seat.South,
      evaluation: evaluateHand(h),
    });

    // South is the user seat, so we need to test the N/S partnership strategy
    // by calling it for a non-user N/S seat. With userSeat=North, South gets the strategy.
    const drillConfigNorth = createDrillConfig("bergen-bundle", Seat.North);
    const southStrategy = drillConfigNorth.seatStrategies[Seat.South];
    expect(southStrategy).not.toBe("user");
    if (southStrategy === "user") return;

    const result = southStrategy.suggest(ctx);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("bid");
    if (result!.call.type === "bid") {
      expect(result!.call.level).toBe(3);
      // 3C for constructive
      expect(result!.call.strain).toBe("C");
    }
  });

  it("meaning pipeline produces correct result for game raise hand (14 HCP, 4H)", () => {
    const h = hand("SA","SK","S2","HQ","HT","H6","H2","DK","DQ","D3","C5","C3","C2");
    expect(calculateHcp(h)).toBe(14);

    const drillConfig = createDrillConfig("bergen-bundle", Seat.North);
    const auction = buildAuction(Seat.North, ["1H", "P"]);
    const ctx = createBiddingContext({
      hand: h,
      auction,
      seat: Seat.South,
      evaluation: evaluateHand(h),
    });

    const southStrategy = drillConfig.seatStrategies[Seat.South];
    if (southStrategy === "user") return;

    const result = southStrategy.suggest(ctx);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("bid");
    if (result!.call.type === "bid") {
      expect(result!.call.level).toBe(4);
      expect(result!.call.strain).toBe("H");
    }
  });
});
