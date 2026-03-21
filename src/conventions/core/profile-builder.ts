import type { SystemProfile, ModuleEntry } from "../../core/contracts/agreement-module";
import { defaultPriorityClassMapping, defaultObligationMapping } from "../../core/contracts/agreement-module";
import type { SystemConfig } from "../../core/contracts/system-config";
import { SAYC_SYSTEM_CONFIG } from "../../core/contracts/system-config";
import { BASE_SYSTEM_SAYC } from "../../core/contracts/base-system-vocabulary";

interface ProfileConfig {
  readonly profileId: string;
  readonly modules: readonly ModuleEntry[];
  /** Override the default SAYC system config. */
  readonly systemConfig?: SystemConfig;
}

/**
 * Create a SAYC-based system profile with standard defaults.
 * Reduces ~20 lines of profile boilerplate to ~5 lines.
 */
export function createSaycProfile(config: ProfileConfig): SystemProfile {
  return {
    profileId: config.profileId,
    baseSystem: BASE_SYSTEM_SAYC,
    systemConfig: config.systemConfig ?? SAYC_SYSTEM_CONFIG,
    modules: config.modules,
    conflictPolicy: { activationDefault: "simultaneous" },
    obligationMapping: defaultObligationMapping(),
    priorityClassMapping: defaultPriorityClassMapping(),
  };
}
