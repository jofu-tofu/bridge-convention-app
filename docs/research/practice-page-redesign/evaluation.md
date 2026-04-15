# Evidence Evaluation

## Triage Summary
- Total papers/sources: ~84 across all waves (20 seed + 15 backward + 16 forward + 20 cross-domain + 18 adversarial, minus overlap).
- T1 (systematic reviews, meta-analyses): ~14
- T2 (large-scale empirical, industry deployment): ~12
- T3 (standard peer-reviewed empirical): ~18
- T4 (preliminary, grey literature, preprints, practitioner): ~28
- T5 (theoretical, foundational frameworks, opinion): ~12
- Unverified (FROM TRAINING): 1 (Verbert/Duval LAD cluster in keyword scan)
- Overall evidence quality: **Moderate — with important soft spots on load-bearing claims.** The choice-architecture, desirable-difficulties, and SRL literatures are well-anchored in T1/T2 sources, but the specific drill-picker / practice-hub UX question has no end-to-end peer-reviewed synthesis. The industry anchors most often cited (Duolingo path, Chessable) are single-vendor, non-replicated, and partly confounded with time-on-task.

## Paper Triage

### Tier 1 — Systematic reviews / meta-analyses
- Scheibehenne, Greifeneder & Todd (2010) — choice-overload meta-analysis (null mean effect; moderator-driven)
- Kizilcec et al. — SRL scaffolds SLR (IJHCI)
- Jivet et al. (2023) — Learning Analytics Dashboards SLR
- Alhadreti & Elbahi (2023) — mobile-learning UI SLR
- Zhang, Yu & Chen (2021) — gamified microlearning SLR
- Tahir, Arif & Ayub (2025) — LMS gamification SLR (139 studies)
- Jesse & Jannach (2021) — digital nudging with recommender systems, survey
- Brunmair & Richter (2019) — interleaving meta-analysis (*Psychological Bulletin*)
- Kalyuga line — expertise reversal effect (2007 review, 2025 *L&I* meta-analysis)
- Dunlosky et al. (2013) — effective-learning-techniques taxonomy (*PSPI*)
- Scheiter & Gerjets (2007) — learner control in hypermedia review
- Kuyer & Gordijn (2023) — nudging ethics SLR
- Hooshyar et al. (2024/25) — AI-LAD SLR
- Recommender-agency SLR (IJETHE 2020)
- dos Santos Silva & Marinho (2025) — PRISMA SRL review in music
- "LADs Lived Up to the Hype?" (arXiv 2023/24 meta-analysis)
- Macnamara et al. — deliberate-practice replication

### Tier 2 — Large-scale empirical / industry deployment
- Duolingo (2022 blog, 2024 whitepaper) — path vs tree A/B
- Deng et al. (2024) — MISQ field experiment on related-interleaving
- Degree Compass (Trujillo & Dziuban) — curriculum-recommender deployment
- Spotify Engineering (2020) — home personalization shelves
- Netflix choice-engine (Behavioral Scientist)
- Peloton IQ — recommendation-on-top-of-catalog
- Hanus & Fox (2015) — 16-week classroom gamification RCT
- Khan Academy — mastery system writeups
- Chessable — repertoire + MoveTrainer product literature
- LeetCode teardowns (Lodely, Code Bytes)
- Fitbod — saved-workouts product model
- Duolingo engineering "one experiment at a time"

### Tier 3 — Standard peer-reviewed empirical
- Iyengar & Lepper (2000) — jam study
- Johnson & Goldstein (2003) — defaults / organ donation
- Ericsson, Krampe & Tesch-Römer (1993) — deliberate practice
- Kornell & Bjork (2008) — spacing/induction
- Shao/Wang/Freeman (2024); Li/Bonk/Zhou (2024); Guo et al. (2025) — post-path Duolingo empirical wave
- Biwer et al. (2024) — interleaving metacognitive illusion
- Hwang et al. (2025) — block-first wins for pre-schematic learners
- Adaptive-interleaving null (L&ID 2025)
- Santhosh et al. (2024) — mobile SRS RCT
- Passarotto et al. (2022) — music DP instrument
- "Training Pilots for Unexpected Events" (PMC 2018)
- Wang, Liu et al. (2020) — mobile microlearning effects
- Kaliisa, Jivet & Prinsloo (2023) — LAD checklist
- Vieira et al. (JLA 2024) — SRL-phase dashboard
- Rystedt et al. (2024) — simulation competency framework
- Haavik et al. (2025) — adaptive flight-sim scenario selection

