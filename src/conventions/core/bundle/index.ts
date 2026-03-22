// Bundle subsystem barrel
export type { BundleInput, ConventionBundle, DerivedTeachingContent } from "./bundle-types";
export { createConventionConfigFromBundle, resolveConventionForSystem } from "./bundle-types";
export { registerBundle, getBundle, listBundles, findBundleForConvention, clearBundleRegistry } from "./bundle-registry";
export { composeBundles } from "./composite-builder";
