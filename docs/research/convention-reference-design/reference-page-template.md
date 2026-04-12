# Convention Reference Page — Template

Concrete, opinionated template for the reference section that sits below the guided convention flow. Every convention reference page uses these sections, in this exact order, with these visual treatments. Rationale is grounded in [evidence-summary.md](./evidence-summary.md); each section below links the principles that justify it.

**Audience assumption.** The reader has just completed (or previously completed) the guided flow for this convention. Do not re-teach or re-motivate. Reference, not tutorial.

---

## Section order (fixed across every convention)

### 1. Summary card — above the fold, always visible

A boxed block, maximum six lines:

- **Trigger** — the exact auction slot (e.g. *Partner opens 1NT, you respond*).
- **Convention bid** — the artificial call, in monospace (e.g. `2♣`).
- **Promises** — one line (what the bid shows).
- **Denies** — one line (what the bid rules out).
- **Guiding idea** — one sentence from which the response tree is regeneratable (the *Reuben Fine principle*). E.g. *"We use `2♣` to find a 4-4 major fit opposite a balanced 15–17 NT, because a 4-4 major at the 2-level outscores 1NT."*
- **Partnership note** — *Required agreement / optional / on by default in SAYC*.

Visual: card with a coloured left border keyed to convention family (asking / showing / preemptive / competitive).

*Why:* returner's retrieval cue must resolve in 1–2 fixations (§2, §3); one-sentence guiding idea lets the reader reconstruct the rest (§4); supersedes any history / motivation section (§1).

### 2. When to use / When NOT to use

Two parallel bulleted columns, equal weight. Each "don't" is a one-liner with the reason in parentheses.

*Why:* intermediate players err on the negative space, not the positive (§5, exemplar evidence from Audrey Grant / Chessable). Exceptions belong beside the rule, never in a trailing appendix (§10).

### 3. Response table — the spine of the page

Table keyed on the convention bid. Fixed columns, identical across every convention:

| Response | Meaning | Shape | HCP | Forcing? |
|----------|---------|-------|-----|----------|

One row per partner action. Every row has a stable anchor id (see Consistency Rules below). Bids in monospace; forcing cell uses consistent tokens (`NF`, `INV`, `F1`, `GF`).

*Why:* tables eliminate pronoun / referent ambiguity (§8); fixed schema across conventions trains predictable skimming (§3, MDN exemplar).

### 4. Continuation tree — indentation style

Nested bulleted list (Pavlicek-inspired). For example:

```
2♣ (Stayman) — asking for a 4-card major
  2♦ — no 4-card major
    2NT — INV, 8–9 HCP
    3NT — GF, no major fit
  2♥ — 4+ hearts (may have 4 spades)
    ...
```

Each parent bid links to its own anchored row in the response table when the sub-tree is large; small sub-trees inline as indented bullets.

*Why:* high information density, grep-able, matches the indexing order of the reader's memory (§3, §5; exemplar: Pavlicek for density, rulebook doctrine for bid-order sequencing).

### 5. Decision grid — when the decision space is 2-D

Not every convention has one. Use when the decision is genuinely two-dimensional:

- *Responder's hand classification* — rows = HCP range, columns = shape class.
- *Bergen Raises* — rows = support count, columns = HCP class; cells = `3♣` / `3♦` / `3♠` / splinter.

Colour-coded by action family (signoff / invite / force / asking / preempt). Every colour must have a text label for accessibility.

*Why:* poker-range-chart analog — spatial regularity makes patterns visible faster than prose (§7; exemplar: 13×13 preflop grids).

#### Proposal (2026-04-12): replace optional `decisionGrid` with required tagged-union `quickReference`

Status: proposed, not yet implemented. Supersedes the optional `decisionGrid` for MVP authoring purposes.

