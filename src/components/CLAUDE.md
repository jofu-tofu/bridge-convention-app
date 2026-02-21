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

## Architecture

```
App.svelte                           Root — creates engine/stores, sets context, routes screens
components/
  screens/
    ConventionSelectScreen.svelte    Convention picker with search + category filter
    GameScreen.svelte                Bridge table + side panel, responsive layout
    ExplanationScreen.svelte         Bid review with convention callouts
  game/
    BridgeTable.svelte               800x650 table with 4 seats, absolute positioning
    HandFan.svelte                   Overlapping visual card fan (horizontal/vertical)
    TrickArea.svelte                 Center area (stub for Phase 5)
    AuctionTable.svelte              4-column N/E/S/W grid, suit-colored
    BidPanel.svelte                  5-col grid + specials row, compact mode
    BiddingReview.svelte             Bid history table with convention callouts
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

**Screen flow:** ConventionSelectScreen → GameScreen (BIDDING phase) → ExplanationScreen

**Props pattern:** Game/shared components receive data as props. Screen components read stores from context.

**Design tokens:** Suit colors use 4-color scheme: Spades (#E2E8F0), Hearts (#F87171), Diamonds (#FB923C orange), Clubs (#A3E635). Card-face colors differ from on-dark-bg colors — see `src/lib/tokens.ts`.

## Gotchas

- `GameScreen` uses a one-shot `$effect` with `initialized` flag to avoid re-triggering `startNewDrill()` on every render
- `GameScreen` auto-navigates to ExplanationScreen when `gameStore.phase === "EXPLANATION"` via a separate `$effect`
- PLAYING phase is a stub — shows "Card play coming in Phase 5" message
- `BidPanel` always renders all 35 contract bids (7x5 grid) + 3 specials; unavailable bids are disabled/grayed, not hidden
- User seat is hardcoded to `Seat.South` in GameScreen/ExplanationScreen — future: make configurable
- GameScreen has a local `dealNumber` counter that increments on each new drill and resets on remount

---

## Context Maintenance

**After modifying files in this directory:** scan the entries above — if any claim is now
false or incomplete, update this file before ending the task. Do not defer.

**Staleness anchor:** This file assumes `App.svelte` exists in `src/`. If it doesn't, this file
is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-02-21 | last-audited=2026-02-21 | version=2 -->
