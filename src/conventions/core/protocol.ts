import type { AuctionCondition } from "./types";
import type { HandNode, BidNode } from "./rule-tree";
import type { TreeEvalResult } from "./tree-evaluator";

// ─── Established context ─────────────────────────────────────

/** Role of the active bidder, computed from auction + seat. */
export type AuctionRole = "opener" | "responder" | "competitive" | "rebidder";

/** Base context accumulated across protocol rounds. */
export interface EstablishedContext {
  readonly role: AuctionRole;
}

// ─── Semantic triggers ───────────────────────────────────────

/** A semantic trigger describing a conversation event in the auction. */
export interface SemanticTrigger<T extends EstablishedContext = EstablishedContext> {
  /** The condition to test — built from generic condition factories. */
  readonly condition: AuctionCondition;
  /** What this conversation event establishes (merged into accumulated context). */
  readonly establishes: Partial<T>;
}

// ─── Protocol rounds ─────────────────────────────────────────

/** A single round in a convention protocol. */
export interface ProtocolRound<T extends EstablishedContext = EstablishedContext> {
  /** Human-readable round name (e.g., "opening", "response"). */
  readonly name: string;
  /** Semantic triggers — first match wins. */
  readonly triggers: readonly SemanticTrigger<T>[];
  /** Resolves the hand subtree for this round given accumulated context. */
  readonly handTree: HandNode | ((established: T) => HandNode);
  /** Optional handler for opponent interference after the trigger bid. */
  readonly onInterference?: HandNode | ((established: T) => HandNode);
  /** Optional seat filter — evaluated against the FULL context (not windowed).
   *  If present and fails, cursor still advances (the milestone happened) but
   *  activeRound is NOT updated (this seat doesn't act in this round). */
  readonly seatFilter?: AuctionCondition;
}

// ─── Convention protocol ─────────────────────────────────────

/** A convention modeled as a multi-round conversation protocol. */
export interface ConventionProtocol<T extends EstablishedContext = EstablishedContext> {
  /** Convention ID (must match ConventionConfig.id). */
  readonly id: string;
  /** Sequential rounds of the conversation. */
  readonly rounds: readonly ProtocolRound<T>[];
}

// ─── Evaluation result ───────────────────────────────────────

/** Entry tracking which round + trigger matched. */
export interface MatchedRoundEntry<T extends EstablishedContext = EstablishedContext> {
  readonly round: ProtocolRound<T>;
  readonly trigger: SemanticTrigger<T>;
}

/** Result of evaluating a convention protocol. */
export interface ProtocolEvalResult<T extends EstablishedContext = EstablishedContext> {
  /** The matched BidNode (null if convention doesn't apply). */
  readonly matched: BidNode | null;
  /** Rounds that matched sequentially. */
  readonly matchedRounds: readonly MatchedRoundEntry<T>[];
  /** The accumulated established context. */
  readonly established: T;
  /** The hand evaluation result from the active round. */
  readonly handResult: TreeEvalResult;
  /** The active round (last matched round). Null if no rounds matched. */
  readonly activeRound: ProtocolRound<T> | null;
  /** Whether interference was detected. */
  readonly interferenceDetected: boolean;
  /** The resolved hand tree root (for sibling finder). */
  readonly handTreeRoot: HandNode | null;
}

// ─── Builder helpers ─────────────────────────────────────────

/** Build a convention protocol. */
export function protocol<T extends EstablishedContext = EstablishedContext>(
  id: string,
  rounds: readonly ProtocolRound<T>[],
): ConventionProtocol<T> {
  return { id, rounds };
}

/** Build a protocol round. */
export function round<T extends EstablishedContext = EstablishedContext>(
  name: string,
  config: {
    triggers: readonly SemanticTrigger<T>[];
    handTree: HandNode | ((established: T) => HandNode);
    onInterference?: HandNode | ((established: T) => HandNode);
    seatFilter?: AuctionCondition;
  },
): ProtocolRound<T> {
  return {
    name,
    triggers: config.triggers,
    handTree: config.handTree,
    onInterference: config.onInterference,
    seatFilter: config.seatFilter,
  };
}

/** Build a semantic trigger. */
export function semantic<T extends EstablishedContext = EstablishedContext>(
  condition: AuctionCondition,
  establishes: Partial<T>,
): SemanticTrigger<T> {
  return { condition, establishes };
}

// ─── Validation ──────────────────────────────────────────────

/** Validate a protocol at registration time. */
export function validateProtocol(proto: ConventionProtocol): void {
  if (proto.rounds.length === 0) {
    throw new Error(`Protocol "${proto.id}" has zero rounds.`);
  }
  for (const r of proto.rounds) {
    if (r.triggers.length === 0) {
      throw new Error(
        `Protocol "${proto.id}" round "${r.name}" has zero triggers.`,
      );
    }
    for (const trigger of r.triggers) {
      if (trigger.condition.category !== "auction") {
        throw new Error(
          `Protocol "${proto.id}" round "${r.name}" trigger condition ` +
            `"${trigger.condition.name}" has category "${trigger.condition.category}" — expected "auction".`,
        );
      }
    }
    if (r.seatFilter && r.seatFilter.category !== "auction") {
      throw new Error(
        `Protocol "${proto.id}" round "${r.name}" seatFilter ` +
          `"${r.seatFilter.name}" has category "${r.seatFilter.category}" — expected "auction".`,
      );
    }
  }
}
