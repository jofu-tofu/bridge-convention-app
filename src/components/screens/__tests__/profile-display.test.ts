import { describe, it, expect } from "vitest";
import {
  SAYC_SYSTEM_CONFIG,
  ACOL_SYSTEM_CONFIG,
} from "../../../service/session-types";
import {
  formatFieldValue,
  formatTrumpTpValue,
  formatNtTpValue,
  valuesMatch,
  valuesMatchTrumpTp,
  valuesMatchNtTp,
  PROFILE_CATEGORIES,
  type ProfileField,
} from "../profile-display";

// ─── Helpers ────────────────────────────────────────────────────

function findField(categoryLabel: string, fieldLabel: string): ProfileField {
  const cat = PROFILE_CATEGORIES.find((c) => c.label === categoryLabel);
  if (!cat) throw new Error(`Category "${categoryLabel}" not found`);
  const field = cat.fields.find((f) => f.label === fieldLabel);
  if (!field) throw new Error(`Field "${fieldLabel}" not found in "${categoryLabel}"`);
  return field;
}

// ─── formatTrumpTpValue ─────────────────────────────────────────

describe("formatTrumpTpValue", () => {
  it("returns range for rangeWithTp fields (SAYC invite)", () => {
    const field = findField("Responder Thresholds", "Invite Range");
    expect(formatTrumpTpValue(SAYC_SYSTEM_CONFIG, field)).toBe("8\u201310 TP");
  });

  it("returns threshold for thresholdWithTp fields (SAYC game min)", () => {
    const field = findField("Responder Thresholds", "Game Minimum");
    expect(formatTrumpTpValue(SAYC_SYSTEM_CONFIG, field)).toBe("10+ TP");
  });

  it("returns empty string for non-TP fields", () => {
    const field = findField("1NT Opening", "HCP Range");
    expect(formatTrumpTpValue(SAYC_SYSTEM_CONFIG, field)).toBe("");
  });
});

// ─── formatNtTpValue ────────────────────────────────────────────

describe("formatNtTpValue", () => {
  it("returns range for rangeWithTp fields (SAYC invite)", () => {
    const field = findField("Responder Thresholds", "Invite Range");
    expect(formatNtTpValue(SAYC_SYSTEM_CONFIG, field)).toBe("8\u20139 TP");
  });

  it("returns threshold for thresholdWithTp fields (SAYC slam)", () => {
    const field = findField("Responder Thresholds", "Slam Explore");
    expect(formatNtTpValue(SAYC_SYSTEM_CONFIG, field)).toBe("15+ TP");
  });

  it("returns empty string for non-TP fields", () => {
    const field = findField("Suit Responses", "2-Level Minimum");
    expect(formatNtTpValue(SAYC_SYSTEM_CONFIG, field)).toBe("");
  });
});

// ─── formatFieldValue still works ───────────────────────────────

describe("formatFieldValue", () => {
  it("rangeWithTp fields format as HCP", () => {
    const field = findField("Responder Thresholds", "Invite Range");
    expect(formatFieldValue(SAYC_SYSTEM_CONFIG, field)).toBe("8\u20139 HCP");
  });

  it("thresholdWithTp fields format as HCP", () => {
    const field = findField("Opener Rebid", "Not Minimum");
    expect(formatFieldValue(SAYC_SYSTEM_CONFIG, field)).toBe("16+ HCP");
  });
});

// ─── valuesMatchTrumpTp / valuesMatchNtTp ───────────────────────

describe("valuesMatchTrumpTp", () => {
  it("returns false when SAYC vs Acol trump TP differs", () => {
    const field = findField("Responder Thresholds", "Invite Range");
    // SAYC: 8–10 TP, Acol: 10–13 TP
    expect(valuesMatchTrumpTp([SAYC_SYSTEM_CONFIG, ACOL_SYSTEM_CONFIG], field)).toBe(false);
  });

  it("returns true for single config", () => {
    const field = findField("Responder Thresholds", "Invite Range");
    expect(valuesMatchTrumpTp([SAYC_SYSTEM_CONFIG], field)).toBe(true);
  });
});

describe("valuesMatchNtTp", () => {
  it("returns false when SAYC vs Acol NT TP differs", () => {
    const field = findField("Responder Thresholds", "Invite Range");
    // SAYC: 8–9 TP, Acol: 10–12 TP
    expect(valuesMatchNtTp([SAYC_SYSTEM_CONFIG, ACOL_SYSTEM_CONFIG], field)).toBe(false);
  });
});

// ─── valuesMatch for non-TP fields ──────────────────────────────

describe("valuesMatch", () => {
  it("works for non-TP range fields", () => {
    const field = findField("1NT Opening", "HCP Range");
    // SAYC: 15-17, Acol: 12-14 → differs
    expect(valuesMatch([SAYC_SYSTEM_CONFIG, ACOL_SYSTEM_CONFIG], field)).toBe(false);
  });
});

// ─── Category structure ─────────────────────────────────────────

describe("PROFILE_CATEGORIES", () => {
  it("marks Responder Thresholds and Opener Rebid as hasTotalPoints", () => {
    const tpCategories = PROFILE_CATEGORIES.filter((c) => c.hasTotalPoints);
    expect(tpCategories.map((c) => c.label)).toEqual(["Responder Thresholds", "Opener Rebid"]);
  });

  it("non-TP categories do not have hasTotalPoints", () => {
    const nonTpCategories = PROFILE_CATEGORIES.filter((c) => !c.hasTotalPoints);
    expect(nonTpCategories.length).toBeGreaterThan(0);
    for (const cat of nonTpCategories) {
      expect(cat.hasTotalPoints).toBeFalsy();
    }
  });
});
