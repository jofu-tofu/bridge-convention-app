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

/**
 * Wrap a describe block with a `[ref:source]` tier marker.
 * The source tag is prepended to the describe name.
 */
export function refDescribe(
  refTag: string,
  name: string,
  fn: () => void,
): void {
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
  describe(`[policy] ${name} — ${rationale}`, fn);
}
