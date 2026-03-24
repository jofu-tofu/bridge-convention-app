import { describe, expect, test } from "vitest";
import {
  createExplanationCatalog,
  type ExplanationEntry,
  type FactExplanationEntry,
  type MeaningExplanationEntry,
  type ExplanationCatalog,
} from "../explanation-catalog";

describe("ExplanationCatalog", () => {
  const entry1: FactExplanationEntry = {
    explanationId: "explain.hand.hcp",
    factId: "hand.hcp",
    templateKey: "explain.hand.hcp.supporting",
    displayText: "High card points",
    preferredLevel: "mechanical",
    roles: ["supporting"],
  };

  const entry2: FactExplanationEntry = {
    explanationId: "explain.bridge.gameValues",
    factId: "bridge.gameValuesOpposite1NT",
    templateKey: "explain.bridge.gameValues.semantic",
    displayText: "Game-level values opposite 1NT",
    contrastiveTemplateKey: "explain.bridge.gameValues.whyNot",
    preferredLevel: "semantic",
    roles: ["supporting", "pedagogical"],
  };

  const meaningEntry: MeaningExplanationEntry = {
    explanationId: "explain.stayman.ask",
    meaningId: "stayman:ask-major",
    templateKey: "explain.stayman.ask.semantic",
    displayText: "Stayman: asks opener for a 4-card major",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  };

  describe("createExplanationCatalog", () => {
    test("creates catalog with version and entries", () => {
      const catalog = createExplanationCatalog([entry1, entry2]);

      expect(catalog.version).toBe("1.0.0");
      expect(catalog.entries).toHaveLength(2);
      expect(catalog.entries[0]).toBe(entry1);
      expect(catalog.entries[1]).toBe(entry2);
    });

    test("creates catalog with empty entries", () => {
      const catalog = createExplanationCatalog([]);

      expect(catalog.version).toBe("1.0.0");
      expect(catalog.entries).toHaveLength(0);
    });

    test("rejects duplicate explanationIds", () => {
      const duplicate: ExplanationEntry = {
        ...entry1,
        templateKey: "different.key",
      };

      expect(() => createExplanationCatalog([entry1, duplicate])).toThrowError(
        /duplicate.*explain\.hand\.hcp/i,
      );
    });

    test("allows entries with factId or meaningId", () => {
      const catalog = createExplanationCatalog([entry1, meaningEntry]);
      expect(catalog.entries).toHaveLength(2);
    });

    test("preserves entry order", () => {
      const catalog = createExplanationCatalog([entry2, entry1, meaningEntry]);

      expect(catalog.entries[0]!.explanationId).toBe("explain.bridge.gameValues");
      expect(catalog.entries[1]!.explanationId).toBe("explain.hand.hcp");
      expect(catalog.entries[2]!.explanationId).toBe("explain.stayman.ask");
    });

    test("freezes the returned catalog", () => {
      const catalog = createExplanationCatalog([entry1]);

      expect(Object.isFrozen(catalog)).toBe(true);
      expect(Object.isFrozen(catalog.entries)).toBe(true);
    });
  });

  describe("ExplanationEntry shape", () => {
    test("fact entry has factId and displayText", () => {
      expect(entry1.factId).toBe("hand.hcp");
      expect(entry1.displayText).toBe("High card points");
      expect("meaningId" in entry1).toBe(false);
    });

    test("meaning entry has meaningId and displayText", () => {
      expect(meaningEntry.meaningId).toBe("stayman:ask-major");
      expect(meaningEntry.displayText).toBe("Stayman: asks opener for a 4-card major");
      expect("factId" in meaningEntry).toBe(false);
    });

    test("contrastiveTemplateKey is optional on fact entries", () => {
      expect(entry1.contrastiveTemplateKey).toBeUndefined();
      expect(entry2.contrastiveTemplateKey).toBe("explain.bridge.gameValues.whyNot");
    });

    test("roles can contain multiple values", () => {
      expect(entry2.roles).toEqual(["supporting", "pedagogical"]);
    });
  });

  describe("type safety", () => {
    test("preferredLevel is constrained to semantic or mechanical", () => {
      const semantic: ExplanationCatalog = createExplanationCatalog([
        { ...entry1, preferredLevel: "semantic" },
      ]);
      const mechanical: ExplanationCatalog = createExplanationCatalog([
        { ...entry1, explanationId: "other", preferredLevel: "mechanical" },
      ]);

      expect(semantic.entries[0]!.preferredLevel).toBe("semantic");
      expect(mechanical.entries[0]!.preferredLevel).toBe("mechanical");
    });
  });
});
