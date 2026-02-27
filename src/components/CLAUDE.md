# Components

Svelte 5 UI components for the drill workflow. Consumer of stores, lib, and engine types.

## Conventions

- **Svelte 5 runes only.** `$state`, `$derived`, `$effect` — no legacy `$:` reactive statements
- **Named exports only.** No `export default` in any `.ts` file. Svelte components are the exception (implicit default).
- **Keyed `{#each}` blocks.** Every `{#each}` must have a key expression: `{#each items as item (item.id)}`
- **EnginePort boundary.** Components never import engine internals (`hand-evaluator`, `deal-generator`, `auction`, `scoring`, `play`). Import types from `engine/types.ts` and constants from `engine/constants.ts` only. Engine access goes through `EnginePort` via context.
- **Context for DI.** Engine, game store, and app store provided via Svelte context (set in App.svelte, retrieved via `src/stores/context.ts` helpers).
- **Tailwind CSS + design tokens.** Tailwind utility classes augmented with CSS custom properties defined via `@theme` in `src/app.css`. Midnight Table dark theme. No `<style>` blocks in new components except for CSS that Tailwind can't express (e.g., HandFan overlap/rotation).
- **Pure function extraction.** Complex logic extracted to `src/display/` and `src/drill/` for testability: `sortCards`, `computeTableScale`, `filterConventions` (display/), `startDrill` (drill/).

## Accessibility

Components use semantic HTML and ARIA attributes to support screen readers and accessibility-tree-based testing (e.g., Playwright `ariaSnapshot()`).

- **Semantic landmarks.** Screen components use `<main>` as the root container. GameScreen uses `<header>` for the top bar. Logical content groups use `<section>` with headings.
- **ARIA labels on display elements.** Non-interactive visual elements that convey information get `aria-label` (e.g., face-up cards: `aria-label="{rank} of {suit}"`, face-down cards: `aria-label="Card back"`).
- **Live regions for dynamic content.** Use `aria-live="polite"` on content that updates during gameplay (turn indicator, trick scores). Use `role="alert"` for immediate feedback (bid correct/incorrect).
- **Decorative elements hidden.** SVG icons use `aria-hidden="true"`. Purely decorative elements should not appear in the accessibility tree.
- **Native semantics first.** Prefer `<button>`, `<table>`, `<input>` over `<div>` with ARIA roles. Existing semantic tables (AuctionTable, BiddingReview) use `<caption class="sr-only">` for screen reader context.

## Architecture

```
App.svelte                           Root — creates engine/stores, sets context, routes screens
components/
  screens/
    ConventionSelectScreen.svelte    Convention picker with search + category filter
    game-screen/
      GameScreen.svelte              Phase router + responsive layout + drill lifecycle (~280 LOC)
      BiddingPhase.svelte            Bidding phase template (pure — data via props)
      DeclarerPromptPhase.svelte     Declarer/defender prompt (pure — data via props)
      PlayingPhase.svelte            Play phase template (pure — data via props, legal plays from parent)
      ExplanationPhase.svelte        Review phase with showAllCards toggle
      layout-props.ts                Shared LayoutProps interface (6 members)
      BiddingSidePanel.svelte        BidPanel + BidFeedbackPanel + dev debug info
      PlaySidePanel.svelte           Contract, trick counts, skip-to-review
      ReviewSidePanel.svelte         Tabbed review: Bidding + Analysis, next deal / back to menu
      ContractDisplay.svelte         Formatted contract with doubled/redoubled indicators
      ScaledTableArea.svelte         Responsive table wrapper with transform-origin
  game/
    BridgeTable.svelte               800x650 table with 4 seats, absolute positioning
    HandFan.svelte                   Overlapping visual card fan (horizontal/vertical)
    TrickArea.svelte                 Center trick display with NSEW card positions and trick count
    AuctionTable.svelte              4-column N/E/S/W grid, suit-colored
    BidPanel.svelte                  5-col grid + specials row, compact mode, data-testid on buttons
    BidFeedbackPanel.svelte          Correct/incorrect bid feedback with show-answer toggle + tree fork display
    RoundBidList.svelte              Shared round-by-round bid list (configurable expand state, expected result, test IDs)
    BiddingReview.svelte             Thin wrapper over RoundBidList (expanded siblings, shows expected)
    MakeableContractsTable.svelte    5x4 DDS tricks grid (NT/S/H/D/C × N/E/S/W)
    AnalysisPanel.svelte             DDS analysis: makeable table + actual-vs-optimal + par score
    RulesPanel.svelte                Convention rules display: fired (evaluated) + reference (static) — kept for future learning screen
    DeclarerPrompt.svelte            Declarer/defender choice buttons (used by DeclarerPromptPhase)
    DebugDrawer.svelte               Full-lifecycle debug overlay (dev only)
    DebugPanel.svelte                Bidding-phase suggested bid display in BiddingSidePanel
  shared/
    Button.svelte                    Primary/secondary/ghost variants
    Card.svelte                      70x98 visual playing card
    ConventionCallout.svelte         Rule badge + explanation
  __tests__/
    ContextWrapper.svelte            Context provider for screen tests
    ButtonTestWrapper.svelte         Snippet wrapper for Button tests
    BridgeTableTestWrapper.svelte    Snippet wrapper for BridgeTable tests
    shared/                          Shared component tests
    game/                            Game component tests
    screens/                         Screen component tests
```

**Screen flow:** ConventionSelectScreen → GameScreen (BIDDING → [optional DECLARER_PROMPT → optional PLAYING →] EXPLANATION)

**Props pattern:** Game/shared components receive data as props. Screen components read stores from context.

**Design tokens:** Suit colors use 4-color scheme — card-face colors differ from on-dark-bg colors. See `src/display/tokens.ts`.

## Gotchas

- **Viewport lock:** `html`, `body`, `#app` use `overflow: clip` in `app.css` to prevent page-level scrolling. Side panels scroll internally.
- **Autoplay effect:** GameScreen has a DEV-only `$effect` for `?autoplay=true` that uses `requestAnimationFrame` to defer actions per frame (not `tick()` which causes infinite microtask loops, not `setTimeout` which is a real timer).
- **Store methods:** `userBid`, `userPlayCard`, `dismissBidFeedback`, `skipFromFeedback`, `skipToReview` return `void` (safe for onclick). Only `startDrill` and `getLegalPlaysForSeat` return Promises.
- GameScreen routes phases to extracted pure components (BiddingPhase, DeclarerPromptPhase, PlayingPhase, ExplanationPhase). GameScreen owns the legal-plays `$effect`.
- BridgeTable/TrickArea accept `rotated` prop — uses `viewSeat()` from `src/display/seat-mapping.ts`, not CSS rotation.
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

<!-- context-layer: generated=2026-02-21 | last-audited=2026-02-25 | version=9 | dir-commits-at-audit=19 | tree-sig=dirs:9,files:47,exts:svelte:31,ts:15,md:1 -->
