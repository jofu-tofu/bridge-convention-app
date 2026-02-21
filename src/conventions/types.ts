import type {
  Hand,
  Auction,
  Call,
  HandEvaluation,
  DealConstraints,
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

export interface ConventionConfig {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: ConventionCategory;
  readonly dealConstraints: DealConstraints;
  readonly biddingRules: readonly BiddingRule[];
  readonly examples: readonly ExampleHand[];
  /** Returns the default auction context for a given seat, or undefined for empty auction. */
  readonly defaultAuction?: (seat: Seat) => Auction | undefined;
}
