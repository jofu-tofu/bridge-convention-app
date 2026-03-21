# Core

Shared infrastructure modules consumed across the codebase. Contains three subdirectories, each with its own CLAUDE.md:

- **`display/`** — Presentation utilities (formatting, tokens, sorting, scaling)
- **`contracts/`** — Cross-boundary DTOs and strategy interfaces
- **`util/`** — Zero-dependency pure utilities (delay, seeded-rng)

Top-level files:

- **`phase-machine.ts`** — Pure phase state machine (`GamePhase`, `VALID_TRANSITIONS`, `isValidTransition()`). No Svelte deps.

---

## Context Maintenance

**Staleness anchor:** This file assumes `display/format.ts` exists. If it doesn't, this file is stale.

<!-- context-layer: generated=2026-03-07 | version=1 | tree-sig=dirs:7,files:30+ -->
