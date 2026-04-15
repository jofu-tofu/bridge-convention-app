# Research Question

## Core Question
What should the Practice tab (convention-select screen) of a bridge bidding practice app look and behave like, given that it is no longer the app's landing page and that its primary job is helping users browse/pick a convention to drill — with a secondary "saved drills" or "resume" concept layered alongside?

## Key Concepts
- practice hub / skill-select screen: exercise picker, drill selector, module library, practice dashboard, training hub
- browse vs resume intent: discovery vs continuation, cold start vs warm start, explore vs resume, entry point design
- skill-based drilling: deliberate practice, microlearning, spaced drill, targeted practice, skill trees
- saved configurations / custom drills: playlists, decks, custom sets, bookmarks, saved filters, presets
- progress signaling at pick-time: mastery indicators, review-due badges, weakness surfacing, recommendation

## Native Field
HCI / UX design for learning and practice software; educational technology.

## Adjacent Fields
- **Chess training UX** (Chessable, Lichess studies, chess.com puzzles/trainers): closest structural analogue — pick a module, drill, track mastery, save custom sets.
- **Language learning apps** (Duolingo, Anki, Memrise, Babbel): skill-tree vs spaced-review vs custom-deck models for "what do I practice next?"
- **Coding practice platforms** (LeetCode, Exercism, Codewars, HackerRank): topic-based browse + resume + saved lists + recommendation.
- **Cognitive psychology of deliberate practice & desirable difficulty**: Ericsson, Bjork — informs whether to recommend or let user browse.
- **Recommender systems / choice architecture**: paradox of choice, default effects, progress dashboards — informs layout (grid vs list vs sectioned).

## Local Context Found
- **App architecture:** SvelteKit practice app. Game routes live under `(app)/` layout group; content under `(content)/`. Convention bundles (nt-bundle, bergen-bundle, weak-twos-bundle, dont-bundle, michaels-unusual-bundle, strong-2c-bundle, negative-doubles-bundle, nmf-bundle) selected via `?convention=<id>`.
- **Landing already exists:** A dedicated logged-in landing page was recently added (commit dcc0e79). The Practice tab is no longer the first thing users see, so it should stop carrying landing-page affordances (marketing hero, quick actions, "your systems" panels) and become a focused picker.
- **Existing related research:** `docs/research/ftue-and-seo/` (first-visit audit), `docs/research/learn-mode-pedagogy/` (pedagogy evidence), `docs/research/seo-principles-web-apps/` (SEO evidence map). No prior research specifically on the practice-hub / convention-select surface.
- **Product direction:** Free tier = learn; paid tier = practice (see `docs/product/product-direction.md`). So the Practice tab is also a conversion surface for some visitors.
- **Personas:** `docs/product/personas/` — intermediate club players learning a new system, students studying a specific convention before a lesson. They arrive knowing which convention they want to drill more often than not, but also benefit from "what should I work on next?" nudges.
- **Session & modes:** Practice modes include `decision-drill`, `full-auction`, `learn`; roles `opener`/`responder`/`both`. Currently selected per-session via URL params or UI on the convention-select screen — a candidate for "saved drill" persistence.
- **Future workshop:** `workshop` is a dev-only feature flag for a fuller custom-system builder. Any "custom drill" design should cleanly extend to workshop without needing rework.
- **Convention catalog:** ~8 bundles today, organized in `module-catalog.ts` via `MODULE_CATEGORIES` (single source of truth for all screens). Small enough to show all at once; large enough that sectioning helps.

## Design Pressures to Resolve
1. **Browse-first vs resume-first layout:** landing handles resume, so Practice can lean browse — but how strongly?
2. **Flat grid vs categorized sections:** 8 bundles is borderline; do users want them grouped (1NT family / competitive / slam) or flat?
3. **Saved drills as a side panel vs a separate tab:** user floated both. Which do comparable apps choose, and why?
4. **Config at pick-time vs per-drill:** mode (decision-drill / full-auction) and role (opener / responder) — set once as a "drill preset" or chosen each session?
5. **Progress signaling without nagging:** surface weakness/mastery without making the page feel like a dashboard (landing's job).
6. **Paywall/preview handling:** practice is gated — how do comparable apps present locked content without killing browse flow?
