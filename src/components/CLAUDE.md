# Components

Svelte 5 UI components for the drill workflow. Consumer of stores, lib, and engine types.

## Conventions

- **Svelte 5 runes only.** `$state`, `$derived`, `$effect` — no legacy `$:` reactive statements
- **Named exports only.** No `export default` in any `.ts` file. Svelte components are the exception (implicit default).
- **Keyed `{#each}` blocks.** Every `{#each}` must have a key expression: `{#each items as item (item.id)}`
- **EnginePort boundary.** Components never import engine internals (`hand-evaluator`, `deal-generator`, `auction`, `scoring`, `play`). Import types from `engine/types.ts` and constants from `engine/constants.ts` only. Engine access goes through `EnginePort` via context.
- **Context for DI.** Engine, game store, and app store provided via Svelte context (set in App.svelte, retrieved via `src/stores/context.ts` helpers).
- **Tailwind CSS + design tokens.** Tailwind utility classes augmented with CSS custom properties defined via `@theme` in `src/app.css`. Midnight Table dark theme. No `<style>` blocks in new components except for CSS that Tailwind can't express (e.g., HandFan overlap/rotation).
- **Typography tokens for game screens.** All text sizing in game-screen components uses `--text-*` CSS custom properties (via `text-[--text-label]` Tailwind syntax or `font-size: var(--text-label)`) instead of hardcoded Tailwind size classes (`text-xs`, `text-sm`, etc.). Token names defined in `app.css :root`.
- **Pure function extraction.** Complex logic extracted to `src/components/shared/` and `src/service/` for testability: `sortCards`, `computeTableScale` (shared/), `startDrill` (service/). `filterConventions` lives in `src/components/screens/filter-conventions.ts`.
- **Companion `.ts` files.** Components with non-trivial logic co-locate a PascalCase `.ts` file next to the `.svelte` file (e.g., `DecisionTree.ts` + `DecisionTree.svelte`). The `.ts` file holds pure functions and types; the `.svelte` file handles rendering. If a second component needs the same logic, move the `.ts` file to `components/shared/` or `teaching/`. Tests go in `__tests__/game/` with the original descriptive name (e.g., `DecisionTree.test.ts`).

## Typography & Layout

Game components MUST use `--text-*` tokens (ESLint enforced) and `--color-*` tokens instead of hardcoded Tailwind classes. See `docs/typography-and-layout.md` for the full token system, responsive sizing, z-index hierarchy, and accessibility guidelines.

## Architecture

