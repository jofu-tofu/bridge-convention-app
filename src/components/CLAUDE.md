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

## Screen Primitives

Every screen wraps in one of two outer primitives (tokens in `src/app.css` under `--screen-*`):

- `shared/AppScreen.svelte` — for `(app)` routes. Owns its own inner scroll container (`.app-screen__body { overflow-y: auto }`), so individual screens no longer need the `h-full flex flex-col p-4 pb-0` pattern. Props: `title?`, `subtitle?`, `width: "wide" | "form" | "custom"`, `actions?` / `tabs?` snippets, `scroll?`, `contentClass?`.
- `shared/ContentScreen.svelte` — for `(content)` prerendered routes. Scrolls at the `AppShell` main level (not internally). Preserves the desktop rail offset (`margin-inline-start: calc(var(--rail-width) + 1rem)` at `min-width: 1024px`). Props: `title?`, `subtitle?`, `width: "wide" | "narrow" | "reference"` (`reference` is left-aligned and wider for `/learn/[moduleId]` pages), `actions?` / `aside?` snippets.

Two sibling primitives, not one universal wrapper: the overflow chains differ enough that a prop-gated branch would be harder to reason about. See `docs/guides/gotchas.md#screen-layout-primitives`. New `(content)` route authors must wrap the page with `ContentScreen`; new `(app)` screens with `AppScreen`. `GameScreen` is an intentional exception (custom table-scale layout).

## Architecture

