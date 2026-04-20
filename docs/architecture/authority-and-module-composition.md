# Authority Policy and Module Composition

**Status:** Active guidance. Supersedes the "Authoritative Bridge Rules Sources" section of `docs/guides/convention-authoring.md`.
**Last reviewed:** 2026-04-19

This doc captures two coupled decisions the project has made about how convention modules relate to their sources and to each other. The two decisions interact: a module's authority determines what it should teach, and its composition pattern determines how it teaches things without duplicating other modules.

---

## Part 1 — Authority policy

### The policy

Every module fixture in `crates/bridge-conventions/fixtures/modules/` declares a single `references.authority.url` that pins the module's semantics. The authority is chosen by tier, not by convenience:

| Tier | Source | Use for |
|---|---|---|
| 1 | **ACBL SAYC System Booklet (PDF)** — `web2.acbl.org/documentlibrary/play/SP3 (bk) single pages.pdf` | System-constitutive conventions (see Category B below): opening bid structure, 1NT ranges, natural responses. |
| 1 | **Larry Cohen** — `larryco.com/bridge-articles/<slug>` | Convention semantics where Cohen has a page (Stayman, Jacoby Transfers, Blackwood, Strong 2C, Weak Twos, Smolen, Negative Doubles, Bergen Raises, minor-suit transfers). |
| 1 | **Karen Walker** — `kwbridge.com/<slug>.htm` | Conventions where Walker has a handout (DONT, Michaels/Unusual, New Minor Forcing). |
| 2 (discovery only) | **Wikipedia** | Background reading. **Not** an authority. |
| 2 (discovery only) | **bridgebum.com** | Cross-check / find a convention. **Not** an authority. |
| Forbidden | Dead sites, Wayback snapshots | Never pin these. |

### Why this tier structure

- **Larry Cohen and Karen Walker are the closest proxies for modal US teaching.** Club-level play often expands slightly beyond what they write; teaching materials at the ACBL / bridge club level track their prose closely. For a practice app, matching modal teaching is what users need.
- **Wikipedia prose is too thin.** Pre-2026-04-17 we used Wikipedia as authority for 7 modules. Verify runs revealed that the fixture kept drifting because Wikipedia didn't describe enough — opener-rebid continuations, meaning tables, signoff semantics. Re-pinning to Cohen immediately exposed concrete meaning mismatches that Wikipedia had hidden.
- **Bridgebum is an aggregator with internal contradictions.** We caught it diverging from Larry Cohen on Blackwood king-ladder encoding. Fine as discovery, not as authority.
- **The ACBL booklet is the official SAYC document.** For modules that describe the *system itself* (natural openings, NT ranges), it is more authoritative than any single teacher.

### Invariants

These are enforced by `tests/structural_invariants.rs`:

1. Every module fixture has a non-null `references.authority.url` and `references.discovery.url`.
2. `authority.url` must not equal `discovery.url` (this is the `jacoby-4way` bug from before 2026-04-17).
3. `discovery.url` should be on `bridgebum.com` unless explicitly flagged otherwise.
4. Every module fixture has a non-empty top-level `scopeNote` naming intentional exclusions.
5. Every module fixture has `references.authority.snapshot = { text, fetchedAt }` with non-empty `text` and `fetchedAt` as ISO-8601 `YYYY-MM-DD`.

### Snapshot and scopeNote (2026-04-19)

Two coupled fields deterministically pin what each module says and what it declines to cover:

- **`references.authority.snapshot`** freezes the authority prose at Build time (`text` captured via `webfetch` or `pdftotext`, `fetchedAt` stamped ISO). Verify compares fixture surfaces against this snapshot rather than re-fetching the URL. Dead or reshaped pages no longer change findings mid-review; `fetchedAt` older than ~180 days is advisory only and prompts a refresh rather than a re-author.
- **`scopeNote`** is a 1–4 sentence free-text field at the fixture root declaring what is intentionally out of scope (variant families excluded, level cutoffs, partner conventions owned by other modules, editorial calls that otherwise look like authority gaps). Verify reads `scopeNote` before flagging missing surfaces and does not reopen decisions listed there.

Before these fields existed, every Verify run re-fetched the live authority and re-derived scope from commit messages and out-of-tree `followups-*.md` notes, so fresh agents ping-ponged on the same decisions (see `_output/contexts/260419-2027-recent-sessions-lot-convention-forge-skill-diffeence/notes/combined-synthesis.md`). Build must capture both at authoring time; fix passes that make new scope calls must update `scopeNote` in the same edit.

### Category A vs Category B

Not all conventions relate to "system" the same way:

- **Category A — convention-identical across systems.** Stayman, Blackwood, Jacoby Transfers, Smolen, NMF, Negative Doubles, Bergen, Michaels, DONT, Garbage Stayman. These play the same way in SAYC, 2/1, Precision, Acol. System differences (invitational threshold, 1NT range) are expressed as `system.*` facts over `SystemConfig`, not by swapping authorities. One fixture, one authority, system-fact-gated edges.
- **Category B — system-constitutive.** natural-bids, strong-2c, weak-twos. These conventions *are* the system more than they are standalone agreements. Cohen writes about SAYC's Strong 2C; Hardy writes about 2/1's Strong 2C, and the treatments genuinely diverge. For these modules the authority legitimately depends on which system you're teaching.

Today all Category B modules cite a SAYC-tier authority (ACBL booklet or Cohen-on-SAYC). When 2/1 support lands, Category B modules may need a second authority field; until then, adding 2/1 knobs via `SystemConfig` is enough.

### When authority and modal play diverge

For rare / advanced variants:

- If modal play in the target audience uses a variant (e.g. RKC Blackwood, 4-way transfers, Feature-vs-Ogust responses), that variant lives in a **separate module**, not by swapping the base module's authority.
- The base module stays loyal to its authority. Extensions are additive (see Part 2).

