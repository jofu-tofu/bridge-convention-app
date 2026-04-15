# Evidence Evaluation

## Triage Summary
- Total distinct sources across all waves: ~70 (27 seed + 27 backward + 16 forward + 13 cross-domain + 15 adversarial, with overlap)
- T1 (systematic reviews / meta-analyses): 9
- T2 (large-scale empirical, long-running programs, industry deployment): 8
- T3 (standard peer-reviewed empirical): ~20
- T4 (preliminary, grey literature, practitioner references, in-domain authorities): ~20
- T5 (theoretical/foundational frameworks, handbooks): ~13
- Unverified (`[FROM TRAINING — verify]`): ~30 (heavily concentrated in expansion-backward.md — effectively all 27 items — and in expansion-crossdomain.md — most of the 13 items; plus a handful in forward and adversarial)
- Overall evidence quality: **Moderate** for the general learning-science claim; **Weak** for the direct target (bridge reference-page design) — the core recommendation transfers by structural analogy.

## Paper Triage

### Tier 1 — Systematic reviews / meta-analyses
- Nückles et al. 2025 (expertise-reversal meta, d≈±0.5, k=60, N=5924) — **verified** (forward, with URL)
- Barbieri et al. 2023 (worked examples, g=0.48, k=55) — **verified**
- Wittwer & Renkl 2010 (instructional explanations, meta) — **verified**
- Jitendra et al. 2018 (schema-based instruction, g=1.57 immediate / 1.09 transfer) — **verified**
- Alfieri, Nokes-Malach & Schunn 2013 (case-comparison meta, g≈0.5) — referenced, verified via seed cluster
- Gentner & Hoyos 2017 (analogy/abstraction review) — **verified**
- Gentner 2025 (OECS handbook) — **verified**
- Alessandrini, Gobet et al. 2025 (chess expertise neural, systematic review) — **verified**
- Sweller, van Merriënboer & Paas 2019 (CLT retrospective) — **`[FROM TRAINING — verify]`**
- Likourezos, Kalyuga & Sweller 2019 (variability effect synthesis) — **`[FROM TRAINING — verify]`** (Agent E) but verified in adversarial (Agent G) with different URL — partial cross-verification
- CLT replication-crisis review (Sweller et al. 2023) — **verified** (adversarial)

### Tier 2 — Large-scale / long-running empirical programs, revealed-preference deployments
- Rittle-Johnson, Star & Durkin 2017 / 2020 (20-year classroom comparison program, including year-long Algebra I RCT with partial null) — **verified**
- Schwartz & Bransford 1998 ("A Time for Telling") — foundational; verified in Agent A; marked unverified in Agent B for one URL (minor)
- Gentner, Loewenstein & Thompson 2003 — **verified**
- Paas & Van Merriënboer 1994 — **verified**
- ACBL convention card, Wikipedia bridge convention pages, DONT/Bergen/Two-way NMF community references — **verified** in-domain documentary
- DSM-III → DSM-5-TR format-shift history (Spitzer & Fleiss 1974 reliability data) — **`[FROM TRAINING — verify]`** but independently well-known; historically load-bearing cross-domain evidence
- MTG Comprehensive Rules §702, D&D 5e PHB, Javadoc/IDE overload documentation — revealed-preference industrial references — **`[FROM TRAINING — verify]` for editorial history claims**

### Tier 3 — Standard peer-reviewed empirical
- Loewenstein, Thompson & Gentner 1999 — verified
- Goldwater & Gentner 2015 — verified
- Kurtz, Miao & Gentner 2001 — verified
- Schalk et al. 2020 (contrasting cases + instruction) — verified
- Aleven, Connolly et al. 2022 — verified
- Raynal, Sander & Goldwater 2025 (ADAPTER model) — verified
- Chen, Kalyuga & Sweller 2017 (element interactivity) — verified
- Kalyuga 2007 (expertise reversal review) — verified
- Ayres & Sweller split-attention handbook chapter — verified
- Morkes & Nielsen 1997 scannability — verified
- Murphy & Medin hybrid prototype/exemplar reviews — verified
- Jamrozik & Gentner 2022 — referenced via 2025 handbook, citation partial

