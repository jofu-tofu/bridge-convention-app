import type { SystemProfileIR, AttachmentIR } from "../../../core/contracts/agreement-module";
import type { AuctionPatternIR } from "../../../core/contracts/predicate-surfaces";
import type { Auction } from "../../../engine/types";
import { BidSuit } from "../../../engine/types";

const STRAIN_MAP: Record<string, BidSuit> = {
  C: BidSuit.Clubs,
  D: BidSuit.Diamonds,
  H: BidSuit.Hearts,
  S: BidSuit.Spades,
  NT: BidSuit.NoTrump,
};

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
 * - contains / by-role: stub as always-true (future implementation)
 */
function matchesAuctionPattern(
  pattern: AuctionPatternIR,
  auction: Auction,
): boolean {
  switch (pattern.kind) {
    case "sequence":
      return matchesSequence(auction, pattern.calls);
    case "contains":
      // Stub: always true for now
      return true;
    case "by-role":
      // Stub: always true for now
      return true;
  }
}

/**
 * Check whether a single attachment's conditions are all met.
 */
function attachmentMatches(
  attachment: AttachmentIR,
  auction: Auction,
  capabilities: Readonly<Record<string, string>>,
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

  // whenPublic: stub as always-true
  // requiresVisibleMeanings: stub as always-true

  return true;
}

/**
 * Resolve which modules in a profile are active given the current auction state.
 *
 * A module is active if at least one of its attachments matches ALL its conditions:
 * - whenAuction: auction pattern match
 * - requiresCapabilities: all capabilities present in the provided set
 * - whenPublic / requiresVisibleMeanings: stubbed as always-true
 *
 * @param profile - The system profile to evaluate
 * @param auction - Current auction state
 * @param _seat - The seat being evaluated (reserved for future use)
 * @param capabilities - Available capabilities (defaults to empty)
 * @returns Module IDs where at least one attachment matches
 */
export function resolveActiveModules(
  profile: SystemProfileIR,
  auction: Auction,
  _seat: unknown,
  capabilities: Readonly<Record<string, string>> = {},
): readonly string[] {
  const activeIds: string[] = [];

  for (const module of profile.modules) {
    const hasMatchingAttachment = module.attachments.some((attachment) =>
      attachmentMatches(attachment, auction, capabilities),
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
