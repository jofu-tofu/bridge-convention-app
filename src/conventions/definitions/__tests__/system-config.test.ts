import { describe, it, expect } from "vitest";
import {
  getSystemConfig,
  SAYC_SYSTEM_CONFIG,
  TWO_OVER_ONE_SYSTEM_CONFIG,
  ACOL_SYSTEM_CONFIG,
  AVAILABLE_BASE_SYSTEMS,
  BASE_SYSTEM_SAYC,
  BASE_SYSTEM_TWO_OVER_ONE,
  BASE_SYSTEM_ACOL,
  type BaseSystemId,
} from "../system-config";

describe("getSystemConfig", () => {
  it("returns SAYC config for BASE_SYSTEM_SAYC", () => {
    const cfg = getSystemConfig(BASE_SYSTEM_SAYC);
    expect(cfg).toBe(SAYC_SYSTEM_CONFIG);
    expect(cfg.systemId).toBe(BASE_SYSTEM_SAYC);
    expect(cfg.displayName).toBe("Standard American Yellow Card");
    expect(cfg.ntOpening).toEqual({ minHcp: 15, maxHcp: 17 });
    expect(cfg.responderThresholds.inviteMin).toBe(8);
    expect(cfg.responderThresholds.inviteMax).toBe(9);
    expect(cfg.responderThresholds.gameMin).toBe(10);
    expect(cfg.responderThresholds.slamMin).toBe(15);
    expect(cfg.openerRebid.notMinimum).toBe(16);
    expect(cfg.interference.redoubleMin).toBe(10);
  });

  it("returns 2/1 config for BASE_SYSTEM_TWO_OVER_ONE", () => {
    const cfg = getSystemConfig(BASE_SYSTEM_TWO_OVER_ONE);
    expect(cfg).toBe(TWO_OVER_ONE_SYSTEM_CONFIG);
    expect(cfg.systemId).toBe(BASE_SYSTEM_TWO_OVER_ONE);
    expect(cfg.displayName).toBe("2/1 Game Forcing");
  });

  it("returns Acol config for BASE_SYSTEM_ACOL", () => {
    const cfg = getSystemConfig(BASE_SYSTEM_ACOL);
    expect(cfg).toBe(ACOL_SYSTEM_CONFIG);
    expect(cfg.systemId).toBe(BASE_SYSTEM_ACOL);
    expect(cfg.displayName).toBe("Acol");
    expect(cfg.ntOpening).toEqual({ minHcp: 12, maxHcp: 14 });
    expect(cfg.responderThresholds.inviteMin).toBe(10);
    expect(cfg.responderThresholds.inviteMax).toBe(12);
    expect(cfg.responderThresholds.gameMin).toBe(13);
    expect(cfg.responderThresholds.slamMin).toBe(19);
    expect(cfg.openerRebid.notMinimum).toBe(13);
    expect(cfg.interference.redoubleMin).toBe(9);
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

  it("Acol: 2-level new suit requires 10 HCP, one-round forcing", () => {
    expect(ACOL_SYSTEM_CONFIG.suitResponse.twoLevelMin).toBe(10);
    expect(ACOL_SYSTEM_CONFIG.suitResponse.twoLevelForcingDuration).toBe("one-round");
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

  it("Acol: non-forcing, max 9 HCP", () => {
    expect(ACOL_SYSTEM_CONFIG.oneNtResponseAfterMajor.forcing).toBe("non-forcing");
    expect(ACOL_SYSTEM_CONFIG.oneNtResponseAfterMajor.maxHcp).toBe(9);
  });
});

describe("threshold invariants", () => {
  const allConfigs = AVAILABLE_BASE_SYSTEMS.map((s) => getSystemConfig(s.id));

  it("responder thresholds are ordered: inviteMin < inviteMax < gameMin < slamMin", () => {
    for (const cfg of allConfigs) {
      const { inviteMin, inviteMax, gameMin, slamMin } = cfg.responderThresholds;
      expect(inviteMin).toBeLessThan(inviteMax);
      expect(inviteMax).toBeLessThan(gameMin);
      expect(gameMin).toBeLessThan(slamMin);
    }
  });

  it("openerRebid.notMinimum > ntOpening.minHcp", () => {
    for (const cfg of allConfigs) {
      expect(cfg.openerRebid.notMinimum).toBeGreaterThan(cfg.ntOpening.minHcp);
    }
  });

  it("ntOpening.minHcp < ntOpening.maxHcp", () => {
    for (const cfg of allConfigs) {
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

describe("opening requirements", () => {
  it("SAYC/2/1 require 5-card majors", () => {
    expect(SAYC_SYSTEM_CONFIG.openingRequirements.majorSuitMinLength).toBe(5);
    expect(TWO_OVER_ONE_SYSTEM_CONFIG.openingRequirements.majorSuitMinLength).toBe(5);
  });

  it("Acol requires 4-card majors", () => {
    expect(ACOL_SYSTEM_CONFIG.openingRequirements.majorSuitMinLength).toBe(4);
  });
});

describe("1NT response minHcp", () => {
  it("all systems have minHcp defined", () => {
    for (const meta of AVAILABLE_BASE_SYSTEMS) {
      const cfg = getSystemConfig(meta.id);
      expect(cfg.oneNtResponseAfterMajor.minHcp).toBeGreaterThanOrEqual(5);
      expect(cfg.oneNtResponseAfterMajor.minHcp).toBeLessThanOrEqual(7);
    }
  });
});

describe("total-point equivalents", () => {
  const allConfigs = AVAILABLE_BASE_SYSTEMS.map((s) => getSystemConfig(s.id));

  it("TP ranges are valid (min <= max for trump and nt)", () => {
    for (const cfg of allConfigs) {
      const t = cfg.responderThresholds;
      expect(t.inviteMinTp.trump).toBeLessThanOrEqual(t.inviteMaxTp.trump);
      expect(t.inviteMinTp.nt).toBeLessThanOrEqual(t.inviteMaxTp.nt);
    }
  });

  it("trump TP values are >= corresponding HCP values (distribution adds, never subtracts)", () => {
    for (const cfg of allConfigs) {
      const t = cfg.responderThresholds;
      expect(t.inviteMinTp.trump).toBeGreaterThanOrEqual(t.inviteMin);
      expect(t.inviteMaxTp.trump).toBeGreaterThanOrEqual(t.inviteMax);
      expect(t.gameMinTp.trump).toBeGreaterThanOrEqual(t.gameMin);
      expect(t.slamMinTp.trump).toBeGreaterThanOrEqual(t.slamMin);
      expect(cfg.openerRebid.notMinimumTp.trump).toBeGreaterThanOrEqual(cfg.openerRebid.notMinimum);
    }
  });

  it("TP threshold ordering matches HCP ordering", () => {
    for (const cfg of allConfigs) {
      const t = cfg.responderThresholds;
      expect(t.inviteMinTp.trump).toBeLessThanOrEqual(t.inviteMaxTp.trump);
      expect(t.inviteMaxTp.trump).toBeLessThanOrEqual(t.gameMinTp.trump);
      expect(t.gameMinTp.trump).toBeLessThan(t.slamMinTp.trump);
    }
  });
});
