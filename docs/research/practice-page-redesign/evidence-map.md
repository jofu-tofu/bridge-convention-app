# Evidence Map: Practice Tab (Convention-Select Screen) Redesign

## Executive Summary

The Practice tab's primary job is letting an intermediate bridge player browse and pick a convention to drill; the logged-in landing page already owns resume and marketing. The corrected evidence base (after adversarial review) strongly supports a **sectioned-by-category browse surface as the primary view**, with a small resume strip, a solicited (not forced) recommendation, inline paywall badges, pre-launch configuration as its own step, and saved drills as a secondary shelf. Several seed-stage defaults — Duolingo-style guided path, per-module mastery badges, Mixed Drill as default — **do not survive adversarial scrutiny** and should be deliberately avoided. Evidence quality is **moderate**: choice-architecture, SRL, desirable-difficulties, and expertise-reversal literatures are well-anchored, but there is no peer-reviewed HCI study on drill-picker screens in deliberate-practice apps, and the most widely-cited industry anchor (Duolingo path) is single-vendor, non-replicated, and time-on-task-confounded.

## Evidence Quality

- Papers reviewed: ~84 across 5 waves (seed, backward, forward, cross-domain, adversarial)
- Systematic reviews / meta-analyses: ~14
- Large-scale empirical / industry deployment: ~12
- Unverified (from-training): 1 (superseded by Jivet 2023 SLR)
- Overall quality: **Moderate** — strong on the general principles (choice architecture, autonomy, competency-sectioning, resume-pattern), weak on the specific artifact (drill-picker UX in a deliberate-practice context at 5–15-item catalog sizes). No independent replication of the Duolingo tree→path result.

## Key Findings

### 1. Competency / category is the primary browse facet
- **Confidence:** High
- **Evidence:** Oxford Medical Simulation, Rystedt 2024, Haavik 2025 (aviation), LeetCode topic tags, Khan skills, Chessable courses, Goldberg 2023 drill-practice scaffolds, Apple HIG Collections, Material 3
- **Caveats:** Every cited domain is adjacent, not bridge-native; all evidence is convergent design practice, not controlled A/B. Still — the convergence is the strongest in the corpus.

### 2. Resume + override is a universal pattern, but resume belongs to the landing now
- **Confidence:** High (for the pattern), High (for scoping to landing)
- **Evidence:** Netflix, Spotify, Khan Mastery Challenges, Fitbod saved workouts, Chessable due-reviews, Anki. NN/g Pernice "Complex Applications" on resumability-after-interruption.
- **Caveats:** No empirical work on how resume affordances should **downgrade** once a dedicated landing owns them. The design move ("small resume strip on Practice, not a landing") is defensible from pattern convergence but unverified.

### 3. Progress signals without a paired recommended action fail
- **Confidence:** High
- **Evidence:** Jivet 2023 SLR, Kaliisa 2023 checklist, "LADs Lived Up to the Hype?" meta, Hooshyar 2024, Haavik 2025
- **Caveats:** LAD literature is largely observational/design-review, not outcome-controlled. But the convergence on "tracking alone does nothing" is strong.

### 4. Per-module mastery badges risk harming intrinsically-motivated adult learners
- **Confidence:** Medium-High (the **direction** is high-confidence; magnitude at the specific bridge persona is inferred)
- **Evidence:** Hanus & Fox 2015 — clean 16-week RCT with mediation; badges **decreased** intrinsic motivation and exam performance. Deci-Ryan overjustification corpus. Irrational Labs progress-bar-backfire. Ryan & Deci SDT. Kizilcec SRL SLR on proactive scaffolding → automation bias.
- **Caveats:** Hanus-Fox is a classroom context; generalization to voluntary self-directed practice is informed but not proven. Zhang 2021 SLR catalogs badges positively but is feature-taxonomy, not outcome.

### 5. Choice overload is conditional; 8 homogeneous bundles is well below any threshold
- **Confidence:** High
- **Evidence:** Scheibehenne, Greifeneder & Todd 2010 meta (null mean effect, moderator-driven). Jameson 2014. Jesse & Jannach 2021.
- **Caveats:** Iyengar & Lepper's jam-study remains the lay intuition; do not over-react to it. With category priors (NT / Competitive / Slam / Takeout), 8 bundles is comfortably browsable.

