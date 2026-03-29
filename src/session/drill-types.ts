/** Opponent bidding behavior for drills. */
export enum OpponentMode {
  Natural = "natural",
  None = "none",
}

// ─── Practice role ─────────────────────────────────────────────

/** Which role the user plays: opener, responder, or both (random per deal). */
export enum PracticeRole {
  Responder = "responder",
  Opener = "opener",
  Both = "both",
}

// ─── Practice modes ────────────────────────────────────────────

/** Controls what portion of the auction the user bids through. */
export enum PracticeMode {
  DecisionDrill = "decision-drill",       // Drop-in at convention decision point (current behavior)
  FullAuction = "full-auction",           // User bids from opening through convention and beyond
  ContinuationDrill = "continuation-drill", // Drop-in at a specific continuation phase
}

/** Module roles relative to the practice target. Computed at session creation. */
export interface PracticeFocus {
  readonly targetModuleIds: readonly string[];
  readonly prerequisiteModuleIds: readonly string[];
  readonly followUpModuleIds: readonly string[];
  /** Base system modules always active but not the practice focus (e.g., Blackwood). */
  readonly backgroundModuleIds: readonly string[];
}

/**
 * Identifies a continuation phase to practice.
 * No authored metadata — phase and moduleId reference the existing FSM.
 * Deal constraints and prefix are derived at drill creation time.
 */
export interface ContinuationTarget {
  readonly moduleId: string;
  readonly phase: string;
}

/** Default practice focus: all modules are targets, none are prerequisites. */
export const ALL_TARGETS_FOCUS: PracticeFocus = {
  targetModuleIds: [],
  prerequisiteModuleIds: [],
  followUpModuleIds: [],
  backgroundModuleIds: [],
};

// ─── Drill tuning ───────────────────────────────────────────
//
// Tunable parameters that shape practice session deal generation.
// These form the foundation for configurable practice sessions —
// each knob can eventually be exposed in the UI.

/** Relative weights controlling how often each vulnerability scenario appears.
 *  Values are ratios — {none:1, ours:1, theirs:1, both:1} = equal 25% each.
 *  "Ours" = user's partnership vulnerable; "theirs" = opponents vulnerable. */
export interface VulnerabilityDistribution {
  readonly none: number;
  readonly ours: number;
  readonly theirs: number;
  readonly both: number;
}

/** Tunable parameters for practice session deal generation.
 *  Start with vulnerability distribution; future knobs are stubbed here
 *  so the abstraction exists before the UI controls are built. */
export interface DrillTuning {
  /** Controls how often each vulnerability scenario appears. */
  readonly vulnerabilityDistribution: VulnerabilityDistribution;
  /** If set, constrains which modules within a bundle get exercised.
   *  Key = module ID, value = relative weight. Omitted modules use default weight. */
  readonly moduleWeights?: Readonly<Record<string, number>>;
  /** Whether to include deals where the convention doesn't apply (user should pass).
   *  Default: false — all deals trigger the convention. */
  readonly includeOffConvention?: boolean;
  /** Fraction of deals that should be off-convention (0-1).
   *  Only used when includeOffConvention is true. */
  readonly offConventionRate?: number;
}

/** Sensible default: no vulnerability. */
export const DEFAULT_DRILL_TUNING: DrillTuning = {
  vulnerabilityDistribution: { none: 1, ours: 0, theirs: 0, both: 0 },
};

// ─── Drill settings ─────────────────────────────────────────
//
// Clean domain type capturing everything needed to run a drill session.
// Both the UI store and CLI converge on this type — it's the contract
// that would be sent to a backend API to start a practice session.

/** Play phase behavior after bidding completes. */
export enum PlayPreference {
  Always = "always",
  Prompt = "prompt",
  Skip = "skip",
}

/** Prompt mode for the declarer prompt phase. */
export enum PromptMode {
  SouthDeclarer = "south-declarer",
  DeclarerSwap = "declarer-swap",
  Defender = "defender",
}

/** Complete drill execution parameters (opponent behavior + deal generation). */
export interface DrillSettings {
  readonly opponentMode: OpponentMode;
  readonly tuning: DrillTuning;
  readonly playProfileId?: PlayProfileId;
  readonly practiceMode?: PracticeMode;
  readonly continuationTarget?: ContinuationTarget;
  readonly playPreference?: PlayPreference;
  readonly practiceRole?: PracticeRole;
}

export const DEFAULT_DRILL_SETTINGS: DrillSettings = {
  opponentMode: OpponentMode.None,
  tuning: DEFAULT_DRILL_TUNING,
  playProfileId: "world-class",
};

// ─── Drill config ───────────────────────────────────────────

import type { Hand, Auction, Seat, Deal } from "../engine/types";
import type { BiddingStrategy, BidResult } from "../conventions";
import type { PlayStrategy } from "../conventions";
import type { ConventionStrategy } from "../conventions";
import type { InferenceConfig } from "../inference/types";
import type { InferenceEngine } from "../inference/inference-engine";
import type { PlayProfileId, PlayStrategyProvider } from "./heuristics/play-profiles";

export interface DrillConfig {
  readonly conventionId: string;
  readonly userSeat: Seat;
  readonly seatStrategies: Record<Seat, BiddingStrategy | "user">;
  readonly playStrategy?: PlayStrategy;
  readonly playStrategyProvider?: PlayStrategyProvider;
  readonly nsInferenceConfig?: InferenceConfig;
  readonly ewInferenceConfig?: InferenceConfig;
}

export interface DrillSession {
  readonly config: DrillConfig;
  getNextBid(seat: Seat, hand: Hand, auction: Auction): BidResult | null;
  isUserSeat(seat: Seat): boolean;
}

export interface DrillBundle {
  deal: Deal;
  session: DrillSession;
  initialAuction?: Auction;
  strategy?: ConventionStrategy;
  nsInferenceEngine: InferenceEngine | null;
  ewInferenceEngine: InferenceEngine | null;
  /** True when this deal was generated as an off-convention hand
   *  (the convention doesn't apply; user should bid naturally). */
  isOffConvention?: boolean;
  /** Practice mode — defaults to "decision-drill" when omitted. */
  readonly practiceMode?: PracticeMode;
  /** Module roles relative to the practice target. Defaults to all-targets when omitted. */
  readonly practiceFocus?: PracticeFocus;
  /** Play phase behavior — defaults to mode-derived preference when omitted. */
  readonly playPreference?: PlayPreference;
  /** The resolved practice role for this deal ("opener" or "responder"). */
  readonly resolvedRole?: PracticeRole.Opener | PracticeRole.Responder;
}
