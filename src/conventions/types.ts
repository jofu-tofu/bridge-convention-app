import type {
  Hand,
  Auction,
  Call,
  HandEvaluation,
  DealConstraints,
  Deal,
} from "../engine/types";
import { Seat } from "../engine/types";

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
  /** Test whether this condition is satisfied. */
  test(context: BiddingContext): boolean;
  /** Produce a human-readable description of what this condition found.
   *  Context-aware: references actual hand values, not just thresholds. */
  describe(context: BiddingContext): string;
  /** For compound conditions (or/and): evaluate sub-conditions individually.
   *  Returns null for leaf conditions. */
  evaluateChildren?(context: BiddingContext): ConditionBranch[];
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
 * A BiddingRule whose matches() is derived from an array of named conditions.
 * CONSTRAINT: Never override matches() independently of conditions[].
 * Always use the conditionedRule() factory to construct these.
 */
export interface ConditionedBiddingRule extends BiddingRule {
  readonly conditions: readonly RuleCondition[];
}

export interface ConventionConfig {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: ConventionCategory;
  readonly dealConstraints: DealConstraints;
  readonly biddingRules: readonly BiddingRule[];
  readonly examples: readonly ExampleHand[];
  /** Returns the default auction context for a given seat, or undefined for empty auction. */
  readonly defaultAuction?: (seat: Seat, deal?: Deal) => Auction | undefined;
}
