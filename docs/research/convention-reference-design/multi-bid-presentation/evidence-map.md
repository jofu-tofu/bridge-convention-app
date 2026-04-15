# Evidence Map: Presenting Multi-Bid Bridge Conventions on Reference Pages

## Executive Summary

Across learning science, adjacent-domain reference practice, and in-domain bridge
*disclosure* documents, the evidence converges on a clear direction: when a convention
is structurally a **family of peer entry-point calls** (Jacoby 2♦/2♥, Bergen 3♣/3♦,
DONT doubles/2♣/2♦/2♥, Two-way NMF 2♣/2♦, Unusual NT), it should be presented as a
peer grid with an explicit *discriminator* (what differs between peers) and a shared
schema header (the family name, trigger, and partnership role). The current
singular-hero `summaryCard` is the minority cross-domain format and is demonstrably
broken for these specific conventions. Confidence is **high on direction, low on
quantitative transfer**: no empirical A/B exists in any reference-page domain
(bridge, chess, API docs), and the biggest unresolved tension is that published
bridge *teaching* texts (Grant, Root, Kantar, Lawrence) reportedly use hero-plus-variants
prose — and no one in this review actually opened them. Expertise reversal
(Nückles 2025, d ≈ −0.43 for experts) means a flat peer grid will likely harm
returning intermediate users, so expertise-adaptive layering is warranted as a v2.
Fix the documented failures (Bergen, Jacoby) now under structure-matched
presentation; defer a uniform rewrite until one modern bridge teaching book has been
surveyed.

## Evidence Quality

- Papers reviewed: ~70 distinct sources (27 seed + ~43 expansion across backward,
  forward, cross-domain, adversarial)
- Systematic reviews / meta-analyses: 9 (Nückles 2025, Barbieri 2023, Wittwer &
  Renkl 2010, Jitendra 2018, Alfieri 2013, Gentner & Hoyos 2017, Gentner 2025,
  Alessandrini 2025, Sweller et al. 2023 replication review)
- Unverified (`[FROM TRAINING — verify]`): ~30, heavily concentrated in
  backward-expansion (all 27 items) and cross-domain expansion (most items)
- **Overall quality: Moderate** for the general learning-science claim (juxtaposed
  peer instances beat single-hero for schema induction); **Weak** for the direct
  target (bridge reference-page design — the recommendation transfers by
  structural analogy, not direct test)

## Key Findings

### 1. Juxtaposed multi-instance presentation beats sequential/single-hero for schema abstraction

- **Confidence:** High (for instructional contexts)
- **Evidence:** Gentner/Loewenstein/Thompson 2003 (~3× transfer); Rittle-Johnson/Star/Durkin
  program 2007–2020; Schwartz & Bransford 1998 "A Time for Telling"; Barbieri 2023 meta
  (g = 0.48); Alfieri 2013 case-comparison meta (g ≈ 0.5); Jitendra 2018 schema
  instruction (g = 1.57 immediate); Gick & Holyoak 1983. All verified or verified
  at review level.
- **Caveats:** All studies are classroom / lab with explicit transfer tests, not
  self-paced reference reading during practice. Ecological distance is real
  (Systematic Risk §2). Rittle-Johnson 2020 year-long Algebra I RCT shows a
  **partial null when implementation dose was low** — implementation details
  dominate.

### 2. Comparison benefit is expertise-gated (expertise reversal)

- **Confidence:** High
- **Evidence:** Nückles 2025 meta (k = 60, N = 5924; d = +0.505 novices,
  d = −0.428 experts) — verified; Kalyuga 2007 review; Chen/Kalyuga/Sweller 2017
  (element interactivity); Likourezos/Kalyuga/Sweller 2019.
- **Caveats:** Direct cost to experts is non-trivial. A bridge app's "intermediate
  returning" segment likely sits near the inversion point. Implication: peer grid
  as v1 default is defensible; expertise-adaptive collapse is a real v2 need.

### 3. Labeling the shared schema amplifies abstraction

- **Confidence:** Medium-High
- **Evidence:** Goldwater & Gentner 2015; Jamrozik & Gentner 2022 (via 2025 handbook);
  Jitendra 2018 (g = 1.57 on schema-surfaced instruction); Gentner & Hoyos 2017;
  Aleven 2022 (tell-then-contrast > contrast-then-tell).
- **Implication:** Put the family-level meaning (the "what this convention does" sentence)
  *above* the peer grid, not derived from one hero bid.