### 6. Inline paywall badges preserve browse flow better than segregated premium tabs
- **Confidence:** Medium
- **Evidence:** LeetCode teardowns (Lodely, The Code Bytes), Headspace library, convergent industry practice
- **Caveats:** No direct counter-evidence but also no controlled study. Convergence, not causation.

### 7. Pre-launch configuration is its own UX step, distinct from the picker
- **Confidence:** Medium-High
- **Evidence:** Aviation ICAS 2024 variant-parameters framework; Xia Last-of-Us loadout case study; Fitbod replay-mode triad; Game UI Database patterns
- **Caveats:** No controlled study on "config at pick-time vs per-session" in learning apps specifically. The aviation and game analogues are the strongest parallels.

### 8. User-curated saved sets are heavily bimodal in usage
- **Confidence:** Medium
- **Evidence:** dos Santos Silva & Marinho 2025 (advanced musicians organize around curated repertoire); Li 2024 (users build external scaffolds when in-app absent); Chessable repertoire; Fitbod saved workouts. Counter: music playlist analytics ~50–60% engagement; Duolingo feature long-tail.
- **Caveats:** Power users build and return; casual users build once and abandon. The main surface must not depend on the user ever building a saved set.

### 9. Guided-path default is weakly warranted for bridge intermediates
- **Confidence:** Medium (softened from seed stage)
- **Evidence for:** Duolingo 2022/2024 whitepaper; Scheiter-Gerjets 2007 for low-knowledge learners; Degree Compass
- **Evidence against:** Kalyuga expertise-reversal line (2007 review, 2025 *L&I* meta); Guo 2025 (ChatGPT > Duolingo on autonomy); Peloton IQ (keep-catalog works); no independent replication; Duolingo's own admission of time-on-task confound
- **Caveats:** Bridge intermediates sit squarely in the expertise-reversal zone where guidance tends to harm. Default to browse; make recommendation solicited.

### 10. Interleaving/Mixed-Drill is not a free default
- **Confidence:** Medium
- **Evidence for:** Bjork 1994/2011; Kornell & Bjork 2008; Deng 2024 MISQ; Dunlosky 2013 (moderate utility); PMC 2018 aviation
- **Evidence against:** Brunmair & Richter 2019 meta (null for expository, negative for word-learning, similarity-moderated); Hwang 2025 (block-first wins for pre-schematic learners); Biwer 2024 (learner resistance persists); adaptive-interleave null 2025
- **Caveats:** A user picking up a new convention is pre-schematic — the Hwang regime where blocked practice wins. Mixed Drill should be a prominent, explained option, not a default.

## Convergences

- **Competency-as-primary-facet sectioning** (medical-sim, aviation, LeetCode, Khan, Chessable, HIG). Highest confidence claim in the corpus.
- **Resume + override pattern** is universal across practice/content apps.
- **Autonomy preservation outranks optimization-by-nudge** for self-directed adult learners (SDT, Kizilcec, recommender-agency SLR 2020, Guo 2025, Schmidt-Engelen, Kuyer-Gordijn).
- **Progress signals must be paired with a recommended action** to affect outcomes.
- **Choice overload is conditional**, not general — small category-structured catalogs are fine.
- **"Why this is recommended" + dismiss affordance** is the dominant agency-preserving recommender pattern.
- **Inline paywall beats segregated premium tab** across comparable products.

## Tensions

