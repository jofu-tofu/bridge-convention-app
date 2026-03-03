import type { BiddingContext, HandCondition } from "../types";
import { Rank, Suit, BidSuit, Seat, Vulnerability } from "../../../engine/types";
import { partnerSeat } from "../../../engine/constants";
import { auctionMatchesExact } from "../../../engine/auction-helpers";
import {
  partnerOpeningStrain,
  seatFirstBidStrain,
  partnerRespondedMajor,
  lastBid,
  bidIsHigher,
} from "./auction-query";

// ─── HCP condition factories ─────────────────────────────────

/** Minimum HCP check. */
export function hcpMin(min: number): HandCondition {
  return {
    name: "hcp-min",
    label: `${min}+ HCP`,
    category: "hand",
    inference: { type: "hcp-min", params: { min } },
    test(ctx) {
      return ctx.evaluation.hcp >= min;
    },
    describe(ctx) {
      const hcp = ctx.evaluation.hcp;
      return hcp >= min
        ? `${hcp} HCP (${min}+ required)`
        : `Need ${min}+ HCP (have ${hcp})`;
    },
  };
}

/** Maximum HCP check. */
export function hcpMax(max: number): HandCondition {
  return {
    name: "hcp-max",
    label: `${max} max HCP`,
    category: "hand",
    inference: { type: "hcp-max", params: { max } },
    test(ctx) {
      return ctx.evaluation.hcp <= max;
    },
    describe(ctx) {
      const hcp = ctx.evaluation.hcp;
      return hcp <= max
        ? `${hcp} HCP (${max} max)`
        : `Need ${max} or fewer HCP (have ${hcp})`;
    },
  };
}

/** HCP range check (inclusive). */
export function hcpRange(min: number, max: number): HandCondition {
  return {
    name: "hcp-range",
    label: `${min}–${max} HCP`,
    category: "hand",
    inference: { type: "hcp-range", params: { min, max } },
    test(ctx) {
      return ctx.evaluation.hcp >= min && ctx.evaluation.hcp <= max;
    },
    describe(ctx) {
      const hcp = ctx.evaluation.hcp;
      return hcp >= min && hcp <= max
        ? `${hcp} HCP (${min}–${max} range)`
        : `Need ${min}–${max} HCP (have ${hcp})`;
    },
  };
}

// ─── Vulnerability condition factories ───────────────────────

/** Check if a seat's side is vulnerable. */
function sideIsVulnerable(seat: Seat, vulnerability: Vulnerability | undefined): boolean {
  if (!vulnerability || vulnerability === Vulnerability.None) return false;
  if (vulnerability === Vulnerability.Both) return true;
  const isNS = seat === Seat.North || seat === Seat.South;
  return isNS
    ? vulnerability === Vulnerability.NorthSouth
    : vulnerability === Vulnerability.EastWest;
}

/** True when the specified seat's side is vulnerable. */
export function isVulnerable(seat: Seat): HandCondition {
  return {
    name: "is-vulnerable",
    label: "Vulnerable",
    category: "hand",
    test(ctx) {
      return sideIsVulnerable(seat, ctx.vulnerability);
    },
    describe(ctx) {
      return sideIsVulnerable(seat, ctx.vulnerability)
        ? "Vulnerable"
        : "Not vulnerable";
    },
  };
}

/** True when the specified seat's side is NOT vulnerable. */
export function isNotVulnerable(seat: Seat): HandCondition {
  return {
    name: "is-not-vulnerable",
    label: "Not vulnerable",
    category: "hand",
    test(ctx) {
      return !sideIsVulnerable(seat, ctx.vulnerability);
    },
    describe(ctx) {
      return !sideIsVulnerable(seat, ctx.vulnerability)
        ? "Not vulnerable"
        : "Vulnerable";
    },
  };
}

/** True when our side is NOT vulnerable and their side IS vulnerable. */
export function favorableVulnerability(): HandCondition {
  return {
    name: "favorable-vulnerability",
    label: "Favorable vulnerability",
    category: "hand",
    test(ctx) {
      return !sideIsVulnerable(ctx.seat, ctx.vulnerability) &&
        sideIsVulnerable(opponentSeat(ctx.seat), ctx.vulnerability);
    },
    describe(ctx) {
      const us = sideIsVulnerable(ctx.seat, ctx.vulnerability);
      const them = sideIsVulnerable(opponentSeat(ctx.seat), ctx.vulnerability);
      if (!us && them) return "Favorable vulnerability (we're not vul, they are)";
      if (us && !them) return "Unfavorable (we're vul, they're not)";
      if (us && them) return "Both vulnerable";
      return "Neither vulnerable";
    },
  };
}

