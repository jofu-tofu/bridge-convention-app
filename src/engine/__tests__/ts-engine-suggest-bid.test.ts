import { describe, test, expect, beforeEach } from "vitest";
import { Seat, BidSuit } from "../types";
import type { ContractBid } from "../types";
import { suggestBid } from "../bid-suggester";
import { registerConvention, clearRegistry } from "../../conventions/core/registry";
import { staymanConfig } from "../../conventions/definitions/stayman";
import { hand } from "./fixtures";
import {
  staymanResponder,
  staymanOpener,
  noMajorHand,
  auctionFromBids,
} from "../../conventions/__tests__/fixtures";
import { conventionToStrategy } from "../../strategy/bidding/convention-strategy";
import type { BiddingStrategy } from "../../shared/types";

beforeEach(() => {
  clearRegistry();
  registerConvention(staymanConfig);
});

const staymanStrategy = () => conventionToStrategy(staymanConfig);

describe("suggestBid", () => {
  test("suggestBid with stayman returns BidResult for hand+auction", () => {
    const responder = staymanResponder();
    const auction = auctionFromBids(Seat.North, ["1NT", "P"]);
    const result = suggestBid(
      responder,
      auction,
      Seat.South,
      staymanStrategy(),
    );
    expect(result.call.type).toBe("bid");
    const bid = result.call as ContractBid;
    expect(bid.level).toBe(2);
    expect(bid.strain).toBe(BidSuit.Clubs);
    expect(result.ruleName).toBe("stayman-ask");
    expect(result.explanation).toBeTruthy();
  });

  test("returns BidResult with pass when no rules match", () => {
    const noMajor = noMajorHand();
    const auction = auctionFromBids(Seat.North, ["1NT", "P"]);
    const result = suggestBid(noMajor, auction, Seat.South, staymanStrategy());
    expect(result.call.type).toBe("pass");
    expect(result.ruleName).toBeNull();
    expect(result.explanation).toBeTruthy();
  });

  test("null→pass boundary: strategy returning null produces pass BidResult", () => {
    const alwaysNullStrategy: BiddingStrategy = {
      id: "test:always-null",
      name: "Always Null",
      suggest() {
        return null;
      },
    };
    const h = hand(
      "SA",
      "SK",
      "SQ",
      "SJ",
      "HA",
      "HK",
      "HQ",
      "DA",
      "DK",
      "CA",
      "CK",
      "CQ",
      "CJ",
    );
    const auction = { entries: [], isComplete: false };
    const result = suggestBid(h, auction, Seat.North, alwaysNullStrategy);
    expect(result.call.type).toBe("pass");
    expect(result.ruleName).toBeNull();
    expect(result.explanation).toBeTruthy();
  });

  test("full Stayman sequence through suggestBid", () => {
    const opener = staymanOpener();
    const responder = hand(
      "SQ",
      "S5",
      "S2",
      "HA",
      "HK",
      "H5",
      "H3",
      "DA",
      "D8",
      "D4",
      "C9",
      "C3",
      "C6",
    );

    // Step 1: South bids 2C (Stayman)
    let auction = auctionFromBids(Seat.North, ["1NT", "P"]);
    const result1 = suggestBid(
      responder,
      auction,
      Seat.South,
      staymanStrategy(),
    );
    expect(result1.call.type).toBe("bid");
    expect((result1.call as ContractBid).strain).toBe(BidSuit.Clubs);

    // Step 2: North responds 2H
    auction = auctionFromBids(Seat.North, ["1NT", "P", "2C", "P"]);
    const result2 = suggestBid(opener, auction, Seat.North, staymanStrategy());
    expect(result2.call.type).toBe("bid");
    expect((result2.call as ContractBid).strain).toBe(BidSuit.Hearts);

    // Step 3: South bids 4H
    auction = auctionFromBids(Seat.North, ["1NT", "P", "2C", "P", "2H", "P"]);
    const result3 = suggestBid(
      responder,
      auction,
      Seat.South,
      staymanStrategy(),
    );
    expect(result3.call.type).toBe("bid");
    expect((result3.call as ContractBid).level).toBe(4);
    expect((result3.call as ContractBid).strain).toBe(BidSuit.Hearts);
  });
});
