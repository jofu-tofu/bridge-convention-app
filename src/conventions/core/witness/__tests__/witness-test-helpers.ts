import type { DealSpec } from "../../../../core/contracts/deal-spec";

/** Build a minimal DealSpec, overriding any fields as needed. */
export function makeSpec(
  overrides: Partial<DealSpec> = {},
): DealSpec {
  return {
    specId: "test-spec",
    moduleId: "test-module",
    layers: [],
    targets: [],
    ...overrides,
  };
}
