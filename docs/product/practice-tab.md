# Practice Tab

Status: Phase 3 shipped (2026-04-18). The Practice tab is the single place to
configure and launch drills. It owns launch-time practice settings, the
convention catalog, and lightweight saved-drill management for both single- and
multi-convention drills.

## Shipped surfaces

1. **Practice settings rail.** `/practice` owns mode, role, system, opponent
   mode, play skill, and educational annotations. Those settings configure the
   next drill before launch.
2. **Category-sectioned catalog.** Convention cards remain the primary entry
   point. Each card offers one-click Practice that uses the Quick Practice
   settings panel for mode/role/system/opponent/skill/annotations. Saving a
   reusable drill happens on `/practice/drills/new` (linked from
   `/practice/drills`).
3. **Saved drills shelf.** Single-convention drills render as an MRU shelf above
   the catalog. Each chip launches in one tap and exposes rename/edit/delete
   actions from the overflow menu.
4. **Saved drill routes.** `/practice/drills`, `/practice/drills/new`, and
   `/practice/drills/[id]/edit` all operate on the same `Drill` model used by
   the shelf and the launch surface.

## Core model

- A saved drill is `Drill{id,name,moduleIds[],practiceMode,practiceRole|auto,systemSelectionId,createdAt,updatedAt,lastUsedAt}`.
- Single-convention drills replace the old preset/custom-drill split.
- Multi-convention drills replace the old practice-pack concept via
  `moduleIds: string[]`.
- Launching a drill updates session-scoped state only. The `/practice` panel
  remains the user's default surface for the next launch, not a mirror of the
  active game.

## Design decisions

### D1. Pack folding — chose Fold in now

Use a single `Drill` concept with `moduleIds: string[]`. We rejected deferring
packs because the three old schemas overlapped 90% on
`(conventionId, role, system)` and only one persona (Priya / teacher) strongly
wanted N-module drills. If curriculum features ever grow, this remains
re-splittable into Pack (content) + Drill (context), but the shipped model keeps
the current surface simple.

### D2. Role control shape — chose Auto + 3

The `/practice` role control exposes four options: `Auto / Opener / Responder /
Both`. `Auto` resolves to `convention.defaultRole`. We rejected `3 explicit`
because it forces role knowledge on novice personas Lena/Noah/Maya, and we
rejected `Blank = auto` because "unset" is less legible than an explicit `Auto`
selection.

### D3. All settings on /practice — chose one launch surface

Mode, role, system, opponent mode, play profile, and educational annotations
all live in the `/practice` side panel. We rejected splitting between
`/practice` (per-session) and `/settings` (app-wide) because the line is fuzzy:
is opponent mode app-wide, or could a power user want "silent for Stayman,
natural for Michaels"? The shipped model uses one mental model: one place where
I configure practice, one place where I do practice.

### D4. In-game settings strip — chose no strip

Game UI shows zero settings metadata. We rejected a read-only
"Decision · SAYC · Responder" strip because it would require new chrome space on
every phase, and its only value ("I forgot what mode I'm in") is already
addressable by glancing at `/practice` between drills.

## Invariants

- **Additive, never load-bearing.** Saved drills are optional affordances. The
  catalog must stay fully usable for a user with zero saved drills.
- **No mastery / streak / progress affordances on the picker.** Descriptive
  metadata only. Evaluative progress belongs on `/coverage`, not on convention
  cards.
- **Launch-time settings stay on `/practice`.** Drill launches must not rewrite
  the user's panel defaults. `appStore.applyDrillSession()` applies session
  state in memory only.
- **MRU ordering is the only saved-drill order.** `lastUsedAt` DESC with
  `updatedAt` DESC tiebreaker. No manual reorder.
- **Persist `SystemSelectionId`, not `SystemConfig`.** Saved drills store the
  stable TS-side system ID and resolve the full config at launch time.

## Deferred

- Cross-device drill sync (waits on DataPort).
- Drill import / export / sharing.
- Teacher- or curriculum-specific drill management features beyond the current
  unified `Drill` model.
- A heavier "manage drills" surface if MRU shelf density becomes a real
  usability problem.
