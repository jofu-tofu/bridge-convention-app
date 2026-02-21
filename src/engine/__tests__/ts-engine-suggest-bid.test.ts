import { describe, test, expect, beforeEach } from "vitest";
import { Seat, BidSuit } from "../types";
import type { ContractBid } from "../types";
import { TsEngine } from "../ts-engine";
import { registerConvention, clearRegistry } from "../../conventions/registry";
import { staymanConfig } from "../../conventions/stayman";
import { hand } from "./fixtures";
import { auctionFromBids } from "../../conventions/__tests__/fixtures";
import { conventionToStrategy } from "../../ai/convention-strategy";
import type { BiddingStrategy, BidResult } from "../../shared/types";

const engine = new TsEngine();

beforeEach(() => {
  clearRegistry();
  registerConvention(staymanConfig);
});

const staymanStrategy = () => conventionToStrategy(staymanConfig);

describe("TsEngine.suggestBid", () => {
  test("suggestBid with stayman returns BidResult for hand+auction", async () => {
    // Responder with 4 hearts, 13 HCP — should bid 2C (Stayman)
    const responder = hand(
      "SK", "S5", "S2",
      "HA", "HK", "HQ", "H3",
      "D5", "D3", "D2",
      "C5", "C3", "C2",
    );
    const auction = auctionFromBids(Seat.North, ["1NT", "P"]);
    const result = await engine.suggestBid(responder, auction, Seat.South, staymanStrategy());
    expect(result.call.type).toBe("bid");
    const bid = result.call as ContractBid;
    expect(bid.level).toBe(2);
    expect(bid.strain).toBe(BidSuit.Clubs);
    expect(result.ruleName).toBe("stayman-ask");
    expect(result.explanation).toBeTruthy();
  });

  test("returns BidResult with pass when no rules match", async () => {
    // Hand with no 4-card major and too few HCP for Stayman — no rule should match
    const noMajor = hand(
      "SA", "S5", "S2",
      "HK", "H8", "H3",
      "DA", "DQ", "D7", "D4",
      "C5", "C3", "C2",
    );
    const auction = auctionFromBids(Seat.North, ["1NT", "P"]);
    const result = await engine.suggestBid(noMajor, auction, Seat.South, staymanStrategy());
    expect(result.call.type).toBe("pass");
    expect(result.ruleName).toBeNull();
    expect(result.explanation).toBeTruthy();
  });

  test("null→pass boundary: strategy returning null produces pass BidResult", async () => {
    const alwaysNullStrategy: BiddingStrategy = {
      id: "test:always-null",
      name: "Always Null",
      suggest() { return null; },
    };
    const h = hand(
      "SA", "SK", "SQ", "SJ",
      "HA", "HK", "HQ",
      "DA", "DK",
      "CA", "CK", "CQ", "CJ",
    );
    const auction = { entries: [], isComplete: false };
    const result = await engine.suggestBid(h, auction, Seat.North, alwaysNullStrategy);
    expect(result.call.type).toBe("pass");
    expect(result.ruleName).toBeNull();
    expect(result.explanation).toBeTruthy();
  });

  test("full Stayman sequence through suggestBid", async () => {
    // Opener: 16 HCP balanced, 4 hearts
    const opener = hand(
      "SA", "SK", "S3",
      "HK", "HQ", "HJ", "H2",
      "DK", "D5", "D3",
      "C7", "C5", "C2",
    );
    // Responder: 13 HCP, 4 hearts
    const responder = hand(
      "SQ", "S5", "S2",
      "HA", "HK", "H5", "H3",
      "DA", "D8", "D4",
      "C9", "C3", "C6",
    );

    // Step 1: South bids 2C (Stayman)
    let auction = auctionFromBids(Seat.North, ["1NT", "P"]);
    const result1 = await engine.suggestBid(responder, auction, Seat.South, staymanStrategy());
    expect(result1.call.type).toBe("bid");
    expect((result1.call as ContractBid).strain).toBe(BidSuit.Clubs);

    // Step 2: North responds 2H
    auction = auctionFromBids(Seat.North, ["1NT", "P", "2C", "P"]);
    const result2 = await engine.suggestBid(opener, auction, Seat.North, staymanStrategy());
    expect(result2.call.type).toBe("bid");
    expect((result2.call as ContractBid).strain).toBe(BidSuit.Hearts);

    // Step 3: South bids 4H
    auction = auctionFromBids(Seat.North, ["1NT", "P", "2C", "P", "2H", "P"]);
    const result3 = await engine.suggestBid(responder, auction, Seat.South, staymanStrategy());
    expect(result3.call.type).toBe("bid");
    expect((result3.call as ContractBid).level).toBe(4);
    expect((result3.call as ContractBid).strain).toBe(BidSuit.Hearts);
  });
});
