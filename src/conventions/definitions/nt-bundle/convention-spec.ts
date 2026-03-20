/**
 * ConventionSpec for the 1NT bundle.
 *
 * Delegates to specFromSystem() — the skeleton-based composition path.
 * Retained for backward compatibility with existing imports.
 */

import { specFromSystem, ntSystem } from "../system-registry";

export const ntConventionSpec = specFromSystem(ntSystem)!;
