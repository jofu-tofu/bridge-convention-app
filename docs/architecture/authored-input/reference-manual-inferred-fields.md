# Reference Manual: Inferred Fields Design Spec

**Status:** Active spec — stages 0 through 3B landed on 2026-04-13; stage 4 remains pending.
**Context:** `_output/contexts/260413-1738-run-dev-open-browser/thinking/criticalthinking/20260413-175547/synthesis.md`
**Related:** `docs/guides/convention-authoring.md`, `docs/research/convention-reference-design/reference-page-template.md`, `src/routes/CLAUDE.md` (Learn Reference Surface section).

## Problem

The `/learn/[moduleId]` reference page today mixes three regimes:

1. **Derived from surfaces** (good) — e.g. response-table columns auto-discover fact IDs from module surfaces.
2. **Authored fact-id references** (good) — e.g. `QuickReferenceAxis::SystemFactLadder { facts: ["system.responder.inviteValues"] }` resolves row labels through `describe_system_fact_value(fact, SystemConfig)`, so SAYC→2/1 swaps update labels automatically.
3. **Authored free prose** (the problem) — e.g. legacy prose-axis column labels like `"No 4-card major"`, grid cells like `"2♣ then raise"`, `NotApplicable.reason: String` fields. Each is an escape hatch that lets authors bypass the typed substrate.

Two distinct failure modes coexist:

- **Stayman-class:** the `reference` block is populated but contains free-text fields that should be typed predicates. In the current corpus this is `stayman.json`.
- **Bergen/Blackwood-class:** the `reference` block is omitted entirely — the page falls back to a degraded "hero + teaching + phases" render. No reference manual exists. In the current corpus this is 13 of 14 fixtures.

The goal: every rendered value on every reference page either derives from the module's own surfaces, or resolves from a typed predicate over a closed fact vocabulary, through `describe(predicate, SystemConfig, Locale)`. Sections auto-hide when the projection is empty. Authors fill required fields or write `NotApplicable { reason: predicate }` — never raw prose for a structural slot, never `null`, and eventually never omitted.

## Guiding philosophy (restated)

Already codified in `src/routes/CLAUDE.md:19-23`:

1. No per-module branching in the page component.
2. No free-text prose for structural fields — only typed predicates and derivation.
3. Sections auto-hide when empty.
4. Required fields across all modules, with explicit `NotApplicable { reason }` rather than `null`.
5. All system-specific values route through `SystemConfig` via the fact-ladder chain. Locale-ready downstream.
6. ConventionForge validates completeness-by-construction.

## Scope of this spec

This document specifies the **data model changes** and **staged migration plan** needed to achieve the above for the reference page. It does not cover:

- The teaching pipeline (`teaching.principle`, `tradeoff`, `commonMistakes`) — those remain authored prose, but become **required** on every module.
- Drill setup / witness selection / pipeline logic.
- The marketing landing page, guides pages, or practice UI.
- The `references: { authority, discovery }` (citation link) block — unchanged.

## Target data model

### T1. Closed fact catalog with typed ID

```rust
// crates/bridge-conventions/src/types/fact_id.rs  (new)
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct FactId(String);

impl FactId {
    pub fn parse(raw: &str) -> Result<Self, FactCatalogError> { /* look up in registry */ }
}

pub struct FactCatalogEntry {
    pub id: FactId,
    pub kind: FactKind,        // Threshold | Partition | Predicate
    pub partition: Option<PartitionSpec>,
    pub display_name: &'static str,
    pub rationale: &'static str,
}

pub struct LocalizedLabel {
    pub key: &'static str,
    pub default_en: &'static str,
}
```

Fact IDs are validated at fixture deserialize time against the catalog. Typos fail the load; no silent "fall back to the id string" at render time.

`LocalizedLabel` is part of the Stage 0 surface, not a future TODO. English-only content is acceptable initially, but the type-level locale hook must exist before `describe_fact_value(...)` ships so later locale work is additive rather than a breaking migration.

### T2. Three fact kinds

