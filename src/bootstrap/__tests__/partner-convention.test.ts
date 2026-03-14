/**
 * Partner convention tests — removed.
 *
 * The original tests verified North (partner) uses the drilled convention
 * through the tree pipeline (Bergen opener rebids, etc.). The tree pipeline
 * has been deleted; only meaning-pipeline bundles remain. Partner bidding
 * behavior is now tested through bundle-level integration tests.
 */
import { describe, it, expect } from "vitest";

describe("partner-convention (placeholder)", () => {
  it("tree pipeline tests removed — bundles handle partner bidding", () => {
    // Partner convention behavior is now tested in bundle-specific tests
    expect(true).toBe(true);
  });
});
