import type { BiddingContext, RuleCondition } from "../types";
import type { Hand } from "../../../engine/types";
import { Rank, BidSuit } from "../../../engine/types";
import { partnerSeat } from "../../../engine/constants";
import { auctionMatchesExact } from "../../../engine/auction-helpers";
import { and, or } from "./rule-builders";
import {
  partnerOpeningStrain,
  seatFirstBidStrain,
  partnerRespondedMajor,
  lastBid,
  bidIsHigher,
} from "./auction-conditions";

// ─── Counting helpers ────────────────────────────────────────

/** Count aces in a hand. Canonical implementation — re-exported by gerber.ts as countAces. */
export function countAcesInHand(hand: Hand): number {
  let count = 0;
  for (const card of hand.cards) {
    if (card.rank === Rank.Ace) count++;
  }
  return count;
}

/** Count kings in a hand. Canonical implementation — re-exported by gerber.ts as countKings. */
export function countKingsInHand(hand: Hand): number {
  let count = 0;
  for (const card of hand.cards) {
    if (card.rank === Rank.King) count++;
  }
  return count;
}

// ─── HCP condition factories ─────────────────────────────────

/** Minimum HCP check. */
export function hcpMin(min: number): RuleCondition {
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
        : `Only ${hcp} HCP (need ${min}+)`;
    },
  };
}

/** Maximum HCP check. */
export function hcpMax(max: number): RuleCondition {
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
        : `${hcp} HCP (${max} max exceeded)`;
    },
  };
}

/** HCP range check (inclusive). */
export function hcpRange(min: number, max: number): RuleCondition {
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
        : `${hcp} HCP (need ${min}–${max})`;
    },
  };
}

// ─── Suit length condition factories ─────────────────────────

/** Minimum length in a specific suit. suitIndex: [0]=S, [1]=H, [2]=D, [3]=C. */
export function suitMin(
  suitIndex: number,
  suitName: string,
  min: number,
): RuleCondition {
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
        : `Only ${len} ${suitName} (need ${min}+)`;
    },
  };
}

/** Fewer than `threshold` cards in a specific suit (strict less-than). */
export function suitBelow(
  suitIndex: number,
  suitName: string,
  threshold: number,
): RuleCondition {
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
        : `${len} ${suitName} (need fewer than ${threshold})`;
    },
  };
}

/** At least one of the given suits has min+ cards. */
export function anySuitMin(
  suits: { index: number; name: string }[],
  min: number,
): RuleCondition {
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
      return `Only ${counts} (need ${min}+ in ${suitNames})`;
    },
  };
}

// ─── Counting condition factories ────────────────────────────

/** Exact ace count. */
export function aceCount(count: number): RuleCondition {
  return {
    name: "ace-count",
    label: `Exactly ${count} ace${count !== 1 ? "s" : ""}`,
    category: "hand",
    inference: { type: "ace-count", params: { count } },
    test(ctx) {
      return countAcesInHand(ctx.hand) === count;
    },
    describe(ctx) {
      const aces = countAcesInHand(ctx.hand);
      return aces === count
        ? `${aces} ace${aces !== 1 ? "s" : ""}`
        : `${aces} ace${aces !== 1 ? "s" : ""} (need exactly ${count})`;
    },
  };
}

/** Ace count matches any of the given counts. */
export function aceCountAny(counts: number[]): RuleCondition {
  const countsLabel = counts.join(" or ");
  return {
    name: "ace-count-any",
    label: `${countsLabel} aces`,
    category: "hand",
    test(ctx) {
      return counts.includes(countAcesInHand(ctx.hand));
    },
    describe(ctx) {
      const aces = countAcesInHand(ctx.hand);
      return counts.includes(aces)
        ? `${aces} ace${aces !== 1 ? "s" : ""} (${countsLabel})`
        : `${aces} ace${aces !== 1 ? "s" : ""} (need ${countsLabel})`;
    },
  };
}

/** Exact king count. */
export function kingCount(count: number): RuleCondition {
  return {
    name: "king-count",
    label: `Exactly ${count} king${count !== 1 ? "s" : ""}`,
    category: "hand",
    inference: { type: "king-count", params: { count } },
    test(ctx) {
      return countKingsInHand(ctx.hand) === count;
    },
    describe(ctx) {
      const kings = countKingsInHand(ctx.hand);
      return kings === count
        ? `${kings} king${kings !== 1 ? "s" : ""}`
        : `${kings} king${kings !== 1 ? "s" : ""} (need exactly ${count})`;
    },
  };
}