**Problem with the current `decisionGrid: Option<...>`:** the schema tells the author "fill this in if your convention is 2-D, else leave it null" — but an author opening blank JSON cannot answer that question confidently, and optionality silently swallows conventions where the author just didn't try. Making it *required-as-grid*, however, would fake 2-D structure onto Blackwood/Gerber/transfers where the decision space is genuinely 1-D (keycard count, target suit), which would violate principle 7 (coherence) and principle 4 (chunks should reflect the actual schema, not a forced shape).

**Shape** — required on every `reference` block, tagged variant. Axes themselves are also tagged, splitting **threshold** (system-sensitive, derived labels) from **categorical** (system-invariant, authored prose):

```jsonc
"quickReference": {
  "kind": "grid",
  "rowAxis": {
    "kind": "systemFactLadder",
    "label": "Responder strength",
    "facts": [
      "system.responder.weakHand",
      "system.responder.inviteValues",
      "system.responder.gameValues"
    ]
    // row labels DERIVED at render time via describe_system_fact_value(fact, SystemConfig)
    // — automatically correct under SAYC / 2-1 / Acol / custom 1NT range
  },
  "colAxis": {
    "kind": "qualitative",
    "label": "Shape",
    "values": ["No 4-card major", "One 4-card major", "5-4 majors", "4-3-3-3"]
  },
  "cells": [[...], [...], [...]]  // rows.len() × cols.len(), each a short authored recommendation
}
// OR
"quickReference": {
  "kind": "list",
  "axis": { "kind": "qualitative", "label": "Keycards held",
            "values": ["0 or 3 keycards", "1 or 4 keycards", "2 without the trump queen", "2 with the trump queen"] },
  "items": [
    { "recommendation": "5♣", "note": "" },
    { "recommendation": "5♦", "note": "" },
    { "recommendation": "5♥", "note": "" },
    { "recommendation": "5♠", "note": "" }
  ]
}
```

**Axis variants:**

- `systemFactLadder` — list of fact IDs (typically `system.*`) that partition the axis. Labels are derived per active `SystemConfig` via the same chain the response-table plan uses (`describe_system_fact_value`). Threshold boundaries adjust automatically across systems; the fixture does not change. No authored numeric thresholds means no digit-run leak is even possible — enforced by construction.
- `qualitative` — authored prose values. Used when the axis is system-invariant (shape class, target suit, keycard count, opponent action). Digit-run lint applies to every value string.
- Follow-up variant (not MVP): `factPartition` — structured multi-fact partitions for shape/distribution axes, once `FactDefinition` carries category metadata. Qualitative covers this case for now.

**Cells stay authored** in both variants. The grid/list structure is a teaching partition of *recommendations*, not of facts; you cannot regenerate it from rule data. What's derivable is the **threshold-axis labels**, and that's exactly where system-sensitivity leaks otherwise.

**Why this shape:**

- **Preserves the poker-range-chart insight** (principle 7 + 13×13 preflop-grid exemplar) for conventions whose decision space is genuinely 2-D — spatial position stays a retrieval cue, the returner jumps to `(8-9 HCP, 5-4 majors)` rather than scanning a flat list.
- **Doesn't fake 2-D structure** onto 1-D conventions (Blackwood, Gerber, Jacoby Transfers). Principle 4 (chunks reflect actual schema) and principle 9 (concreteness fading) both argue against forcing an artificial second axis.
- **Named axes (`rowAxis`, `colAxis`, `axis`) make the authoring task legible.** Current `decisionGrid.rows: ["0-7 HCP", ...]` leaves the axis meaning implicit — an author staring at blank `rows`/`cols` arrays has no anchor. Explicit `rowAxis: "Responder HCP"` says "this axis partitions by responder hand strength", which is something an author can reason about.
- **Required, with no null escape.** Authoring ambiguity ("is my convention 2-D enough?") collapses to a binary choice the author can answer: do my recommendations split cleanly along two axes, or one? Same philosophical move as `interference: applicable | notApplicable` — the sentinel forces an explicit declaration rather than permitting silent omission.

