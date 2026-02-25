import type {
  Call,
  Card,
  Hand,
  Suit,
  Seat,
  Contract,
  PlayedCard,
  Trick,
} from "../engine/types";
import type { BiddingContext } from "../conventions/types";

export interface SuitInference {
  readonly minLength?: number;
  readonly maxLength?: number;
}

/** What a single bid reveals about the bidder's hand. */
export interface HandInference {
  readonly seat: Seat;
  readonly minHcp?: number;
  readonly maxHcp?: number;
  readonly isBalanced?: boolean;
  readonly suits: Partial<Record<Suit, SuitInference>>;
  readonly source: string; // rule name or "natural"
}

/** Accumulated view of what's known about a hand. */
export interface InferredHoldings {
  readonly seat: Seat;
  readonly inferences: readonly HandInference[];
  /** Merged view (computed from all inferences). */
  readonly hcpRange: { readonly min: number; readonly max: number };
  readonly suitLengths: Record<
    Suit,
    { readonly min: number; readonly max: number }
  >;
  readonly isBalanced: boolean | undefined;
}

/**
 * Plain DTO for condition evaluation results crossing the conventions/ → ai/ → store → UI boundary.
 * CONSTRAINT: Must remain a plain DTO — no methods, no imports from conventions/ or engine/.
 * This preserves the shared/ ↔ conventions/ dependency boundary.
 */
export interface ConditionDetail {
  readonly name: string;
  readonly passed: boolean;
  readonly description: string;
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

export interface TreeEvalSummary {
  readonly matchedNodeName: string;
  readonly path: readonly TreePathEntry[];
  readonly visited: readonly TreePathEntry[];
  readonly forkPoint?: TreeForkPoint;
}

export interface BidResult {
  readonly call: Call;
  readonly ruleName: string | null;
  readonly explanation: string;
  readonly confidence?: number; // 0-1, future use (ML strategies)
  readonly conditions?: readonly ConditionDetail[];
  readonly treePath?: TreeEvalSummary;
}

export interface BiddingStrategy {
  readonly id: string;
  readonly name: string;
  suggest(context: BiddingContext): BidResult | null;
}

/** Context passed to play strategies for card selection. */
export interface PlayContext {
  readonly hand: Hand;
  readonly currentTrick: readonly PlayedCard[];
  readonly previousTricks: readonly Trick[];
  readonly contract: Contract;
  readonly seat: Seat;
  readonly trumpSuit: Suit | undefined;
  readonly legalPlays: readonly Card[];
  /** Visible after opening lead; undefined before dummy is revealed. */
  readonly dummyHand?: Hand;
  /** Auction inferences — optional, heuristics degrade gracefully without. */
  readonly inferences?: Record<Seat, InferredHoldings>;
}

export interface PlayResult {
  readonly card: Card;
  readonly reason: string;
  readonly confidence?: number; // 0-1, for future DDS tiebreaking
}

export interface PlayStrategy {
  readonly id: string;
  readonly name: string;
  suggest(context: PlayContext): PlayResult;
}
