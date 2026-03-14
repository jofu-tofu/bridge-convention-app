import type { Auction, Call, Seat } from "../../../engine/types";
import type {
  PublicConstraint,
  ChoiceClosurePolicy,
} from "../../../core/contracts/agreement-module";
import type { MeaningSurface } from "../../../core/contracts/meaning-surface";
import { callsMatch } from "../../../engine/call-helpers";

/** Format a Call object into a human-readable string (e.g., "1NT", "P", "X", "XX"). */
export function formatCallString(call: Call): string {
  if (call.type === "bid") return `${call.level}${call.strain}`;
  if (call.type === "pass") return "P";
  if (call.type === "double") return "X";
  return "XX";
}

/**
 * Derive entailed denials from a closure policy.
 *
 * When a surface with a closurePolicy is chosen, the unchosen peer surfaces'
 * promises become entailed denials. This captures the logical implication:
 * if the domain is exclusive+exhaustive+mandatory and you chose X, then you
 * did NOT choose Y or Z, so Y's and Z's promises are denied.
 *
 * Closure policy: only unchosen surfaces' PROMISES become entailed denials.
 * Unchosen denies are NOT inverted — denial-of-denial creates ambiguity
 * (e.g., if deny-major denies hasFourCardMajor, and deny-major is unchosen,
 * we do NOT entail hasFourCardMajor=true — the show-hearts/show-spades
 * surfaces already promise that explicitly).
 */
export function deriveEntailedDenials(
  matchingSurface: MeaningSurface,
  closurePolicy: ChoiceClosurePolicy,
  entry: { seat: Seat; call: Call },
  surfaceRouter: (auction: Auction, seat: Seat) => readonly MeaningSurface[],
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
  const callStr = formatCallString(entry.call);

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
    if (!peer.publicConsequences) continue;

    for (const promise of peer.publicConsequences.promises) {
      denials.push({
        subject: entry.seat,
        constraint: promise,
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
 * against active meaning surfaces and collecting their publicConsequences.
 *
 * For each auction entry, the surfaceRouter determines which surfaces
 * are active at that position. If a surface's defaultCall matches the
 * actual call and it has publicConsequences, the promises and denials
 * are converted into PublicConstraint objects.
 *
 * A second pass derives entailed denials from closure policies: when a
 * surface in a closed domain is chosen, unchosen peers' promises become
 * entailed denials.
 */
export function extractCommitments(
  auction: Auction,
  _seat: Seat,
  surfaceRouter: (auction: Auction, seat: Seat) => readonly MeaningSurface[],
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

    if (matchingSurface?.publicConsequences) {
      const consequences = matchingSurface.publicConsequences;
      const callStr = formatCallString(entry.call);

      for (const promise of consequences.promises) {
        commitments.push({
          subject: entry.seat,
          constraint: promise,
          origin: "call-meaning",
          strength: "hard",
          sourceCall: callStr,
          sourceMeaning: matchingSurface.meaningId,
        });
      }

      if (consequences.denies) {
        for (const denial of consequences.denies) {
          commitments.push({
            subject: entry.seat,
            constraint: denial,
            origin: "explicit-denial",
            strength: "hard",
            sourceCall: callStr,
            sourceMeaning: matchingSurface.meaningId,
          });
        }
      }

      // Derive entailed denials from closure policy
      if (consequences.closurePolicy) {
        const entailedDenials = deriveEntailedDenials(
          matchingSurface,
          consequences.closurePolicy,
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
