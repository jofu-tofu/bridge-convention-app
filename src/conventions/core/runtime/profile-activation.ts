import type { SystemProfileIR, AttachmentIR } from "../../../core/contracts/agreement-module";
import type { AuctionPatternIR, PublicGuardIR } from "../../../core/contracts/predicate-surfaces";
import type { PublicSnapshot } from "../../../core/contracts/module-surface";
import type { Auction, Call, Seat } from "../../../engine/types";
import { BidSuit } from "../../../engine/types";
import { partnerSeat, nextSeat } from "../../../engine/constants";
import { formatCallString } from "./commitment-extractor";

const STRAIN_MAP: Record<string, BidSuit> = {
  C: BidSuit.Clubs,
  D: BidSuit.Diamonds,
  H: BidSuit.Hearts,
  S: BidSuit.Spades,
  NT: BidSuit.NoTrump,
};

/**
 * Resolve a semantic role (e.g. "opener", "responder") to a compass Seat
 * based on auction history. Returns undefined if the role cannot be resolved
 * (e.g. no bid has been made yet).
 */
function resolveAuctionRole(role: string, auction: Auction): Seat | undefined {
  const openerEntry = auction.entries.find(e => e.call.type === "bid");
  if (!openerEntry) return undefined;

  const openerSeat = openerEntry.seat;
  switch (role) {
    case "opener":
      return openerSeat;
    case "responder":
      return partnerSeat(openerSeat);
    case "overcaller":
      return nextSeat(openerSeat);
    case "advancer":
      return partnerSeat(nextSeat(openerSeat));
    default:
      return undefined;
  }
}

/**
 * Check whether the auction entries start with an expected sequence of call strings.
 * Reuses the same matching logic as surface-routing's auctionMatchesSequence.
 */
function matchesSequence(auction: Auction, calls: readonly string[]): boolean {
  if (auction.entries.length < calls.length) return false;

  for (let i = 0; i < calls.length; i++) {
    const entry = auction.entries[i]!;
    const exp = calls[i]!;

    if (exp === "P") {
      if (entry.call.type !== "pass") return false;
      continue;
    }

    if (entry.call.type !== "bid") return false;

    const match = exp.match(/^(\d)(NT|C|D|H|S)$/);
    if (!match) return false;

    const level = Number(match[1]);
    const strain = STRAIN_MAP[match[2]!];
    if (entry.call.level !== level || entry.call.strain !== strain) return false;
  }

  return true;
}

/**
 * Evaluate an AuctionPatternIR against the current auction.
 * - sequence: check if auction starts with these calls
 * - contains: check if auction contains the specified call (optionally by role)
 * - by-role: check if the last call by the specified role matches
 */
function matchesAuctionPattern(
  pattern: AuctionPatternIR,
  auction: Auction,
): boolean {
  switch (pattern.kind) {
    case "sequence":
      return matchesSequence(auction, pattern.calls);
    case "contains": {
      // Check if any entry in the auction matches the specified call,
      // optionally restricted to a specific role (e.g. "opener", "responder")
      const roleSeat = pattern.byRole
        ? resolveAuctionRole(pattern.byRole, auction)
        : undefined;
      if (pattern.byRole && roleSeat === undefined) return false;

      return auction.entries.some(e => {
        if (pattern.byRole && e.seat !== roleSeat) return false;
        return formatCallString(e.call) === pattern.call;
      });
    }
    case "by-role": {
      // Check if the last call by the specified role matches lastCall
      const seat = resolveAuctionRole(pattern.role, auction);
      if (seat === undefined) return false;

      // Find the last entry by this seat
      for (let i = auction.entries.length - 1; i >= 0; i--) {
        const entry = auction.entries[i]!;
        if (entry.seat === seat) {
          return formatCallString(entry.call) === pattern.lastCall;
        }
      }
      return false; // role's seat never acted
    }
  }
}

/**
 * Evaluate a PublicGuardIR against a public snapshot's registers.
 * Returns true if the guard condition is satisfied.
 */
function evaluatePublicGuard(
  guard: PublicGuardIR,
  publicRegisters: Readonly<Record<string, unknown>>,
): boolean {
  switch (guard.operator) {
    case "exists":
      return guard.field in publicRegisters;
    case "eq":
      return guard.field in publicRegisters && publicRegisters[guard.field] === guard.value;
    case "neq":
      return guard.field in publicRegisters && publicRegisters[guard.field] !== guard.value;
    case "in": {
      if (!Array.isArray(guard.value)) return false;
      if (!(guard.field in publicRegisters)) return false;
      return (guard.value as unknown[]).includes(publicRegisters[guard.field]);
    }
  }
}

