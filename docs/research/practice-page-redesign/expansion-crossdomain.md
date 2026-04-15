# Deep Expansion — Agent F (Cross-Domain Reframing)

Strategy: translate "pick a practice target from a catalog, with progress and custom sets" into the vocabulary of adjacent fields the seed set under-covered, then hunt for primary and practitioner sources where the analogy is structural (not surface). Each adjacent field below was restated in that field's own terms before searching; items that only matched metaphorically were dropped.

## Adjacent Fields Reframed

1. **Music-practice apps** — "repertoire picker + practice session + fluency tracking." Closest structural match to a convention picker because practice targets are heterogeneous, long-lived, and user-revisited.
2. **Fitness workout-picker UX** — "exercise selection with saved routines vs. adaptive recommendation." Structural match for drill-preset vs. per-session config.
3. **Medical simulation / scenario-based training** — "competency selection surface for simulator scenarios." Direct match for "pick a competency to drill."
4. **Flashcard/SRS library browse** — already partially in seeds (Chessable/Anki); expanded to Quizlet/RemNote for the "library as first-class surface" pattern.
5. **Netflix/Spotify "continue + shelves"** — pure choice-architecture reference for hybrid resume+browse layouts. Structural: heterogeneous catalog, multiple entry intents, personalization layered over browse.
6. **Video-game loadout / level-select screens** — "configure a drill preset and launch." Structural match for the "config at pick-time" pressure.
7. **Aviation evidence-based training (EBT)** — "individualized scenario selection from a competency library." Strong structural match; arguably closer to bridge-conventions than K-12 adaptive learning.
8. **Meditation apps (Headspace/Calm)** — "library + continue + recommended session" with a single-tap launch surface. Structural match for gated catalog + browse.
9. **K-12 adaptive/mastery platforms (Khan Academy)** — mastery-gated skill picker with recommended next skill. Structural match for progress-signaled browse.

## Papers Found

### 1. Passarotto, Preckel, Schneider & Müllensiefen (2022) — "Deliberate practice in music: Development and psychometric validation of a standardized measurement instrument"
- **Found Via:** Music-practice reframe — "how do musicians decide what to practice next?"
- **Key Finding:** Operationalizes deliberate practice in music as a measurable construct: goal-setting, concentration, effortful repetition, feedback-seeking. Implication for picker design: the UI should make the *goal* (which competency, why) visible at pick-time, not buried in the session.
- **Source:** https://journals.sagepub.com/doi/full/10.1177/03057356211065172

