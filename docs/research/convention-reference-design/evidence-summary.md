# Convention Reference Design — Evidence Summary

Synthesis of three parallel research waves:

1. Reference manual / technical-documentation design (Diátaxis, NN/g scannability, minimalism, progressive disclosure, information scent).
2. Learning science (schema theory, cognitive load, dual coding, desirable difficulties, concreteness fading, interleaving, expertise reversal).
3. Bridge and adjacent-game reference exemplars (Audrey Grant, Larry Cohen, Pavlicek, bridgebum; Chessable, Reuben Fine; poker range charts; MtG rules; MDN; Rust Book).

Raw per-wave reports with full citations live in `_output/contexts/260412-0935-.../notes/01..03-*.md`.

---

## The Ten Principles (ranked by leverage for this project)

Ranked by how much each one should change what we ship. The first five are non-negotiable; the rest are corrections that keep the first five from going wrong.

### 1. Reference is not a tutorial — and the guided flow has already taught.

The single most common failure in the current reference is **re-teaching material the guided flow already covered**. Diátaxis is emphatic: reference is *cognition + application*, austere, neutral, describing the machinery. The guided flow is the tutorial; the reference page must stop re-motivating. Trust the flow.

*What this means concretely.* Cut history sections, "bridge is a game of..." preambles, and paragraph-long motivations. A single one-sentence *Guiding Idea* replaces all of them (see §4).

### 2. The returning user's query is narrow and specific; the page must match it in 1–2 eye fixations.

Memory and information-scent research converge: a returner arrives with a specific retrieval cue ("what did 2♦ mean again?") and succeeds only if the page surface matches that cue immediately. Re-organized prose, however good, breaks this. A **cheat-sheet table at the top** and **stable section anchors** are the two features that determine returner success.

*What this means concretely.* Every convention page must open with a summary card the returner can resolve against without scrolling. Every response and sub-line gets a stable anchor id that never changes across edits.

### 3. Users scan; headings are the primary UI.

NN/g's core findings: 79% of users scan, and the productive scanning pattern (layer-cake) depends on every heading being a self-contained predicate. Generic headings ("Details", "Notes", "More") collapse scanning into the F-pattern, which correlates with poor comprehension.

*What this means concretely.* Heading text must carry the answer, not a label. `Stayman response 2♦ — no 4-card major` beats `2♦ Response`. Table row headers function as headings too — the bid code goes in the first column, bolded.

### 4. Experts store named chunks, not rules — the reference is a catalog of chunks.

Chase & Simon's chess work (directly analogous to bridge auctions) shows expertise is pattern recognition over named, schema-like structures. A reference that lists only rules teaches a novice representation. The **Reuben Fine principle** — "ideas before moves" — is the same insight from the opposite direction: a one-sentence guiding idea lets the reader reconstruct the response tree when they've forgotten the specifics.

*What this means concretely.* Every convention gets a **Guiding Idea line** (one sentence from which the rest is regeneratable) and every recurring auction pattern gets a **named, visually marked chunk** reused consistently across the reference.

### 5. Examples are annotated, not narrated. Worked > prose.

The worked-example effect is one of the most robust findings in instructional psychology. Pavlicek, bridgebum, MDN, and Chessable all converge on the same visual form: show the artifact (auction, code) with **inline one-line rationale per bid**. Paragraph-style narration of an auction teaches less and scans worse than an annotated diagram.

*What this means concretely.* Every worked auction is a visual grid with inline annotations, not a paragraph. Pair at least two contrasting examples per rule (one prototypical, one near-boundary) plus one **non-example** ("do not use Stayman with 4-3-3-3") — negative space sharpens category boundaries and is where intermediate players actually err.

### 6. Progressive disclosure is two-tier, not infinite nesting.

NN/g and IBM converge: one level of "expand for more" works; deeper nesting hides content below the scent threshold. Accordion headers must contain the payload keyword, not a generic verb — `1NT–2♣–2♦–? (3 continuations)` beats `Show more`.

*What this means concretely.* Primary content is visible. Secondary content (example details, competitive auctions, rare exceptions) expands one level. That's it. Pre-render hidden content in the DOM so in-page search finds it.

### 7. Dual coding works only when diagram and text are spatially adjacent and carry non-redundant information.

Mayer's multimedia principles: text + diagram beats either alone **only** when (a) semantically aligned, (b) spatially contiguous, (c) non-redundant. Mirroring the diagram's content in prose underneath actively hurts. The diagram should carry *shape* (what happened); the prose should carry *why*.

*What this means concretely.* Auction grids sit with annotations inline, not with a caption below repeating them. Kill decorative icons — every visual element must map 1:1 to a concept (coherence principle).

### 8. Clarity of referents is a layout problem, not a writing problem.

