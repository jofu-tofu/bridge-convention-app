# Landscape Scan — Agent A (keyword)

Scope: keyword-driven Boolean search across HCI/UX academic venues and grey
literature (NN/g, Duolingo blog, Chessable blog, LeetCode forums, ed-tech
magazines) on practice-hub/skill-select UX, browse-vs-resume design, and
drill-picker patterns. Industry evidence is included and clearly labeled, since
the underlying question is a UX design question, not purely academic.

## Papers / Sources Found

### 1. Jameson, A. (2014) "Choice Architecture for Human-Computer Interaction"
- **Venue:** Foundations and Trends in HCI, vol. 8, no. 1-2 (Now Publishers)
- **Type:** Theoretical monograph / review
- **Key Terms:** choice architecture, decision-making support, nudges, filtering,
  default effects, aided vs unaided choice
- **Relevance:** Foundational framework for designing screens where the system
  must help users pick among many options (conventions, modes, roles). Directly
  maps to the Practice tab's "browse-vs-resume vs recommend" tension. Argues that
  recommender UIs, filtered lists, and defaults are all choice-architecture
  decisions that should be designed intentionally, not by accident.
- **Source:** https://www.nowpublishers.com/article/DownloadSummary/HCI-028

### 2. Jameson, A. (2014) "Recommender Systems as Part of a Choice Architecture for HCI"
- **Venue:** CEUR Workshop Proceedings, vol. 1278 (Decisions@RecSys workshop)
- **Type:** Theoretical / position paper
- **Key Terms:** choice patterns, attribute-based choice, recognition-based
  choice, trade-off navigation, consequence-based choice
