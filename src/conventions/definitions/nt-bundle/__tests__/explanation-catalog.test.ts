import { describe, expect, test } from "vitest";
import { NT_EXPLANATION_CATALOG } from "../explanation-catalog";
import type { FactExplanationEntry } from "../../../core/explanation-catalog";

/**
 * Module-derived fact IDs used in the 1NT bundle.
 * Shared facts (hand.hcp, bridge.hasFourCardMajor, etc.) are now covered
 * by the platform catalog (Phase 2b) and are NOT included in module catalogs.
 */
const KNOWN_MODULE_FACT_IDS = new Set([
  // Stayman
  "module.stayman.eligible",
  "module.stayman.preferred",
  "module.stayman.nsHaveEightCardFitLikely",
  "module.stayman.openerStillBalancedLikely",
  "module.stayman.openerHasSecondMajorLikely",
  // Transfers
  "module.transfer.targetSuit",
  "module.transfer.eligible",
  "module.transfer.preferred",
  "module.transfer.openerHasHeartFit",
  "module.transfer.openerHasSpadesFit",
  // Smolen
  "module.smolen.hasFiveHearts",
  "module.smolen.hasFiveSpades",
  "module.smolen.hasFourSpades",
  "module.smolen.hasFourHearts",
  "module.smolen.openerHasHeartFit",
  "module.smolen.openerHasSpadesFit",
]);

describe("NT_EXPLANATION_CATALOG", () => {
  test("has at least 12 entries", () => {
    expect(NT_EXPLANATION_CATALOG.entries.length).toBeGreaterThanOrEqual(12);
  });

  test("has version string", () => {
    expect(NT_EXPLANATION_CATALOG.version).toBe("1.0.0");
  });

  test("has no duplicate explanationIds", () => {
    const ids = NT_EXPLANATION_CATALOG.entries.map((e) => e.explanationId);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  test("all templateKeys are non-empty strings", () => {
    for (const entry of NT_EXPLANATION_CATALOG.entries) {
      expect(entry.templateKey).toBeTruthy();
      expect(typeof entry.templateKey).toBe("string");
    }
  });

  test("all contrastiveTemplateKeys are non-empty strings when present", () => {
    for (const entry of NT_EXPLANATION_CATALOG.entries) {
      if ("factId" in entry && entry.contrastiveTemplateKey !== undefined) {
        expect(entry.contrastiveTemplateKey).toBeTruthy();
        expect(typeof entry.contrastiveTemplateKey).toBe("string");
      }
    }
  });

  test("all factId references point to known module facts", () => {
    const entriesWithFacts = NT_EXPLANATION_CATALOG.entries.filter(
      (e): e is FactExplanationEntry => "factId" in e,
    );
    expect(entriesWithFacts.length).toBeGreaterThan(0);

    for (const entry of entriesWithFacts) {
      expect(
        KNOWN_MODULE_FACT_IDS.has(entry.factId),
        `factId "${entry.factId}" in entry "${entry.explanationId}" is not a known module fact`,
      ).toBe(true);
    }
  });

  test("all roles are valid values", () => {
    const validRoles = new Set(["supporting", "blocking", "inferential", "pedagogical"]);
    for (const entry of NT_EXPLANATION_CATALOG.entries) {
      for (const role of entry.roles) {
        expect(
          validRoles.has(role),
          `role "${role}" in entry "${entry.explanationId}" is not valid`,
        ).toBe(true);
      }
    }
  });

  test("all preferredLevel values are valid", () => {
    const validLevels = new Set(["semantic", "mechanical"]);
    for (const entry of NT_EXPLANATION_CATALOG.entries) {
      expect(
        validLevels.has(entry.preferredLevel),
        `preferredLevel "${entry.preferredLevel}" in entry "${entry.explanationId}" is not valid`,
      ).toBe(true);
    }
  });

  test("covers Stayman eligibility", () => {
    const factEntries = NT_EXPLANATION_CATALOG.entries.filter(
      (e): e is FactExplanationEntry => "factId" in e,
    );
    const staymanEntries = factEntries.filter(
      (e) => e.factId === "module.stayman.eligible" || e.factId === "module.stayman.preferred",
    );
    expect(staymanEntries.length).toBeGreaterThanOrEqual(1);
  });

  test("covers transfer preference", () => {
    const factEntries = NT_EXPLANATION_CATALOG.entries.filter(
      (e): e is FactExplanationEntry => "factId" in e,
    );
    const transferEntries = factEntries.filter(
      (e) =>
        e.factId === "module.transfer.eligible" ||
        e.factId === "module.transfer.preferred",
    );
    expect(transferEntries.length).toBeGreaterThanOrEqual(1);
  });

  test("covers Smolen facts", () => {
    const factEntries = NT_EXPLANATION_CATALOG.entries.filter(
      (e): e is FactExplanationEntry => "factId" in e,
    );
    const smolenEntries = factEntries.filter((e) => e.factId.startsWith("module.smolen."));
    expect(smolenEntries.length).toBe(6);
  });

  test("includes meaning-linked entries", () => {
    const meaningEntries = NT_EXPLANATION_CATALOG.entries.filter(
      (e) => "meaningId" in e,
    );
    expect(meaningEntries.length).toBeGreaterThanOrEqual(1);
  });

  test("includes natural-bids meaning entries", () => {
    const meaningEntries = NT_EXPLANATION_CATALOG.entries.filter(
      (e) => "meaningId" in e && (e.meaningId).startsWith("bridge:"),
    );
    // 3 NT surfaces + 4 suit openings = 7 natural-bids meaning entries
    expect(meaningEntries.length).toBe(7);
  });

  test("templateKeys follow dotted naming convention", () => {
    for (const entry of NT_EXPLANATION_CATALOG.entries) {
      expect(
        entry.templateKey.includes("."),
        `templateKey "${entry.templateKey}" in entry "${entry.explanationId}" should use dotted naming`,
      ).toBe(true);
    }
  });
});
