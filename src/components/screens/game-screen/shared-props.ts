import type { DDSolution, Trick, Seat, AuctionEntryView, BidHistoryEntry } from "../../../service";

/**
 * DDS analysis state — these three props always travel together
 * through ExplanationPhase → ReviewSidePanel → AnalysisPanel.
 */
export interface DDSAnalysisProps {
  ddsSolution: DDSolution | null;
  ddsSolving: boolean;
  ddsError: string | null;
}

/**
 * Trick scoring — declarer vs defender trick counts,
 * used in PlayingPhase, PlaySidePanel, and review components.
 */
export interface TrickScoreProps {
  declarerTricksWon: number;
  defenderTricksWon: number;
}

/**
 * Core play history data — tricks + context needed by PlayHistoryPanel.
 */
export interface PlayHistoryBaseProps {
  tricks: readonly Trick[];
  declarerSeat: Seat | null;
  auctionEntries?: readonly AuctionEntryView[];
  dealer?: Seat;
  bidHistory?: readonly BidHistoryEntry[];
}

/**
 * Replay interaction props — highlight, click, and progressive reveal.
 */
export interface PlayHistoryReplayProps {
  highlightTrickIndex?: number | null;
  onClickTrick?: (index: number) => void;
  visibleTrickCount?: number;
  partialTrickPlays?: number;
}
