import type { ConventionBundle } from "./bundle-types";

const bundles = new Map<string, ConventionBundle>();

export function registerBundle(bundle: ConventionBundle): void {
  if (bundles.has(bundle.id)) {
    throw new Error(`Bundle "${bundle.id}" is already registered.`);
  }
  bundles.set(bundle.id, bundle);
}

export function getBundle(id: string): ConventionBundle | undefined {
  return bundles.get(id);
}

export function listBundles(): readonly ConventionBundle[] {
  return [...bundles.values()];
}

export function findBundleForConvention(conventionId: string): ConventionBundle | undefined {
  for (const bundle of bundles.values()) {
    if (bundle.memberIds.includes(conventionId)) return bundle;
  }
  return undefined;
}

export function clearBundleRegistry(): void {
  bundles.clear();
}
