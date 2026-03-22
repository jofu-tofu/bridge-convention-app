import { describe, it, expect } from "vitest";
import { matchRoute, matchObs } from "../route-matcher";
import type { ObsPattern, RouteExpr } from "../../core/rule-module";
import type { CommittedStep } from "../../../core/contracts/committed-step";
import { INITIAL_NEGOTIATION } from "../../../core/contracts/committed-step";
import type { BidAction } from "../../../core/contracts/bid-action";
import { Seat, BidSuit } from "../../../engine/types";
import type { ContractBid, SpecialCall } from "../../../engine/types";

function makeStep(
  publicActions: readonly BidAction[],
  status: CommittedStep["status"] = "resolved",
  actor: Seat = Seat.South,
): CommittedStep {
  return {
    actor,
    call: { type: "pass" } as SpecialCall,
    resolvedClaim: null,
    publicActions,
    negotiationDelta: {},
    stateAfter: INITIAL_NEGOTIATION,
    status,
  };
}

describe("matchObs", () => {
  it("matches exact act", () => {
    const obs: BidAction = { act: "inquire", feature: "majorSuit" };
    expect(matchObs({ act: "inquire" }, obs)).toBe(true);
    expect(matchObs({ act: "deny" }, obs)).toBe(false);
  });

  it("matches 'any' act", () => {
    const obs: BidAction = { act: "open", strain: "notrump" };
    expect(matchObs({ act: "any" }, obs)).toBe(true);
  });

  it("matches with feature constraint", () => {
    const obs: BidAction = { act: "inquire", feature: "majorSuit" };
    expect(matchObs({ act: "inquire", feature: "majorSuit" }, obs)).toBe(true);
    expect(matchObs({ act: "inquire", feature: "heldSuit" }, obs)).toBe(false);
  });

  it("matches with suit constraint", () => {
    const obs: BidAction = { act: "show", feature: "heldSuit", suit: "hearts" };
    expect(matchObs({ act: "show", suit: "hearts" }, obs)).toBe(true);
    expect(matchObs({ act: "show", suit: "spades" }, obs)).toBe(false);
  });

  it("matches with strain constraint", () => {
    const obs: BidAction = { act: "open", strain: "notrump" };
    expect(matchObs({ act: "open", strain: "notrump" }, obs)).toBe(true);
    expect(matchObs({ act: "open", strain: "hearts" }, obs)).toBe(false);
  });

  it("matches with strength constraint", () => {
    const obs: BidAction = { act: "raise", strain: "hearts", strength: "invitational" };
    expect(matchObs({ act: "raise", strength: "invitational" }, obs)).toBe(true);
    expect(matchObs({ act: "raise", strength: "game" }, obs)).toBe(false);
  });

  it("unspecified fields are wildcards", () => {
    const obs: BidAction = { act: "show", feature: "heldSuit", suit: "hearts", strength: "minimum" };
    // Pattern only specifies act — other fields are wildcards
    expect(matchObs({ act: "show" }, obs)).toBe(true);
  });
});

