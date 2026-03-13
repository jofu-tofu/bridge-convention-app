import { describe, test, expect } from "vitest";
import { buildPublicSnapshot } from "../module-surface";
import type { PublicSnapshot } from "../module-surface";
import { ForcingState } from "../bidding";

describe("buildPublicSnapshot", () => {
  const baseParams = {
    activeModuleIds: ["stayman", "jacoby-transfers"],
    forcingState: ForcingState.ForcingOneRound,
    obligation: { kind: "bid", obligatedSide: "responder" as const },
    agreedStrain: { type: "notrump" as const, confidence: "agreed" as const },
    competitionMode: "uncontested",
    captain: "responder",
  };

  test("constructs PublicSnapshot from all required params", () => {
    const snapshot = buildPublicSnapshot({
      ...baseParams,
      systemCapabilities: { naturalOneLevelOpening: "on" },
      conventionData: { round: 2 },
    });

    expect(snapshot.activeModuleIds).toEqual(["stayman", "jacoby-transfers"]);
    expect(snapshot.forcingState).toBe(ForcingState.ForcingOneRound);
    expect(snapshot.obligation).toEqual({ kind: "bid", obligatedSide: "responder" });
    expect(snapshot.agreedStrain).toEqual({ type: "notrump", confidence: "agreed" });
    expect(snapshot.competitionMode).toBe("uncontested");
    expect(snapshot.captain).toBe("responder");
    expect(snapshot.systemCapabilities).toEqual({ naturalOneLevelOpening: "on" });
    expect(snapshot.publicRegisters).toEqual({ round: 2 });
  });

  test("defaults systemCapabilities to empty object when omitted", () => {
    const snapshot = buildPublicSnapshot(baseParams);

    expect(snapshot.systemCapabilities).toEqual({});
  });

  test("defaults publicRegisters to empty object when conventionData omitted", () => {
    const snapshot = buildPublicSnapshot(baseParams);

    expect(snapshot.publicRegisters).toEqual({});
  });

  test("result satisfies PublicSnapshot interface", () => {
    const snapshot: PublicSnapshot = buildPublicSnapshot(baseParams);

    // Verify all required fields are present and typed correctly
    expect(snapshot.activeModuleIds).toBeDefined();
    expect(snapshot.forcingState).toBeDefined();
    expect(snapshot.obligation).toBeDefined();
    expect(snapshot.agreedStrain).toBeDefined();
    expect(snapshot.competitionMode).toBeDefined();
    expect(snapshot.captain).toBeDefined();
    expect(snapshot.systemCapabilities).toBeDefined();
    expect(snapshot.publicRegisters).toBeDefined();
  });

  test("preserves agreedStrain with optional suit field", () => {
    const snapshot = buildPublicSnapshot({
      ...baseParams,
      agreedStrain: { type: "suit", suit: "H", confidence: "tentative" },
    });

    expect(snapshot.agreedStrain).toEqual({
      type: "suit",
      suit: "H",
      confidence: "tentative",
    });
  });
});
