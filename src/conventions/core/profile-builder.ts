import type { SystemProfile, ModuleEntry } from "../../core/contracts/agreement-module";
import { defaultPriorityClassMapping, defaultObligationMapping } from "../../core/contracts/agreement-module";
import type { SystemConfig } from "../../core/contracts/system-config";
import { getSystemConfig } from "../../core/contracts/system-config";
import type { BaseSystemId } from "../../core/contracts/base-system-vocabulary";
import { BASE_SYSTEM_SAYC } from "../../core/contracts/base-system-vocabulary";

interface SystemProfileConfig {
  readonly baseSystem: BaseSystemId;
  readonly profileId: string;
  readonly modules: readonly ModuleEntry[];
  /** Override the default system config for this base system. */
  readonly systemConfig?: SystemConfig;
}

/**
 * Create a system profile for any base system with standard defaults.
 * Reduces ~20 lines of profile boilerplate to ~5 lines.
 *
 * The system config is resolved automatically from the base system ID
 * unless explicitly overridden.
 */
export function createSystemProfile(config: SystemProfileConfig): SystemProfile {
  return {
    profileId: config.profileId,
    baseSystem: config.baseSystem,
    systemConfig: config.systemConfig ?? getSystemConfig(config.baseSystem),
    modules: config.modules,
    conflictPolicy: { activationDefault: "simultaneous" },
    obligationMapping: defaultObligationMapping(),
    priorityClassMapping: defaultPriorityClassMapping(),
  };
}

/**
 * Convenience wrapper — creates a SAYC-based system profile.
 * @deprecated Prefer `createSystemProfile({ baseSystem: BASE_SYSTEM_SAYC, ... })`.
 */
export function createSaycProfile(config: Omit<SystemProfileConfig, "baseSystem">): SystemProfile {
  return createSystemProfile({ ...config, baseSystem: BASE_SYSTEM_SAYC });
}

/**
 * Create system profiles for the same module list across multiple base systems.
 * Reduces boilerplate when registering the same convention for several systems.
 */
export function createProfilesForSystems(
  template: {
    readonly profileIdPrefix: string;
    readonly modules: readonly ModuleEntry[];
    readonly systemConfig?: (sys: BaseSystemId) => SystemConfig | undefined;
  },
  systems: readonly BaseSystemId[],
): ReadonlyMap<BaseSystemId, SystemProfile> {
  const result = new Map<BaseSystemId, SystemProfile>();
  for (const sys of systems) {
    result.set(sys, createSystemProfile({
      baseSystem: sys,
      profileId: `${template.profileIdPrefix}-${sys}`,
      modules: template.modules,
      systemConfig: template.systemConfig?.(sys),
    }));
  }
  return result;
}