### Tier 4 — Practitioner / grey literature / in-domain authority
- Stripe API docs, OpenAPI spec, Bump.sh, Speakeasy — verified
- Larry Cohen, bridgebum, bridgewinners, kwbridge, bridgehands — verified
- Wikipedia convention pages — verified
- Grammar paradigm tables, Berklee music theory, cookbook references — partially verified, some `[FROM TRAINING]`
- Restatements, DSM, ICD-11, UpToDate, Go joseki, cartographic legends, Sambrook cloning — all `[FROM TRAINING — verify]` (Agent F)
- Published bridge teaching books (Audrey Grant, Bill Root, Kantar, Mike Lawrence) — named but never opened; Agent G cites them as counter-evidence, adversarially

### Tier 5 — Theoretical / foundational
- Gentner 1983; Markman & Gentner 1993; Gentner & Markman 1997
- Rosch 1978; Rosch & Mervis 1975; Medin & Schaffer 1978; Nosofsky 1986
- Sweller 1988; Sweller/VM/Paas 1998
- Gick & Holyoak 1980, 1983
- Chase & Simon 1973; Gobet & Simon 1996; de Groot 1946/1965; Ericsson & Kintsch 1995
- Bransford & Schwartz 1999 (PFL)
- Chi et al. 1989, 1994 (self-explanation)

Most foundational theoretical sources in the Tier 5 list and the entire backward-expansion set are `[FROM TRAINING — verify]` per the explicit note at the top of expansion-backward.md.

## Key Findings

| Finding | Confidence | Supporting | Contradicting |
|---|---|---|---|
| Side-by-side comparison of 2+ instances yields larger schema-transfer gains than sequential / single-instance study in *instructional* contexts | High | Gentner/Loewenstein/Thompson 2003; Rittle-Johnson/Star/Durkin program 2007–2020; Alfieri 2013 meta (g≈0.5); Barbieri 2023 (g=0.48); Schwartz & Bransford 1998; Gick & Holyoak 1983 | Rittle-Johnson 2020 year-long RCT partial null when implementation dose was low |
| Expertise reversal: juxtaposition benefit inverts for high-prior-knowledge learners | High | Nückles 2025 meta (d=+0.505 novice / d=−0.428 expert, N=5924); Kalyuga 2007; Chen/Kalyuga/Sweller 2017; Likourezos/Kalyuga/Sweller 2019 | — |
| Variability-effect / comparison benefit is boundary-conditional on element interactivity and learner state | Medium-High | Likourezos/Kalyuga/Sweller 2019; Chen/Kalyuga/Sweller 2017; Sweller et al. 2023 replication review; Paas & Van Merriënboer 1994 (re-read) | — |
| Cross-domain authoritative *reference* surfaces overwhelmingly use peer-parallel-with-discriminator for peer-structured content | Medium (most citations unverified) | OpenAPI discriminator (verified); ACBL card (verified); DSM/ICD, MTG §702, D&D 5e PHB, Javadoc, legal Restatements, cartographic legends, math theorem families (all `[FROM TRAINING — verify]`) | Published bridge *teaching* texts (Grant, Root, Kantar, Lawrence) reportedly use hero-plus-variants prose — Agent G claim, not directly verified |
| Published bridge teaching texts favor hero-plus-variants | Low-Medium (asserted, not documented) | Agent G adversarial claim | Agent A finding that Wikipedia/community references are mixed, and ACBL is peer-parallel |
| Single-hero presentation induces typicality bias: peers felt as peripheral members | Medium (theoretical + indirect empirical) | Medin & Schaffer 1978; Nosofsky 1986; Rosch & Mervis 1975 | Prototype theory (Rosch 1978): some categories are genuinely prototype-organized; hero matches cognition |
| Implementation fidelity / affordance defaults drive effect size | High | Rittle-Johnson 2020 RCT dose-response; Chase/Malkiewich ICC single-viewport requirement | — |
| Direct empirical test of hero vs peer in any reference-page domain exists | — | — | No such study located in any field (learning science, HCI, chess, API docs, bridge) |

