# Deep Expansion — Agent E (Forward Citations)

Seeds chased: Duolingo path migration (2022/2024), Kizilcec SRL review, Jivet LAD review, Jameson choice architecture, Bjork desirable difficulties. Focus: 2021+ empirical work that builds on these seeds and touches drill-picker / practice-hub / SRS-trainer / mobile-learning / saved-set UX.

## Papers Found

### 1. Shao, Wang & Freeman (2024) — "Opening the 'Black Box': How Out-of-Class Use of Duolingo Impacts Chinese Junior High School Students' Intrinsic Motivation for English" (Sage, RELC-adjacent; Zeng & Fisher 2024)
- **Found Via:** Forward citation on Duolingo path/whitepaper seed.
- **Key Finding:** Post-path Duolingo satisfies autonomy and competence needs for low-stakes learners but the linear path's "reminder/streak" machinery substitutes extrinsic for intrinsic regulation over time. Relevance: supports the seed's "linear path wins proficiency but can erode autonomy" tension with new empirical data from adolescent learners.
- **Source:** https://journals.sagepub.com/doi/10.1177/20965311231171606

### 2. Li, Bonk & Zhou (2024) — "Supporting learners' self-management for self-directed language learning: a study within Duolingo" (Interactive Technology and Smart Education)
- **Found Via:** Forward citation on Duolingo 2024 whitepaper.
- **Key Finding:** Even with the guided path, highly motivated users build *external* self-management scaffolds (schedules, goal notes, external trackers) because the in-app path does not expose goal-setting affordances. Directly relevant: argues for a "saved practice set" surface as a user-authored commitment device layered onto a system-curated sequence.
- **Source:** https://publicationshare.com/pdfs/Duolingo-Self-Manage_SDLL_Li_Bonk_Zhou_Interactive-Tech-%26-Smart-Ed_2024.pdf

### 3. Guo et al. (2025) — "Uncurtaining windows of motivation, enjoyment, critical thinking, and autonomy in AI-integrated education: Duolingo Vs. ChatGPT" (System / ScienceDirect)
- **Found Via:** Forward citation on Duolingo seed.
- **Key Finding:** On direct comparison, ChatGPT-style open prompts scored higher on perceived autonomy than Duolingo's path; Duolingo scored higher on perceived structure and enjoyment. Supports a hybrid design: structured path + open "browse / my sets" escape hatch.
- **Source:** https://www.sciencedirect.com/science/article/abs/pii/S0023969025000074

### 4. Kaliisa, Jivet & Prinsloo (2023) — "A checklist to guide the planning, designing, implementation, and evaluation of learning analytics dashboards" (IJETHE)
- **Found Via:** Forward citation on Jivet 2023 LAD review (same author cluster).
- **Key Finding:** Operationalizes the Jivet "tracking without response guidance fails" finding into a checklist: every visualized signal must be paired with (a) a reference frame, (b) a recommended action, (c) a dismiss/defer affordance. Maps directly onto per-module mastery badge design.
- **Source:** https://educationaltechnologyjournal.springeropen.com/articles/10.1186/s41239-023-00394-6

### 5. "Have Learning Analytics Dashboards Lived Up to the Hype?" (arXiv 2312.15042, 2023/2024 meta-analysis)
- **Found Via:** Forward citation on Jivet 2023.
- **Key Finding:** Meta-analysis of ~30 LAD studies finds modest-to-null effects on learning outcomes; dashboards that embed prescriptive next-action prompts outperform purely descriptive ones. Strengthens the case that progress signals on the Practice hub must be actionable, not decorative.
- **Source:** https://arxiv.org/pdf/2312.15042

### 6. Hooshyar et al. (2024) — "AI-powered learning analytics dashboards: a systematic review of applications, techniques, and research gaps" (Discover Education, 2025)
- **Found Via:** Forward citation on Jivet 2023.
- **Key Finding:** 21 AI-LAD studies 2013–2024; the sub-class that recommends a single next action outperforms multi-metric visualizations on both engagement and persistence. "Recommended next drill" slot > ambient progress grid.
- **Source:** https://link.springer.com/article/10.1007/s44217-025-00964-y

