import { describe, it, expect } from "vitest";
import {
  PROFILE_CATEGORIES,
  formatFieldValue,
  valuesMatch,
} from "../../screens/profile-display";
import { getSystemConfig } from "../../../service";
import type { SystemConfig } from "../../../service";

const SAYC = getSystemConfig("sayc");
const TWO_OVER_ONE = getSystemConfig("two-over-one");
const ACOL = getSystemConfig("acol");

describe("PROFILE_CATEGORIES", () => {
  it("has 8 categories", () => {
    expect(PROFILE_CATEGORIES).toHaveLength(8);
  });

  it("categories have unique labels", () => {
    const labels = PROFILE_CATEGORIES.map((c) => c.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("every field has a label and accessor", () => {
    for (const cat of PROFILE_CATEGORIES) {
      for (const field of cat.fields) {
        expect(field.label).toBeTruthy();
        expect(typeof field.accessor).toBe("function");
      }
    }
  });
});

describe("formatFieldValue", () => {
  it("formats range fields as 'min\u2013max HCP'", () => {
    const ntField = PROFILE_CATEGORIES[0]!.fields[0]!;
    expect(formatFieldValue(SAYC, ntField)).toBe("15\u201317 HCP");
    expect(formatFieldValue(ACOL, ntField)).toBe("12\u201314 HCP");
  });

  it("formats threshold fields as 'n+ HCP'", () => {
    const gameMinField = PROFILE_CATEGORIES[1]!.fields[1]!;
    expect(formatFieldValue(SAYC, gameMinField)).toBe("10+ HCP");
    expect(formatFieldValue(ACOL, gameMinField)).toBe("13+ HCP");
  });

  it("formats forcing duration enum", () => {
    const forcingField = PROFILE_CATEGORIES[3]!.fields[1]!;
    expect(formatFieldValue(SAYC, forcingField)).toBe("One Round");
    expect(formatFieldValue(TWO_OVER_ONE, forcingField)).toBe("Game Forcing");
  });

  it("formats forcing status enum", () => {
    const forcingStatusField = PROFILE_CATEGORIES[4]!.fields[0]!;
    expect(formatFieldValue(SAYC, forcingStatusField)).toBe("Non-Forcing");
    expect(formatFieldValue(TWO_OVER_ONE, forcingStatusField)).toBe("Semi-Forcing");
  });

  it("formats major suit length", () => {
    const majorField = PROFILE_CATEGORIES[5]!.fields[0]!;
    expect(formatFieldValue(SAYC, majorField)).toBe("5-card majors");
    expect(formatFieldValue(ACOL, majorField)).toBe("4-card majors");
  });
});

describe("valuesMatch", () => {
  const allConfigs: SystemConfig[] = [SAYC, TWO_OVER_ONE, ACOL];

  it("returns true when all systems have the same value", () => {
    // DONT overcall HCP range is 8-15 for all three
    const dontField = PROFILE_CATEGORIES[7]!.fields[0]!;
    expect(valuesMatch(allConfigs, dontField)).toBe(true);
  });

  it("returns false when systems differ", () => {
    // NT opening range differs (SAYC/2/1 = 15-17, Acol = 12-14)
    const ntField = PROFILE_CATEGORIES[0]!.fields[0]!;
    expect(valuesMatch(allConfigs, ntField)).toBe(false);
  });

  it("returns true for a single config", () => {
    const ntField = PROFILE_CATEGORIES[0]!.fields[0]!;
    expect(valuesMatch([SAYC], ntField)).toBe(true);
  });
});
