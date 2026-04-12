# Components

Svelte 5 UI components for the drill workflow. Consumer of stores, lib, and engine types.

## Conventions

- **Svelte 5 runes only.** `$state`, `$derived`, `$effect` — no legacy `$:` reactive statements
- **Named exports only.** No `export default` in any `.ts` file. Svelte components are the exception (implicit default).
- **Keyed `{#each}` blocks.** Every `{#each}` must have a key expression: `{#each items as item (item.id)}`
- **EnginePort boundary.** Components never import engine internals (`hand-evaluator`, `deal-generator`, `auction`, `scoring`, `play`). Import types from `engine/types.ts` and constants from `engine/constants.ts` only. Engine access goes through `EnginePort` via context.
- **Context for DI.** Engine, game store, and app store provided via Svelte context (set in AppReady.svelte, retrieved via `src/stores/context.ts` helpers).
- **Tailwind CSS + design tokens.** Tailwind utility classes augmented with CSS custom properties defined via `@theme` in `src/app.css`. Midnight Table dark theme. No `<style>` blocks in new components except for CSS that Tailwind can't express (e.g., HandFan overlap/rotation).
- **Typography tokens for game screens.** All text sizing in game-screen components uses `--text-*` CSS custom properties (via `text-[--text-label]` Tailwind syntax or `font-size: var(--text-label)`) instead of hardcoded Tailwind size classes (`text-xs`, `text-sm`, etc.). Token names defined in `app.css :root`.
- **Pure function extraction.** Complex logic extracted to `src/components/shared/` and `src/service/` for testability: `sortCards`, `computeTableScale` (shared/), `startDrill` (service/). `filterConventions` lives in `src/components/screens/filter-conventions.ts`.
- **Companion `.ts` files.** Components with non-trivial logic co-locate a PascalCase `.ts` file next to the `.svelte` file (e.g., `DecisionTree.ts` + `DecisionTree.svelte`). The `.ts` file holds pure functions and types; the `.svelte` file handles rendering. If a second component needs the same logic, move the `.ts` file to `components/shared/` or `teaching/`. Tests go in `__tests__/game/` with the original descriptive name (e.g., `DecisionTree.test.ts`).

## Typography & Layout

Game components MUST use `--text-*` tokens (ESLint enforced) and `--color-*` tokens instead of hardcoded Tailwind classes. See `docs/guides/typography-and-layout.md` for the full token system, responsive sizing, z-index hierarchy, and accessibility guidelines.

## Architecture

