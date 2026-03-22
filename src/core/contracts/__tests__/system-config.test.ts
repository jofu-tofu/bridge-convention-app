import { describe, it, expect } from "vitest";
import {
  getSystemConfig,
  SAYC_SYSTEM_CONFIG,
  TWO_OVER_ONE_SYSTEM_CONFIG,
  AVAILABLE_BASE_SYSTEMS,
} from "../system-config";
import {
  BASE_SYSTEM_SAYC,
  BASE_SYSTEM_TWO_OVER_ONE,
  type BaseSystemId,
} from "../base-system-vocabulary";

describe("getSystemConfig", () => {
  it("returns SAYC config for BASE_SYSTEM_SAYC", () => {
    const cfg = getSystemConfig(BASE_SYSTEM_SAYC);
    expect(cfg).toBe(SAYC_SYSTEM_CONFIG);
    expect(cfg.systemId).toBe(BASE_SYSTEM_SAYC);
    expect(cfg.displayName).toBe("Standard American Yellow Card");
    expect(cfg.ntOpening).toEqual({ minHcp: 15, maxHcp: 17 });
    expect(cfg.responderThresholds).toEqual({
      inviteMin: 8,
      inviteMax: 9,
      gameMin: 10,
      slamMin: 15,
    });
    expect(cfg.openerRebid.notMinimum).toBe(16);
    expect(cfg.interference.redoubleMin).toBe(10);
  });

  it("returns 2/1 config for BASE_SYSTEM_TWO_OVER_ONE", () => {
    const cfg = getSystemConfig(BASE_SYSTEM_TWO_OVER_ONE);
    expect(cfg).toBe(TWO_OVER_ONE_SYSTEM_CONFIG);
    expect(cfg.systemId).toBe(BASE_SYSTEM_TWO_OVER_ONE);
    expect(cfg.displayName).toBe("2/1 Game Forcing");
  });

  it("falls back to SAYC for an unknown system id", () => {
    const cfg = getSystemConfig("unknown" as BaseSystemId);
    expect(cfg).toBe(SAYC_SYSTEM_CONFIG);
  });

  it("returns a config with matching systemId for every entry in AVAILABLE_BASE_SYSTEMS", () => {
    for (const meta of AVAILABLE_BASE_SYSTEMS) {
      const cfg = getSystemConfig(meta.id);
      expect(cfg.systemId).toBe(meta.id);
    }
  });
});

describe("suit response config", () => {
  it("SAYC: 2-level new suit requires 10 HCP, one-round forcing", () => {
    expect(SAYC_SYSTEM_CONFIG.suitResponse.twoLevelMin).toBe(10);
    expect(SAYC_SYSTEM_CONFIG.suitResponse.twoLevelForcingDuration).toBe("one-round");
  });

  it("2/1: 2-level new suit requires 12 HCP, game forcing", () => {
    expect(TWO_OVER_ONE_SYSTEM_CONFIG.suitResponse.twoLevelMin).toBe(12);
    expect(TWO_OVER_ONE_SYSTEM_CONFIG.suitResponse.twoLevelForcingDuration).toBe("game");
  });
});

describe("1NT response after major config", () => {
  it("SAYC: non-forcing, max 10 HCP", () => {
    expect(SAYC_SYSTEM_CONFIG.oneNtResponseAfterMajor.forcing).toBe("non-forcing");
    expect(SAYC_SYSTEM_CONFIG.oneNtResponseAfterMajor.maxHcp).toBe(10);
  });

  it("2/1: semi-forcing, max 12 HCP", () => {
    expect(TWO_OVER_ONE_SYSTEM_CONFIG.oneNtResponseAfterMajor.forcing).toBe("semi-forcing");
    expect(TWO_OVER_ONE_SYSTEM_CONFIG.oneNtResponseAfterMajor.maxHcp).toBe(12);
  });
});

describe("threshold invariants", () => {
  it("SAYC responder thresholds are ordered: inviteMin < inviteMax < gameMin < slamMin", () => {
    const { inviteMin, inviteMax, gameMin, slamMin } =
      SAYC_SYSTEM_CONFIG.responderThresholds;
    expect(inviteMin).toBeLessThan(inviteMax);
    expect(inviteMax).toBeLessThan(gameMin);
    expect(gameMin).toBeLessThan(slamMin);
  });

  it("openerRebid.notMinimum > ntOpening.minHcp", () => {
    for (const cfg of [SAYC_SYSTEM_CONFIG, TWO_OVER_ONE_SYSTEM_CONFIG]) {
      expect(cfg.openerRebid.notMinimum).toBeGreaterThan(cfg.ntOpening.minHcp);
    }
  });

  it("ntOpening.minHcp < ntOpening.maxHcp", () => {
    for (const cfg of [SAYC_SYSTEM_CONFIG, TWO_OVER_ONE_SYSTEM_CONFIG]) {
      expect(cfg.ntOpening.minHcp).toBeLessThan(cfg.ntOpening.maxHcp);
    }
  });
});

describe("AVAILABLE_BASE_SYSTEMS", () => {
  it("has unique IDs", () => {
    const ids = AVAILABLE_BASE_SYSTEMS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
