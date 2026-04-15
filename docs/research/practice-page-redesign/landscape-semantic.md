# Landscape Scan — Agent B (semantic)

## Reframed Question

The user's surface question is "what should the Practice convention-select page look like?" The deeper, structurally interesting question is: **"Given that landing already handles resume/warm-start and the user arrives at Practice with browse intent, how should a drill-selection hub balance (a) learner autonomy and browse freedom, (b) a recommendation/nudge layer that steers toward productive practice, (c) a home for user-curated 'saved drills', and (d) choice-architecture for a small-but-growing catalog?"**

The semantically analogous literatures are: deliberate practice instructional design, digital choice architecture, self-regulated learning (SRL) dashboards, curriculum playlists/learner-curated collections, desirable-difficulties metacognition, and the Duolingo skill-tree→path natural experiment in choice removal.

## Papers Found

### 1. Goldberg, B. et al. (2023) "Drill-Practice-Repeat: Experiential Scaffolds for Deliberate Practice"
- **Venue:** AIED-GEL 2023 (CEUR-WS Vol-3484)
- **Type:** applied/theoretical framework
- **Key Terms:** experiential scaffolds, competency selection, session planning, adaptive task difficulty
- **Relevance:** Explicitly frames the "drill hub" as a planning surface whose job is helping the learner *select competencies* and prioritize sessions — directly analogous to the Practice page's role once landing owns resume.
- **Source:** https://ceur-ws.org/Vol-3484/AIED-GEL23_paper_9_CEUR.pdf

### 2. van Merriënboer & Sluijsmans, and related (Educational Technology R&D) on cognitive load + deliberate practice for advanced learners
- **Venue:** Educational Technology Research and Development
- **Type:** theoretical integration
- **Key Terms:** advanced-learner instructional design, part-task practice, whole-task sequencing, learner control
- **Relevance:** Connects deliberate-practice prescriptions (targeted, feedback-rich, just-past-comfort-zone) with the instructional-design question of how much control to hand the learner — directly relevant to "browse vs recommend."
- **Source:** https://link.springer.com/article/10.1007/BF02504799

### 3. JMIR Medical Education (2026) "Digital Choice Architecture in Medical Education: Applying Behavioral Economics to Online Learning Environments"
- **Venue:** JMIR Medical Education
- **Type:** conceptual / applied framework
- **Key Terms:** digital choice architecture, defaults, commitment devices, temporal optimization, nudge units
- **Relevance:** Argues LMS and practice platforms systematically ignore cognitive limitations; proposes defaults, recommended-action highlighting, and minimizing unnecessary choices that deplete cognitive resources. Direct blueprint for a drill-picker's nudge layer.
- **Source:** https://mededu.jmir.org/2026/1/e86497

### 4. Kizilcec, R. F. et al. — "Supporting Self-Regulated Learning in Online Learning Environments and MOOCs: A Systematic Review"
- **Venue:** International Journal of Human–Computer Interaction (Taylor & Francis)
- **Type:** systematic review
- **Key Terms:** SRL scaffolds, dashboards, user-initiated vs proactive support, automation bias
- **Relevance:** Reviews how recommendation, dashboards, and prompts interact with autonomy. Finding that **user-initiated (solicited) support preserves autonomy and deeper engagement while proactive prompts introduce automation bias** is a first-order design constraint for the Practice hub's recommendation panel.
- **Source:** https://www.tandfonline.com/doi/full/10.1080/10447318.2018.1543084

### 5. Jivet, I. et al. (2023) "Learning analytics dashboards are increasingly becoming about learning and not just analytics — a systematic review"
- **Venue:** Education and Information Technologies (Springer)
- **Type:** systematic review
- **Key Terms:** learning analytics dashboards, actionable insights, reference frames, response guidance
- **Relevance:** Core finding — **tracking without guidance on how to respond does not improve outcomes**. A "mastery" or "review-due" badge on a convention tile is only useful if paired with a recommended next action. Argues against a purely informational progress layer.
- **Source:** https://link.springer.com/article/10.1007/s10639-023-12401-4

### 6. Bjork, E. L. & Bjork, R. A. (2011/2020) "Making things hard on yourself, but in a good way: Creating desirable difficulties to enhance learning" + Kirk-Johnson et al. "Students Can (Mostly) Recognize Effective Learning, So Why Do They Not Do It?"
- **Venue:** Psychology and the Real World; PMC review
- **Type:** empirical / review
- **Key Terms:** desirable difficulties, subjective fluency, blocking vs interleaving, metacognitive illusions
- **Relevance:** Learners left to free-browse **systematically self-select blocked, massed, re-exposure practice** (the drill-1NT-Stayman-for-an-hour pattern) over interleaved practice that produces better retention. Argues for interleaving/variation defaults and "mixed drill" presets rather than relying on user choice alone.
- **Source:** https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2016/04/EBjork_RBjork_2011.pdf ; https://pmc.ncbi.nlm.nih.gov/articles/PMC9781761/

### 7. Duolingo (2024) "Duolingo Path Meets Expectations for Proficiency Outcomes" (white paper) + secondary reporting on the 2022 skill-tree→path migration
- **Venue:** Duolingo Research white paper + press
- **Type:** applied case study / natural experiment
- **Key Terms:** skill tree, guided path, choice removal, decision fatigue, motivation trade-off
- **Relevance:** The most direct industry analogue to the "browse vs recommend" tension. Removing choice **reduced decision fatigue and improved outcomes for many learners but hurt motivation for autonomy-valuing users**. A relevant design lesson for Practice: a default "next drill" path + an always-visible escape hatch to free browse is defensible.
- **Source:** https://duolingo-papers.s3.amazonaws.com/reports/Duolingo_whitepaper_language_read_listen_write_speak_2024.pdf