### Tier 4 — Preliminary, grey literature, preprints, practitioner
- NN/g articles (cards, card-vs-list, simplicity-vs-choice, complex apps, progressive disclosure)
- Apple HIG Collections, Material 3 references
- Chess Improvement Lab / Speakada / Duolingo Guides comparative reviews
- UserGuiding Duolingo breakdown
- Listudy, Chessdriller, Better Practice writeups
- Irrational Labs — progress-bars-backfire
- "Anki Abandonment Spiral" community literature (Eva Keiffenheim, ControlAltBackspace, Mintdeck)
- Game UI Database, Xia Last of Us loadout case study
- Oxford Medical Simulation platform
- Headspace library writeups
- FAA FITS SBT guide; ICAS 2024 framework paper
- Playlist-engagement analytics (WowTechHub)
- LLM-OLM explanations (arXiv 2025)
- UI CL questionnaire (RG 2024)
- Sustainable Mobile Microlearning (MDPI 2025)
- JMIR Digital Choice Architecture (2026) — conceptual framework
- EdWeek curriculum playlists

### Tier 5 — Theoretical / foundational
- Jameson (2014) — choice architecture for HCI, monograph
- Jameson (2014) — recommender-as-choice-architecture position paper
- Thaler & Sunstein (2008) *Nudge*
- Schwartz (2004) *Paradox of Choice*
- Bjork (1994) — desirable difficulties origin
- Zimmerman cyclical-phases SRL model
- Winne & Hadwin COPES model
- Ryan & Deci (2000) — SDT
- Sweller et al. (1988/1998) — cognitive load theory
- Nielsen (1995/2006) — progressive disclosure
- Schmidt & Engelen (2020) — nudging ethics
- "Autonomy, Paternalism, AI Nudges" (*Phil & Tech* 2025)
- van Merriënboer & Sluijsmans — advanced-learner ID
- Goldberg et al. (2023) — drill-practice experiential scaffolds
- Smart Learning Environments (2024) — competency-graph adaptive LS

## Key Findings