## Convergences (with confidence levels)

- **Juxtaposed multi-instance presentation beats sequential/single-instance study for schema abstraction in instructional contexts.** Supported by Gentner/Loewenstein/Thompson 2003, Rittle-Johnson program, Schwartz & Bransford 1998, Barbieri 2023, Alfieri 2013, Jitendra 2018, Gick & Holyoak 1983. **Confidence: High.**
- **The comparison benefit is expertise-gated.** Nückles 2025 (d=+0.505 novice, d=−0.428 expert), Kalyuga 2007, Chen/Kalyuga/Sweller 2017, Rittle-Johnson 2020. **Confidence: High.**
- **Labeling the shared schema + aligning peer instances is the strongest abstraction configuration.** Goldwater & Gentner 2015, Jamrozik & Gentner 2022, Jitendra 2018 (g=1.57 immediate on schema-surfaced instruction), Gentner & Hoyos 2017. **Confidence: Medium-High.**
- **Peer-parallel-with-discriminator is the dominant authoritative format for peer-structured reference content across multiple adjacent domains.** OpenAPI + ACBL are verified; DSM, ICD-11, MTG, D&D, Javadoc, legal Restatements, cartographic legends, math theorem families are all `[FROM TRAINING — verify]` in Agent F. **Confidence: Medium** (pattern is striking but most citations not web-verified).
- **Effect-size floor of g/d≈0.5 for comparison/juxtaposition benefits in target novice-to-intermediate band.** Nückles 2025 d≈0.5, Alfieri 2013 g≈0.5, Barbieri 2023 g=0.48. **Confidence: Medium.** (See Systematic Risks on whether this is a real floor or metric convention.)
- **Chess/game-expertise literature treats expert knowledge as pattern-family / template-indexed rather than canonical-line-indexed.** Chase & Simon 1973, Gobet & Simon 1996, Gobet & Charness 2018, Alessandrini 2025. **Confidence: Medium-High** (but analogy to bridge conventions contested by Agent G via Smith/Osherson prototype-in-experts — itself unverified).

## Tensions (with resolution paths)

1. **Exemplar theory (seeds) vs Prototype theory (adversarial).** Medin/Schaffer/Nosofsky predict hero-bid typicality bias; Rosch/Mervis predict prototype-anchored cognition favors a hero. **Resolution:** Murphy & Medin hybrid models (verified) say best-fitting empirical model is *prototype + small exemplar set* — which actually argues for **hero-as-anchor + peer exemplars** layout. This is not a decisive resolution but suggests both sides have a piece: the shared-schema header (prototype-like) plus enumerated peers (exemplar-like). Load-bearing for UI: argues against a *pure* peer grid with no anchor.

2. **Peer-parallel is dominant in authoritative bridge references (Wave 1) vs Published bridge *teaching* books use hero-plus-variants (Agent G).** **Resolution:** Category distinction is correct — *disclosure* documents (ACBL card, convention summaries) differ in purpose from *pedagogical* documents. Bridge-app reference pages sit in a hybrid role. This is **load-bearing** and not resolved by the evidence base; Agent G is right that Wave 1 never opened Grant/Root/Kantar. Requires direct check of at least one modern bridge teaching text before shipping a design.

3. **Co-present peer examples help novices (variability effect) vs co-present peer examples overload novices (re-read of Paas & VM 1994 + Likourezos 2019).** **Resolution:** Both are true under different load conditions. The honest synthesis: peer co-presentation helps at 2–4 peers with shared surface context and an explicit discriminator; it plausibly hurts at ≥5 peers without scaffolding. DONT (4 overcalls) is at the boundary; Bergen (2 bids) is safely inside it.