/** King count matches any of the given counts. */
export function kingCountAny(counts: number[]): RuleCondition {
  const countsLabel = counts.join(" or ");
  return {
    name: "king-count-any",
    label: `${countsLabel} kings`,
    category: "hand",
    test(ctx) {
      return counts.includes(countKingsInHand(ctx.hand));
    },
    describe(ctx) {
      const kings = countKingsInHand(ctx.hand);
      return counts.includes(kings)
        ? `${kings} king${kings !== 1 ? "s" : ""} (${countsLabel})`
        : `${kings} king${kings !== 1 ? "s" : ""} (need ${countsLabel})`;
    },
  };
}

// ─── Shape condition factories ───────────────────────────────

/** Hand has no void (no suit with 0 cards). */
export function noVoid(): RuleCondition {
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
        ? `Has void (${ctx.evaluation.shape.join("-")})`
        : `No void suit (${ctx.evaluation.shape.join("-")})`;
    },
  };
}

/** Hand has no void (no suit with 0 cards). */
export function isBalanced(): RuleCondition {
  return {
    name: "balanced",
    label: "Balanced hand",
    category: "hand",
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
      if (hasVoid) return `Unbalanced — has void (${shape.join("-")})`;
      if (hasSingleton)
        return `Unbalanced — has singleton (${shape.join("-")})`;
      return `Unbalanced — ${doubletonCount} doubletons (${shape.join("-")})`;
    },
  };
}

/** Has singleton or void in any suit (shortage for splinter bids). */
export function hasShortage(): RuleCondition {
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
      return `No shortage (${shape.join("-")})`;
    },
  };
}

/** No 5-card major. */
export function noFiveCardMajor(): RuleCondition {
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
      if (spades >= 5) return `Has 5+ spades (${spades})`;
      return `Has 5+ hearts (${hearts})`;
    },
  };
}

/** Hand has 5+ cards in the longer major, and that major is the specified one. */
export function longerMajor(
  suitIndex: number,
  suitName: string,
): RuleCondition {
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
      if (thisLen < 5) return `Only ${thisLen} ${suitName} (need 5+)`;
      return `${thisLen} ${suitName} shorter than ${otherLen} ${otherName}`;
    },
  };
}

/** Has at least one 4-card major. */
export function hasFourCardMajor(): RuleCondition {
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
      return `No 4-card major (${s}S, ${h}H)`;
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
export function majorSupport(count: number = 4, orMore: boolean = false): RuleCondition {
  const label = orMore ? `${count}+ cards in opened major` : `Exactly ${count} cards in opened major`;
  const check = orMore
    ? (len: number) => len >= count
    : (len: number) => len === count;

  return {
    name: "major-support",
    label,
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
          : `${len} hearts (need ${suffix})`;
      }
      if (auctionMatchesExact(ctx.auction, ["1S", "P"])) {
        const len = shape[0]!;
        return check(len)
          ? `${len} spades (${suffix})`
          : `${len} spades (need ${suffix})`;
      }
      return "No major opening detected";
    },
  };
}

/**
 * Check for a single long suit (6+ in one suit, no second suit 4+).
 * Excludes spades (use 2S natural instead).
 */
export function hasSingleLongSuit(): RuleCondition {
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
      if (spades >= 6) return `${spades} spades (use 2S natural instead)`;
      if (foursPlus > 1) return `Two suits with 4+ cards (not single-suited)`;
      return `Longest suit only ${longest} (need 6+ single-suited)`;
    },
  };
}

/**
 * Check for two-suited hand (5+ in longest, 4+ in second).
 */
export function isTwoSuited(minLong: number, minShort: number): RuleCondition {
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
      return `Not ${minLong}-${minShort}+ two-suited (longest: ${sorted[0]}, second: ${sorted[1]})`;
    },
  };
}

// ─── Gerber-specific compound conditions ─────────────────────

/** Build all Gerber ace-response auction patterns for both 1NT and 2NT openings. */
function gerberAceResponsePatterns(): string[][] {
  const openings = ["1NT", "2NT"];
  const aceResponses = ["4D", "4H", "4S", "4NT"];
  const patterns: string[][] = [];
  for (const opening of openings) {
    for (const resp of aceResponses) {
      patterns.push([opening, "P", "4C", "P", resp, "P"]);
    }
  }
  return patterns;
}

/** Build all Gerber king-response auction patterns for both 1NT and 2NT openings. */
function gerberKingResponsePatterns(): string[][] {
  const openings = ["1NT", "2NT"];
  const aceResponses = ["4D", "4H", "4S", "4NT"];
  const kingResponses = ["5D", "5H", "5S", "5NT"];
  const patterns: string[][] = [];
  for (const opening of openings) {
    for (const aceResp of aceResponses) {
      for (const kingResp of kingResponses) {
        patterns.push([opening, "P", "4C", "P", aceResp, "P", "5C", "P", kingResp, "P"]);
      }
    }
  }
  return patterns;
}