- **Threshold facts** — existing `systemFactLadder` behavior. E.g. `system.responder.inviteValues` resolves to `"10–12 HCP"` via `SystemConfig`.
- **Partition facts** — new. A fact with a finite enumerated set of discriminants, each with a typed predicate definition. E.g. `responder.majorShape ∈ {none, oneMajor, bothMajors4_4, bothMajors5_4}`, where each discriminant is itself a `FactComposition` predicate over `Hand` facts.
- **Predicate facts** — existing `FactComposition` atoms (HCP, suit length, etc.) used inside partition definitions; not directly renderable as axes.

### T2.1. Partition admission rules

Partition facts are the most gameable part of the vocabulary, so admission is stricter than "can we name the buckets?":

- Every partition fact declares an **applicability domain** plus discriminants that are mutually exclusive and collectively exhaustive **within that domain**.
- Catch-all discriminants like `other`, `misc`, `default`, or `else` are rejected unless the authority source itself uses that category and the catalog entry explains why it is a single pedagogical concept rather than a dump bucket.
- A partition discriminant may not be reused as a rubber-stamp `NotApplicable` reason for a cell or section whose real missing condition is elsewhere. ConventionForge rejects reasons that are equivalent to the active row/column discriminant and add no new information.
- New partition facts require governance: either (a) a second consuming module already exists, or (b) the PR explicitly records `single-use-blessed` rationale. If the catalog grows past roughly 40 facts or accumulates repeated single-use partitions, revisit archetype scoping rather than letting the global vocabulary bloat silently.

### T3. Quick-reference axis becomes fact-driven

```rust
// crates/bridge-conventions/src/types/module_types.rs
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum QuickReferenceAxis {
    ThresholdLadder { label: String, fact: FactId },        // replaces SystemFactLadder — now single-fact
    PartitionLadder { label: String, fact: FactId },        // replaces the legacy prose axis — single fact with known discriminants
}
```

Labels for each axis entry derive at viewport build time from `describe_fact_value(fact, discriminant_or_threshold, SystemConfig)`. Authors never type value strings.

### T4. Grid cells become surface references, not prose

```rust
pub enum ModuleReferenceQuickReference {
    Grid {
        row_axis: QuickReferenceAxis,
        col_axis: QuickReferenceAxis,
        cells: Vec<Vec<CellBinding>>,   // was Vec<Vec<String>>
    },
    List {
        axis: QuickReferenceAxis,
        items: Vec<ListItemBinding>,
    },
}

pub enum CellBinding {
    Surface(SurfaceId),                        // derives: call + short gloss from surface
    NotApplicable { reason: FactComposition }, // typed reason — no strings
    Auto,                                      // let the viewport project surfaces onto the (row,col) cell
}
```

The common case is `Auto`: the viewport takes each surface in the module, evaluates its preconditions at the partition point for (row, col), and emits the matching surface's defining call. If exactly one surface fires, the cell is that surface. If multiple fire, bundle-build validation fails — the author must disambiguate with `Surface(id)`.

If zero surfaces fire, the system may synthesize `NotApplicable { reason }` **only** when it can prove an informative missing precondition that is stricter than, and not equivalent to, the active row/column discriminants. Otherwise zero-match is also a build-time error. End-user pages never discover "no idea why this cell is empty" at render time.

This validation runs during fixture/bundle build (and therefore during static learn-page extraction), not at client render time.

### T5. `reference` becomes required

```rust
pub struct ConventionModule {
    // ...
    pub reference: ModuleReference,          // was Option<ModuleReference>
}

pub struct ModuleReference {
    pub summary_card: SectionOrNotApplicable<SummaryCard>,
    pub when_to_use: SectionOrNotApplicable<Vec<PredicateBullet>>,
    pub when_not_to_use: SectionOrNotApplicable<Vec<PredicateBullet>>,
    pub quick_reference: SectionOrNotApplicable<ModuleReferenceQuickReference>,
    pub response_table: SectionOrNotApplicable<ResponseTableSpec>, // Auto is the default
    pub worked_auctions: SectionOrNotApplicable<NonEmpty<WorkedAuction>>,
    pub interference: SectionOrNotApplicable<NonEmpty<InterferenceItem>>,
    pub related_links: SectionOrNotApplicable<NonEmpty<RelatedLink>>,
}

#[serde(tag = "status", rename_all = "camelCase")]
pub enum SectionOrNotApplicable<T> {
    Applies(T),
    NotApplicable { reason: FactComposition },
}
```

