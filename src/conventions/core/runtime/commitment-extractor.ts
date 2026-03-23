import type { Auction, Call, Seat } from "../../../engine/types";
import type {
  PublicConstraint,
} from "../../../core/contracts/agreement-module";
import type { BidMeaning } from "../../../core/contracts/meaning";
import { callsMatch, callKey } from "../../../engine/call-helpers";
import { resolveClause } from "../../pipeline/binding-resolver";

/**
 * Extract public commitments from an auction by matching each entry
 * against active meaning surfaces and deriving constraints from clauses.
 *
 * For each auction entry, the surfaceRouter determines which surfaces
 * are active at that position. If a surface's defaultCall matches the
 * actual call, public constraints are derived by filtering clauses
 * with `isPublic: true`.
 */
export function extractCommitments(
  auction: Auction,
  _seat: Seat,
  surfaceRouter: (auction: Auction, seat: Seat) => readonly BidMeaning[],
): readonly PublicConstraint[] {
  const commitments: PublicConstraint[] = [];

  for (let i = 0; i < auction.entries.length; i++) {
    const entry = auction.entries[i]!;

    // Build sub-auction up to entry i (entries 0..i-1 for context)
    const subAuction: Auction = {
      entries: auction.entries.slice(0, i),
      isComplete: false,
    };

    // Get active surfaces for this position and seat
    const activeSurfaces = surfaceRouter(subAuction, entry.seat);

    // Find surface whose defaultCall matches the actual call
    const matchingSurface = activeSurfaces.find((s) =>
      callsMatch(s.encoding.defaultCall, entry.call),
    );

    if (matchingSurface) {
      const callStr = callKey(entry.call);

      // Filter clauses with isPublic: true, resolving $-bindings first
      const resolvedClauses = matchingSurface.surfaceBindings
        ? matchingSurface.clauses.map(c => resolveClause(c, matchingSurface.surfaceBindings))
        : matchingSurface.clauses;
      const publicClauses = resolvedClauses.filter(c => c.isPublic === true);
      for (const clause of publicClauses) {
        commitments.push({
          subject: entry.seat,
          constraint: { factId: clause.factId, operator: clause.operator, value: clause.value, isPublic: true },
          origin: "call-meaning",
          strength: "hard",
          sourceCall: callStr,
          sourceMeaning: matchingSurface.meaningId,
        });
      }
    }
  }

  return commitments;
}
