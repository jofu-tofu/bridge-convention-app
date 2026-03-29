/**
 * Module parameterization tests — verifies that the module registry
 * produces unified ConventionModule instances and that system-dependent
 * surfaces differ between SAYC and ACOL.
 */

import { describe, it, expect } from "vitest";
import { getModule } from "../../definitions/module-registry";
import { moduleSurfaces } from "../../core/convention-module";
import { SAYC_SYSTEM_CONFIG, ACOL_SYSTEM_CONFIG } from "../../definitions/system-config";
import { resolveBundle, getBundleInput } from "../../definitions/system-registry";
import { FactOperator } from "../../pipeline/evaluation/meaning";

describe("Module registry produces unified ConventionModule", () => {
  it("getModule returns object with all ConventionModule fields", () => {
    const mod = getModule("stayman", SAYC_SYSTEM_CONFIG);
    expect(mod).toBeDefined();
    expect(mod!.moduleId).toBe("stayman");
    expect(mod!.local).toBeDefined();
    expect(mod!.local.initial).toBeDefined();
    // Module uses states
    const hasStates = mod!.states && mod!.states.length > 0;
    expect(hasStates).toBe(true);
    expect(mod!.facts).toBeDefined();
    expect(mod!.explanationEntries).toBeDefined();
  });

  it("moduleSurfaces extracts non-empty surfaces from unified module", () => {
    const mod = getModule("stayman", SAYC_SYSTEM_CONFIG)!;
    const surfaces = moduleSurfaces(mod);
    expect(surfaces.length).toBeGreaterThan(0);
  });
});

describe("System-dependent surfaces differ between SAYC and ACOL", () => {
  it("Stayman R1 HCP threshold differs between SAYC and ACOL", () => {
    const saycMod = getModule("stayman", SAYC_SYSTEM_CONFIG)!;
    const acolMod = getModule("stayman", ACOL_SYSTEM_CONFIG)!;

    const saycR1 = moduleSurfaces(saycMod).find(s => s.meaningId === "stayman:ask-major");
    const acolR1 = moduleSurfaces(acolMod).find(s => s.meaningId === "stayman:ask-major");

    expect(saycR1).toBeDefined();
    expect(acolR1).toBeDefined();

    const saycHcp = saycR1!.clauses.find(c => c.factId === "hand.hcp" && c.operator === FactOperator.Gte);
    const acolHcp = acolR1!.clauses.find(c => c.factId === "hand.hcp" && c.operator === FactOperator.Gte);

    expect(saycHcp).toBeDefined();
    expect(acolHcp).toBeDefined();
    // SAYC: inviteMin = 8, ACOL: inviteMin = 10
    expect(saycHcp!.value).toBe(8);
    expect(acolHcp!.value).toBe(10);
  });

  it("Natural NT opener HCP differs between SAYC and ACOL", () => {
    const saycMod = getModule("natural-bids", SAYC_SYSTEM_CONFIG)!;
    const acolMod = getModule("natural-bids", ACOL_SYSTEM_CONFIG)!;

    const saycOpener = moduleSurfaces(saycMod).find(s => s.meaningId === "bridge:1nt-opening");
    const acolOpener = moduleSurfaces(acolMod).find(s => s.meaningId === "bridge:1nt-opening");

    expect(saycOpener).toBeDefined();
    expect(acolOpener).toBeDefined();

    const saycMin = saycOpener!.clauses.find(c => c.factId === "hand.hcp" && c.operator === FactOperator.Gte);
    const acolMin = acolOpener!.clauses.find(c => c.factId === "hand.hcp" && c.operator === FactOperator.Gte);

    // SAYC: 15, ACOL: 12
    expect(saycMin!.value).toBe(15);
    expect(acolMin!.value).toBe(12);
  });
});

describe("Bundle has resolved modules", () => {
  it("ntBundle.modules is a non-empty ConventionModule[]", () => {
    const input = getBundleInput("nt-bundle")!;
    const bundle = resolveBundle(input, SAYC_SYSTEM_CONFIG);
    expect(bundle.modules.length).toBeGreaterThan(0);
    for (const mod of bundle.modules) {
      expect(mod.moduleId).toBeTruthy();
      expect(mod.local).toBeDefined();
      expect(mod.states).toBeDefined();
      expect(mod.facts).toBeDefined();
    }
  });
});