| Finding | Confidence | Supporting | Contradicting |
|---|---|---|---|
| Progress signals must be paired with a recommended action to affect outcomes | **H** | Jivet 2023 SLR; Kaliisa 2023; "LADs Hype" meta; Hooshyar 2024; Haavik 2025 | — |
| Choice overload is real but conditional — not a blanket "shrink the menu" law | **H** | Scheibehenne 2010 meta; Iyengar 2000 (boundary); Jameson 2014 | — |
| Defaults / recommended-next slots steer behavior without restricting options | **H** | Johnson & Goldstein 2003; Thaler-Sunstein 2008; Jesse & Jannach 2021; Netflix writeup; Fitbod | Schmidt-Engelen 2020; Kuyer-Gordijn 2023 (ethics, not efficacy) |
| Interleaving helps, but is moderated by similarity and expertise; NOT a universal default | **M→H (softer than seeds)** | Brunmair 2019 meta (g=0.42 overall but null/negative for expository + word-learning); Hwang 2025; Biwer 2024; Deng 2024 MISQ (related-interleaving best); Adaptive-interleave null 2025 | Bjork 1994, 2011 (original); Kornell & Bjork 2008; PMC 2018 aviation |
| Recommender / guided path improves outcomes over free browse | **L→M (softer than seeds)** | Duolingo 2022/2024 (single vendor, confounded by time-on-task); Scheiter-Gerjets 2007 (for low-knowledge, low-metacog) | Kalyuga expertise-reversal (2007 review, 2025 meta); Guo 2025 (ChatGPT > Duolingo on autonomy); Peloton IQ (browse-preserved works); no independent replication of Duolingo result |
| Progress badges / mastery markers improve motivation | **L (inverted by adversarial)** | Zhang 2021 SLR (feature-taxonomy, not outcome); Khan Academy writeups | **Hanus & Fox 2015 — 16-wk RCT, badges DECREASED intrinsic motivation and exam performance via mediation**; Deci-Ryan overjustification (Arizona ITLT); Irrational Labs progress-bar backfire |
| SRS / review-queue-as-landing is sound architecture | **M→L (domain-dependent)** | Chessable, Anki product literature; Santhosh 2024 RCT (dental ed); seed inference | "Anki Abandonment Spiral" (Keiffenheim, ControlAltBackspace, Mintdeck) — queue-first fails under intermittent use and non-novice maintenance load |
| Competency-as-primary-facet (category-led sectioning) beats flat grid | **H** | Oxford Medical Sim; Rystedt 2024; Haavik 2025; LeetCode topic tags; Khan skills; Goldberg 2023; Apple HIG Collections | — |
| Resume + override is a universal UX pattern across domains | **H** | Netflix, Spotify, Khan Mastery Challenges, Fitbod saved workouts, Chessable due-reviews, Anki | — |
| Pre-launch configuration is its own UX surface, distinct from the picker | **M→H** | Aviation ICAS 2024 variant-parameters; Xia loadout case study; Fitbod replay-mode triad; Game UI DB patterns | — |
| Inline paywall badges preserve browse flow better than segregated premium tabs | **M** | LeetCode teardowns; Headspace library; convergent industry practice | — (no direct counter) |
| User-curated "saved drills" will be built but infrequently re-opened by most users | **M** | Music playlist analytics ~50–60% engagement; Duolingo feature long-tail; Li 2024 (users build external scaffolds because in-app saved-state absent) | dos Santos Silva 2025 (advanced musicians DO organize around chosen repertoire — but "advanced" is the key qualifier) |
| Autonomy-supportive design preserves intrinsic motivation; proactive scaffolding breeds automation bias | **H** | Ryan & Deci 2000; Kizilcec SRL SLR; Xi & Hamari / 2023 ETR&D meta; recommender-agency SLR 2020 | — |
| "Why this is recommended" + dismiss affordance is the dominant agency-preserving pattern for recommenders | **H** | Recommender-agency SLR 2020; Kaliisa 2023 checklist; LLM-OLM 2025 | — |

## Convergences

- **Progress signals without paired actions fail.** Jivet 2023, Kaliisa 2023, LAD meta (2023/4), Hooshyar 2024, Haavik 2025 converge. Confidence: **High**.
- **Competency / topic is the primary browse facet across every analogous domain.** Medical simulation, aviation EBT, LeetCode, Khan, Chessable, Goldberg drill-practice, Apple HIG all sectioned-by-competency. Confidence: **High**.
- **"Resume + override" is universal.** Netflix, Spotify, Khan, Fitbod, Chessable, Anki. Confidence: **High**.
- **Pre-launch configuration belongs in its own step.** Aviation scenario variants, Fitbod replay triad, Last-of-Us loadout case study, Game UI DB. Confidence: **Moderate-High**.
- **Inline paywall preserves browse flow.** LeetCode, Headspace, convergent practice. Confidence: **Moderate**.
- **Autonomy preservation outranks optimization-by-nudge for self-directed adult learners.** SDT (Ryan-Deci), Kizilcec, recommender-agency SLR, Schmidt-Engelen, Kuyer-Gordijn, Guo 2025. Confidence: **High**.
- **Choice overload is conditional, not general.** Scheibehenne meta + Jameson + Jesse-Jannach. Confidence: **High**.

## Tensions

