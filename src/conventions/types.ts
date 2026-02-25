import type {
  Hand,
  Auction,
  Call,
  HandEvaluation,
  DealConstraints,
  Deal,
  Vulnerability,
} from "../engine/types";
import { Seat } from "../engine/types";

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
    | "ace-count"
    | "king-count"
    | "two-suited";
  readonly params: Record<string, number | string | boolean>;
}

export enum ConventionCategory {
  Asking = "Asking",
  Defensive = "Defensive",
  Constructive = "Constructive",
  Competitive = "Competitive",
}

export enum ConventionRole {
  Opener = "Opener",
  Responder = "Responder",
  Overcaller = "Overcaller",
  Advancer = "Advancer",
}

export interface BiddingContext {
  readonly hand: Hand;
  readonly auction: Auction;
  readonly seat: Seat;
  readonly evaluation: HandEvaluation;
  /** Added in Phase 1 of tree migration. Optional during migration; tree evaluator uses defaults via createBiddingContext(). */
  readonly vulnerability?: Vulnerability;
  /** Added in Phase 1 of tree migration. Optional during migration; tree evaluator uses defaults via createBiddingContext(). */
  readonly dealer?: Seat;
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

export interface DealConstraintSource {
  readonly conventionId: string;
  readonly description: string;
  readonly constraints: DealConstraints;
}

/** A single testable condition within a bidding rule. */
export interface RuleCondition {
  readonly name: string;
  /** Static, context-free human-readable description (e.g., "8+ HCP", "4+ spades").
   *  Used for reference rule display when no BiddingContext is available. */
  readonly label: string;
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

export interface ConventionConfig {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: ConventionCategory;
  readonly dealConstraints: DealConstraints;
  readonly biddingRules?: readonly BiddingRule[];
  readonly examples: readonly ExampleHand[];
  /** Returns the default auction context for a given seat, or undefined for empty auction. */
  readonly defaultAuction?: (seat: Seat, deal?: Deal) => Auction | undefined;
  /** If true, convention is internal (e.g., SAYC for opponents) and hidden from UI picker. */
  readonly internal?: boolean;
  /** Present on tree conventions only. See TreeConventionConfig in rule-tree.ts. */
  readonly ruleTree?: import("./rule-tree").RuleNode;
}
