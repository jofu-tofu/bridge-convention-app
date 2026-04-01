# Teaching Architecture

The app separates two concerns: **deterministic convention teaching** and **probabilistic realism**.

## Meaning Pipeline

Fact evaluation → surface routing → meaning proposal → arbitration → encoding defines the canonical answer key. Each `BidMeaning` describes a bidding meaning with clauses evaluated against facts. `semanticClassId` and `teachingLabel` are required on every surface. The pipeline's output types are `PipelineCarrier` (accumulated state through pipeline stages) and `PipelineResult` (the public result containing winning meaning, truth set, and provenance).

## Alert System

`resolveAlert()` derives alertability from `sourceIntent.type` — natural intents (small, well-defined set in `alert.ts`) produce no alert; everything else defaults to conventional (alertable). Public constraints are auto-derived from primitive/bridge-observable clauses via `derivePublicConstraints()`. `annotation-producer.ts` converts `publicConstraints` to `HandInference` for Layer 1 belief updates. Inference model: only hard constraints from chosen bid's clauses. No cross-surface denials.

## TeachingResolution

`src/conventions/teaching/teaching-resolution.ts` wraps `BidResult` with multi-grade feedback:
- **Correct** — exact match
- **CorrectNotPreferred** — truth set but not recommended
- **Acceptable** — preferred/alternative tier candidates
- **NearMiss** — same family, fails constraint
- **Incorrect**

`resolveTeachingAnswer(bidResult, surfaceGroups?)` extracts acceptable alternatives and near-miss candidates. `gradeBid()` grades user input with 5-grade cascade.

## TeachingProjection

`src/conventions/teaching/teaching-projection-builder.ts` projects pipeline results into teaching-optimized views for "why not X?" UI. `projectTeaching(result: PipelineResult, options?)` is the single entry point; internally converts to `ArbitrationResult`/`DecisionProvenance` for sub-builders. Surface groups and explanation catalogs flow end-to-end from bundle → config-factory → strategy → projection.

## Parse-Tree Feedback

The backend builds parse tree data (`ParseTreeView`) showing which convention modules were considered and their verdicts (`selected` / `applicable` / `eliminated`). This data is available in `TeachingDetail.parseTree` but is **not surfaced in practice feedback UI** — removed because users found "Decision path" (convention-module evaluation) unintuitive. The conditions and why-not sections already present the same information in user-friendly form.

## Off-Convention Drills

Generate hands where the convention doesn't apply, training recognition ("does this convention apply?") not just execution. `ConventionBundle.offConventionConstraints` defines the anti-constraints (e.g., South 0–7 HCP for NT). `DrillTuning.includeOffConvention` + `offConventionRate` control frequency (default 30%). `DrillBundle.isOffConvention` flag tells the UI/teaching layer the deal is off-convention.

## Mandatory Explanation Entries

Every module-derived fact and meaning must have an explanation entry. Compile-time enforcement via `Record<ModuleFactId, FactExplanationEntry>` and `Record<ModuleMeaningId, MeaningExplanationEntry>` in per-module `explanation-catalog.ts` files. The platform explanation catalog (`shared-explanation-catalog.ts` in `conventions/core/`) covers shared and system fact IDs. Per-module typed ID constants (in `ids.ts`) ensure compile-time tracking of all IDs across the codebase.

## Grading

Grading is deterministic. Same hand + same auction = same grade. No probabilistic scoring in V1.

## Opponent Modes

- **"none"**: opponents always pass
- **"natural"**: opponents bid with 6+ HCP and 5+ suit

Configurable via settings dropdown, persisted in localStorage.

## Play Profiles

Opponent card play difficulty via `PlayProfileId` ("beginner" | "club-player" | "expert" | "world-class") in `DrillSettings`:
- **Beginner** — heuristic chain with skip errors
- **Club Player** — adds inference-enhanced heuristics from `PlayContext.inferences`
- **Expert** — adds card counting and restricted choice
- **World Class** — Monte Carlo deal sampling (30 samples) + DDS solving via `EnginePort.solveBoard()`

`PlayStrategy.suggest()` is async (`Promise<PlayResult>`). `PlayStrategyProvider` DI interface wired through `config-factory` → `SessionState` → `play-controller`. World-class requires `engine` in `ProfileStrategyOptions`. Expert/world-class providers' `onAuctionComplete()` called at auction end. UI selector not yet built.