- **Guided path vs free browse for bridge intermediates.** *Side A (guidance wins):* Duolingo 2022/2024, Scheiter-Gerjets 2007 for low-knowledge learners, Degree Compass, Fitbod default-recommendation model. *Side B (guidance harms or no-effect):* Kalyuga expertise-reversal line (including 2025 *L&I* meta), Guo 2025 (ChatGPT > Duolingo on autonomy), Peloton IQ (keep-catalog works), no independent replication of Duolingo result, Duolingo's own path-is-slower admission. **Possible explanation:** guidance helps genuine novices with weak metacognition; bridge intermediates are neither — they are the expertise-reversal population, so the seed-suggested "lean toward guided path" is the wrong default for this persona.

- **Interleaving/Mixed-Drill as default.** *Side A:* Bjork 1994/2011, Kornell & Bjork 2008, Deng 2024 MISQ, PMC 2018 aviation, Dunlosky 2013 (moderate utility). *Side B:* **Brunmair & Richter 2019 meta** (null for expository, negative for word-learning, moderated by similarity structure), Hwang 2025 (block-first for pre-schematic learners), Biwer 2024 (~80% learner resistance persists even with feedback — frames acceptance, not efficacy), Adaptive-interleave null 2025. **Possible explanation:** interleaving helps when categories are similar at between-category level but distinct within; bridge conventions (Stayman vs Transfers vs Bergen) have ambiguous similarity structure and learners bidding a new convention are in the pre-schematic regime Hwang identifies. Default-interleaved has weaker warrant than seeds implied.

- **Mastery badges help vs harm.** *Side A (help):* Zhang 2021 SLR cataloging, Khan Academy, general gamification literature. *Side B (harm):* **Hanus & Fox 2015 — clean 16-week RCT, mediation-identified**, Deci-Ryan overjustification corpus, Irrational Labs progress-bar-backfire. **Possible explanation:** badges help extrinsically-motivated populations in structured academic courses; they harm intrinsically-motivated self-directed adult learners (the bridge persona). Adding per-module mastery indicators is a meaningful risk, not a free win.

- **SRS review-queue as entry point.** *Side A:* Chessable, Anki-core, Santhosh 2024 (dental), seed's inferred pattern. *Side B:* Anki-abandonment community literature; queue-as-debt dynamic under intermittent use. **Possible explanation:** SRS-first works for daily-use populations with short sessions; bridge club players practice weekly/intermittently, where queue-as-debt dynamics dominate. Resume-in-picker ≠ review-queue-as-picker.

- **"Saved drills" as first-class surface.** *Side A:* dos Santos Silva 2025 advanced musicians, Li 2024 (users build external scaffolds when in-app absent), Chessable repertoire, Fitbod saved workouts. *Side B:* Playlist-engagement ~50–60%, Duolingo long-tail observations. **Possible explanation:** curated-set usage is heavily bimodal — power users build and return; casual users build once and abandon. Designing the feature so the main surface doesn't depend on the user ever building a saved set is the safer architecture.

## Gaps

- **No peer-reviewed HCI study on drill-picker screens in deliberate-practice apps specifically.** The closest evidence remains adjacent: mobile-learning UI SLR (Alhadreti), SRL-dashboard SLRs, grey-literature teardowns.
- **No peer-reviewed work on bridge or card-game practice UX.** Chess trainer work is grey literature only.
- **No empirical comparisons of flat grid vs sectioned grid at 5–15-item catalog sizes.** Prescriptive guidance comes entirely from NN/g + HIG design patterns, not controlled studies.
- **No empirical work on how "resume" affordances should downgrade once a dedicated landing owns them.**
- **No direct empirical work on the "drill preset" / config-at-pick-time vs per-session distinction.** Aviation ICAS 2024 and Fitbod give the strongest analogues.
- **No independent replication of the Duolingo path-vs-tree finding** in any adjacent platform, and the Duolingo whitepaper itself admits time-on-task confound.
- **Mastery-badge harm studies are sparse for adult self-directed learners specifically** — Hanus-Fox is in a classroom context; generalization to voluntary practice is informed but not proven.

## Systematic Risks

