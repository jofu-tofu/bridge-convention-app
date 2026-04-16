# Bridge Practice App

Bridge bidding convention practice app. SvelteKit + Svelte 5 + strict
TypeScript on the UI; bridge logic runs in Rust/WASM. Two route groups:
`(app)` is client-only WASM; `(content)` is prerendered SEO content.

## Workflow Routing

Read the narrowest context that matches the task before editing:

- **UI or route work** → `src/components/CLAUDE.md`, `src/stores/CLAUDE.md`, `src/service/CLAUDE.md`
- **Rust engine/session/convention work** → `crates/CLAUDE.md` and the relevant crate-local docs
- **Convention authoring or auditing** → `docs/guides/convention-authoring.md`, then `src/cli/CLAUDE.md` for CLI verification
- **CLI evaluation work** → `src/cli/CLAUDE.md` and `docs/guides/cli-evaluation.md`
- **Testing work** → `docs/guides/testing-philosophy.md`, `src/test-support/CLAUDE.md`, and `tests/CLAUDE.md`
- **Local debug params or route shortcuts** → `docs/guides/dev-tools.md`
- **Deployment or release work** → `docs/guides/deployment.md`, `docs/product/product-direction.md`, and `infra/README.md`
- **Local staging / manual auth+billing smoke** → `docs/guides/local-staging.md` (docker-compose stack with real Google OAuth + Stripe test mode; covers gaps in the Playwright billing suite)
- **SEO, learn pages, or product framing** → `docs/product/product-direction.md` plus the relevant `docs/research/` topic

## Commands

| Command                                          | Purpose                                                  |
| ------------------------------------------------ | -------------------------------------------------------- |
| `npm run dev`                                    | Build WASM (if needed) + start dev server (port 1420)    |
| `npm run build`                                  | Build WASM + SvelteKit production build (includes prerendered SEO pages) |
| `npm run static:extract`                         | Build bridge-static binary + extract learn JSON to `.generated/learn-data.json` (run before vite build) |
| `npm run wasm:build`                             | Build WASM (release)                                     |
| `npm run wasm:dev`                               | Build WASM (debug, faster)                               |
| `npm run check`                                  | Svelte type-check                                        |
| `npx tsc --noEmit`                               | TypeScript type-check                                    |
| `npm run test`                                   | Vitest watch mode                                        |
| `npm run test:run`                               | Vitest single run                                        |
| `npm run test:coverage`                          | Coverage report (90% branches, 90% functions, 85% lines) |
| `npm run test:e2e`                               | Playwright E2E tests                                     |
| `npm run test:all`                               | Unit + E2E together                                      |
| `npm run lint`                                   | ESLint check                                             |
| `npm run lint:fix`                               | ESLint auto-fix                                          |
| `npm run lint:dead`                              | Report unused files/dead references via Knip             |
| `npm run lint:full`                              | `npm run lint` plus dead-reference check                 |
| `npx tsx src/cli/main.ts selftest --bundle=<id>` | Strategy self-consistency check                          |
| `npm run format`                                 | Prettier format all files                                |
| `npm run format:check`                           | Prettier check (CI)                                      |
| `cargo test --workspace`                         | Run all Rust tests                                       |
| `cargo build --workspace`                        | Build all Rust crates                                    |
| `cargo run -p bridge-api --features dev-tools`   | e2e only: enables `/api/dev/login` + mock Stripe ops     |

## Deployment

Keep deployment procedure out of always-loaded context. For release, rollback,
pipeline, and secret details, read `docs/guides/deployment.md`.

Short version: deploy = tag and push; GitHub Actions builds and publishes the
image, then updates the VPS runtime. Deployment rationale lives in
`docs/product/product-direction.md`. Repo-local Docker/Caddy assets live in
`infra/`.

## Dev Tools

Keep local debug params and route shortcuts out of root context. Read
`docs/guides/dev-tools.md` when you need URL params, route-entry shortcuts, CLI
pairing, or UI test IDs.

## Code Hygiene

- Fix lint errors and warnings in files you touch.
- Delete dead code immediately; do not hide it with `_` prefixes or comments.
- `npm run lint` is app-scoped, not a whole-workspace sweep.
- ESLint guards architecture boundaries; Knip handles dead-file checks.

## Conventions

- `src/engine/` stays pure: no Svelte or DOM imports.
- UI and CLI import only from `service/`; never directly from backend logic.
- Use Svelte 5 runes; no legacy `$:` reactivity.
- Use named exports; no `export default`, no `const enum`.
- Avoid `any`; annotate unavoidable cases with `// any: <reason>`.
- Do not mock own modules; prefer dependency injection.
- Game UI reads viewports, not raw `Deal` objects.
- Test behavior through public interfaces; characterize unknown behavior before changing it.
- Playwright is for smoke and shell flows, not convention matrices.
- E2E billing/auth specs require a `dev-tools`-feature bridge-api binary; `npm run test:e2e` starts it automatically via `playwright.config.ts`.

## System Parameterization

- Multi-system support flows through Rust `SystemConfig`; modules stay system-agnostic.
- `SessionConfig` always carries full `SystemConfig` plus `baseModuleIds`; Rust never resolves config IDs.
- `SystemSelectionId` is TS-only and never crosses the WASM boundary.
- UI displays HCP only; formula-composed point totals stay in decision logic.
- Base modules merge into `spec_from_bundle()` only, not `resolve_bundle()`.
- Deal constraints for drill generation are auto-derived from the union of surface preconditions across target-bundle modules + base-system modules (`bridge_conventions::fact_dsl::inversion::derive_deal_constraints`). Never hand-author `dealConstraints` in bundle fixtures. Deals are rejection-sampled (budget 32) until the user's expected bid matches a target-module surface; on exhaustion, `tracing::warn` fires and the last deal is used.

