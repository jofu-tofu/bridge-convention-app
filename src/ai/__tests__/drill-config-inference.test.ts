import { describe, it, expect, beforeEach } from "vitest";
import { createDrillConfig } from "../drill-config-factory";
import {
  registerConvention,
  clearRegistry,
} from "../../conventions/registry";
import { staymanConfig } from "../../conventions/stayman";
import { saycConfig } from "../../conventions/sayc";
import { gerberConfig } from "../../conventions/gerber";
import { Seat } from "../../engine/types";

describe("Suite 5: DrillConfig Inference Integration", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(staymanConfig);
    registerConvention(saycConfig);
    registerConvention(gerberConfig);
  });

  it("5.1 N-S own partnership is convention provider for the selected convention", () => {
    const config = createDrillConfig("stayman", Seat.South);
    expect(config.nsInferenceConfig).toBeDefined();
    expect(config.nsInferenceConfig!.ownPartnership.id).toBe(
      "convention:stayman",
    );
  });

  it("5.2 N-S opponent partnership is natural provider", () => {
    const config = createDrillConfig("stayman", Seat.South);
    expect(config.nsInferenceConfig!.opponentPartnership.id).toBe("natural");
  });

  it("5.3 E-W own partnership is natural by default", () => {
    const config = createDrillConfig("stayman", Seat.South);
    expect(config.ewInferenceConfig).toBeDefined();
    expect(config.ewInferenceConfig!.ownPartnership.id).toBe("natural");
  });

  it("5.4 E-W opponent partnership is natural by default", () => {
    const config = createDrillConfig("stayman", Seat.South);
    expect(config.ewInferenceConfig!.opponentPartnership.id).toBe("natural");
  });

  it("5.5 opponentBidding → E-W own partnership uses SAYC convention", () => {
    const config = createDrillConfig("stayman", Seat.South, {
      opponentBidding: true,
    });
    expect(config.ewInferenceConfig!.ownPartnership.id).toBe(
      "convention:sayc",
    );
  });

  it("5.6 opponentBidding → E-W opponent partnership still natural (asymmetry)", () => {
    const config = createDrillConfig("stayman", Seat.South, {
      opponentBidding: true,
    });
    expect(config.ewInferenceConfig!.opponentPartnership.id).toBe("natural");
  });

  it("5.7 opponentConventionId → E-W uses custom convention", () => {
    const config = createDrillConfig("stayman", Seat.South, {
      opponentBidding: true,
      opponentConventionId: "gerber",
    });
    expect(config.ewInferenceConfig!.ownPartnership.id).toBe(
      "convention:gerber",
    );
  });

  it("5.8 Invalid opponentConventionId falls back to natural provider", () => {
    const config = createDrillConfig("stayman", Seat.South, {
      opponentBidding: true,
      opponentConventionId: "nonexistent-convention",
    });
    expect(config.ewInferenceConfig!.ownPartnership.id).toBe("natural");
  });
});
