# Display

UI display utilities and pure functions. Consumer of `engine/`, `conventions/core/` (type-only for `filter-conventions.ts`), and `core/contracts/`.

## Architecture

| File                   | Role                                                              |
| ---------------------- | ----------------------------------------------------------------- |
| `format.ts`            | `formatCall()`, `formatRuleName()`, `SUIT_SYMBOLS`, `STRAIN_SYMBOLS` |
| `hand-summary.ts`      | `formatHandSummary()` — compact shape + HCP summary for bidding feedback |
| `tokens.ts`            | CSS design tokens, suit color classes (`BID_SUIT_COLOR_CLASS`, `SUIT_CARD_COLOR_CLASS`) |
| `sort-cards.ts`        | `sortCards()` — visual card ordering for hand display             |
| `seat-mapping.ts`      | `viewSeat()` — logical-to-physical seat mapping for table rotation |
| `hcp.ts`               | `computeHcp()` — HCP display helper                              |
| `filter-conventions.ts`| `filterConventions()` — convention picker search/filter           |
| `table-scale.ts`       | `computeTableScale()` — responsive table scaling                  |

Convention evaluation moved to `src/teaching/`. Component-specific logic co-located in `src/components/game/` (DecisionTree.ts, RoundBidList.ts, DebugDrawer.ts).

## Gotchas

- Suit colors use 4-color scheme — card-face colors differ from on-dark-bg colors (see `tokens.ts`)
- `filterConventions()` hides conventions with `internal: true`
- `display/` may import from `conventions/core/` for type-only use (`ConventionConfig`, `ConventionCategory` in `filter-conventions.ts`) — do not remove this ESLint allowance

---

## Context Maintenance

**Staleness anchor:** This file assumes `format.ts` exists. If it doesn't, this file is stale.

<!-- context-layer: generated=2026-03-07 | version=4 | tree-sig=dirs:2,files:12,exts:ts:10,md:1 -->
