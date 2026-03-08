/**
 * Integration tests: verify North (partner) uses the drilled convention,
 * not SAYC, through the full drill pipeline (config → session → strategy).
 *
 * These tests catch the bug where participantSeats was derived from
 * dealConstraints.seats, which for defensive conventions includes
 * non-partner seats but not the partner.
 */
import { describe, test, expect, beforeEach } from "vitest";
import { Seat, BidSuit } from "../../engine/types";
import type { ContractBid } from "../../engine/types";
import { createDrillConfig } from "../config-factory";
import { createDrillSession } from "../session";
import {
  clearRegistry,
  registerConvention,
} from "../../conventions/core/registry";
import { bergenConfig } from "../../conventions/definitions/bergen-raises";
import { hand, auctionFromBids } from "../../conventions/__tests__/fixtures";

beforeEach(() => {
  clearRegistry();
});

// ─── Bergen: North opener rebids ─────────────────────────

describe("Bergen drill: North uses Bergen opener rebids", () => {
  function northBid(northHand: ReturnType<typeof hand>, bids: string[]) {
    registerConvention(bergenConfig);
    const config = createDrillConfig("bergen-raises", Seat.South, {
      opponentBidding: true,
    });
    const session = createDrillSession(config);
    const auction = auctionFromBids(Seat.North, bids);
    return session.getNextBid(Seat.North, northHand, auction);
  }

  test("North bids game after limit raise (3D) with 15+ HCP", () => {
    // 15 HCP opener: SA(4) + HA(4) + HK(3) + HQ(2) + DA(4) = 17 wait
    // Let's do: SA(4) + SK(3) + HA(4) + HK(3) + D5 + CJ(1) = 15 HCP, 5 hearts
    const opener = hand(
      "SA", "SK", "S2",
      "HA", "HK", "HQ", "H7", "H3",
      "DA", "D3",
      "C5", "C3", "C2",
    );
    const result = northBid(opener, ["1H", "P", "3D", "P"]);
    expect(result).not.toBeNull();
    expect(result!.ruleName).toBe("bergen-rebid-game-after-limit");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("North bids game try after constructive raise (3C) with 14-16 HCP", () => {
    // 14 HCP: SA(4) + HA(4) + HK(3) + HQ(2) + DJ(1) = 14 HCP, 5 hearts
    const opener = hand(
      "SA", "S5", "S2",
      "HA", "HK", "HQ", "H7", "H3",
      "DJ", "D3",
      "C5", "C3", "C2",
    );
    const result = northBid(opener, ["1H", "P", "3C", "P"]);
    expect(result).not.toBeNull();
    expect(result!.ruleName).toBe("bergen-rebid-try-after-constructive");
  });
});

// ─── East uses opponent strategy, not the drilled convention ──

describe("East uses opponent strategy, not the drilled convention", () => {
  test("East does not use Bergen strategy in a Bergen drill", () => {
    registerConvention(bergenConfig);
    const config = createDrillConfig("bergen-raises", Seat.South, {
      opponentBidding: true,
    });
    const eastStrategy = config.seatStrategies[Seat.East];
    expect(eastStrategy).not.toBe("user");
    if (eastStrategy !== "user") {
      expect(eastStrategy.id).not.toBe("convention:bergen-raises");
    }
  });
});
