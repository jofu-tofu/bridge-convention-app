# Conventions

Convention definitions for bridge bidding practice. Each convention is authored as a `ConventionBundle` with meaning surfaces, fact extensions, a conversation machine (FSM), and a system profile.

## Architecture

- **Registry pattern.** All conventions register via `registerConvention()` and bundles via `registerBundle()` in `core/`. Never hardcode convention logic in switch statements.
- **Contract boundary.** Cross-module DTOs such as `BiddingContext` come from `src/core/contracts/`; convention internals must not leak `core/` types across that boundary.
- **One folder per convention/bundle.** Each convention in `definitions/` is a folder. Bundles (nt-bundle/, bergen-bundle/) contain meaning surfaces, facts, machine, profile. See `definitions/nt-bundle/` as the reference implementation.
- **Convention-universal infrastructure.** Every abstraction in `core/` must work for all conventions — current and future. Convention-specific logic belongs in `definitions/`, never in `core/`. See root `CLAUDE.md` § Design Philosophy.
- **Core vs definitions split.** `core/` contains stable infrastructure (pipeline, runtime, registry, witness). `definitions/` contains convention folders.
- **Auto-registration.** `index.ts` imports each convention and calls `registerConvention()`/`registerBundle()`. Importing `conventions/index` activates all conventions.

**Context tree:**
- `core/CLAUDE.md` — meaning pipeline, FSM, runtime, witness, test architecture

## Convention Authoring (Meaning Pipeline)

A convention bundle provides:
1. **`meaningSurfaces`** — grouped by `surfaceGroupId`, each surface has clauses (fact conditions), encoding (default call), ranking, and optional `closurePolicy` for entailed denials
2. **`factExtensions`** — module-derived facts (e.g., `module.stayman.eligible`) with evaluator functions
3. **`conversationMachine`** — FSM tracking auction progression, producing `surfaceGroupId` per state and `MachineEffect` per transition
4. **`systemProfile`** — `SystemProfileIR` declaring modules, attachments, exclusivity groups
5. **`surfaceRouter`** — function mapping (auction, seat) → active surfaces (legacy; machine-based routing preferred)

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