```
App.svelte                           Root — creates engine/stores, sets context, routes screens
components/
  screens/
    ConventionSelectScreen.svelte    Convention picker with search + category filter + learn buttons
    LearningScreen.svelte            Module-centric learning screen: sidebar lists modules (filterable by bundle), main content shows module teaching (principle/tradeoff/mistakes) + surfaces grouped by conversation phase
    CoverageScreen.svelte            Coverage drill-down screen (bundle picker → targets) for testing convention correctness
    ProfilesScreen.svelte            Read-only base system profiles (SAYC/2-1/Acol) with detail + compare views
    SystemDetailView.svelte          Single-system detail view — iterates profile categories as cards
    SystemCompareView.svelte         Side-by-side 4-column comparison table with diff highlighting
    profile-display.ts               Pure display logic: category definitions, value formatting, comparison helpers
    game-screen/
      GameScreen.svelte              Phase router + responsive layout + drill lifecycle (~280 LOC)
      BiddingPhase.svelte            Bidding phase template (pure — data via props)
      DeclarerPromptPhase.svelte     Declarer/defender prompt (pure — data via props)
      PlayingPhase.svelte            Play phase template (pure — data via props, legal plays from parent)
      ExplanationPhase.svelte        Review phase with showAllCards toggle
      layout-props.ts                (moved to src/components/shared/layout-props.ts)
      BiddingSidePanel.svelte        BidPanel + BidFeedbackPanel + dev debug info
      PlaySidePanel.svelte           Contract, trick counts, skip-to-review
      ReviewSidePanel.svelte         Tabbed review: Bidding + Analysis, next deal / back to menu
      ContractDisplay.svelte         Formatted contract with doubled/redoubled indicators
      ScaledTableArea.svelte         Responsive table wrapper with transform-origin
  game/
    BridgeTable.svelte               800x650 table with 4 seats, absolute positioning
    HandFan.svelte                   Overlapping visual card fan (horizontal/vertical)
    TrickArea.svelte                 Center trick display with NSEW card positions and trick count
    ConventionCard.svelte            Phase-independent convention card showing system thresholds (NT range, major length, forcing level)
    AuctionTable.svelte              4-column N/E/S/W grid, suit-colored
    BidPanel.svelte                  5-col grid + specials row, compact mode, data-testid on buttons
    BidFeedbackPanel.svelte          Three-branch bid feedback (Correct green/Acceptable teal/Incorrect red) with show-answer toggle, tree fork display, acceptable badges on siblings, optional amber practical note, convention contribution badges, WhyNot grade distinction, multi-rationale indicator, meaning landscape section, encoding explanation, partner hand space summary, elimination stage annotations
    BidFeedbackPanel.ts              Companion .ts file with convention-agnostic display helpers for TeachingProjection rendering: formatAmbiguity, formatEliminationStage, formatModuleRole, roleColorClasses, whyNotGradeClasses, isArtificialEncoder, formatEncoderKind
    bid-feedback/
      BidFeedbackIncorrect.svelte    Incorrect bid feedback panel (integrates ParseTreePanel)
      BidFeedbackNearMiss.svelte     Near-miss bid feedback panel (integrates ParseTreePanel)
      ParseTreePanel.svelte          Post-bid decision chain visualization — shows which convention modules were considered, accepted, or eliminated, with per-module conditions and verdicts (selected/applicable/eliminated)
    RoundBidList.svelte              Shared round-by-round bid list (configurable expand state, expected result, test IDs)
    BiddingReview.svelte             Thin wrapper over RoundBidList (expanded siblings, shows expected)
    MakeableContractsTable.svelte    5x4 DDS tricks grid (NT/S/H/D/C × N/E/S/W)
    AnalysisPanel.svelte             DDS analysis: makeable table + actual-vs-optimal + par score
    DecisionTree.svelte              Interactive expand/collapse tree with depth modes (compact/study/learn) for progressive teaching disclosure
    DeclarerPrompt.svelte            Declarer/defender choice buttons (used by DeclarerPromptPhase)
    DebugDrawer.svelte               Full-lifecycle debug overlay (dev only) — groups sections into Context / Decision Pipeline / Feedback & History
    debug/
      DebugSection.svelte            Reusable collapsible section with count badges, inline preview, nested support
      DebugAtAGlance.svelte          Always-visible summary card (state, expected bid, grade, pipeline stats)
      DebugDealInfo.svelte           Convention, seed, dealer, vulnerability, phase
      DebugAllHands.svelte           Compact single-line-per-seat hand display with HCP
      DebugConventionMachine.svelte  Machine state registers + collapsible history/transitions/diagnostics
      DebugHandFacts.svelte          Evaluated facts table
      DebugProvenance.svelte         Decision provenance with collapsible sub-sections
      DebugPipeline.svelte           Arbitration results with collapsible matched/eliminated/why-not
      DebugPosterior.svelte          Posterior summary with collapsible fact values
      DebugSuggestedBid.svelte       Selected bid with metadata
      DebugTeaching.svelte           Bid grading feedback with collapsible alternatives
      DebugPublicBeliefs.svelte      Per-seat belief ranges with collapsible annotations
      DebugBidLog.svelte             Collapsible per-entry bid history
      DebugPlayLog.svelte            Card play history by trick
      debug-helpers.ts               Formatting utilities (fmtCall, formatSuitCards, fmtFactValue, truncate)
  navigation/
    NavRail.svelte                   Thin left rail (~80px) — Home/Learn (hover flyout)/Settings icons. Desktop only. Uses shared learn-sub-items.
    NavFlyout.svelte                 Hover flyout menu for NavRail — positioned right of rail icon, keyboard accessible.
    BottomTabBar.svelte              Mobile bottom tab bar — Home + Learn + Settings tabs. Mobile only.
    LearnSubNav.svelte               Mobile segmented control — Conventions/Systems tabs shown when Learn section is active. Mobile only.
    learn-sub-items.ts               Shared factory for learn sub-navigation items (used by NavRail flyout and LearnSubNav).
  shared/
    Button.svelte                    Primary/secondary/ghost variants
    Card.svelte                      70x98 visual playing card
    ConventionCallout.svelte         Rule badge + explanation
  __tests__/
    ButtonTestWrapper.svelte         Snippet wrapper for Button tests
    BridgeTableTestWrapper.svelte    Snippet wrapper for BridgeTable tests
    shared/                          Shared component tests
    game/                            Game component tests
    screens/                         Screen component tests
```