Bridge prose is dense with multiple agents (N/S/E/W, opener/responder) and multiple bids; pronouns and deictics ("this", "that bid", "they") are the single largest source of reader confusion. Tables and typographic distinction resolve this before it starts.

*What this means concretely.* **Zero-pronoun rule in reference rows.** Bids in `monospace` (`2♣`), seats in small-caps (Opener / Responder), HCP ranges in a fixed pill style. Multi-referent interactions go in a table (Opener | Responder | Meaning | Notes), not prose. Once a unique referent is established in a paragraph, a single pronoun is fine — the rule is "no ambiguity", not "no pronouns".

### 9. Concreteness fading beats either pure-abstract or pure-concrete presentation.

Fyfe & McNeil: specific example → schematized form → abstract rule, co-located on the same page, outperforms either endpoint for transfer. The returner reads only the abstract rule; the first-timer drops into the concrete example; the intermediate uses all three to verify understanding.

*What this means concretely.* Each rule appears in three forms, visible simultaneously: a specific hand-and-auction, a shape-and-HCP schema, and the abstract rule statement.

### 10. Block first within a convention, interleave across neighbours.

Interleaving helps discrimination between similar items but hurts rule induction before the rule is known. Bridge has both needs: each convention's section should be **blocked** (many examples of *that* convention so the pattern emerges) while adjacent conventions get **discrimination tables** showing same opening, different hands, side-by-side outcomes.

*What this means concretely.* Single-convention page = blocked. Bundle-level or cross-links = discrimination tables juxtaposing near neighbours (Stayman vs. transfer; weak jump vs. limit raise). Exceptions live with the rule they modify, never in a trailing appendix.

---

## Principles the research explicitly corrects

Places where a reasonable-sounding instinct is wrong:

- **"Always interleave" is wrong for rule induction.** Interleaving is for discrimination, and only after rules are known. Block within a convention.
- **"More examples is better" is wrong past 3.** One rule + two contrasting examples + one non-example is the evidence-supported minimum; more is diminishing returns and inflates extraneous load.
- **"Beautifully rewritten prose" is wrong for returners.** A rewrite that moves a section breaks muscle memory. Additive edits and stable anchors beat polish.
- **"Retrieval practice conflicts with reference" is resolvable by layout, not content.** Put the cue (auction, hand) above and hide the answer behind expand-or-scroll. The reader's eye attempts retrieval even when the material is static.
- **"Pure minimalism serves everyone" is wrong for first-timers.** Add a single well-placed explanation card at the top (italic / distinct styling) so the returner can skip it while the first-timer still gets mental-model support.
- **"Appendices for exceptions" is wrong.** Orphaned exceptions don't attach to the schema. Exceptions are first-class content adjacent to the rule they modify.

---

## Open Questions

- Does a printable quick-reference card (MtG-style Basic Rules split) have enough uptake in a web-only practice app to be worth the authoring cost, or does an on-screen condensed mode suffice?
- Retrieval-practice prompts ("what would you bid with ♠KJ52 ♥Q4 ♦KQT4 ♣932?") embedded in the static reference add authoring cost per convention. Worth the cognitive benefit, or is it better to rely on the guided flow for retrieval and keep the reference purely normative?
- Named-chunk vocabulary: how many canonical sequence names does the intermediate reader need to carry, and what is the authoring process for introducing them? Naming too many patterns inflates the document; too few leaves expertise implicit.

---

## Resolved Questions

- **System Compatibility row (rendering under SAYC / 2/1 / Acol / Custom).** *Resolved 2026-04-12.* A dedicated per-system compatibility row is rejected. Per-system differences are rendered automatically from the active `SystemConfig` via the `systemFactLadder → describe_system_fact_value → SystemConfig` chain, which is the single system-awareness chokepoint. Authors never spell per-system prose. A global system picker (letting the reader view the same page under a different system) is deferred until a concrete need emerges. See `reference-page-template.md` §8.

## Applied Output

The concrete template synthesizing these principles into section order, visual treatments, and consistency rules lives in [reference-page-template.md](./reference-page-template.md).

## Source Pointers

Full per-wave reports with citations in the session context folder:

- `01-reference-manual-design.md` — Diátaxis, NN/g, minimalism, progressive disclosure, scannability, visual reference design, worked examples, returner UX, referent clarity
- `02-learning-science.md` — schema/chunking, CLT, dual coding, desirable difficulties, retrieval & spacing for static docs, concreteness fading, interleaving, transfer, expertise reversal
- `03-bridge-and-game-exemplars.md` — Pavlicek, bridgebum, Cohen, Grant, Chessable, Fine, poker ranges, MtG rules, MDN, Rust Book; synthesized 10-section page template
