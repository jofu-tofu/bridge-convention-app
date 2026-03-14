import type { ConventionConfig } from "../../conventions/core";
import type { BidHistoryEntry } from "../../core/contracts";
import type { BidResult } from "../../core/contracts";
import type { Deal, Call, Seat } from "../../engine/types";

export interface DisplayCondition {
  readonly name: string;
  readonly passed: boolean;
  readonly description: string;
}

export interface DisplayRule {
  readonly ruleName: string;
  readonly displayName: string;
  readonly call: Call | undefined;
  readonly fired: boolean;
  readonly firedBySeat: Seat | null;
  readonly conditions: DisplayCondition[];
  readonly isConditioned: boolean;
}

/**
 * Prepare convention rules for display in the Rules tab.
 * Returns empty — old tree-pipeline rule evaluation functions have been removed.
 * New meaning-pipeline conventions use a different display path.
 */
export function prepareRulesForDisplay(
  _config: ConventionConfig,
  _deal: Deal,
  _bidHistory: readonly BidHistoryEntry[],
): { firedRules: DisplayRule[]; referenceRules: DisplayRule[] } {
  return { firedRules: [], referenceRules: [] };
}

// ─── Round-by-round grouping ──────────────────────────────────

export interface RoundEntry {
  readonly seat: Seat;
  readonly call: Call;
  readonly ruleName: string | null;
  readonly meaning?: string;
  readonly handSummary?: string;
  readonly isUser: boolean;
  readonly isCorrect?: boolean;
  readonly expectedResult?: BidResult;
}

export interface RoundGroup {
  readonly roundNumber: number;
  readonly entries: readonly RoundEntry[];
}

/**
 * Group bid history entries into rounds of 4 (one full table rotation).
 * Every 4 consecutive bids form a round, regardless of dealer position.
 */
export function groupBidsByRound(
  bidHistory: readonly BidHistoryEntry[],
): RoundGroup[] {
  if (bidHistory.length === 0) return [];

  const groups: RoundGroup[] = [];
  for (let i = 0; i < bidHistory.length; i += 4) {
    const slice = bidHistory.slice(i, i + 4);
    groups.push({
      roundNumber: Math.floor(i / 4) + 1,
      entries: slice.map((e) => ({
        seat: e.seat,
        call: e.call,
        ruleName: e.ruleName,
        meaning: e.meaning,
        handSummary: e.handSummary,
        isUser: e.isUser,
        isCorrect: e.isCorrect,
        expectedResult: e.expectedResult,
      })),
    });
  }
  return groups;
}