describe("matchRoute", () => {
  describe("last", () => {
    it("matches final step's observations", () => {
      const log = [
        makeStep([{ act: "open", strain: "notrump" }]),
        makeStep([{ act: "inquire", feature: "majorSuit" }]),
      ];
      const pattern: RouteExpr = {
        kind: "last",
        pattern: { act: "inquire", feature: "majorSuit" },
      };
      expect(matchRoute(pattern, log)).toBe(true);
    });

    it("does not match non-final steps", () => {
      const log = [
        makeStep([{ act: "inquire", feature: "majorSuit" }]),
        makeStep([{ act: "deny", feature: "majorSuit" }]),
      ];
      const pattern: RouteExpr = {
        kind: "last",
        pattern: { act: "inquire", feature: "majorSuit" },
      };
      expect(matchRoute(pattern, log)).toBe(false);
    });

    it("returns false for empty log", () => {
      expect(matchRoute({ kind: "last", pattern: { act: "open" } }, [])).toBe(false);
    });
  });

  describe("contains", () => {
    it("matches any step in the log", () => {
      const log = [
        makeStep([{ act: "open", strain: "notrump" }]),
        makeStep([{ act: "pass" }]),
        makeStep([{ act: "inquire", feature: "majorSuit" }]),
      ];
      expect(matchRoute(
        { kind: "contains", pattern: { act: "open", strain: "notrump" } },
        log,
      )).toBe(true);
    });

    it("returns false when no match", () => {
      const log = [
        makeStep([{ act: "pass" }]),
      ];
      expect(matchRoute(
        { kind: "contains", pattern: { act: "open" } },
        log,
      )).toBe(false);
    });

    it("returns false for empty log", () => {
      expect(matchRoute(
        { kind: "contains", pattern: { act: "open" } },
        [],
      )).toBe(false);
    });
  });

  describe("subseq", () => {
    it("matches observations as a subsequence (skipping passes)", () => {
      const log = [
        makeStep([{ act: "open", strain: "notrump" }]),
        makeStep([{ act: "pass" }]),
        makeStep([{ act: "inquire", feature: "majorSuit" }]),
        makeStep([{ act: "pass" }]),
        makeStep([{ act: "deny", feature: "majorSuit" }]),
      ];
      const pattern: RouteExpr = {
        kind: "subseq",
        steps: [
          { act: "inquire", feature: "majorSuit" },
          { act: "deny", feature: "majorSuit" },
        ],
      };
      expect(matchRoute(pattern, log)).toBe(true);
    });

    it("does not match out-of-order observations", () => {
      const log = [
        makeStep([{ act: "deny", feature: "majorSuit" }]),
        makeStep([{ act: "inquire", feature: "majorSuit" }]),
      ];
      const pattern: RouteExpr = {
        kind: "subseq",
        steps: [
          { act: "inquire", feature: "majorSuit" },
          { act: "deny", feature: "majorSuit" },
        ],
      };
      expect(matchRoute(pattern, log)).toBe(false);
    });

    it("empty subseq matches any log", () => {
      expect(matchRoute({ kind: "subseq", steps: [] }, [])).toBe(true);
      expect(matchRoute(
        { kind: "subseq", steps: [] },
        [makeStep([{ act: "pass" }])],
      )).toBe(true);
    });
  });

  describe("combinators", () => {
    it("and requires all exprs to match", () => {
      const log = [
        makeStep([{ act: "open", strain: "notrump" }]),
        makeStep([{ act: "inquire", feature: "majorSuit" }]),
      ];
      const pattern: RouteExpr = {
        kind: "and",
        exprs: [
          { kind: "contains", pattern: { act: "open", strain: "notrump" } },
          { kind: "last", pattern: { act: "inquire", feature: "majorSuit" } },
        ],
      };
      expect(matchRoute(pattern, log)).toBe(true);
    });

    it("or requires any expr to match", () => {
      const log = [
        makeStep([{ act: "open", strain: "notrump" }]),
      ];
      const pattern: RouteExpr = {
        kind: "or",
        exprs: [
          { kind: "contains", pattern: { act: "transfer" } },
          { kind: "contains", pattern: { act: "open", strain: "notrump" } },
        ],
      };
      expect(matchRoute(pattern, log)).toBe(true);
    });

    it("not inverts match", () => {
      const log = [
        makeStep([{ act: "open", strain: "notrump" }]),
      ];
      expect(matchRoute(
        { kind: "not", expr: { kind: "contains", pattern: { act: "overcall" } } },
        log,
      )).toBe(true);
      expect(matchRoute(
        { kind: "not", expr: { kind: "contains", pattern: { act: "open" } } },
        log,
      )).toBe(false);
    });
  });

  describe("actor-aware matching", () => {
    // South opens, North is partner (responder), East/West are opponents
    const openerSeat = Seat.South;

    it("matchObs with actor matches correctly", () => {
      const obs: BidAction = { act: "open", strain: "notrump" };
      expect(matchObs({ act: "open", actor: "opener" }, obs, "opener")).toBe(true);
      expect(matchObs({ act: "open", actor: "responder" }, obs, "opener")).toBe(false);
    });

    it("matchObs with actor mismatch rejects", () => {
      const obs: BidAction = { act: "overcall", feature: "heldSuit", suit: "hearts" };
      expect(matchObs({ act: "overcall", actor: "opener" }, obs, "opponent")).toBe(false);
    });

    it("matchObs without actor (backward compat) matches any actor", () => {
      const obs: BidAction = { act: "open", strain: "notrump" };
      // No actor on pattern — should match regardless of actorRole
      expect(matchObs({ act: "open" }, obs, "opener")).toBe(true);
      expect(matchObs({ act: "open" }, obs, "opponent")).toBe(true);
      expect(matchObs({ act: "open" }, obs)).toBe(true);
    });

    it("contains with actor-filtered pattern", () => {
      const log = [
        makeStep([{ act: "open", strain: "notrump" }], "resolved", Seat.South),
        makeStep([], "raw-only", Seat.West),  // opponent pass
        makeStep([{ act: "overcall", feature: "heldSuit", suit: "hearts" }], "resolved", Seat.West),
      ];
      // "contains overcall by opponent" — should match (West is opponent)
      expect(matchRoute(
        { kind: "contains", pattern: { act: "overcall", actor: "opponent" } },
        log,
        openerSeat,
      )).toBe(true);
      // "contains overcall by opener" — should NOT match
      expect(matchRoute(
        { kind: "contains", pattern: { act: "overcall", actor: "opener" } },
        log,
        openerSeat,
      )).toBe(false);
    });

    it("last with actor-filtered pattern", () => {
      const log = [
        makeStep([{ act: "open", strain: "notrump" }], "resolved", Seat.South),
        makeStep([{ act: "inquire", feature: "majorSuit" }], "resolved", Seat.North),
      ];
      // Last step by responder — should match (North is South's partner)
      expect(matchRoute(
        { kind: "last", pattern: { act: "inquire", actor: "responder" } },
        log,
        openerSeat,
      )).toBe(true);
      // Last step by opener — should NOT match
      expect(matchRoute(
        { kind: "last", pattern: { act: "inquire", actor: "opener" } },
        log,
        openerSeat,
      )).toBe(false);
    });

    it("subseq with actor-filtered patterns", () => {
      const log = [
        makeStep([{ act: "open", strain: "notrump" }], "resolved", Seat.South),
        makeStep([], "raw-only", Seat.West),
        makeStep([{ act: "inquire", feature: "majorSuit" }], "resolved", Seat.North),
        makeStep([], "raw-only", Seat.East),
        makeStep([{ act: "deny", feature: "majorSuit" }], "resolved", Seat.South),
      ];
      // opener opens, responder inquires — should match
      expect(matchRoute(
        {
          kind: "subseq",
          steps: [
            { act: "open", actor: "opener" },
            { act: "inquire", actor: "responder" },
          ],
        },
        log,
        openerSeat,
      )).toBe(true);
      // opener opens, opener inquires — should NOT match (North is responder)
      expect(matchRoute(
        {
          kind: "subseq",
          steps: [
            { act: "open", actor: "opener" },
            { act: "inquire", actor: "opener" },
          ],
        },
        log,
        openerSeat,
      )).toBe(false);
    });

    it("without openerSeat, actor patterns are ignored", () => {
      const log = [
        makeStep([{ act: "open", strain: "notrump" }], "resolved", Seat.South),
      ];
      // Pattern has actor but no openerSeat provided — should still match on act alone
      expect(matchRoute(
        { kind: "contains", pattern: { act: "open", actor: "opponent" } },
        log,
      )).toBe(true);
    });
  });
});