### 4. Cross-domain reference surfaces converge on peer-parallel-with-discriminator

- **Confidence:** Medium (pattern broad, most individual citations unverified)
- **Verified:** OpenAPI v3 `oneOf` + discriminator; ACBL convention card (the only
  authoritative *bridge* reference document) treats conventions as named agreements
  with peer bid-slots and has no notion of hero bid.
- **`[FROM TRAINING — verify]`:** DSM-III → DSM-5-TR reliability-improvement narrative;
  MTG Comprehensive Rules §702 keyword family layout; D&D 5e PHB; Javadoc/IDE method
  overload documentation; legal Restatements; cartographic legends; math theorem
  families. **Do not use any specific historical episode (DSM-III shift, D&D 3e shift)
  as a load-bearing argument without verification.**
- **Caveat:** The *pattern* is plausible and broad; the specific episodes are brittle.

### 5. Single-hero presentation induces typicality bias

- **Confidence:** Medium (theoretical + indirect empirical)
- **Evidence:** Medin & Schaffer 1978; Nosofsky 1986; Rosch & Mervis 1975.
- **Counter:** Prototype theory (Rosch 1978) says some categories *are* genuinely
  prototype-organized — hero matches cognition there (e.g. Stayman, Puppet Stayman,
  Strong 2♣). Murphy & Medin hybrid models suggest "prototype anchor + small exemplar
  set" is the best-fitting empirical model — which argues for *shared-schema header
  + enumerated peers*, not a pure peer grid.

### 6. Effect sizes in the d/g ≈ 0.5 band — real floor, or metric convention?

- **Confidence:** Low on the specific number
- **Evidence:** Nückles 2025 d ≈ 0.5; Alfieri 2013 g ≈ 0.5; Barbieri 2023 g = 0.48 —
  convergence is partly Hattie-distribution artifact across education
  meta-analyses. Do not treat as a planning quantity for this domain.

### 7. No direct empirical A/B of hero vs peer in any reference-page domain

- **Confidence:** High (of the absence)
- **Evidence:** Confirmed gap across all three seed agents and Wave 2 expansions.
  Recommendation transfers entirely by structural analogy.

## Convergences (highest-confidence claims)

| Claim | Sources | Confidence |
|---|---|---|
| Juxtaposed multi-instance > sequential/single for schema transfer | Gentner 2003, Rittle-Johnson program, Schwartz/Bransford 1998, Barbieri 2023, Alfieri 2013, Jitendra 2018, Gick & Holyoak 1983 | High |
| Comparison benefit inverts with expertise | Nückles 2025, Kalyuga 2007, Chen/Kalyuga/Sweller 2017, Rittle-Johnson 2020 | High |
| Shared-schema labeling + aligned peer instances = strongest configuration | Goldwater & Gentner 2015, Jitendra 2018, Gentner & Hoyos 2017, Aleven 2022 | Medium-High |
| Peer-parallel-with-discriminator dominates authoritative reference surfaces | OpenAPI, ACBL (verified); DSM, ICD-11, MTG, D&D, Javadoc, legal, math, carto (unverified) | Medium |
| Expert chess knowledge is template/pattern-family, not canonical-line-indexed | Chase & Simon 1973, Gobet & Simon 1996, Gobet & Charness 2018, Alessandrini 2025 | Medium-High |

## Tensions (surfaced, not smoothed)

### T1. Exemplar theory vs Prototype theory

- Exemplar (Medin/Schaffer, Nosofsky) predicts hero-bid typicality bias erodes peer
  legitimacy. Prototype (Rosch) says some categories really are prototype-organized
  and hero matches cognition.
- **Resolution (partial):** Murphy & Medin hybrid models — best-fit is prototype
  anchor + small exemplar set. **Design implication:** keep a shared-schema header
  ("prototype-like") above an enumerated peer grid ("exemplar-like"). Argues
  *against* a pure peer grid with no anchor — which aligns with the
  tell-then-contrast finding (Aleven 2022).

### T2. ACBL / Wikipedia / community references are peer-parallel; published bridge *teaching* books reportedly use hero-plus-variants

- Agent G raised this as adversarial evidence; Grant, Root, Kantar, Lawrence were
  named but **never opened** in any wave.
