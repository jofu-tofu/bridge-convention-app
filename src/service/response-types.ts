/**
 * Service response types — shapes the service returns to the client.
 *
 * Only viewport-safe types cross this boundary.
 *
 * ALLOWED to cross: BiddingViewport, ViewportBidFeedback, TeachingDetail,
 *   Call, Card, Seat, Vulnerability, BidGrade, BidHistoryEntry, GamePhase,
 *   SessionHandle, session config DTOs.
 *
 * NEVER crosses: Deal, BidResult, DrillSession, DrillBundle,
 *   ConventionBiddingStrategy, StrategyEvaluation, ArbitrationResult,
 *   MeaningSurface, InferenceEngine.
 */

import type { Call, Card, Seat, DDSolution } from "../engine/types";
import type { BiddingViewport, ViewportBidFeedback, TeachingDetail } from "../core/viewport";
import type { BidHistoryEntry } from "../core/contracts";
import type { ViewportBidGrade } from "../core/viewport/player-viewport";
import type { GamePhase } from "../core/phase-machine";
import type { DebugSnapshot, DebugLogEntry } from "../stores/bidding.svelte";
import type { InferenceSnapshot } from "../inference/types";

// ── Result DTOs ─────────────────────────────────────────────────────

/** Result of starting a drill. */
export interface DrillStartResult {
  readonly viewport: BiddingViewport;
  readonly isOffConvention: boolean;
  readonly aiBids: readonly AiBidEntry[];
  /** True when the auction completed during initial AI bids (e.g., all four seats passed). */
  readonly auctionComplete: boolean;
}

/** A single AI bid entry for animation. */
export interface AiBidEntry {
  readonly seat: Seat;
  readonly call: Call;
  readonly historyEntry: BidHistoryEntry;
}

/** Result of submitting a user bid. */
export interface BidSubmitResult {
  /** False = wrong bid, retry needed. */
  readonly accepted: boolean;
  readonly feedback: ViewportBidFeedback | null;
  readonly teaching: TeachingDetail | null;
  readonly grade: ViewportBidGrade | null;
  readonly aiBids: readonly AiBidEntry[];
  readonly nextViewport: BiddingViewport | null;
  readonly phaseTransition: PhaseTransition | null;
  /** History entry for the user's accepted bid (null when rejected). */
  readonly userHistoryEntry: BidHistoryEntry | null;
}

/** Phase transition notification. */
export interface PhaseTransition {
  readonly from: GamePhase;
  readonly to: GamePhase;
}

/** Result of accepting a prompt (play/skip). */
export interface PromptAcceptResult {
  readonly phase: GamePhase;
}

/** Result of playing a card. */
export interface PlayCardResult {
  readonly accepted: boolean;
  readonly trickComplete: boolean;
  readonly playComplete: boolean;
  readonly score: number | null;
  /** AI plays that followed the user's card (for animation). */
  readonly aiPlays: readonly AiPlayEntry[];
  /** Legal plays for the next user turn (null if play complete or AI's turn). */
  readonly legalPlays: readonly Card[] | null;
  /** Current player after all processing. */
  readonly currentPlayer: Seat | null;
}

/** A single AI play entry for animation (analogous to AiBidEntry). */
export interface AiPlayEntry {
  readonly seat: Seat;
  readonly card: Card;
  readonly reason: string;
}

/** Current session viewport. */
export interface SessionViewport {
  readonly phase: GamePhase;
  readonly biddingViewport: BiddingViewport | null;
}

/** DDS solution result. */
export interface DDSolutionResult {
  readonly solution: DDSolution | null;
  readonly error: string | null;
}

/** Convention info for catalog listing. */
export interface ConventionInfo {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category?: string;
}

/** Result of grading an atom bid (stateless). */
export interface AtomGradeResult {
  readonly viewport: BiddingViewport;
  readonly feedback: ViewportBidFeedback | null;
  readonly teaching: TeachingDetail | null;
  readonly grade: ViewportBidGrade | null;
}

// ── Debug types ─────────────────────────────────────────────────────

/** Debug snapshot visible through DevServicePort. */
export interface ServiceDebugSnapshot extends DebugSnapshot {
  readonly sessionPhase: GamePhase;
}

/** Debug log visible through DevServicePort. */
export type ServiceDebugLogEntry = DebugLogEntry;

/** Inference snapshot visible through DevServicePort. */
export type ServiceInferenceSnapshot = InferenceSnapshot;
