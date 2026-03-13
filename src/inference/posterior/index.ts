export { compilePublicHandSpace } from "./posterior-compiler";
export { sampleDeals } from "./posterior-sampler";
export type { WeightedDealSample } from "./posterior-sampler";
export { createPosteriorEngine } from "./posterior-engine";
export { POSTERIOR_FACT_HANDLERS } from "./posterior-facts";
export type { PosteriorFactHandler } from "./posterior-facts";
export { createPosteriorFactEvaluators, createPosteriorFactProvider } from "./posterior-catalog";
export { resolveLatentBranches } from "./latent-branch-resolver";
export type { LatentBranchResolution, BranchMarginal } from "./latent-branch-resolver";
