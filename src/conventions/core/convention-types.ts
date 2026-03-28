import type {
  DealConstraints,
  Deal,
} from "../../engine/types";
import type { Seat } from "../../engine/types";
import type { Auction } from "../../engine/types";

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
  /** Deal constraints for off-convention hands (convention doesn't apply).
   *  Used when the user enables off-convention practice in drill tuning. */
  readonly offConventionConstraints?: DealConstraints;
  /** Returns the default auction context for a given seat, or undefined for empty auction. */
  readonly defaultAuction?: (seat: Seat, deal?: Deal) => Auction | undefined;
  /** If true, convention is internal (e.g., SAYC for opponents) and hidden from UI picker. */
  readonly internal?: boolean;
  /** If set, drill infrastructure picks a random dealer from this list.
   *  When the chosen dealer differs from dealConstraints.dealer, all seat
   *  constraints and auction entries are rotated 180 degrees (N<->S, E<->W).
   *  Entries should be from the same partnership pair (E+W or N+S). */
  readonly allowedDealers?: readonly Seat[];
  /** If true, convention behavior varies depending on the selected bidding system
   *  (some surfaces reference system facts like HCP thresholds that differ between SAYC/2-1/Acol).
   *  Derived at bundle build time from surface clause factIds — not hand-authored. */
  readonly variesBySystem?: boolean;
  /** Per-module descriptions from the resolved bundle (moduleId → description). */
  readonly moduleDescriptions?: ReadonlyMap<string, string>;
  /** Per-module purposes from the resolved bundle (moduleId → purpose). */
  readonly modulePurposes?: ReadonlyMap<string, string>;
  /** Whether the user can choose to practice as opener, responder, or both.
   *  Derived from archetype partnership membership — true when opener and
   *  practitioner are in the same N/S partnership. */
  readonly supportsRoleSelection?: boolean;
}

