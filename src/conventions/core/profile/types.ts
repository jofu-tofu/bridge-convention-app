/**
 * CompiledProfile — the product of profile compilation.
 *
 * A CompiledProfile is assembled once when the user selects modules
 * (profile compile time) and consumed by the evaluation runtime
 * at auction time. Expensive work (dependency resolution, registry
 * merging, index building) happens here; cheap work (activation,
 * surface emission) happens per-auction.
 */
import type {
  SystemProfileIR,
  AttachmentIR,
  PriorityClass,
  ObligationLevel,
} from "../../../core/contracts/agreement-module";
import type { FactCatalog } from "../../../core/contracts/fact-catalog";
import type { ExplanationCatalogIR } from "../../../core/contracts/explanation-catalog";
import type { PedagogicalRelation } from "../../../core/contracts/teaching-projection";
import type { AlternativeGroup } from "../../../core/contracts/tree-evaluation";
import type { RecommendationBand, MeaningSurface } from "../../../core/contracts/meaning";
import type { ConversationMachine } from "../runtime/machine-types";

/** A resolved module's surfaces, keyed by group. */
export interface ResolvedModuleEntry {
  readonly moduleId: string;
  readonly surfaceGroups: readonly {
    readonly groupId: string;
    readonly surfaces: readonly MeaningSurface[];
  }[];
}

/** Activation index: maps moduleId to its profile entry's attachments. */
export interface ActivationIndex {
  readonly moduleAttachments: ReadonlyMap<
    string,
    SystemProfileIR["modules"][number]["attachments"]
  >;
}

/** Capability index: maps moduleId to its declared capabilities. */
export interface CapabilityIndex {
  readonly moduleCapabilities: ReadonlyMap<string, readonly string[]>;
}

/**
 * Legacy compiled profile — minimal shape produced by `compileProfileFromBundle()`.
 * Used during the migration period while bundles are still the primary authoring surface.
 */
export interface LegacyCompiledProfile {
  readonly factCatalog: FactCatalog;
  readonly activationIndex: ReadonlyMap<string, readonly AttachmentIR[]>;
  readonly capabilityIndex: Readonly<Record<string, string>>;
}

/** The full compiled product of a SystemProfile + module set.
 *  Assembled once at profile compile time, consumed at auction runtime. */
export interface CompiledProfile {
  readonly profileId: string;
  readonly profile: SystemProfileIR;
  readonly resolvedModules: readonly ResolvedModuleEntry[];
  readonly registries: {
    readonly facts: FactCatalog;
    readonly explanations: ExplanationCatalogIR;
  };
  readonly pedagogicalRelations: readonly PedagogicalRelation[];
  readonly alternativeGroups: readonly AlternativeGroup[];
  readonly indexes: {
    readonly activation: ActivationIndex;
    readonly capabilities: CapabilityIndex;
  };
  readonly machine: ConversationMachine;
  readonly policy: {
    readonly obligationMapping: Readonly<Record<ObligationLevel, RecommendationBand>>;
    /** @deprecated Use obligationMapping instead. */
    readonly priorityClassMapping: Readonly<Record<PriorityClass, RecommendationBand>>;
  };
}

/** Options for the profile compiler. */
export interface CompileOptions {
  /** Override the machine ID (defaults to profileId). */
  readonly machineId?: string;
}
