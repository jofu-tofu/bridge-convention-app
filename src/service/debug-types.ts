/**
 * Debug types for DevServicePort — separate from response-types.ts to allow
 * backend imports for properly typed debug fields.
 *
 * response-types.ts has zero backend imports (only engine vocabulary).
 * This file bridges the gap for debug/dev types that need backend detail.
 *
 * Consumers: debug drawer components, stores, DevServicePort interface.
 */

import type { Call, Seat } from "../engine/types";
import type { BidResult, PosteriorSummary, TeachingProjection } from "./session-types";

// ── Debug-only backend types ────────────────────────────────────────
//
// TS interfaces matching Rust serde JSON output for debug drawer components.
// These cross the WASM boundary as JSON — keep in sync with Rust structs in
// bridge-conventions (adapter/strategy_evaluation, pipeline/types, fact_dsl/types)
// and bridge-session (session/bid_feedback_builder).

/** Pipeline carrier — a meaning proposal with its encoded call and traces. */
export interface PipelineCarrier {
  readonly call: Call;
  readonly proposal: {
    readonly meaningId: string;
    readonly moduleId?: string;
    readonly teachingLabel?: { readonly name: string; readonly summary?: string };
    readonly ranking?: { readonly recommendationBand: string; readonly specificity: number; readonly modulePrecedence?: number; readonly declarationOrder?: number };
    readonly clauses?: readonly { readonly factId: string; readonly operator: string; readonly satisfied: boolean; readonly description: string; readonly observedValue?: unknown; readonly value?: unknown }[];
  };
  readonly traces: {
    readonly encoding?: { readonly encoderKind: string; readonly encoderId: string; readonly chosenCall?: Call; readonly consideredCalls?: readonly Call[]; readonly blockedCalls?: readonly { readonly call: Call; readonly reason: string }[] };
    readonly legality?: { readonly legal: boolean; readonly reason?: string };
    readonly elimination?: { readonly gateId?: string; readonly reason: string };
  };
}

/** Full pipeline evaluation result. */
export interface PipelineResult {
  readonly selected: PipelineCarrier | null;
  readonly truthSet: readonly PipelineCarrier[];
  readonly acceptableSet: readonly PipelineCarrier[];
  readonly recommended: readonly PipelineCarrier[];
  readonly eliminated: readonly PipelineCarrier[];
  readonly applicability: {
    readonly factDependencies: readonly string[];
    readonly evaluatedConditions: readonly { readonly conditionId: string; readonly satisfied: boolean; readonly description?: string; readonly observedValue?: unknown; readonly threshold?: unknown }[];
    readonly totalSurfaces?: number;
    readonly matchedCount?: number;
    readonly eliminatedCount?: number;
  };
  readonly activation: readonly { readonly moduleId: string; readonly meaningId: string; readonly phase?: string }[];
  readonly arbitration: readonly { readonly candidateId?: string; readonly meaningId?: string; readonly moduleId?: string; readonly truthSetMember?: boolean; readonly rankingInputs?: { readonly recommendationBand: string; readonly specificity: number; readonly modulePrecedence: number } }[];
  readonly handoffs: readonly { readonly meaningId?: string; readonly fromModuleId?: string; readonly toModuleId?: string; readonly reason?: string }[];
}

/** Convention machine / FSM debug snapshot. */
export interface MachineDebugSnapshot {
  readonly currentStateId: string;
  readonly activeSurfaceGroupIds: readonly string[];
  readonly registers: {
    readonly forcingState?: string;
    readonly obligation?: { readonly kind?: string; readonly obligatedSide?: string };
    readonly agreedStrain?: { readonly type?: string; readonly suit?: string; readonly confidence?: string };
    readonly competitionMode?: string;
    readonly captain?: string;
    readonly systemCapabilities?: Record<string, unknown>;
  };
  readonly stateHistory: readonly string[];
  readonly transitionHistory: readonly string[];
  readonly submachineStack: readonly { readonly parentMachineId: string; readonly returnStateId: string }[];
  readonly diagnostics: readonly { readonly level: string; readonly message: string; readonly moduleId?: string }[];
  readonly handoffTraces: readonly { readonly fromModuleId: string; readonly toModuleId: string; readonly reason: string }[];
}

/** Evaluated hand/deal facts. */
export interface EvaluatedFacts {
  readonly facts: ReadonlyMap<string, { readonly value: unknown }> | Record<string, { readonly value: unknown }>;
}

/** Bid feedback from grading a user's bid. */
export interface BidFeedbackDTO {
  readonly grade: string;
  readonly userCall: Call;
  readonly expectedCall?: Call | null;
  readonly expectedResult: { readonly call: Call } | null;
  readonly explanation: string;
  readonly teachingResolution: {
    readonly acceptableBids: readonly { readonly call: Call; readonly meaning?: string; readonly tier?: string; readonly fullCredit?: boolean }[];
    readonly nearMissCalls: readonly { readonly call: Call; readonly reason?: string }[];
  } | null;
}

/** Top-level strategy evaluation — aggregates all debug outputs from suggest(). */
export interface StrategyEvaluation {
  readonly practicalRecommendation?: { readonly call: Call; readonly reason: string; readonly confidence: number } | null;
  readonly surfaceGroups?: readonly { readonly id: string; readonly label: string; readonly members: readonly string[] }[] | null;
  readonly pipelineResult?: PipelineResult | null;
  readonly posteriorSummary?: PosteriorSummary | null;
  readonly explanationCatalog?: Record<string, unknown> | null;
  readonly teachingProjection?: TeachingProjection | null;
  readonly facts?: EvaluatedFacts | null;
  readonly machineSnapshot?: MachineDebugSnapshot | null;
  readonly auctionContext?: Record<string, unknown> | null;
}

/** Debug log entry visible through DevServicePort. */
export interface ServiceDebugLogEntry {
  readonly kind: "pre-bid" | "user-bid" | "ai-bid";
  readonly turnIndex: number;
  readonly seat: Seat;
  readonly call?: Call;
  readonly snapshot?: DebugSnapshotBase | null;
  readonly feedback?: BidFeedbackDTO | null;
}

/** Base debug snapshot without sessionPhase — used in log entries
 *  where the session phase isn't relevant. */
export interface DebugSnapshotBase extends StrategyEvaluation {
  readonly expectedBid: BidResult | null;
}