- **Relevance:** Introduces six "choice patterns" users adopt when picking from a
  catalog. Useful for thinking about whether bridge users pick a convention by
  attribute (category: competitive / 1NT family), by recognition ("the one I was
  doing yesterday"), or by consequence ("the one I'm weakest at"). Suggests the
  Practice hub may need to support multiple patterns simultaneously.
- **Source:** https://ceur-ws.org/Vol-1278/paper1.pdf

### 3. Jesse, M. & Jannach, D. (2021) "Digital Nudging with Recommender Systems: Survey and Future Directions"
- **Venue:** Computers in Human Behavior Reports (ScienceDirect)
- **Type:** Survey / literature review
- **Key Terms:** digital nudging, default nudge, social proof, salience,
  framing, decision fatigue
- **Relevance:** Surveys nudge mechanisms that apply to pick-screens — defaults
  ("continue where you left off"), social proof ("popular drill"), and salience
  (badging review-due). Directly informs how to layer a resume affordance and
  recommendation signals on a browse screen without overwhelming the picker.
- **Source:** https://www.sciencedirect.com/science/article/pii/S245195882030052X

### 4. Duolingo Research Team (2022) "The Science Behind Duolingo's Home Screen Redesign" (Duolingo blog / whitepaper)
- **Venue:** Duolingo Blog + 2024 Duolingo Path whitepaper (grey literature,
  industry empirical)
- **Type:** Industry case study with A/B quantitative evidence
- **Key Terms:** guided path vs skill tree, lesson ordering, learner autonomy
  vs guidance, proficiency outcome
- **Relevance:** Most-cited industry example of the exact tradeoff in this
  question: branching "tree" (high autonomy, high choice cost) vs linear "path"
  (low autonomy, lower cognitive load, better measured outcomes). Duolingo's
  published result: linear path produced better proficiency than the tree. For
  bridge, this argues the picker should be opinionated about "what to drill
  next" when users don't have a clear intent.
- **Source:** https://blog.duolingo.com/new-duolingo-home-screen-design/ and
  https://duolingo-papers.s3.amazonaws.com/reports/Duolingo_whitepaper_language_read_listen_write_speak_2024.pdf

### 5. Nielsen Norman Group — Pernice, K. (2020) "8 Design Guidelines for Complex Applications"
- **Venue:** NN/g article (grey literature, practitioner synthesis)
- **Type:** Design guideline synthesis based on NN/g usability studies
- **Key Terms:** resumability, task interruption, flexibility, hub-and-spoke,
  expert user affordances, dashboard vs workspace
- **Relevance:** Explicitly calls out that complex applications must "help users
  resume tasks after interruptions" and provides a record of state. Directly
  applies to how the Practice tab layers a resume/continue affordance alongside
  browse, and why the affordance should be persistent but secondary to the
  browse grid once a dedicated landing page handles primary resume.
- **Source:** https://www.nngroup.com/articles/complex-application-design/

### 6. Nielsen Norman Group — "Card View vs. List View" (video + supporting article)
- **Venue:** NN/g (grey literature, practitioner guideline)
- **Type:** Design guideline
- **Key Terms:** card view, list view, scannability, visual weight, grouping,
  dense vs sparse layouts
- **Relevance:** Directly addresses flat-grid vs sectioned-list tradeoff for ~8
  bundles. NN/g's guideline: cards are better when items are differentiated by
  imagery or require persuasion; lists are better when items are comparable
  along the same attributes and users scan quickly. Argues for cards when the
  picker is discovery-mode and list when it's recognition-mode — implying the
  Practice hub may want both view modes or hybrid sectioned cards.
- **Source:** https://www.nngroup.com/videos/card-view-vs-list-view/

### 7. Scheffel, M., Drachsler, H., et al. (2014-2020 program) — Learning Analytics Dashboards literature (representative: Verbert, Govaerts, Duval et al.)
- **Venue:** Journal of Learning Analytics / LAK conference [FROM TRAINING — verify]
- **Type:** Empirical reviews of learning dashboards
- **Key Terms:** mastery indicators, open learner model, review-due signaling,
  progress visualization, student-facing analytics
- **Relevance:** Evidence base on surfacing mastery/weakness at pick-time
  without creating a dashboard screen. Core finding: small inline progress
  signals per item (e.g., colored rings, "due" badges) outperform separate
  dashboard pages for behavior change, because signal is co-located with
  action. Supports the "progress signaling without nagging" design pressure.
- **Source:** FROM TRAINING — verify (search Verbert et al. "Learning Analytics
  Dashboards")

### 8. Chessable Blog — "Chessable's New Repertoire Feature" + "Using Spaced Repetition Intelligently"
- **Venue:** Chessable blog (grey literature, industry product writing)
- **Type:** Product-design case study
- **Key Terms:** repertoire, custom drill set, MoveTrainer, review queue,
  author-curated vs user-curated practice
- **Relevance:** Closest structural analogue to bridge convention practice.
  Chessable's answer to "saved drills" is the Repertoire — a user-curated,
  persistent, add-to-set model with checkboxes on course/chapter pages. The
  picker surface is a library of author-authored courses; the resume/review
  surface is a separate Review queue driven by SRS, not the library. Supports
  separating "browse catalog" from "resume queue" into distinct surfaces.
- **Source:** https://www.chessable.com/blog/chessables-new-repertoire-feature-turns-you-from-active-learner-to-architect-of-your-chess-growth/
  and https://www.chessable.com/blog/using-spaced-repetition-intelligently/

### 9. Trujillo, K. & Dziuban, C. (Degree Compass program write-ups) — "How Predictive Analytics and Choice Architecture Can Improve Student Success"
- **Venue:** Research & Practice in Assessment journal (rpajournal.com)
- **Type:** Empirical / program evaluation
- **Key Terms:** curriculum recommender, choice overload reduction,
  success-probability ranking, default recommendation
- **Relevance:** Real-world learning-context deployment of choice architecture:
  when a catalog has many items and users lack strong preference, ranking by
  predicted-success and presenting a small shortlist beats full-catalog browse.
  Suggests the Practice hub could show "recommended next" above the full catalog
  rather than reorganizing the catalog itself.
- **Source:** https://www.rpajournal.com/dev/wp-content/uploads/2014/10/A6.pdf

## Vocabulary Discovered

- **choice architecture:** Intentional design of how options are presented to
  shape decisions (Jameson, Thaler-Sunstein lineage).
- **choice patterns:** Six canonical ways users pick from a catalog
  (attribute-based, recognition-based, consequence-based, trade-off, experience,
  social). A picker UI supports one or several.
- **digital nudge:** A UI element (default, badge, ordering, framing) that steers
  choice without removing options.
- **guided path vs skill tree:** Duolingo's terms for linear-curriculum vs
  branching-curriculum home screens; the redesign moved from tree to path.
- **open learner model:** Learning-analytics term for user-facing mastery
  visualization (the "what do I know" view that informs pick-time decisions).
- **repertoire (Chessable):** User-curated subset of lessons stitched from an
  author-authored catalog; the chess analogue of "saved drills."
- **review queue / MoveTrainer:** Separate surface from the catalog where
  SRS-scheduled items appear; structurally distinct from "browse."
- **hub-and-spoke (NN/g):** Navigation pattern where a central screen launches
  to many task flows; relevant framing for what the Practice tab becomes once
  landing exists.
- **card view vs list view:** NN/g terminology; governs grid-vs-sectioned-list
  decision at ~8 items.
- **decision fatigue / choice overload:** Why a flat catalog of many options
  degrades both outcome and engagement.
- **recognition vs recall pick:** Whether the user recognizes the item they want
  (logo, name, last-session badge) or must recall it from memory; drives layout.

## Landscape Notes

The academic HCI literature on this exact problem — practice-hub / skill-select
screen design — is thin; the closest body is choice-architecture for HCI
(Jameson is the anchor) and learning-analytics dashboards (Verbert, Duval,
Scheffel, Drachsler). The richest evidence is **industry grey literature**:
Duolingo's tree-to-path redesign is an uncommonly well-documented A/B result
and is the single most citable source for "when in doubt, guide rather than
offer choice." Chessable is the closest structural analogue to bridge
convention practice (author-curated modules + user repertoires + SRS review
queue) and its product writing maps cleanly onto the three design pressures
(browse vs resume, saved drills placement, progress signaling). The main debate
is autonomy vs guidance: Duolingo's evidence favors guided-path for novices,
but chess-training and LeetCode cultures favor expert-style browse-and-pick
with heavy tagging — suggesting bridge's intermediate-club-player persona wants
a hybrid (strong recommendations + full catalog accessible).

Well-studied: choice architecture, dashboards, SRS UI in chess training.
Gaps: empirical comparisons of flat grid vs sectioned grid at small catalog
sizes (5-15 items); empirical work on how "resume" affordances should downgrade
once a dedicated landing page exists; peer-reviewed studies of drill-picker
screens in deliberate-practice apps (most evidence is industry case studies).

## Queries Used

1. `"practice hub" OR "skill selection" UX design learning app browse resume HCI`
   → moderate (surfaced Uxcel; weak on academic hits)
2. `Nielsen Norman Group dashboard vs hub navigation "continue" resume learning`
   → moderate (surfaced NN/g complex-app guidelines, card-vs-list)
3. `"Duolingo skill tree path redesign" "choice" UX case study` → good
   (surfaced Duolingo's own science-behind-redesign post + 2024 whitepaper)
4. `Chessable Chess.com drill picker UX "spaced repetition" module selection`
   → good (surfaced Chessable repertoire + SRS articles)
5. `"paradox of choice" learning app curriculum recommender choice architecture HCI`
   → good (surfaced Jameson monograph + Degree Compass)
6. `LeetCode "problem list" topic tag UX browse vs recommended practice` →
   moderate (surfaced topic-tag forum discussion; weak on formal UX studies)
7. `"deliberate practice" microlearning UI "weakness surfacing" mastery dashboard`
   → moderate (surfaced OttoLearn-style adaptive microlearning writing; mostly
   vendor grey literature)
8. `Nielsen Norman Group "card sort" grid vs categorized list learning content library`
   → moderate (surfaced NN/g card-sorting + card-vs-list; not specific to
   learning catalogs)
