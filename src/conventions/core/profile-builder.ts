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