### 7. Student-facing LAD design review (JLA 2024, Vieira et al.) — "Learning Analytics Dashboard Design and Evaluation to Support Student Self-Regulation of Study Behaviour"
- **Found Via:** Forward citation on Jivet 2023 + Kizilcec SRL review (dual seed).
- **Key Finding:** Dashboards designed around SRL phases (forethought / performance / reflection) outperform pure-metrics dashboards; the "forethought" surface maps onto a Practice picker + resume affordance.
- **Source:** https://learning-analytics.info/index.php/JLA/article/view/8529

### 8. Deng et al. (2024) — MIS Quarterly, "Interleaved Design for E-Learning: Theory, Design, and Empirical Findings"
- **Found Via:** Forward citation on Bjork desirable difficulties + Kizilcec.
- **Key Finding:** Large-scale e-learning field experiment. A *related-interleaving* recommender (interleave items within a topic cluster) outperforms random interleaving and blocked practice, and benefits weak learners most. Suggests a bridge-convention "mixed drill" default should interleave within a bundle, not across unrelated bundles.
- **Source:** https://misq.umn.edu/misq/article/48/4/1363/2325/Interleaved-Design-for-E-Learning-Theory-Design

### 9. Biwer et al. (2024) — "Why Do Learners (Under)Utilize Interleaving in Learning Confusable Categories?" (Educ Psychology Review)
- **Found Via:** Forward citation on Bjork/Kirk-Johnson seed.
- **Key Finding:** ~80% of learners explicitly believe blocked > interleaved after experiencing both; the metacognitive illusion persists even with feedback. Utility-value framing narrows the gap. Implication: a "Mixed Drill" default can't rely on user enthusiasm — label needs explicit utility framing ("recommended for transfer").
- **Source:** https://link.springer.com/article/10.1007/s10648-024-09902-0

### 10. Hwang et al. (2025) — "Undesirable Difficulty of Interleaved Practice: Initial Blocked Practice for Declarative Knowledge in Low-Achieving Adolescents" (Language Learning)
- **Found Via:** Forward citation on Bjork seed; adversarial/boundary-condition counterpoint.
- **Key Finding:** Blocked → interleaved sequencing beats pure interleaved for low-achievers acquiring declarative rules. Relevance: beginner bridge learners may benefit from blocked single-module drills before the Mixed Drill default — argues for surfacing blocked "module focus" and interleaved "mixed" as co-equal options, not interleaved-by-default.
- **Source:** https://onlinelibrary.wiley.com/doi/10.1111/lang.12659

### 11. "Tailoring interleaved practice: Does adaptive sequencing boost the interleaving effect?" (Learning and Individual Differences, 2025)
- **Found Via:** Forward chain from Bjork + Jesse/Jannach.
- **Key Finding:** Across 259 participants, adaptive interleaving showed **no significant advantage** over random interleaving. Implication: a simple random-mixed-drill implementation is likely sufficient; elaborate adaptive-sequencing engineering is not justified by current evidence.
- **Source:** https://www.sciencedirect.com/science/article/pii/S1041608025001803

### 12. Santhosh et al. (2024) — Mobile flashcard RCT (Journal of Dental Education)
- **Found Via:** Adjacent forward search on SRS-trainer UX.
- **Key Finding:** 90-student RCT: mobile SRS beats lecture on 1- and 3-month retention. Notably, the app used a "due queue" entry point (Anki pattern), not a browse-first home. Supports the Chessable/Anki-style "review-due strip separate from browse" pattern for a bridge Practice hub.
- **Source:** https://onlinelibrary.wiley.com/doi/10.1002/jdd.13561

