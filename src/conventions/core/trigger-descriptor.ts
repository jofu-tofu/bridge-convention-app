// TriggerDescriptor — structured metadata for semantic overlap/subsumption analysis.
// Attached to RuleCondition by condition factories, used by diagnostics analyzers.

import type { BidSuit } from "../../engine/types";

export type TriggerDescriptor =
  | { readonly kind: "bid-made"; readonly level: number; readonly strain: BidSuit; readonly actor: DescriptorActor }
  | { readonly kind: "bid-at-level"; readonly level: number; readonly actor: DescriptorActor }
  | { readonly kind: "double"; readonly actor: DescriptorActor }
  | { readonly kind: "cursor-reached" }
  | { readonly kind: "no-prior-bid" }
  | { readonly kind: "role"; readonly role: "opener" | "responder" }
  | { readonly kind: "bidding-round"; readonly n: number }
  | { readonly kind: "compound-or"; readonly children: readonly TriggerDescriptor[] }
  | { readonly kind: "compound-and"; readonly children: readonly TriggerDescriptor[] }
  | { readonly kind: "negation"; readonly child: TriggerDescriptor }
  | { readonly kind: "opaque" };

export type DescriptorActor = "any" | "partner" | "opponent";

/** Actor subsumption: "any" subsumes both "partner" and "opponent"; same subsumes same. */
function actorSubsumes(a: DescriptorActor, b: DescriptorActor): boolean {
  if (a === "any") return true;
  return a === b;
}

/** Actor compatibility: true if two actors could refer to the same seat. */
function actorsCompatible(a: DescriptorActor, b: DescriptorActor): boolean {
  if (a === "any" || b === "any") return true;
  return a === b;
}

/**
 * True if descriptors `a` and `b` can never match the same event.
 * Conservative — returns false when uncertain.
 */
export function descriptorsDisjoint(a: TriggerDescriptor | undefined, b: TriggerDescriptor | undefined): boolean {
  if (!a || !b) return false;
  if (a.kind === "opaque" || b.kind === "opaque") return false;

  // cursor-reached matches everything
  if (a.kind === "cursor-reached" || b.kind === "cursor-reached") return false;

  // negation — conservative
  if (a.kind === "negation" || b.kind === "negation") return false;

  // role disjointness
  if (a.kind === "role" && b.kind === "role") return a.role !== b.role;

  // bidding-round disjointness
  if (a.kind === "bidding-round" && b.kind === "bidding-round") return a.n !== b.n;

  // no-prior-bid disjoint from responder (responder implies prior bid)
  if (a.kind === "no-prior-bid" && b.kind === "role" && b.role === "responder") return true;
  if (b.kind === "no-prior-bid" && a.kind === "role" && a.role === "responder") return true;

  // bid-made disjointness (different level or strain)
  if (a.kind === "bid-made" && b.kind === "bid-made") {
    return a.level !== b.level || a.strain !== b.strain;
  }

  // compound-or is disjoint if ALL children are disjoint from b
  if (a.kind === "compound-or") return a.children.every(c => descriptorsDisjoint(c, b));
  if (b.kind === "compound-or") return b.children.every(c => descriptorsDisjoint(a, c));

  // compound-and is disjoint if ANY child is disjoint from b
  if (a.kind === "compound-and") return a.children.some(c => descriptorsDisjoint(c, b));
  if (b.kind === "compound-and") return b.children.some(c => descriptorsDisjoint(a, c));

  return false;
}

/**
 * True if every event matching `b` also matches `a` (a is broader than or equal to b).
 *
 * **Load-bearing invariant:** `undefined` and `opaque` descriptors NEVER cause this
 * to return true. This prevents false positives from incomplete metadata.
 */
