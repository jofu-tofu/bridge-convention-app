/**
 * BiddingSystem — thin composition layer that selects modules into a practicable unit.
 *
 * A bidding system is NOT a module. It is a system profile (which modules to
 * activate) plus UI metadata and optional cross-module concerns. All bidding
 * logic, teaching metadata, and grading metadata originates from modules —
 * the system merely aggregates them.
 *
 * This replaces the ConventionBundle god object with a focused interface
 * aligned to the two-layer architecture: modules + systems.
 */

import type { DealConstraints, Deal, Seat, Auction } from "../../engine/types";
import type { SystemProfileIR } from "../../core/contracts/agreement-module";
import type { ConventionCategory } from "../../core/contracts/convention";

export interface BiddingSystem {
  /** Unique system identifier (kebab-case). */
  readonly id: string;
  /** Human-readable display name. */
  readonly name: string;
  /** One-line description for UI display. */
  readonly description: string;
  /** Convention category for UI grouping. */
  readonly category: ConventionCategory;
  /** If true, hidden from UI picker. */
  readonly internal?: boolean;

  /** System profile — declares which modules to activate and when. */
  readonly profile: SystemProfileIR;
  /** Module IDs that this system composes. */
  readonly moduleIds: readonly string[];

  /** Deal constraints for drill generation. */
  readonly dealConstraints: DealConstraints;
  /** Off-convention constraints for hands where the convention doesn't apply. */
  readonly offConventionConstraints?: DealConstraints;
  /** Pre-filled auction for drill start position. */
  readonly defaultAuction?: (seat: Seat, deal?: Deal) => Auction | undefined;

  /** Capabilities injected into profile-based activation. */
  readonly declaredCapabilities?: Readonly<Record<string, string>>;

}
