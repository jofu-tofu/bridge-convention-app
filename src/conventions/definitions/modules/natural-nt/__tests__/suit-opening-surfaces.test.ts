import { describe, it, expect } from "vitest";
import { createSuitOpeningSurfaces, NATURAL_BIDS_THRESHOLDS } from "../meaning-surfaces";
import { SAYC_SYSTEM_CONFIG, ACOL_SYSTEM_CONFIG } from "../../../system-config";

describe("suit opening surfaces", () => {
  const saycSurfaces = createSuitOpeningSurfaces(SAYC_SYSTEM_CONFIG);
  const acolSurfaces = createSuitOpeningSurfaces(ACOL_SYSTEM_CONFIG);

  it("produces 4 surfaces (1C, 1D, 1H, 1S)", () => {
    expect(saycSurfaces).toHaveLength(4);
    expect(acolSurfaces).toHaveLength(4);
  });

  it("all surfaces use SuitOpen intent with correct suit", () => {
    const suits = saycSurfaces.map((s) => s.sourceIntent.params.suit);
    expect(suits).toEqual(["clubs", "diamonds", "hearts", "spades"]);
  });

  // ── HCP boundary ─────────────────────────────────────────────

  it("all surfaces require minOpeningHcp", () => {
    for (const s of saycSurfaces) {
      const hcpClause = s.clauses.find(
        (c) => c.factId === "hand.hcp" && c.operator === "gte",
      );
      expect(hcpClause).toBeDefined();
      expect(hcpClause!.value).toBe(NATURAL_BIDS_THRESHOLDS.minOpeningHcp);
    }
  });

  // ── Minor suit lengths ────────────────────────────────────────

  it("1C requires 3+ clubs (same across systems)", () => {
    const club = saycSurfaces.find((s) => s.meaningId === "bridge:1c-opening")!;
    const lenClause = club.clauses.find((c) => c.factId === "hand.clubs");
    expect(lenClause!.value).toBe(NATURAL_BIDS_THRESHOLDS.minClubLength);
  });

  it("1D requires 4+ diamonds (same across systems)", () => {
    const diamond = saycSurfaces.find((s) => s.meaningId === "bridge:1d-opening")!;
    const lenClause = diamond.clauses.find((c) => c.factId === "hand.diamonds");
    expect(lenClause!.value).toBe(NATURAL_BIDS_THRESHOLDS.minDiamondLength);
  });

  // ── Major suit length: SAYC 5-card vs Acol 4-card ────────────

  describe("SAYC (5-card majors)", () => {
    it("1H requires 5+ hearts", () => {
      const heart = saycSurfaces.find((s) => s.meaningId === "bridge:1h-opening")!;
      const lenClause = heart.clauses.find((c) => c.factId === "hand.hearts");
      expect(lenClause!.value).toBe(5);
    });

    it("1S requires 5+ spades", () => {
      const spade = saycSurfaces.find((s) => s.meaningId === "bridge:1s-opening")!;
      const lenClause = spade.clauses.find((c) => c.factId === "hand.spades");
      expect(lenClause!.value).toBe(5);
    });
  });

  describe("Acol (4-card majors)", () => {
    it("1H requires 4+ hearts", () => {
      const heart = acolSurfaces.find((s) => s.meaningId === "bridge:1h-opening")!;
      const lenClause = heart.clauses.find((c) => c.factId === "hand.hearts");
      expect(lenClause!.value).toBe(4);
    });

    it("1S requires 4+ spades", () => {
      const spade = acolSurfaces.find((s) => s.meaningId === "bridge:1s-opening")!;
      const lenClause = spade.clauses.find((c) => c.factId === "hand.spades");
      expect(lenClause!.value).toBe(4);
    });
  });
});
