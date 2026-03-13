import { describe, expect, test } from "vitest";
import {
  createExplanationCatalog,
  type ExplanationEntry,
  type ExplanationCatalogIR,
} from "../explanation-catalog";

describe("ExplanationCatalogIR", () => {
  const entry1: ExplanationEntry = {
    explanationId: "explain.hand.hcp",
    factId: "hand.hcp",
    templateKey: "explain.hand.hcp.supporting",
    preferredLevel: "mechanical",
    roles: ["supporting"],
  };

  const entry2: ExplanationEntry = {
    explanationId: "explain.bridge.gameValues",
    factId: "bridge.gameValuesOpposite1NT",
    templateKey: "explain.bridge.gameValues.semantic",
    contrastiveTemplateKey: "explain.bridge.gameValues.whyNot",
    preferredLevel: "semantic",
    roles: ["supporting", "pedagogical"],
  };

  const meaningEntry: ExplanationEntry = {
    explanationId: "explain.stayman.ask",
    meaningId: "stayman:ask-major",
    templateKey: "explain.stayman.ask.semantic",
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

    test("allows entries with factId, meaningId, or neither", () => {
      const noLink: ExplanationEntry = {
        explanationId: "explain.general.tip",
        templateKey: "explain.general.tip.text",
        preferredLevel: "semantic",
        roles: ["pedagogical"],
      };

      const catalog = createExplanationCatalog([entry1, meaningEntry, noLink]);
      expect(catalog.entries).toHaveLength(3);
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
    test("entry with factId links to fact catalog", () => {
      expect(entry1.factId).toBe("hand.hcp");
      expect(entry1.meaningId).toBeUndefined();
    });

    test("entry with meaningId links to meaning vocabulary", () => {
      expect(meaningEntry.meaningId).toBe("stayman:ask-major");
      expect(meaningEntry.factId).toBeUndefined();
    });

    test("contrastiveTemplateKey is optional", () => {
      expect(entry1.contrastiveTemplateKey).toBeUndefined();
      expect(entry2.contrastiveTemplateKey).toBe("explain.bridge.gameValues.whyNot");
    });

    test("roles can contain multiple values", () => {
      expect(entry2.roles).toEqual(["supporting", "pedagogical"]);
    });
  });

  describe("type safety", () => {
    test("preferredLevel is constrained to semantic or mechanical", () => {
      const semantic: ExplanationCatalogIR = createExplanationCatalog([
        { ...entry1, preferredLevel: "semantic" },
      ]);
      const mechanical: ExplanationCatalogIR = createExplanationCatalog([
        { ...entry1, explanationId: "other", preferredLevel: "mechanical" },
      ]);

      expect(semantic.entries[0]!.preferredLevel).toBe("semantic");
      expect(mechanical.entries[0]!.preferredLevel).toBe("mechanical");
    });
  });
});