```
(routing via SvelteKit src/routes/)
  (app)/+layout.svelte               Client-only layout (ssr=false) — loads WASM, renders AppReady
  (content)/+layout.svelte            Prerendered layout for SEO pages (guides, learn)
AppReady.svelte                      Root app shell — creates engine/stores, sets context, nav chrome
components/
  screens/
    ConventionSelectScreen.svelte    Convention picker with search + category filter + 2-column responsive card grid. Practice buttons show lock state for non-premium bundles; PaywallOverlay opens on locked practice attempt.
    LearningScreen.svelte            Three-tab learning screen (Lessons | Conventions | Bidding Systems). Conventions tab = current reference view (sidebar lists modules filterable by bundle, main content shows conversation flow tree + module teaching + surfaces). Lessons and Bidding Systems are placeholders.
    MobileFlowTree.svelte            Compact vertical flow tree for mobile — collapsible card, recursive snippet, tap-to-expand accordion for detail (recommendation/disclosure/explanation/clauses)
    ConversationFlowTree.svelte      HTML/CSS flexbox tree visualization of module conversation flow — recursive snippets, CSS pseudo-element connectors, self-contained auto-scaling. Optional interactive mode (selectedNodeId + onNodeSelect props) for Workshop click-to-select.
    CoverageScreen.svelte            Coverage drill-down screen (bundle picker → targets) for testing convention correctness
    WorkshopScreen.svelte            System/convention/practice pack management — three-tab toggle (Systems, Conventions, Practice Packs). Conventions tab: ConventionFlowEditor (sidebar + flow tree canvas + detail panel). Hosts SystemEditor inline.
    ConventionEditorScreen.svelte    Convention parameter editor — rename + threshold editing for user-owned conventions. Back navigation returns to Workshop Conventions tab.
    PracticePackEditorScreen.svelte  Practice pack builder — name/description + convention selection via ModuleChecklist with reorder. Supports create blank, fork from bundle, and edit modes.
    convention-canvas/                    Interactive flow tree editor for convention management
      ConventionFlowEditor.svelte    Main orchestrator: 3-column layout (sidebar + ConversationFlowTree + detail panel), parameter persistence
      ModulePickerSidebar.svelte     Left sidebar: search + user modules + system library by category with fork/edit/delete
      NodeDetailPanel.svelte         Right slide-out: node metadata + ParameterPanel for user modules, fork prompt for system modules
    SystemEditor.svelte              Custom system editor — two-tab layout (Parameters | Modules). Parameters tab: 2-column grid (Bidding Structure+Competitive | Strength) with strength bars, point formulas, thresholds. Modules tab: full-width ModuleChecklist with search, category grouping, mutual exclusion in toggleModule(). Header with name input, preset select, error badge, save/cancel. Tab badge shows active module count.
    StrengthBar.svelte               Side-by-side NT/Trump strength bars showing weak/invite/game/slam zones with threshold labels and formula suffixes. Reactive to threshold prop changes.
    strength-bar.ts                  Companion: zone types, color constants, thresholdPct() pure function.
    profile-display.ts               Pure display logic for base-system reference: category definitions, value formatting (formatFieldValue, formatTrumpTpValue), comparison helpers. View components were removed; this module is currently only consumed by tests and will be revived when the Bidding Systems tab on LearningScreen is implemented.
    game-screen/
      GameScreen.svelte              Phase router + responsive layout + drill lifecycle (~280 LOC)
      BiddingPhase.svelte            Bidding phase template (pure — data via props). Shows context banner in Decision Drill mode.
      context-banner.ts              Pure function: buildContextSummary() — plain-English auction context for Decision Drill pre-filled bids
      DeclarerPromptPhase.svelte     Declarer/defender prompt (pure — data via props)
      PlayingPhase.svelte            Play phase template (pure — data via props, legal plays from parent)
      ExplanationPhase.svelte        Review phase: 3-column replay layout (with play data) or 2-column (passed out), card-by-card stepping, auction step-through. Defines tab content snippets (bidding/play/analysis) + action buttons passed to ReviewSidePanel.
      LearnPhase.svelte              Learn mode: step-through completed auction with all 4 hands visible. Uses ExplanationViewport data. BidAnnotationPopup shows meaning per bid. Keyboard nav (arrows/space/home/end).
      LearnSidePanel.svelte          Learn mode side panel: step indicator + prev/next/first/last nav buttons + New Deal + Back to Menu
      layout-props.ts                (moved to src/components/shared/layout-props.ts)
      BiddingSidePanel.svelte        BidPanel + BidFeedbackPanel + dev debug info
      PlaySidePanel.svelte           Contract, trick counts, restart play, skip-to-review
      ReviewSidePanel.svelte         Generic tabbed container: receives tab definitions (id, label, snippet) + actions snippet from parent
      review-helpers.ts              Pure format functions: formatVulnerability, formatResult (extracted from ReviewSidePanel)
      SettingsDialog.svelte          Reusable settings dialog (readonly prop for non-bidding phases)
      ContractDisplay.svelte         Formatted contract with doubled/redoubled indicators
      ScaledTableArea.svelte         Responsive table wrapper with transform-origin
  game/
    BidAnnotationPopup.svelte        Floating annotation card for Learn mode — shows seat + call + meaning/alert for the current bid step
    BridgeTable.svelte               800x650 table with 4 seats, absolute positioning
    HandFan.svelte                   Overlapping visual card fan (horizontal/vertical)
    TrickArea.svelte                 Center trick display with NSEW card positions and trick count
    TrickOverlay.svelte              Display-only trick overlay for review phase (supports partial visiblePlays)
    ReplayControls.svelte            Forward/back/jump navigation bar for review-phase card-by-card replay
    replay-state.ts                  Pure replay cursor logic: step↔position conversion, progressive reveal, decision point detection
    TrickReviewPanel.svelte          Trick-by-trick review panel with recommendation badges and trick stepper
    ConventionCardPanel.svelte       Convention card side drawer — format toggle (App accordion / ACBL bordered cards) via ToggleGroup. App mode: progressive disclosure. ACBL mode: 11 ACBL-standard sections, always visible, unavailable sections greyed out.
    AuctionTable.svelte              4-column N/E/S/W grid, suit-colored. `minimal` prop for compact play-history rendering (no legend/annotations).
    BidPanel.svelte                  5-col grid + specials row, compact mode, data-testid on buttons
    BidFeedbackPanel.svelte          Two-branch bid feedback (Correct/Acceptable green → BidFeedbackCorrect, NearMiss amber/Incorrect red → BidFeedbackIncorrect) with show-answer toggle, acceptable badges on siblings, optional practical note, convention contribution badges, WhyNot grade distinction, multi-rationale indicator, encoding explanation, partner hand space summary, elimination stage annotations
    BidFeedbackPanel.ts              Companion .ts file with convention-agnostic display helpers for TeachingProjection rendering: formatAmbiguity, formatEliminationStage, formatModuleRole, roleColorClasses, whyNotGradeClasses, isArtificialEncoder, formatEncoderKind, FeedbackVariant type, variantClass color lookup
    bid-feedback/
      BidFeedbackCorrect.svelte      Correct bid feedback — green flash with explanation + passed conditions (shown as non-blocking feedback for all correct/acceptable bids)
      BidFeedbackIncorrect.svelte    Incorrect/near-miss bid feedback panel with variant coloring (red incorrect, amber near-miss)
    RoundBidList.svelte              Shared round-by-round bid list (configurable expand state, expected result, test IDs, dimming/highlighting/click for stepping)
    AuctionStepPanel.svelte          Auction step-through panel: prev/next/show-all controls + RoundBidList with dim/highlight
    AuctionStepPanel.ts              Companion: computeVisibleSeats pure function for progressive hand reveal
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
      debug-helpers.ts               Formatting utilities (formatCall re-export, formatSuitCards, fmtFactValue, truncate)
  navigation/
    NavRail.svelte                   Thin left rail (~80px) — Home/Learn/Workshop (dev only)/Settings icons. Desktop only. Workshop gated behind FEATURES.workshop. Learn is direct navigation (no flyout).
    BottomTabBar.svelte              Mobile bottom tab bar — Home + Learn + Workshop (dev only) + Settings tabs. Mobile only. Workshop tab gated behind FEATURES.workshop.
  shared/
    Button.svelte                    Primary/secondary/ghost variants
    Card.svelte                      70x98 visual playing card
    CardSurface.svelte               Base visual card surface — centralizes bg/border/radius/transition tokens for all card-like elements. Props: as (div/section), radius (md/lg), class, testId. Re-theme all cards by changing this one file.
    ItemCard.svelte                  Interactive card wrapper for list items — button (onclick) or div, with selected/interactive states. Shares token pattern with CardSurface. Used by WorkshopScreen, ConventionSelectScreen.
    ScreenSection.svelte             Section wrapper with standardized h2 header + optional helper text + content snippet. Used by WorkshopScreen.
    Spinner.svelte                   Inline loading spinner (sm/md sizes)
    SectionHeader.svelte             Uppercase muted section heading (h2/h3)
    SettingsButton.svelte            Full-width settings gear button
    BidFeedbackShell.svelte          Variant-colored alert container for bid feedback
    ToggleGroup.svelte               Mutually-exclusive button group (outline/filled variants)
    NumberStepper.svelte             Horizontal [-] N [+] input with auto-repeat long-press, clamp, keyboard arrows
    NumberStepper.ts                 Pure helpers: clamp(), createAutoRepeat() for NumberStepper testability
    RangeStepper.svelte              Composes two NumberStepper instances with "to" separator and shared suffix
    AuthModal.svelte                 Native <dialog> auth modal — login (OAuth buttons) when logged out, account info (sign out, settings link) when logged in. Exports open()/close().
    PaywallOverlay.svelte            Native <dialog> upgrade prompt — shown when user tries to practice a locked bundle. Exports open()/close(). Subscribe button is a placeholder (no payment integration yet).
    module-catalog.ts                Single source of truth for module categorization: MODULE_CATEGORIES, CATEGORY_DISPLAY, CatalogModule, mergeModules(), groupByCategory(), filterModules(). Pure functions — no store/Svelte imports. All screens import from here.
    ModuleChecklist.svelte           Shared collapsible checkbox grid for module selection: search, collapsible category sections, count badges. User modules shown under "My Conventions" section separated from system modules. Used by SystemEditor and PracticePackEditorScreen.
  __tests__/
    ButtonTestWrapper.svelte         Snippet wrapper for Button tests
    BridgeTableTestWrapper.svelte    Snippet wrapper for BridgeTable tests
    shared/                          Shared component tests
    game/                            Game component tests
    screens/                         Screen component tests
```

