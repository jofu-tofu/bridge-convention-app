import { describe, expect, test } from "vitest";
import { NT_EXPLANATION_CATALOG } from "../explanation-catalog";
import type { ExplanationEntry } from "../../../../core/contracts/explanation-catalog";

/**
 * Shared fact IDs from the fact catalog. Hardcoded here rather than imported
 * because the worktree may not have fact-catalog.ts; these are stable vocabulary.
 */
const KNOWN_SHARED_FACT_IDS = new Set([
  // Primitive
  "hand.hcp",
  "hand.suitLength.spades",
  "hand.suitLength.hearts",
  "hand.suitLength.diamonds",
  "hand.suitLength.clubs",
  "hand.isBalanced",
  // Bridge-derived
  "bridge.hasFourCardMajor",
  "bridge.hasFiveCardMajor",
  "bridge.majorPattern",
  "bridge.supportForBoundSuit",
  "bridge.fitWithBoundSuit",
  "bridge.shortageInSuit",
  "bridge.totalPointsForRaise",
  // Posterior-derived
  "bridge.partnerHas4CardMajorLikely",
  "bridge.nsHaveEightCardFitLikely",
  "bridge.combinedHcpInRangeLikely",
  "bridge.openerStillBalancedLikely",
  "bridge.openerHasSecondMajorLikely",
]);

/**
 * Module-derived fact IDs used in the 1NT bundle.
 */
const KNOWN_MODULE_FACT_IDS = new Set([
  "module.stayman.eligible",
  "module.stayman.preferred",
  "module.transfer.targetSuit",
  "module.transfer.eligible",
  "module.transfer.preferred",
  "module.ntResponse.inviteValues",
  "module.ntResponse.gameValues",
  "module.ntResponse.slamValues",
  "module.smolen.hasFiveHearts",
  "module.smolen.hasFiveSpades",
  "module.smolen.hasFourSpades",
  "module.smolen.hasFourHearts",
  "module.smolen.openerHasHeartFit",
  "module.smolen.openerHasSpadesFit",
]);

const ALL_KNOWN_FACT_IDS = new Set([...KNOWN_SHARED_FACT_IDS, ...KNOWN_MODULE_FACT_IDS]);

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
      if (entry.contrastiveTemplateKey !== undefined) {
        expect(entry.contrastiveTemplateKey).toBeTruthy();
        expect(typeof entry.contrastiveTemplateKey).toBe("string");
      }
    }
  });

  test("all factId references point to known facts", () => {
    const entriesWithFacts = NT_EXPLANATION_CATALOG.entries.filter(
      (e): e is ExplanationEntry & { factId: string } => e.factId !== undefined,
    );
    expect(entriesWithFacts.length).toBeGreaterThan(0);

    for (const entry of entriesWithFacts) {
      expect(
        ALL_KNOWN_FACT_IDS.has(entry.factId),
        `factId "${entry.factId}" in entry "${entry.explanationId}" is not a known fact`,
      ).toBe(true);
    }
  });

  test("all roles are valid", () => {
    const validRoles = new Set(["supporting", "blocking", "inferential", "pedagogical"]);
    for (const entry of NT_EXPLANATION_CATALOG.entries) {
      expect(entry.roles.length).toBeGreaterThan(0);
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

  test("covers HCP threshold facts", () => {
    const hcpEntries = NT_EXPLANATION_CATALOG.entries.filter(
      (e) =>
        e.factId === "module.ntResponse.inviteValues" ||
        e.factId === "module.ntResponse.gameValues" ||
        e.factId === "module.ntResponse.slamValues",
    );
    expect(hcpEntries.length).toBeGreaterThanOrEqual(3);
  });

  test("covers suit length facts", () => {
    const suitEntries = NT_EXPLANATION_CATALOG.entries.filter(
      (e) =>
        e.factId === "bridge.hasFourCardMajor" ||
        e.factId === "bridge.hasFiveCardMajor",
    );
    expect(suitEntries.length).toBeGreaterThanOrEqual(2);
  });

  test("covers balanced shape", () => {
    const balancedEntries = NT_EXPLANATION_CATALOG.entries.filter(
      (e) => e.factId === "hand.isBalanced",
    );
    expect(balancedEntries.length).toBeGreaterThanOrEqual(1);
  });

  test("covers Stayman eligibility", () => {
    const staymanEntries = NT_EXPLANATION_CATALOG.entries.filter(
      (e) => e.factId === "module.stayman.eligible" || e.factId === "module.stayman.preferred",
    );
    expect(staymanEntries.length).toBeGreaterThanOrEqual(1);
  });

  test("covers transfer preference", () => {
    const transferEntries = NT_EXPLANATION_CATALOG.entries.filter(
      (e) =>
        e.factId === "module.transfer.eligible" ||
        e.factId === "module.transfer.preferred",
    );
    expect(transferEntries.length).toBeGreaterThanOrEqual(1);
  });

  test("includes meaning-linked entries", () => {
    const meaningEntries = NT_EXPLANATION_CATALOG.entries.filter(
      (e) => e.meaningId !== undefined,
    );
    expect(meaningEntries.length).toBeGreaterThanOrEqual(1);
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