/** True when our side IS vulnerable and their side is NOT vulnerable. */
export function unfavorableVulnerability(): HandCondition {
  return {
    name: "unfavorable-vulnerability",
    label: "Unfavorable vulnerability",
    category: "hand",
    test(ctx) {
      return sideIsVulnerable(ctx.seat, ctx.vulnerability) &&
        !sideIsVulnerable(opponentSeat(ctx.seat), ctx.vulnerability);
    },
    describe(ctx) {
      const us = sideIsVulnerable(ctx.seat, ctx.vulnerability);
      const them = sideIsVulnerable(opponentSeat(ctx.seat), ctx.vulnerability);
      if (us && !them) return "Unfavorable vulnerability (we're vul, they're not)";
      if (!us && them) return "Favorable (we're not vul, they are)";
      if (us && them) return "Both vulnerable";
      return "Neither vulnerable";
    },
  };
}

/** Get an opponent seat (for vulnerability checks — any opponent works since both share vulnerability). */
function opponentSeat(seat: Seat): Seat {
  return seat === Seat.North || seat === Seat.South ? Seat.East : Seat.North;
}

// ─── Suit length condition factories ─────────────────────────

/** Minimum length in a specific suit. suitIndex: [0]=S, [1]=H, [2]=D, [3]=C. */
export function suitMin(
  suitIndex: number,
  suitName: string,
  min: number,
): HandCondition {
  return {
    name: `${suitName}-min`,
    label: `${min}+ ${suitName}`,
    category: "hand",
    inference: { type: "suit-min", params: { suitIndex, suitName, min } },
    test(ctx) {
      return ctx.evaluation.shape[suitIndex]! >= min;
    },
    describe(ctx) {
      const len = ctx.evaluation.shape[suitIndex]!;
      return len >= min
        ? `${len} ${suitName} (${min}+ required)`
        : `Need ${min}+ ${suitName} (have ${len})`;
    },
  };
}

/** Fewer than `threshold` cards in a specific suit (strict less-than). */
export function suitBelow(
  suitIndex: number,
  suitName: string,
  threshold: number,
): HandCondition {
  return {
    name: `${suitName}-below`,
    label: `Fewer than ${threshold} ${suitName}`,
    category: "hand",
    inference: {
      type: "suit-max",
      params: { suitIndex, suitName, max: threshold - 1 },
    },
    test(ctx) {
      return ctx.evaluation.shape[suitIndex]! < threshold;
    },
    describe(ctx) {
      const len = ctx.evaluation.shape[suitIndex]!;
      return len < threshold
        ? `${len} ${suitName} (fewer than ${threshold})`
        : `Need fewer than ${threshold} ${suitName} (have ${len})`;
    },
  };
}

/** At least one of the given suits has min+ cards. */
export function anySuitMin(
  suits: { index: number; name: string }[],
  min: number,
): HandCondition {
  const suitNames = suits.map((s) => s.name).join("/");
  return {
    name: `any-${suitNames}-min`,
    label: `${min}+ in ${suitNames}`,
    category: "hand",
    test(ctx) {
      return suits.some((s) => ctx.evaluation.shape[s.index]! >= min);
    },
    describe(ctx) {
      const found = suits.find((s) => ctx.evaluation.shape[s.index]! >= min);
      if (found) {
        const len = ctx.evaluation.shape[found.index]!;
        return `${len} ${found.name} (${min}+ in ${suitNames})`;
      }
      const counts = suits
        .map((s) => `${ctx.evaluation.shape[s.index]!} ${s.name}`)
        .join(", ");
      return `Need ${min}+ in ${suitNames} (have ${counts})`;
    },
  };
}

// ─── Shape condition factories ───────────────────────────────

/** Hand has no void (no suit with 0 cards). */
export function noVoid(): HandCondition {
  return {
    name: "no-void",
    label: "No void suit",
    category: "hand",
    test(ctx) {
      return !ctx.evaluation.shape.some((s) => s === 0);
    },
    describe(ctx) {
      const hasVoid = ctx.evaluation.shape.some((s) => s === 0);
      return hasVoid
        ? `Need no void (have ${ctx.evaluation.shape.join("-")})`
        : `No void suit (${ctx.evaluation.shape.join("-")})`;
    },
  };
}

