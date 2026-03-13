/**
 * Convention test tier markers.
 *
 * Three tiers:
 * - **ref** (`refDescribe`): Test verifies a rule traceable to a named source
 *   (bridgebum, ACBL, SAYC pamphlet). Tag format: `[ref:source]`.
 * - **policy** (`policyDescribe`): Test encodes a design choice where reasonable
 *   implementations could differ. Rationale string explains WHY.
 * - **structural** (plain `describe`): Infrastructure plumbing. No marker needed.
 *
 * Usage:
 *   refDescribe("[ref:bridgebum/stayman]", "Stayman ask rules", () => { ... });
 *   policyDescribe("[policy]", "HCP 8 boundary chosen over 7", "Stayman HCP edge", () => { ... });
 */

import { describe } from "vitest";

// ─── Types ──────────────────────────────────────────────────

/** Metadata attached to a policy describe block documenting the design choice. */
export interface PolicyRationale {
  /** What choice was made. */
  choice: string;
  /** Alternative approaches that exist. */
  alternatives: string[];
  /** Why this choice was made (or that it's a placeholder). */
  rationale: string;
}

/** Tier classification for a test block. */
export type TestTier = "reference" | "policy" | "structural";

/** Collected metadata for tier reporting. */
export interface TierEntry {
  tier: TestTier;
  name: string;
  source?: string;
  rationale?: PolicyRationale;
}

// ─── Registry (for runtime introspection / reporting) ───────

const _tierRegistry: TierEntry[] = [];

/** Returns all registered tier entries (for tier-report tooling). */
export function getTierRegistry(): readonly TierEntry[] {
  return _tierRegistry;
}

/** Clears the tier registry (for test isolation). */
export function clearTierRegistry(): void {
  _tierRegistry.length = 0;
}

// ─── Wrappers ───────────────────────────────────────────────

/**
 * Wrap a describe block with a `[ref:source]` tier marker.
 * The source tag is prepended to the describe name.
 */
export function refDescribe(
  refTag: string,
  name: string,
  fn: () => void,
): void {
  _tierRegistry.push({ tier: "reference", name: `${refTag} ${name}` });
  describe(`${refTag} ${name}`, fn);
}

/**
 * Wrap a describe block with a `[policy]` tier marker.
 * The rationale is embedded in the describe name for grep visibility.
 */
export function policyDescribe(
  _policyTag: string,
  rationale: string,
  name: string,
  fn: () => void,
): void {
  _tierRegistry.push({ tier: "policy", name: `[policy] ${name} — ${rationale}` });
  describe(`[policy] ${name} — ${rationale}`, fn);
}