## Architecture

- Dependency direction: `components -> stores -> service -> Rust crates`; `cli/commands -> service`; auth flows through `/api/* -> bridge-api`.
- `service/` is a thin WASM proxy. UI layers should not bypass it.
- `bridge-api` is independent of game crates and owns auth/user data.
- Game phases: `BIDDING -> DECLARER_PROMPT -> PLAYING -> EXPLANATION`.
- Backend convention/session/service logic has already migrated to Rust/WASM.

## Gotchas

- `npm run dev` handles WASM bootstrap and HMR; do not restart it after normal source edits.
- Browser app requires WASM; no JS fallback exists.
- Build browser WASM with `wasm-pack`, not plain `cargo build`.
- Tailwind v4 uses `@tailwindcss/vite` before `sveltekit()` in `vite.config.ts`.
- `vitest.config.ts` sets browser conditions and SvelteKit mock aliases; use ES imports in tests.
- Svelte `{#each}` blocks must be keyed.
- MC+DDS play lives in Rust/WASM; DDS is injected at service init.
- Detailed edge cases belong in `docs/guides/gotchas.md`.

**Context tree:** `src/components/`, `src/stores/`, `src/service/`, `src/cli/`, `src/test-support/`, `crates/`, `crates/bridge-static/`, and `tests/` each have their own `CLAUDE.md`.

**E2E policy:** Use Playwright for user-visible stability, not per-convention seed matrices.

## Reference Knowledge (docs/)

The `docs/` folder is organized into categories:

```
docs/
  architecture/    Design decisions, specs, migration history
  guides/          Practical how-tos (convention authoring, CLI, gotchas, testing, typography)
  product/         Product direction, roadmap, personas
  research/        Evidence-based research (SEO, etc.)
```

Start with `docs/README.md` when the right home for a topic is unclear. Root `docs/` should stay thin: category indexes only, with topic docs living inside the appropriate subtree.

Agents do not need docs for routine work. **Read from docs/ when:**

- **Architecture or refactors** → `docs/architecture/README.md` and `docs/architecture/design-philosophy.md`
- **Conventions or CLI evaluation** → `docs/guides/convention-authoring.md` and `docs/guides/cli-evaluation.md`
- **Deployment or local debug workflows** → `docs/guides/deployment.md` and `docs/guides/dev-tools.md`
- **Product, personas, or monetization** → `docs/product/product-direction.md` and `docs/product/personas/README.md`
- **SEO, FTUE, pedagogy, or reference-page research** → the relevant topic under `docs/research/`
- **Gotchas or testing policy** → `docs/guides/gotchas.md` and `docs/guides/testing-philosophy.md`

**Read docs/ before working.** If your task touches a topic covered by any doc (architecture, conventions, deployment, SEO, product direction, testing, etc.), you MUST read the relevant doc first. Do not rely on memory or assumptions — read the current state before making decisions or writing code.

**Update docs/ after changing things.** If your work makes a design decision, changes behavior documented in docs, invalidates an assumption, or resolves an open question tracked in docs, you MUST update the affected doc in the same session — not as a follow-up. Code changes and doc updates ship together.

Specific update triggers:

- A design decision is made that future agents should know about → update
  `docs/architecture/design-philosophy.md` or `docs/guides/gotchas.md`
- A spec status changes (open question resolved, phase completed) → update
  `docs/architecture/architecture-specs.md` or `docs/product/roadmap.md`
- The target audience or user-needs framing changes materially → update
  `docs/product/personas/README.md` and the affected files in `docs/product/personas/`
- A non-obvious gotcha is discovered during implementation → add to `docs/guides/gotchas.md`
- SEO-related implementation decisions → update `docs/research/seo-principles-web-apps/evidence-map.md`
  recommendations section if approach differs from what evidence suggested

---

## Context Maintenance

**Directory-level CLAUDE.md updates are mandatory.** When a session adds, removes, or renames files in a directory that has a `CLAUDE.md`, update that `CLAUDE.md` before committing. This includes:

- Adding new files to the architecture table
- Removing entries for deleted files
- Updating descriptions when module responsibilities change
- Bumping the `last-audited` date and `version` in the context-layer comment

Do not defer CLAUDE.md updates to a follow-up task. The update is part of the change.

**After modifying files in this project:** scan the entries above — if any claim is now
false or incomplete, update this file before ending the task. Do not defer.

**Add** an entry only if an agent would fail without knowing it, it is not obvious from
the code, and applies project-wide (not just one directory).

**Remove** any entry that fails the falsifiability test: if removing it would not change
how an agent acts, remove it. If a convention here conflicts with the codebase, the
codebase wins — update this file, do not work around it. Prune aggressively.

**docs/ knowledge base:** When a session makes a design decision, resolves an open question,
or discovers a non-obvious gotcha, update the relevant file in `docs/`. See § Reference
Knowledge above for when to read vs. update.

**Track follow-up work:** After modifying files, evaluate whether changes create incomplete
work, shift a phase status, or break an assumption tracked elsewhere. If so, create a task
or update the Phase Tracking table before ending the session. Do not leave implicit TODOs.

**Staleness anchor:** This file assumes `src/engine/types.ts` exists. If it doesn't, this file
is stale — update or regenerate before relying on it.

**Trigger Audit or Generate:**

- Rename/move files or dirs → Audit
- > 20% of files changed → Generate
- 30+ days without touching this file → Audit
- Agent mistake caused by this file → fix immediately, then Audit

<!-- context-layer: generated=2026-02-20 | last-audited=2026-04-12 | version=30 | dir-commits-at-audit=67 | tree-sig=dirs:19,files:100+ -->