/** Balanced hand: no void, no singleton, at most one doubleton.
 *  negatable: false because NOT balanced ≠ unbalanced (could be semi-balanced). */
export function isBalanced(): HandCondition {
  return {
    name: "balanced",
    label: "Balanced hand",
    category: "hand",
    negatable: false,
    inference: { type: "balanced", params: { balanced: true } },
    test(ctx) {
      const shape = ctx.evaluation.shape;
      const hasVoid = shape.some((s) => s === 0);
      const hasSingleton = shape.some((s) => s === 1);
      const doubletonCount = shape.filter((s) => s === 2).length;
      return !hasVoid && !hasSingleton && doubletonCount <= 1;
    },
    describe(ctx) {
      const shape = ctx.evaluation.shape;
      const hasVoid = shape.some((s) => s === 0);
      const hasSingleton = shape.some((s) => s === 1);
      const doubletonCount = shape.filter((s) => s === 2).length;
      if (!hasVoid && !hasSingleton && doubletonCount <= 1) {
        return `Balanced hand (${shape.join("-")})`;
      }
      if (hasVoid) return `Need balanced hand (have void, ${shape.join("-")})`;
      if (hasSingleton)
        return `Need balanced hand (have singleton, ${shape.join("-")})`;
      return `Need balanced hand (have ${doubletonCount} doubletons, ${shape.join("-")})`;
    },
  };
}

/** Has singleton or void in any suit (shortage for splinter bids). */
export function hasShortage(): HandCondition {
  const suitNames = ["spades", "hearts", "diamonds", "clubs"];
  return {
    name: "has-shortage",
    label: "Has singleton or void",
    category: "hand",
    inference: { type: "balanced", params: { balanced: false } },
    test(ctx) {
      return ctx.evaluation.shape.some((s) => s <= 1);
    },
    describe(ctx) {
      const shape = ctx.evaluation.shape;
      const shorts = shape
        .map((s, i) => (s <= 1 ? `${s} ${suitNames[i]}` : null))
        .filter(Boolean);
      if (shorts.length > 0) {
        return `Has shortage: ${shorts.join(", ")} (${shape.join("-")})`;
      }
      return `Need singleton or void (have ${shape.join("-")})`;
    },
  };
}

/** No 5-card major. */
export function noFiveCardMajor(): HandCondition {
  return {
    name: "no-5-card-major",
    label: "No 5-card major",
    category: "hand",
    test(ctx) {
      return ctx.evaluation.shape[0]! < 5 && ctx.evaluation.shape[1]! < 5;
    },
    describe(ctx) {
      const spades = ctx.evaluation.shape[0]!;
      const hearts = ctx.evaluation.shape[1]!;
      if (spades < 5 && hearts < 5) {
        return `No 5-card major (${spades} spades, ${hearts} hearts)`;
      }
      if (spades >= 5) return `Need no 5-card major (have ${spades} spades)`;
      return `Need no 5-card major (have ${hearts} hearts)`;
    },
  };
}

/** Hand has 5+ cards in the longer major, and that major is the specified one. */
export function longerMajor(
  suitIndex: number,
  suitName: string,
): HandCondition {
  return {
    name: `longer-major-${suitName}`,
    label: `5+ ${suitName} (longer/equal major)`,
    category: "hand",
    inference: { type: "suit-min", params: { suitIndex, suitName, min: 5 } },
    test(ctx) {
      const thisLen = ctx.evaluation.shape[suitIndex]!;
      // suitIndex 0=spades, 1=hearts; the other major
      const otherIndex = suitIndex === 0 ? 1 : 0;
      const otherLen = ctx.evaluation.shape[otherIndex]!;
      return thisLen >= 5 && thisLen >= otherLen;
    },
    describe(ctx) {
      const thisLen = ctx.evaluation.shape[suitIndex]!;
      const otherIndex = suitIndex === 0 ? 1 : 0;
      const otherName = suitIndex === 0 ? "hearts" : "spades";
      const otherLen = ctx.evaluation.shape[otherIndex]!;
      if (thisLen >= 5 && thisLen >= otherLen) {
        return `${thisLen} ${suitName} (longer/equal major vs ${otherLen} ${otherName})`;
      }
      if (thisLen < 5) return `Need 5+ ${suitName} (have ${thisLen})`;
      return `Need ${suitName} longer than ${otherName} (have ${thisLen} vs ${otherLen})`;
    },
  };
}

