/**
 * Debug types for DevServicePort — separate from response-types.ts to allow
 * backend imports for properly typed debug fields.
 *
 * response-types.ts has zero backend imports (only engine vocabulary).
 * This file bridges the gap for debug/dev types that need backend detail.
 *
 * Consumers: debug drawer components, stores (for getDebugSnapshot),
 * DevServicePort interface.
 */

import type { Call, Seat } from "../engine/types";
import type { StrategyEvaluation, BidResult } from "../conventions";
import type { BidFeedbackDTO } from "../session/bid-feedback-builder";
import type { ServiceGamePhase } from "./response-types";

// ── Debug-only backend type re-exports ──────────────────────────────
//
// Debug drawer components need these deep backend types. Re-exporting
// them here (not from the main barrel) keeps the production API surface clean.

export type { EvaluatedFacts, PipelineResult, MachineDebugSnapshot } from "../conventions";

/** Debug snapshot visible through DevServicePort.
 *  Extends StrategyEvaluation with session-level debug fields. */
export interface ServiceDebugSnapshot extends StrategyEvaluation {
  readonly sessionPhase: ServiceGamePhase;
  readonly expectedBid: BidResult | null;
}

/** Debug log entry visible through DevServicePort. */
export interface ServiceDebugLogEntry {
  readonly kind: "pre-bid" | "user-bid" | "ai-bid";
  readonly turnIndex: number;
  readonly seat: Seat;
  readonly call?: Call;
  readonly snapshot: DebugSnapshotBase;
  readonly feedback: BidFeedbackDTO | null;
}

/** Base debug snapshot without sessionPhase — used in log entries
 *  where the session phase isn't relevant. */
export interface DebugSnapshotBase extends StrategyEvaluation {
  readonly expectedBid: BidResult | null;
}