**Validation (structural test):**

- `kind == "grid"` → both axes well-formed (see axis rules below); `cells.len() == rowAxis.length` and each `cells[i].len() == colAxis.length`; every cell non-empty.
- `kind == "list"` → axis well-formed; `items.len() == axis.length`; each item has non-empty `recommendation`.
- Axis rules:
  - `systemFactLadder`: `label` non-empty; `facts.len() >= 2`; each fact ID exists in the fact catalog; facts are system-partitioning (checked at render time, not structural — if a label fails to resolve, error loudly rather than render blank).
  - `qualitative`: `label` non-empty; `values.len() >= 2`; digit-run lint applies to each value.
- Digit-run lint applies to: axis labels (both variants), qualitative axis values, cell text, item `recommendation` and `note`. Does not apply to `systemFactLadder` facts (they are IDs, not prose) or to fact IDs themselves.

**Rejected alternative — keep `decisionGrid: Option<...>`.** Fails the "clear what the author fills out" test. Authors either skip it (carries no information) or hand-pick axes inconsistently (UI treatment varies per convention).

**Rejected alternative — flat `quickReference` list for every convention.** Regresses on the research: Stayman, Bergen Raises, and responder hand classification lose the 2-D spatial-retrieval benefit the poker-range-chart exemplar specifically supports. Principle 7's coherence argument (diagram carries shape, prose carries why) is weaker when shape collapses to a 1-column list.

**Rejected alternative — facet-map rows** (`{ facets: { hcp: "8-9", shape: "one major" } }`). Structurally richer and auto-pivots, but pushes axis-naming back onto the author as free-form keys. Revisit once `FactDefinition` carries category metadata so facet keys can be fact-ID-aligned.

### 6. Worked auctions — annotated, not narrated

Three to five short auctions, each a visual grid with **one-line rationale per bid inline**. No paragraph descriptions. Cover:

- The main line (prototypical example).
- A common alternative (boundary / near-miss case).
- A well-known trap or non-example ("do not do this").

Annotations use the established typography (bids monospace, seats small-caps, HCP in pills). Diagram carries the shape; annotation carries the *why* — never mirror the same information in both channels (§7 redundancy principle).

*Why:* worked-example effect (§5); exemplar pattern from MDN, Pavlicek, and Chessable; coherence principle forbids duplicating diagram content in prose (§7).

### 7. In competition / interference

Dedicated section. Short bullets keyed on opponent action. Interference changes meanings and players forget this first.

*Why:* exemplar evidence — bridgebum's failure mode is burying interference in "Other considerations"; it needs its own heading (§3, §10).

### 8. System compatibility

MDN-style compatibility row:

| SAYC | 2/1 | Acol | Custom |
|------|-----|------|--------|

One cell per base system. If identical across systems, say so in a single line and collapse the table. If divergent, note the delta briefly and link to the per-system entry. Maps directly to `SystemConfig` in this codebase.

*Why:* exemplar pattern from MDN browser-compatibility tables; direct hook into project `SystemConfig` architecture.

### 9. Related conventions — cross-links

Brief list, one line per link. `See also` style. Each link is labelled with the **discriminator**, not just the target name:

- `Stayman after 2NT opening (differences)` — not `Stayman 2NT`.
- `Jacoby Transfers (asks for major suit vs. Stayman's 4-card ask)` — not `Jacoby Transfers`.

*Why:* cross-link scent requires the discriminator, or users land on a subtly-different page and lose trust (§3).

### 10. Printable / condensed quick-reference

A separate artifact: Summary Card + Response Table only. One screen. Rendered as a print view or condensed modal.

*Why:* rulebook doctrine — reference-during-play and reference-for-study are different modes; every heavy Eurogame, every MtG tournament venue has a separate player-aid card.

---

## What the template deliberately omits