/** Has at least one 4-card major. */
export function hasFourCardMajor(): HandCondition {
  return {
    name: "has-4-card-major",
    label: "Has 4+ card major",
    category: "hand",
    test(ctx) {
      return ctx.evaluation.shape[0]! >= 4 || ctx.evaluation.shape[1]! >= 4;
    },
    describe(ctx) {
      const s = ctx.evaluation.shape[0]!;
      const h = ctx.evaluation.shape[1]!;
      if (s >= 4 || h >= 4) return `Has 4-card major (${s}S, ${h}H)`;
      return `Need 4+ card major (have ${s}S, ${h}H)`;
    },
  };
}

// ─── Convention-specific compound conditions ─────────────────

/**
 * Check for support in the opened major suit.
 * Reads auction to detect 1H or 1S opening.
 * @param count — number of cards required (default 4)
 * @param orMore — if true, checks count+ (>=); if false, checks exactly count (===)
 */
export function majorSupport(count: number = 4, orMore: boolean = false): HandCondition {
  const label = orMore ? `${count}+ cards in opened major` : `Exactly ${count} cards in opened major`;
  const check = orMore
    ? (len: number) => len >= count
    : (len: number) => len === count;

  return {
    name: "major-support",
    label,
    category: "hand",
    test(ctx) {
      const shape = ctx.evaluation.shape;
      if (auctionMatchesExact(ctx.auction, ["1H", "P"])) return check(shape[1]!);
      if (auctionMatchesExact(ctx.auction, ["1S", "P"])) return check(shape[0]!);
      return false;
    },
    describe(ctx) {
      const shape = ctx.evaluation.shape;
      const suffix = orMore ? `${count}+ support` : `exactly ${count}`;
      if (auctionMatchesExact(ctx.auction, ["1H", "P"])) {
        const len = shape[1]!;
        return check(len)
          ? `${len} hearts (${suffix})`
          : `Need ${suffix} hearts (have ${len})`;
      }
      if (auctionMatchesExact(ctx.auction, ["1S", "P"])) {
        const len = shape[0]!;
        return check(len)
          ? `${len} spades (${suffix})`
          : `Need ${suffix} spades (have ${len})`;
      }
      return "No major opening detected";
    },
  };
}

/**
 * Check for a single long suit (6+ in one suit, no second suit 4+).
 * Excludes spades (use 2S natural instead).
 */
export function hasSingleLongSuit(): HandCondition {
  const suitNames = ["spades", "hearts", "diamonds", "clubs"];
  return {
    name: "single-long-suit",
    label: "Single long suit (6+, non-spades)",
    category: "hand",
    test(ctx) {
      const shape = ctx.evaluation.shape;
      const spades = shape[0]!;
      const hearts = shape[1]!;
      const diamonds = shape[2]!;
      const clubs = shape[3]!;
      if (spades >= 6) return false; // Use 2S instead
      const hasSingleLong = hearts >= 6 || diamonds >= 6 || clubs >= 6;
      const hasSecond4 =
        [spades, hearts, diamonds, clubs].filter((n) => n >= 4).length > 1;
      return hasSingleLong && !hasSecond4;
    },
    describe(ctx) {
      const shape = ctx.evaluation.shape;
      const longest = Math.max(...shape);
      const longestIdx = shape.indexOf(longest);
      const suitName = suitNames[longestIdx] ?? "unknown";
      // Inline the test logic to avoid this-binding fragility
      const spades = shape[0]!;
      const hearts = shape[1]!;
      const diamonds = shape[2]!;
      const clubs = shape[3]!;
      if (
        spades < 6 &&
        (hearts >= 6 || diamonds >= 6 || clubs >= 6) &&
        [spades, hearts, diamonds, clubs].filter((n) => n >= 4).length <= 1
      ) {
        return `${longest} ${suitName}, single-suited`;
      }
      const foursPlus = [spades, hearts, diamonds, clubs].filter(
        (n) => n >= 4,
      ).length;
      if (spades >= 6) return `Need non-spade long suit (have ${spades} spades)`;
      if (foursPlus > 1) return `Need single-suited hand (have two 4+ card suits)`;
      return `Need 6+ card suit (have ${longest} as longest)`;
    },
  };
}