`NotApplicable.reason` is a typed predicate, never a string. This is the single load-bearing invariant identified across every lens of the synthesis: if reason is free text it collapses to `"N/A"` under author deadline; if it's a predicate, authors must state *what condition would make it apply*, checkable by ConventionForge.

`SectionOrNotApplicable<T>` is not sufficient on its own; each `Applies(T)` payload must also pass a section-specific semantic validator:

- collection-backed sections use `NonEmpty<_>` or equivalent validation, never bare `Vec<_>`;
- text-bearing payloads reject blank/placeholder strings;
- `NotApplicable.reason` must be non-vacuous: not globally tautological, and not trivially implied by the surrounding section/cell context.

### T6. Pedagogy fields remain authored — but required

`teaching.principle`, `teaching.tradeoff`, `teaching.commonMistakes` stay as authored prose. These are irreducibly pedagogical judgments that structure cannot produce. They become **required** on every module. No `null`; if a module genuinely has no tradeoff, that is itself a statement and should be written as such.

`PredicateBullet` (used by `whenToUse` / `whenNotToUse`) is `{ predicate: FactComposition, gloss: String }` — a short human-readable prose wrapper around a typed predicate. The predicate is load-bearing for validation; the gloss is pedagogical.

## Derivation architecture

At viewport build time (`crates/bridge-session/src/session/learning_viewport.rs`):

```
Module + SystemConfig
      │
      ├── surfaces ──→ ResponseTable (already works)
      ├── surfaces × (rowAxis, colAxis) ──→ Grid cells (new; projection)
      ├── FactId references ──→ describe_fact_value ──→ axis labels
      ├── teaching.* ──→ Key Concepts (already works)
      └── ModuleReference sections ──→ SectionOrNotApplicable renders
              │
              └── NotApplicable ──→ section hidden (or rendered as "N/A with reason" in authoring view)
```

The page component (`+page.svelte`) iterates sections. `SectionOrNotApplicable::NotApplicable` suppresses the section in end-user view and surfaces it in ConventionForge's authoring preview with the reason predicate visualized.

## Partition-fact vocabulary (audited Stage 0 corpus)

The 2026-04-13 audit covered all 14 fixtures under `crates/bridge-conventions/fixtures/modules/*.json`. The initial snapshot found a single populated `reference` block and a large omitted-reference corpus, which is why the staged migration separated mixed-corpus authoring from the final hard flip. Stage 3B has since landed: all 14 fixtures now carry populated `reference` blocks, but the audited Stage 0 vocabulary remains intentionally narrow because only the existing authored structural corpus needs to be supported.

### Existing threshold facts retained

These already exist conceptually via the current `systemFactLadder` chain and were sufficient for the Stayman row axis plus the condition-bearing parts of `whenToUse`.

| Fact ID | Kind | Example value definition | Fixtures |
|---|---|---|---|
| `system.responder.weakHand` | Threshold | `hand.hcp < sys.responder_thresholds.invite_min` | Stayman |
| `system.responder.inviteValues` | Threshold | `sys.responder_thresholds.invite_min <= hand.hcp <= sys.responder_thresholds.invite_max` | Stayman |
| `system.responder.gameValues` | Threshold | `hand.hcp >= sys.responder_thresholds.game_min` | Stayman |

### Partition facts required by the current reference corpus

| Fact ID | Kind | Discriminants | Fixtures |
|---|---|---|---|
| `responder.majorShape` | Partition | `noFourCardMajor`, `oneFourCardMajor`, `fiveFourMajors`, `flatFourCardMajor` | Stayman |

Example predicate definitions for `responder.majorShape` discriminants:

- `noFourCardMajor`: `hand.suitLength.hearts < 4 AND hand.suitLength.spades < 4`
- `oneFourCardMajor`: exactly one major is length 4+, neither major pattern is `5-4`, and the hand is not `4-3-3-3`
- `fiveFourMajors`: `hand.suitLength.hearts >= 4 AND hand.suitLength.spades >= 4 AND (hearts >= 5 OR spades >= 5)`
- `flatFourCardMajor`: `shape == 4-3-3-3` and exactly one major is length 4

