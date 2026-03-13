import type { AuctionPatternIR, PublicGuardIR } from "./predicate-surfaces";
import type { CandidateTransform, SemanticClassId } from "./meaning";
import type { LatentBranchSet } from "./posterior";

// ─── Module classification ──────────────────────────────────
export type ActivationKind = "auction-pattern" | "host-attachment" | "invoke-only";
export type ModuleKind = "base-system" | "add-on" | "competitive-treatment" | "slam-tool" | "defensive";

// ─── Priority class → band mapping ─────────────────────────
export type PriorityClass = "obligatory" | "preferredConventional" | "preferredNatural"
                          | "neutralCorrect" | "fallbackCorrect";

// ─── DecisionSurfaceIR ─────────────────────────────────────
// ** NOTE: This is a FUTURE IR contract type. The runtime (Phase 4) operates on MeaningSurface[]
// because that's what the existing pipeline functions consume. DecisionSurfaceIR becomes the
// migration target when the pipeline is updated to consume richer surfaces. **
export interface DecisionSurfaceIR {
  readonly surfaceId: string;
  readonly moduleId: string;
  readonly decisionProgram: string;
  readonly encoderKind: DeclaredEncoderKind;
  readonly surfaceBindings?: Readonly<Record<string, unknown>>;
  readonly localRegisters?: Readonly<Record<string, unknown>>;
  readonly transforms?: readonly CandidateTransform[];
  readonly modulePrecedence: number;
  readonly exclusivityGroup?: string;
  readonly defaultSemanticClassId?: SemanticClassId;
  readonly defaultPriorityClass?: PriorityClass;
}

// ─── Attachment contract ────────────────────────────────────
export interface AttachmentIR {
  readonly whenAuction?: AuctionPatternIR;
  readonly whenPublic?: PublicGuardIR;
  readonly requiresCapabilities?: readonly string[];
  readonly requiresVisibleMeanings?: readonly string[];
}

// ─── Fact constraint ────────────────────────────────────────
export interface FactConstraintIR {
  readonly factId: string;
  readonly operator: "gte" | "lte" | "eq" | "range" | "boolean" | "in";
  readonly value: number | boolean | string | { min: number; max: number } | readonly string[];
}

// ─── Public consequences ────────────────────────────────────
export interface PublicConsequences {
  readonly promises: readonly FactConstraintIR[];
  readonly denies?: readonly FactConstraintIR[];
  readonly closurePolicy?: ChoiceClosurePolicy;
  readonly latentBranches?: readonly LatentBranchSet[];
}

// ─── Closure policy ─────────────────────────────────────────
export interface ChoiceClosurePolicy {
  readonly exclusive: boolean;
  readonly exhaustive: boolean;
  readonly mandatory: boolean;
  readonly domain: ClosureDomain;
}

export type ClosureDomain =
  | { readonly kind: "surface" }
  | { readonly kind: "meaning-family"; readonly ids: readonly string[] }
  | { readonly kind: "semantic-class-set"; readonly ids: readonly string[] }
  | { readonly kind: "module-frontier"; readonly id: string };

// ─── System Profile ─────────────────────────────────────────
export interface SystemProfileIR {
  readonly profileId: string;
  readonly baseSystem: string;
  readonly modules: readonly ModuleEntryIR[];
  readonly conflictPolicy: ConflictPolicyIR;
}

export interface ModuleEntryIR {
  readonly moduleId: string;
  readonly kind: ModuleKind;
  readonly attachments: readonly AttachmentIR[];
  readonly options?: Readonly<Record<string, unknown>>;
}

export interface ConflictPolicyIR {
  readonly activationDefault: "simultaneous";
  readonly exclusivityGroups?: readonly { groupId: string; memberModuleIds: readonly string[] }[];
  readonly semanticClassAliases?: readonly { from: string; to: string }[];
}

// ─── Encoding types ─────────────────────────────────────────
// DeclaredEncoderKind describes what KIND of encoder a surface declares.
// This is DISTINCT from EncoderKind in provenance.ts which describes how
// encoding was resolved at runtime ("default-call" | "resolver" | etc.).
export type DeclaredEncoderKind = "direct" | "choice-set" | "frontier-step" | "relay-map";

export interface EncodingTraceIR {
  readonly encoderId: string;
  readonly encoderKind: DeclaredEncoderKind;
  readonly consideredCalls: readonly string[];
  readonly chosenCall?: string;
  readonly blockedCalls: readonly { call: string; reason: string }[];
}

// ─── Public state events/constraints ────────────────────────
export interface PublicEvent {
  readonly eventIndex: number;
  readonly call: string;
  readonly seat: string;
  readonly alert?: string;
}

export interface PublicConstraint {
  readonly subject: string;
  readonly constraint: FactConstraintIR;
  readonly origin: "call-meaning" | "announcement" | "explanation" | "explicit-denial" | "entailed-denial";
  readonly strength: "hard" | "entailed";
  readonly sourceCall?: string;
  readonly sourceMeaning?: string;
}
