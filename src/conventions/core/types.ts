import type {
  DealConstraints,
  Deal,
} from "../../engine/types";
import type { Seat } from "../../engine/types";
import type { Auction } from "../../engine/types";
export type { BiddingContext } from "../../core/contracts";

export enum ConventionCategory {
  Asking = "Asking",
  Defensive = "Defensive",
  Constructive = "Constructive",
  Competitive = "Competitive",
}

/** Convention-level teaching metadata. */
export interface ConventionTeaching {
  /** Why this convention exists — the problem it solves. */
  readonly purpose?: string;
  /** When to use this convention — the trigger conditions in plain English. */
  readonly whenToUse?: string;
  /** When NOT to use this convention — common misapplications. */
  readonly whenNotToUse?: readonly string[];
  /** What you give up by using this convention. */
  readonly tradeoff?: string;
  /** The underlying bridge principle. */
  readonly principle?: string;
  /** Who controls the auction — captain/roles. */
  readonly roles?: string;
}

export interface ConventionConfig {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: ConventionCategory;
  /** Teaching metadata — optional, populated in explanations.ts per convention. */
  readonly teaching?: ConventionTeaching;
  readonly dealConstraints: DealConstraints;
  /** Returns the default auction context for a given seat, or undefined for empty auction. */
  readonly defaultAuction?: (seat: Seat, deal?: Deal) => Auction | undefined;
  /** If true, convention is internal (e.g., SAYC for opponents) and hidden from UI picker. */
  readonly internal?: boolean;
  /** If set, drill infrastructure picks a random dealer from this list.
   *  When the chosen dealer differs from dealConstraints.dealer, all seat
   *  constraints and auction entries are rotated 180 degrees (N<->S, E<->W).
   *  Entries should be from the same partnership pair (E+W or N+S). */
  readonly allowedDealers?: readonly Seat[];
}

/** Resolves a convention config by ID. Must throw on unknown IDs (same as getConvention). */
export type ConventionLookup = (id: string) => ConventionConfig;