### 2. dos Santos Silva & Marinho (2025) — "Self-regulated learning processes of advanced musicians: A PRISMA review"
- **Found Via:** Music-practice reframe — SRL analogue to Kizilcec's MOOC SRL SLR, but for a domain where learners pick from an *owned* repertoire.
- **Key Finding:** Advanced musicians design practice routines *around current repertoire* (pieces they've chosen), and planning/monitoring behavior predicts success. Supports "saved drills" as a first-class surface, not a sidebar — the user's chosen set is the organizing principle of practice, not an afterthought to browse.
- **Source:** https://journals.sagepub.com/doi/10.1177/10298649241275614

### 3. Better Practice (practitioner product) + research integration writeups
- **Found Via:** Music-practice reframe — closest product analogue to convention-picker with SRS layering.
- **Key Finding:** Integrates SRL prompts (goal-setting, reflection) and spaced repetition *into* the picker itself, not as a separate tab. The repertoire list IS the practice surface — due items float to the top of the same list. Pattern worth copying: a single list with due-state re-ranking beats a separate "review" tab for small catalogs.
- **Source:** https://betterpracticeapp.com/faq

### 4. Fitbod — "Saved Workouts" product writing
- **Found Via:** Fitness reframe — saved-workout vs. recommended-workout coexistence.
- **Key Finding:** Three-mode load from a saved item — (a) exact replay, (b) replay with progressive weight only, (c) regenerate sets/reps but keep exercise selection. Direct analogue for "drill preset" design: a saved drill should launch with *graded* fidelity to the original (same deal vs. same convention+role vs. same mode only). This is a richer model than the seed set's "preset = snapshot of filters."
- **Source:** https://fitbod.me/blog/saved-workouts/

### 5. Peloton IQ (product design writing, 2024–2026)
- **Found Via:** Fitness reframe — how does a fitness catalog balance curated "plan" vs. free browse after personalization matures?
- **Key Finding:** Peloton IQ layers a recommended-plan surface on top of the raw class catalog; the catalog persists. Browse is never removed, only *re-weighted*. Confirms seed finding (Duolingo path removed tree → lost autonomy) inversely: when you keep browse and add recommendation as an additional surface, retention-oriented apps don't see autonomy loss. Argues *against* collapsing the bridge Practice catalog into a single guided path.
- **Source:** https://www.onepeloton.com/peloton-iq

### 6. Oxford Medical Simulation — platform scenario-library design
- **Found Via:** Medical-simulation reframe — "competency selection surface for high-stakes scenario training."
- **Key Finding:** Scenario libraries are indexed by *competency tags* (e.g., sepsis recognition, airway) with curriculum-alignment metadata as the primary browse axis; difficulty and duration as secondary. Mirrors the LeetCode "company tag / topic tag" pattern from seeds but in a medical context — convergence across high-stakes and casual learning domains on **competency-as-primary-facet**. Supports MODULE_CATEGORIES-led sectioning over flat grid.
- **Source:** https://oxfordmedicalsimulation.com/platform/

### 7. Rystedt et al. / BMC Med Education (2024) — "Developing a competency framework for training with simulations in healthcare"
- **Found Via:** Medical-simulation reframe — academic framing of scenario selection.
- **Key Finding:** Scenario selection is itself a *designed* step, not a navigation problem: learners/instructors must align scenario → learning objective → assessment. A picker that only shows *what* is available (not *why pick this one*) fails the competency-framework test. Informs copy on each bundle card: one line of "what you'll practice and why it matters" is load-bearing, not decorative.
- **Source:** https://bmcmededuc.biomedcentral.com/articles/10.1186/s12909-024-05139-1

### 8. Haavik et al. / CEAS Aeronautical Journal (2025) — "CPS prototype for AI-based scenario adaptation in flight simulator training"
- **Found Via:** Aviation-EBT reframe — adaptive scenario selection in a competency-based regime.
- **Key Finding:** In EBT, scenario selection is *individualized per trainee* from a fixed library, driven by recent performance on named competencies. A human instructor still mediates. Cross-domain validation of Jivet's finding: tracking alone is insufficient — the system (or a mediator) must translate tracking into a specific next-scenario suggestion. For bridge: per-bundle mastery badges without a "try this next" CTA would under-deliver.
- **Source:** https://link.springer.com/article/10.1007/s13272-025-00870-x

### 9. ICAS 2024 paper — "Designing a framework for flight simulator training scenarios (Evidence-Based approach)"
- **Found Via:** Aviation-EBT reframe — framework for structuring a scenario library.
- **Key Finding:** Scenario metadata schema distinguishes (a) competencies-addressed, (b) difficulty/fidelity, (c) variant-parameters (what the instructor can vary within a scenario at launch time). This is a cleaner decomposition than the seeds offered for "config at pick-time": the picker shows the scenario (convention); launch-time config lets the instructor/user dial parameters (mode, role, seed). Maps one-to-one onto the bridge Practice screen's open pressure 4.
- **Source:** https://www.icas.org/icas_archive/icas2024/data/papers/icas2024_1098_paper.pdf

### 10. Spotify Engineering (2020) — "For Your Ears Only: Personalizing Spotify Home with Machine Learning"
- **Found Via:** Netflix/Spotify choice-architecture reframe.
- **Key Finding:** Home = a stack of *shelves* (horizontal rows), each shelf is a candidate-generation recipe ("Made for You," "Because you listened to...", "Your Shows"). Cards within a shelf are homogeneous; shelves are heterogeneous. Directly informs seed-open-question NN/g cards-vs-list at 5–15 items: the answer isn't cards *or* list — it's **multiple horizontal shelves of homogeneous cards**, each shelf a different slicing of the catalog (due, suggested, by-family). For 8 bundles this may be overkill, but the 2-shelf variant (Continue/Saved + All) is a well-attested pattern.
- **Source:** https://engineering.atspotify.com/2020/01/for-your-ears-only-personalizing-spotify-home-with-machine-learning

### 11. Spotify newsroom (2023) — new home feed with discover/music/podcasts tabs
- **Found Via:** Netflix/Spotify reframe — segmentation of the browse surface by intent.
- **Key Finding:** Spotify split home into intent-filtered views (Music / Podcasts / Audiobooks). Each has its own "continue + shelves" pattern. Analogue for bridge: if Practice ever grows beyond bidding into play-practice, intent-segmentation belongs at the Practice level, not inside a card.
- **Source:** https://newsroom.spotify.com/2023-03-08/new-home-page-scroll-clips-previews/

### 12. Johnson, E. (Behavioral Scientist) — "How Netflix's Choice Engine Tries to Maximize Happiness per Dollar Spent"
- **Found Via:** Netflix/Spotify reframe — choice-architecture-specific writing (as opposed to generic product teardowns).
- **Key Finding:** Netflix's designers treat the homepage as a *choice architecture* explicitly; key decisions are (a) how many rows, (b) row ordering (recency vs. affinity vs. diversity), (c) within-row ordering, (d) default autoplay. Confirms Jameson (2014) in industry practice. For bridge: the Practice tab's shelf ordering (Continue > Saved > By-family > All) is itself a choice-architecture decision worth naming.
- **Source:** https://behavioralscientist.org/how-the-netflix-choice-engine-tries-to-maximize-happiness-per-dollar-spent_ux_ui/

### 13. Game UI Database — Loadout / Character Select / Stage Select collections
- **Found Via:** Game-design reframe — pre-session configuration UX.
- **Key Finding:** Three distinct patterns documented across 1,300+ games: (a) *character select* = pick from a small fixed set, grid, bios expand on hover — maps to bridge's 8 bundles; (b) *loadout* = pick-then-configure (primary + slots) — maps to bundle + mode + role; (c) *stage select* = progress-gated nodes — would require mastery progression we don't have. The character-select pattern is the cleanest structural match and argues for a compact grid with a detail panel, not cards-with-everything-inline.
- **Source:** https://www.gameuidatabase.com/index.php?scrn=56 (loadout) https://www.gameuidatabase.com/index.php?scrn=41 (character select)

### 14. Xia — "Case Study: The Last of Us Loadout Screen Redesign"
- **Found Via:** Game-design reframe — primary UX writeup of a loadout.
- **Key Finding:** Explicit player-needs list: see current state, swap items, named custom loadouts, see stats, capacity feedback. Pain points: menus-over-menus, unclear equipped state, accidental resets. Directly relevant to "drill preset" CRUD flow: naming, delete confirmation, and "what's currently loaded" indication are all load-bearing. Confirms Fitbod finding that saved items need a replay-mode clarification at launch.
- **Source:** https://www.lilyxia.com/casestudy1

### 15. Fitbod — core product + personal-trainer app roundups
- **Found Via:** Fitness reframe — adaptive picker with saved-workout escape hatch.
- **Key Finding:** Default UX is "here's today's recommended workout, one tap to start, swipe to regenerate, star to save." The *default is a single recommendation*, not a browse grid — browse is accessed secondarily. This is the **opposite** pole from LeetCode's full-catalog default and matches the Duolingo-path end of the seed spectrum. Suggests a third design option for bridge Practice: a "today's recommended drill" hero slot above the browse grid, for users who want one click.
- **Source:** https://fitbod.me/ https://www.zing.coach/fitness-library/best-personal-trainer-apps

### 16. Headspace — library structure + personalization writeups
- **Found Via:** Meditation reframe — gated-catalog browse with continue affordance.
- **Key Finding:** Library is browsed primarily by *topic category* (stress, sleep, focus) with a secondary continue-course strip. Free previews are inline; paywall is per-item, not per-section. Confirms LeetCode's inline-paywall finding in a different vertical (meditation content is near-universally paid). Strengthens the seed recommendation to keep paywall badges inline in the Practice catalog.
- **Source:** https://www.headspace.com/content https://www.headspace.com/content/categories/meditation

### 17. Khan Academy — mastery system + recommended-skill writeups
- **Found Via:** Adaptive-learning reframe — mastery-gated skill picker.
- **Key Finding:** (a) "Fewer skills to proficient > many skills to familiar" — argues against encouraging breadth-first browse when practice time is limited; the picker should surface a *focused* next skill, not a "you've touched everything" achievement vector. (b) Mastery Challenges are scheduled across the course based on time-since-review — SRS-like mechanic, but user can always override to a specific skill. Resume + override is a recurring pattern across fields.
- **Source:** https://blog.khanacademy.org/why-khan-academy-will-be-using-skills-to-proficient-to-measure-learning-outcomes/ https://support.khanacademy.org/hc/en-us/articles/360037127892-What-are-Mastery-Challenges-in-course-mastery

### 18. Smart Learning Environments (2024) — "Improving the learning-teaching process through adaptive learning strategy"
- **Found Via:** Adaptive-learning reframe — competency mapping and prerequisite structure as a picker substrate.
- **Key Finding:** Adaptive platforms function best when the curriculum is modeled as a *graph of competencies with prerequisites*, and recommendations operate over that graph. Bridge conventions have weaker prerequisite structure than math, but the base-module concept (natural-bids always active) is a latent prerequisite graph. An eventual "what should I learn next" recommendation has a principled substrate to stand on.
- **Source:** https://slejournal.springeropen.com/articles/10.1186/s40561-024-00314-9

### 19. FAA FITS Scenario-Based Training (SBT) course developer guide
- **Found Via:** Aviation reframe — operational doctrine on how scenarios are organized for trainee selection.
- **Key Finding:** SBT scenarios are explicitly *not* skill-drill; they're realistic, decision-centric, and selected by learning objective rather than by mechanical exercise. Corollary for bridge Practice: the "decision-drill vs full-auction" mode choice mirrors the SBT vs. maneuver-based-training split — both should be available because they address different pedagogical goals, and surfacing the choice at pick-time is *itself* a learning affordance.
- **Source:** https://www.faa.gov/sites/faa.gov/files/training_testing/training/fits/training/course_developers.pdf

### 20. "Training Pilots for Unexpected Events" (Frontiers/PMC 2018)
- **Found Via:** Aviation reframe — empirical test of variable vs. blocked scenario exposure.
- **Key Finding:** Empirical demonstration that *unpredictable, variable* scenario exposure improves transfer more than predictable/repeated exposure — a real-world validation of Bjork's desirable-difficulties/interleaving in a high-stakes domain. Adds independent evidence to the seed-set Bjork finding and strengthens the case for an "Interleaved / Mixed drill" entry in the picker.
- **Source:** https://pmc.ncbi.nlm.nih.gov/articles/PMC6109944/

## Strategy Report

- **Adjacent fields explored:** music-practice apps, fitness-workout pickers, medical simulation, flashcard libraries (confirmatory only), Netflix/Spotify choice architecture, video-game loadout/character-select, aviation EBT/SBT, meditation apps, K-12 adaptive/mastery (Khan Academy).
- **Fields searched but produced no unique finds worth listing:** Quizlet/RemNote UX comparisons (surface overlap with Chessable/Anki already covered in seeds; no new structural insight). Strava/Garmin workout library (mostly integration plumbing, no picker-UX writing). Uscreen/Masterclass catalogs (too thin on design writing, and Masterclass is a lean-back video catalog — weak analogue).
- **Seed papers used as anchors:** Duolingo path migration, Chessable repertoire, Jameson choice architecture, Kizilcec SRL SLR, Bjork desirable difficulties, LeetCode teardowns, New Classrooms playlist, Jivet LAD SLR.
- **Unique finds (not in seeds):** 20.
- **Cross-domain convergences worth noting:**
  - **Competency-as-primary-facet** converges across medical simulation, aviation EBT, Khan Academy mastery, and LeetCode topic-tag — stronger than the seed set suggested. Supports sectioned-by-category Practice over flat grid.
  - **Resume + override** (Netflix/Spotify, Khan mastery challenges, Fitbod saved workouts, Chessable due-reviews) is universal: recommendation is offered, override is one tap. Confirms seed recommendation of visible-but-dismissable "recommended" slot.
  - **Pre-launch configuration** (loadout screens, Fitbod saved-workout replay modes, aviation scenario variant-parameters) is its own UX surface distinct from the picker — argues for a dedicated pre-session config step, not inlining mode/role into every card.
  - **Interleaving evidence** from aviation (PMC 2018) independently validates Bjork's desirable-difficulties finding from the seeds — less field-specific than the seed set indicated.
- **Emerging picker-design skeleton** (triangulated across fields): (1) small "continue / recommended" slot at top, (2) saved-drill shelf, (3) sectioned catalog by module-category, (4) per-item inline paywall/mastery badge, (5) pick → pre-launch config step where mode/role/seed are dialed, not on the card itself. This is a synthesis, not a claim from any single source — but four of the five rows have multi-domain support.
