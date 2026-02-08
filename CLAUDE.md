# Bridge Practice App

## Project Identity

Desktop app for drilling bridge bidding conventions (Stayman, Gerber, DONT, Bergen Raises). Built with Tauri 2.0 + Svelte 5 + TypeScript strict.

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Desktop | Tauri | 2.x |
| Frontend | Svelte | 5.x (runes) |
| Language | TypeScript | 5.6 (strict) |
| Build | Vite | 6.x |
| Unit Tests | Vitest | 3.x |
| E2E Tests | Playwright | 1.x |

## File Structure

```
src/
  engine/          Pure TS game logic (zero platform deps)
    __tests__/     Unit tests colocated with source
  conventions/     Convention definitions
  ai/              AI drill logic
  components/      Svelte UI components
  stores/          Svelte stores
tests/
  e2e/             Playwright E2E tests
```

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server (port 1420) |
| `npm run build` | Build production bundle |
| `npm run check` | Svelte type-check |
| `npx tsc --noEmit` | TypeScript type-check |
| `npm run test` | Vitest watch mode |
| `npm run test:run` | Vitest single run |
| `npm run test:coverage` | Coverage report with thresholds |
| `npm run test:e2e` | Playwright E2E tests |
| `npm run test:all` | Unit + E2E together |

## Architecture Principles

- **Pure engine.** `src/engine/` has zero imports from svelte, tauri, or DOM APIs. All game logic is pure TypeScript.
- **Registry pattern.** Use registries for conventions and strategies. Avoid hardcoded switch statements over enums.
- **EnginePort abstraction.** UI communicates with engine through defined interfaces. Engine never imports from UI.
- **Svelte 5 runes.** Use `$state`, `$derived`, `$effect`. No legacy `$:` reactive statements.

## Testing

Run `npm run test:all` to verify everything. Coverage thresholds: 90% branches, 90% functions, 85% lines.

See **TESTING.md** for the full testing playbook.

## Hard Rules

1. **No DOM in engine** — `src/engine/` must never import svelte, tauri, or browser APIs
2. **No mocking own modules** — Use dependency injection instead
3. **No `const enum`** — Breaks Vite/isolatedModules; use regular `enum`
4. **No `export default`** — Named exports only for greppability
5. **No `any` without comment** — If required, annotate with `// any: <reason>`

## Phase Tracking

| Phase | Status | Description |
|-------|--------|-------------|
| 0 | Done | Scaffold, types, testing pipeline, CLAUDE.md |
| 1 | Pending | Hand, Deck, BiddingSequence, HCP calculator |
| 2 | Pending | Convention registry + Stayman implementation |
| 3 | Pending | AI opponent engine |
| 4 | Pending | Drill UI with feedback |
| 5 | Pending | Tauri desktop integration |