/**
 * Gerber signoff condition — reads ace response from auction.
 */
export function gerberSignoffCondition(): RuleCondition {
  const acePatterns = gerberAceResponsePatterns();
  const kingPatterns = gerberKingResponsePatterns();
  return {
    name: "gerber-signoff",
    label: "In Gerber signoff position (after ace or king response)",
    category: "hand",
    test(ctx) {
      const afterAce = acePatterns.some((p) => auctionMatchesExact(ctx.auction, p));
      const afterKing = kingPatterns.some((p) => auctionMatchesExact(ctx.auction, p));
      return afterAce || afterKing;
    },
    describe(ctx) {
      const afterAce = acePatterns.some((p) => auctionMatchesExact(ctx.auction, p));
      const afterKing = kingPatterns.some((p) => auctionMatchesExact(ctx.auction, p));
      if (!(afterAce || afterKing))
        return "Not in Gerber signoff position";
      const responderAces = countAcesInHand(ctx.hand);
      const openerAces = inferOpenerAcesFromAuction(ctx);
      const total = responderAces + openerAces;
      if (afterKing) {
        const responderKings = countKingsInHand(ctx.hand);
        const openerKings = inferOpenerKingsFromAuction(ctx);
        const totalKings = responderKings + openerKings;
        return `Total ${total} aces, ${totalKings} kings (after king response)`;
      }
      return `Total ${total} aces (${responderAces} yours + ${openerAces} opener's)`;
    },
  };
}

/** Condition for Gerber king-ask (5C): responder's turn after ace response with 3+ total aces. */
export function gerberKingAskCondition(): RuleCondition {
  const patterns = gerberAceResponsePatterns();
  return {
    name: "gerber-king-ask",
    label: "In Gerber king-ask position (3+ total aces after ace response)",
    category: "hand",
    test(ctx) {
      const inPosition = patterns.some((p) => auctionMatchesExact(ctx.auction, p));
      if (!inPosition) return false;
      const responderAces = countAcesInHand(ctx.hand);
      const openerAces = inferOpenerAcesFromAuction(ctx);
      return responderAces + openerAces >= 3;
    },
    describe(ctx) {
      const inPosition = patterns.some((p) => auctionMatchesExact(ctx.auction, p));
      if (!inPosition) return "Not in Gerber king-ask position";
      const responderAces = countAcesInHand(ctx.hand);
      const openerAces = inferOpenerAcesFromAuction(ctx);
      const total = responderAces + openerAces;
      return total >= 3
        ? `${total} total aces (3+ needed) — ask for kings`
        : `Only ${total} total aces (need 3+ to ask for kings)`;
    },
  };
}

// Internal helper — same logic as gerber.ts inferOpenerAces
function inferOpenerAcesFromAuction(ctx: BiddingContext): number {
  // index 4 = 5th call in auction: {NT}-P-4C-P-{response}
  const responseEntry = ctx.auction.entries[4];
  if (!responseEntry || responseEntry.call.type !== "bid") return 0;
  const response = responseEntry.call;
  const responderAces = countAcesInHand(ctx.hand);

  if (response.strain === BidSuit.Diamonds && response.level === 4) {
    // 4D = 0 or 4 aces — disambiguate: if responder has 0, opener has all 4
    return responderAces === 0 ? 4 : 0;
  }
  if (response.strain === BidSuit.Hearts && response.level === 4) return 1;
  if (response.strain === BidSuit.Spades && response.level === 4) return 2;
  if (response.strain === BidSuit.NoTrump && response.level === 4) return 3;
  return 0;
}

/** Infer opener king count from king response bid.
 * 5D = 0 or 4 kings, 5H = 1, 5S = 2, 5NT = 3.
 */
function inferOpenerKingsFromAuction(ctx: BiddingContext): number {
  // index 8 = 9th call: {NT}-P-4C-P-{ace}-P-5C-P-{king response}
  const responseEntry = ctx.auction.entries[8];
  if (!responseEntry || responseEntry.call.type !== "bid") return 0;
  const response = responseEntry.call;
  const responderKings = countKingsInHand(ctx.hand);

  if (response.strain === BidSuit.Diamonds && response.level === 5) {
    // 5D = 0 or 4 kings — disambiguate: if responder has 0, opener has all 4
    return responderKings === 0 ? 4 : 0;
  }
  if (response.strain === BidSuit.Hearts && response.level === 5) return 1;
  if (response.strain === BidSuit.Spades && response.level === 5) return 2;
  if (response.strain === BidSuit.NoTrump && response.level === 5) return 3;
  return 0;
}

