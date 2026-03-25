// ── Verify CLI types ────────────────────────────────────────────────
//
// Shared types for the compositional verification CLI framework.
// All verify subcommands produce JSON output using these types.

import type { Seat } from "../../engine/types";
import type { NegotiationState, CommittedStep, ModuleSurfaceResult } from "../../conventions";

// ── Lint ─────────────────────────────────────────────────────────────

export interface LintDiagnostic {
  readonly ruleId: string;
  readonly severity: "error" | "warn";
  readonly message: string;
  readonly location: {
    readonly ruleIndex?: number;
    readonly phase?: string;
    readonly transitionIndex?: number;
  };
  readonly suggestion: string;
}

// ── Interference ────────────────────────────────────────────────────

export interface InterferenceEdge {
  readonly kind: "activation-overlap" | "encoding-collision" | "observation-crosstalk" | "kernel-conflict";
  readonly description: string;
  readonly risk: "high" | "medium" | "low" | "none";
  readonly ruleA?: { readonly ruleIndex: number; readonly matchSummary: string };
  readonly ruleB?: { readonly ruleIndex: number; readonly matchSummary: string };
  readonly detail?: string;
  readonly resolution?: string;
}

export interface PairInteraction {
  readonly moduleA: string;
  readonly moduleB: string;
  readonly edges: readonly InterferenceEdge[];
  readonly riskLevel: "high" | "medium" | "low" | "none";
}

// ── Invariants + Exploration ────────────────────────────────────────

export interface InvariantViolation {
  readonly invariant: string;
  readonly seed: number;
  readonly step: number;
  readonly message: string;
  readonly context: {
    readonly auction: readonly string[];
    readonly activeSeat: string;
    /** JSON-serializable Record (converted from Map via Object.fromEntries). */
    readonly localPhases: Record<string, string>;
    readonly kernel: NegotiationState;
  };
}

/**
 * Runtime snapshot at one auction step — used by invariant checks.
 *
 * `localPhases` is a Map for fast runtime lookup. When building
 * InvariantViolation.context, convert via Object.fromEntries().
 */
export interface VerificationSnapshot {
  readonly seed: number;
  readonly step: number;
  readonly auction: readonly string[];
  readonly nextSeat: Seat;
  /** Runtime Map — use Object.fromEntries() for JSON output. */
  readonly localPhases: Map<string, string>;
  readonly kernel: NegotiationState;
  readonly resolved: readonly ModuleSurfaceResult[];
  readonly log: readonly CommittedStep[];
}

export interface ExplorationInvariant {
  readonly id: string;
  /** "error" causes preflight failure; "warn" is advisory. */
  readonly severity: "error" | "warn";
  readonly check: (snapshot: VerificationSnapshot) => InvariantViolation | null;
}

export interface ExplorationCoverage {
  readonly modulesActivated: readonly string[];
  readonly phasesReached: Record<string, readonly string[]>;
  readonly rulesFired: Record<string, readonly number[]>;
  readonly atomsExercised: readonly string[];
}

export interface ExplorationResult {
  readonly command: "verify explore";
  readonly bundle: string;
  readonly config: { readonly depth: number; readonly seed: number; readonly trials: number };
  readonly coverage: ExplorationCoverage;
  readonly violations: readonly InvariantViolation[];
  readonly summary: { readonly clean: boolean; readonly trialsRun: number; readonly totalSteps: number };
}

// ── Motif ───────────────────────────────────────────────────────────

export interface MotifResult {
  readonly command: "verify motif";
  readonly bundle: string;
  readonly pair: readonly [string, string];
  readonly coActivations: number;
  readonly conflicts: number;
  readonly violations: readonly InvariantViolation[];
  readonly verdict: "safe" | "risky" | "failing";
}

// ── Fuzz ────────────────────────────────────────────────────────────

export interface FuzzEdgeCase {
  readonly seed: number;
  readonly kind: string;
  readonly message: string;
}

export interface FuzzResult {
  readonly command: "verify fuzz";
  readonly bundle: string;
  readonly config: { readonly trials: number; readonly seed: number };
  readonly crashes: readonly { readonly seed: number; readonly error: string }[];
  readonly violations: readonly InvariantViolation[];
  readonly edgeCases: readonly FuzzEdgeCase[];
  readonly summary: { readonly clean: boolean; readonly trialsRun: number; readonly passRate: number };
}

// ── Preflight ───────────────────────────────────────────────────────

export interface PreflightOutput {
  readonly command: "verify preflight";
  readonly bundle: string;
  readonly budget: "fast" | "full";
  readonly stages: {
    readonly lint: { readonly clean: boolean; readonly errors: number; readonly warnings: number };
    readonly interfere: { readonly highRisk: number; readonly mediumRisk: number; readonly flaggedPairs: readonly string[] };
    readonly explore: { readonly clean: boolean; readonly violations: number; readonly trialsRun: number };
    readonly motif?: { readonly pairsChecked: number; readonly failing: number };
    readonly fuzz: { readonly clean: boolean; readonly crashes: number; readonly trialsRun: number };
  };
  readonly verdict: "pass" | "fail";
  readonly duration_ms: number;
}
