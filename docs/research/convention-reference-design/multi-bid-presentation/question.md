# Research Question

## Core Question
When a bridge convention consists of multiple peer entry-point bids (rather than one call with branches), what presentation format — in both authoritative bridge reference sources and in learning-science-informed UI — best communicates the convention as a family of calls while avoiding the misconception that one bid is canonical and the others are secondary?

## Key Concepts

- **Multi-bid / peer-entry-point convention**: a convention where several calls are each legitimate starting points of the convention, not branches under one "main" call. Synonyms: parallel-structure convention, family of calls, coordinated bid set, variant-set convention.
- **Hero presentation**: the single most-prominent-call rendering used in reference summaries. Synonyms: primary bid, defining call, representative call, exemplar bid.
- **Convention reference page**: the canonical one-convention explainer surface in a learning app or textbook. Synonyms: convention card entry, convention guide page, reference sheet.
- **Worked examples / parallel variability**: instructional-design treatments that present multiple surface instances of the same underlying schema. Synonyms: variability of practice, multiple-examples design, contrast cases, juxtaposed examples.
- **Schema formation for parallel content**: the cognitive process of abstracting a shared rule from several co-presented instances. Synonyms: analogical abstraction, structural alignment, schema induction.

## Native Field
Bridge pedagogy / convention reference authoring (intersection: instructional design for game conventions).

## Adjacent Fields
- **Instructional design / cognitive load theory**: studies worked-example presentation, variability-of-practice, juxtaposition effects on schema induction — directly relevant to whether co-presenting peer bids vs one-hero-with-branches affects learning.
- **Analogical reasoning / structural alignment (Gentner, Goldstone)**: evidence that side-by-side presentation of multiple instances promotes schema abstraction; single-instance presentation biases toward surface features.
- **Chess pedagogy and chess-opening reference design**: closest game-learning analogue. Opening books and digital chess trainers have had to decide whether to present "main line" vs transpositions/sidelines as equal peers, which is structurally identical to the bridge-convention question.
- **Technical-documentation design for parallel APIs / syntax variants**: how software reference docs present families of related functions or syntax forms (e.g. Python's `format` vs f-string vs %, or SQL dialect differences) — similar problem of canonicality bias in documentation.

## Local Context Found

Relevant existing project documents:

- `docs/research/convention-reference-design/reference-page-template.md` — current design template. Defines `summaryCard` hero with single `definingMeaningId`. Applies a "Reuben Fine principle" that the response tree be regeneratable from one guiding sentence. Does **not** address the peer-bid case.
- `docs/research/convention-reference-design/evidence-summary.md` — synthesis of three research waves (reference-manual design, learning science, bridge/game exemplars). Does not specifically treat multi-bid conventions as a distinct design case.
- `docs/guides/convention-authoring.md` — authoring contract. Fixes `summaryCard` authored fields to `{ trigger, definingMeaningId, partnership }`. Derived bid/promises/denies come from the single defining meaning.
- Observed concrete failures: Jacoby Transfers reference page subtitle mentions "Bid 2♦/2♥" but hero shows only 2♦ with promises "5+ hearts"; partnership text openly admits "the summary card shows the heart-transfer branch." Bergen Raises hero shows 3♣ with promises "7–10 HCP; Exactly 4 hearts" — erasing the constructive/limit contrast between 3♣ and 3♦ that is the whole point of Bergen.
- Codebase memory `feedback_defining_meaning_link.md` captures the current singular-hero rule as a design decision to follow in authoring.

No prior research artifact in this project has specifically investigated multi-bid-convention presentation.
