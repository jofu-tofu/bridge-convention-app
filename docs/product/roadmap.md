# Roadmap

## Completed Phases

1. DDS Review Integration
2. Rule Tree Migration (1.5a-c)
3. Bridge Bum Test Audit (1.6a-f)
4. Rules Tab (2a)
5. WASM Engine + Vercel Deployment
6. DDS Browser WASM Integration
7. Multi-Round Semantic Protocols with seatFilter (Stayman/Bergen/Weak Twos/Lebensohl Lite)
8. Convention Suite Overhaul — drop Gerber/Landy, add Weak Twos, then drop DONT/Michaels/Negative Doubles
9. Full IntentNode Migration + BidNode Removal
10. Competitive Auction Hardening (5a-5d) — all 9 gaps closed
11. Boundary Hardening (6) — 10 gaps across 5 phases
12. Architectural Gap Resolution (7a-7e)
13. Decision Model Architectural Gap Resolution (8a-8f)
14. Decision Model Audit Gap Resolution (8a-8f)
15. Teaching Resolution Layer (9a-9b)
16. Practical Bidder Layer (Phases 0-5)
17. Subscription Billing + Paid Content Access (2026-04-12)

**Additional completions:** Practice-tab redesign Phases 1-3 shipped. Phase 3 unified saved drills, folded packs into `Drill{moduleIds[]}`, and moved launch-time settings onto `/practice`; see `docs/product/practice-tab.md`. Continuation Composition Phases 4-6. Posterior Engine Consumer Migration (Phase 4B) — deprecated types removed. All 4 bundles (NT, Bergen, Weak Twos, DONT) on unified ConventionModule with per-step kernel threading. Old tree/protocol/overlay pipeline and FSM infrastructure fully removed. Dead CandidateTransform system removed. Multi-system backend wired (SAYC, 2/1, Acol base profiles). CLI `--system` flag live.

**Practice-tab redesign decisions (Phase 3):**
- D1: Packs folded into the unified `Drill` model instead of keeping a separate pack type. See `docs/product/practice-tab.md`.
- D2: Role control ships as `Auto / Opener / Responder / Both`, with `Auto` resolving from `defaultRole`. See `docs/product/practice-tab.md`.
- D3: Mode/role/system/opponents/play skill/annotations all live on `/practice`, not split with `/settings`. See `docs/product/practice-tab.md`.
- D4: Game phases show no read-only settings strip; launch metadata stays off the in-game shell. See `docs/product/practice-tab.md`.

## Upcoming (all blocked on design work or specs)

1. **User Learning Enhancements** — learning screen needs rebuild + design spec.
2. **Difficulty Configuration** — play profiles implemented (beginner/club-player/expert), UI selector needed. Blocked on UI design spec.
3. **Convention Migration** — Lebensohl (blocked on relay encoding spec), Negative Doubles (blocked on host-attachment exercise), SAYC (full base system).
4. **Deal Review** — surface a browsable table of past deals so users can revisit hands they played, with filters (convention, role, system, outcome, date). Today drill state is ephemeral; nothing persists per-deal history. Minimum scope includes step-through auction replay (walk the bidding sequence with each bid's meaning/projection at that turn) and, if trick play gets persisted, card-by-card play replay. Stretch scope: external hand import (PBN/LIN or pasted deal) so users can analyze auctions they played elsewhere against the app's decision model. Blocked on: (a) DataPort schema for per-deal records, (b) viewport snapshot/serialization decision (full hand replay vs summary), (c) UI design spec for the table + filter chrome, (d) import-format parser scope if external-hand import is in scope.
5. **Workshop Completion** — finish the workshop flow so users can author their own conventions, either from scratch or by forking an existing one as a starting reference. Anchor: `feedback_workshop_config_direction.md` (derived UI, auto-generated explanations, extensible base system, custom surfaces yes, author-curated variants). Blocked on: (a) authoring-UI design spec, (b) fork/derivation semantics (deep copy vs override layer), (c) persistence/sharing model — local-only vs DataPort-backed user library.
6. **Convention Library Expansion** — add more conventions beyond the current set (Stayman, Bergen, Weak Twos, DONT, plus migration items above). Per-convention work follows `docs/guides/convention-authoring.md`; each addition needs a learn page, fixtures, and CLI selftest pass.
7. **Tutorial Mode** — guided walkthrough mode for every convention that teaches the convention interactively (step-by-step worked examples, narrated decision points) rather than dropping the user straight into drill mode. Distinct from learn pages (read-only) and practice (open-ended drill). Blocked on: tutorial-mode UX spec and per-convention tutorial content authoring.
