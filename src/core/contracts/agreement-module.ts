import type { AuctionPattern, PublicGuard } from "./predicates";
import type { FactOperator } from "./meaning";

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


import type { SystemConfig } from "./system-config";
import type { BaseSystemId } from "./base-system-vocabulary";

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