- **Guided path vs free browse.** Duolingo + Degree Compass vs Kalyuga expertise-reversal + Guo 2025. Resolution for bridge intermediates: **browse primary, recommendation solicited and explainable**.
- **Interleaving as default.** Bjork/Kornell vs Brunmair meta + Hwang 2025 + Biwer 2024. Resolution: **single-module blocked practice is the safe default; Mixed Drill is a first-class option, not a forced default**.
- **Mastery badges help vs harm.** Zhang SLR + Khan writeups vs Hanus-Fox RCT + overjustification corpus + progress-bar-backfire. Resolution: **no visible mastery badges on the picker by default**; expose coverage only in a secondary surface the user opens deliberately.
- **SRS/review-queue as entry point.** Chessable + Santhosh 2024 vs Anki-abandonment community literature. Resolution: **review queue is not the Practice-tab landing**; an optional "due reviews" strip is the most it should carry, and only once SRS exists in-app. Bridge club players are weekly/intermittent, where queue-as-debt dominates.
- **Saved drills as first-class surface.** Advanced-musician + Chessable repertoire + Li 2024 vs playlist long-tail + Duolingo feature data. Resolution: **saved drills are a secondary shelf — visible, not dominant, and the main flow works without them**.

## Design Recommendations for the Practice Tab

These map directly to the six design pressures in `question.md`, plus the three user-floated ideas. Each recommendation is tagged with confidence and the pressure it answers.

**Shipped status (2026-04):** §1 and §2 shipped in Practice-tab redesign Phase 1 (`dcc0e79…`). §3, §4, §5 (partial: preset schema is forward-compatible with Workshop) shipped in Phase 2 — see `docs/product/practice-tab.md`. §6 and §7 were already honored by prior work. Phase 3 (solicited "Recommended next", preset sync, import/export, reorder UI) remains deferred.

### 1. Browse-first, not resume-first. `[pressure #1 | confidence: High]`

- Primary surface is the convention catalog. The landing owns resume.
- **A small "Continue drilling" strip at the top** (one row, dismissable, shows the last-played bundle + one optional "next up" suggestion) is acceptable — pattern-convergent across Netflix/Chessable/Fitbod. Keep it to a strip, not a section.
- Do not import landing affordances (marketing hero, "Your Systems" panel, quick-actions grid) into Practice.

### 2. Sectioned by category, not flat grid. `[pressure #2 | confidence: High]`

- Use `MODULE_CATEGORIES` from `module-catalog.ts` as section headers. 8 bundles is borderline for a flat grid — category priors (NT family / Competitive / Slam / Takeout) are almost free cognitive scaffolding, and the cross-domain convergence on sectioning is the strongest signal in the corpus.
- Within each section, use **cards with short descriptors** (NN/g cards-vs-list: cards for heterogeneous summaries; bundles are heterogeneous enough in coverage and difficulty to warrant cards). A list-row layout is defensible if section density gets crowded; do not mix the two.
- Make section headers collapsible but **default expanded**. Progressive disclosure is a tie-breaker, not a primary control, at this catalog size.

### 3. Saved drills: secondary shelf on the Practice tab, not a separate tab. `[pressure #3, user idea (a) | confidence: Medium]`

- Place saved drills as **a top-of-page shelf above the category sections**, OR as a collapsible side panel on wide viewports. Either is defensible; prefer the top shelf for mobile parity.
- Do **not** promote saved drills to a dedicated top-level tab until telemetry shows >~40% of active users actually build and re-open sets. Playlist-engagement evidence and Duolingo long-tail predict the feature will be bimodal: power users return, casual users abandon.
- The category-sectioned browse must function fully without any saved drills — that's the load-bearing architectural constraint. Saved drills are additive, never the main path.
- Rationale: Chessable's "my courses" hybrid model (browse + due-reviews strip) is the closest analogue and the one your persona (intermediate club player) most resembles.

### 4. Config-at-pick-time as a drill-preset concept, with sensible defaults on plain picks. `[pressure #4, user idea (b) | confidence: Medium-High]`

- Two-step launch, explicitly decomposed (aviation ICAS 2024, Xia loadout, Fitbod triad):
  - **Step 1 — Pick a convention** (the catalog). Clicking a card with no further input launches with sensible defaults (`decision-drill`, `responder`, current system).
  - **Step 2 — Optional "Configure & save as drill"** affordance on each card (secondary action). Opens a small panel for mode, role, system override, and name-and-save.
