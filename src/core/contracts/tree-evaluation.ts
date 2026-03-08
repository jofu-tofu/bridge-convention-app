import type { Call } from "../../engine/types";

/**
 * Plain DTO for condition evaluation results crossing the conventions/ → ai/ → store → UI boundary.
 * CONSTRAINT: Must remain a plain DTO — no methods, no imports from conventions/ or engine/.
 * This preserves the contracts/ ↔ conventions/ dependency boundary.
 */
export interface ConditionDetail {
  readonly name: string;
  readonly passed: boolean;
  readonly description: string;
  readonly category?: "auction" | "hand";
  /** For compound conditions (or/and): sub-condition details per branch. */
  readonly children?: readonly ConditionDetail[];
  /** For branches within an or(): true if this is the best-matching branch
   *  (most passing sub-conditions; first wins ties). */
  readonly isBestBranch?: boolean;
}

/**
 * Tree traversal DTOs for UI consumption.
 * CONSTRAINT: Pure DTOs — no methods, no imports from conventions/ or engine/.
 * These cross the conventions/ → ai/ → store → UI boundary as display-ready data.
 * `depth` + `parentNodeName` on every entry supports future tree reconstruction:
 * group by parentNodeName, order by depth, render navigable tree with taken branch highlighted.
 */
export interface TreePathEntry {
  readonly nodeName: string;
  readonly passed: boolean;
  readonly description: string;
  readonly depth: number;
  readonly parentNodeName: string | null;
}

/** The decisive fork: what condition split the matched bid from an alternative? */
export interface TreeForkPoint {
  readonly matched: TreePathEntry;
  readonly rejected: TreePathEntry;
}

export interface SiblingConditionDetail {
  readonly name: string;
  readonly description: string;
}

/** A bid that was available in the same auction context but rejected for this hand. */
export interface SiblingBid {
  readonly bidName: string;
  readonly nodeId: string;
  readonly meaning: string;
  readonly call: Call;
  readonly failedConditions: readonly SiblingConditionDetail[];
}

/** A semantically enriched bid candidate — extends SiblingBid with intent + source metadata. */
export interface CandidateBid extends SiblingBid {
  readonly intent: {
    readonly type: string; // SemanticIntentType value — consumers import enum from conventions/ for matching
    readonly params: Readonly<Record<string, string | number | boolean>>;
  };
  readonly source: {
    readonly conventionId: string;
    readonly roundName?: string; // from ProtocolRound.name
    readonly nodeName: string; // from IntentNode.name
  };
  readonly explanation?: string; // from ConventionExplanations if available
}

/** Unified eligibility model — all four dimensions that gate candidate selectability.
 *  CONSTRAINT: Pure DTO — no methods, no imports from conventions/ or engine/. */
export interface CandidateEligibility {
  readonly hand: {
    readonly satisfied: boolean;
    readonly failedConditions: readonly SiblingConditionDetail[];
  };
  readonly protocol: {
    readonly satisfied: boolean;
    readonly reasons: readonly string[];
  };
  readonly encoding: {
    readonly legal: boolean;
  };
  readonly pedagogical: {
    readonly acceptable: boolean;
    readonly reasons: readonly string[];
  };
}

/** Strategy-resolved candidate — what the system actually considered for this auction+hand.
 *  Serializable DTO (no function refs) from ResolvedCandidate in candidate-generator. */
export interface ResolvedCandidateDTO {
  readonly bidName: string;
  readonly meaning: string;
  readonly call: Call;
  readonly resolvedCall: Call;
  readonly isDefaultCall: boolean;
  readonly legal: boolean;
  readonly isMatched: boolean;
  readonly priority?: "preferred" | "alternative";
  readonly provenance?: {
    readonly origin: "tree" | "replacement-tree" | "overlay-injected" | "overlay-override";
    readonly overlayId?: string;
  };
  readonly intentType: string;
  readonly failedConditions: readonly SiblingConditionDetail[];
  readonly eligibility?: CandidateEligibility;
}

