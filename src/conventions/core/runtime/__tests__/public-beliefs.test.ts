import { describe, it, expect } from "vitest";
import { buildSnapshotFromAuction } from "../public-snapshot-builder";
import type { PosteriorEngine, PublicHandSpace, PosteriorFactValue } from "../../../../core/contracts/posterior";
import type { Auction } from "../../../../engine/types";
import { Seat as SeatEnum } from "../../../../engine/types";
import { ALL_POSTERIOR_FACT_IDS } from "../../../../core/contracts/posterior";

function makeAuction(entries: Auction["entries"]): Auction {
  return { entries, isComplete: false };
}

function makeMockPosteriorEngine(handSpaces: PublicHandSpace[]): PosteriorEngine {
  const _factValues: PosteriorFactValue[] = ALL_POSTERIOR_FACT_IDS.map((factId) => ({
    factId,
    seatId: "N",
    expectedValue: 0.5,
    confidence: 1,
  }));

  return {
    compilePublic() { return handSpaces; },
    conditionOnHand() {
      return {
        seatId: "N",
        handSpace: handSpaces[0]!,
        likelihoodModel: { factors: [], combinationRule: "independent" },
        effectiveSampleSize: 200,
        probability() { return 0.5; },
        distribution() { return []; },
      };
    },
    deriveActingHandFacts(_space, factIds) {
      return factIds.map((factId) => ({
        factId,
        seatId: "N",
        expectedValue: 0.5,
        confidence: 1,
      }));
    },
  };
}

describe("buildSnapshotFromAuction — publicBeliefs", () => {
  it("without posteriorEngine, publicBeliefs is empty array", () => {
    const snapshot = buildSnapshotFromAuction(
      makeAuction([]),
      SeatEnum.South,
      [],
    );
    expect(snapshot.publicBeliefs).toEqual([]);
  });

  it("with posteriorEngine, publicBeliefs contains BeliefViews for each hand space", () => {
    const handSpaces: PublicHandSpace[] = [
      { seatId: "N", constraints: [] },
    ];
    const engine = makeMockPosteriorEngine(handSpaces);

    const snapshot = buildSnapshotFromAuction(
      makeAuction([]),
      SeatEnum.South,
      [],
      { posteriorEngine: engine },
    );

    expect(snapshot.publicBeliefs).toBeDefined();
    expect(snapshot.publicBeliefs!.length).toBe(1);
    expect(snapshot.publicBeliefs![0]!.seatId).toBe("N");
    expect(snapshot.publicBeliefs![0]!.observerSeat).toBe("S");
    expect(snapshot.publicBeliefs![0]!.staleness).toBe(0);
    expect(snapshot.publicBeliefs![0]!.facts).toHaveLength(ALL_POSTERIOR_FACT_IDS.length);
  });

  it("each BeliefView.facts contains exactly 2 shared PosteriorFactValue entries", () => {
    const handSpaces: PublicHandSpace[] = [
      { seatId: "N", constraints: [] },
      { seatId: "E", constraints: [] },
    ];
    const engine = makeMockPosteriorEngine(handSpaces);

    const snapshot = buildSnapshotFromAuction(
      makeAuction([]),
      SeatEnum.South,
      [],
      { posteriorEngine: engine },
    );

    expect(snapshot.publicBeliefs!.length).toBe(2);
    for (const belief of snapshot.publicBeliefs!) {
      expect(belief.facts).toHaveLength(ALL_POSTERIOR_FACT_IDS.length);
      for (const fact of belief.facts) {
        expect(ALL_POSTERIOR_FACT_IDS).toContain(fact.factId);
      }
    }
  });

  describe("enriched BeliefView fields", () => {
    it("beliefId is derived from seatId", () => {
      const handSpaces: PublicHandSpace[] = [
        { seatId: "N", constraints: [] },
      ];
      const engine = makeMockPosteriorEngine(handSpaces);

      const snapshot = buildSnapshotFromAuction(
        makeAuction([]),
        SeatEnum.South,
        [],
        { posteriorEngine: engine },
      );

      expect(snapshot.publicBeliefs![0]!.beliefId).toBe("posterior:N");
    });

    it("subject references the correct seat", () => {
      const handSpaces: PublicHandSpace[] = [
        { seatId: "N", constraints: [] },
      ];
      const engine = makeMockPosteriorEngine(handSpaces);

      const snapshot = buildSnapshotFromAuction(
        makeAuction([]),
        SeatEnum.South,
        [],
        { posteriorEngine: engine },
      );

      expect(snapshot.publicBeliefs![0]!.subject).toEqual({ seatId: "N" });
    });

    it("constraint is derived from first fact with boolean value", () => {
      const handSpaces: PublicHandSpace[] = [
        { seatId: "N", constraints: [] },
      ];
      const engine = makeMockPosteriorEngine(handSpaces);

      const snapshot = buildSnapshotFromAuction(
        makeAuction([]),
        SeatEnum.South,
        [],
        { posteriorEngine: engine },
      );

      const belief = snapshot.publicBeliefs![0]!;
      // The first fact has expectedValue 0.5, mapped to a boolean constraint
      expect(belief.constraint).toBeDefined();
      expect(belief.constraint!.factId).toBe(ALL_POSTERIOR_FACT_IDS[0]);
      expect(belief.constraint!.operator).toBe("gte");
    });

    it("provenance references posterior-engine source", () => {
      const handSpaces: PublicHandSpace[] = [
        { seatId: "N", constraints: [] },
      ];
      const engine = makeMockPosteriorEngine(handSpaces);

      const snapshot = buildSnapshotFromAuction(
        makeAuction([]),
        SeatEnum.South,
        [],
        { posteriorEngine: engine },
      );

      const belief = snapshot.publicBeliefs![0]!;
      expect(belief.provenance).toBeDefined();
      expect(belief.provenance!.length).toBe(1);
      expect(belief.provenance![0]!.sourceKind).toBe("posterior-engine");
    });

    it("evidenceGroupId groups beliefs by observer seat", () => {
      const handSpaces: PublicHandSpace[] = [
        { seatId: "N", constraints: [] },
        { seatId: "E", constraints: [] },
      ];
      const engine = makeMockPosteriorEngine(handSpaces);

      const snapshot = buildSnapshotFromAuction(
        makeAuction([]),
        SeatEnum.South,
        [],
        { posteriorEngine: engine },
      );

      // All beliefs from same observer share evidenceGroupId
      const group0 = snapshot.publicBeliefs![0]!.evidenceGroupId;
      const group1 = snapshot.publicBeliefs![1]!.evidenceGroupId;
      expect(group0).toBeDefined();
      expect(group0).toBe(group1);
      expect(group0).toBe("posterior:S");
    });
  });
});
