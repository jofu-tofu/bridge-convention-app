/** Opponent bidding behavior for drills. */
export type OpponentMode = "natural" | "none";

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

/** Sensible default: equal distribution across all four vulnerability states. */
export const DEFAULT_DRILL_TUNING: DrillTuning = {
  vulnerabilityDistribution: { none: 1, ours: 1, theirs: 1, both: 1 },
};

// ─── Display settings ───────────────────────────────────────
//
// UI preferences that affect how information is shown during drills
// but do NOT affect deal generation or scoring.

/** UI display preferences for the drill session. */
export interface DisplaySettings {
  /** Show gray educational annotations under bids in the auction table.
   *  When false, only ACBL-required alerts and announcements are shown. */
  readonly showEducationalAnnotations: boolean;
}

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  showEducationalAnnotations: true,
};
