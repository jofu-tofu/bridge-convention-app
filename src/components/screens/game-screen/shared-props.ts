import type { DDSolution } from "../../../engine/types";

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