4. **Pro-juxtaposition CLT evidence (seeds) vs CLT-replication-crisis review (Agent G, Sweller et al. 2023).** **Resolution:** The directional claim survives; the specific effect-size estimates are fragile. For design purposes, directional guidance is sufficient; the numeric floor (d≈0.5) should be treated as a rough anchor, not a planning number.

5. **Reference page is for study (analogical encoding) vs reference page is for mid-drill retrieval (adversarial).** **Resolution:** This is a product question, not an empirical one. If users hit reference pages during practice (which the project's architecture encourages — `EXPLANATION` phase), retrieval-speed matters. If users hit them during free study, schema-construction matters. The design likely needs both modes.

## Gaps

- **Zero empirical studies on bridge-convention reference-page presentation.** Confirmed by three agents. The recommendation transfers entirely by structural analogy.
- **Zero empirical HCI studies on side-by-side vs sequential/tabbed peer-reference presentation in any digital documentation context** (confirmed Agent E, item #16). This is a genuine gap — split-attention HCI addresses comprehension but not comparison tasks.
- **No direct treatment of peer-set size thresholds** where co-presentation stops helping. Paas variability work is mostly 2–4 instances; DONT (4), Multi 2♦ responses, and large response trees are beyond the well-studied range.
- **Published bridge teaching books not surveyed.** Grant, Root, Kantar, Lawrence named but not opened in any wave.
- **No A/B evidence within bridge.** No seed or expansion paper renders a within-bridge test unnecessary.

## Systematic Risks

### 1. Unverified citations — load-bearing concentration

**Entirely or near-entirely `[FROM TRAINING — verify]`:**
- `expansion-backward.md` — all 27 items explicitly flagged. Agent D self-disclosed at the top that WebFetch was not available at call time.
- `expansion-crossdomain.md` — the DSM-III reliability shift (item 2), MTG §702 history (5), D&D 3e-shift-enabled-SRD claim (6), Go joseki AI-analysis (7), PER critique of Maxwell-by-hero (8), cartographic "hero symbol" anti-pattern (9), Modernist Cuisine / Samin Nosrat critiques (10), Nature Protocols editorial history (11), Javadoc String.format critique (12), Python PEP 498 framing (13) — all flagged, author explicitly requested confirmation.

**Which claims are independently corroborated by verified sources:**
- **Expertise reversal** (originally flagged in Agent C's seed #9 Sweller 2019) is now *independently corroborated* by Nückles 2025 meta-analysis (verified, Agent E), Kalyuga 2007 (verified, Agent G), Chen/Kalyuga/Sweller 2017 (verified, Agent G). Load-bearing and safe.
- **Case-comparison effect** (Alfieri 2013 and Gick & Holyoak 1983, both flagged in backward) is corroborated by Gentner/Loewenstein/Thompson 2003 (verified seed), Rittle-Johnson 2020 (verified forward), Barbieri 2023 (verified T1). Safe.
- **Schema-based instruction effect** (Jitendra 2018) verified directly.
- **Variability effect** (Paas & VM 1994) verified directly; Likourezos 2019 has mixed verification across agents — the *boundary-condition* framing is corroborated by Chen/Kalyuga/Sweller 2017 (verified).
- **Self-explanation effect** (Chi 1989, 1994 in backward — flagged) — indirectly corroborated by Wittwer & Renkl 2010 meta (verified). Safe but citation-level details unverified.
- **Chess template theory** (Chase & Simon, Gobet & Simon, de Groot — all flagged) — corroborated at the review level by Gobet & Charness 2018 handbook (verified) and Alessandrini 2025 systematic review (verified).

**Load-bearing claims NOT independently corroborated (must be treated as weak):**
- The entire DSM-III reliability-shift narrative (Agent F #2). This is historically the single strongest real-world "hero-format abandoned, peer-format adopted, measurable improvement" story in any domain — and it is unverified. If true, highest-weight cross-domain evidence; if overstated, Wave 1's cross-domain case weakens substantially.
- All in-domain bridge-pedagogy historical claims (Culbertson, Goren, Kantar, Root) from Agent D #26–27 and invoked by Agent G as counter-evidence. *Neither side actually opened these books.*
- Go joseki AI-analysis win-rate claims (Agent F #7).
- Legal "totality-of-circumstances collapse" critique (Agent F #1).
- PER critique of Maxwell-by-hero teaching (Agent F #8).
- Cartographic hero-symbol anti-pattern (Agent F #9).
- Published bridge teaching books' presentation format (Agent G #15).

**Practical implication:** The convergence across cross-domain reference surfaces (API, DSM, MTG, D&D, Javadoc, legal, math, cartography) is rhetorically powerful but empirically brittle — most individual citations are unverified. The *pattern* is plausible; the *specific historical episodes* cited (DSM-III shift, D&D 3e shift) should not be load-bearing in a design-decision memo without verification.

### 2. Methodological monoculture / ecological validity

**Flagged correctly by Agent G (Barnett & Ceci 2002).** Every Tier 1/2 empirical anchor for comparison/juxtaposition is:
- Classroom-based (or lab analog)
- Study-then-test design with explicit transfer problems
- Math/geometry (Paas; Rittle-Johnson; Barbieri), negotiation (Loewenstein), biology/density (Schwartz-Bransford), design education (Aleven)

**None** studied self-paced reference-page reading during active practice with no transfer test. The ecological distance from experimental setting to bridge-app reference-page consumption is substantial. Honest hedge: directional guidance is defensible; quantitative effect-size transfer (d≈0.5) is not.

### 3. Effect-size convergence at ≈0.5 — real floor or metric convention?

The convergence (Nückles 2025 d≈0.5; Alfieri 2013 g≈0.5; Barbieri 2023 g=0.48) looks striking but is **partially a metric/domain convention**:
- All three are education meta-analyses of *instructional comparison treatments*
- g and d are nearly identical for large samples with comparable variance; the apparent "same number" is partly mathematical
- Education-intervention meta-analyses routinely cluster around g=0.3–0.5 (Hattie visible-learning distribution); a result at 0.5 is the field's typical "moderately good intervention" range, not a domain-specific finding
- Different outcome measures (transfer problem, procedural flexibility, immediate vs delayed retention) across the three — the fact that they round to similar numbers after heterogeneous aggregation is weak evidence of a single mechanism

**Verdict:** Real effect in the "instructional comparison helps" direction; **not** a precise g≈0.5 floor one can plan around. Treat as: "when the conditions match the studied conditions, expect moderately positive outcomes." Do not treat as "our peer-bid page will yield g=0.5 on learner outcomes."

### 4. Publication bias

Not flagged as a specific concern beyond field norms. Meta-analyses listed (Barbieri 2023, Nückles 2025, Jitendra 2018) all report funnel-plot / bias checks in their abstracts; none was re-analyzed here.

### 5. Is the structural analogy strong enough to act on without a within-bridge A/B?

**Weighing:**
- **For acting now:** (a) convergence across 6+ adjacent domains is unusually broad, (b) the cognitive mechanism (structure-mapping, alignable differences) is well-characterized, (c) the project's current *uniform* hero schema is demonstrably broken for specific cases (Bergen 3♣/3♦ contrast erased; Jacoby 2♦/2♥ peer status denied in partnership text), (d) the authoring cost of adding peer-grid capability is bounded, (e) ACBL — the only authoritative *bridge* reference — is peer-parallel.
- **Against acting without A/B:** (a) Agent G's ecological-validity and published-teaching-book objections are not refuted by the evidence base, (b) the expertise-reversal finding predicts a flat peer grid will actively harm returning intermediate users who make up a significant portion of the target audience, (c) no direct bridge evidence exists, (d) Rittle-Johnson 2020 dose-response null shows implementation details dominate effect.

**Verdict:** The analogy is strong enough to act on **for the narrow case of structurally-peer-bid conventions** (Bergen 3♣/3♦, Two-way NMF 2♣/2♦, DONT double/2♣/2♦/2♥, Jacoby 2♦/2♥) — where the current schema demonstrably miscommunicates. It is **not** strong enough to mandate a uniform peer-grid default for all conventions; Stayman / Puppet Stayman / Strong 2♣ remain cases where hero-plus-branches matches structure.

The correct next step is **not** a within-bridge A/B first — it is to ship structure-matched presentation (peer-for-peer, hero-for-hero) and plan a later A/B on the layered/expertise-adaptive question (when does the novice-optimized peer grid harm returning users?). The existing documented failures (Bergen, Jacoby) are design bugs under any reasonable interpretation of the evidence; fixing them does not require an A/B.

## Practical Implications for the Project (hedged)

1. **Structure-match, don't uniform-apply.** Peer-structured conventions (Bergen, DONT, Two-way NMF, Jacoby, Unusual NT) warrant a peer-grid reference format with an explicit discriminator; hierarchical conventions (Stayman, Puppet Stayman, Strong 2♣) keep hero-plus-branches. This follows cross-domain pattern (cookbook world: Escoffier *and* Flavor Bible) and ACBL in-domain practice. **Confidence: High** on direction; **Low** on exact cutover criteria per convention.

2. **Surface the shared schema explicitly** (the family name, the trigger, the partnership role) above the peer grid. Supported by Goldwater & Gentner 2015, Jitendra 2018, Aleven 2022 (tell-then-contrast > contrast-then-tell). **Confidence: Medium-High.**

3. **Peer grid as default, not collapsed-behind-tab.** Rittle-Johnson 2020 dose-response null argues strongly against affordances that let users skip comparison. **Confidence: Medium-High**, but trades against adversarial scannability concern (Morkes/Nielsen) and expertise-reversal for returning users.

4. **Expertise-adaptive layering is warranted but not urgent.** Nückles 2025 quantifies the cost to experts (d=−0.43). A v1 peer grid is defensible; a v2 that collapses for returning/expert users is a follow-up, not a blocker.

5. **Cap peer-set size or subgroup larger families.** Likourezos/Kalyuga/Sweller 2019 + element-interactivity framing. DONT (4 peers) is at the edge; avoid adding further discriminator axes within a single grid. **Confidence: Medium.**

6. **Do not ship a uniform rewrite driven by effect-size numbers.** The g/d≈0.5 convergence is not a planning quantity for this domain.

7. **Open at least one modern bridge teaching book (Grant, Kantar, or Root) before finalizing.** Agent G's objection that Wave 1 never surveyed in-domain *pedagogy* (as opposed to in-domain *disclosure*) is correct and unresolved. Cheap to fix; load-bearing.

8. **Known failure cases (Bergen 3♣/3♦ contrast erased; Jacoby "2♦/2♥" subtitle mismatched to "2♦" hero) are design bugs under every lens evaluated** — prototype theory, exemplar theory, structure-mapping, cross-domain convention, in-domain ACBL — and can be fixed independent of any broader theory choice.

## Final Assessment

- Directional recommendation (peer-parallel for peer-structured conventions) is **well-supported** by convergent learning-science + cross-domain + in-domain-ACBL evidence.
- Uniform-application recommendation (peer-grid for all multi-bid conventions regardless of structure) is **not supported**; adversarial evidence (expertise reversal, prototype theory, split-attention, published teaching-book tradition) is load-bearing against it.
- Quantitative effect estimates (d≈0.5) are **not transferable** to the bridge reference-page context.
- Within-bridge A/B is **not a prerequisite** for fixing documented failures but **is a prerequisite** for confidently choosing defaults (grid-always vs expertise-layered) in ambiguous cases.
- The extensive `[FROM TRAINING — verify]` set in backward/crossdomain expansions **does not invalidate the core recommendation** because the load-bearing pieces (Nückles 2025, Rittle-Johnson program, Gentner 2003, Barbieri 2023, ACBL, OpenAPI) are verified; but it does invalidate the use of specific historical episodes (DSM-III shift, D&D 3e shift, published bridge teaching tradition) as decisive argument without further verification.