### 8. Rose, J. / New Classrooms — "Curriculum Playlists" (EdWeek coverage + Catlin Tucker / AVID practitioner literature)
- **Venue:** Education Week; practitioner ed-tech literature
- **Type:** applied model + practitioner syntheses
- **Key Terms:** playlists (single-path vs choice-board), curated collections, differentiation, Wakelet-style learner curation
- **Relevance:** Maps directly to "saved drills." Two distinct models exist: **single-path playlist** (teacher/system curates a sequence) vs **choice-board playlist** (learner picks from curated options). Suggests the "saved drills" concept is actually two features — system-authored preset bundles AND user-curated sets — that deserve separate affordances.
- **Source:** https://www.edweek.org/technology/curriculum-playlists-a-take-on-personalized-learning/2017/03

### 9. Chessable / Listudy / Chessdriller spaced-repetition opening trainers (grey literature, Hacker News / Lichess forum threads)
- **Venue:** industry/open-source trainers (grey literature; no peer-reviewed study located in this scan)
- **Type:** existing-product analysis
- **Key Terms:** MoveTrainer, SRS over openings, review-due queue, course library
- **Relevance:** The closest structural analogue to bridge bidding drill UX. Pattern they converge on: **(1) a library/browse view of courses-you-own, (2) a prominent "review due" surface driven by SRS, (3) per-course drill modes, (4) user-created decks for custom lines.** Essentially: resume ≠ landing, it's a queue widget that lives inside Practice itself.
- **Source:** https://www.chessable.com/ ; https://listudy.org/en ; https://chessdriller.org/ ; https://news.ycombinator.com/item?id=35692417

## Vocabulary Discovered

- **Digital choice architecture:** deliberate LMS/platform design applying defaults, nudges, commitment devices from behavioral econ.
- **Subjective fluency:** feeling-of-ease metric learners confuse with actual learning; drives poor self-selection.
- **Blocked vs interleaved practice:** blocked = one topic at a time (preferred by learners, worse retention); interleaved = mixed (better retention).
- **Single-path playlist vs choice-board playlist:** two distinct "saved set" patterns — sequential vs menu-of-options.
- **Solicited vs proactive scaffolding:** user-initiated help vs system-initiated prompts; former preserves autonomy.
- **Reference frame (in LAD literature):** the comparator a dashboard uses (self-past, peers, mastery target) — determines whether progress indicators motivate or demotivate.
- **Competency selection surface:** explicit term for the "pick what to drill" screen.
- **Review-due queue:** time-decay-driven list of items flagged for re-practice; SRS primitive.
- **Entry-point design principle (HCI):** the screen a user lands on after the gateway disproportionately shapes the rest of the session; favor focus over breadth.

## Landscape Notes

Three mature literatures converge on this problem but rarely talk to each other: (1) **deliberate-practice / desirable-difficulties cognitive psychology** (Ericsson, Bjork, Pan) which says learners self-select poorly and need structure; (2) **self-regulated-learning + learning-analytics-dashboard HCI** (Kizilcec, Jivet, Winne) which says structure without autonomy-preserving framing breeds dependence and that pure analytics without response guidance doesn't improve outcomes; (3) **behavioral-economics choice-architecture** (Thaler/Sunstein lineage, applied to ed-tech in the 2026 JMIR piece) which supplies concrete interface primitives — defaults, recommended actions, reducing unnecessary choices. The Duolingo skill-tree→path migration is the field's best-known natural experiment and lands in the middle: heavy-handed choice removal improved outcomes but cost motivation. The "playlists" practitioner literature and the chess-trainer grey-literature (Chessable/Listudy) supply the clearest product patterns for "saved drills." Gap: I found no peer-reviewed HCI studies specifically on bridge or card-game practice UIs; chess tactics trainers are the closest published-adjacent analogue and are mostly grey literature.

## Queries Used

1. "how should a deliberate practice drill selection hub be designed for skill learners HCI study" → moderate (Goldberg AIED-GEL paper + ETR&D framework)
2. "choice architecture exercise selection learning apps paradox of choice microlearning" → good (JMIR Medical Education 2026 — highly on-point)
3. "playlists decks saved sets learner-curated collections educational technology research" → good (New Classrooms playlists, single-path vs choice-board distinction)
4. "recommendation versus free browse learner autonomy self-regulated learning dashboard" → good (Kizilcec IJHCI systematic review + Jivet LAD review — both directly address the tension)
5. "chess training interface design puzzle selection spaced repetition study" → moderate (only grey literature — Chessable, Listudy, Chessdriller; no peer-reviewed HCI)
6. "entry point design learning app resume continue versus explore browse intent HCI" → poor (mostly unrelated resume-writing and Android dev results; extracted general entry-point principle only)
7. "Duolingo skill tree versus path learner motivation choice overload study" → good (Duolingo 2024 white paper + practitioner analysis of 2022 migration)
8. "desirable difficulties Bjork self-selection practice problems learners choose suboptimal" → good (Bjork 2011 foundational + Kirk-Johnson PMC review on the recognition-but-not-use gap)
