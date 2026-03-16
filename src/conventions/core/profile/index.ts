export type {
  CompiledProfile,
  ResolvedModuleEntry,
  LegacyCompiledProfile,
  ActivationIndex,
  CapabilityIndex,
  CompileOptions,
} from "./types";
export { compileProfileFromBundle } from "./compile-profile";
export { compileProfileFromPackages, buildActivationIndex, buildCapabilityIndex } from "./compile-from-packages";
export { assembleMachine } from "./machine-assembler";
export {
  mergeFactCatalogs,
  mergeExplanationEntries,
  mergePedagogicalRelations,
  mergeAlternativeGroups,
} from "./registry-merger";