/**
 * Check for two-suited hand (5+ in longest, 4+ in second).
 */
export function isTwoSuited(minLong: number, minShort: number): HandCondition {
  const suitNames = ["spades", "hearts", "diamonds", "clubs"];
  return {
    name: "two-suited",
    label: `Two-suited (${minLong}-${minShort}+)`,
    category: "hand",
    inference: { type: "two-suited", params: { minLong, minShort } },
    test(ctx) {
      const sorted = [...ctx.evaluation.shape].sort((a, b) => b - a);
      return sorted[0]! >= minLong && sorted[1]! >= minShort;
    },
    describe(ctx) {
      const shape = ctx.evaluation.shape;
      const sorted = [...shape].sort((a, b) => b - a);
      if (sorted[0]! >= minLong && sorted[1]! >= minShort) {
        // Find the two longest suits
        const indexed = shape.map((len, i) => ({ len, name: suitNames[i]! }));
        indexed.sort((a, b) => b.len - a.len);
        return `${indexed[0]!.len} ${indexed[0]!.name} + ${indexed[1]!.len} ${indexed[1]!.name} (${minLong}-${minShort}+ two-suited)`;
      }
      return `Need ${minLong}-${minShort}+ two-suited (have longest: ${sorted[0]}, second: ${sorted[1]})`;
    },
  };
}

// ─── SAYC-extracted condition factories ──────────────────────

/** N+ cards in partner's opened major. Resolves partner's strain from auction. */
export function majorSupportN(n: number): HandCondition {
  return {
    name: `major-support-${n}`,
    label: `${n}+ in partner's opened major`,
    category: "hand",
    // Dynamic suit inference — suitIndex resolved at runtime from partner's opening.
    // Omitting .inference until Phase 2c wires dynamic-suit support to the inference engine.
    test(ctx) {
      const strain = partnerOpeningStrain(ctx);
      if (strain === BidSuit.Hearts) return ctx.evaluation.shape[1]! >= n;
      if (strain === BidSuit.Spades) return ctx.evaluation.shape[0]! >= n;
      return false;
    },
    describe(ctx) {
      const strain = partnerOpeningStrain(ctx);
      if (strain === BidSuit.Hearts) {
        const len = ctx.evaluation.shape[1]!;
        return len >= n ? `${len} hearts (${n}+ support)` : `Need ${n}+ hearts (have ${len})`;
      }
      if (strain === BidSuit.Spades) {
        const len = ctx.evaluation.shape[0]!;
        return len >= n ? `${len} spades (${n}+ support)` : `Need ${n}+ spades (have ${len})`;
      }
      return "Partner did not open a major";
    },
  };
}

/** Partner raised our major suit. Pure auction check + hand check. */
export function partnerRaisedOurMajor(): HandCondition {
  return {
    name: "partner-raised-our-major",
    label: "Partner raised our major suit",
    category: "hand",
    test(ctx) {
      const ourStrain = seatFirstBidStrain(ctx);
      if (ourStrain !== BidSuit.Hearts && ourStrain !== BidSuit.Spades) return false;
      return partnerRaisedOurSuit(ctx);
    },
    describe(ctx) {
      const ourStrain = seatFirstBidStrain(ctx);
      if (ourStrain && partnerRaisedOurSuit(ctx))
        return `Partner raised our ${ourStrain}`;
      return "Partner did not raise our major";
    },
  };
}

/** Check if partner's last bid is the same strain this seat opened. */
function partnerRaisedOurSuit(ctx: BiddingContext): boolean {
  const ourStrain = seatFirstBidStrain(ctx);
  if (!ourStrain) return false;
  const partner = partnerSeat(ctx.seat);
  for (let i = ctx.auction.entries.length - 1; i >= 0; i--) {
    const entry = ctx.auction.entries[i]!;
    if (entry.call.type === "bid" && entry.seat === partner) {
      return entry.call.strain === ourStrain;
    }
  }
  return false;
}

