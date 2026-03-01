// Tests for the event classifier — classifies auction entries with semantic metadata.

import { describe, it, expect } from "vitest";
import { Seat } from "../../../engine/types";
import { buildAuction } from "../../../engine/auction-helpers";
import { classifyAuctionEntry } from "../../core/dialogue/event-classifier";

describe("classifyAuctionEntry", () => {
  it("classifies a pass by LHO as opponent pass", () => {
    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const entry = auction.entries[1]!; // East passes
    const result = classifyAuctionEntry(entry, Seat.South, auction);

    expect(result.actor).toBe("rho");
    expect(result.actionKind).toBe("pass");
    expect(result.interferenceKind).toBe("none");
  });

  it("classifies a double by RHO after 1NT", () => {
    const auction = buildAuction(Seat.North, ["1NT", "X"]);
    const entry = auction.entries[1]!; // East doubles
    const result = classifyAuctionEntry(entry, Seat.South, auction);

    expect(result.actor).toBe("rho");
    expect(result.actionKind).toBe("double");
    expect(result.interferenceKind).toBe("double");
  });

  it("classifies an overcall by opponent", () => {
    const auction = buildAuction(Seat.North, ["1NT", "2H"]);
    const entry = auction.entries[1]!; // East overcalls
    const result = classifyAuctionEntry(entry, Seat.South, auction);

    expect(result.actor).toBe("rho");
    expect(result.actionKind).toBe("bid");
    expect(result.bidNature).toBe("unknown");
    expect(result.interferenceKind).toBe("natural_overcall");
    expect(result.level).toBe(2);
    expect(result.strain).toBe("H");
  });

  it("classifies a jump overcall", () => {
    const auction = buildAuction(Seat.North, ["1NT", "3H"]);
    const entry = auction.entries[1]!; // East jump overcalls
    const result = classifyAuctionEntry(entry, Seat.South, auction);

    expect(result.actor).toBe("rho");
    expect(result.interferenceKind).toBe("jump");
    expect(result.level).toBe(3);
  });

  it("classifies own partnership bid as self/partner", () => {
    const auction = buildAuction(Seat.North, ["1NT", "P", "2C"]);
    // South bids 2C
    const southEntry = auction.entries[2]!;
    const resultSelf = classifyAuctionEntry(southEntry, Seat.South, auction);
    expect(resultSelf.actor).toBe("self");
    expect(resultSelf.actionKind).toBe("bid");

    // From North's perspective, South's bid is partner's
    const resultPartner = classifyAuctionEntry(southEntry, Seat.North, auction);
    expect(resultPartner.actor).toBe("partner");
  });

  it("determines actor correctly for all four seats", () => {
    // Dealer=North, so bids go N, E, S, W
    const auction = buildAuction(Seat.North, ["1NT", "P", "2C", "P"]);

    // North's 1NT from South's perspective = partner
    const n = classifyAuctionEntry(auction.entries[0]!, Seat.South, auction);
    expect(n.actor).toBe("partner");

    // East's pass from South's perspective = rho
    const e = classifyAuctionEntry(auction.entries[1]!, Seat.South, auction);
    expect(e.actor).toBe("rho");

    // South's 2C from South's perspective = self
    const s = classifyAuctionEntry(auction.entries[2]!, Seat.South, auction);
    expect(s.actor).toBe("self");

    // West's pass from South's perspective = lho
    const w = classifyAuctionEntry(auction.entries[3]!, Seat.South, auction);
    expect(w.actor).toBe("lho");
  });

  it("classifies redouble correctly", () => {
    const auction = buildAuction(Seat.North, ["1NT", "X", "XX"]);
    const entry = auction.entries[2]!; // South redoubles
    const result = classifyAuctionEntry(entry, Seat.South, auction);

    expect(result.actor).toBe("self");
    expect(result.actionKind).toBe("redouble");
    expect(result.interferenceKind).toBe("none");
  });
});
