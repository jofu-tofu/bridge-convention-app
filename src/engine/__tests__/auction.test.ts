import { describe, test, expect } from "vitest";
import { BidSuit, Seat } from "../types";
import type { Auction, AuctionEntry, Call, ContractBid } from "../types";
import { nextSeat } from "../constants";
import {
  compareBids,
  isLegalCall,
  addCall,
  getContract,
  getLegalCalls,
} from "../auction";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bid(level: ContractBid["level"], strain: BidSuit): ContractBid {
  return { type: "bid", level, strain };
}

const pass: Call = { type: "pass" };
const double: Call = { type: "double" };
const redouble: Call = { type: "redouble" };

function emptyAuction(): Auction {
  return { entries: [], isComplete: false };
}

/** Build an auction from a sequence of calls starting from the given dealer. */
function buildAuction(dealer: Seat, calls: Call[]): Auction {
  let auction = emptyAuction();
  let seat = dealer;
  for (const call of calls) {
    const entry: AuctionEntry = { seat, call };
    auction = addCall(auction, entry);
    seat = nextSeat(seat);
  }
  return auction;
}

// ---------------------------------------------------------------------------
// compareBids
// ---------------------------------------------------------------------------

describe("compareBids", () => {
  test("1C is less than 7NT (lowest vs highest)", () => {
    expect(
      compareBids(bid(1, BidSuit.Clubs), bid(7, BidSuit.NoTrump)),
    ).toBeLessThan(0);
  });

  test("7NT is greater than 1C", () => {
    expect(
      compareBids(bid(7, BidSuit.NoTrump), bid(1, BidSuit.Clubs)),
    ).toBeGreaterThan(0);
  });

  test("equal bids compare to 0", () => {
    expect(compareBids(bid(3, BidSuit.Hearts), bid(3, BidSuit.Hearts))).toBe(0);
  });

  test("strain ordering within same level: 1NT > 1S > 1H > 1D > 1C", () => {
    const strains = [
      BidSuit.Clubs,
      BidSuit.Diamonds,
      BidSuit.Hearts,
      BidSuit.Spades,
      BidSuit.NoTrump,
    ];
    for (let i = 0; i < strains.length - 1; i++) {
      expect(
        compareBids(bid(1, strains[i]!), bid(1, strains[i + 1]!)),
      ).toBeLessThan(0);
    }
  });

  test("higher level always beats any strain at lower level: 2C > 1NT", () => {
    expect(
      compareBids(bid(2, BidSuit.Clubs), bid(1, BidSuit.NoTrump)),
    ).toBeGreaterThan(0);
  });

  test("35 distinct bids exist (7 levels × 5 strains)", () => {
    const bids: ContractBid[] = [];
    for (let level = 1; level <= 7; level++) {
      for (const strain of [
        BidSuit.Clubs,
        BidSuit.Diamonds,
        BidSuit.Hearts,
        BidSuit.Spades,
        BidSuit.NoTrump,
      ]) {
        bids.push(bid(level as ContractBid["level"], strain));
      }
    }
    expect(bids).toHaveLength(35);
    // Each consecutive pair should be strictly ascending
    for (let i = 0; i < bids.length - 1; i++) {
      expect(compareBids(bids[i]!, bids[i + 1]!)).toBeLessThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// isLegalCall
// ---------------------------------------------------------------------------

describe("isLegalCall", () => {
  test("pass is always legal on empty auction", () => {
    expect(isLegalCall(emptyAuction(), pass, Seat.North)).toBe(true);
  });

  test("pass is always legal after bids", () => {
    const auction = buildAuction(Seat.North, [bid(1, BidSuit.Clubs)]);
    expect(isLegalCall(auction, pass, Seat.East)).toBe(true);
  });

  test("any bid is legal on empty auction", () => {
    expect(isLegalCall(emptyAuction(), bid(1, BidSuit.Clubs), Seat.North)).toBe(
      true,
    );
    expect(
      isLegalCall(emptyAuction(), bid(7, BidSuit.NoTrump), Seat.North),
    ).toBe(true);
  });

  test("can't bid 1H after 1S (lower strain at same level)", () => {
    const auction = buildAuction(Seat.North, [bid(1, BidSuit.Spades)]);
    expect(isLegalCall(auction, bid(1, BidSuit.Hearts), Seat.East)).toBe(false);
  });

  test("can bid higher strain at same level: 1S after 1H", () => {
    const auction = buildAuction(Seat.North, [bid(1, BidSuit.Hearts)]);
    expect(isLegalCall(auction, bid(1, BidSuit.Spades), Seat.East)).toBe(true);
  });

  test("can bid same strain at higher level", () => {
    const auction = buildAuction(Seat.North, [bid(1, BidSuit.Hearts)]);
    expect(isLegalCall(auction, bid(2, BidSuit.Hearts), Seat.East)).toBe(true);
  });

  test("can't bid the same bid again (next player)", () => {
    const auction = buildAuction(Seat.North, [bid(1, BidSuit.Clubs)]);
    expect(isLegalCall(auction, bid(1, BidSuit.Clubs), Seat.East)).toBe(false);
  });

  test("same player can't rebid same contract after opponent doubles", () => {
    // N: 3C, E: X, S: pass, W: pass — N's turn again, can't rebid 3C
    const auction = buildAuction(Seat.North, [
      bid(3, BidSuit.Clubs),
      double,
      pass,
      pass,
    ]);
    expect(isLegalCall(auction, bid(3, BidSuit.Clubs), Seat.North)).toBe(false);
  });

  test("same player can't rebid same contract after passes", () => {
    // N: 2H, E: 3C, S: pass, W: pass — N's turn, can't rebid 2H
    const auction = buildAuction(Seat.North, [
      bid(2, BidSuit.Hearts),
      bid(3, BidSuit.Clubs),
      pass,
      pass,
    ]);
    expect(isLegalCall(auction, bid(2, BidSuit.Hearts), Seat.North)).toBe(
      false,
    );
    // But N CAN bid higher (3H or above)
    expect(isLegalCall(auction, bid(3, BidSuit.Hearts), Seat.North)).toBe(true);
  });

  test("can double opponent's bid", () => {
    // N bids 1C, E can double
    const auction = buildAuction(Seat.North, [bid(1, BidSuit.Clubs)]);
    expect(isLegalCall(auction, double, Seat.East)).toBe(true);
  });

  test("can't double partner's bid", () => {
    // N bids 1C, E passes, S can't double (partner's bid)
    const auction = buildAuction(Seat.North, [bid(1, BidSuit.Clubs), pass]);
    expect(isLegalCall(auction, double, Seat.South)).toBe(false);
  });

  test("can't double when no bid has been made", () => {
    expect(isLegalCall(emptyAuction(), double, Seat.North)).toBe(false);
  });

  test("can't double when last non-pass call is a double", () => {
    // N bids 1C, E doubles, S can't double again
    const auction = buildAuction(Seat.North, [bid(1, BidSuit.Clubs), double]);
    expect(isLegalCall(auction, double, Seat.South)).toBe(false);
  });

  test("double resets when new bid is made", () => {
    // N: 1C, E: X, S: 2C — now W can double (opponent's bid, not a double)
    const auction = buildAuction(Seat.North, [
      bid(1, BidSuit.Clubs),
      double,
      bid(2, BidSuit.Clubs),
    ]);
    expect(isLegalCall(auction, double, Seat.West)).toBe(true);
  });

  test("can't redouble when no double is active", () => {
    const auction = buildAuction(Seat.North, [bid(1, BidSuit.Clubs)]);
    expect(isLegalCall(auction, redouble, Seat.East)).toBe(false);
  });

  test("redouble only legal when opponent doubled your side's bid", () => {
    // N: 1C, E: X — now S can redouble (opponent doubled partner's bid)
    const auction = buildAuction(Seat.North, [bid(1, BidSuit.Clubs), double]);
    expect(isLegalCall(auction, redouble, Seat.South)).toBe(true);
  });

  test("can't redouble your own side's double", () => {
    // N: 1C, E: X — N's partner (S) could redouble, but E's partner (W) cannot
    const auction = buildAuction(Seat.North, [bid(1, BidSuit.Clubs), double]);
    expect(isLegalCall(auction, redouble, Seat.West)).toBe(false);
  });

  test("redouble legal with intervening passes", () => {
    // N: 1C, E: X, S: pass — W can't redouble (W is on same side as E who doubled)
    // N: 1C, E: X, S: pass — N can redouble
    const auction = buildAuction(Seat.North, [
      bid(1, BidSuit.Clubs),
      double,
      pass,
    ]);
    expect(isLegalCall(auction, redouble, Seat.West)).toBe(false);
    expect(isLegalCall(auction, redouble, Seat.North)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isAuctionComplete
// ---------------------------------------------------------------------------

describe("isAuctionComplete", () => {
  test("auction ends: bid, pass, pass, pass", () => {
    const auction = buildAuction(Seat.North, [
      bid(1, BidSuit.Clubs),
      pass,
      pass,
      pass,
    ]);
    expect(auction.isComplete).toBe(true);
  });

  test("auction ends: pass, pass, pass, pass (passout)", () => {
    const auction = buildAuction(Seat.North, [pass, pass, pass, pass]);
    expect(auction.isComplete).toBe(true);
  });

  test("auction not complete after two passes following a bid", () => {
    const auction = buildAuction(Seat.North, [
      bid(1, BidSuit.Clubs),
      pass,
      pass,
    ]);
    expect(auction.isComplete).toBe(false);
  });

  test("auction not complete after one bid", () => {
    const auction = buildAuction(Seat.North, [bid(1, BidSuit.Clubs)]);
    expect(auction.isComplete).toBe(false);
  });

  test("three initial passes is not complete", () => {
    const auction = buildAuction(Seat.North, [pass, pass, pass]);
    expect(auction.isComplete).toBe(false);
  });

  test("complete after double then three passes", () => {
    const auction = buildAuction(Seat.North, [
      bid(1, BidSuit.Clubs),
      double,
      pass,
      pass,
      pass,
    ]);
    expect(auction.isComplete).toBe(true);
  });

  test("complete after redouble then three passes", () => {
    const auction = buildAuction(Seat.North, [
      bid(1, BidSuit.Clubs),
      double,
      redouble,
      pass,
      pass,
      pass,
    ]);
    expect(auction.isComplete).toBe(true);
  });

  test("not complete after redouble then two passes", () => {
    const auction = buildAuction(Seat.North, [
      bid(1, BidSuit.Clubs),
      double,
      redouble,
      pass,
      pass,
    ]);
    expect(auction.isComplete).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// addCall
// ---------------------------------------------------------------------------

describe("addCall", () => {
  test("throws on illegal call", () => {
    const auction = buildAuction(Seat.North, [bid(1, BidSuit.Spades)]);
    expect(() =>
      addCall(auction, { seat: Seat.East, call: bid(1, BidSuit.Hearts) }),
    ).toThrow();
  });

  test("returns new Auction with entry appended", () => {
    const auction = emptyAuction();
    const next = addCall(auction, {
      seat: Seat.North,
      call: bid(1, BidSuit.Clubs),
    });
    expect(next.entries).toHaveLength(1);
    expect(next.entries[0]!.call).toEqual(bid(1, BidSuit.Clubs));
    // Original unchanged (immutability)
    expect(auction.entries).toHaveLength(0);
  });

  test("does not allow calls on a completed auction", () => {
    const auction = buildAuction(Seat.North, [pass, pass, pass, pass]);
    expect(() => addCall(auction, { seat: Seat.North, call: pass })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// getContract
// ---------------------------------------------------------------------------

describe("getContract", () => {
  test("returns null for passout", () => {
    const auction = buildAuction(Seat.North, [pass, pass, pass, pass]);
    expect(getContract(auction)).toBeNull();
  });

  test("simple contract: 1C by N", () => {
    const auction = buildAuction(Seat.North, [
      bid(1, BidSuit.Clubs),
      pass,
      pass,
      pass,
    ]);
    const contract = getContract(auction)!;
    expect(contract.level).toBe(1);
    expect(contract.strain).toBe(BidSuit.Clubs);
    expect(contract.doubled).toBe(false);
    expect(contract.redoubled).toBe(false);
    expect(contract.declarer).toBe(Seat.North);
  });

  test("doubled contract", () => {
    const auction = buildAuction(Seat.North, [
      bid(1, BidSuit.Clubs),
      double,
      pass,
      pass,
      pass,
    ]);
    const contract = getContract(auction)!;
    expect(contract.doubled).toBe(true);
    expect(contract.redoubled).toBe(false);
  });

  test("redoubled contract", () => {
    const auction = buildAuction(Seat.North, [
      bid(1, BidSuit.Clubs),
      double,
      redouble,
      pass,
      pass,
      pass,
    ]);
    const contract = getContract(auction)!;
    expect(contract.doubled).toBe(false);
    expect(contract.redoubled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getDeclarer
// ---------------------------------------------------------------------------

describe("getDeclarer", () => {
  test("declarer is first on declaring side to name final strain", () => {
    // N: 1S, E: pass, S: 4S → declarer is N (first on NS to bid spades)
    const auction = buildAuction(Seat.North, [
      bid(1, BidSuit.Spades),
      pass,
      bid(4, BidSuit.Spades),
      pass,
      pass,
      pass,
    ]);
    expect(getContract(auction)!.declarer).toBe(Seat.North);
  });

  test("declarer with interference: opponent also bids the strain", () => {
    // N: 1S, E: 2S (overcall), S: 4S → declarer is N (first on NS side to bid spades)
    // Note: E also bid spades, but E is on EW side
    const auction = buildAuction(Seat.North, [
      bid(1, BidSuit.Spades),
      bid(2, BidSuit.Spades),
      bid(4, BidSuit.Spades),
      pass,
      pass,
      pass,
    ]);
    expect(getContract(auction)!.declarer).toBe(Seat.North);
  });

  test("declarer is the only bidder", () => {
    // E: 3NT, everyone passes
    const auction = buildAuction(Seat.East, [
      bid(3, BidSuit.NoTrump),
      pass,
      pass,
      pass,
    ]);
    expect(getContract(auction)!.declarer).toBe(Seat.East);
  });

  test("declarer when partner first bid the strain in a different context", () => {
    // N: 1H, E: pass, S: 1S, W: pass, N: 4S → declarer is S (first on NS to bid spades)
    const auction = buildAuction(Seat.North, [
      bid(1, BidSuit.Hearts),
      pass,
      bid(1, BidSuit.Spades),
      pass,
      bid(4, BidSuit.Spades),
      pass,
      pass,
      pass,
    ]);
    expect(getContract(auction)!.declarer).toBe(Seat.South);
  });
});

// ---------------------------------------------------------------------------
// getLegalCalls
// ---------------------------------------------------------------------------

describe("getLegalCalls", () => {
  test("on empty auction: pass + all 35 bids, no double/redouble", () => {
    const calls = getLegalCalls(emptyAuction(), Seat.North);
    // Pass + 35 bids = 36
    expect(calls).toHaveLength(36);
    // Contains pass
    expect(calls).toContainEqual(pass);
    // Contains 1C and 7NT
    expect(calls).toContainEqual(bid(1, BidSuit.Clubs));
    expect(calls).toContainEqual(bid(7, BidSuit.NoTrump));
    // No double or redouble
    expect(calls).not.toContainEqual(double);
    expect(calls).not.toContainEqual(redouble);
  });

  test("includes double when last non-pass is opponent's bid", () => {
    const auction = buildAuction(Seat.North, [bid(1, BidSuit.Clubs)]);
    const calls = getLegalCalls(auction, Seat.East);
    expect(calls).toContainEqual(double);
    expect(calls).not.toContainEqual(redouble);
  });

  test("after a bid, only higher bids are legal", () => {
    const auction = buildAuction(Seat.North, [bid(3, BidSuit.Hearts)]);
    const calls = getLegalCalls(auction, Seat.East);
    // Should not contain 3H or anything below
    expect(calls).not.toContainEqual(bid(3, BidSuit.Hearts));
    expect(calls).not.toContainEqual(bid(3, BidSuit.Diamonds));
    expect(calls).not.toContainEqual(bid(1, BidSuit.Clubs));
    // Should contain 3S and above
    expect(calls).toContainEqual(bid(3, BidSuit.Spades));
    expect(calls).toContainEqual(bid(7, BidSuit.NoTrump));
  });

  test("includes redouble when opponent doubled your side's bid", () => {
    const auction = buildAuction(Seat.North, [bid(1, BidSuit.Clubs), double]);
    const calls = getLegalCalls(auction, Seat.South);
    expect(calls).toContainEqual(redouble);
  });

  test("no calls available on completed auction", () => {
    const auction = buildAuction(Seat.North, [pass, pass, pass, pass]);
    const calls = getLegalCalls(auction, Seat.North);
    expect(calls).toHaveLength(0);
  });

  test("after 7NT only pass and double available", () => {
    const auction = buildAuction(Seat.North, [bid(7, BidSuit.NoTrump)]);
    const calls = getLegalCalls(auction, Seat.East);
    // pass + double = 2 (no higher bids exist, no redouble)
    expect(calls).toHaveLength(2);
    expect(calls).toContainEqual(pass);
    expect(calls).toContainEqual(double);
  });

  test("getLegalCalls count with redouble available", () => {
    // N:1C E:X — S's options: pass(1) + bids>1C(34) + redouble(1) = 36
    const auction = buildAuction(Seat.North, [bid(1, BidSuit.Clubs), double]);
    const calls = getLegalCalls(auction, Seat.South);
    expect(calls).toHaveLength(36);
    expect(calls).toContainEqual(pass);
    expect(calls).toContainEqual(redouble);
    expect(calls).not.toContainEqual(double);
    expect(calls).not.toContainEqual(bid(1, BidSuit.Clubs));
  });
});

// ---------------------------------------------------------------------------
// Edge cases: double/redouble with intervening passes
// ---------------------------------------------------------------------------

describe("isLegalCall — intervening passes", () => {
  test("double legal after 2 intervening passes (opponent's bid still active)", () => {
    // N:1C E:P S:P — W can double (opponent N's bid)
    const auction = buildAuction(Seat.North, [
      bid(1, BidSuit.Clubs),
      pass,
      pass,
    ]);
    expect(isLegalCall(auction, double, Seat.West)).toBe(true);
  });

  test("redouble legal after 2 intervening passes (double still active)", () => {
    // N:1C E:X S:P W:P — N can redouble (opponent's double)
    const auction = buildAuction(Seat.North, [
      bid(1, BidSuit.Clubs),
      double,
      pass,
      pass,
    ]);
    expect(isLegalCall(auction, redouble, Seat.North)).toBe(true);
  });

  test("double illegal when last non-pass call is a double", () => {
    // N:1C E:X S:P — W cannot double (last non-pass is already a double)
    const auction = buildAuction(Seat.North, [
      bid(1, BidSuit.Clubs),
      double,
      pass,
    ]);
    expect(isLegalCall(auction, double, Seat.West)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Edge cases: addCall immutability and competitive auctions
// ---------------------------------------------------------------------------

describe("addCall — complex sequences", () => {
  test("addCall preserves immutability for complex 6-entry auction", () => {
    const auction = buildAuction(Seat.North, [
      bid(1, BidSuit.Clubs),
      bid(1, BidSuit.Diamonds),
      bid(1, BidSuit.Hearts),
      bid(1, BidSuit.Spades),
      bid(2, BidSuit.Clubs),
      bid(2, BidSuit.Diamonds),
    ]);
    const originalLength = auction.entries.length;
    const next = addCall(auction, {
      seat: Seat.South,
      call: bid(2, BidSuit.Hearts),
    });
    expect(next.entries).toHaveLength(originalLength + 1);
    expect(auction.entries).toHaveLength(originalLength);
  });
});

describe("competitive auction edge cases", () => {
  test("competitive auction with escalating bids completes correctly", () => {
    // N:1C E:1D S:1H W:1S N:2C E:2D then S:P W:P N:P
    const auction = buildAuction(Seat.North, [
      bid(1, BidSuit.Clubs),
      bid(1, BidSuit.Diamonds),
      bid(1, BidSuit.Hearts),
      bid(1, BidSuit.Spades),
      bid(2, BidSuit.Clubs),
      bid(2, BidSuit.Diamonds),
      pass,
      pass,
      pass,
    ]);
    expect(auction.isComplete).toBe(true);
  });

  test("getContract declarer is first on side to name strain in competitive auction", () => {
    // N:1D E:P S:2D P P P — declarer is N (first on NS to bid diamonds)
    const auction = buildAuction(Seat.North, [
      bid(1, BidSuit.Diamonds),
      pass,
      bid(2, BidSuit.Diamonds),
      pass,
      pass,
      pass,
    ]);
    const contract = getContract(auction)!;
    expect(contract.declarer).toBe(Seat.North);
    expect(contract.strain).toBe(BidSuit.Diamonds);
  });
});
