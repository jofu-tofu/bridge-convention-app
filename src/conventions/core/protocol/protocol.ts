import type { AuctionCondition } from "../types";
import type { HandNode, IntentNode } from "../tree/rule-tree";
import type { TreeEvalResult } from "../tree/tree-evaluator";

// ─── Established context ─────────────────────────────────────

/** Base context accumulated across protocol rounds.
 *  Empty marker interface — convention-specific fields (like `showed`,
 *  `openingSuit`) live in per-convention extensions. Semantic role authority
 *  lives in DialogueState (obligation, captain, frames). */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- marker interface for generic constraint
export interface EstablishedContext {}

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
  /** Optional seat filter — evaluated against the FULL context (not windowed).
   *  If present and fails, cursor still advances (the milestone happened) but
   *  activeRound is NOT updated (this seat doesn't act in this round). */
  readonly seatFilter?: AuctionCondition;
  /** How many auction entries this round's event spans.
   *  Default: 2 (one partnership turn pair).
   *  Use 1 for single-entry events, 3 for events spanning extra actions,
   *  0 for virtual rounds that don't advance the cursor. */
  readonly span?: number;
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
  /** Cursor position at the start of this round's event span. */
  readonly cursorStart: number;
  /** Cursor position after this round's event span (cursorStart + span). */
  readonly cursorEnd: number;
}

/** Result of evaluating a convention protocol. */
export interface ProtocolEvalResult<T extends EstablishedContext = EstablishedContext> {
  /** The matched IntentNode (null if convention doesn't apply). */
  readonly matched: IntentNode | null;
  /** Rounds that matched sequentially. */
  readonly matchedRounds: readonly MatchedRoundEntry<T>[];
  /** The accumulated established context. */
  readonly established: T;
  /** The hand evaluation result from the active round. */
  readonly handResult: TreeEvalResult;
  /** The active round (last matched round). Null if no rounds matched. */
  readonly activeRound: ProtocolRound<T> | null;
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
    seatFilter?: AuctionCondition;
    span?: number;
  },
): ProtocolRound<T> {
  return {
    name,
    triggers: config.triggers,
    handTree: config.handTree,
    seatFilter: config.seatFilter,
    span: config.span,
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
    if (r.span !== undefined && (r.span < 0 || !Number.isInteger(r.span))) {
      throw new Error(
        `Protocol "${proto.id}" round "${r.name}" has invalid span: ${r.span}.`,
      );
    }
    for (const trigger of r.triggers) {
      if (trigger.condition.category !== "auction") {
        throw new Error(
          `Protocol "${proto.id}" round "${r.name}" trigger condition ` +
            `"${String(trigger.condition.name)}" has category "${String(trigger.condition.category)}" — expected "auction".`,
        );
      }
    }
    if (r.seatFilter && r.seatFilter.category !== "auction") {
      throw new Error(
        `Protocol "${proto.id}" round "${r.name}" seatFilter ` +
          `"${String(r.seatFilter.name)}" has category "${String(r.seatFilter.category)}" — expected "auction".`,
      );
    }
  }
}