- **Resolution:** Category distinction — disclosure documents (ACBL card) vs
  pedagogical documents (teaching books) serve different purposes. Bridge-app
  reference pages are hybrid. **This tension is load-bearing and unresolved.**
  **Action:** open at least one modern bridge teaching text (Grant or Kantar)
  before finalizing a site-wide default. Cheap. Blocker for "uniform peer grid
  everywhere," not for fixing Bergen/Jacoby.

### T3. Peer co-presentation helps novices (variability effect) vs overloads novices (CLT re-read)

- Both true under different load conditions.
- **Resolution:** Co-presentation helps at 2–4 peers with shared surface context
  and an explicit discriminator; likely hurts at ≥5 peers without scaffolding.
  DONT (4 overcalls) is at the boundary. Bergen (2), Two-way NMF (2), Jacoby (2)
  are safely inside.

### T4. Ecological validity — all empirical anchors are classroom/lab; none study reference-page reading during practice

- Flagged correctly by Agent G (Barnett & Ceci 2002).
- **Resolution:** Directional guidance is defensible; quantitative effect-size
  transfer (d ≈ 0.5) is not. Treat the evidence as pointing a direction, not
  predicting outcomes.

### T5. Reference page for study vs for mid-drill retrieval

- A product question, not empirical. Users likely need both modes (schema construction
  in free study; fast retrieval during `EXPLANATION` phase).

## What This Evidence Cannot Tell You

This is load-bearing. Do not treat recommendations below this line as "settled."

1. **No bridge-pedagogy empirical literature exists.** Three agents confirmed the
   gap. Every claim about bridge-app reference pages is a structural-analogy
   transfer.
2. **No direct A/B of hero vs peer presentation in any reference-page domain** —
   not bridge, not chess, not API docs, not medical reference. The pattern
   across domains is revealed preference, not tested effect.
3. **No HCI studies on side-by-side vs tabbed/sequential peer-reference
   presentation in digital documentation.** Split-attention research covers
   comprehension, not comparison tasks.
4. **Published bridge teaching books were named but never surveyed** (Grant, Root,
   Kantar, Lawrence). Agent G's claim that they use hero-plus-variants is
   adversarial, not documented. Could change the picture materially.
5. **Specific historical episodes cited as cross-domain evidence are mostly
   unverified** (DSM-III reliability shift, D&D 3e SRD, MTG §702 editorial history,
   Javadoc overload critique, cartographic hero-symbol anti-pattern, PER Maxwell
   critique, Go joseki AI analysis). Pattern plausible; episodes brittle.
6. **No treatment of peer-set size thresholds** where co-presentation stops helping.
   Paas variability mostly 2–4 instances. Large response trees are past the
   studied range.
7. **Effect-size estimates (d ≈ 0.5) are not planning numbers** for this domain.
   Metric-convention artifact as much as real floor.
8. **Expertise-reversal costs to returning intermediate users are real and
   quantified** (d = −0.43, Nückles 2025), but the proportion of the user base near
   that inversion point is unknown for this product.

## Recommendations (tagged by evidence strength)

### R1 (High confidence — verified anchors). Structure-match, do not uniform-apply.

- Peer-structured conventions → peer grid + discriminator + shared-schema header.
  Applies to **Bergen, DONT, Two-way NMF, Jacoby transfers, Unusual NT, Michaels**.
- Hierarchical conventions → keep hero-plus-branches. Applies to **Stayman, Puppet
  Stayman, Strong 2♣**.
- Anchored in: ACBL practice (verified, in-domain), OpenAPI discriminator
  (verified), exemplar/prototype hybrid models (verified), structure-mapping
  literature (verified).
- **Concrete schema change:** the current `summaryCard { trigger, definingMeaningId,
  partnership }` assumes one defining meaning. For peer-structured conventions,
  extend to `summaryCard { trigger, familyMeaningId, partnership, peers: [{ bidId,
  discriminatorLabel, definingMeaningId }, ...] }` where `familyMeaningId` names
  the shared schema and `peers[]` enumerates alignable entries. Derive per-peer
  bid/promises/denies from each peer's own `definingMeaningId`, matching the
  existing `feedback_defining_meaning_link` contract.

### R2 (High confidence on direction, Low on cutover criteria per convention). Surface the shared schema explicitly above the peer grid.

- The family name + trigger + partnership role should be a first-class authored
  field, not derived from one hero bid.
- Supported by: Goldwater & Gentner 2015, Jitendra 2018, Aleven 2022, hybrid
  prototype/exemplar evidence. Also resolves T1.

