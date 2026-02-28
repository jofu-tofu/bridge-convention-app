import { BidSuit } from "../../../engine/types";
import { partnerSeat } from "../../../engine/constants";
import type { AuctionCondition } from "../../core/types";
import { seatFirstBidStrain, partnerOpeningStrain } from "../../core/conditions";

/** Condition: partner raised to 3 of opener's major (for preemptive detection). */
export function partnerRaisedToThreeOfMajor(): AuctionCondition {
  return {
    name: "partner-raised-3M",
    label: "Partner raised to 3 of opened major",
    category: "auction",
    test(ctx) {
      const strain = seatFirstBidStrain(ctx);
      if (strain !== BidSuit.Hearts && strain !== BidSuit.Spades) return false;
      const partner = partnerSeat(ctx.seat);
      return ctx.auction.entries.some(
        (e) =>
          e.seat === partner &&
          e.call.type === "bid" &&
          e.call.level === 3 &&
          e.call.strain === strain,
      );
    },
    describe(ctx) {
      const strain = seatFirstBidStrain(ctx);
      if (strain !== BidSuit.Hearts && strain !== BidSuit.Spades) {
        return "Opener did not bid a major";
      }
      const partner = partnerSeat(ctx.seat);
      const found = ctx.auction.entries.some(
        (e) =>
          e.seat === partner &&
          e.call.type === "bid" &&
          e.call.level === 3 &&
          e.call.strain === strain,
      );
      return found
        ? `Partner raised to 3${strain}`
        : `Partner did not raise to 3${strain}`;
    },
  };
}

/** Condition: partner bid game in a major (4H or 4S). */
export function partnerBidGameInMajor(): AuctionCondition {
  return {
    name: "partner-bid-4M",
    label: "Partner bid game in major",
    category: "auction",
    test(ctx) {
      const partner = partnerSeat(ctx.seat);
      return ctx.auction.entries.some(
        (e) =>
          e.seat === partner &&
          e.call.type === "bid" &&
          e.call.level === 4 &&
          (e.call.strain === BidSuit.Hearts || e.call.strain === BidSuit.Spades),
      );
    },
    describe(ctx) {
      const partner = partnerSeat(ctx.seat);
      const found = ctx.auction.entries.find(
        (e) =>
          e.seat === partner &&
          e.call.type === "bid" &&
          e.call.level === 4 &&
          (e.call.strain === BidSuit.Hearts || e.call.strain === BidSuit.Spades),
      );
      return found ? `Partner bid game in ${(found.call as { strain: BidSuit }).strain}` : "Partner has not bid game in a major";
    },
  };
}

/** Condition: partner bid the splinter (other major at 3-level). */
export function partnerBidSplinter(): AuctionCondition {
  return {
    name: "partner-bid-splinter",
    label: "Partner bid splinter (other major at 3-level)",
    category: "auction",
    test(ctx) {
      // Opener's perspective: we opened 1M, partner bid the other major at 3
      const openerStrain = seatFirstBidStrain(ctx);
      if (openerStrain !== BidSuit.Hearts && openerStrain !== BidSuit.Spades) return false;
      const otherMajor = openerStrain === BidSuit.Hearts ? BidSuit.Spades : BidSuit.Hearts;
      const partner = partnerSeat(ctx.seat);
      return ctx.auction.entries.some(
        (e) =>
          e.seat === partner &&
          e.call.type === "bid" &&
          e.call.level === 3 &&
          e.call.strain === otherMajor,
      );
    },
    describe(ctx) {
      const openerStrain = seatFirstBidStrain(ctx);
      if (openerStrain !== BidSuit.Hearts && openerStrain !== BidSuit.Spades) {
        return "Opener did not bid a major";
      }
      const otherMajor = openerStrain === BidSuit.Hearts ? BidSuit.Spades : BidSuit.Hearts;
      return `Partner bid 3${otherMajor} (splinter)`;
    },
  };
}

/** Condition: partner bid the splinter relay (3NT after 1H-3S, or 3S after 1S-3H). */
export function partnerBidSplinterRelay(): AuctionCondition {
  return {
    name: "partner-bid-splinter-relay",
    label: "Partner bid splinter relay",
    category: "auction",
    test(ctx) {
      // Responder's perspective: partner opened 1M, we bid splinter, partner relayed
      const trumpStrain = partnerOpeningStrain(ctx);
      if (trumpStrain !== BidSuit.Hearts && trumpStrain !== BidSuit.Spades) return false;
      const partner = partnerSeat(ctx.seat);
      if (trumpStrain === BidSuit.Hearts) {
        // After 1H-P-3S, relay is 3NT
        return ctx.auction.entries.some(
          (e) =>
            e.seat === partner &&
            e.call.type === "bid" &&
            e.call.level === 3 &&
            e.call.strain === BidSuit.NoTrump,
        );
      }
      // After 1S-P-3H, relay is 3S
      return ctx.auction.entries.some(
        (e) =>
          e.seat === partner &&
          e.call.type === "bid" &&
          e.call.level === 3 &&
          e.call.strain === BidSuit.Spades,
      );
    },
    describe(ctx) {
      const trumpStrain = partnerOpeningStrain(ctx);
      if (trumpStrain === BidSuit.Hearts) return "Partner relayed with 3NT after splinter";
      if (trumpStrain === BidSuit.Spades) return "Partner relayed with 3S after splinter";
      return "Not in splinter relay position";
    },
  };
}

/** Condition: partner signed off in 3 of their opened major. */
export function partnerSignedOffInThreeMajor(): AuctionCondition {
  return {
    name: "partner-signoff-3M",
    label: "Partner signed off in 3 of major",
    category: "auction",
    test(ctx) {
      const partner = partnerSeat(ctx.seat);
      // Find partner's opening strain (partner is opener in Bergen)
      const firstEntry = ctx.auction.entries.find(
        (e) => e.call.type === "bid" && e.seat === partner,
      );
      const openerStrain = firstEntry?.call.type === "bid" ? firstEntry.call.strain : null;
      if (openerStrain !== BidSuit.Hearts && openerStrain !== BidSuit.Spades) return false;
      // Check partner bid 3 of that same major (their rebid)
      let partnerBidCount = 0;
      for (const entry of ctx.auction.entries) {
        if (entry.seat === partner && entry.call.type === "bid") {
          partnerBidCount++;
          if (
            partnerBidCount === 2 &&
            entry.call.level === 3 &&
            entry.call.strain === openerStrain
          ) {
            return true;
          }
        }
      }
      return false;
    },
    describe(ctx) {
      return this.test(ctx)
        ? "Partner signed off in 3 of their major"
        : "Partner did not sign off in 3 of major";
    },
  };
}
