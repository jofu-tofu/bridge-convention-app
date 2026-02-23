import type {
  BiddingContext,
  RuleCondition,
  ConditionedBiddingRule,
  ConditionResult,
  ConditionBranch,
} from "./types";
import type { Call, Hand } from "../engine/types";
import { Rank, BidSuit } from "../engine/types";
import { partnerSeat } from "../engine/constants";
import { auctionMatchesExact } from "../engine/auction-helpers";

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

// ─── conditionedRule factory ─────────────────────────────────

/**
 * Build a ConditionedBiddingRule from separate auction and hand conditions.
 * matches() is auto-derived: all conditions must pass.
 * explanation is empty — use buildExplanation() at evaluation time.
 */
export function conditionedRule(config: {
  readonly name: string;
  readonly auctionConditions: RuleCondition[];
  readonly handConditions: RuleCondition[];
  readonly call: (context: BiddingContext) => Call;
}): ConditionedBiddingRule {
  const allConditions = [...config.auctionConditions, ...config.handConditions];
  return {
    name: config.name,
    explanation: "",
    auctionConditions: config.auctionConditions,
    handConditions: config.handConditions,
    get conditions(): readonly RuleCondition[] {
      return allConditions;
    },
    matches(ctx: BiddingContext): boolean {
      return allConditions.every((c) => c.test(ctx));
    },
    call: config.call,
  };
}

// ─── Leaf condition factories ────────────────────────────────

/** Match auction entries exactly against a pattern. */
export function auctionMatches(pattern: string[]): RuleCondition {
  const patternLabel = pattern.join(" — ");
  return {
    name: "auction",
    label: `After ${patternLabel}`,
    test(ctx) {
      return auctionMatchesExact(ctx.auction, pattern);
    },
    describe(ctx) {
      return auctionMatchesExact(ctx.auction, pattern)
        ? `After ${patternLabel}`
        : `Auction does not match ${patternLabel}`;
    },
  };
}

/** Match auction against any of several patterns. */
export function auctionMatchesAny(patterns: string[][]): RuleCondition {
  const labels = patterns.map((p) => p.join(" — ")).join(" or ");
  return {
    name: "auction",
    label: `After ${labels}`,
    test(ctx) {
      return patterns.some((p) => auctionMatchesExact(ctx.auction, p));
    },
    describe(ctx) {
      const matched = patterns.find((p) => auctionMatchesExact(ctx.auction, p));
      if (matched) return `After ${matched.join(" — ")}`;
      return `Auction does not match ${labels}`;
    },
  };
}

