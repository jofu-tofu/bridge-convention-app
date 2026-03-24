import type { FactOperator } from "../pipeline/meaning";

// ─── Auction pattern matching ───────────────────────────────
export type AuctionPattern =
  | { readonly kind: "sequence"; readonly calls: readonly string[] }
  | { readonly kind: "contains"; readonly call: string; readonly byRole?: string }
  | { readonly kind: "by-role"; readonly role: string; readonly lastCall: string };

// ─── Public snapshot guard ──────────────────────────────────
export interface PublicGuard {
  readonly field: string;
  readonly operator: "eq" | "neq" | "in" | "exists";
  readonly value?: unknown;
}

// ─── Hand predicate (fact-based) ────────────────────────────
export interface HandPredicate {
  readonly clauses: readonly FactConstraint[];
  readonly conjunction: "all" | "any";
}

// ─── Deal constraints ───────────────────────────────────────
export interface DealConstraint {
  readonly kind: "fit-check" | "combined-hcp" | "custom";
  readonly params: Readonly<Record<string, unknown>>;
}

// ─── Module classification ──────────────────────────────────
export type ModuleKind = "base-system" | "add-on" | "competitive-treatment" | "slam-tool" | "defensive";

// ─── Attachment contract ────────────────────────────────────
export interface Attachment {
  readonly whenAuction?: AuctionPattern;
  readonly whenPublic?: PublicGuard;
  readonly requiresCapabilities?: readonly string[];
  readonly requiresVisibleMeanings?: readonly string[];
}

// ─── Fact constraint ────────────────────────────────────────
export interface FactConstraint {
  readonly factId: string;
  readonly operator: FactOperator;
  readonly value: number | boolean | string | { min: number; max: number } | readonly string[];
  /** When true, this constraint represents information disclosed to opponents
   *  (communicative). When false or absent, the constraint is internal evaluation
   *  logic (routing). Travels with the constraint through the entire pipeline —
   *  BidAnnotation, PublicBeliefs, posterior engine can all read it directly. */
  readonly isPublic?: boolean;
}


import type { SystemConfig } from "../definitions/system-config";
import type { BaseSystemId } from "../definitions/system-config";

// ─── System Profile ─────────────────────────────────────────
export interface SystemProfile {
  readonly profileId: string;
  readonly baseSystem: BaseSystemId;
  /** System-level bidding configuration (HCP ranges, thresholds).
   *  When present, convention modules use these values instead of hardcoded defaults. */
  readonly systemConfig?: SystemConfig;
  readonly modules: readonly ModuleEntry[];
}

export interface ModuleEntry {
  readonly moduleId: string;
  readonly kind: ModuleKind;
  readonly attachments: readonly Attachment[];
  readonly options?: Readonly<Record<string, unknown>>;
}

// ─── Encoding types ─────────────────────────────────────────
// DeclaredEncoderKind describes what KIND of encoder a surface declares.
// This is DISTINCT from EncoderKind in provenance.ts which describes how
// encoding was resolved at runtime ("default-call" | "resolver" | etc.).
export type DeclaredEncoderKind = "direct" | "choice-set" | "frontier-step" | "relay-map";

// ─── Public state events/constraints ────────────────────────
export interface PublicEvent {
  readonly eventIndex: number;
  readonly call: string;
  readonly seat: string;
}

export interface PublicConstraint {
  readonly subject: string;
  readonly constraint: FactConstraint;
  readonly origin: "call-meaning";
  readonly strength: "hard";
  readonly sourceCall?: string;
  readonly sourceMeaning?: string;
}