/** Check whether a ResolvedCandidateDTO is selectable.
 *  Falls back to legacy `legal` + `failedConditions` when eligibility is absent. */
export function isDtoSelectable(c: ResolvedCandidateDTO): boolean {
  if (!c.eligibility) return c.legal && c.failedConditions.length === 0;
  return c.eligibility.hand.satisfied
    && c.eligibility.protocol.satisfied
    && c.eligibility.encoding.legal
    && c.eligibility.pedagogical.acceptable;
}

/** Groups of intents that are acceptable alternatives to each other for grading.
 *  When the matched intent is in a group, other group members become acceptable bids.
 *  Bypasses tree path-condition exclusivity — these are semantic, not structural, neighbors. */
export interface AlternativeGroup {
  /** Human-readable label for the group (e.g., "Bergen strength raises") */
  readonly label: string;
  /** bidNames (IntentNode.name) of intents in this group.
   *  Uses bidName (e.g., "bergen-game-raise") NOT nodeId ("bergen/bergen-game-raise")
   *  because ResolvedCandidateDTO carries bidName, not nodeId. */
  readonly members: readonly string[];
  /** Whether alternatives get full credit or partial.
   *  "preferred" → fullCredit: true (teal, same as correct).
   *  "alternative" → fullCredit: false (teal, partial credit).
   *  Maps to existing AcceptableBid.fullCredit in teaching-resolution.ts. */
  readonly tier: "preferred" | "alternative";
  /** Optional: only activate when matched intent is one of these specific bidNames.
   *  If omitted, any member match activates all other members as alternatives.
   *  If present, ONLY matching one of these members activates the group. */
  readonly whenMatched?: readonly string[];
}

/** Why did the tree match? Decision path trace through the convention tree. */
export interface DecisionTrace {
  readonly matchedNodeName: string;
  readonly path: readonly TreePathEntry[];
  readonly visited: readonly TreePathEntry[];
  readonly forkPoint?: TreeForkPoint;
}

/** What else was in the candidate universe? All bids considered for this auction+hand. */
export interface CandidateSet {
  /** Teaching view: base tree, defaultCall — what COULD you bid with a different hand. */
  readonly siblings: readonly SiblingBid[];
  readonly candidates?: readonly CandidateBid[];
  /** Strategy view: overlay-aware, resolver-aware — what DID the system consider. */
  readonly resolvedCandidates?: readonly ResolvedCandidateDTO[];
}

/** Structured trace of how the convention pipeline evaluated a bid.
 *  Always-on (not DEV-gated). Plain DTO — no convention-core imports. */
export interface EvaluationTrace {
  readonly conventionId: string;
  readonly protocolMatched: boolean;
  readonly activeRound?: string;
  readonly overlaysActivated: readonly string[];
  readonly overlayErrors: readonly { readonly overlayId: string; readonly hook: string; readonly error: string }[];
  readonly resolverOutcome?: "resolved" | "use_default" | "declined" | "no_resolver" | "error";
  readonly candidateCount: number;
  readonly selectedTier?: "matched" | "preferred" | "alternative" | "none";
  readonly effectivePath?: {
    readonly candidateBidName: string;
    readonly wasOverlayReplaced: boolean;
    readonly wasResolverRemapped: boolean;
  };
  /** True when a strategy result was rejected by the chain's resultFilter. */
  readonly forcingFiltered?: boolean;
  /** Error message from the practical recommendation pipeline, if it failed. */
  readonly practicalError?: string;
  readonly tierPeerCount?: number;
  readonly tierPeerBidNames?: readonly string[];
  readonly rankerResolved?: boolean;
  readonly strategyChainPath: readonly { readonly strategyId: string; readonly result: "suggested" | "declined" | "filtered" | "error" }[];
}
