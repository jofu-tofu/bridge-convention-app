# Landscape Scan — Agent C (reviews)

> **Note on coverage.** No single systematic review answers the practice-hub/drill-picker UX question end-to-end. The closest syntheses are (a) Alhadreti et al.'s systematic review of mobile-learning UI design frameworks, (b) NN/g's pattern library on cards vs. lists vs. grids, and (c) the gamified-microlearning SLR by Zhang et al. Each is flagged below. The rest of this file collects design-system references and comparative teardowns that together cover the question.

## Papers & Reviews Found

### 1. Alhadreti & Elbahi (2023) — "Investigating the User Interface Design Frameworks of Current Mobile Learning Applications: A Systematic Review"
- **Venue:** Education Sciences (MDPI), 13(1), 94.
- **Type:** Systematic review.
- **Key Terms:** cognitive load, mobile learning UI, design heuristics, learner-centered design, screen-size constraints.
- **Relevance:** **FLAGGED — most directly relevant existing review.** Synthesizes UI design criteria for mobile learning apps and how they modulate cognitive load. Directly applicable to drill-picker density, sectioning, and progress-signaling decisions.
- **Source:** https://www.mdpi.com/2227-7102/13/1/94

### 2. Zhang, Yu & Chen (2021) — "Features, Frameworks, and Benefits of Gamified Microlearning: A Systematic Literature Review"
- **Venue:** ICMET 2021 (ACM).
- **Type:** Systematic literature review.
- **Key Terms:** gamified microlearning, progress tracking, points/leaderboards, content co-creation, 15-feature taxonomy.
- **Relevance:** **FLAGGED — catalog of microlearning UI features.** Useful for deciding which progress/mastery signals belong on a convention-picker without tipping into dashboard territory.
- **Source:** https://dl.acm.org/doi/10.1145/3468978.3469000

### 3. Tahir, Arif & Ayub (2025) — "Gamification in Learning Management Systems: A Systematic Literature Review"
- **Venue:** Information (MDPI), 16(12), 1094. Covers 139 studies 2013–2025.
- **Type:** Systematic review.
- **Key Terms:** LMS gamification, mastery surfacing, adaptive recommendation, engagement metrics.
- **Relevance:** Broader-than-needed but the "what to surface at pick-time" section maps onto Practice-tab weakness/mastery nudges.
- **Source:** https://www.mdpi.com/2078-2489/16/12/1094

### 4. Nielsen Norman Group — "Cards: UI-Component Definition" (Loranger/Laubheimer)
- **Venue:** nngroup.com pattern library.
- **Type:** Design-pattern review / guideline.
- **Key Terms:** heterogeneous vs. homogeneous content, summary-plus-link, scannability, card-vs-list trade-off.
- **Relevance:** **FLAGGED — load-bearing guidance.** NN/g's explicit recommendation: use cards for heterogeneous summaries, but prefer a vertical list or image grid for homogeneous items. With ~8 bundles of structurally identical shape, this argues against a pure card grid and toward a sectioned list or list-with-hero.
- **Source:** https://www.nngroup.com/articles/cards-component/

### 5. Nielsen Norman Group — "Card View vs. List View" (video + article series) and "Simplicity Wins over Abundance of Choice"
- **Venue:** nngroup.com.
- **Type:** Pattern-library review and choice-architecture synthesis.
- **Key Terms:** scan path, comparison tasks, progressive disclosure, Hick's law application.
- **Relevance:** Covers pick-screen layout trade-offs and paradox-of-choice mitigations (progressive reveal, default selection, curated "recommended" slot). Directly applicable to browse-first vs. resume-first framing.
- **Sources:**
  - https://www.nngroup.com/videos/card-view-vs-list-view/
  - https://www.nngroup.com/articles/simplicity-vs-choice/

### 6. Apple Human Interface Guidelines — "Collections" component and "Layout"
- **Venue:** developer.apple.com/design/human-interface-guidelines.
- **Type:** Design-system reference.
- **Key Terms:** collection view, ordered-set presentation, section headers, compositional layout.
- **Relevance:** Canonical spec for presenting an ordered, customizable set of items (i.e., bundles). Section-header patterns map cleanly onto MODULE_CATEGORIES sectioning.
- **Source:** https://developer.apple.com/design/human-interface-guidelines/components/layout-and-organization/collections/

### 7. Google Material Design 3 — list, card, and navigation pattern references
- **Venue:** m3.material.io (implied peer to HIG).
- **Type:** Design-system reference.
- **Key Terms:** list density, card elevation, filled/outlined variants, top-app-bar + content navigation.
- **Relevance:** Concrete density and affordance tokens for list vs. card rendering on a single-screen picker.
- **Source:** https://vyrazu.com/material-design-vs-human-interface-guidelines/ (comparison gateway) — primary: https://m3.material.io

### 8. Wang, Liu et al. (2020) — "Mobile microlearning design and effects on learning efficacy and learner experience"
- **Venue:** Educational Technology Research and Development, 68, 2021.
- **Type:** Empirical study + design-principle review.
- **Key Terms:** chunk granularity, resume affordances, completion feedback.
- **Relevance:** Evidence on how short-session learners expect to re-enter content. Informs the "saved drill / resume" side-panel question even though landing owns the primary resume slot.
- **Source:** https://link.springer.com/article/10.1007/s11423-020-09931-w