**Screen flow:** AppShell owns the full app layout — context setup + nav chrome + screen routing. All screens (including GameScreen) are wrapped by the nav layout. Desktop: thin left rail (NavRail) with Learn/Settings icons + hover flyout for Learn sub-items. Mobile: bottom tab bar (BottomTabBar) + segmented control (LearnSubNav) when Learn section is active. Both use shared `learn-sub-items.ts` for Conventions/Systems sub-navigation.

**Props pattern:** Game/shared components receive data as props. Screen components read stores from context.

**Design tokens:** Suit colors use 4-color scheme — card-face colors differ from on-dark-bg colors. See `src/components/shared/tokens.ts`.

## Gotchas

- **Layout sizing is JS-driven.** GameScreen is the single source of truth for all layout dimensions. `availableW` (viewport minus debug panel) feeds `rootFontSize`, `sidePanelW`, and `tableScale`. These are set as inline CSS variables (`--width-side-panel`, `--game-scale`, `--panel-font`) on `<main>`. **Do NOT define layout sizing variables in `app.css` with `vw`/`%` units** — they won't account for panels that steal viewport space (e.g., the debug drawer). If you need a new layout-dependent variable, derive it from `availableW` in GameScreen and set it inline.
- **Viewport lock:** `html`, `body`, `#app` use `overflow: clip` in `app.css` to prevent page-level scrolling. Side panels scroll internally.
- **Autoplay effect:** GameScreen has a DEV-only `$effect` for `?autoplay=true` that uses `requestAnimationFrame` to defer actions per frame (not `tick()` which causes infinite microtask loops, not `setTimeout` which is a real timer).
- **Store methods:** `userBid`, `userPlayCard`, `retryBid`, `skipToReview` return `void` (safe for onclick). `startDrillFromHandle` returns a Promise.
- GameScreen routes phases to extracted pure components (BiddingPhase, DeclarerPromptPhase, PlayingPhase, ExplanationPhase). GameScreen owns the legal-plays `$effect`.
- BiddingPhase receives `BiddingViewport` as prop — never accesses raw `Deal` or engine internals. Viewport builders live in `src/service/`.
- DeclarerPromptPhase receives `DeclarerPromptViewport` as prop — never accesses raw `Deal`. Hands filtered through faceUpSeats.
- PlayingPhase receives `PlayingViewport` as prop — never accesses raw `Deal`. Hands filtered through faceUpSeats.
- ExplanationPhase receives `ExplanationViewport` as prop — all 4 hands via `allHands`, no raw `Deal`.
- BridgeTable/TrickArea accept `rotated` prop — uses `viewSeat()` from `src/components/shared/seat-mapping.ts`, not CSS rotation.
- `BidPanel` renders all 35 bids + 3 specials; unavailable bids disabled, not hidden. `data-testid="bid-{callKey}"` on all.
- User seat hardcoded to `Seat.South` — future: configurable.
- Dev-mode seeded RNG via `appStore.devSeed`; seed advances per deal.

---

## Context Maintenance

**After modifying files in this directory:** scan the entries above — if any claim is now
false or incomplete, update this file before ending the task. Do not defer.

**Add** an entry only if an agent would fail without knowing it, it is not obvious from
the code, and it belongs at this scope (project-wide rule → root CLAUDE.md; WHY decision
→ inline comment or ADR; inferable from code → nowhere).

**Remove** any entry that fails the falsifiability test: if removing it would not change
how an agent acts here, remove it. If a convention here conflicts with the codebase,
the codebase wins — update this file, do not work around it. Prune aggressively.

**Track follow-up work:** After modifying files, evaluate whether changes create incomplete
work or break an assumption tracked elsewhere. If so, create a task or update tracking before ending.

**Staleness anchor:** This file assumes `App.svelte` exists in `src/`. If it doesn't, this file
is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-02-21 | last-audited=2026-03-22 | version=12 | dir-commits-at-audit=20 | tree-sig=dirs:10,files:50,exts:svelte:34,ts:15,md:1 -->