### R3 (Medium-High confidence). Peer grid as default, not collapsed-behind-tab, for v1.

- Rittle-Johnson 2020 dose-response null argues strongly against affordances that
  let users skip comparison.
- **Tension:** trades against expertise reversal (R4) and scannability (Morkes &
  Nielsen 1997). Accept the trade for v1 because novice-to-intermediate is the
  target audience for a reference *page*.

### R4 (High confidence the problem exists; Low confidence on remedy specifics). Plan expertise-adaptive layering as v2.

- Nückles 2025 quantifies the cost to experts (d = −0.43). Not a v1 blocker, but
  do not pretend the problem does not exist.
- Candidate remedies (not empirically tested): a "compact view" toggle, or the
  peer grid collapsing to a compact one-line-per-peer listing once a user has
  passed N drills for that convention.

### R5 (Medium confidence). Cap peer-set size / subgroup large families.

- Likourezos/Kalyuga/Sweller 2019 + element-interactivity: 2–4 peers with one
  discriminator axis is the comfortable range. DONT (4) is at the edge — avoid
  adding further discriminator axes inside that grid.

### R6 (High confidence). Fix documented failures now.

- Bergen 3♣/3♦ contrast erased (current hero shows 3♣ "Exactly 4 hearts 7–10 HCP",
  collapsing the constructive/limit split that is the point of Bergen).
- Jacoby Transfers subtitle says "Bid 2♦/2♥" but hero shows only 2♦ with "5+ hearts"
  and partnership text admits "the summary card shows the heart-transfer branch."
- These are design bugs under **every** lens evaluated — prototype theory, exemplar
  theory, structure-mapping, cross-domain convention, ACBL. Fixing them does not
  require new theory.

### R7 (depends on unverified cross-domain citations — hedge accordingly). Cross-domain reference-format analogies.

- OpenAPI `oneOf` + discriminator and ACBL card are the only **verified** cross-domain
  anchors. Other episodes (DSM-III reliability shift, MTG §702, D&D 5e, Javadoc,
  cartographic legends, math theorem families, legal Restatements) are rhetorically
  powerful but empirically unverified. Use the *pattern* for inspiration; do not
  cite specific historical episodes in design docs without verification.

### R8 (depends on unverified adversarial claim). Do not finalize a uniform peer-grid default until one modern bridge teaching book is surveyed.

- Agent G's objection that Wave 1 never opened Grant / Kantar / Root / Lawrence is
  correct. Cheap to fix. **Blocker** for "make peer grid the site-wide default";
  **not** a blocker for R1/R6.

### R9 (High confidence). Do not plan around effect-size numbers (d ≈ 0.5 is not a target).

- The d/g ≈ 0.5 convergence is partly metric convention across education
  meta-analyses (Systematic Risk §3).

## Next Steps

### Read in full

1. **Nückles et al. 2025** (expertise-reversal meta, k = 60, N = 5924) — quantifies
   the cost to experts; directly informs R4.
2. **Rittle-Johnson, Star & Durkin 2017 & 2020** — the only long-run classroom RCT
   program on comparison-of-strategies; 2020 dose-response null is the strongest
   cautionary finding.
3. **Gentner, Loewenstein & Thompson 2003** — the cleanest demonstration of
   juxtaposition-beats-sequential in a rule-governed domain (negotiation).
4. **Gentner & Hoyos 2017** — current theoretical synthesis; gives language for
   "alignable differences" and "discriminator" framing that maps directly to the
   schema change in R1.
5. **Barbieri et al. 2023** — most recent worked-examples meta; moderator analyses
   on example-pairing.

### Verification to close gaps

1. **Open Grant (*Bridge Basics*), Kantar (*Modern Bridge Conventions*), or Root
   (*Commonsense Bidding*)** and check how they present Bergen, Jacoby transfers,
   DONT, and Two-way NMF. Resolves T2. ~2 hours, blocking for R8.
2. **Verify the DSM-III → DSM-5-TR reliability-improvement narrative.** If true, it
   is the single strongest cross-domain "hero abandoned → peer adopted → measurable
   improvement" story. If overstated, weakens cross-domain case substantively. ~1
   hour, unblocking for general argumentation quality.
3. **Verify Likourezos/Kalyuga/Sweller 2019** (partial cross-verification already; one
   URL confirmed in adversarial wave). Matters because this is the canonical
   variability-effect synthesis.
