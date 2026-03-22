import type { Auction, Call, Seat } from "../../../engine/types";
import type {
  PublicConstraint,
  ChoiceClosurePolicy,
} from "../../../core/contracts/agreement-module";
import type { BidMeaning } from "../../../core/contracts/meaning";
import { callsMatch, callKey } from "../../../engine/call-helpers";
import { derivePublicConstraints } from "../../../core/contracts/alert";
import { resolveClause } from "../pipeline/binding-resolver";

/**
 * Derive entailed denials from a closure policy.
 *
 * When a surface with a closurePolicy is chosen, the unchosen peer surfaces'
 * auto-derived public constraints become entailed denials. This captures the
 * logical implication: if the domain is exclusive+exhaustive+mandatory and you
 * chose X, then you did NOT choose Y or Z, so Y's and Z's public constraints
 * are denied.
 *
 * Only unchosen surfaces' derived PROMISES become entailed denials.
 * Unchosen denies are NOT inverted — denial-of-denial creates ambiguity.
 * @internal
 */
export function deriveEntailedDenials(
  matchingSurface: BidMeaning,
  closurePolicy: ChoiceClosurePolicy,
  entry: { seat: Seat; call: Call },
  surfaceRouter: (auction: Auction, seat: Seat) => readonly BidMeaning[],
  subAuction: Auction,
): readonly PublicConstraint[] {
  // Only derive denials when all three conditions hold
  if (
    !closurePolicy.exclusive ||
    !closurePolicy.exhaustive ||
    !closurePolicy.mandatory
  ) {
    return [];
  }

  const denials: PublicConstraint[] = [];
  const callStr = callKey(entry.call);

  // Re-query active surfaces at the same position to find peer surfaces
  const activeSurfaces = surfaceRouter(subAuction, entry.seat);

  const domain = closurePolicy.domain;
  const peerSurfaces = activeSurfaces.filter((s) => {
    if (s === matchingSurface) return false;
    switch (domain.kind) {
      case "surface":
        // All surfaces from the same router query are peers
        return true;
      case "semantic-class-set":
        return domain.ids.includes(s.semanticClassId);
      case "module-frontier":
        return s.moduleId === domain.id;
    }
  });

  for (const peer of peerSurfaces) {
    // Auto-derive public constraints from peer's clauses, resolving $-bindings
    const resolvedClauses = peer.surfaceBindings
      ? peer.clauses.map(c => resolveClause(c, peer.surfaceBindings))
      : peer.clauses;
    const peerConstraints = derivePublicConstraints(resolvedClauses);

    for (const constraint of peerConstraints) {
      denials.push({
        subject: entry.seat,
        constraint,
        origin: "entailed-denial",
        strength: "entailed",
        sourceCall: callStr,
        sourceMeaning: matchingSurface.meaningId,
      });
    }
  }

  return denials;
}

/**
 * Extract public commitments from an auction by matching each entry
 * against active meaning surfaces and deriving constraints from clauses.
 *
 * For each auction entry, the surfaceRouter determines which surfaces
 * are active at that position. If a surface's defaultCall matches the
 * actual call, public constraints are auto-derived from its primitive/
 * bridge-observable clauses. Explicit denials and closure policy
 * (entailed denials) are also extracted.
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

      // Auto-derive public constraints from primitive/bridge-observable clauses
      // Resolve $-bindings before deriving constraints so factIds are concrete
      const resolvedClauses = matchingSurface.surfaceBindings
        ? matchingSurface.clauses.map(c => resolveClause(c, matchingSurface.surfaceBindings))
        : matchingSurface.clauses;
      const publicConstraints = derivePublicConstraints(resolvedClauses);
      for (const constraint of publicConstraints) {
        commitments.push({
          subject: entry.seat,
          constraint,
          origin: "call-meaning",
          strength: "hard",
          sourceCall: callStr,
          sourceMeaning: matchingSurface.meaningId,
        });
      }

      // Derive entailed denials from closure policy
      if (matchingSurface.closurePolicy) {
        const entailedDenials = deriveEntailedDenials(
          matchingSurface,
          matchingSurface.closurePolicy,
          entry,
          surfaceRouter,
          subAuction,
        );
        commitments.push(...entailedDenials);
      }
    }
  }

  return commitments;
}
