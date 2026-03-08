import type {
  Hand,
  Auction,
  Call,
  DealConstraints,
  Deal,
} from "../../engine/types";
import type { Seat } from "../../engine/types";
import type { BiddingContext } from "../../core/contracts";
export type { BiddingContext } from "../../core/contracts";
import type { InterferenceKind } from "./dialogue/dialogue-state";
import type { TransitionRule } from "./dialogue/dialogue-transitions";
import type { EffectiveConventionContext } from "./pipeline/effective-context";
import type { ResolvedCandidate } from "./pipeline/candidate-generator";
import type { IntentResolverMap } from "./intent/intent-resolver";
import type { ConventionOverlayPatch } from "./overlay/overlay";
import type { ProtocolEvalResult, ConventionProtocol } from "./protocol/protocol";
import type { RuleNode, BidAlert, ConventionExplanations } from "./tree/rule-tree";
import type { TreeEvalResult } from "./tree/tree-evaluator";
import type { TriggerDescriptor } from "./trigger-descriptor";

/** Structured inference data attached to a RuleCondition. */
export interface ConditionInference {
  readonly type:
    | "hcp-min"
    | "hcp-max"
    | "hcp-range"
    | "suit-min"
    | "suit-max"
    | "balanced"
    | "not-balanced"
    | "two-suited";
  readonly params: Record<string, number | string | boolean>;
}

/** Pattern describing how an opponent convention bid should be classified. */
export interface InterferenceSignature {
  readonly kind: InterferenceKind;
  /** Override natural/artificial classification when this signature matches. */
  readonly isNatural?: boolean;
  matches(call: Call): boolean;
}

export enum ConventionCategory {
  Asking = "Asking",
  Defensive = "Defensive",
  Constructive = "Constructive",
  Competitive = "Competitive",
}

export interface BiddingRule {
  readonly name: string;
  readonly explanation: string;
  matches(context: BiddingContext): boolean;
  call(context: BiddingContext): Call;
}

export interface ExampleHand {
  readonly description: string;
  readonly hand: Hand;
  readonly auction: Auction;
  readonly expectedCall: Call;
  readonly ruleName: string;
}

/** A single testable condition within a bidding rule. */
export interface RuleCondition {
  readonly name: string;
  /** Static, context-free human-readable description (e.g., "8+ HCP", "4+ spades").
   *  Used for reference rule display when no BiddingContext is available. */
  readonly label: string;
  /** Whether this condition checks auction state ('auction') or hand properties ('hand').
   *  Used by flattenTree() for auction/hand splitting. Set by condition factories. */
  readonly category: "auction" | "hand";
  /** Test whether this condition is satisfied. */
  test(context: BiddingContext): boolean;
  /** Produce a human-readable description of what this condition found.
   *  Context-aware: references actual hand values, not just thresholds. */
  describe(context: BiddingContext): string;
  /** For compound conditions (or/and): evaluate sub-conditions individually.
   *  Returns null for leaf conditions. */
  evaluateChildren?(context: BiddingContext): ConditionBranch[];
  /** Structured inference data for the auction inference engine. Optional — added incrementally. */
  readonly inference?: ConditionInference;
  /** Per-condition teaching override. When present, takes priority over
   *  the inference-type default in the condition explanation registry.
   *  Use for convention-specific explanations of shared conditions. */
  readonly teachingNote?: string;
  /** Whether the NO branch of this condition can be meaningfully negated for inference.
   *  Defaults to true. Set to false for conditions like `isBalanced()` where
   *  the NO branch doesn't imply a clean inverse (could be semi-balanced). */
  readonly negatable?: boolean;
  /** Whether this condition evaluates against an event-local span ("event")
   *  or needs the full auction history ("full"). Used by diagnostics to warn
   *  when a full-scope condition is used as a protocol trigger. */
  readonly triggerScope?: "event" | "full";
  /** Structured metadata for semantic overlap/subsumption analysis.
   *  Used by registration-time diagnostics to detect trigger shadowing
   *  and unreachable rounds. Optional — conditions without descriptors
   *  are treated as opaque and silently skipped. */
  readonly descriptor?: TriggerDescriptor;
}

/** A condition that checks auction state (e.g., who opened, auction pattern).
 *  Inference intentionally omitted — auction conditions describe auction state,
 *  not hand constraints. Enforced by test in conditions.test.ts. */
export interface AuctionCondition extends RuleCondition {
  readonly category: "auction";
}

/** A condition that checks hand properties (e.g., HCP, suit length, shape). */
export interface HandCondition extends RuleCondition {
  readonly category: "hand";
  readonly inference?: ConditionInference;
}

export interface ConditionBranch {
  readonly results: readonly ConditionResult[];
  readonly passed: boolean;
}

export interface ConditionResult {
  readonly condition: RuleCondition;
  readonly passed: boolean;
  readonly description: string;
  /** For compound conditions: per-branch sub-results. */
  readonly branches?: readonly ConditionBranch[];
}

/**
 * A BiddingRule whose matches() is derived from separate auction and hand conditions.
 * Always use the conditionedRule() factory to construct these.
 *
 * Auction/hand separation is enforced by convention + tests, not separate TypeScript
 * types. Both arrays share RuleCondition because hybrid conditions (e.g., majorSupport)
 * that check auction to resolve parameters but gate on hand properties must live in
 * handConditions for inference engine access.
 */