/** Partner responded H/S + this seat has 4+ in that suit. */
export function partnerRespondedMajorWithSupport(): HandCondition {
  return {
    name: "partner-responded-major-with-support",
    label: "4+ support for partner's major response",
    category: "hand",
    test(ctx) {
      const partnerMajor = partnerRespondedMajor(ctx);
      if (!partnerMajor) return false;
      if (partnerMajor === BidSuit.Hearts) return ctx.evaluation.shape[1]! >= 4;
      return ctx.evaluation.shape[0]! >= 4;
    },
    describe(ctx) {
      const partnerMajor = partnerRespondedMajor(ctx);
      if (!partnerMajor) return "Partner did not respond with a major";
      const idx = partnerMajor === BidSuit.Hearts ? 1 : 0;
      const len = ctx.evaluation.shape[idx]!;
      return len >= 4
        ? `${len} ${partnerMajor} (4+ support for partner's response)`
        : `Need 4+ ${partnerMajor} (have ${len})`;
    },
  };
}

/** 6+ cards in the suit this seat opened. */
export function sixPlusInOpenedSuit(): HandCondition {
  return {
    name: "6-plus-in-opened-suit",
    label: "6+ cards in opened suit",
    category: "hand",
    test(ctx) {
      const ourStrain = seatFirstBidStrain(ctx);
      if (!ourStrain) return false;
      const suitIdx = [BidSuit.Spades, BidSuit.Hearts, BidSuit.Diamonds, BidSuit.Clubs]
        .indexOf(ourStrain);
      return suitIdx >= 0 && ctx.evaluation.shape[suitIdx]! >= 6;
    },
    describe(ctx) {
      const ourStrain = seatFirstBidStrain(ctx);
      if (!ourStrain) return "No previous bid";
      const suitIdx = [BidSuit.Spades, BidSuit.Hearts, BidSuit.Diamonds, BidSuit.Clubs]
        .indexOf(ourStrain);
      if (suitIdx < 0) return "Not a suit bid";
      const len = ctx.evaluation.shape[suitIdx]!;
      return len >= 6
        ? `${len} ${ourStrain} (rebiddable)`
        : `Need 6+ ${ourStrain} (have ${len})`;
    },
  };
}

/** Check if hand has N+ top honors (A, K, Q) in a specific suit. Pure hand evaluation. */
export function suitQuality(suitIndex: number, suitName: string, minTopHonors: number): HandCondition {
  const SUIT_MAP = [Suit.Spades, Suit.Hearts, Suit.Diamonds, Suit.Clubs] as const;
  const TOP_HONORS: readonly Rank[] = [Rank.Ace, Rank.King, Rank.Queen];
  return {
    name: "suit-quality",
    label: `${minTopHonors}+ top honors in ${suitName}`,
    category: "hand",
    test(ctx) {
      const targetSuit = SUIT_MAP[suitIndex];
      if (!targetSuit) return false;
      let count = 0;
      for (const card of ctx.hand.cards) {
        if (card.suit === targetSuit && TOP_HONORS.includes(card.rank)) {
          count++;
        }
      }
      return count >= minTopHonors;
    },
    describe(ctx) {
      const targetSuit = SUIT_MAP[suitIndex];
      if (!targetSuit) return `Invalid suit index ${suitIndex}`;
      let count = 0;
      for (const card of ctx.hand.cards) {
        if (card.suit === targetSuit && TOP_HONORS.includes(card.rank)) {
          count++;
        }
      }
      return count >= minTopHonors
        ? `${count} top honors in ${suitName} (${minTopHonors}+ required)`
        : `Need ${minTopHonors}+ top honors in ${suitName} (have ${count})`;
    },
  };
}

/** Has a 5+ card suit legally biddable at given level. */
export function goodSuitAtLevel(level: number): HandCondition {
  return {
    name: `good-5-card-suit-at-${level}`,
    label: `5+ card suit biddable at ${level}-level`,
    category: "hand",
    test(ctx) {
      const lb = lastBid(ctx);
      if (!lb) return false;
      const suitStrains: BidSuit[] = [
        BidSuit.Spades,
        BidSuit.Hearts,
        BidSuit.Diamonds,
        BidSuit.Clubs,
      ];
      for (let i = 0; i < 4; i++) {
        if (
          ctx.evaluation.shape[i]! >= 5 &&
          bidIsHigher(level, suitStrains[i]!, lb)
        ) {
          return true;
        }
      }
      return false;
    },
    describe(ctx) {
      const longest = Math.max(...ctx.evaluation.shape);
      return longest >= 5
        ? `Has ${longest}-card suit for ${level}-level overcall`
        : `Need 5+ card suit (have ${longest} as longest)`;
    },
  };
}
