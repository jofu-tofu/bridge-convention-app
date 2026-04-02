import { describe, it, expect } from "vitest";
import { buildConventionCard, buildAcblCardPanel } from "../convention-card";
import {
  SAYC_SYSTEM_CONFIG,
  ACOL_SYSTEM_CONFIG,
  TWO_OVER_ONE_SYSTEM_CONFIG,
} from "../../session-types";
import { ConventionCardFormat } from "../../response-types";

describe("buildConventionCard", () => {
  it("SAYC: 15–17, 5-card majors, 1 round", () => {
    const card = buildConventionCard(SAYC_SYSTEM_CONFIG, "N-S");
    expect(card.partnership).toBe("N-S");
    expect(card.systemName).toBe("SAYC");
    expect(card.ntRange).toBe("15–17");
    expect(card.majorLength).toBe("5-card majors");
    expect(card.twoLevelForcing).toBe("1 round");
    expect(card.oneNtResponse).toBe("Non-forcing 6–10");
  });

  it("Acol: 12–14, 4-card majors, 1 round", () => {
    const card = buildConventionCard(ACOL_SYSTEM_CONFIG, "N-S");
    expect(card.systemName).toBe("Acol");
    expect(card.ntRange).toBe("12–14");
    expect(card.majorLength).toBe("4-card majors");
    expect(card.twoLevelForcing).toBe("1 round");
    expect(card.oneNtResponse).toBe("Non-forcing 6–9");
  });

  it("2/1: 15–17, 5-card majors, Game forcing", () => {
    const card = buildConventionCard(TWO_OVER_ONE_SYSTEM_CONFIG, "E-W");
    expect(card.partnership).toBe("E-W");
    expect(card.systemName).toBe("2/1");
    expect(card.ntRange).toBe("15–17");
    expect(card.majorLength).toBe("5-card majors");
    expect(card.twoLevelForcing).toBe("Game forcing");
    expect(card.oneNtResponse).toBe("Semi-forcing 6–12");
  });
});

// buildConventionCardPanel tests require WASM initialization (module catalog from Rust).
// These are validated by E2E tests and the convention card panel visual in the app.

describe("buildAcblCardPanel", () => {
  it("returns exactly 11 sections", () => {
    const panel = buildAcblCardPanel(SAYC_SYSTEM_CONFIG);
    expect(panel.sections).toHaveLength(11);
  });

  it("section order matches ACBL card order", () => {
    const panel = buildAcblCardPanel(SAYC_SYSTEM_CONFIG);
    const ids = panel.sections.map((s) => s.id);
    expect(ids).toEqual([
      "acbl-special-doubles",
      "acbl-notrump-opening",
      "acbl-major-opening",
      "acbl-minor-opening",
      "acbl-two-level-openings",
      "acbl-other-conventional",
      "acbl-defensive-competitive",
      "acbl-leads",
      "acbl-signals",
      "acbl-slam-conventions",
      "acbl-important-notes",
    ]);
  });

  it("unavailable sections have available: false and empty items/modules", () => {
    const panel = buildAcblCardPanel(SAYC_SYSTEM_CONFIG);
    const unavailable = panel.sections.filter((s) => !s.available);
    // Without WASM, module lookups fail so weak-twos section is also unavailable
    // Always unavailable: Other Conventional Calls, Leads, Signals, Important Notes
    const alwaysUnavailableIds = [
      "acbl-other-conventional",
      "acbl-leads",
      "acbl-signals",
      "acbl-important-notes",
    ];
    for (const id of alwaysUnavailableIds) {
      const section = unavailable.find((s) => s.id === id);
      expect(section, `${id} should be unavailable`).toBeDefined();
      expect(section!.items).toHaveLength(0);
      expect(section!.modules).toHaveLength(0);
    }
  });

  it("available sections have expected items (spot-check: Notrump has 1NT Range)", () => {
    const panel = buildAcblCardPanel(SAYC_SYSTEM_CONFIG);
    const notrump = panel.sections.find((s) => s.id === "acbl-notrump-opening");
    expect(notrump).toBeDefined();
    expect(notrump!.available).toBe(true);
    const ntRangeItem = notrump!.items.find((i) => i.label === "1NT Range");
    expect(ntRangeItem).toBeDefined();
    expect(ntRangeItem!.value).toBe("15–17");
  });

  it("SAYC system name is correct", () => {
    const panel = buildAcblCardPanel(SAYC_SYSTEM_CONFIG);
    expect(panel.systemName).toBe("SAYC");
    expect(panel.partnership).toBe("N-S");
  });

  it("2/1 system produces valid output", () => {
    const panel = buildAcblCardPanel(TWO_OVER_ONE_SYSTEM_CONFIG);
    expect(panel.systemName).toBe("2/1");
    expect(panel.sections).toHaveLength(11);
    const major = panel.sections.find((s) => s.id === "acbl-major-opening");
    expect(major!.items.find((i) => i.label === "New Suit at 2-Level")!.value).toContain("Game forcing");
  });

  it("Acol system produces valid output", () => {
    const panel = buildAcblCardPanel(ACOL_SYSTEM_CONFIG);
    expect(panel.systemName).toBe("Acol");
    expect(panel.sections).toHaveLength(11);
    const notrump = panel.sections.find((s) => s.id === "acbl-notrump-opening");
    expect(notrump!.items.find((i) => i.label === "1NT Range")!.value).toBe("12–14");
  });

  it("Defensive section shows Natural vs 1NT when dont module not active", () => {
    // Without WASM, no modules are active, so dont won't be in activeModuleIds
    const panel = buildAcblCardPanel(SAYC_SYSTEM_CONFIG);
    const defensive = panel.sections.find((s) => s.id === "acbl-defensive-competitive");
    expect(defensive!.available).toBe(true);
    const vs1nt = defensive!.items.find((i) => i.label === "vs 1NT");
    expect(vs1nt!.value).toBe("Natural");
  });

  it("ConventionCardFormat enum is importable", () => {
    expect(ConventionCardFormat.App).toBe("app");
    expect(ConventionCardFormat.Acbl).toBe("acbl");
  });
});