**Screen flow:** SvelteKit `(app)/+layout.svelte` owns the full app layout — loads WASM, renders `AppReady.svelte` which provides context setup + nav chrome. File-based routing replaces store-driven screen routing. All screens (including GameScreen) are wrapped by the nav layout. Desktop: thin left rail (NavRail) with Home/Learn/Workshop (dev only)/Settings icons. Learn navigates directly to Learning screen. Mobile: bottom tab bar (BottomTabBar) with Home/Learn/Workshop (dev only)/Settings tabs (3 tabs in production, 4 in dev). Workshop tab is the home for system/convention/practice pack management, gated behind `FEATURES.workshop`. `?profiles=true` backward compat alias redirects to `/workshop`. Conventions tab shows an inline flow editor (ConventionFlowEditor): left sidebar with module picker, center flow tree (shared ConversationFlowTree in interactive mode), right slide-out panel for node parameter editing. Workshop = management (fork, edit, delete, configure). Learn = study (teaching content, flow trees, surfaces).

**Props pattern:** Game/shared components receive data as props. Screen components read stores from context.

**Design tokens:** Suit colors use 4-color scheme — card-face colors differ from on-dark-bg colors. See `src/components/shared/tokens.ts`.

## Gotchas

- **Node-to-surface matching uses `FlowTreeNode.meaningId`.** Do not parse the `id` field format (`"{moduleId}:{meaningId}:{idx}"`) — it is an internal Rust detail. Use the explicit `meaningId` field.
- **System modules are read-only on canvas.** User must fork before editing parameters.
- **Layout sizing is JS-driven.** GameScreen is the single source of truth for all layout dimensions. `availableW` (viewport minus debug panel) feeds `rootFontSize`, `sidePanelW`, and `tableScale`. These are set as inline CSS variables (`--width-side-panel`, `--game-scale`, `--panel-font`) on `<main>`. **Do NOT define layout sizing variables in `app.css` with `vw`/`%` units** — they won't account for panels that steal viewport space (e.g., the debug drawer). If you need a new layout-dependent variable, derive it from `availableW` in GameScreen and set it inline.
- **Viewport lock & scroll:** The `(app)` layout wraps its content in `h-screen overflow-hidden` so the window never scrolls during game phases. `AppShell`'s `.shell-main` is `height: 100%` + `overflow-y: auto` — this is the primary scroll container for both `(app)` and `(content)` routes (guides, learn, learning). Game screens fit the viewport exactly so `.shell-main` has no scrollbar; long content pages scroll inside it. Global `html`/`body`/`#app` set `height: 100%` only (no `overflow: clip`).
- **Autoplay effect:** GameScreen has a DEV-only `$effect` for `?dev=autoplay` that uses `requestAnimationFrame` to defer actions per frame (not `tick()` which causes infinite microtask loops, not `setTimeout` which is a real timer).
- **Store methods:** `userBid`, `userPlayCard`, `retryBid`, `skipToReview` return `void` (safe for onclick). `startDrillFromHandle` returns a Promise. `startNewDrill` returns void (fire-and-forget, guarded).
- **Never construct Tailwind class names via string interpolation** — JIT purges dynamically built strings. Use complete literal class strings in lookup Records (see BidFeedbackShell.svelte and ToggleGroup.svelte).
- **Lifecycle action buttons** must bind `disabled` to `gameStore.isTransitioning`. Primary action per phase shows a spinner when transitioning (Next Deal in review, Restart Play in playing, New Deal in bidding).
- **Learn mode auto-skip lifecycle:** GameScreen has a `$effect` that calls `skipToPhase("review")` when `practiceMode === Learn && phase === BIDDING && isInitialized`. This fires on mount and after each New Deal. Do NOT add Learn mode logic to the existing onMount block.
- GameScreen routes phases to extracted pure components (BiddingPhase, DeclarerPromptPhase, PlayingPhase, ExplanationPhase, LearnPhase). GameScreen owns the legal-plays `$effect`.
- BiddingPhase receives `BiddingViewport` as prop — never accesses raw `Deal` or engine internals. Viewport builders live in `src/service/`.
- DeclarerPromptPhase receives `DeclarerPromptViewport` as prop — never accesses raw `Deal`. Hands filtered through faceUpSeats.
- PlayingPhase receives `PlayingViewport` as prop — never accesses raw `Deal`. Hands filtered through faceUpSeats.
- ExplanationPhase receives `ExplanationViewport` as prop — all 4 hands via `allHands`, no raw `Deal`. Owns `replayStep` state; `PlayHistoryPanel`, `TrickOverlay`, and `TrickReviewPanel` are all controlled by derived values from this single state. Per-card stepping (not per-trick) surfaces individual decision points.
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

**Staleness anchor:** This file assumes `AppReady.svelte` exists in `src/`. If it doesn't, this file
is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-02-21 | last-audited=2026-04-11 | version=14 | dir-commits-at-audit=20 | tree-sig=dirs:10,files:50,exts:svelte:34,ts:15,md:1 -->
