# Seed Papers

## Papers (ranked by relevance)

| # | Paper / Source | Type | Found by | Relevance |
|---|---|---|---|---|
| 1 | Duolingo Research (2022 blog + 2024 whitepaper) — skill-tree → guided-path migration | Industry case study / A-B natural experiment | A, B, C | Field's best-known natural experiment on choice removal: linear path beat branching tree on proficiency but cost motivation for autonomy-valuing users. Anchors the browse-vs-recommend tension. |
| 2 | Chessable — Repertoire + MoveTrainer + Spaced-Repetition product writing | Industry product-design case study | A, B, C | Closest structural analogue to bridge conventions. Converged pattern: library = browse, review-due queue = separate surface, user repertoires = saved drills. Directly maps to Practice-tab redesign. |
| 3 | NN/g — "Cards: UI-Component Definition" + "Card View vs. List View" + "Simplicity Wins over Abundance of Choice" | Design-pattern review / guideline | A, C | Load-bearing prescriptive guidance: cards for heterogeneous summaries, list/grid for homogeneous items. At ~8 homogeneous bundles, argues against pure card grid. |
| 4 | NN/g — Pernice "8 Design Guidelines for Complex Applications" | Practitioner synthesis of usability studies | A, C (partial) | Hub-and-spoke, resumability-after-interruption, task-state preservation. Informs how Practice layers a resume affordance once landing owns primary resume. |
| 5 | LeetCode product/UX teardowns (Lodely, The Code Bytes) | Comparative product teardown | A, C | Concrete treatment of paywall-in-catalog: premium badges inline with rows, not a segregated tab. Company-tag dominant filter, topic-tag secondary. Directly informs practice-tier paywall handling. |
| 6 | Anki vs. Chessable vs. Duolingo entry-point comparisons (Chess Improvement Lab, Speakada) | Practitioner comparative teardown | B, C | Industry split: Anki opens to "due today" (resume-first); Chessable opens to "my courses" grid with due-reviews strip (hybrid); Duolingo opens to the skill tree itself. Practice tab's closest analogue is Chessable's "my courses" surface. |
| 7 | Jameson, A. (2014) — "Choice Architecture for HCI" (monograph) | Theoretical monograph / review | A | Foundational framework for browse/recommend/filter/default design. Argues these are all choice-architecture decisions that must be designed intentionally. |
| 8 | Jameson, A. (2014) — "Recommender Systems as Part of a Choice Architecture for HCI" | Position paper | A | Six choice patterns users adopt (attribute / recognition / consequence / trade-off / experience / social). A picker should support multiple simultaneously. |
| 9 | Kizilcec, R. F. et al. — "Supporting SRL in Online Learning Environments and MOOCs: A Systematic Review" | Systematic review | B | Core finding: **user-initiated support preserves autonomy; proactive prompts breed automation bias.** First-order constraint for the recommendation layer — nudge must be visible but not in the way. |
| 10 | Jivet, I. et al. (2023) — "Learning analytics dashboards are increasingly becoming about learning…" (systematic review) | Systematic review | B | Core finding: **tracking without response guidance does not improve outcomes.** A "mastery" or "review-due" badge is only useful paired with a recommended next action. |
| 11 | Bjork & Bjork (2011) + Kirk-Johnson et al. — desirable difficulties & learners recognize-but-don't-use effective practice | Empirical / review | B | Learners left to free-browse systematically pick blocked, massed, re-exposure practice over interleaved practice. Argues for interleaving / "mixed drill" defaults. |
| 12 | Jesse & Jannach (2021) — "Digital Nudging with Recommender Systems: Survey and Future Directions" | Survey / literature review | A | Catalogs nudge mechanisms (default, social proof, salience, framing) applicable to layering resume + recommendation on a browse screen. |
| 13 | New Classrooms / Rose — "Curriculum Playlists" (EdWeek + practitioner literature) | Applied model / practitioner synthesis | B | Distinguishes **single-path playlist** (system-curated sequence) from **choice-board playlist** (learner-curated menu). "Saved drills" is two features — preset bundles AND user-curated sets. |
| 14 | Goldberg, B. et al. (2023) — "Drill-Practice-Repeat: Experiential Scaffolds for Deliberate Practice" (AIED-GEL) | Applied / theoretical framework | B | Explicitly frames drill hub as a competency-selection and session-planning surface. Direct terminology match to the Practice tab's role. |
| 15 | JMIR Medical Education (2026) — "Digital Choice Architecture in Medical Education" | Conceptual / applied framework | B | Concrete blueprint: defaults, recommended-action highlighting, minimize unnecessary choices that deplete cognitive resources. |
| 16 | Apple HIG — "Collections" + Material Design 3 list/card refs | Design-system reference | C | Canonical specs for sectioned picker layouts; section-header patterns map onto MODULE_CATEGORIES. |
| 17 | Alhadreti & Elbahi (2023) — "UI Design Frameworks of Current Mobile Learning Applications: A Systematic Review" (MDPI) | Systematic review | C | Closest existing SLR. Synthesizes UI criteria and cognitive-load modulation for mobile learning UI — drill-picker density, sectioning, progress-signaling. |
| 18 | Zhang, Yu & Chen (2021) — "Features, Frameworks, and Benefits of Gamified Microlearning: SLR" (ACM ICMET) | Systematic review | C | 15-feature taxonomy for microlearning UI. Useful for deciding which progress/mastery signals belong on the picker without tipping into dashboard territory. |
| 19 | Degree Compass program writeups (Trujillo & Dziuban) — predictive analytics + choice architecture in curriculum recommendation | Empirical / program evaluation | A | Real-world deployment: when catalog has many items and users lack strong preference, predicted-success-ranked shortlist beats full-catalog browse. |
| 20 | UserGuiding — "Duolingo in-depth UX and onboarding breakdown" | UX teardown | C | Detailed skill-tree/unit-path breakdown; contrasts with Chessable's course/variation list model. |

