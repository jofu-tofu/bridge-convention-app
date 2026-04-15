import { describe, expect, it } from "vitest";
import {
  buildPracticeUrl,
  normalizeReferenceView,
} from "./reference-page";

describe("reference-page helpers", () => {
  it("builds a practice URL from the first bundle and module id", () => {
    expect(buildPracticeUrl(["nt-bundle"], "stayman")).toBe("/?convention=nt-bundle&learn=stayman");
  });

  it("normalizes bid objects and passes tagged unions through untouched", () => {
    const reference = normalizeReferenceView({
      summaryCard: {
        trigger: "Partner opens 1NT, you respond",
        bid: "2♣",
        promises: "At least one 4-card major.",
        denies: "A natural club suit.",
        guidingIdea: "Ask first, then place the contract.",
        partnership: "Core agreement.",
      },
      whenToUse: [],
      whenNotToUse: [],
      responseTable: {
        columns: [{ id: "shape", label: "Shape" }],
        rows: [
          {
            meaningId: "stayman:show-hearts",
            response: "2♥",
            meaning: "Shows four hearts.",
            cells: [{ columnId: "shape", columnLabel: "Shape", text: "4+ hearts" }],
          },
        ],
      },
      workedAuctions: [],
      interference: {
        status: "notApplicable",
        reason: "no standard opponent overcall",
      },
      quickReference: {
        kind: "list",
        axis: { label: "Keycards held", values: ["0", "1"] },
        items: [
          { recommendation: "5C", note: "" },
          { recommendation: "5D", note: "" },
        ],
      },
      relatedLinks: [],
    });

    expect(reference.responseTable.columns).toHaveLength(1);
    expect(reference.responseTable.rows[0]?.cells[0]?.text).toBe("4+ hearts");
    expect(reference.interference.status).toBe("notApplicable");
    expect(reference.quickReference.kind).toBe("list");
  });

});
