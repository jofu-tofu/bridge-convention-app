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

**Additional completions:** Continuation Composition Phases 4-6. Posterior Engine Consumer Migration (Phase 4B) — deprecated types removed. All 4 bundles (NT, Bergen, Weak Twos, DONT) on unified ConventionModule with per-step kernel threading. Old tree/protocol/overlay pipeline and FSM infrastructure fully removed. Dead CandidateTransform system removed. Multi-system backend wired (SAYC, 2/1, Acol base profiles). CLI `--system` flag live.

## Upcoming (all blocked on design work or specs)

1. **User Learning Enhancements** — learning screen needs rebuild + design spec.
2. **Difficulty Configuration** — play profiles implemented (beginner/club-player/expert), UI selector needed. Blocked on UI design spec.
3. **Convention Migration** — Lebensohl (blocked on relay encoding spec), Negative Doubles (blocked on host-attachment exercise), SAYC (full base system).
