import type { BiddingContext } from "../types";
import type { HandNode } from "../tree/rule-tree";
import type {
  EstablishedContext,
  ConventionProtocol,
  ProtocolRound,
  SemanticTrigger,
  ProtocolEvalResult,
  MatchedRoundEntry,
} from "./protocol";
import type { TreeEvalResult } from "../tree/tree-evaluator";
import { evaluateTree } from "../tree/tree-evaluator";

// ─── Cursor-based context ────────────────────────────────────

/**
 * Create a BiddingContext view with only the event-local span at the cursor.
 * The trigger condition evaluates against entries [cursor, cursor+span) — the
 * current event span, not the full prefix.
 */
function contextAtCursor(context: BiddingContext, cursor: number, span: number): BiddingContext {
  return {
    ...context,
    auction: {
      ...context.auction,
      entries: context.auction.entries.slice(cursor, cursor + span),
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
  // Double cast: T extends EstablishedContext (empty marker), convention extensions
  // add optional fields populated by trigger.establishes merges below.
  let established = {} as unknown as T;
  let cursor = 0;
  let activeRound: ProtocolRound<T> | null = null;
  const matchedRounds: MatchedRoundEntry<T>[] = [];
  let lastSpanZro = false; // span=0 loop guard

  for (const r of proto.rounds) {
    const span = r.span ?? 2;

    // span=0 loop guard: after a span=0 round matches, break immediately
    // to prevent infinite loops from consecutive span=0 rounds
    if (lastSpanZro && span === 0) {
      break;
    }

    // Test trigger variants from cursor position
    let matchedTrigger: SemanticTrigger<T> | null = null;

    const cursorCtx = contextAtCursor(context, cursor, span);

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
    const cursorStart = cursor;
    cursor += span;
    lastSpanZro = span === 0;
    established = { ...established, ...matchedTrigger.establishes } as T;
    matchedRounds.push({ round: r, trigger: matchedTrigger, cursorStart, cursorEnd: cursor });

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
