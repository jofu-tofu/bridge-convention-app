import type { SystemProfileIR, ModuleEntryIR } from "../../core/contracts/agreement-module";
import { defaultPriorityClassMapping, defaultObligationMapping } from "../../core/contracts/agreement-module";
import type { SystemConfig } from "../../core/contracts/system-config";
import { SAYC_SYSTEM_CONFIG } from "../../core/contracts/system-config";

interface ProfileConfig {
  readonly profileId: string;
  readonly modules: readonly ModuleEntryIR[];
  /** Override the default SAYC system config. */
  readonly systemConfig?: SystemConfig;
}

/**
 * Create a SAYC-based system profile with standard defaults.
 * Reduces ~20 lines of profile boilerplate to ~5 lines.
 */
export function createSaycProfile(config: ProfileConfig): SystemProfileIR {
  return {
    profileId: config.profileId,
    baseSystem: "sayc",
    systemConfig: config.systemConfig ?? SAYC_SYSTEM_CONFIG,
    modules: config.modules,
    conflictPolicy: { activationDefault: "simultaneous" },
    obligationMapping: defaultObligationMapping(),
    priorityClassMapping: defaultPriorityClassMapping(),
  };
}