export function descriptorSubsumes(a: TriggerDescriptor | undefined, b: TriggerDescriptor | undefined): boolean {
  if (!a || !b) return false;
  if (a.kind === "opaque" || b.kind === "opaque") return false;

  // cursor-reached subsumes everything
  if (a.kind === "cursor-reached") return true;

  // negation — too complex for subsumption
  if (a.kind === "negation" || b.kind === "negation") return false;

  // bid-at-level subsumes bid-made at same level
  if (a.kind === "bid-at-level" && b.kind === "bid-made") {
    return a.level === b.level && actorSubsumes(a.actor, b.actor);
  }

  // bid-made subsumes bid-made with same level/strain and actor subsumption
  if (a.kind === "bid-made" && b.kind === "bid-made") {
    return a.level === b.level && a.strain === b.strain && actorSubsumes(a.actor, b.actor);
  }

  // bid-at-level subsumes bid-at-level at same level
  if (a.kind === "bid-at-level" && b.kind === "bid-at-level") {
    return a.level === b.level && actorSubsumes(a.actor, b.actor);
  }

  // double subsumes double
  if (a.kind === "double" && b.kind === "double") {
    return actorSubsumes(a.actor, b.actor);
  }

  // role matches role
  if (a.kind === "role" && b.kind === "role") return a.role === b.role;

  // bidding-round matches bidding-round
  if (a.kind === "bidding-round" && b.kind === "bidding-round") return a.n === b.n;

  // no-prior-bid matches no-prior-bid
  if (a.kind === "no-prior-bid" && b.kind === "no-prior-bid") return true;

  // compound-or: a subsumes b if any child of a subsumes b
  if (a.kind === "compound-or") return a.children.some(c => descriptorSubsumes(c, b));

  // X subsumes compound-and: X must subsume every child
  if (b.kind === "compound-and") return b.children.every(c => descriptorSubsumes(a, c));

  // compound-and subsumes X: all children must subsume X (very restrictive, correct)
  if (a.kind === "compound-and") return a.children.every(c => descriptorSubsumes(c, b));

  return false;
}

/**
 * True if some event could match both `a` and `b`.
 *
 * **Load-bearing invariant:** `undefined` and `opaque` descriptors NEVER cause this
 * to return true. This prevents false positives from incomplete metadata.
 */
export function descriptorOverlaps(a: TriggerDescriptor | undefined, b: TriggerDescriptor | undefined): boolean {
  if (!a || !b) return false;
  if (a.kind === "opaque" || b.kind === "opaque") return false;

  // cursor-reached overlaps with everything
  if (a.kind === "cursor-reached" || b.kind === "cursor-reached") return true;

  // negation — delegate to child with inverted logic (conservative: return false when uncertain)
  if (a.kind === "negation") return !descriptorSubsumes(a.child, b);
  if (b.kind === "negation") return !descriptorSubsumes(b.child, a);

  // bid-made overlaps bid-made when L/S match and actors compatible
  if (a.kind === "bid-made" && b.kind === "bid-made") {
    return a.level === b.level && a.strain === b.strain && actorsCompatible(a.actor, b.actor);
  }

  // bid-at-level overlaps bid-made at same level when actors compatible
  if (a.kind === "bid-at-level" && b.kind === "bid-made") {
    return a.level === b.level && actorsCompatible(a.actor, b.actor);
  }
  if (b.kind === "bid-at-level" && a.kind === "bid-made") {
    return b.level === a.level && actorsCompatible(b.actor, a.actor);
  }

  // bid-at-level overlaps bid-at-level at same level
  if (a.kind === "bid-at-level" && b.kind === "bid-at-level") {
    return a.level === b.level && actorsCompatible(a.actor, b.actor);
  }

  // double overlaps double when actors compatible
  if (a.kind === "double" && b.kind === "double") {
    return actorsCompatible(a.actor, b.actor);
  }

  // role overlaps role only if same
  if (a.kind === "role" && b.kind === "role") return a.role === b.role;

  // bidding-round overlaps only if same
  if (a.kind === "bidding-round" && b.kind === "bidding-round") return a.n === b.n;

  // no-prior-bid overlaps no-prior-bid
  if (a.kind === "no-prior-bid" && b.kind === "no-prior-bid") return true;

  // compound-or overlaps X if any child overlaps X
  if (a.kind === "compound-or") return a.children.some(c => descriptorOverlaps(c, b));
  if (b.kind === "compound-or") return b.children.some(c => descriptorOverlaps(a, c));

  // compound-and overlaps X if (a) internal consistency holds (no disjoint child pairs)
  // AND (b) no child is disjoint from X AND (c) at least one child overlaps X
  if (a.kind === "compound-and") {
    for (let i = 0; i < a.children.length; i++) {
      for (let j = i + 1; j < a.children.length; j++) {
        if (descriptorsDisjoint(a.children[i], a.children[j])) return false;
      }
    }
    if (a.children.some(c => descriptorsDisjoint(c, b))) return false;
    return a.children.some(c => descriptorOverlaps(c, b));
  }
  if (b.kind === "compound-and") {
    for (let i = 0; i < b.children.length; i++) {
      for (let j = i + 1; j < b.children.length; j++) {
        if (descriptorsDisjoint(b.children[i], b.children[j])) return false;
      }
    }
    if (b.children.some(c => descriptorsDisjoint(a, c))) return false;
    return b.children.some(c => descriptorOverlaps(a, c));
  }

  // Different kinds with no overlap rule — conservative false
  return false;
}