---

## Part 2 — Module composition

### What "standalone" means

There are two possible meanings, and the codebase picks one:

- ✓ **Standalone at authoring time.** Each fixture is a self-contained unit, editable, verifiable against one authority, merge-reviewable as one file. This is what the architecture targets.
- ✗ **Standalone at runtime.** Each module, loaded alone, covers every reachable continuation without depending on another module. This would force duplication and guaranteed drift. We don't pursue this.

### Composition tools (in order of preference)

1. **Bundles** combine modules at runtime. `fixtures/nt-bundle.json` = stayman + jacoby-transfers + smolen. All three contribute surfaces to the same 1NT auction. Preferred for "these modules always run together."
2. **`delegate_to` FSM scope.** A module state can declare `scope: delegate_to: "<other-module>"`, meaning "this continuation belongs to another module; don't try to own it here." Preferred for additive modules that should not re-encode their base.
3. **Hardcoded dependency sets** (e.g. `SLAM_FIT_DEPENDENCIES` in `registry/bundle_registry.rs`) for narrow cases. Not a general mechanism.

### The `variantOf` field (clarification)

`variantOf` on a module fixture is **only** used in `registry/spec_builder.rs` to handle user-forked modules (IDs prefixed `user:`): a fork with `variantOf: X` replaces module `X` in the bundle at load time. Nothing else reads this field.

It is **not** an "extends" or "depends on" relationship. Do not use `variantOf` on authored fixtures to express dependency. If an authored fixture carries `variantOf` today (e.g. `jacoby-4way`, `stayman-garbage`), that is prose metadata only; the runtime ignores it.

### Planned schema addition: `requires`

We plan to add an optional `requires: string[]` field to `ModuleFixture` for the "A depends on B" case (e.g. `jacoby-4way` needs `jacoby-transfers` for major-suit continuations). Invariants:

- If module A has `requires: ["B"]`, every bundle that includes A must include B (structural invariant).
- When delegating states, `delegate_to: "<module-id>"` target must appear in `requires` (structural invariant).

This is not yet implemented. Until it is, bundle authors must manually co-include required modules.

### Conflict resolution when two modules own the same bid

Bundles do not currently enforce non-overlap of surface triggers. If two modules both define a surface for the same auction position, the pipeline picks by `specificity_score` (see `types/meaning.rs`), which is derived from clause tightness. Silent drift is possible.

Rule of thumb: **in any bundle, exactly one module should own a given bid meaning**. Use `delegate_to` to make ownership explicit at the FSM level. If this becomes a frequent footgun, add a bundle-level lint.

---

## Part 3 — Module scope decisions (2026-04-17)

After re-verifying all 14 modules against the new tier-1 authorities, the following scope decisions were made for modules where the fixture encoded meanings from multiple sources:

| Module | Decision | Effect |
|---|---|---|
| `stayman` | **Larry-regular only.** | Rewrite `3♣/3♦`, `3-of-other-major`, `3NT`, `4NT`, and `1NT-2♣-2♦-2♥` surfaces to match Larry's exact table. Add `4-of-lower-suit` splinter raises. Drop expanded Bridgebum meanings. |
| `stayman-garbage` | **Garbage/crawling only.** | Strip all non-garbage surfaces. Keep only weak `1NT-2♣` entry, opener's `2♦/2♥/2♠` replies, pass, Crawling `2♥` rebid, and opener's pass-or-correct. |
| `weak-twos` | **Feature responses (Larry-standard).** | Rewrite the `2NT` response tree to Feature-style (minimum = rebid same suit; non-minimum = show side ace/king; `3NT` = AKQ trump). Remove Ogust. A future `weak-twos-ogust` module can be authored separately if needed. |
| `jacoby-4way` | **Minor-transfer only (additive on jacoby-transfers).** | Delete the duplicated major-suit tree. Mark major-continuation states as `delegate_to: jacoby-transfers`. Any bundle including `jacoby-4way` must also include `jacoby-transfers`. |
| `strong-2c` (2NT-positive branch) | **Drop.** | Delete the `2NT` positive response and its continuation subtree. Balanced positives go through `2♦` waiting, per Larry. |

Three authority-independent bugs were also fixed in the same pass:

- `michaels-unusual`: Unusual `2NT` over `1♣` shows diamonds+hearts; over `1♦` shows clubs+hearts (was "both minors" for both).
- `negative-doubles`: `after-neg-dbl` state was empty; add Larry-backed opener-rebid continuations.
- `blackwood`: change `6NT` king reply to `6♣` for `0 or 4 kings` (plain Blackwood per Larry).

### Why these decisions

- **Teaching canonical over modal play.** Users learning a convention need stable semantics anchored to a single authority. Variants (Smolen, RKC, 4-way transfers, Ogust) live as separate modules the user can bundle in.
- **One authority per fixture.** Hybrid authoring (meanings from multiple sources) drifts silently. The verify cycle caught this most sharply in Stayman and Weak Twos.
- **Additive modules must delegate, not duplicate.** `jacoby-4way` had been re-encoding the major-transfer tree. With `delegate_to`, the extension is architecturally clean and the base module remains the single source of truth for major-transfer continuations.

---

## Related

- `docs/guides/convention-authoring.md` — authoring workflow (step-by-step).
- `docs/architecture/teaching-architecture.md` — meaning pipeline and grading.
- `.claude/skills/ConventionForge/SkillIntent.md` — skill-level design decisions for Build/Verify workflows.
- `crates/bridge-conventions/src/registry/spec_builder.rs` — the one place `variantOf` is read.
- `crates/bridge-conventions/tests/structural_invariants.rs` — fixture shape invariants.
