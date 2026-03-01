import type { BiddingContext } from "./types";
import type { AuctionEntry, Seat } from "../../engine/types";
import type { HandNode } from "./rule-tree";
import { partnerSeat } from "../../engine/constants";
import type {
  EstablishedContext,
  ConventionProtocol,
  ProtocolRound,
  SemanticTrigger,
  ProtocolEvalResult,
  MatchedRoundEntry,
  AuctionRole,
} from "./protocol";
import type { TreeEvalResult } from "./tree-evaluator";
import { evaluateTree } from "./tree-evaluator";

// ─── Role computation ────────────────────────────────────────

/**
 * Compute the role of a seat in the auction.
 * - opener: seat made (or will make) the first non-pass bid
 * - responder: partner made the first non-pass bid
 * - competitive: an opponent made the first non-pass bid and seat hasn't bid
 * - rebidder: seat has already made a bid (for future rounds)
 */
export function computeRole(entries: readonly AuctionEntry[], seat: Seat): AuctionRole {
  let seatHasBid = false;
  let firstBidder: Seat | null = null;

  for (const entry of entries) {
    if (entry.call.type === "bid") {
      if (!firstBidder) firstBidder = entry.seat;
      if (entry.seat === seat) seatHasBid = true;
    }
  }

  if (seatHasBid && firstBidder === seat) {
    // We opened and have already bid — count our bids
    let bidCount = 0;
    for (const entry of entries) {
      if (entry.call.type === "bid" && entry.seat === seat) bidCount++;
    }
    return bidCount > 1 ? "rebidder" : "opener";
  }

  if (seatHasBid) return "rebidder";

  // Seat hasn't bid yet
  if (!firstBidder) return "opener"; // No bids yet — we could open
  if (firstBidder === seat) return "opener"; // Should not happen (seatHasBid would be true)
  if (firstBidder === partnerSeat(seat)) return "responder";
  return "competitive";
}

// ─── Cursor-based context ────────────────────────────────────

/**
 * Create a BiddingContext view where the auction starts from a cursor position.
 * The trigger condition evaluates against this "windowed" context.
 */
function contextAtCursor(context: BiddingContext, cursor: number): BiddingContext {
  if (cursor === 0) return context;
  return {
    ...context,
    auction: {
      ...context.auction,
      entries: context.auction.entries.slice(0, cursor + 2),
    },
  };
}

// ─── Resolve hand tree ───────────────────────────────────────

function resolveHandTree<T extends EstablishedContext>(
  handTree: HandNode | ((established: T) => HandNode),
  established: T,
): HandNode {
  if (typeof handTree === "function") {
    return handTree(established);
  }
  return handTree;
}

// ─── Null hand result ────────────────────────────────────────

function noMatchHandResult(): TreeEvalResult {
  return { matched: null, path: [], rejectedDecisions: [], visited: [] };
}

// ─── Protocol evaluator ──────────────────────────────────────

/**
 * Evaluate a convention protocol against a bidding context.
 *
 * Walks rounds sequentially, testing trigger conditions against the auction
 * from the current cursor position. Each matched trigger advances the cursor
 * by 2 (one conversation turn = bid + pass). Accumulated context flows into
 * subsequent rounds.
 */
export function evaluateProtocol<T extends EstablishedContext>(
  proto: ConventionProtocol<T>,
  context: BiddingContext,
  triggerOverrides?: ReadonlyMap<string, readonly SemanticTrigger[]>,
): ProtocolEvalResult<T> {
  const role = computeRole(context.auction.entries, context.seat);
  let established = { role } as T;
  let cursor = 0;
  let activeRound: ProtocolRound<T> | null = null;
  const matchedRounds: MatchedRoundEntry<T>[] = [];

  for (const r of proto.rounds) {
    // Test trigger variants from cursor position
    let matchedTrigger: SemanticTrigger<T> | null = null;

    const cursorCtx = contextAtCursor(context, cursor);

    // Use override triggers if provided, else original
    const effectiveTriggers = (triggerOverrides?.get(r.name) ?? r.triggers) as readonly SemanticTrigger<T>[];

    for (const trigger of effectiveTriggers) {
      if (trigger.condition.test(cursorCtx)) {
        matchedTrigger = trigger;
        break;
      }
    }

    if (!matchedTrigger) {
      // No trigger matched — auction hasn't reached this round
      break;
    }

    // Advance cursor and accumulate context
    // Bridge partnerships are always 2 positions apart in the clockwise
    // auction (N→E→S→W). cursor += 2 advances to the next position where
    // this partnership would bid, regardless of opponent actions.
    cursor += 2;
    established = { ...established, ...matchedTrigger.establishes } as T;
    matchedRounds.push({ round: r, trigger: matchedTrigger });

    // seatFilter: evaluated against the FULL context (not windowed).
    // If present and fails, cursor still advances (the milestone happened)
    // but activeRound is NOT updated (this seat doesn't act in this round).
    // ctx.seat is fixed throughout evaluation, so seatFilter correctly
    // checks the evaluating seat's role.
    if (!r.seatFilter || r.seatFilter.test(context)) {
      activeRound = r;
    }
  }

  // Evaluate hand tree of active round
  if (!activeRound) {
    return {
      matched: null,
      matchedRounds,
      established,
      handResult: noMatchHandResult(),
      activeRound: null,

      handTreeRoot: null,
    };
  }

  try {
    const handTree = resolveHandTree(activeRound.handTree, established);
    const handResult = evaluateTree(handTree, context);
    return {
      matched: handResult.matched,
      matchedRounds,
      established,
      handResult,
      activeRound,

      handTreeRoot: handTree,
    };
  } catch {
    // handTree function threw — log warning and return no match
    // eslint-disable-next-line no-console -- intentional: surface handTree errors in dev
    console.warn(`Protocol "${proto.id}" handTree threw for round "${activeRound.name}"`);
    return {
      matched: null,
      matchedRounds,
      established,
      handResult: noMatchHandResult(),
      activeRound,

      handTreeRoot: null,
    };
  }
}