/** Minimum HCP check. */
export function hcpMin(min: number): RuleCondition {
  return {
    name: "hcp-min",
    label: `${min}+ HCP`,
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

/** Minimum length in a specific suit. suitIndex: [0]=S, [1]=H, [2]=D, [3]=C. */
export function suitMin(
  suitIndex: number,
  suitName: string,
  min: number,
): RuleCondition {
  return {
    name: `${suitName}-min`,
    label: `${min}+ ${suitName}`,
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

/** @deprecated Use suitBelow — suitMax name was misleading (uses strict <, not <=). */
export const suitMax = suitBelow;

/** At least one of the given suits has min+ cards. */
export function anySuitMin(
  suits: { index: number; name: string }[],
  min: number,
): RuleCondition {
  const suitNames = suits.map((s) => s.name).join("/");
  return {
    name: `any-${suitNames}-min`,
    label: `${min}+ in ${suitNames}`,
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

/** Exact ace count. */
export function aceCount(count: number): RuleCondition {
  return {
    name: "ace-count",
    label: `Exactly ${count} ace${count !== 1 ? "s" : ""}`,
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

/** Hand has no void (no suit with 0 cards). */
export function noVoid(): RuleCondition {
  return {
    name: "no-void",
    label: "No void suit",
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

// ─── Combinator factories ────────────────────────────────────

/** Invert a condition. */
export function not(cond: RuleCondition): RuleCondition {
  return {
    name: `not-${cond.name}`,
    label: `Not: ${cond.label}`,
    test(ctx) {
      return !cond.test(ctx);
    },
    describe(ctx) {
      return `Not: ${cond.describe(ctx)}`;
    },
  };
}

/** All conditions must pass. */
export function and(...conds: RuleCondition[]): RuleCondition {
  return {
    name: "and",
    label: conds.map((c) => c.label).join("; "),
    test(ctx) {
      return conds.every((c) => c.test(ctx));
    },
    describe(ctx) {
      return conds.map((c) => c.describe(ctx)).join("; ");
    },
    evaluateChildren(ctx): ConditionBranch[] {
      const results: ConditionResult[] = conds.map((c) => ({
        condition: c,
        passed: c.test(ctx),
        description: c.describe(ctx),
      }));
      return [{ results, passed: results.every((r) => r.passed) }];
    },
  };
}

/**
 * Any branch must pass (at least one sub-condition group).
 * INVARIANT: Always evaluates ALL branches — short-circuiting would break
 * the UI branch-highlighting feature that shows which branch matched best.
 */
export function or(...conds: RuleCondition[]): RuleCondition {
  if (conds.length > 4) throw new Error("or() supports max 4 branches");
  return {
    name: "or",
    label: conds.map((c) => c.label).join(" or "),
    test(ctx) {
      return conds.some((c) => c.test(ctx));
    },
    describe(ctx) {
      const matched = conds.find((c) => c.test(ctx));
      if (matched) return matched.describe(ctx);
      return conds.map((c) => c.describe(ctx)).join(" or ");
    },
    evaluateChildren(ctx): ConditionBranch[] {
      // Evaluate ALL branches unconditionally
      const branches: ConditionBranch[] = conds.map((c) => {
        if (c.evaluateChildren) {
          const childBranches = c.evaluateChildren(ctx);
          // Flatten: and() returns one branch, use its results
          const results = childBranches.flatMap((b) => [...b.results]);
          return {
            results,
            passed: c.test(ctx),
          };
        }
        return {
          results: [
            {
              condition: c,
              passed: c.test(ctx),
              description: c.describe(ctx),
            },
          ],
          passed: c.test(ctx),
        };
      });
      return branches;
    },
  };
}

// ─── Relational condition factories ──────────────────────────

/** Check if this seat made the first non-pass bid in the auction. */
export function isOpener(): RuleCondition {
  return {
    name: "is-opener",
    label: "Opening bidder",
    test(ctx) {
      for (const entry of ctx.auction.entries) {
        if (entry.call.type === "bid") {
          return entry.seat === ctx.seat;
        }
      }
      // No bids yet — we could be the opener
      return true;
    },
    describe(ctx) {
      for (const entry of ctx.auction.entries) {
        if (entry.call.type === "bid") {
          return entry.seat === ctx.seat
            ? "This seat opened the bidding"
            : "This seat did not open the bidding";
        }
      }
      return "No bids yet — opening position";
    },
  };
}

/** Check if partner made the first non-pass bid (this seat is responding). */
export function isResponder(): RuleCondition {
  return {
    name: "is-responder",
    label: "Responding to partner's opening",
    test(ctx) {
      const partner = partnerSeat(ctx.seat);
      for (const entry of ctx.auction.entries) {
        if (entry.call.type === "bid") {
          return entry.seat === partner;
        }
      }
      return false;
    },
    describe(ctx) {
      const partner = partnerSeat(ctx.seat);
      for (const entry of ctx.auction.entries) {
        if (entry.call.type === "bid") {
          return entry.seat === partner
            ? "Partner opened — responding position"
            : "Partner did not open";
        }
      }
      return "No bids yet — not in responding position";
    },
  };
}

/** Check if partner opened in a specific strain, or any strain if not specified. */
export function partnerOpened(strain?: BidSuit): RuleCondition {
  const condName = strain ? `partner opened ${strain}` : "partner opened";
  return {
    name: condName,
    label: strain ? `Partner opened ${strain}` : "Partner opened",
    test(ctx) {
      const partner = partnerSeat(ctx.seat);
      for (const entry of ctx.auction.entries) {
        if (entry.call.type === "bid") {
          if (entry.seat !== partner) return false;
          if (strain) return entry.call.strain === strain;
          return true;
        }
      }
      return false;
    },
    describe(ctx) {
      const partner = partnerSeat(ctx.seat);
      for (const entry of ctx.auction.entries) {
        if (entry.call.type === "bid") {
          if (entry.seat !== partner)
            return `Partner did not open (${entry.seat} opened)`;
          if (strain && entry.call.strain !== strain) {
            return `Partner opened ${entry.call.strain}, not ${strain}`;
          }
          return `Partner opened ${entry.call.strain}`;
        }
      }
      return "No opening bid found";
    },
  };
}

/** Check if partner opened at a specific level and strain. */
export function partnerOpenedAt(level: number, strain: BidSuit): RuleCondition {
  return {
    name: `partner-opened-${level}${strain}`,
    label: `Partner opened ${level}${strain}`,
    test(ctx) {
      const partner = partnerSeat(ctx.seat);
      for (const entry of ctx.auction.entries) {
        if (entry.call.type === "bid") {
          return (
            entry.seat === partner &&
            entry.call.level === level &&
            entry.call.strain === strain
          );
        }
      }
      return false;
    },
    describe(ctx) {
      const partner = partnerSeat(ctx.seat);
      for (const entry of ctx.auction.entries) {
        if (entry.call.type === "bid") {
          if (entry.seat !== partner) return `Partner did not open`;
          if (entry.call.level !== level || entry.call.strain !== strain) {
            return `Partner opened ${entry.call.level}${entry.call.strain}, not ${level}${strain}`;
          }
          return `Partner opened ${level}${strain}`;
        }
      }
      return "No opening bid found";
    },
  };
}

/** Check if partner bid a specific suit at any point. */
export function partnerBidSuit(suit: BidSuit): RuleCondition {
  return {
    name: `partner-bid-${suit}`,
    label: `Partner bid ${suit}`,
    test(ctx) {
      const partner = partnerSeat(ctx.seat);
      return ctx.auction.entries.some(
        (e) =>
          e.seat === partner &&
          e.call.type === "bid" &&
          e.call.strain === suit,
      );
    },
    describe(ctx) {
      const partner = partnerSeat(ctx.seat);
      const found = ctx.auction.entries.find(
        (e) =>
          e.seat === partner &&
          e.call.type === "bid" &&
          e.call.strain === suit,
      );
      return found ? `Partner bid ${suit}` : `Partner has not bid ${suit}`;
    },
  };
}

/** Check if an opponent has made a contract bid. */
export function opponentBid(): RuleCondition {
  return {
    name: "opponent-bid",
    label: "Opponent has bid",
    test(ctx) {
      const partner = partnerSeat(ctx.seat);
      return ctx.auction.entries.some(
        (e) =>
          e.call.type === "bid" &&
          e.seat !== ctx.seat &&
          e.seat !== partner,
      );
    },
    describe(ctx) {
      const partner = partnerSeat(ctx.seat);
      const found = ctx.auction.entries.find(
        (e) =>
          e.call.type === "bid" &&
          e.seat !== ctx.seat &&
          e.seat !== partner,
      );
      return found ? `Opponent (${found.seat}) bid` : "No opponent bids";
    },
  };
}

/** Check if hand is balanced (no singleton/void, at most one doubleton). */
export function isBalanced(): RuleCondition {
  return {
    name: "balanced",
    label: "Balanced hand",
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

/** No 5-card major. */
export function noFiveCardMajor(): RuleCondition {
  return {
    name: "no-5-card-major",
    label: "No 5-card major",
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

/** No previous contract bid in the auction (everyone passed so far). */
export function noPriorBid(): RuleCondition {
  return {
    name: "no-prior-bid",
    label: "No prior contract bids",
    test(ctx) {
      return ctx.auction.entries.every((e) => e.call.type !== "bid");
    },
    describe(ctx) {
      const hasBid = ctx.auction.entries.some((e) => e.call.type === "bid");
      return hasBid ? "Prior contract bid exists" : "No prior contract bids";
    },
  };
}

/** This seat has made at least one contract bid in the auction. */
export function seatHasBid(): RuleCondition {
  return {
    name: "seat-has-bid",
    label: "Has previously bid",
    test(ctx) {
      return ctx.auction.entries.some(
        (e) => e.call.type === "bid" && e.seat === ctx.seat,
      );
    },
    describe(ctx) {
      const hasBid = ctx.auction.entries.some(
        (e) => e.call.type === "bid" && e.seat === ctx.seat,
      );
      return hasBid
        ? "This seat has previously bid"
        : "This seat has not bid yet";
    },
  };
}

// ─── Convention-specific compound conditions ─────────────────

/**
 * Check for 4+ support in the opened major suit.
 * Reads auction to detect 1H or 1S opening.
 */
export function majorSupport(): RuleCondition {
  return {
    name: "major-support",
    label: "4+ support in opened major",
    test(ctx) {
      const shape = ctx.evaluation.shape;
      if (auctionMatchesExact(ctx.auction, ["1H", "P"])) return shape[1]! >= 4;
      if (auctionMatchesExact(ctx.auction, ["1S", "P"])) return shape[0]! >= 4;
      return false;
    },
    describe(ctx) {
      const shape = ctx.evaluation.shape;
      if (auctionMatchesExact(ctx.auction, ["1H", "P"])) {
        const len = shape[1]!;
        return len >= 4
          ? `${len} hearts (4+ support for opened major)`
          : `Only ${len} hearts (need 4+ support)`;
      }
      if (auctionMatchesExact(ctx.auction, ["1S", "P"])) {
        const len = shape[0]!;
        return len >= 4
          ? `${len} spades (4+ support for opened major)`
          : `Only ${len} spades (need 4+ support)`;
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

/**
 * Gerber signoff condition — reads ace response from auction.
 */
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

export function gerberSignoffCondition(): RuleCondition {
  const acePatterns = gerberAceResponsePatterns();
  const kingPatterns = gerberKingResponsePatterns();
  return {
    name: "gerber-signoff",
    label: "In Gerber signoff position (after ace or king response)",
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
    return responderAces === 4 ? 0 : 4;
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
    return responderKings === 4 ? 0 : 4;
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

/** DONT advance after double: always relay 2C. */
export function advanceAfterDouble(): RuleCondition {
  return {
    name: "advance-after-double",
    label: "After partner's double, relay 2C",
    test(ctx) {
      return auctionMatchesExact(ctx.auction, ["1NT", "X", "P"]);
    },
    describe(ctx) {
      return auctionMatchesExact(ctx.auction, ["1NT", "X", "P"])
        ? "After partner's double, relay 2C to discover suit"
        : "Not after partner's double";
    },
  };
}
