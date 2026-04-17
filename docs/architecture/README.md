# Architecture Index

Use this folder for repo-owned architectural context. It should answer two questions quickly:

1. What is the current architecture?
2. Which docs are active guidance versus historical reference?

## Current Guidance

- `design-philosophy.md` — cross-cutting principles and decision rules
- `architecture-specs.md` — current architecture snapshot plus active unresolved questions
- `teaching-architecture.md` — current meaning-pipeline, teaching, grading, and practice-model architecture
- `authority-and-module-composition.md` — authority-source policy (tier table, Category A vs B) and module composition rules (`variantOf`, `delegate_to`, planned `requires` field)
- `authored-input/` — design specs for the authored-input substrate (what authors write into fixtures, what must be inferred). Start with `authored-input/README.md`.

## Historical Reference

- `migration/` — completed TS-to-Rust/WASM migration record
- `posterior-implementation-plan.md` — exploratory factor-graph redesign notes; not the current production boundary

## Placement Rules

- Keep architecture docs repo-owned. If a design exists only in personal notes, distill the actionable parts here before treating it as authoritative.
- Put stable decisions and current boundaries in the active docs above.
- Put completed migrations and superseded plans in historical/reference docs, labeled as such.
- Link to code paths when a doc summarizes a live subsystem; avoid vague “the spec lives elsewhere” language.
