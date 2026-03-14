import type { ConventionConfig } from "./types";

const registry = new Map<string, ConventionConfig>();

export function registerConvention(config: ConventionConfig): void {
  if (registry.has(config.id)) {
    throw new Error(`Convention "${config.id}" is already registered.`);
  }
  registry.set(config.id, config);
}

export function getConvention(id: string): ConventionConfig {
  const config = registry.get(id);
  if (!config) {
    const available = [...registry.keys()].join(", ") || "(none)";
    throw new Error(`Unknown convention "${id}". Available: ${available}`);
  }
  return config;
}

export function listConventions(): ConventionConfig[] {
  return [...registry.values()];
}

export function listConventionIds(): string[] {
  return [...registry.keys()];
}

export function clearRegistry(): void {
  registry.clear();
}
