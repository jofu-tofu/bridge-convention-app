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

// ─── conditionedRule factory ─────────────────────────────────

/**
 * Build a ConditionedBiddingRule from named conditions.
 * matches() is auto-derived: all conditions must pass.
 * explanation is empty — use buildExplanation() at evaluation time.
 */
export function conditionedRule(config: {
  readonly name: string;
  readonly conditions: RuleCondition[];
  readonly call: (context: BiddingContext) => Call;
}): ConditionedBiddingRule {
  return {
    name: config.name,
    explanation: "",
    conditions: config.conditions,
    matches(ctx: BiddingContext): boolean {
      return config.conditions.every((c) => c.test(ctx));
    },
    call: config.call,
  };
}

// ─── Leaf condition factories ────────────────────────────────

/** Match auction entries exactly against a pattern. */
export function auctionMatches(pattern: string[]): RuleCondition {
  const label = pattern.join(" — ");
  return {
    name: "auction",
    test(ctx) {
      return auctionMatchesExact(ctx.auction, pattern);
    },
    describe(ctx) {
      return auctionMatchesExact(ctx.auction, pattern)
        ? `After ${label}`
        : `Auction does not match ${label}`;
    },
  };
}

/** Match auction against any of several patterns. */
export function auctionMatchesAny(patterns: string[][]): RuleCondition {
  const labels = patterns.map((p) => p.join(" — ")).join(" or ");
  return {
    name: "auction",
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
  const label = counts.join(" or ");
  return {
    name: "ace-count-any",
    test(ctx) {
      return counts.includes(countAcesInHand(ctx.hand));
    },
    describe(ctx) {
      const aces = countAcesInHand(ctx.hand);
      return counts.includes(aces)
        ? `${aces} ace${aces !== 1 ? "s" : ""} (${label})`
        : `${aces} ace${aces !== 1 ? "s" : ""} (need ${label})`;
    },
  };
}

// ─── Combinator factories ────────────────────────────────────

/** Invert a condition. */
export function not(cond: RuleCondition): RuleCondition {
  return {
    name: `not-${cond.name}`,
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
  const label = strain ? `partner opened ${strain}` : "partner opened";
  return {
    name: label,
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

/** Check if partner bid a specific suit at any point. */
export function partnerBidSuit(suit: BidSuit): RuleCondition {
  return {
    name: `partner-bid-${suit}`,
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
    test(ctx) {
      return ctx.auction.entries.every((e) => e.call.type !== "bid");
    },
    describe(ctx) {
      const hasBid = ctx.auction.entries.some((e) => e.call.type === "bid");
      return hasBid ? "Prior contract bid exists" : "No prior contract bids";
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
export function gerberSignoffCondition(): RuleCondition {
  return {
    name: "gerber-signoff",
    test(ctx) {
      // Match after 1NT-P-4C-P-{4D|4H|4S|4NT}-P (responder's turn)
      const after4D = auctionMatchesExact(ctx.auction, [
        "1NT",
        "P",
        "4C",
        "P",
        "4D",
        "P",
      ]);
      const after4H = auctionMatchesExact(ctx.auction, [
        "1NT",
        "P",
        "4C",
        "P",
        "4H",
        "P",
      ]);
      const after4S = auctionMatchesExact(ctx.auction, [
        "1NT",
        "P",
        "4C",
        "P",
        "4S",
        "P",
      ]);
      const after4NT = auctionMatchesExact(ctx.auction, [
        "1NT",
        "P",
        "4C",
        "P",
        "4NT",
        "P",
      ]);
      return after4D || after4H || after4S || after4NT;
    },
    describe(ctx) {
      // Inline the position check to avoid this-binding fragility
      const after4D = auctionMatchesExact(ctx.auction, [
        "1NT",
        "P",
        "4C",
        "P",
        "4D",
        "P",
      ]);
      const after4H = auctionMatchesExact(ctx.auction, [
        "1NT",
        "P",
        "4C",
        "P",
        "4H",
        "P",
      ]);
      const after4S = auctionMatchesExact(ctx.auction, [
        "1NT",
        "P",
        "4C",
        "P",
        "4S",
        "P",
      ]);
      const after4NT = auctionMatchesExact(ctx.auction, [
        "1NT",
        "P",
        "4C",
        "P",
        "4NT",
        "P",
      ]);
      if (!(after4D || after4H || after4S || after4NT))
        return "Not in Gerber signoff position";
      const responderAces = countAcesInHand(ctx.hand);
      const openerAces = inferOpenerAcesFromAuction(ctx);
      const total = responderAces + openerAces;
      return `Total ${total} aces (${responderAces} yours + ${openerAces} opener's)`;
    },
  };
}

// Internal helper — same logic as gerber.ts inferOpenerAces
function inferOpenerAcesFromAuction(ctx: BiddingContext): number {
  // index 4 = 5th call in auction: 1NT-P-4C-P-{response}
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

// ─── DONT-specific conditions ────────────────────────────────

/** Both majors: hearts 5+ & spades 4+, or spades 5+ & hearts 4+. */
export function bothMajors(): RuleCondition {
  return or(
    and(suitMin(1, "hearts", 5), suitMin(0, "spades", 4)),
    and(suitMin(0, "spades", 5), suitMin(1, "hearts", 4)),
  );
}

/** Diamonds + a 4-card major. */
export function diamondsPlusMajor(): RuleCondition {
  return and(
    suitMin(2, "diamonds", 5),
    anySuitMin(
      [
        { index: 0, name: "spades" },
        { index: 1, name: "hearts" },
      ],
      4,
    ),
  );
}

/** Clubs + a higher-ranking suit. */
export function clubsPlusHigher(): RuleCondition {
  return and(
    suitMin(3, "clubs", 5),
    anySuitMin(
      [
        { index: 2, name: "diamonds" },
        { index: 1, name: "hearts" },
        { index: 0, name: "spades" },
      ],
      4,
    ),
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