### 9. Lodely — "LeetCode Pricing: Premium Cost, Free Trial & Better Alternatives" and The Code Bytes — "LeetCode Review"
- **Venue:** Product review sites (non-peer-reviewed).
- **Type:** Comparative product/UX teardown.
- **Key Terms:** company-tagged problems, premium-only problems, topic tags, problem list filters, editorial gating.
- **Relevance:** Practical teardown of how LeetCode presents a large practice catalog with a paywall layered on top — company tag as dominant filter, topic tags as secondary, premium badges inline with problem rows (not a separate tab). Directly relevant to paywall/preview handling in the Practice tab.
- **Sources:**
  - https://www.lodely.com/blog/leetcode-premium-cost
  - https://thecodebytes.com/leetcode-review/

### 10. UserGuiding — "Duolingo — an in-depth UX and user onboarding breakdown"
- **Venue:** Product-UX blog.
- **Type:** UX teardown.
- **Key Terms:** skill tree, unit path, sectioned learning map, locked-until-prereq, daily-goal nudge placement.
- **Relevance:** Closest public breakdown of the skill-tree picker pattern. Worth contrasting with Chessable's course/variation list model. Non-academic but detailed.
- **Source:** https://userguiding.com/blog/duolingo-onboarding-ux

### 11. Chess Improvement Lab / SmarterLanguage — informal comparative reviews (Chessable vs. Anki; Anki vs. Duolingo)
- **Venue:** Substack / review blogs.
- **Type:** Practitioner comparative teardown.
- **Key Terms:** deck-centric vs. course-centric picking, spaced-review queue as entry point, "due today" vs. "browse courses" split.
- **Relevance:** Shows the industry-standard split: Anki opens to "decks due now" (resume-first); Chessable opens to "my courses" grid with a due-reviews strip (hybrid); Duolingo opens to the skill tree itself (browse-is-resume). The Practice tab's closest analogue is Chessable's "my courses" surface once the landing page handles resume.
- **Sources:**
  - https://chessimprovementlab.substack.com/p/learn-first-remember-later/comments
  - https://speakada.com/anki-vs-duolingo-which-language-learning-app-really-works/
  - https://duolingoguides.com/anki-vs-duolingo/

### 12. Ericsson-tradition deliberate-practice integrative reviews (e.g., Cheng et al. 2024 on simulation-based DP)
- **Venue:** Clinical Simulation in Nursing / ScienceDirect.
- **Type:** Integrative review.
- **Key Terms:** task selection, immediate feedback, weakness-targeted drilling, coach-surrogate recommendation.
- **Relevance:** Grounds the "recommend vs. let user browse" design pressure in the deliberate-practice literature: DP frameworks require task selection to target current weakness, which argues for at least one recommended-next slot on the picker.
- **Source:** https://www.sciencedirect.com/science/article/pii/S1876139924000768

## Vocabulary Discovered
- **Collection view** (Apple HIG): ordered, presentation-customizable set — HIG's canonical term for a bundle picker.
- **Heterogeneous vs. homogeneous content** (NN/g): the decisive axis for card-vs-list choice.
- **Skill tree / unit path**: Duolingo's picker metaphor; prerequisite-gated nodes.
- **Problem list + topic tag + company tag**: LeetCode's three-axis catalog navigation.
- **Due-reviews strip**: hybrid resume affordance layered atop a browse grid (Chessable, Anki-variant front ends).
- **Chunk granularity / resume affordance**: microlearning terms for "where does the user re-enter?"
- **Progressive disclosure / Hick's-law mitigation**: NN/g's preferred remedy for paradox of choice on picker screens.
- **Mastery surfacing / weakness-targeted drilling**: DP-literature terms for the progress-signaling pressure.

## Landscape Notes
The academic literature treats "practice picker UX" only obliquely — systematic reviews exist for mobile-learning UI (Alhadreti 2023) and gamified microlearning (Zhang 2021, Tahir 2025), but none answer the specific browse-vs-resume / card-vs-list / config-at-pick-time questions directly. The strongest prescriptive guidance comes from design-system pattern libraries (NN/g, Apple HIG Collections, Material 3) rather than academia. Product-UX teardowns of Duolingo, Chessable, Anki, and LeetCode are almost entirely non-peer-reviewed blog content, but the convergent pattern across them is clear: when a separate landing/home surface owns resume, the catalog surface becomes a sectioned list with a small "due / recommended" strip rather than a pure card grid — and paywall badges live inline with rows, never as a segregated tab. No comprehensive academic review specifically on drill-picker UX exists; this is a gap.

## Queries Used
1. `systematic review deliberate practice interface design HCI learning apps` → moderate (found Alhadreti 2023, DP integrative review).
2. `Nielsen Norman Group dashboard card grid picker pattern library learning` → good (NN/g cards, card-vs-list, simplicity-vs-choice).
3. `Chessable Duolingo Anki comparative UX teardown skill tree drill picker` → moderate (practitioner reviews, no academic teardown).
4. `literature review gamification microlearning app interface design meta-analysis` → good (Zhang 2021 SLR, Tahir 2025 SLR, Wang 2020).
5. `Material Design Apple HIG list grid collection picker navigation pattern guidelines` → good (HIG Collections canonical ref).
6. `LeetCode Chessable problem selection UX review product design analysis paywall` → moderate (LeetCode paywall teardowns; no Chessable academic coverage).
7. `"paradox of choice" course selection menu design review educational technology` → good (NN/g simplicity-vs-choice; Iyengar-Lepper grounding).
