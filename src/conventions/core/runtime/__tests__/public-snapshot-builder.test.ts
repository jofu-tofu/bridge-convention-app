import { describe, it, expect } from "vitest";
import { buildSnapshotFromAuction } from "../public-snapshot-builder";
import { buildAuction } from "../../../../engine/auction-helpers";
import { Seat } from "../../../../engine/types";
import { ForcingState } from "../../strategy-types";
import { CAP_OPENING_1NT } from "../../../definitions/capability-vocabulary";

describe("buildSnapshotFromAuction", () => {
  it("returns snapshot with provided activeModuleIds", () => {
    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const snapshot = buildSnapshotFromAuction(auction, Seat.South, [
      "stayman",
      "jacoby-transfers",
    ]);

    expect(snapshot.activeModuleIds).toEqual(["stayman", "jacoby-transfers"]);
  });

  it("returns snapshot with empty activeModuleIds when none provided", () => {
    const auction = buildAuction(Seat.North, []);
    const snapshot = buildSnapshotFromAuction(auction, Seat.South, []);

    expect(snapshot.activeModuleIds).toEqual([]);
  });

  it("sets default forcingState to Nonforcing", () => {
    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const snapshot = buildSnapshotFromAuction(auction, Seat.South, []);

    expect(snapshot.forcingState).toBe(ForcingState.Nonforcing);
  });

  it("sets default obligation to None/responder", () => {
    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const snapshot = buildSnapshotFromAuction(auction, Seat.South, []);

    expect(snapshot.obligation).toEqual({
      kind: "None",
      obligatedSide: "responder",
    });
  });

  it("sets default agreedStrain to none", () => {
    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const snapshot = buildSnapshotFromAuction(auction, Seat.South, []);

    expect(snapshot.agreedStrain).toEqual({ type: "none" });
  });

  it("sets default captain to responder", () => {
    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const snapshot = buildSnapshotFromAuction(auction, Seat.South, []);

    expect(snapshot.captain).toBe("responder");
  });

  it("detects Uncontested competition mode when no interference", () => {
    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const snapshot = buildSnapshotFromAuction(auction, Seat.South, []);

    expect(snapshot.competitionMode).toBe("Uncontested");
  });

  it("detects Doubled competition mode when last non-pass is a double", () => {
    const auction = buildAuction(Seat.North, ["1NT", "X"]);
    const snapshot = buildSnapshotFromAuction(auction, Seat.South, []);

    expect(snapshot.competitionMode).toBe("Doubled");
  });

  it("detects Redoubled competition mode", () => {
    const auction = buildAuction(Seat.North, ["1NT", "X", "XX"]);
    const snapshot = buildSnapshotFromAuction(auction, Seat.South, []);

    expect(snapshot.competitionMode).toBe("Redoubled");
  });

  it("treats Uncontested when last non-pass call is a bid", () => {
    // 1NT - P - 2C: last non-pass is 2C (a bid), so Uncontested
    const auction = buildAuction(Seat.North, ["1NT", "P", "2C"]);
    const snapshot = buildSnapshotFromAuction(auction, Seat.South, []);

    expect(snapshot.competitionMode).toBe("Uncontested");
  });

  it("handles empty auction as Uncontested", () => {
    const auction = buildAuction(Seat.North, []);
    const snapshot = buildSnapshotFromAuction(auction, Seat.South, []);

    expect(snapshot.competitionMode).toBe("Uncontested");
  });

  it("returns empty systemCapabilities and publicRegisters", () => {
    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const snapshot = buildSnapshotFromAuction(auction, Seat.South, []);

    expect(snapshot.systemCapabilities).toEqual({});
    expect(snapshot.publicRegisters).toEqual({});
  });

  describe("publicRecord", () => {
    it("populates publicRecord from auction entries after 1NT-P-2C-P", () => {
      const auction = buildAuction(Seat.North, ["1NT", "P", "2C", "P"]);
      const snapshot = buildSnapshotFromAuction(auction, Seat.South, []);

      expect(snapshot.publicRecord).toHaveLength(4);
    });

    it("has correct call strings and seats in publicRecord entries", () => {
      const auction = buildAuction(Seat.North, ["1NT", "P", "2C", "P"]);
      const snapshot = buildSnapshotFromAuction(auction, Seat.South, []);

      expect(snapshot.publicRecord![0]).toEqual({
        eventIndex: 0,
        call: "1NT",
        seat: Seat.North,
      });
      expect(snapshot.publicRecord![1]).toEqual({
        eventIndex: 1,
        call: "P",
        seat: Seat.East,
      });
      expect(snapshot.publicRecord![2]).toEqual({
        eventIndex: 2,
        call: "2C",
        seat: Seat.South,
      });
      expect(snapshot.publicRecord![3]).toEqual({
        eventIndex: 3,
        call: "P",
        seat: Seat.West,
      });
    });

    it("returns empty publicRecord for empty auction", () => {
      const auction = buildAuction(Seat.North, []);
      const snapshot = buildSnapshotFromAuction(auction, Seat.South, []);

      expect(snapshot.publicRecord).toEqual([]);
    });
  });

  describe("machineRegisters", () => {
    it("overrides forcingState from machine registers", () => {
      const auction = buildAuction(Seat.North, ["1NT", "P"]);
      const snapshot = buildSnapshotFromAuction(auction, Seat.South, [], {
        machineRegisters: {
          forcingState: ForcingState.GameForcing,
          obligation: { kind: "None", obligatedSide: "responder" },
          agreedStrain: { type: "none" },
          competitionMode: "Uncontested",
          captain: "responder",
          systemCapabilities: {},
        },
      });

      expect(snapshot.forcingState).toBe(ForcingState.GameForcing);
    });

    it("overrides captain from machine registers", () => {
      const auction = buildAuction(Seat.North, ["1NT", "P"]);
      const snapshot = buildSnapshotFromAuction(auction, Seat.South, [], {
        machineRegisters: {
          forcingState: ForcingState.Nonforcing,
          obligation: { kind: "None", obligatedSide: "responder" },
          agreedStrain: { type: "none" },
          competitionMode: "Uncontested",
          captain: "opener",
          systemCapabilities: {},
        },
      });

      expect(snapshot.captain).toBe("opener");
    });

    it("overrides agreedStrain from machine registers", () => {
      const auction = buildAuction(Seat.North, ["1NT", "P"]);
      const snapshot = buildSnapshotFromAuction(auction, Seat.South, [], {
        machineRegisters: {
          forcingState: ForcingState.Nonforcing,
          obligation: { kind: "None", obligatedSide: "responder" },
          agreedStrain: { type: "suit", suit: "H", confidence: "agreed" },
          competitionMode: "Uncontested",
          captain: "responder",
          systemCapabilities: {},
        },
      });

      expect(snapshot.agreedStrain).toEqual({ type: "suit", suit: "H", confidence: "agreed" });
    });

    it("overrides competitionMode from machine registers (skips detectCompetitionMode)", () => {
      // Auction has a double, but machine says "Uncontested" — machine wins
      const auction = buildAuction(Seat.North, ["1NT", "X"]);
      const snapshot = buildSnapshotFromAuction(auction, Seat.South, [], {
        machineRegisters: {
          forcingState: ForcingState.Nonforcing,
          obligation: { kind: "None", obligatedSide: "responder" },
          agreedStrain: { type: "none" },
          competitionMode: "Uncontested",
          captain: "responder",
          systemCapabilities: {},
        },
      });

      expect(snapshot.competitionMode).toBe("Uncontested");
    });

    it("overrides obligation from machine registers", () => {
      const auction = buildAuction(Seat.North, ["1NT", "P"]);
      const snapshot = buildSnapshotFromAuction(auction, Seat.South, [], {
        machineRegisters: {
          forcingState: ForcingState.Nonforcing,
          obligation: { kind: "Bid", obligatedSide: "opener" },
          agreedStrain: { type: "none" },
          competitionMode: "Uncontested",
          captain: "responder",
          systemCapabilities: {},
        },
      });

      expect(snapshot.obligation).toEqual({ kind: "Bid", obligatedSide: "opener" });
    });

    it("overrides systemCapabilities from machine registers", () => {
      const auction = buildAuction(Seat.North, ["1NT", "P"]);
      const snapshot = buildSnapshotFromAuction(auction, Seat.South, [], {
        machineRegisters: {
          forcingState: ForcingState.Nonforcing,
          obligation: { kind: "None", obligatedSide: "responder" },
          agreedStrain: { type: "none" },
          competitionMode: "Uncontested",
          captain: "responder",
          systemCapabilities: { [CAP_OPENING_1NT]: "active" },
        },
      });

      expect(snapshot.systemCapabilities).toEqual({ [CAP_OPENING_1NT]: "active" });
    });
  });

});