- **A "drill"** is defined as `(convention bundle) + (mode) + (role) + (system)` — a named preset. This matches New Classrooms' **choice-board playlist** taxonomy (learner-curated) distinct from **single-path playlist** (system-curated).
- **Defaults matter more than the panel.** Most users will one-click. The panel exists so power users can customize and save.
- Do not use per-card toggle controls (role switcher on every card, mode pills in every row); the evidence against scattering configuration across the catalog is strong (Xia loadout case study; NN/g simplicity-vs-abundance).

### 5. Drills extend to Workshop later — design the shape, not the plumbing. `[user idea (c) | confidence: Medium]`

- The "drill = (bundle) + (mode) + (role) + (system)" tuple naturally extends to the Workshop custom-system builder: **a workshop-authored custom system is just a `system` value** in the same tuple. When Workshop ships, saved drills built on custom systems require no schema change — only a richer `system` resolver.
- Design the save form so the `system` field is already present (even if it only holds SAYC / 2/1 today). Do not add Workshop-specific fields to the drill save surface now; defer until Workshop is past its dev feature flag.
- Reminder from the codebase: `SessionConfig` already carries a full `SystemConfig` + `baseModuleIds` — saved drills should persist the resolved `SystemSelectionId` (TS-only), not a serialized `SystemConfig`, to keep the localStorage payload stable.

### 6. Progress signaling: off-by-default on the picker. `[pressure #5 | confidence: Medium-High]`

- **No visible mastery bars, percentages, or badges on convention cards by default.** Hanus-Fox + overjustification + progress-bar-backfire + Kizilcec's automation-bias warning converge on the risk.
- If any signal is surfaced, it must satisfy Jivet 2023's paired-action rule: the signal carries a recommended next action (e.g., "You missed 3 Stayman responder bids last session — drill responder?") and is **solicited** via a "Show my weak spots" toggle or a secondary coverage view, not pushed by default.
- Explicitly avoid: long-empty "0 of 10" bars, zero-state gamification, streak counters on the picker. Streaks and badges belong in a dedicated stats/coverage surface the user opts into, not on the browse screen.
- Evidence-consistent minimum: a thin "Last practiced: 3 days ago" metadata line under the convention title is acceptable — it is descriptive, not evaluative, and does not trigger the overjustification pathway.

### 7. Paywall: inline badges, not a separate tab. `[pressure #6 | confidence: Medium]`

- Premium bundles live in the same sectioned catalog as free ones, with a **lock/premium badge on the card** and a preview affordance (first deal or first drill free, or a short Learn excerpt). Pattern is LeetCode / Headspace convergent.
- Do not segregate "Free" and "Premium" into separate tabs or separate routes. Segregation kills browse flow and signals the app is a store rather than a practice environment.
- Tapping a locked card should open a lightweight paywall card **in place** (modal or sheet) with a short preview CTA and a "What's included" summary — not a hard redirect to a pricing page. This respects the autonomy-preservation line (recommender-agency SLR 2020).
- This is the conversion surface mentioned in `docs/product/product-direction.md`; treat it as such without turning the picker into a store.

### 8. Recommendation: solicited, explainable, dismissable — or not at all. `[cross-cutting | confidence: High]`

- If a "Recommended next" slot is included, it must (a) appear near the resume strip, not replace the catalog, (b) carry a one-line "why" (e.g., "Because you struggled with Bergen 1D raises last session"), (c) be dismissable, and (d) never replace the browse path.
- The expertise-reversal evidence argues against making recommendation the default surface for intermediates. A solicited "Suggest something for me" button is safer than a forced shelf.
- Do not implement the Duolingo guided-path model. The evidence does not support it for this persona.

### 9. Interleaving / Mixed Drill: first-class option, not the default. `[cross-cutting | confidence: Medium]`

- Mixed Drill (interleaved across bundles within a family) should be available as a mode, with a short explanation of when it helps. Biwer 2024's learner-resistance finding means users need framing, not just the option.
- The default on a one-click pick is **blocked single-module practice** — this is the Hwang 2025 regime a new-convention learner is actually in.
- Related-interleaving within a bundle (Deng 2024 MISQ) is the better-supported specific default if you want any interleaving at all; cross-bundle Mixed Drill is a power-user option.

## What This Evidence Cannot Tell You

