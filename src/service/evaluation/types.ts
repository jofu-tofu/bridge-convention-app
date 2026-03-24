// ── Evaluation result types ──────────────────────────────────────────
//
// Every type exported here is composed ONLY from viewport types +
// basic engine types (Seat, Vulnerability, Call).  No strategy,
// teaching, or convention internals leak through these interfaces.
//
// This is the type-level enforcement of the viewport boundary.

import type { BiddingViewport, ViewportBidFeedback, TeachingDetail } from "../response-types";
import type { BidGrade } from "../../core/contracts/teaching-grading";

// ── Atom evaluation (Phase 1) ───────────────────────────────────────

export interface AtomGradeResult {
  readonly viewport: BiddingViewport;
  readonly grade: BidGrade;
  readonly correct: boolean;
  readonly acceptable: boolean;
  readonly skip: boolean;
  readonly yourBid?: string;
  readonly correctBid?: string;
  readonly feedback: ViewportBidFeedback | null;
  readonly teaching: TeachingDetail | null;
}

// ── Playthrough evaluation (Phase 2) ────────────────────────────────

/** Opaque handle for a playthrough. Consumers get steps as BiddingViewports. */
export interface PlaythroughHandle {
  readonly seed: number;
  readonly totalUserSteps: number;
  readonly atomsCovered: readonly string[];
}

export interface PlaythroughGradeResult {
  readonly step: BiddingViewport;
  readonly grade: string;
  readonly correct: boolean;
  readonly acceptable: boolean;
  readonly feedback: ViewportBidFeedback;
  readonly teaching: TeachingDetail;
  readonly nextStep: BiddingViewport | null;
  readonly complete: boolean;
  readonly yourBid: string;
}

/** Reveal-mode step: internal metadata exposed only for orchestrator diagnostics. */
export interface RevealStep {
  readonly stepIndex: number;
  readonly seat: string;
  readonly stateId: string | null;
  readonly atomId: string | null;
  readonly meaningLabel: string | null;
  readonly auctionSoFar: readonly { seat: string; call: string }[];
  readonly recommendation: string;
  readonly isUserStep: boolean;
}