/**
 * Check whether all required meaning family IDs have been committed to
 * in the public record. A meaning is "visible" when at least one
 * PublicConstraint with a matching sourceMeaning exists in publicCommitments.
 */
function hasVisibleMeanings(
  requiredIds: readonly string[],
  publicCommitments: readonly { readonly sourceMeaning?: string }[] | undefined,
): boolean {
  if (!publicCommitments || publicCommitments.length === 0) return false;

  const committedMeanings = new Set(
    publicCommitments
      .map((c) => c.sourceMeaning)
      .filter((m): m is string => m !== undefined),
  );

  return requiredIds.every((id) => committedMeanings.has(id));
}

/**
 * Check whether a single attachment's conditions are all met.
 */
function attachmentMatches(
  attachment: AttachmentIR,
  auction: Auction,
  capabilities: Readonly<Record<string, string>>,
  publicSnapshot?: PublicSnapshot,
): boolean {
  // whenAuction check
  if (attachment.whenAuction) {
    if (!matchesAuctionPattern(attachment.whenAuction, auction)) {
      return false;
    }
  }

  // requiresCapabilities check: all must be present in capabilities
  if (attachment.requiresCapabilities) {
    for (const cap of attachment.requiresCapabilities) {
      if (!(cap in capabilities)) {
        return false;
      }
    }
  }

  // whenPublic: evaluate guard against public snapshot registers
  if (attachment.whenPublic) {
    if (!publicSnapshot) return false;
    if (!evaluatePublicGuard(attachment.whenPublic, publicSnapshot.publicRegisters)) {
      return false;
    }
  }

  // requiresVisibleMeanings: all required meaning IDs must appear in publicCommitments
  if (attachment.requiresVisibleMeanings) {
    if (!publicSnapshot) return false;
    if (!hasVisibleMeanings(attachment.requiresVisibleMeanings, publicSnapshot.publicCommitments)) {
      return false;
    }
  }

  return true;
}

/**
 * Resolve which modules in a profile are active given the current auction state.
 *
 * A module is active if at least one of its attachments matches ALL its conditions:
 * - whenAuction: auction pattern match
 * - requiresCapabilities: all capabilities present in the provided set
 * - whenPublic: public snapshot register guard
 * - requiresVisibleMeanings: all required meaning IDs committed in public record
 *
 * @param profile - The system profile to evaluate
 * @param auction - Current auction state
 * @param _seat - The seat being evaluated (reserved for future use)
 * @param capabilities - Available capabilities (defaults to empty)
 * @param publicSnapshot - Optional public state for whenPublic / requiresVisibleMeanings
 * @returns Module IDs where at least one attachment matches
 */
export function resolveActiveModules(
  profile: SystemProfileIR,
  auction: Auction,
  _seat: unknown,
  capabilities: Readonly<Record<string, string>> = {},
  publicSnapshot?: PublicSnapshot,
): readonly string[] {
  const activeIds: string[] = [];

  for (const module of profile.modules) {
    const hasMatchingAttachment = module.attachments.some((attachment) =>
      attachmentMatches(attachment, auction, capabilities, publicSnapshot),
    );
    if (hasMatchingAttachment) {
      activeIds.push(module.moduleId);
    }
  }

  // Enforce exclusivity groups: only the highest-precedence module
  // (lowest index in profile.modules) survives per group.
  const exclusivityGroups = profile.conflictPolicy.exclusivityGroups;
  if (exclusivityGroups && exclusivityGroups.length > 0) {
    const precedence = resolveModulePrecedence(profile);
    const deactivated = new Set<string>();

    for (const group of exclusivityGroups) {
      // Find active members of this group, sorted by precedence (lowest index first)
      const activeMembers = group.memberModuleIds
        .filter((id) => activeIds.includes(id))
        .sort((a, b) => (precedence.get(a) ?? Infinity) - (precedence.get(b) ?? Infinity));

      // Deactivate all but the highest-precedence (first) member
      for (let i = 1; i < activeMembers.length; i++) {
        deactivated.add(activeMembers[i]!);
      }
    }

    if (deactivated.size > 0) {
      return activeIds.filter((id) => !deactivated.has(id));
    }
  }

  return activeIds;
}

/**
 * Compute module precedence from a profile's module ordering.
 * Maps each moduleId to its index position in the modules array.
 */
export function resolveModulePrecedence(
  profile: SystemProfileIR,
): ReadonlyMap<string, number> {
  const precedence = new Map<string, number>();
  for (let i = 0; i < profile.modules.length; i++) {
    precedence.set(profile.modules[i]!.moduleId, i);
  }
  return precedence;
}