4. **Verify MTG §702 editorial history and D&D 5e PHB format choice.** Lower
   priority — interesting but not load-bearing if OpenAPI + ACBL hold.

### Follow-up research — within-bridge empirical study

The evaluation correctly notes a within-bridge A/B is **not** a prerequisite for
R1/R6 (fixing structurally broken pages) but **is** a prerequisite for confidently
choosing defaults in ambiguous cases (R3, R4). Minimum viable study design:

- **Design:** Between-subjects, 2 × 2 = {hero-with-branches, peer-grid} ×
  {novice, returning intermediate}, with Jacoby transfers as the test convention
  (has the cleanest peer structure, 2 peers, documented failure).
- **Participants:** ~120 app users, identified by drill-count buckets.
- **Outcome measures:** (a) correct bid selection on a held-out drill set for the
  same convention 48h later (transfer), (b) reference-page dwell time, (c) a
  one-item "do you feel 2♦ and 2♥ are equally important parts of Jacoby?"
  post-test (directly targets the typicality-bias hypothesis).
- **Pre-registered predictions:** peer grid > hero on (a) and (c) for novices;
  peer grid ≤ hero on (a) and (b) for returning intermediates (expertise reversal).
- **Power:** Nückles-range effect sizes (d = 0.5 novices, d = 0.4 experts) with
  n = 30/cell give ~0.7 power — underpowered but informative; bump to n = 50/cell
  for ~0.85.
- **Risk:** ecological validity is *better* than any existing study (real app,
  real users, real convention) but sample is self-selected. Honest hedge.

### Open questions remaining

1. Where is the peer-set-size threshold at which co-presentation stops helping in
   a reference-page (not classroom) context?
2. For conventions where authors disagree whether the structure is peer or
   hierarchical (e.g., is Michaels "two-suited overcall" peer-family or cuebid-
   hero-with-suit-branches?), what's the authoring-time decision procedure?
3. Does the `EXPLANATION` phase (reference page hit during mid-drill) need a
   different layout than free-study reference page, and if so, should the
   content model separate them or share one source?
4. How large is the returning-intermediate user segment near the expertise-reversal
   inversion point for this product? This is the most actionable unknown for R4.

## Pipeline Metadata

- Wave 1 (seed): 27 papers across 3 agents (A, B, C); 5 core convergences
- Wave 2: ~43 additional across backward (27, all `[FROM TRAINING]`), forward (~16),
  cross-domain (~13, mostly `[FROM TRAINING]`), adversarial (~15)
- Verified T1/T2 anchors: Nückles 2025, Barbieri 2023, Wittwer & Renkl 2010,
  Jitendra 2018, Rittle-Johnson program, Gentner 2003, Gentner & Hoyos 2017,
  Gentner 2025, Alessandrini 2025, Paas & Van Merriënboer 1994, Schwartz &
  Bransford 1998, ACBL card, OpenAPI discriminator
- Load-bearing unverified: DSM-III shift narrative, published bridge teaching
  book format, most cross-domain historical episodes
- Output directory:
  `/home/joshua-fu/projects/bridge-convention-app/_output/research/20260414-210905-bridge-multi-bid-conventions/`

## Implementation status

- **Stage 2 (Option A, authored peers) landed** for Bergen and Jacoby transfers
  only. `summaryCard.peers[]` is an optional authored list of
  `{ definingMeaningId, discriminatorLabel }` on the module fixture; per-peer
  bid / promises / denies derive through the same
  `resolve_defining_meaning` + `split_promises_denies` pipeline that builds the
  top-level summary card. When `peers` is absent (hierarchical conventions), the
  reference page renders the existing hero layout with no regression.
- **Not yet migrated (Stage 3 candidates):** DONT (≥4 peers — at the edge of
  the peer-set-size caveat), Two-way NMF (2 peers), Unusual NT (1 vs multi
  depending on framing), Michaels (the open "peer vs cuebid-hero" question in
  §T2 of Open Questions is unresolved; do not migrate until a modern teaching
  text is surveyed per R8).
- **Structural guards:** `summary_card_peers_are_well_formed` enforces
  `peers.len() >= 2`, every `definingMeaningId` resolves on-module, and the
  top-level `definingMeaningId` is one of the peers. Digit / no-system-name
  checks on `discriminatorLabel` inherit from the existing
  `reference_prose_invariants` walker.
