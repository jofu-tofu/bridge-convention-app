import type { AuctionPattern, PublicGuard } from "./predicates";
import type { SemanticClassId, RecommendationBand } from "./meaning";
import type { FactOperator } from "./meaning";
import type { Call } from "../../engine/types";

// ─── Module classification ──────────────────────────────────
export type ModuleKind = "base-system" | "add-on" | "competitive-treatment" | "slam-tool" | "defensive";

// ─── Priority specification ─────────────────────────────────

/** How strongly convention logic requires this bid.
 *  - "forced": Only legal response in this closure domain (e.g., forced rebid, Ogust step).
 *  - "preferred": Best bid given the hand, but alternatives exist.
 *  - "acceptable": Correct but not preferred; typically a natural fallback.
 *  - "residual": What you bid when nothing else applies (e.g., Pass as fallback). */
export type ObligationLevel = "forced" | "preferred" | "acceptable" | "residual";

/** Whether the bid carries conventional (artificial/partnership-agreed) meaning
 *  that opponents are entitled to know about.
 *  - "conventional": Artificial or partnership-agreed meaning (alertable per ACBL).
 *  - "natural": Meaning follows from standard bridge logic (not alertable). */
export type Conventionality = "conventional" | "natural";

/** Factored priority specification — separates obligation strength from conventionality.
 *  Closed union of the four empirically attested combinations. */
export type PrioritySpec =
  | { readonly obligation: "forced"; readonly conventionality: "conventional" }
  | { readonly obligation: "preferred"; readonly conventionality: "conventional" }
  | { readonly obligation: "acceptable"; readonly conventionality: "natural" }
  | { readonly obligation: "residual"; readonly conventionality: "natural" };

// ─── Legacy PriorityClass (deprecated) ──────────────────────
/** @deprecated Use PrioritySpec instead. Retained for DecisionSurface backward compatibility. */
export type PriorityClass = "obligatory" | "preferredConventional" | "preferredNatural"
                          | "neutralCorrect" | "fallbackCorrect";

// ─── DecisionSurface ─────────────────────────────────────
// The primary IR contract type for decision surfaces. The runtime evaluates these
// through the meaning pipeline. When decisionProgram === "clause-evaluator" and
// inlineClauses are provided, the pipeline evaluates them against facts.
// Other decision programs remain as a future extension point.
export interface DecisionSurface {
  readonly surfaceId: string;
  readonly moduleId: string;
  readonly decisionProgram: string;
  readonly encoderKind: DeclaredEncoderKind;
  readonly surfaceBindings?: Readonly<Record<string, unknown>>;
  readonly localRegisters?: Readonly<Record<string, unknown>>;
  readonly modulePrecedence: number;
  readonly exclusivityGroup?: string;
  readonly defaultSemanticClassId?: SemanticClassId;
  readonly defaultPriorityClass?: PriorityClass;
  /** Inline clauses for the "clause-evaluator" decision program.
   *  When present, the pipeline evaluates these against EvaluatedFacts
   *  instead of producing empty all-pass clauses. */
  readonly inlineClauses?: readonly FactConstraint[];
  /** Human-readable teaching label for this surface. */
  readonly teachingLabel?: string;
  /** Default call when encoding is "direct". */
  readonly defaultCall?: Call;
  /** Source intent for provenance tracking. */
  readonly sourceIntent?: Readonly<{ type: string; params: Readonly<Record<string, string | number | boolean>> }>;
  /** Ranking metadata for intra-module ordering. */
  readonly intraModuleOrder?: number;
  /** Specificity for ranking. */
  readonly specificity?: number;
}

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
}

// ─── Closure policy ─────────────────────────────────────────
export interface ChoiceClosurePolicy {
  readonly exclusive: boolean;
  readonly exhaustive: boolean;
  readonly mandatory: boolean;
  readonly domain: ClosureDomain;
}

type ClosureDomain =
  | { readonly kind: "surface" }
  | { readonly kind: "semantic-class-set"; readonly ids: readonly string[] }
  | { readonly kind: "module-frontier"; readonly id: string };

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
  readonly conflictPolicy: ConflictPolicy;
  /** Profile-level mapping from obligation levels to runtime bands.
   *  When present, surfaces with a `prioritySpec` resolve their recommendationBand
   *  through this mapping instead of using the surface-level band directly. */
  readonly obligationMapping?: Readonly<Record<ObligationLevel, RecommendationBand>>;
  /** @deprecated Use obligationMapping instead.
   *  Profile-level mapping from author-declared priority classes to runtime bands. */
  readonly priorityClassMapping?: Readonly<Record<PriorityClass, RecommendationBand>>;
}

export interface ModuleEntry {
  readonly moduleId: string;
  readonly kind: ModuleKind;
  readonly attachments: readonly Attachment[];
  readonly options?: Readonly<Record<string, unknown>>;
}

export interface ConflictPolicy {
  readonly activationDefault: "simultaneous";
  readonly exclusivityGroups?: readonly { groupId: string; memberModuleIds: readonly string[] }[];
  readonly semanticClassAliases?: readonly { from: string; to: string }[];
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
  readonly origin: "call-meaning" | "entailed-denial";
  readonly strength: "hard" | "entailed";
  readonly sourceCall?: string;
  readonly sourceMeaning?: string;
}

// ─── Default obligation → band mapping ──────────────────────
/** The standard mapping from obligation levels to runtime recommendation bands.
 *  Profiles may override this with their own `obligationMapping`. */
export function defaultObligationMapping(): Readonly<Record<ObligationLevel, RecommendationBand>> {
  return {
    forced: "must",
    preferred: "should",
    acceptable: "may",
    residual: "avoid",
  };
}

// ─── Legacy default priority-class → band mapping ───────────
/** @deprecated Use defaultObligationMapping() instead.
 *  The standard mapping from author-declared priority classes to runtime bands.
 *  Profiles may override this with their own `priorityClassMapping`. */
export function defaultPriorityClassMapping(): Readonly<Record<PriorityClass, RecommendationBand>> {
  return {
    obligatory: "must",
    preferredConventional: "should",
    preferredNatural: "should",
    neutralCorrect: "may",
    fallbackCorrect: "avoid",
  };
}


