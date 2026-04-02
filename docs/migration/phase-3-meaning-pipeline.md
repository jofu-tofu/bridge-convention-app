# Phase 3: Meaning Pipeline

Port the full meaning pipeline to Rust: surface selection, surface evaluation, arbitration, encoding, teaching, and the convention adapter.

**Status:** Complete
**Estimated LOC:** ~4,000-5,000 Rust
**Dependencies:** Phase 2 (fact evaluation)
**Rust concepts to learn:** complex enum matching, trait-based polymorphism, builder patterns

## Goal

Given an auction context and convention spec, Rust produces the same pipeline results as TS. This is the largest and most complex phase — it covers the core convention evaluation system.

## TS Source Locations

| Component | TS source | Purpose |
|-----------|-----------|---------|
| Pipeline orchestrator | `src/conventions/pipeline/run-pipeline.ts` | `runPipeline()` — top-level entry point |
| **Observation (surface selection)** | | |
| FSM replay | `src/conventions/pipeline/observation/` | FSM state machine replay |
| Route matching | `src/conventions/pipeline/observation/` | Route expression matching |
| Negotiation matching | `src/conventions/pipeline/observation/` | Negotiation state matching |
| **Evaluation** | | |
| Surface evaluation | `src/conventions/pipeline/evaluation/` | Clause checking against facts |
| Arbitration | `src/conventions/pipeline/evaluation/` | Multi-module conflict resolution |
| Encoding | `src/conventions/pipeline/evaluation/` | Final bid meaning encoding |
| **Teaching** | | |
| Teaching resolution | `src/conventions/teaching/teaching-resolution.ts` | Resolve teaching content for bids |
| Projection builder | `src/conventions/teaching/projection-builder.ts` | Build teaching projections |
| Parse tree builder | `src/conventions/teaching/parse-tree-builder.ts` | Build parse trees for flow visualization |
| **Adapter** | | |
| Protocol adapter | `src/conventions/adapter/protocol-adapter.ts` | Convention→strategy bridge |
| Meaning strategy | `src/conventions/adapter/meaning-strategy.ts` | Strategy from pipeline results |
| Practical scorer | `src/conventions/adapter/practical-scorer.ts` | Practical bid scoring |

## Key Implementation Notes

**Pipeline stages (in order):**
1. **Observation:** FSM replay → determine active states per module → surface selection (route matching, negotiation matching)
2. **Evaluation:** For each active surface, evaluate meaning clauses against facts
3. **Arbitration:** Resolve conflicts when multiple modules claim the same bid
4. **Encoding:** Produce final `BidMeaning` with teaching content
5. **Teaching:** Resolve teaching labels, build projections for UI
6. **Adapter:** Bridge pipeline results to strategy interface (`BidResult`, `BiddingStrategy`)

**Teaching resolution** is inside `conventions/` (not `service/`) — it moves to Rust with the rest of the pipeline.

## Pre-Phase: Reference Snapshots

**Before writing any Rust code**, capture TS pipeline outputs as a reference:

```bash
npx tsx scripts/capture-pipeline-snapshots.ts > fixtures/pipeline-snapshots.json
```

Run all existing pipeline test scenarios through TS. Serialize `PipelineResult` outputs as JSON fixtures. Include edge cases: multi-module arbitration, negotiation states, teaching projections. These snapshots catch unintentional drift — the pipeline has accumulated complexity that may be worth simplifying during the port.

When Rust output differs, ask: "bug or improvement?" Update the fixture and document the decision if it's an improvement.

## Verification

- **Reference snapshot comparison:** Rust pipeline output compared against TS snapshots — differences reviewed and classified as bugs or improvements
- **Cross-validation:** Run both TS and Rust pipelines on the same inputs, review differences
- **CI gate:** Pipeline tests must pass before Phase 4

## Completion Checklist

- [ ] FSM replay ported
- [ ] Route matching ported
- [ ] Negotiation matching ported
- [ ] Surface evaluation ported
- [ ] Arbitration ported
- [ ] Encoding ported
- [ ] `runPipeline()` orchestrator ported
- [ ] Teaching resolution ported
- [ ] Projection builder ported
- [ ] Parse tree builder ported
- [ ] Protocol adapter ported
- [ ] Meaning strategy ported
- [ ] Practical scorer ported
- [ ] Golden-master snapshot script created
- [ ] All golden-master tests pass
- [ ] Update `src/conventions/CLAUDE.md` — note Rust pipeline exists
- [ ] Update `src/conventions/pipeline/CLAUDE.md` — note Rust ownership
- [ ] Update `src/conventions/teaching/CLAUDE.md` — note Rust ownership
- [ ] Update `src/conventions/adapter/CLAUDE.md` — note Rust ownership
- [ ] Update `docs/migration/index.md` phase tracker status