export interface ConditionedBiddingRule extends BiddingRule {
  readonly auctionConditions: readonly RuleCondition[];
  readonly handConditions: readonly RuleCondition[];
  /** Flattened view for backward compat with evaluateConditions/buildExplanation. */
  readonly conditions: readonly RuleCondition[];
}

/** Convention-level teaching metadata. */
export interface ConventionTeaching {
  /** Why this convention exists — the problem it solves. */
  readonly purpose?: string;
  /** When to use this convention — the trigger conditions in plain English. */
  readonly whenToUse?: string;
  /** When NOT to use this convention — common misapplications. */
  readonly whenNotToUse?: readonly string[];
  /** What you give up by using this convention. */
  readonly tradeoff?: string;
  /** The underlying bridge principle. */
  readonly principle?: string;
  /** Who controls the auction — captain/roles. */
  readonly roles?: string;
}

export interface ConventionConfig {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: ConventionCategory;
  /** Teaching metadata — optional, populated in explanations.ts per convention. */
  readonly teaching?: ConventionTeaching;
  readonly dealConstraints: DealConstraints;
  readonly biddingRules?: readonly BiddingRule[];
  readonly examples?: readonly ExampleHand[];
  /** Returns the default auction context for a given seat, or undefined for empty auction. */
  readonly defaultAuction?: (seat: Seat, deal?: Deal) => Auction | undefined;
  /** If true, convention is internal (e.g., SAYC for opponents) and hidden from UI picker. */
  readonly internal?: boolean;
  /** If set, drill infrastructure picks a random dealer from this list.
   *  When the chosen dealer differs from dealConstraints.dealer, all seat
   *  constraints and auction entries are rotated 180° (N↔S, E↔W).
   *  Entries should be from the same partnership pair (E+W or N+S). */
  readonly allowedDealers?: readonly Seat[];
  /** Per-convention teaching explanations (keyed by node name). */
  readonly explanations?: ConventionExplanations;
  /** Present on protocol conventions. All conventions must use protocols.
   *  Uses `any` type parameter because convention-specific EstablishedContext
   *  subtypes are not assignable to the base type (function contravariance). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Protocol generic must stay erased at registry boundary.
  readonly protocol?: ConventionProtocol<any>;
  /** Dialogue transition rules for IntentNode-based conventions.
   *  When `baselineRules` is also set, this array contains ONLY convention-specific rules.
   *  When `baselineRules` is NOT set, this array is composed as [...familyRules, ...baselineTransitionRules].
   *  Required when hand trees contain IntentNode leaves. */
  readonly transitionRules?: readonly TransitionRule[];
  /** Baseline transition rules (universal patterns like NT detection, interference, pass).
   *  When set, `computeDialogueState` uses two-pass mode: convention rules fire first,
   *  baseline rules backfill only the fields convention rules didn't set.
   *  Convention values always win over baseline values. */
  readonly baselineRules?: readonly TransitionRule[];
  /** Intent resolvers for IntentNode-based conventions.
   *  Maps SemanticIntentType to resolver functions.
   *  Required when hand trees contain IntentNode leaves. */
  readonly intentResolvers?: IntentResolverMap;
  /** Overlays that replace the hand tree for specific protocol rounds based on dialogue state.
   *  First matching overlay wins. Validated against protocol round names at registration time. */
  readonly overlays?: readonly ConventionOverlayPatch[];
  /** Bid signatures this convention uses that opponents may classify as interference. */
  readonly interferenceSignatures?: readonly InterferenceSignature[];
  /** Optional candidate ranker for reordering before selection.
   *  Operates across ALL candidates before tier filtering.
   *  No conventions use this yet — seam for future difficulty/style preferences. */
  readonly rankCandidates?: (
    candidates: readonly ResolvedCandidate[],
    context: EffectiveConventionContext,
  ) => readonly ResolvedCandidate[];
  /** Optional pedagogical filter — convention authors can mark candidates as
   *  not appropriate for teaching. Errors are caught (fail-open → acceptable: true).
   *  No conventions use this yet — seam for future use. */
  readonly pedagogicalCheck?: (
    candidate: { intentType: string; call: Call; resolvedCall: Call; isMatched: boolean },
    ctx: EffectiveConventionContext,
  ) => { acceptable: boolean; reasons: string[] };
}

/** Resolves a convention config by ID. Must throw on unknown IDs (same as getConvention). */
export type ConventionLookup = (id: string) => ConventionConfig;

export interface BiddingRuleResult {
  readonly call: Call;
  readonly rule: string;
  readonly explanation: string;
  readonly meaning?: string;
  readonly conditionResults?: readonly ConditionResult[];
  /** Raw tree evaluation result — available for conventions using rule trees.
   *  Carries DecisionNode references, so must not cross the contracts/ boundary directly. */
  readonly treeEvalResult?: TreeEvalResult;
  /** The tree root used for evaluation — needed by mappers that compute depth/parent info. */
  readonly treeRoot?: RuleNode;
  /** Full protocol evaluation result — available for protocol-based conventions. */
  readonly protocolResult?: ProtocolEvalResult;
  /** Alert metadata from matched IntentNode — for conventional (non-natural) bids. */
  readonly alert?: BidAlert;
}