This partition is scoped to the current Stayman-family quick-reference axis, not to every future major-suit classification the repo may need. Transfer-only hands and other future distinctions can stay as plain `FactComposition` predicates until a populated reference fixture proves they need a renderable partition fact.

Audit-driven changes from the original proposal:

- Keep the responder-strength ladder as existing threshold facts; the audit found no need for a new threshold vocabulary beyond those three facts.
- Refine `responder.majorShape` to the four discriminants the current Stayman quick-reference grid actually renders.
- Add `flatFourCardMajor`; the authored label `"Flat hand with a four-card major"` does not fit the original proposal and must be a first-class discriminant to keep the partition mutually exclusive.
- Remove speculative Stage 0 facts not evidenced by any populated `reference` today: `responder.trumpSupport`, `responder.aceCount`, `responder.kingCount`, `overcall.seat`, `overcall.twoSuitedShape`, `opener.rebidStrength`, `opener.shape`, `interference.level`, and `vulnerability`.

### Audit findings

- Fixtures audited: 14
- Fixtures with populated `reference`: 1 (`stayman.json`)
- Fixtures with omitted `reference`: 13
- Authored strings extracted from populated `reference` blocks: 47
- Condition-bearing strings relevant to the typed-fact plan: 8
- Condition-bearing strings mapped cleanly with the audited vocabulary: 7
- Condition-bearing strings requiring vocabulary changes: 1 (`"Flat hand with a four-card major"`)
- Editorial strings outside typed-fact scope: 39. These remain authored or are handled by other planned model pieces: summary-card prose, worked-auction labels/rationales, interference rows, related-link discriminators, and quick-reference cell recommendations that Stage 2 converts to surface bindings.

No populated fixture currently requires a structural shape beyond `grid | list`, so this audit does not raise a new structural open question.

## Staged migration plan

Each stage is one reviewable PR. Ordering is strict — do not parallelize across stages.

### Stage 0: Vocabulary + type scaffolding

**Deliverables:**
- `fact_id.rs` with `FactId` newtype, `FactCatalog`, deserialize-time validation.
- Fact catalog populated with the audited Stage 0 vocabulary above + the existing responder-strength threshold facts already exercised by the current corpus. Additional facts land only when a populated fixture reference requires them.
- `LocalizedLabel` type defined in the data model; `describe_fact_value(fact, value, SystemConfig) -> LocalizedLabel` dispatching threshold vs. partition.
- No type changes to `QuickReferenceAxis` or `ModuleReference` yet — existing fixtures still load.
- Audit doc showing every currently-authored structural condition string in populated `reference.*` fields maps into the vocabulary. Editorial strings that remain authored (worked-auction narration, interference prose, related-link discriminators, etc.) are recorded separately and do not count against the partition-fact vocabulary.
- Fixture-load validation for local `FactId`s, plus bundle/linker validation for any cross-module references introduced later (`relatedLinks`, future continuation pointers, etc.).
- Diagnostics spec for authoring mistakes: unknown `FactId` names the JSON path and nearest known IDs; partition overlap/exhaustiveness failures name the offending fact/discriminants; any future `Auto` projection error names module, cell coordinates, and candidate surfaces.

**Exit criteria:** `cargo test --workspace` green. `describe_fact_value` can resolve every fact in the catalog for every `SystemConfig`. The fixture census is recorded, and zero unsupported structural condition strings remain in the populated-reference corpus. Partition facts have exclusivity/exhaustiveness tests. No rendered output changes.

### Stage 1: Replace legacy prose axis with `PartitionLadder`

**Deliverables:**
- Add `QuickReferenceAxis::PartitionLadder { fact: FactId }` alongside existing variants.
- Migrate all Stayman-class fixtures' `colAxis` from `qualitative` → `partitionLadder`.
- Golden-master tests pin rendered output per convention per system — swaps must produce the same surface text for at least SAYC.
- CI lint: no raw digit in any authored string within `reference.*`.
- No surface edits whose only purpose is making the reference renderer happy. If the new axis cannot describe the existing surfaces, that is a vocabulary/rendering defect, not grounds to split or pollute surface authoring.
- Delete the legacy prose-axis variant once all fixtures migrated.

