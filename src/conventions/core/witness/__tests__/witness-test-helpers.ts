import type { DealSpec } from "../../../../bootstrap/deal-spec-types";

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