- **No history or origin section on the main page.** If retained at all, it's a collapsed `Background` disclosure at the very bottom. The reference page is for return visits, not appreciation.
- **No re-motivation** beyond the one-sentence Guiding Idea. The guided flow already motivated; duplication is noise (§1).
- **No "theory of 1NT auctions" preambles.** If the reader doesn't know what 1NT means, they are not on the correct page.
- **No deep nested accordions.** One level of progressive disclosure. More hides content below the scent threshold (§6).

---

## Consistency rules (apply across every convention page)

These are structural invariants — changing them for a single convention is a bug, not a style choice.

1. **Heading order is fixed.** Sections 1–10 appear in this order on every page. Returners learn the skeleton once.
2. **Table schemas are fixed.** Response-table columns are exactly `Response | Meaning | Shape | HCP | Forcing?`. System-compatibility columns are exactly `SAYC | 2/1 | Acol | Custom`.
3. **Colour semantics are fixed across the whole reference.** E.g. green = signoff, yellow = invite, red = force, blue = asking. Never reuse a colour with different meaning in a different section.
4. **Typographic referent encoding.** Bids in monospace (`2♣`). Seats in small-caps (Opener / Responder). HCP ranges in a fixed pill style. Zero pronouns in response-table rows.
5. **Stable anchor ids.** Every response row, every continuation sub-line, every section has a stable `#convention-bid-response` anchor. Never rename; only add. The guided-practice flow and coverage reports deep-link by these anchors.
6. **Additive edits only.** Do not silently restructure. Append, don't rearrange. Returning users' muscle memory is load-bearing.
7. **One-level progressive disclosure only.** Primary content visible; secondary content one expand away; nothing deeper. Hidden content must be in the DOM (not JS-lazy) so in-page search finds it.

---

## Rejected alternatives

### Single long page, not tabs

The reference page stays a single long page. Tabs were rejected for four reasons:

- Stable anchors and browser `Ctrl-F` are load-bearing for returning users, and both degrade when relevant content sits behind inactive tabs.
- The exemplar references that informed this template are long-form reference pages, not tab sets.
- One level of progressive disclosure (`details` / `summary`) already gives enough scannability without adding wayfinding cost.
- This product already has the tutorial/reference split structurally: guided practice is the tutorial; `/learn/[moduleId]` is the reference surface.

## Anchor-id scheme

Stable anchors must route through `slugifyMeaningId(moduleId, meaningId)` in `src/service/display/util/slugify-meaning-id.ts`. The contract is:

- Replace every `:` in `meaningId` with `-`.
- If `meaningId` already starts with `${moduleId}:`, use that slug directly.
- Otherwise prefix with `${moduleId}-`.

Examples:

- `stayman:ask-major` -> `#stayman-ask-major`
- `jacoby-transfers:complete-transfer` on the `jacoby-transfers` page -> `#jacoby-transfers-complete-transfer`
- Foreign or cross-module ids still receive the current page prefix.

Do not hand-roll fragments in page code. These anchors are bookmarkable and intended for deep links from guided practice, coverage, and docs. Never rename existing anchors; only add new ones.

---

## Authoring smells — duplication and derivable fields (2026-04-12 audit)

Status: audit notes; fixes not yet in plan. Use this when locking `ModuleReference` to avoid baking duplication into the required schema.

### Large smells

**`teaching` block duplicates half of `reference`.** `ConventionModule.teaching` (used by the guided flow) already carries `teaching.principle` (≈ `reference.summaryCard.guidingIdea`) and `teaching.commonMistakes` (≈ `reference.whenNotToUse`). On Stayman both pairs are reworded restatements of the same content. For 30 conventions this is the single largest drift surface between tutorial and reference. Fix: either drop the duplicates from `reference` and render from `teaching` at viewport build time, or mark them as authored-overrides with `teaching` as the default. Research principle 1 (reference is not a tutorial) does not require *different content*, only different treatment — derivation-with-override satisfies both.