// ─── DONT-specific conditions ────────────────────────────────

/** Both majors: hearts 5+ & spades 4+, or spades 5+ & hearts 4+. */
export function bothMajors(): RuleCondition {
  return or(
    and(suitMin(1, "hearts", 5), suitMin(0, "spades", 4)),
    and(suitMin(0, "spades", 5), suitMin(1, "hearts", 4)),
  );
}

/** Diamonds + a major (5-4 or 4-5 distribution). */
export function diamondsPlusMajor(): RuleCondition {
  const majors = [
    { index: 0, name: "spades" },
    { index: 1, name: "hearts" },
  ];
  return or(
    and(suitMin(2, "diamonds", 5), anySuitMin(majors, 4)),
    and(suitMin(2, "diamonds", 4), anySuitMin(majors, 5)),
  );
}

/** Clubs + a higher-ranking suit (5-4 or 4-5 distribution). */
export function clubsPlusHigher(): RuleCondition {
  const higherSuits = [
    { index: 2, name: "diamonds" },
    { index: 1, name: "hearts" },
    { index: 0, name: "spades" },
  ];
  return or(
    and(suitMin(3, "clubs", 5), anySuitMin(higherSuits, 4)),
    and(suitMin(3, "clubs", 4), anySuitMin(higherSuits, 5)),
  );
}

/**
 * DONT advance: support check for partner's shown suit.
 * Different thresholds for different auction patterns.
 */
export function advanceSupportFor(
  auctionPattern: string[],
  suitIndex: number,
  suitName: string,
  minSupport: number,
): RuleCondition {
  return {
    name: `advance-support-${suitName}`,
    label: `${minSupport}+ ${suitName} support after ${auctionPattern.join(" — ")}`,
    category: "hand",
    test(ctx) {
      if (!auctionMatchesExact(ctx.auction, auctionPattern)) return false;
      return ctx.evaluation.shape[suitIndex]! >= minSupport;
    },
    describe(ctx) {
      if (!auctionMatchesExact(ctx.auction, auctionPattern)) {
        return `Not after ${auctionPattern.join(" — ")}`;
      }
      const len = ctx.evaluation.shape[suitIndex]!;
      return len >= minSupport
        ? `${len} ${suitName} (${minSupport}+ support)`
        : `Only ${len} ${suitName} (need ${minSupport}+ support)`;
    },
  };
}

/** DONT advance: lack of support triggers next-step bid. */
export function advanceLackSupport(
  auctionPattern: string[],
  suitIndex: number,
  suitName: string,
  threshold: number,
): RuleCondition {
  return {
    name: `advance-lack-${suitName}`,
    label: `Fewer than ${threshold} ${suitName} after ${auctionPattern.join(" — ")}`,
    category: "hand",
    test(ctx) {
      if (!auctionMatchesExact(ctx.auction, auctionPattern)) return false;
      return ctx.evaluation.shape[suitIndex]! < threshold;
    },
    describe(ctx) {
      if (!auctionMatchesExact(ctx.auction, auctionPattern)) {
        return `Not after ${auctionPattern.join(" — ")}`;
      }
      const len = ctx.evaluation.shape[suitIndex]!;
      return len < threshold
        ? `Only ${len} ${suitName} (under ${threshold}, ask for other suit)`
        : `${len} ${suitName} (${threshold}+ support, no need to ask)`;
    },
  };
}

// ─── SAYC-extracted condition factories ──────────────────────

/** N+ cards in partner's opened major. Resolves partner's strain from auction. */
export function majorSupportN(n: number): RuleCondition {
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
        return len >= n ? `${len} hearts (${n}+ support)` : `Only ${len} hearts`;
      }
      if (strain === BidSuit.Spades) {
        const len = ctx.evaluation.shape[0]!;
        return len >= n ? `${len} spades (${n}+ support)` : `Only ${len} spades`;
      }
      return "Partner did not open a major";
    },
  };
}

/** Partner raised our major suit. Pure auction check + hand check. */
export function partnerRaisedOurMajor(): RuleCondition {
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
export function partnerRespondedMajorWithSupport(): RuleCondition {
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
        : `Only ${len} ${partnerMajor}`;
    },
  };
}

/** 6+ cards in the suit this seat opened. */
export function sixPlusInOpenedSuit(): RuleCondition {
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
        : `Only ${len} ${ourStrain} (need 6+)`;
    },
  };
}

/** Has a 5+ card suit legally biddable at given level. */
export function goodSuitAtLevel(level: number): RuleCondition {
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
        : `No 5+ card suit`;
    },
  };
}
