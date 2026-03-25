// ── observation/ barrel ────────────────────────────────────────────────
// Surface selection (pre-pipeline) + observation log construction (post-pipeline).

export { collectMatchingClaims, collectMatchingClaimsWithPhases, deriveTurnRole, flattenSurfaces } from "./rule-interpreter";
export type { ModuleSurfaceResult } from "./rule-interpreter";
export { advanceLocalFsm } from "./local-fsm";
export { matchRoute, matchObs } from "./route-matcher";
export { matchKernel } from "./negotiation-matcher";
export { extractKernelState, computeKernelDelta } from "./negotiation-extractor";
export { buildCommittedStep } from "./committed-step-builder";
export { buildObservationLog } from "./observation-log-builder";
export type { ObservationLogStep } from "./observation-log-builder";
export { normalizeIntent } from "./normalize-intent";
