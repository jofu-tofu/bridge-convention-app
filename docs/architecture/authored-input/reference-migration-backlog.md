# Reference Migration Backlog

**Status:** Substrate complete, content pass 1 done, review pass done. Remaining items tracked here.
**Created:** 2026-04-15 — end of migration session.
**Spec:** `docs/architecture/authored-input/reference-manual-inferred-fields.md`

## What shipped

- `reference: ModuleReference` is non-Option — every module has a populated reference block.
- `QuickReferenceAxis::Qualitative` deleted — zero uses remain.
- One render path in `+page.svelte` — fallback branch removed.
- `FactId` newtype with closed catalog + deserialize-time validation.
- `CellBinding` enum with `Auto` surface-projection for quick-reference grids.
- `PredicateBullet` on `whenToUse`.
- CI lint `reference_prose_invariants` — no authored digits in reference strings.
- Wave 1 systemic renderer fixes (placeholder leaks, empty Denies row auto-hide, empty `()` fix).
- UI: hero bid, collapsible continuations, scroll-spy nav, NotApplicable reason disclosure, hand diagram component.
- 14 modules authored + 4 review waves with corrections.

## Priority 1 — surface-level corrections (snapshot-regen sessions)

Each needs a dedicated codex session with authority to regenerate pipeline golden-master snapshots (`scripts/capture-pipeline-snapshots.ts`) and witness-enumeration tests. Sidecar files with full details at `_output/contexts/260413-1738-run-dev-open-browser/notes/deferred-surface-fixes/`.

| Module | Issue | Sidecar |
|---|---|---|
| Bergen | `eq 4` → `gte 4` on trump-support clauses; 4M from "13+ strong" to "preemptive 5+" | `bergen.md` |
| New Minor Forcing | Response Table shows initial 1m responses; should show opener's NMF rebid ladder | `new-minor-forcing.md` |
| Negative Doubles | Response Table shows opponent overcalls; should show responder's double per context; per-auction promises derivation | `negative-doubles.md` |
| Weak Twos | New-suit binding bug ("2♠ shows 5+ hearts"); 16+ HCP floor → ~14+; suit-quality "2/3 OR 3/5"; seat gating (3rd/4th) | `weak-twos.md` |
| Strong 2♣ | 2♦-waiting predicate broadened from "0-7 HCP" to "any hand without a positive"; opening predicate to include playing-tricks | `strong-2c.md` |

## Priority 2 — catalog infrastructure

Building `ContextFact` mechanism (suit/auction-context parameterization on fact evaluation). Blocked facts:

| Fact | Unblocks | Effort |
|---|---|---|
| `responder.trumpSupport` | Bergen full grid | ~half day |
| `overcall.twoSuitedShape` | Michaels / DONT grid upgrades | ~1 day |
| `interference.type` | Negative Doubles quick-reference axes | ~half day |
| `vulnerability` | Weak Twos vul-gating | ~half day |

Prerequisite: design and implement the `ContextFact` binding mechanism (how a partition fact references the agreed suit / opponent's suit at evaluation time). Estimated ~1 day of Rust infrastructure.

## Priority 3 — renderer / viewport

| Item | Module(s) | Type |
|---|---|---|
| Blackwood 5♦/5♥/5♠ continuation dead-ends | Blackwood | Renderer or fixture structural |
| Michaels summary-card bid family indicator | Michaels | Viewport derivation |
| Natural Bids 1NT `denies` content | Natural Bids | Meaning-level authoring |
| Weak Twos authority link (Wikipedia → ACBL/SAYC) | Weak Twos | Fixture metadata |
| Jacoby Transfers super-accept doubleton criterion | Jacoby Transfers | Needs new fact or prose-only |

## Priority 4 — framework (not blocking shipping)

- `ReferenceStatus::Deferred { tracking }` enum — typed state for new conventions added before their reference blocks are authored.
- ConventionForge completeness oracle (Stage 4) — cross-module linker + property-test oracle.
- Locale plumbing — `LocalizedLabel` wrapper exists but only English populates.
- `relatedLinks` validation — assert every `moduleId` resolves to a real learn page at build time.

## How to run a surface-correction session

Per-module template:

1. Read the sidecar: `_output/contexts/260413-1738-run-dev-open-browser/notes/deferred-surface-fixes/<module>.md`
2. Read the module: `crates/bridge-conventions/fixtures/modules/<module>.json`
3. Edit surface clauses per the sidecar.
4. Run `cargo test -p bridge-conventions` — expect golden-master failures.
5. Regenerate: `npx tsx scripts/capture-pipeline-snapshots.ts --module=<module>`
6. Review the new snapshots: are they bridge-correct for the changed surfaces?
7. Run `cargo test --workspace && npm run static:extract && npm run test:run && npm run check`
8. Browse the page.
