# Components

Svelte 5 UI components for the drill workflow. Consumer of stores, lib, and engine types.

## Conventions

- **Svelte 5 runes only.** `$state`, `$derived`, `$effect` — no legacy `$:` reactive statements
- **Named exports only.** No `export default` in any `.ts` file. Svelte components are the exception (implicit default).
- **Keyed `{#each}` blocks.** Every `{#each}` must have a key expression: `{#each items as item (item.id)}`
- **EnginePort boundary.** Components never import engine internals (`hand-evaluator`, `deal-generator`, `auction`, `scoring`, `play`). Import types from `engine/types.ts` and constants from `engine/constants.ts` only. Engine access goes through `EnginePort` via context.
- **Context for DI.** Engine, game store, and app store provided via Svelte context (set in App.svelte, retrieved via `src/lib/context.ts` helpers).
- **Tailwind CSS + design tokens.** Tailwind utility classes augmented with CSS custom properties defined via `@theme` in `src/app.css`. Midnight Table dark theme. No `<style>` blocks in new components except for CSS that Tailwind can't express (e.g., HandFan overlap/rotation).
- **Pure function extraction.** Complex logic extracted to `src/lib/` for testability: `sortCards`, `computeTableScale`, `filterConventions`, `startDrill`.

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
      GameScreen.svelte              Bridge table + side panel, responsive layout, seeded RNG
      BiddingSidePanel.svelte        BidPanel + BidFeedbackPanel + dev debug info
      PlaySidePanel.svelte           Contract, trick counts, skip-to-review
      ReviewSidePanel.svelte         Tabbed review: Bidding + Rules + Analysis, next deal / back to menu
      ContractDisplay.svelte         Formatted contract with doubled/redoubled indicators
      ScaledTableArea.svelte         Responsive table wrapper with transform-origin
  game/
    BridgeTable.svelte               800x650 table with 4 seats, absolute positioning
    HandFan.svelte                   Overlapping visual card fan (horizontal/vertical)
    TrickArea.svelte                 Center trick display with NSEW card positions and trick count
    AuctionTable.svelte              4-column N/E/S/W grid, suit-colored
    BidPanel.svelte                  5-col grid + specials row, compact mode, data-testid on buttons
    BidFeedbackPanel.svelte          Correct/incorrect bid feedback with show-answer toggle + tree fork display
    BiddingReview.svelte             Bid history table with convention callouts
    MakeableContractsTable.svelte    5x4 DDS tricks grid (NT/S/H/D/C × N/E/S/W)
    AnalysisPanel.svelte             DDS analysis: makeable table + actual-vs-optimal + par score
    AuctionRulesPanel.svelte         Round-by-round auction rules view (replaces RulesPanel in review)
    RulesPanel.svelte                Convention rules display: fired (evaluated) + reference (static) — kept for future learning screen
  shared/
    Button.svelte                    Primary/secondary/ghost variants
    Card.svelte                      70x98 visual playing card
    ConventionCallout.svelte         Rule badge + explanation
  __tests__/
    test-helpers.ts                  Fixture factories, createStubEngine, makeDeal
    ContextWrapper.svelte            Context provider for screen tests
    ButtonTestWrapper.svelte         Snippet wrapper for Button tests
    BridgeTableTestWrapper.svelte    Snippet wrapper for BridgeTable tests
    shared/                          Shared component tests
    game/                            Game component tests
    screens/                         Screen component tests
```

**Screen flow:** ConventionSelectScreen → GameScreen (BIDDING → [optional DECLARER_PROMPT → optional PLAYING →] EXPLANATION)

**Props pattern:** Game/shared components receive data as props. Screen components read stores from context.

**Design tokens:** Suit colors use 4-color scheme: Spades (#E2E8F0), Hearts (#F87171), Diamonds (#FB923C orange), Clubs (#A3E635). Card-face colors differ from on-dark-bg colors — see `src/lib/tokens.ts`.

## Gotchas

- **Scrollbar & overflow:** Global dark scrollbar styles in `app.css` (no `.custom-scroll` class needed). Side panels use `overflow-x-hidden` to prevent horizontal scroll. Content components (ConventionCallout, BiddingReview) use `flex-wrap` and `break-words` to wrap instead of overflow. MakeableContractsTable uses `table-fixed` for uniform columns.
- **Store user-action methods return `void`** — `userBid`, `userPlayCard`, `dismissBidFeedback`, `retryBid`, `skipFromFeedback`, `skipToReview`, `reset` are safe to call from any onclick handler. Only `startDrill` and `getLegalPlaysForSeat` return Promises and must be awaited.
- `GameScreen` uses `onMount` to skip starting a new drill if a deal is already in progress
- GameScreen renders all phases (BIDDING, DECLARER_PROMPT, PLAYING, EXPLANATION) inline via conditional blocks — no separate ExplanationScreen
- PLAYING phase shows BridgeTable with TrickArea center, HandFan with legal plays, and side panel with trick count + skip button
- BridgeTable and TrickArea accept optional `rotated` prop for 180° table rotation (declarer swap). Uses `viewSeat()` pure function from `src/lib/seat-mapping.ts` — not CSS rotation.
- DECLARER_PROMPT phase shown when user (South) is dummy OR when E/W declares; offers "Play as Declarer"/"Play as Defender" or "Skip to Review" based on `isDefenderPrompt`
- `BidPanel` always renders all 35 contract bids (7x5 grid) + 3 specials; unavailable bids are disabled/grayed, not hidden. All buttons have `data-testid="bid-{callKey}"` (e.g., `bid-1C`, `bid-pass`) for Playwright selectors.
- User seat is hardcoded to `Seat.South` in GameScreen — future: make configurable
- GameScreen supports dev-mode seeded RNG via `appStore.devSeed` — `makeDevRng()` creates mulberry32 PRNG, seed advances per deal
- GameScreen has a local `dealNumber` counter that increments on each new drill and resets on remount

---

## Context Maintenance

**After modifying files in this directory:** scan the entries above — if any claim is now
false or incomplete, update this file before ending the task. Do not defer.

**Staleness anchor:** This file assumes `App.svelte` exists in `src/`. If it doesn't, this file
is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-02-21 | last-audited=2026-02-22 | version=5 | dir-commits-at-audit=7 | tree-sig=dirs:4,files:34,exts:svelte:21,ts:12,md:1 -->