1. **Publication bias — moderate.** Duolingo path-vs-tree is reported only by Duolingo, on Duolingo's internal proficiency proxy, with no pre-registration and no outside replication. Treating this as strong evidence (as seeds implicitly do) overweights a single vendor's marketing-adjacent result. Similarly, Chessable/Anki/Fitbod writeups are product literature without hypothesis-testing rigor.
2. **Replication concerns — specific and sharp.** Ericsson deliberate-practice effect size shrank substantially under Macnamara et al. reanalysis — a direct cautionary parallel for treating any single industry A/B as settled. The Duolingo result should be downweighted accordingly.
3. **Methodological monoculture — partial.** Dashboard/LAD literature is almost entirely observational / design-review rather than outcome-controlled; progress-signal prescriptions inherit that limitation. The Hanus-Fox longitudinal RCT is unusually clean and thus disproportionately informative.
4. **Unverified papers — low (1).** Only the Verbert/Duval LAD cluster in the keyword scan was flagged FROM TRAINING; it was subsequently superseded by the Jivet 2023 SLR which is directly sourced.
5. **Domain-transfer risk — high and under-acknowledged.** Music playlists, Netflix shelves, aviation scenario libraries, and medical simulation catalogs differ from a bridge-convention picker in catalog size, session cadence, and user-expertise distribution. Convergent patterns across them are informative but not decisive.

## Synthesis Implications (for design recommendation)

The adversarial wave substantially revises the Wave 1 consensus. The synthesized design should reflect three corrections:

1. **Do not default to a Duolingo-style guided path.** The path result is single-vendor, non-replicated, partly confounded by time-on-task, and — via the expertise-reversal meta-analysis — likely net-negative for the bridge-intermediate population, who are not the novice/low-metacognition group for whom guidance is clearly warranted. Preserve browse as the primary surface. A "Recommended next" slot, if included, should be solicited, explainable, and dismissable — not a forced default.

2. **Do not add per-module mastery badges by default.** Hanus-Fox (clean 16-week RCT with mediation), the overjustification literature, and the progress-bar-backfire finding together make "add mastery indicators" a material motivation risk for intrinsically-motivated adult self-directed learners — the target persona. If any progress signal is surfaced, it must be (a) paired with a recommended next action (Jivet / Kaliisa), (b) optional or private, and (c) never a long-empty "0 of 10" style bar. A defensible minimum is: no visible mastery signal on the picker by default; expose coverage/weakness only in a secondary surface the user opens deliberately.

3. **Do not default to Mixed Drill / interleaved practice.** Brunmair's meta-analysis shows interleaving is moderated, sometimes null, and sometimes negative. Hwang 2025 shows block-first wins for pre-schematic learners — exactly the state of a user taking up a new bundle. Deng 2024 MISQ's "related-interleaving within a topic cluster" is a better-supported specific default than "Mixed Drill across bundles." Offer Mixed as a first-class option with explicit utility framing (Biwer 2024), but let single-module blocked practice be equally prominent, not buried.

Unchanged by adversarial review, still load-bearing:

- **Competency-as-primary-facet sectioning** (converges across medical-sim, aviation, LeetCode, Khan, Chessable, HIG — strongest convergence in the whole corpus).
- **Resume + override pattern.** Universal; safe to adopt.
- **Inline paywall, not segregated premium tab.** Convergent industry practice, no counter-evidence.
- **Pre-launch config as its own step** rather than per-card toggles. Supported by aviation variant-parameter decomposition, loadout case studies, and Fitbod replay-mode triad.
- **Choice overload is conditional — don't prematurely shrink an 8-bundle catalog.** Scheibehenne meta is definitive; 8 homogeneous bundles with category structure is well below any reasonable overload threshold for users with category priors.
- **Autonomy-preserving "why this is recommended" + dismiss** if a recommendation layer is included at all.

The design that falls out of this corrected evidence base is less Duolingo-path and more **Peloton-IQ-over-catalog / Chessable-library / LeetCode-topic-list** than the seed-stage synthesis suggested: a sectioned-by-category browse surface is the primary Practice screen, resume is a small strip (not a landing), recommendation is solicited, progress tracking is off-by-default or hidden on the picker, and saved drills exist as a secondary shelf whose absence doesn't break the main flow.
