import type { FactCatalogExtension } from "../../../core/contracts/fact-catalog";
import type { ExplanationEntry } from "../../../core/contracts/explanation-catalog";
import type { PedagogicalRelation } from "../../../core/contracts/teaching-projection";
import type { AttachmentIR, ModuleKind } from "../../../core/contracts/agreement-module";
import type { MeaningSurface } from "../../../core/contracts/meaning";
import type { MachineFragment } from "./machine-fragment";
import type { SurfaceEmitterSpec } from "./surface-emitter";
import type { HandoffSpec } from "./handoff";

/** Dependency requirement for a module. */
export interface ModuleRequirement {
  readonly moduleId: string;
  readonly optional?: boolean;
}

/** A surface contribution from a module, with group affinity. */
export interface MeaningSurfaceContribution {
  readonly surfaceGroupId: string;
  readonly surfaces: readonly MeaningSurface[];
}

/** A module's complete authoring unit -- separates exports from runtime. */
export interface ModulePackage {
  readonly moduleId: string;
  readonly meta?: { readonly description?: string; readonly kind?: ModuleKind };
  readonly requires?: readonly ModuleRequirement[];
  readonly exports: {
    readonly capabilities?: readonly string[];
    readonly facts?: FactCatalogExtension;
    readonly surfaces?: readonly MeaningSurfaceContribution[];
    readonly explanationEntries?: readonly ExplanationEntry[];
    readonly pedagogicalRelations?: readonly PedagogicalRelation[];
    readonly semanticClasses?: readonly string[];
  };
  readonly runtime: {
    readonly activation?: readonly AttachmentIR[];
    readonly machineFragment?: MachineFragment;
    readonly surfaceEmitter?: SurfaceEmitterSpec;
    readonly handoffs?: readonly HandoffSpec[];
  };
}