### 13. Sustainable Mobile Microlearning (MDPI Sustainability, 2025) — "Evaluating Learners' Perceptions and Learning Outcomes in IT Education"
- **Found Via:** Forward chain on Alhadreti & Elbahi 2023 mobile-learning SLR.
- **Key Finding:** Mobile microlearning outperforms standard mobile learning on retention and reduces fatigue when sessions are bounded (<10 min) and picker-screen complexity is kept low. Supports picker simplicity over feature richness.
- **Source:** https://www.mdpi.com/2071-1050/17/23/10860

### 14. UI Design Cognitive-Load Questionnaire for Mobile Learning Apps (2024)
- **Found Via:** Forward chain on Alhadreti & Elbahi.
- **Key Finding:** Validated instrument for measuring extraneous cognitive load from mobile-learning UI. Picker density, section-header count, and simultaneous progress signals are top load contributors. Useful for evaluating the Practice hub after redesign.
- **Source:** https://www.researchgate.net/publication/383832791

### 15. "Recommender systems to support learners' Agency in a Learning Context: a systematic review" (IJETHE, 2020; heavily cited 2022–2024)
- **Found Via:** Forward chain from Jameson + Kizilcec (dual seed).
- **Key Finding:** Recommender-agency SLR synthesizing ~30 studies: explicit "why this was recommended" + ability to override is the dominant pattern that preserves learner agency. Directly supports an explainable "Recommended next" slot with a clear dismiss.
- **Source:** https://educationaltechnologyjournal.springeropen.com/articles/10.1186/s41239-020-00219-w

### 16. LLM-based Explanations for Open Learner Model Dashboards (arXiv, 2025)
- **Found Via:** Forward chain on Jivet + open learner model thread.
- **Key Finding:** LLM-generated explanations for OLM state were preferred by teachers over human-authored ones on clarity and actionability. Hints at a viable path for the "why this module is recommended" copy in the Practice hub without hand-authoring per-bundle text.
- **Source:** https://arxiv.org/html/2511.11671v1

## Strategy Report

- **Seed papers used:** Duolingo path migration (2022 blog + 2024 whitepaper); Kizilcec SRL SLR; Jivet LAD SLR (2023); Jameson choice-architecture monograph + recommender paper (2014); Bjork/Kirk-Johnson desirable difficulties; Alhadreti & Elbahi mobile-learning UI SLR (2023).
- **Unique finds (not in seeds):** 16.
- **Notable clusters:**
  - **Post-path Duolingo research wave (2024–2025)** — three independent empirical studies corroborate the seed's "structure vs autonomy" tension with fresh data (#1, #2, #3).
  - **Jivet-cluster operationalizations (2023–2025)** — checklist (#4), meta-analysis (#5), AI-LAD SLR (#6), SRL-phase dashboard (#7) all converge on: visualize only if paired with a next-action recommendation.
  - **Interleaving boundary conditions (2024–2025)** — Deng MISQ field experiment (#8), Biwer metastrategic illusion (#9), Hwang low-achiever counter-evidence (#10), and the null adaptive-sequencing result (#11) together argue for: offer Mixed Drill prominently but not exclusively, keep the sequencing algorithm simple, and frame its utility explicitly.
  - **Cross-domain bridge to SRS UX (#12)** — only direct RCT evidence on a mobile SRS entry-point pattern; reinforces Anki "due queue" over browse-first.
- **Gaps reaffirmed:** Still no peer-reviewed study on a user-curated "saved drill playlist" specifically. The closest evidence remains adjacent (Li et al. 2024 on external self-management in Duolingo; recommender-agency SLR). The "saved practice set" hypothesis remains under-evidenced by direct empirical work — supported only by convergent analogue evidence.
- **Adversarial find worth flagging:** Hwang 2025 (#10) and the null adaptive-sequencing finding (#11) are the strongest caveats to a "make interleaved the default" stance — the Practice hub should default to Mixed Drill for intermediate users but expose single-module blocked practice as first-class, not buried.
