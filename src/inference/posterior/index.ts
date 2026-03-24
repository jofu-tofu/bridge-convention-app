// ─── Posterior types (formerly core/contracts/posterior.ts) ──
export type {
  PublicHandSpace,
  PosteriorFactRequest,
  PosteriorFactValue,
  SubjectRef,
  PosteriorSourceRef,
  EvidenceGroupId,
  BeliefView,
  LatentBranchAlternative,
  LatentBranchSet,
  PosteriorFactProvider,
} from "./posterior-types";
export { SHARED_POSTERIOR_FACT_IDS } from "./posterior-types";

// ─── Posterior boundary (formerly core/contracts/factor-graph.ts, posterior-query.ts, posterior-backend.ts) ──
export type {
  FactorStrength,
  FactorOrigin,
  FactorSpec,
  BaseFactor,
  SingleSeatFactor,
  HcpRangeFactor,
  SuitLengthFactor,
  ShapeFactor,
  ExclusionFactor,
  FitFactor,
  AmbiguityAlternative,
  AmbiguityFamily,
  EvidencePin,
  OwnHandPin,
  AuctionRecordPin,
  AlertPin,
  FactorGraph,
  InferenceHealth,
  PosteriorQueryResult,
  FactorIntrospection,
  ConditioningContext,
  PosteriorQueryPort,
  LatentWorld,
  WeightedParticle,
  PosteriorState,
  PosteriorQuery,
  PosteriorBackend,
} from "./posterior-boundary";

// ─── Implementation exports ─────────────────────────────────
export { compilePublicHandSpace } from "./posterior-compiler";
export { sampleDeals } from "./posterior-sampler";
export type { WeightedDealSample } from "./posterior-sampler";
export { POSTERIOR_FACT_HANDLERS } from "./posterior-facts";
export type { PosteriorFactHandler } from "./posterior-facts";
export { createPosteriorFactEvaluators, createPosteriorFactProviderFromBackend } from "./posterior-catalog";
export { resolveLatentBranches } from "./latent-branch-resolver";
export type { LatentBranchResolution, BranchMarginal } from "./latent-branch-resolver";
export { compileFactorGraph, validateFactorGraph } from "./factor-compiler";
export type { FactorGraphValidation, FactorContradiction } from "./factor-compiler";
export { createQueryPort } from "./query-port";
export { createTsBackend } from "./ts-posterior-backend";