**Exit criteria:** Rendered pages for Stayman, Stayman Garbage, Smolen, Jacoby 4way look identical under SAYC. Swapping to a stub alternate system produces sensibly-updated labels. No `qualitative` in any fixture.

### Stage 2: Auto-derive cells

**Deliverables:**
- `CellBinding` enum + projection logic (`project_surface_for_cell(module, row_fact_value, col_fact_value) -> CellBinding`).
- Run projection at build/ConventionForge time, not on the end-user render path.
- Migrate authored grid cells only when the existing cell text is semantically reducible to a surface binding or an informative typed `NotApplicable` reason.
- For zero-match `Auto` cells, synthesize `NotApplicable` only when the missing precondition is informative; otherwise fail the build and require explicit author intervention.
- Diff the rendered output before/after migration; differences are either bugs in projection or authored cells that were wrong.

**Risk note:** the current Stayman grid contains pedagogical plan text like `"Ask, then invite"` and `"Ask, then bid game"` (`crates/bridge-conventions/fixtures/modules/stayman.json:2272-2273`). That information is not recoverable from any single surface binding. Stage 2 therefore cannot promise blanket deletion of authored cells; plan-style cells must first be relocated or modeled explicitly in a follow-up spec.

**Exit criteria:** Every migrated `Auto` cell is behaviorally equivalent to the pre-migration content. Cells whose authored text encodes multi-step pedagogy are either preserved temporarily behind explicit bindings or moved into a new model before deletion. No silent regressions from "plan" text to a single-call label.

### Stage 3A: Mixed-corpus authoring scaffold

**Deliverables:**
- Introduce `SectionOrNotApplicable<T>` and typed `reason: FactComposition` on the new reference model.
- Add ConventionForge checks/previews for missing sections, vacuous `NotApplicable` reasons, and invalid `FactId`s.
- Keep `reference` optional during the migration window so the remaining unauthored modules continue to render through the current fallback path.
- `relatedLinks` resolve by `moduleId` during this phase. Links to existing modules without authored reference content warn in authoring preview but do not break end-user pages.

**Exit criteria:** Mixed corpus is safe: authored-reference modules render through the rich path, omitted-reference modules keep the current fallback, and no partial migration ships broken `/learn/*` pages.

### Stage 3B: Make `reference` required + remove fallback

**Status:** Complete on 2026-04-13.

**Deliverables:**
- `reference: ModuleReference` (non-Option).
- Migrate Bergen/Blackwood/Natural-Bids/etc. — every module that omits `reference` must be authored before the hard flip lands. This was an editorial campaign, not a narrow type migration.
- Authors write `NotApplicable { reason }` only when the section genuinely has no meaningful end-user content. Do not force obviously unnatural sections just to satisfy totality; if a section class repeatedly collapses into contrived reasons for one archetype, reopen the section design.
- Delete the `if (reference) { rich } else { fallback }` branch in `+page.svelte`. One render path.

**Exit criteria:** Every fixture has a populated `reference` block. Page component has no per-module branching. ConventionForge rejects fixtures with omitted/`null` references or unauthored structural fields. Landed on 2026-04-13.

### Stage 4: Pedagogy-bullet predicates + ConventionForge oracle

**Deliverables:**
- `PredicateBullet { predicate, gloss }` replaces raw-string `whenToUse` / `whenNotToUse` / `commonMistakes`.
- ConventionForge cross-module linker: resolves `relatedLinks` targets by `moduleId`, validates target existence, and upgrades Stage 3A warnings into failures once the corpus is fully authored.
- Oracle harness built around expert-authored golden cases plus authority citations as provenance. Property tests can generate additional auction coverage, but the citation corpus is not treated as machine-readable executable truth.
- CI check: every module passes structural completeness + linker + property tests.

