import type { Call } from "../engine/types";

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
}

export interface TreeEvalSummary {
  readonly matchedNodeName: string;
  readonly path: readonly TreePathEntry[];
  readonly visited: readonly TreePathEntry[];
  readonly forkPoint?: TreeForkPoint;
  /** Teaching view: base tree, defaultCall — what COULD you bid with a different hand. */
  readonly siblings?: readonly SiblingBid[];
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
  /** True when convention matched but no candidate could be selected in a forcing auction. */
  readonly forcingDeclined?: boolean;
  readonly effectivePath?: {
    readonly candidateBidName: string;
    readonly wasOverlayReplaced: boolean;
    readonly wasResolverRemapped: boolean;
  };
  /** True when a strategy result was rejected by the chain's resultFilter. */
  readonly forcingFiltered?: boolean;
  /** Error message from the practical recommendation pipeline, if it failed. */
  readonly practicalError?: string;
  readonly strategyChainPath: readonly { readonly strategyId: string; readonly result: "suggested" | "declined" | "filtered" | "error" }[];
}
