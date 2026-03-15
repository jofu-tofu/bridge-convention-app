import type { BidHistoryEntry } from "../../core/contracts";

// ─── Round-by-round grouping ──────────────────────────────────

export interface RoundGroup {
  readonly roundNumber: number;
  readonly entries: readonly BidHistoryEntry[];
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
    groups.push({
      roundNumber: Math.floor(i / 4) + 1,
      entries: bidHistory.slice(i, i + 4),
    });
  }
  return groups;
}
