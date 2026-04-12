# Practice Tab

Status: Phase 2 shipped (2026-04-12). The Practice tab is the convention catalog
— a focused picker over all bundled conventions, with two lightweight resumption
affordances layered on top.

## Shipped surfaces

1. **Continue strip** (Phase 1). One-row reminder of the most recently practiced
   convention, with a one-click Practice button. Hidden while the user is
   searching.
2. **Saved drills shelf** (Phase 2). Horizontal chip strip above the category
   sections. Each chip is a named preset — a saved
   `(conventionId, practiceMode, practiceRole, systemSelectionId)` tuple —
   launchable in one tap. Hidden when the user has zero presets. MRU-sorted
   (`lastUsedAt` DESC, nulls last, `createdAt` tiebreaker). No manual reorder.
3. **Category-sectioned catalog** (Phase 1). All conventions, grouped by
   `ConventionCategory` enum order. Each card offers Learn, one-click Practice,
   and a `⋯` configure-and-save action that opens the preset dialog.

## Deferred to Phase 3

- Solicited "Recommended next" slot — no signal source yet.
- Cross-device preset sync (waits on DataPort).
- Preset import / export / sharing.
- Manual reorder / "Manage drills" screen (only if the 20-preset soft cap is
  routinely hit).
- Workshop-authored custom-system surfaces beyond storing `SystemSelectionId`
  (already forward-compatible).

## Invariants

- **Additive, never load-bearing.** Every user-contributed artifact (preset,
  practice pack, custom system) must be optional. The catalog is the primary
  surface and must stay fully usable for a user with zero presets and zero
  packs. Evidence: practice-page-redesign research §3 (saved-drills as
  secondary shelf) and §8 (user-curated sets are heavily bimodal).
- **No mastery / streak / progress affordances on the picker.** Descriptive
  "used Nd ago" metadata only. Evaluative indicators belong on a dedicated
  opt-in surface (`/coverage`), not here. Evidence: Hanus & Fox 2015 RCT
  (overjustification effect on adult voluntary learners).
- **Soft cap of 20 presets.** Beyond this, a full Manage Drills screen would
  be warranted — deferred until signals show it is needed.
- **MRU ordering is the only order.** Launching a preset reorders it to the
  front. This is documented behavior; there is no manual reorder.

## Data contract

Presets persist `SystemSelectionId` (TS-only type), never a serialized
`SystemConfig`. Rationale: `SystemConfig` is Rust-origin and its internals may
evolve, while `SystemSelectionId` is a stable identifier resolved at
session-start time via `resolveSystemForSession()`. See
`docs/architecture/design-philosophy.md`.

## Downgrade trigger

If telemetry after ship shows <10% of users ever create a second preset, the
named-preset model is overkill and should be downgraded to a simpler
"Practice with last settings" single button. That path is intentionally
reversible — presets add no Rust or WASM-boundary surface.