**Exit criteria:** `npm run lint:full` + `cargo test --workspace` include these checks. Auto-manual generation (flattening all 14 modules' references into a single reference-manual page) is possible because every module is complete by construction. The oracle is allowed to be partial, but the spec must state coverage honestly; "has provenance links" is not the same as "machine-checked against bridge literature."

### Stages deferred / out of scope for this spec

- **Locale plumbing.** `describe_fact_value` returns a `LocalizedLabel` wrapper, but actual multi-language strings are not populated. Defer until a user need exists.
- **Per-partnership overlays** (P3 Approach 3 in synthesis). Defer — solve the base-case vocabulary first.
- **ConventionForge authoring surface syntax** (P2 Approach 3). Defer until Stage 3 ships and we have evidence of what ergonomic friction looks like.

## Invariants (carry forward to testing)

- I1. **No raw string for structural axes.** Every axis label renders through `describe_fact_value`. CI lint rejects authored numeric digits inside `reference.*` rendered strings.
- I2. **Every `NotApplicable.reason` is a `FactComposition`.** Type system enforces; no `reason: String` field anywhere.
- I3. **Every module's `reference` block populated.** Enforced in code: `ConventionModule.reference` is non-optional and fixture deserialization fails when it is missing.
- I4. **Every cell derivable or explicitly bound.** Grids with `Auto` cells must project cleanly — multiple surfaces firing is a deserialize/build error.
- I4a. **Zero-match `Auto` cells are only legal with an informative reason.** A reason equivalent to the active partition discriminant, or a tautology like `Always`, fails validation.
- I5. **FactId catalog closed.** Fixture load validates every `FactId` reference against the catalog. New facts require a PR against the catalog, not an ad-hoc string.
- I6. **Sections auto-hide when `NotApplicable` in end-user view; always visible in authoring-preview view** with the typed reason rendered. End-user learn pages no longer have a separate fallback layout.
- I7. **Partition facts are governed, not opportunistic.** Discriminants are mutually exclusive/exhaustive within scope; catch-all buckets require explicit blessing and rationale.
- I8. **Reference migration may not pollute surfaces.** Do not add or split bidding surfaces solely to make a quick-reference axis or cell project cleanly.
- I9. **Validation happens before rendering.** Enforced: unknown facts fail at fixture deserialize; cross-module references fail at bundle/link time; projection ambiguity fails during build/static extraction, not in the browser.
- I10. **Author-facing errors must be actionable.** Enforced direction: validation names JSON path/module/cell coordinates and suggests the nearest valid target where possible.

## Open questions

- Q1. **Archetype scoping for fact vocabulary.** Synthesis proposes per-archetype axis registries to prevent axis explosion (P3×P4 cross-pollination). This spec defers that — treating the vocabulary as global. Revisit if fact catalog grows past ~40 entries or if axes conflict across conventions.
- Q2. **Plan-style quick-reference cells.** The current Stayman grid proves that some authored cells encode multi-step plans rather than single-surface choices. If those cells must become derivable, what is the typed representation for "ask, then invite / bid game / show longer major" without reintroducing free prose?
- Q3. **Who authors the partition-fact vocabulary?** A repo maintainer (small, curated) or a contribution process that ConventionForge orchestrates? Stage 0 starts maintainer-owned; revisit at Stage 4.
- Q4. **Stayman's pedagogical axes vs. most-branching axes.** If a module's surfaces branch heavily on facts A and B, but pedagogy wants axes A and C, the author picks — but does the system warn that axis C has low discriminating power? Instrumenting "axis quality" is a Stage 4+ nice-to-have.
- Q5. **Non-natural systems beyond the current audit corpus.** The Stage 0 vocabulary is grounded in today's 14-fixture corpus plus natural-system assumptions. If Acol/Polish/Italian modules need different partitions, do we extend the global catalog or reopen the deferred archetype-scoping decision?

## Adversarial review

### A. Vocabulary gameability

- **Attack:** An author can satisfy `NotApplicable { reason }` with a tautology (`Always`, `hand.hcp >= 0`) or by repeating the active partition bucket.
  **Defense:** Landed. T4/T5 now require non-vacuous reasons, and I4a makes tautologies or pure discriminant echoes build errors.
- **Attack:** Partition facts can hide multiple meanings behind `other`/`misc` buckets.
  **Defense:** Landed. T2.1 now rejects catch-all discriminants unless authority-backed and explicitly justified.
- **Attack:** The renderer can pressure authors to change bidding surfaces just to make a reference axis project cleanly.
  **Defense:** Landed. Stage 1 and I8 now forbid surface edits whose only purpose is reference rendering.

### B. Migration risk

- **Attack:** Stage 2 deletes authored cell prose that contains pedagogy not present in a single surface, such as Stayman's `"Ask, then invite"` / `"Ask, then bid game"` cells (`crates/bridge-conventions/fixtures/modules/stayman.json:2272-2273`).
  **Defense:** Landed. Stage 2 is narrowed: only reducible cells may auto-migrate; plan-style cells are an explicit open question (Q2), not silently flattened.
- **Attack:** Stage 3 treated `reference` becoming required as a small type migration, but the repo initially had a large omitted-reference corpus and only `stayman.json` shipped authored reference content.
  **Defense:** Landed. Stage 3 is split into 3A/3B so mixed-corpus migration is explicit and the authoring workload is acknowledged as a campaign, not a one-day cleanup.
- **Attack:** Partial migrations would ship broken learn pages if the fallback branch disappeared before every module had authored reference content. The current renderer still branches on `viewport.reference` in `src/routes/(content)/learn/[moduleId]/+page.svelte:31,70-131`.
  **Defense:** Landed. Stage 3A preserved the fallback path until the corpus was fully authored; Stage 3B then removed it.

### C. Type system gaps

- **Attack:** `SectionOrNotApplicable<T>` plus `NonEmpty<T>` still permits effectively-empty payloads or vacuous reasons.
  **Defense:** Landed. T5 now requires section-specific semantic validation and non-vacuous reasons, not just enum shape.
- **Attack:** `CellBinding::Auto` did not define what happens when zero surfaces fire or where that failure is detected.
  **Defense:** Landed. T4 and I9 now require build-time validation; zero-match is legal only with an informative reason, otherwise it fails before rendering.
- **Attack:** `FactId` validation was underspecified for bundle/linker time.
  **Defense:** Landed. Stage 0 now distinguishes fixture-load validation for local facts from bundle/link validation for cross-module references.

### D. Oracle feasibility

- **Attack:** Authority sources are mostly human-readable web pages, not executable specs, so a property oracle "against citations" is aspirational.
  **Defense:** Landed. Stage 4 now treats citations as provenance and requires expert-authored golden cases for the executable oracle.
- **Attack:** `relatedLinks` resolution was unspecified.
  **Defense:** Landed. Stage 3A/4 now state that links resolve by `moduleId`, warn during mixed-corpus migration, and fail once the corpus is fully authored.

### E. Scalability of the partition vocabulary

- **Attack:** A global partition catalog can quietly accrete one-off facts until it becomes unmanageable.
  **Defense:** Landed. T2.1 and I7 add governance, shared-use expectations, and a threshold for reopening archetype scoping.
- **Attack:** Systems outside the present natural-system corpus may not fit the Stage 0 partitions.
  **Defense:** Acknowledged limitation. Q5 now records this explicitly; the current spec defers the generalization decision until those modules exist.

### F. Locale as afterthought

- **Attack:** `LocalizedLabel` was mentioned but not actually defined, which would make Stage 0 English-only by accident.
  **Defense:** Landed. T1 now defines `LocalizedLabel` as part of the Stage 0 data model.

### G. Author UX

- **Attack:** Adding a new convention could become a three-file tax (fixture + fact catalog + describer) even when the module fits existing vocabulary.
  **Defense:** Landed in part. The spec now makes the happy path explicit: existing vocabulary means fixture-only authoring; catalog/describer edits happen only when admitting new shared vocabulary. This remains a deliberate governance cost, not accidental friction.
- **Attack:** Current error behavior is too underspecified for authors to recover quickly from mistakes like unknown `FactId`, overlapping partitions, or ambiguous `Auto` cells.
  **Defense:** Landed. Stage 0 and I10 now require actionable diagnostics naming the JSON path/module/cell and nearest valid targets.
