import type {
  BiddingContext,
  RuleCondition,
  ConditionedBiddingRule,
  ConditionResult,
  ConditionBranch,
} from "./types";
import type { Call, Hand } from "../engine/types";
import { Rank, BidSuit } from "../engine/types";
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
export function suitMin(suitIndex: number, suitName: string, min: number): RuleCondition {
  return {
    name: `${suitName}-min`,
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
export function suitBelow(suitIndex: number, suitName: string, threshold: number): RuleCondition {
  return {
    name: `${suitName}-below`,
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
export function anySuitMin(suits: { index: number; name: string }[], min: number): RuleCondition {
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
      const counts = suits.map((s) => `${ctx.evaluation.shape[s.index]!} ${s.name}`).join(", ");
      return `Only ${counts} (need ${min}+ in ${suitNames})`;
    },
  };
}

/** Exact ace count. */
export function aceCount(count: number): RuleCondition {
  return {
    name: "ace-count",
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
          results: [{
            condition: c,
            passed: c.test(ctx),
            description: c.describe(ctx),
          }],
          passed: c.test(ctx),
        };
      });
      return branches;
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
      const hasSecond4 = [spades, hearts, diamonds, clubs].filter((n) => n >= 4).length > 1;
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
      if (spades < 6 && (hearts >= 6 || diamonds >= 6 || clubs >= 6) &&
          [spades, hearts, diamonds, clubs].filter((n) => n >= 4).length <= 1) {
        return `${longest} ${suitName}, single-suited`;
      }
      const foursPlus = [spades, hearts, diamonds, clubs].filter((n) => n >= 4).length;
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
      const after4D = auctionMatchesExact(ctx.auction, ["1NT", "P", "4C", "P", "4D", "P"]);
      const after4H = auctionMatchesExact(ctx.auction, ["1NT", "P", "4C", "P", "4H", "P"]);
      const after4S = auctionMatchesExact(ctx.auction, ["1NT", "P", "4C", "P", "4S", "P"]);
      const after4NT = auctionMatchesExact(ctx.auction, ["1NT", "P", "4C", "P", "4NT", "P"]);
      return after4D || after4H || after4S || after4NT;
    },
    describe(ctx) {
      // Inline the position check to avoid this-binding fragility
      const after4D = auctionMatchesExact(ctx.auction, ["1NT", "P", "4C", "P", "4D", "P"]);
      const after4H = auctionMatchesExact(ctx.auction, ["1NT", "P", "4C", "P", "4H", "P"]);
      const after4S = auctionMatchesExact(ctx.auction, ["1NT", "P", "4C", "P", "4S", "P"]);
      const after4NT = auctionMatchesExact(ctx.auction, ["1NT", "P", "4C", "P", "4NT", "P"]);
      if (!(after4D || after4H || after4S || after4NT)) return "Not in Gerber signoff position";
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
    anySuitMin([{ index: 0, name: "spades" }, { index: 1, name: "hearts" }], 4),
  );
}

/** Clubs + a higher-ranking suit. */
export function clubsPlusHigher(): RuleCondition {
  return and(
    suitMin(3, "clubs", 5),
    anySuitMin([
      { index: 2, name: "diamonds" },
      { index: 1, name: "hearts" },
      { index: 0, name: "spades" },
    ], 4),
  );
}

/**
 * DONT advance: support check for partner's shown suit.
 * Different thresholds for different auction patterns.
 */
export function advanceSupportFor(auctionPattern: string[], suitIndex: number, suitName: string, minSupport: number): RuleCondition {
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
export function advanceLackSupport(auctionPattern: string[], suitIndex: number, suitName: string, threshold: number): RuleCondition {
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
