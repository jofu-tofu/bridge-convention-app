import { describe, it, expect } from "vitest";
import { buildConventionCard, buildConventionCardPanel } from "../convention-card";
import {
  SAYC_SYSTEM_CONFIG,
  ACOL_SYSTEM_CONFIG,
  TWO_OVER_ONE_SYSTEM_CONFIG,
} from "../../../conventions/definitions/system-config";
import { ConventionCardSectionId } from "../../response-types";

// Side-effect: register all bundles
import "../../../conventions/registration";

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

describe("buildConventionCardPanel", () => {
  it("SAYC with nt-bundle: includes NT sections with Stayman and Jacoby modules", () => {
    const panel = buildConventionCardPanel(SAYC_SYSTEM_CONFIG, "nt-bundle");
    expect(panel.systemName).toBe("SAYC");
    expect(panel.partnership).toBe("N-S");

    const ntSection = panel.sections.find((s) => s.id === ConventionCardSectionId.NotrumpOpening);
    expect(ntSection).toBeDefined();
    expect(ntSection!.title).toBe("1NT Opening & Responses");
    expect(ntSection!.items.find((i) => i.label === "1NT Range")?.value).toBe("15–17");
    expect(ntSection!.modules.some((m) => m.moduleId === "stayman")).toBe(true);
    expect(ntSection!.modules.some((m) => m.moduleId === "jacoby-transfers")).toBe(true);
  });

  it("includes general section with system name", () => {
    const panel = buildConventionCardPanel(SAYC_SYSTEM_CONFIG);
    const general = panel.sections.find((s) => s.id === ConventionCardSectionId.General);
    expect(general).toBeDefined();
    expect(general!.items.find((i) => i.label === "System")?.value).toBe("SAYC");
    expect(general!.items.find((i) => i.label === "Majors")?.value).toBe("5-card majors");
  });

  it("includes slam section with Blackwood (base module)", () => {
    const panel = buildConventionCardPanel(SAYC_SYSTEM_CONFIG);
    const slam = panel.sections.find((s) => s.id === ConventionCardSectionId.Slam);
    expect(slam).toBeDefined();
    expect(slam!.modules.some((m) => m.moduleId === "blackwood")).toBe(true);
  });

  it("omits two-level-opening section when weak-twos module is not active", () => {
    const panel = buildConventionCardPanel(SAYC_SYSTEM_CONFIG, "nt-bundle");
    const twoLevel = panel.sections.find((s) => s.id === ConventionCardSectionId.TwoLevelOpening);
    expect(twoLevel).toBeUndefined();
  });

  it("includes two-level-opening section for weak-twos-bundle", () => {
    const panel = buildConventionCardPanel(SAYC_SYSTEM_CONFIG, "weak-twos-bundle");
    const twoLevel = panel.sections.find((s) => s.id === ConventionCardSectionId.TwoLevelOpening);
    expect(twoLevel).toBeDefined();
    expect(twoLevel!.modules.some((m) => m.moduleId === "weak-twos")).toBe(true);
  });

  it("includes competitive section with DONT for dont-bundle", () => {
    const panel = buildConventionCardPanel(SAYC_SYSTEM_CONFIG, "dont-bundle");
    const comp = panel.sections.find((s) => s.id === ConventionCardSectionId.Competitive);
    expect(comp).toBeDefined();
    expect(comp!.modules.some((m) => m.moduleId === "dont")).toBe(true);
    expect(comp!.items.find((i) => i.label === "vs 1NT")?.value).toBe("DONT 8–15 HCP");
  });

  it("module detail includes teaching fields", () => {
    const panel = buildConventionCardPanel(SAYC_SYSTEM_CONFIG, "nt-bundle");
    const ntSection = panel.sections.find((s) => s.id === ConventionCardSectionId.NotrumpOpening)!;
    const stayman = ntSection.modules.find((m) => m.moduleId === "stayman");
    expect(stayman).toBeDefined();
    expect(stayman!.description).toBeTruthy();
    expect(stayman!.moduleName).toBe("Stayman");
  });

  it("compact summary joins items and module names", () => {
    const panel = buildConventionCardPanel(SAYC_SYSTEM_CONFIG, "nt-bundle");
    const ntSection = panel.sections.find((s) => s.id === ConventionCardSectionId.NotrumpOpening)!;
    expect(ntSection.compactSummary).toContain("15–17");
    expect(ntSection.compactSummary).toContain("Stayman");
  });

  it("Acol uses correct system-specific values", () => {
    const panel = buildConventionCardPanel(ACOL_SYSTEM_CONFIG);
    expect(panel.systemName).toBe("Acol");
    const general = panel.sections.find((s) => s.id === ConventionCardSectionId.General)!;
    expect(general.items.find((i) => i.label === "Majors")?.value).toBe("4-card majors");
    const nt = panel.sections.find((s) => s.id === ConventionCardSectionId.NotrumpOpening)!;
    expect(nt.items.find((i) => i.label === "1NT Range")?.value).toBe("12–14");
  });
});
