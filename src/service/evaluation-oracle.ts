// ── Evaluation Oracle ────────────────────────────────────────────────
//
// The "answer key" — everything the engine knows about the correct bid.
// NEVER exposed to the player or CLI agent.  Used only for:
//   1. Grading the player's bid
//   2. Post-mortem diagnostics (after the session ends)
//   3. Aggregate reporting (accuracy metrics)

import type { Call, Hand, Seat } from "../engine/types";
import type { BidResult, BidAlert } from "../strategy/bidding/bidding-types";
import type { TeachingResolution } from "../conventions/teaching/teaching-types";
import type { TeachingProjection } from "../conventions/teaching/teaching-types";
import type { StrategyEvaluation } from "../conventions";

/** The answer key for a single bidding decision point. */
export interface EvaluationOracle {
  // ── Full deal (NEVER shown to player) ─────────────────────────
  readonly allHands: Record<Seat, Hand>;

  // ── Expected answer ───────────────────────────────────────────
  readonly expectedCall: Call;
  readonly expectedSurfaceId?: string;
  readonly expectedAlert?: BidAlert | null;

  // ── Grading infrastructure ────────────────────────────────────
  readonly teachingResolution: TeachingResolution;

  // ── Full diagnostic data ──────────────────────────────────────
  readonly bidResult: BidResult;
  readonly strategyEvaluation?: StrategyEvaluation;
  readonly teachingProjection?: TeachingProjection;
}

/** Result of grading a player's bid against the oracle. */
export interface OracleGradingResult {
  readonly grade: "correct" | "correct-not-preferred" | "acceptable" | "near-miss" | "incorrect";
  readonly userCall: Call;
  readonly expectedCall: Call;
  /** Whether the player needs to retry (near-miss or incorrect). */
  readonly requiresRetry: boolean;
}
