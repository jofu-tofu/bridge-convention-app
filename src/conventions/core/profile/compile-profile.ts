import type { AttachmentIR } from "../../../core/contracts/agreement-module";
import { createFactCatalog } from "../../../core/contracts/fact-catalog";
import { createSharedFactCatalog } from "../pipeline/fact-evaluator";
import type { ConventionBundle } from "../bundle/bundle-types";
import type { LegacyCompiledProfile } from "./types";

/**
 * Compile a ConventionBundle into a CompiledProfile.
 *
 * Legacy adapter: converts existing bundle data into the profile-shaped
 * output that the evaluation runtime path consumes. Internally:
 * - Merges bundle.factExtensions into the shared fact catalog
 * - Builds an activation index from bundle.systemProfile.modules
 * - Builds a capability index from bundle.declaredCapabilities
 */
export function compileProfileFromBundle(bundle: ConventionBundle): LegacyCompiledProfile {
  // Merge shared facts with bundle extensions
  const factCatalog = bundle.factExtensions && bundle.factExtensions.length > 0
    ? createFactCatalog(createSharedFactCatalog(), ...bundle.factExtensions)
    : createSharedFactCatalog();

  // Build activation index: moduleId → attachments
  const activationIndex = new Map<string, readonly AttachmentIR[]>();
  if (bundle.systemProfile) {
    for (const mod of bundle.systemProfile.modules) {
      activationIndex.set(mod.moduleId, mod.attachments);
    }
  }

  // Build capability index from declared capabilities
  const capabilityIndex: Readonly<Record<string, string>> =
    bundle.declaredCapabilities ?? {};

  return {
    factCatalog,
    activationIndex,
    capabilityIndex,
  };
}