Mandatory and substantive. Do not treat these as solved.

1. **Whether users re-open saved drills at rates that justify promoting them.** Playlist-engagement data from music (50–60%) and Duolingo long-tail observations suggest bimodal use — but there is no data on saved drills in deliberate-practice apps at the bridge persona's session cadence (weekly, ~20–40 min). **Instrument the feature and decide with telemetry.**
2. **Whether an 8-bundle catalog benefits more from flat grid or section-headed cards at these specific dimensions.** NN/g guidance is prescriptive; no controlled study covers 5–15-item catalogs. The sectioning recommendation is convergent-design safe but unverified.
3. **How resume affordances should downgrade when a dedicated landing owns primary resume.** No empirical work found. The "small strip, not a section" rule is inferred from the cross-domain resume pattern, not measured.
4. **Whether a "Recommended next" slot on the Practice tab improves outcomes or just feels nice.** The single best industry anchor (Duolingo) does not cleanly generalize to intermediates, and no independent replication exists. Make it solicited and dismissable so the cost of being wrong is low.
5. **Whether bridge intermediates' intrinsic motivation behaves like the adult learners in Hanus-Fox or the self-motivated professionals in Chessable.** Evidence suggests closer to the former — but this is inference, not measurement.
6. **How the drill-preset concept will interact with the future Workshop custom-system builder once it exits dev.** The "(bundle) + (mode) + (role) + (system)" tuple design is forward-compatible on paper; real compatibility depends on Workshop's serialization decisions, which are not finalized.
7. **Whether inline paywall preview (first deal free, say) converts at acceptable rates in this specific vertical.** LeetCode/Headspace analogues are convergent practice; bridge has no comparable data.
8. **Whether Mixed Drill framed as "interleaved practice helps retention even though it feels harder" (Biwer 2024 framing) actually lifts Mixed Drill adoption in this app.** Biwer shows resistance persists; the design mitigation is untested here.

For 1, 3, 4, and 8 specifically: **these are cheap to A/B once shipped.** The evidence map argues for defaults that are safe to ship and measurable after.

## Next Steps

### Read in full (top 5)

- **Hanus & Fox (2015) — 16-week classroom gamification RCT.** The single cleanest study on mastery-badge harm. If you implement any progress signal on the picker, read this first.
- **Brunmair & Richter (2019) — interleaving meta-analysis, *Psychological Bulletin*.** Reshapes the Mixed-Drill default question. Required before making interleaving the default anywhere in the product.
- **Jivet et al. (2023) — Learning Analytics Dashboards SLR.** Defines the paired-action rule for any progress signal you eventually do show.
- **Kizilcec et al. — SRL scaffolds SLR (IJHCI).** Governs the recommendation-vs-autonomy line for the "Recommended next" slot.
- **Kalyuga — expertise-reversal review (2007) and 2025 *L&I* meta-analysis.** Explains why the Duolingo path result does not generalize to bridge intermediates.

### Bonus if you ship a drill-preset system

- **Goldberg et al. (2023) — Drill-Practice-Repeat scaffolds** for the preset taxonomy and the competency-selection framing.
- **New Classrooms / Rose — Curriculum Playlists** for the single-path vs choice-board playlist distinction, which maps directly onto system-curated drills vs user-saved drills.

### Open questions to revisit after launch

- Saved-drill re-open rate by persona segment.
- Whether the "Recommended next" slot, when solicited, improves session completion vs pure browse.
- Whether inline paywall preview (one-deal preview) converts better than a locked card with a hard-redirect paywall.
- Whether Mixed Drill adoption lifts when framed with Biwer-style "this feels harder but helps" copy.

## Pipeline Metadata

- Waves: Seed (20) + Backward (15) + Forward (16) + Cross-domain (20) + Adversarial (18) = ~84 sources after dedupe
- Tiers: T1 ~14 · T2 ~12 · T3 ~18 · T4 ~28 · T5 ~12 · Unverified 1 (superseded)
- Output directory: `docs/research/practice-page-redesign/`
- Related research: `docs/research/ftue-and-seo/`, `docs/research/learn-mode-pedagogy/`