## Vocabulary Discovered

- **Choice architecture** (Jameson, Thaler-Sunstein): intentional design of how options are presented to shape decisions.
- **Choice patterns** (Jameson): six canonical ways users pick — attribute / recognition / consequence / trade-off / experience / social.
- **Digital choice architecture / digital nudge:** LMS-platform application of behavioral-econ defaults, commitment devices, recommended-action highlighting.
- **Guided path vs skill tree** (Duolingo): linear-curriculum vs branching-curriculum home; Duolingo migrated tree → path.
- **Single-path playlist vs choice-board playlist:** system-curated sequence vs learner-curated menu — two distinct "saved set" patterns.
- **Solicited vs proactive scaffolding:** user-initiated help preserves autonomy; proactive prompts breed automation bias.
- **Open learner model / reference frame (LAD lit.):** user-facing mastery visualization + the comparator (self-past, peers, mastery target) that determines motivational effect.
- **Desirable difficulties / subjective fluency / blocked vs interleaved:** Bjork terms for why self-selected practice is systematically suboptimal.
- **Repertoire (Chessable):** user-curated subset stitched from author-authored catalog — chess analogue of saved drills.
- **Review queue / due-reviews strip:** SRS-scheduled items; lives beside browse, not inside it.
- **Card view vs list view / heterogeneous vs homogeneous content** (NN/g): decisive axis for card-vs-list choice.
- **Hub-and-spoke:** navigation pattern for complex apps; relevant framing for Practice post-landing.
- **Collection view** (Apple HIG): canonical term for an ordered, customizable item set.
- **Competency selection surface** (Goldberg): explicit term for "pick what to drill."
- **Entry-point design principle:** the screen after the gateway disproportionately shapes the session; favor focus over breadth.
- **Company tag / topic tag / problem list (LeetCode):** three-axis catalog navigation.

## Existing Reviews Found

- **Alhadreti & Elbahi (2023)** — mobile-learning UI frameworks SLR. Most-on-point.
- **Zhang, Yu & Chen (2021)** — gamified microlearning SLR.
- **Tahir, Arif & Ayub (2025)** — LMS gamification SLR (139 studies).
- **Kizilcec et al.** — SRL scaffolding SLR (definitive on recommendation-vs-autonomy).
- **Jivet et al. (2023)** — Learning Analytics Dashboards SLR (definitive on progress signaling).
- **Jesse & Jannach (2021)** — Digital nudging with recommender systems, survey.
- **Jameson (2014)** — Choice architecture for HCI, monograph (foundational).

Note: no single review answers the practice-hub / drill-picker UX question end-to-end. Closest syntheses are listed above; the rest must be assembled across design-system references and product teardowns.

## Saturation Check

- Agent A unique papers: 9
- Agent B unique papers: 9
- Agent C unique papers: 12
- Overlap (found by 2+): 6 (Duolingo path, Chessable SRS, NN/g cards-vs-list, NN/g simplicity/complex-apps, LeetCode teardowns, Anki-vs-Chessable-vs-Duolingo comparisons)
- **Total unique: ~20**

Above the 5-paper thin-evidence gate — proceed to full Wave 2 expansion.

## Landscape Assessment

**Major debates:**
- **Autonomy vs guidance.** Duolingo path data favors guidance; Kizilcec SRL review warns guidance without autonomy breeds dependence. Intermediate-player persona likely wants a hybrid.
- **Recommendation vs free browse.** Bjork: learners self-select poorly (blocked/massed). Kizilcec: proactive prompts = automation bias. Resolution likely: visible-but-dismissable "recommended next" slot + full catalog.
- **Progress signaling: informative vs prescriptive.** Jivet: tracking without response guidance fails. Per-item badge must be paired with an action.
- **Card grid vs sectioned list at small catalog sizes (5–15).** NN/g argues list for homogeneous items; industry practice (Chessable "my courses") uses section-headed cards.
- **Paywall placement.** LeetCode: inline badges, not a tab — preserves browse flow.

**Apparent gaps:**
- No peer-reviewed HCI study on drill-picker screens for deliberate-practice apps specifically.
- No peer-reviewed work on bridge/card-game practice UX.
- No empirical comparisons of flat grid vs sectioned grid at 5–15-item catalog sizes.
- No empirical work on how "resume" affordances should *downgrade* once a dedicated landing owns them.
- No empirical guidance on the "drill preset" concept specifically (config-at-pick-time vs per-session).