**`summaryCard` duplicates rule data in 4 of 6 fields.** `trigger` is the FSM entry condition, `bid` is the defining meaning's `encoding.default_call`, `promises` and `denies` are the defining meaning's public fact clauses reworded as prose. Authoring them separately lets the card contradict the rules silently (e.g. when Stayman is extended to 5-4 majors, the card must be hand-updated). Fix: derive trigger/bid/promises/denies at viewport build time via the same `describe_system_fact_value` / clause-render chain the response-table plan already uses. Only `guidingIdea` (and possibly `partnership`) remain authored. Collapses the required authoring surface from 6 fields to 1–2.

**`workedAuctions[].calls[].rationale` duplicates meaning teaching labels.** Each call's rationale echoes `teaching_label.summary` + clause descriptions on the corresponding rule-data meaning, with no linkage — rationale can drift from rules silently. Fix: each call optionally references a `meaningId`; rationale defaults to the meaning's teaching label; authored rationale becomes a contrastive/pedagogical override (required for non-example auctions where no matching meaning exists). Structural test: when `meaningId` present, the call must equal the meaning's `encoding.default_call`. Also: `seat` is derivable from auction position given the dealer — drop from fixture, render from position.

### Medium smells

**`summaryCard.partnership` leaks system names as prose.** Stayman's card says "Core SAYC agreement…" — the system name is a system-specific leak the digit-run lint does not catch. Fix: extend the structural lint to `/\b(SAYC|2\/1|Acol|Precision)\b/i` across the same fields the digit-run regex covers. Same cheap regex class, same false-positive-via-rephrase escape.

**`relatedLinks[].discriminator` often duplicates the target's `guidingIdea`.** Stayman's discriminator for Jacoby Transfers essentially restates Jacoby's own one-sentence essence. Fix: default discriminator to the target module's `guidingIdea`; authored override reserved for contrastive framing (which is genuinely different from self-description). Also add a reciprocity structural check — if A links to B, B links to A.

### Small / deferred smells

- `interference.items[].opponentAction` prose partitions a competitive-auction state space that is or could be encoded in attached-module rule data (Lebensohl, Support Doubles, Negative Doubles). The `applicable | notApplicable` sentinel is the right MVP; structured opponent-action linkage waits until attached-module metadata is richer.
- `whenToUse` items could optionally reference the fact IDs that justify them. Not critical — the digit-run lint already blocks the worst drift.
- `whenNotToUse` "use X instead" items are technically derivable from cross-module precedence. Not worth deriving for MVP.

### Ranking — pick before locking the schema

1. Collapse `summaryCard` 6→2 fields (derive trigger/bid/promises/denies).
2. De-duplicate `teaching` ↔ `reference.{guidingIdea, whenNotToUse}`.
3. System-name lint extension.
4. Worked-auction `meaningId` linkage + drop `seat`.
5. Discriminator default + reciprocity check.

Items 1–3 together cut the required authoring surface roughly in half and remove the three largest drift vectors between rules and reference. Worth doing before the schema locks and 30 conventions start authoring against it.

---

## Author's checklist (paste into PR descriptions when adding a convention)

Verify before merging:

- [ ] Summary card is ≤6 lines, includes a one-sentence Guiding Idea.
- [ ] "When NOT to use" has at least as many items as "When to use", each with a parenthesized reason.
- [ ] Response table uses the exact fixed column schema.
- [ ] Every response row and continuation sub-line has a stable anchor id.
- [ ] At least one decision grid if the decision space is 2-D.
- [ ] ≥3 worked auctions, each annotated inline (no paragraph narration).
- [ ] At least one non-example included.
- [ ] Dedicated interference section (not buried elsewhere).
- [ ] System compatibility row present and correct.
- [ ] Cross-links are labelled with discriminators, not just target names.
- [ ] No history, no re-motivation, no preamble.
- [ ] All bids render in monospace, all seats in small-caps.
- [ ] Zero ambiguous pronouns in response-table rows.
