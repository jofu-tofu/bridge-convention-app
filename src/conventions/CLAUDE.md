# Conventions

Convention definitions for bridge bidding practice. Each convention is authored as a `ConventionBundle` with meaning surfaces, fact extensions, a conversation machine (FSM), and a system profile.

## Architecture

- **Designed for 100+ modules.** The module/bundle system scales to hundreds of convention modules composed into arbitrary bundles. Adding a module never requires editing existing modules or core infrastructure. Registries, derivation, and composition are all O(N).
- **Registry pattern.** All conventions register via `registerConvention()` and bundles via `registerBundle()` in `core/`. Never hardcode convention logic in switch statements.
- **Contract boundary.** Cross-module DTOs come from `src/core/contracts/`; convention internals must not leak across that boundary.
- **Core vs definitions split.** `core/` contains stable infrastructure (pipeline, runtime, registry). `definitions/` contains convention modules and bundles. Convention-specific logic belongs in `definitions/`, never in `core/`.
- **Auto-registration.** `index.ts` imports each convention and calls `registerConvention()`/`registerBundle()`.

**Context tree:**
- `core/CLAUDE.md` — meaning pipeline, FSM, runtime, witness, test architecture

## Convention Authoring (Meaning Pipeline)

A convention bundle provides:
1. **`meaningSurfaces`** — grouped by `surfaceGroupId`, each surface has clauses (fact conditions), encoding (default call), ranking, optional `closurePolicy`, and optional `teachingTags`
2. **`factExtensions`** — module-derived facts (e.g., `module.stayman.eligible`) with evaluator functions
3. **`conversationMachine`** — FSM tracking auction progression, producing `surfaceGroupId` per state and `MachineEffect` per transition
4. **`systemProfile`** — `SystemProfile` declaring modules, attachments, exclusivity groups
5. **`surfaceRouter`** — function mapping (auction, seat) → active surfaces (legacy; machine-based routing preferred)

**Pedagogical content is tag-derived.** Modules do NOT declare `teachingRelations`, `alternatives`, or `intentFamilies` fields. Instead, surfaces carry `teachingTags` using 6 general tags from `definitions/teaching-vocabulary.ts`. When modules are composed into a bundle, `deriveTeachingContent()` scans all surfaces and produces the appropriate relations/alternatives automatically. This makes modules portable — compose any set into a bundle and it works.

## Test Organization

Convention-specific tests live in `__tests__/<convention-name>/` (e.g., `__tests__/nt-bundle/`). Core infrastructure tests live in `__tests__/infrastructure/` and use synthetic fixtures — zero imports from `definitions/`.

## Gotchas

- Deal constraint `minLengthAny` is OR (any suit meets minimum), not AND
- Shape indices follow `SUIT_ORDER`: [0]=Spades, [1]=Hearts, [2]=Diamonds, [3]=Clubs
- Conventions with `internal: true` are filtered from the UI by `filterConventions()` in `src/core/display/filter-conventions.ts`

---

## Context Maintenance

**After modifying files in this directory:** scan the entries above — if any claim is now
false or incomplete, update this file before ending the task. Do not defer.

**Staleness anchor:** This file assumes `core/registry.ts` exists. If it doesn't, this file
is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-03-14 | last-audited=2026-03-14 | version=12 | dir-commits-at-audit=60 -->
