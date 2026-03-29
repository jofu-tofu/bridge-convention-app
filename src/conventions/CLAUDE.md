# Conventions

Convention definitions for bridge bidding practice. Each convention is authored as a `ConventionBundle` with meaning surfaces, fact extensions, convention modules (`ConventionModule`), and a system profile.

## Architecture

- **Designed for 100+ modules.** The module/bundle system scales to hundreds of convention modules composed into arbitrary bundles. Adding a module never requires editing existing modules or core infrastructure. Registries, derivation, and composition are all O(N).
- **Registry pattern.** All conventions register via `registerBundle()` in `core/`, which auto-derives and registers `ConventionConfig`. No separate `registerConvention()` calls needed. Never hardcode convention logic in switch statements.
- **Contract boundary.** Cross-module DTOs live in their owning subsystems (conventions/core/, inference/, etc.); convention internals must not leak across the service boundary.
- **Five-way split.** `core/` contains stable infrastructure (runtime, registry, strategy contract types). `pipeline/` contains the meaning pipeline (surfaces → facts → evaluation → arbitration). `teaching/` contains teaching resolution, projection, and parse-tree builders — derived views over pipeline results. `definitions/` contains convention modules and bundles. `adapter/` bridges convention pipeline → BiddingStrategy interface (meaning-strategy, protocol-adapter, practical-scorer). Convention-specific logic belongs in `definitions/`, never in `core/`, `pipeline/`, `teaching/`, or `adapter/`.
- **Bounded-context barrel.** `index.ts` is the single public API for external consumers. Import from the barrel, not deep paths (e.g., `conventions/core/registry` or `conventions/pipeline/meaning-evaluator`). ESLint enforces this boundary.
- **Auto-registration.** `index.ts` imports each convention and calls `registerBundle()`, which auto-derives `ConventionConfig`. No `convention-config.ts` wrappers needed.

**Context tree:**
- `core/CLAUDE.md` — rule interpreter, runtime, witness, strategy contract types, test architecture
- `pipeline/CLAUDE.md` — meaning pipeline (fact evaluation, surface evaluation, arbitration, encoding)
- `teaching/CLAUDE.md` — teaching resolution, projection builder, parse-tree builder
- `adapter/CLAUDE.md` — convention→strategy bridge (meaning-strategy, protocol-adapter, practical-scorer)

## Convention Authoring (Meaning Pipeline)

A convention bundle provides:
1. **`meaningSurfaces`** — grouped by `surfaceGroupId`, each surface has clauses (fact conditions), encoding (default call), ranking, and teachingLabel
2. **`factExtensions`** — module-derived facts (e.g., `module.stayman.eligible`) with evaluator functions. Use factory helpers in `conventions/pipeline/fact-factory.ts` for common patterns (boolean comparison, per-suit, HCP range).
3. **`modules`** — `ConventionModule[]` for declarative surface selection via `collectMatchingClaims()`. Each module has `local` (LocalFsm with phases + phase transitions) and `states` (StateEntry[] — surfaces grouped by conversation state with phase/turn/route/kernel constraints and group-level `negotiationDelta`). Modules are resolved by `buildBundle()` from `memberIds` via module-registry.
4. **`systemProfile`** — `SystemProfile` declaring modules and attachments

**Pedagogical content is auto-derived.** Surface groups are automatically derived from module structure (`deriveSurfaceGroupsFromModules` in `system-registry.ts`) — each state entry with 2+ surfaces forms a `mutually_exclusive` group. Cross-module alternatives are handled via `truthSetCalls` in `teaching-resolution.ts` (candidates in the truth set that encode a different call than the primary). No manual teaching tags or scope annotations needed.

## Convention Module Authoring Rules

When creating or modifying convention modules under `definitions/modules/`:

1. **Export raw parts, not assembled modules.** Module files (`modules/*.ts`) export `LocalFsm`, `StateEntry[]` (or factory), and `{ facts, explanationEntries }` factory. System-config-parameterized modules export factory functions (e.g., `createStaymanStates(sys)`). The module-registry is the ONLY place `ConventionModule` is assembled from these raw parts.

2. **Never import concrete system configs.** Modules must not import `SAYC_SYSTEM_CONFIG` or `TWO_OVER_ONE_SYSTEM_CONFIG`. They receive `SystemConfig` via the factory parameter. This is enforced by ESLint `no-restricted-imports`.

3. **Use named constants for HCP thresholds.** All numeric values in surface clauses must come from a named constants object (e.g., `BERGEN_THRESHOLDS`, `WEAK_TWO_THRESHOLDS`), not inline literals. Register new threshold objects in `__tests__/infrastructure/module-conventions.test.ts`. This is enforced by the structural test.

4. **System-dependent vs convention-intrinsic.** System-dependent thresholds (e.g., invite/game HCP) use system facts (`system.responder.inviteValues`). Convention-intrinsic thresholds (e.g., Bergen splinter = 12+ HCP) use named constants. If unsure, use system facts — they're the safer default.

5. **Profile builder.** Use `createSystemProfile({ baseSystem, ... })` for building system profiles.

6. **Use branded factory functions for all authored text fields.** Import `bidName()`, `bidSummary()`, etc. from `core/authored-text.ts`. `teachingLabel` on surfaces is a `TeachingLabel` object (`{ name: BidName, summary: BidSummary }`), not a plain string. Module `description` and `purpose` use `moduleDescription()` and `modulePurpose()`. Teaching fields use `teachingTradeoff()`, `teachingPrinciple()`, `teachingItem()`.

## Test Organization

Convention-specific tests live in `__tests__/<convention-name>/` (e.g., `__tests__/nt-bundle/`). Core infrastructure tests live in `__tests__/infrastructure/` and use synthetic fixtures — zero imports from `definitions/`.

## Gotchas

- Deal constraint `minLengthAny` is OR (any suit meets minimum), not AND
- Shape indices follow `SUIT_ORDER`: [0]=Spades, [1]=Hearts, [2]=Diamonds, [3]=Clubs
- Conventions with `internal: true` are filtered from the UI by `filterConventions()` in `src/components/screens/filter-conventions.ts`

## Rust Type Mirror

All convention data types have Rust equivalents in `src-tauri/crates/bridge-conventions/`.
The Rust types are data-only (no evaluator functions). TS `FactCatalogExtension` maps to
Rust `FactDefinitionSet`. When modifying type shapes in TS, update the Rust mirror and
re-export fixtures via `npx tsx scripts/export-conventions.ts`.

---

## Context Maintenance

**After modifying files in this directory:** scan the entries above — if any claim is now
false or incomplete, update this file before ending the task. Do not defer.

**Staleness anchor:** This file assumes `core/registry.ts` exists. If it doesn't, this file
is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-03-14 | last-audited=2026-03-22 | version=15 | dir-commits-at-audit=60 -->
