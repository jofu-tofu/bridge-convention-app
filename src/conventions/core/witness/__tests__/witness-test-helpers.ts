import type { WitnessSpecIR } from "../../../../core/contracts/witness-spec";

/** Build a minimal WitnessSpecIR, overriding any fields as needed. */
export function makeSpec(
  overrides: Partial<WitnessSpecIR> = {},
): WitnessSpecIR {
  return {
    specId: "test-spec",
    moduleId: "test-module",
    layers: [],
    targets: [],
    ...overrides,
  };
}
