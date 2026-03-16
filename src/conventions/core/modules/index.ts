// ── Module Package types ────────────────────────────────────────
export type {
  ModulePackage,
  ModuleRequirement,
  MeaningSurfaceContribution,
} from "./module-package";

// ── Machine Fragment types ──────────────────────────────────────
export type {
  MachineFragment,
  FrontierDeclaration,
} from "./machine-fragment";

// ── Handoff types ───────────────────────────────────────────────
export type {
  HandoffSpec,
  HandoffTrigger,
} from "./handoff";

// ── Surface Emitter types ───────────────────────────────────────
export type {
  SurfaceEmitterSpec,
} from "./surface-emitter";

// ── Legacy adapter ──────────────────────────────────────────────
export {
  conventionBundleToPackages,
  packagesToConventionBundle,
} from "./legacy-adapter";
export type { BundleReconstructionMeta } from "./legacy-adapter";
