import type { SystemProfile, ModuleEntry } from "./agreement-module";
import type { SystemConfig } from "../definitions/system-config";
import { getSystemConfig } from "../definitions/system-config";
import type { BaseSystemId } from "../definitions/system-config";

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
  };
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