```
(routing via SvelteKit src/routes/)
  (app)/+layout.svelte               Client-only layout (ssr=false) — loads WASM, renders AppReady
  (content)/+layout.svelte            Prerendered layout for SEO pages (guides, learn)
AppReady.svelte                      Root app shell — creates engine/stores, sets context, nav chrome
components/
  screens/
    ConventionSelectScreen.svelte    search + category-sectioned card grid (sections derived from `ConventionCategory` enum order). Practice-only surface: no Learn buttons, no Continue strip (those live on the logged-in landing). Practice buttons show lock state for non-paid bundles; PaywallOverlay opens on locked practice attempt. Desktop renders `QuickPracticeSettingsPanel` as a non-scrolling right rail (`AppScreen` uses `scroll={false}` + `contentClass="flex flex-col"`; the grid fills the body via `flex-1 min-h-0` and only the convention-list column has `overflow-y-auto`); mobile exposes it through a vertical "Settings" tab button pinned to the right edge that opens the panel in a right-side slide-out drawer with scrim. Renders `SavedDrillsShelf` above category sections; each card exposes a `⋯` link to `/practice/drills/new?convention=<id>` plus a descriptive role badge from `convention.defaultRole`. All launch paths on this screen route through `appStore.applyDrillSession()` so session state changes do not persist to practice preferences.
    QuickPracticeSettingsPanel.svelte `/practice` side settings panel — defaults for ad-hoc convention-picker (Quick Practice) sessions only. Mode, role (Auto/Opener/Responder/Both), system, opponents, play skill, and educational annotations. Saved drills are independent of these values; launching a saved drill never reads from this panel. Reuses `ToggleGroup`, `SectionHeader`, and the existing settings-screen custom-system picker pattern. Reads/writes through `appStore`.
    SavedDrillsShelf.svelte          Horizontal chip strip of saved single-module drills (MRU). Hidden when empty. Each chip: click to launch (`onLaunch`), `⋯` opens menu (Launch / Rename / Edit configuration / Delete). Data from `getDrillsStore()`, filtered to `moduleIds.length === 1`.
    DrillForm.svelte                 Shared create/edit drill form used by `/practice/drills/new` and `/practice/drills/[id]/edit`. Default shape is single-convention (one chip + a `shared/ConventionPicker` popover); a subordinate "+ Add another convention" affordance opens an additional picker for round-robin multi-module drills. Create mode starts with no chips — users pick a convention via the popover. Edit mode hydrates all of an existing drill's `moduleIds` as chips (so multi-drills are not silently truncated). Top-of-form sections (always visible, in order): Name, Conventions, Mode, Role. Secondary sections (System, Opponents, Play Skill, Vulnerability via `shared/VulnerabilityPicker`, Educational Annotations) live behind a single native `<details>` "Advanced" disclosure (`data-testid="drill-form-advanced"`) — closed by default in create mode, open by default in edit mode. Once the user toggles the disclosure, the browser owns its state. If submit produces a `vulnError` (or any future advanced-section error), the disclosure auto-expands so the error is visible. Save buttons disable while `drillsStore.isSaving` and on `mutationsDisabled` (auth-load-error). Locked modules render greyed-out inside the picker with a "Subscribe to unlock" hint; submit blocks with an inline `Subscribe to add: …` error + pricing link if any selected moduleId is locked, and surfaces server `convention_locked` (DrillEntitlementError) the same way. Save and Save & Launch route through `appStore.applyDrillSession()`. New-drill defaults seed from current Quick Practice prefs; values then live entirely on the saved drill.
    CoverageScreen.svelte            Coverage drill-down screen (bundle picker → targets) for testing convention correctness
    WorkshopScreen.svelte            System/convention management — two-tab toggle (Systems, Conventions). Hosts SystemEditor inline.
    ConventionEditorScreen.svelte    Convention parameter editor — rename + threshold editing for user-owned conventions. Back navigation returns to Workshop Conventions tab.
    SystemEditor.svelte              Custom system editor — two-tab layout (Parameters | Modules). Parameters tab: 2-column grid (Bidding Structure+Competitive | Strength) with strength bars, point formulas, thresholds. Modules tab: full-width ModuleChecklist with search, category grouping, mutual exclusion in toggleModule(). Header with name input, preset select, error badge, save/cancel. Tab badge shows active module count.
    StrengthBar.svelte               Side-by-side NT/Trump strength bars showing weak/invite/game/slam zones with threshold labels and formula suffixes. Reactive to threshold prop changes.
    strength-bar.ts                  Companion: zone types, color constants, thresholdPct() pure function.
    profile-display.ts               Pure display logic for base-system reference: category definitions, value formatting (formatFieldValue, formatTrumpTpValue), comparison helpers. View components were removed; this module is currently only consumed by tests and will be revived when the Bidding Systems tab on LearningScreen is implemented.
    game-screen/
      GameScreen.svelte              Phase router + responsive layout + drill lifecycle (~280 LOC)
      BiddingPhase.svelte            Bidding phase template (pure — data via props). Shows context banner in Decision Drill mode. Renders two layouts based on viewport width: desktop (lg+) uses the scaled BridgeTable + BiddingSidePanel; mobile stacks auction + South HandFan (sized to fit container width via inline `--card-*` CSS vars) + inline BidPanel/feedback + New Deal. The mobile branch reserves `pb-14` for the sticky BottomTabBar which overlays the last ~56px of shell-main.
      context-banner.ts              Pure function: buildContextSummary() — plain-English auction context for Decision Drill pre-filled bids
      DeclarerPromptPhase.svelte     Declarer/defender prompt (pure — data via props)
      PlayingPhase.svelte            Play phase template (pure — data via props, legal plays from parent)
      ExplanationPhase.svelte        Review phase: 2-column replay layout (table + review panel), card-by-card stepping, auction step-through. Playthrough history lives inside the Cardplay tab instead of a separate desktop left rail. Hand visibility is an explicit `ToggleGroup` (All hands / Mine only) at the top of the bidding tab — fully decoupled from auction stepping. Stepping only slices the AuctionTable in the table center. Defines tab content snippets (bidding/play/analysis) + action buttons passed to ReviewSidePanel.
      LearnPhase.svelte              Learn mode: step-through completed auction with all 4 hands visible. Uses ExplanationViewport data. BidAnnotationPopup shows meaning per bid. Keyboard nav (arrows/space/home/end).
      LearnSidePanel.svelte          Learn mode side panel: step indicator + prev/next/first/last nav buttons + New Deal + Back to Menu
      layout-props.ts                (moved to src/components/shared/layout-props.ts)
      BiddingSidePanel.svelte        BidPanel + BidFeedbackPanel + new-deal lifecycle action
      PlaySidePanel.svelte           Contract, trick counts, restart play, skip-to-review
      ReviewSidePanel.svelte         Generic tabbed container: receives tab definitions (id, label, snippet) + actions snippet from parent
      review-helpers.ts              Pure format functions: formatVulnerability, formatResult (extracted from ReviewSidePanel)
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
    AuctionTable.svelte              4-column N/E/S/W grid, suit-colored. Each cell renders a fixed-width `BidBadge` box (rounded, bordered, `Pass`→`P`) with an optional corner annotation badge. `minimal` prop for compact play-history rendering (tighter padding, no caption); badges + popovers still render in minimal mode.
    BidBadge.svelte                  Boxed bid cell primitive: `<span data-bid-box>` + absolute-positioned `BidAnnotationBadge` in the corner. Owns display-only abbreviation, suit coloring, border chrome. No popover logic.
    BidBadge.ts                      Companion: `AnnotationType` type + `displayBidText()` (display-only `Pass`→`P` abbreviation — service `formatCall` is untouched).
    BidAnnotationBadge.svelte        Corner SVG glyph (bell/amber for alert, megaphone/blue for announce, info-circle/gray for educational) with hover/focus-within/click-pinned popover of alertLabel + publicConditions. Used directly by `RoundBidList` and composed by `BidBadge`. Hover/focus previews are CSS-only; click pins via `[data-open="true"]` so the popover survives mouse-leave until dismissed.
    bid-badge-state.svelte.ts        Module-level single-open registry for bid-annotation popovers. Canonical state `openEntryId`. Exports `isOpen`, `requestOpen`, `requestClose`, `closeAll`, `currentOpenId`. Registers one document-level keydown (Escape) + capture-phase click (outside-click → `closeAll`) at module load.
    BidPanel.svelte                  5-col grid + specials row, compact mode, data-testid on buttons
    BidFeedbackPanel.svelte          Two-branch bid feedback (Correct/Acceptable green → BidFeedbackCorrect, NearMiss amber/Incorrect red → BidFeedbackIncorrect) with show-answer toggle, acceptable badges on siblings, optional practical note, convention contribution badges, WhyNot grade distinction, multi-rationale indicator, encoding explanation, partner hand space summary, elimination stage annotations
    BidFeedbackPanel.ts              Companion .ts file with convention-agnostic display helpers for TeachingProjection rendering: formatAmbiguity, formatEliminationStage, formatModuleRole, roleColorClasses, whyNotGradeClasses, isArtificialEncoder, formatEncoderKind, FeedbackVariant type, variantClass color lookup
    bid-feedback/
      BidFeedbackCorrect.svelte      Correct bid feedback — green flash with explanation + passed conditions (shown as non-blocking feedback for all correct/acceptable bids)
      BidFeedbackIncorrect.svelte    Incorrect/near-miss bid feedback panel with variant coloring (red incorrect, amber near-miss)
    RoundBidList.svelte              Shared round-by-round bid list (configurable expand state, expected result, test IDs, dimming/highlighting/click for stepping). Renders a `BidAnnotationBadge` next to each annotated call, gated by the `showEducationalAnnotations` prop. Clickable rows use `role="button" tabindex="0"` (not a `<button>` wrapper) so the nested badge button remains valid HTML.
    AuctionStepControls.svelte       Compact auction step toolbar (prev/next/start/end + position label + Step Through/Show All toggle). Rendered below the AuctionTable in `ExplanationPhase`'s table center; replaces the old `AuctionStepPanel` toolbar. Bid stepping selection lives in `RoundBidList` (clickable rows) inside the bidding side panel — these two surfaces share `selectedBidStep` but are not redundant: list = pick a bid, controls = walk forward/back + exit to "All bids".
    MakeableContractsTable.svelte    5x4 DDS tricks grid (NT/S/H/D/C × N/E/S/W)
    AnalysisPanel.svelte             DDS analysis: makeable table + actual-vs-optimal + par score
    DecisionTree.svelte              Interactive expand/collapse tree with depth modes (compact/study/learn) for progressive teaching disclosure
    DeclarerPrompt.svelte            Declarer/defender choice buttons (used by DeclarerPromptPhase)
    DebugDrawer.svelte               Full-lifecycle debug overlay (dev only) — groups sections into Dev Actions / Context / Decision Pipeline / Feedback & History. Accepts `onNewDeal` / `onBackToMenu` callbacks forwarded to `DebugDevActions`.
    debug/
      DebugSection.svelte            Reusable collapsible section with count badges, inline preview, nested support
      DebugDevActions.svelte         Phase-aware shortcut buttons (dev only). Layout: one action per row — fixed-width button + plain-language summary; every button has a `title=` tooltip with the precise effect, and the panel-level "Show details" toggle expands each row to surface non-obvious behavior (auto-bid fallbacks, seat swaps, that auto-play uses first-legal-play not DDS, persistence of toggles). Routes: BIDDING → `gameStore.skipToPhase()` for finish/skip variants, single-bid actions go through `userBid`. DECLARER_PROMPT → `acceptPrompt`/`declinePrompt`. PLAYING → `autoPlayHand` (full play log, no animation), `restartPlay`, `skipToReview` (re-labeled "Abandon hand" since it drops mid-trick). EXPLANATION → forwarded `onNewDeal`/`onBackToMenu` callbacks plus `playThisHand`. Toggles row drives `appStore.autoplay` and `appStore.autoDismissFeedback` (both persist; on/off state shown in label). All actions disable while `gameStore.isProcessing`; a small "Busy — actions disabled…" hint renders during transitions.
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
    NavRail.svelte                   Thin left rail (~80px) — Home/Learn/Workshop (dev only)/Settings icons. Desktop only. Workshop gated behind FEATURES.workshop. Practice and Learn items each have a hover flyout (group-hover/focus-within). Practice flyout: Quick Practice (`/practice`) / Drills (`/practice/drills`). Learn flyout: Conventions (`/learn`) / Lessons (`/lessons`) / Bidding Systems (`/systems`).
    BottomTabBar.svelte              Mobile bottom tab bar — Home + Learn + Workshop (dev only) + Settings tabs. Mobile only. Workshop tab gated behind FEATURES.workshop.
  learn/
    LearnSidebar.svelte              Sticky desktop sidebar for `/learn/*` routes: progressive-enhancement search input filters a fully server-rendered `<ul>` of conventions (SEO-intact). Mobile renders a disclosure toggle above the list. Active link keyed off `$page.url.pathname`.
  shared/
    Button.svelte                    Primary/secondary/ghost variants
    Card.svelte                      70x98 visual playing card
    CardSurface.svelte               Base visual card surface — centralizes bg/border/radius/transition tokens for all card-like elements. Props: as (div/section), radius (md/lg), class, testId. Re-theme all cards by changing this one file.
    ItemCard.svelte                  Interactive card wrapper for list items — button (onclick) or div, with selected/interactive states. Shares token pattern with CardSurface. Used by WorkshopScreen, ConventionSelectScreen.
    ScreenSection.svelte             Section wrapper with standardized h2 header + optional helper text + content snippet. Used by WorkshopScreen.
    Spinner.svelte                   Inline loading spinner (sm/md sizes)
    SectionHeader.svelte             Uppercase muted section heading (h2/h3)
    BidFeedbackShell.svelte          Variant-colored alert container for bid feedback
    ToggleGroup.svelte               Mutually-exclusive button group (outline/filled variants)
    NumberStepper.svelte             Horizontal [-] N [+] input with auto-repeat long-press, clamp, keyboard arrows
    NumberStepper.ts                 Pure helpers: clamp(), createAutoRepeat() for NumberStepper testability
    RangeStepper.svelte              Composes two NumberStepper instances with "to" separator and shared suffix
    AuthModal.svelte                 Native <dialog> auth modal — login (OAuth buttons) when logged out, account info (sign out, settings link) when logged in. Exports open()/close().
    ManageSubscriptionButton.svelte  Shared account action — opens Stripe Billing Portal through the DataPort and shows inline errors if the portal request fails.
    PaywallOverlay.svelte            Native <dialog> upgrade prompt — shown when user tries to practice a locked bundle. Exports open()/close(); Subscribe navigates to `/billing/pricing` where checkout begins.
    VulnerabilityPicker.svelte       Shared weighted-toggle picker over the four vulnerability states (None / NS Vul / EW Vul / Both). Controlled component (`value`, `onChange`, `label`, `testIdPrefix`). Used by `DrillForm` and the Quick Practice flow when surfaced.
    ConventionPicker.svelte          Single-select popover/typeahead over `ConventionInfo[]` grouped by `ConventionCategory` (Asking / Defensive / Constructive / Competitive). Search input, arrow-key/Enter/Esc keyboard nav, outside-click cancel, focus restored to trigger on close. Props: `conventions`, `excludeIds` (already-chosen ids to hide), `isLocked` (predicate), `onPick(id)`, `onCancel?`, `triggerLabel`, `testIdPrefix`, `variant: "primary"|"subtle"`, `openOnMount`. Locked options render greyed with a "Subscribe to unlock" hint; entitlement enforcement happens in the parent on pick. Used by `DrillForm` for both the default single-convention picker and the "+ Add another convention" path.
    module-catalog.ts                Single source of truth for module categorization: MODULE_CATEGORIES, CATEGORY_DISPLAY, CatalogModule, mergeModules(), groupByCategory(), filterModules(). Pure functions — no store/Svelte imports. All screens import from here.
    ModuleChecklist.svelte           Shared collapsible checkbox grid for module selection: search, collapsible category sections, count badges. User modules shown under "My Conventions" section separated from system modules. Used by SystemEditor.
    reference/                       Reference-page building blocks for `/learn/[moduleId]`: `BidCode`, `SummaryCard` (hero bid + fallback `<dl>` row), `WhenNotTable` (`whenToUse` bullets now support optional predicate disclosure text), `ResponseTable` (dynamic columns from viewport), `FlowSummary`, `ContinuationList` (single-level progressive disclosure + Expand all), `QuickReference` (tagged grid|list with structured grid cells `{ call, gloss?, kind, notApplicableReasonText? }` and dense-grid compaction), `OnThisPageNav` (scroll-spy TOC), `ReferenceHandDiagram` (compact suit-by-suit hand sample), `WorkedAuctionCard` (page-level worked-auction renderer with optional responder hand), legacy `WorkedAuction`, `InterferenceSection` (tagged applicable|notApplicable), `RelatedLinks`, `QuickRefCard`, and the shared TS section types. Anchors must route through `slugifyMeaningId()` from `src/service/`; all non-summary/non-response sections hide themselves in print via co-located `@media print` rules.
  __tests__/
    ButtonTestWrapper.svelte         Snippet wrapper for Button tests
    BridgeTableTestWrapper.svelte    Snippet wrapper for BridgeTable tests
    shared/                          Shared component tests, including `CardTestWrapper.svelte` for context-backed `<Card>` rendering (used by the ten-notation preference tests)
      reference/                     Behavior tests for the reference-page components (schema, anchor ids, null/print contracts)
    game/                            Game component tests
    screens/                         Screen component tests, including context-backed wrappers such as `QuickPracticeSettingsPanelTestWrapper.svelte`, `DrillFormTestWrapper.svelte`, `SettingsScreenTestWrapper.svelte`, and `ConventionSelectScreenTestWrapper.svelte` for store/router-backed screen pieces
    routes/                          Route-layout tests with heavy `vi.mock` of WASM/store creators (e.g. `AppLayout.test.ts` characterising the (app) layout root's display-preference attribute bindings via `AppLayoutTestWrapper.svelte` + `fake-app-store.svelte.ts` + `AppShellStub.svelte`)
```

**Screen flow:** SvelteKit `(app)/+layout.svelte` owns the full app layout — loads WASM, renders `AppReady.svelte` which provides context setup + nav chrome. File-based routing replaces store-driven screen routing. All screens (including GameScreen) are wrapped by the nav layout. Desktop: thin left rail (NavRail) with Home/Learn/Workshop (dev only)/Settings icons. Learn links to `/learn` (conventions reference); the NavRail flyout also exposes `/lessons` and `/systems`. Mobile: bottom tab bar (BottomTabBar) with Home/Learn/Workshop (dev only)/Settings tabs (3 tabs in production, 4 in dev). Workshop tab is the home for system/convention management, gated behind `FEATURES.workshop`. `?profiles=true` backward compat alias redirects to `/workshop`. Workshop = management (fork, edit, delete, configure). Learn = study (teaching content, flow trees, surfaces).

**Props pattern:** Game/shared components receive data as props. Screen components read stores from context.

**Practice settings are launch-time only.** `game-screen/*` components do not expose mode/role/system/opponent/play-profile settings controls. Those are chosen on `/practice` before launch and stay immutable for the active drill; the in-game preferences still read live are `displaySettings.showEducationalAnnotations` (annotation visibility), `displaySettings.cardSize` (card-size scale, applied via the `(app)` layout root's inline `--card-size-scale` and consumed by `BiddingPhase.svelte`'s mobile fan sizing), `displaySettings.suitColorScheme` (2-color vs 4-color, threaded through `data-suit-scheme` on the `(app)` layout root), and `displaySettings.tenNotation` (`"ten"` default vs `"t"`, read at the `Card` / `TrickReviewPanel` / `PlayHistoryPanel` render sites and passed to `displayRank()` — not propagated through CSS, so reference-page hand diagrams are intentionally unaffected).

**Design tokens:** Suit colors are 2-color by default (♠♣ light, ♥♦ red); 4-color is opt-in via `data-suit-scheme="four-color"` on the root `<div>` of `src/routes/(app)/+layout.svelte`. CSS overrides in `src/app.css` use bare `[data-suit-scheme=…]` selectors and inherit through the cascade. Card-face colors (`--color-suit-card-*`) differ from on-dark-bg colors (`--color-suit-*`). See `src/components/shared/tokens.ts`.

## Gotchas

- **Saved drills page (`/practice/drills`) checks entitlement at launch.** It calls `canPractice(authStore.user, id)` for every moduleId before applyDrillSession; on fail it opens `PaywallOverlay` instead of starting the drill. The list also renders a "Locked" badge on drills containing any paid module so downgraded users don't discover the block only on click. The page surfaces `drillsStore.loadStatus === "auth-load-error"` as a non-dismissable banner with a Retry button (calls `drillsStore.refresh()`); while in that state the Create-new button is disabled to prevent divergence between server and in-memory list.
- **Layout sizing is JS-driven.** GameScreen is the single source of truth for all layout dimensions. `availableW` (viewport minus debug panel) feeds `rootFontSize`, `sidePanelW`, and `tableScale`. These are set as inline CSS variables (`--width-side-panel`, `--game-scale`, `--panel-font`) on `<main>`. **Do NOT define layout sizing variables in `app.css` with `vw`/`%` units** — they won't account for panels that steal viewport space (e.g., the debug drawer). If you need a new layout-dependent variable, derive it from `availableW` in GameScreen and set it inline.
- **Viewport lock & scroll:** The `(app)` layout wraps its content in `h-screen overflow-hidden` so the window never scrolls during game phases. `AppShell`'s `.shell-main` is `height: 100%` + `overflow-y: auto` — this is the primary scroll container for both `(app)` and `(content)` routes (guides, learn, learning). Game screens fit the viewport exactly so `.shell-main` has no scrollbar; long content pages scroll inside it. Global `html`/`body`/`#app` set `height: 100%` only (no `overflow: clip`).
- **Autoplay effect:** GameScreen has a DEV-only `$effect` for `?dev=autoplay` that uses `requestAnimationFrame` to defer actions per frame (not `tick()` which causes infinite microtask loops, not `setTimeout` which is a real timer).
- **Store methods:** `userBid`, `userPlayCard`, `retryBid`, `skipToReview` return `void` (safe for onclick). `startDrillFromHandle` returns a Promise. `startNewDrill` returns void (fire-and-forget, cancel-based).
- **Never construct Tailwind class names via string interpolation** — JIT purges dynamically built strings. Use complete literal class strings in lookup Records (see BidFeedbackShell.svelte and ToggleGroup.svelte).
- **Lifecycle action buttons** must bind `disabled` to `gameStore.isTransitioning`. Primary action per phase shows a spinner when transitioning (Next Deal in review, Restart Play in playing, New Deal in bidding).
- **Learn mode auto-skip lifecycle:** GameScreen has a `$effect` that calls `skipToPhase("review")` when `practiceMode === Learn && phase === BIDDING && isInitialized`. This fires on mount and after each New Deal. Do NOT add Learn mode logic to the existing onMount block.
- GameScreen routes phases to extracted pure components (BiddingPhase, DeclarerPromptPhase, PlayingPhase, ExplanationPhase, LearnPhase). GameScreen owns the legal-plays `$effect`.
- BiddingPhase receives `BiddingViewport` as prop — never accesses raw `Deal` or engine internals. Viewport builders live in `src/service/`.
- DeclarerPromptPhase receives `DeclarerPromptViewport` as prop — never accesses raw `Deal`. Hands filtered through faceUpSeats.
- PlayingPhase receives `PlayingViewport` as prop — never accesses raw `Deal`. Hands filtered through faceUpSeats.
- ExplanationPhase receives `ExplanationViewport` as prop — all 4 hands via `allHands`, no raw `Deal`. Owns `replayStep` state; `TrickOverlay` and `TrickReviewPanel` are controlled by derived values from this single state, while the Cardplay tab's `PlayHistoryPanel` shows the full playthrough and uses the same selected-trick highlight. Per-card stepping (not per-trick) surfaces individual decision points. **Hand visibility is independent of auction stepping**: a `handVisibility` state ("mine-dummy" | "all" | "mine-only") drives `visibleHands` for `BridgeTable`. Stepping the auction only slices `steppedAuctionEntries` shown in the center AuctionTable — it never reveals or hides hands.
- BridgeTable/TrickArea accept `rotated` prop — uses `viewSeat()` from `src/components/shared/seat-mapping.ts`, not CSS rotation.
- `BidPanel` renders all 35 bids + 3 specials; unavailable bids disabled, not hidden. `data-testid="bid-{callKey}"` on all.
- User seat hardcoded to `Seat.South` — future: configurable.
- Dev-mode seeded RNG via `appStore.devSeed`; seed advances per deal.
- **Practice picker: no mastery/progress affordances on convention cards.** Do not add mastery bars, streak counters, "X of Y" progress strings, or completion badges to `ConventionSelectScreen` cards. Research (see `docs/research/practice-page-redesign/evidence-map.md` §6 + finding #4) shows these harm intrinsic motivation for adult voluntary learners (Hanus & Fox 2015 RCT; overjustification effect). A descriptive "Last practiced: N days ago" line is acceptable; evaluative progress indicators are not. Progress/coverage belongs in a dedicated opt-in surface (e.g., `/coverage`), not the picker.
- **Practice picker: category section order is coupled to the `ConventionCategory` enum.** `ConventionCategory` is re-exported from `src/service/` (Rust-origin, via WASM). The Practice picker renders category sections in `Object.values(ConventionCategory)` declaration order. Reordering or renaming values in the Rust enum silently changes the Practice-tab section order. If order matters, encode it explicitly rather than relying on enum declaration.
- **Bid-annotation popovers share one global `openEntryId`.** `AuctionTable` badges, `RoundBidList` annotation badges, and the `AuctionTable` legend all route through `bid-badge-state.svelte.ts`. Opening any closes the others — intentional, so two overlays never clutter the screen simultaneously. Any new auction-rendering surface that displays annotation popovers **must** use `BidAnnotationBadge` (or call the registry directly) or this invariant breaks. Badge ids must be derived from stable input data (e.g., bid index, or the literal `"auction-legend"` for the legend), never from a module-level counter — otherwise ids drift across navigations and unmount cleanup fails.

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

<!-- context-layer: generated=2026-02-21 | last-audited=2026-04-29 | version=30 | dir-commits-at-audit=319 | tree-sig=dirs:17,files:177,exts:svelte:108,ts:68,md:1 -->
