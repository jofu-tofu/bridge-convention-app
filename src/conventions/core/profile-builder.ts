import type { SystemProfileIR, ModuleEntryIR } from "../../core/contracts/agreement-module";
import { defaultPriorityClassMapping, defaultObligationMapping } from "../../core/contracts/agreement-module";

interface ProfileConfig {
  readonly profileId: string;
  readonly modules: readonly ModuleEntryIR[];
}

/**
 * Create a SAYC-based system profile with standard defaults.
 * Reduces ~20 lines of profile boilerplate to ~5 lines.
 */
export function createSaycProfile(config: ProfileConfig): SystemProfileIR {
  return {
    profileId: config.profileId,
    baseSystem: "sayc",
    modules: config.modules,
    conflictPolicy: { activationDefault: "simultaneous" },
    obligationMapping: defaultObligationMapping(),
    priorityClassMapping: defaultPriorityClassMapping(),
  };
}
