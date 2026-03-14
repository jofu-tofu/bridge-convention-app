import { describe, it, expect, beforeEach } from "vitest";
import { createDrillConfig } from "../config-factory";
import {
  registerConvention,
  clearRegistry,
} from "../../conventions/core/registry";
import { clearBundleRegistry, registerBundle } from "../../conventions/core/bundle";
import { ntBundle } from "../../conventions/definitions/nt-bundle";
import { ntBundleConventionConfig } from "../../conventions/definitions/nt-bundle/convention-config";
import { Seat } from "../../engine/types";

describe("Suite 5: DrillConfig Inference Integration", () => {
  beforeEach(() => {
    clearRegistry();
    clearBundleRegistry();
    registerConvention(ntBundleConventionConfig);
    registerBundle(ntBundle);
  });

  it("5.1 N-S own partnership is natural provider", () => {
    const config = createDrillConfig("nt-bundle", Seat.South);
    expect(config.nsInferenceConfig).toBeDefined();
    expect(config.nsInferenceConfig!.ownPartnership.id).toBe("natural");
  });

  it("5.2 N-S opponent partnership is natural provider", () => {
    const config = createDrillConfig("nt-bundle", Seat.South);
    expect(config.nsInferenceConfig!.opponentPartnership.id).toBe("natural");
  });

  it("5.3 E-W own partnership is natural", () => {
    const config = createDrillConfig("nt-bundle", Seat.South);
    expect(config.ewInferenceConfig).toBeDefined();
    expect(config.ewInferenceConfig!.ownPartnership.id).toBe("natural");
  });

  it("5.4 E-W opponent partnership is natural", () => {
    const config = createDrillConfig("nt-bundle", Seat.South);
    expect(config.ewInferenceConfig!.opponentPartnership.id).toBe("natural");
  });
});
