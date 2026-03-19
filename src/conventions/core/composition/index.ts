// ── Legacy composition (ConventionModule + BundleSkeleton) ──────────
export type { ConventionModule } from "./module-types";
export type { BundleSkeleton, ComposedBundle } from "./compose";
export { composeModules } from "./compose";

// ── Package-based composition (ModulePackage + profile compiler) ────
export type {
  ModulePackage,
  MeaningSurfaceContribution,
  ModuleRequirement,
  ModuleKind,
} from "./module-package";
export type { MachineFragment, FrontierDeclaration } from "./machine-fragment";
export type { HandoffSpec, HandoffTrigger } from "./handoff";
export { assembleMachine } from "./machine-assembler";
export type { AssembleMachineOptions, AssembleMachineResult } from "./machine-assembler";
export { compileProfileFromPackages } from "./compile-from-packages";
export type { CompileFromPackagesOptions } from "./compile-from-packages";

// ── Interference detection ──────────────────────────────────────────
export { detectModuleInterference } from "./interference-detector";
export type { ModuleInterference, InterferenceReport } from "./interference-detector";
