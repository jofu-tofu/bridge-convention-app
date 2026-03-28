# Gotchas & Historical Context

Detailed technical notes, historical context, and non-obvious decisions. Read when you encounter something surprising or need to understand "why."

## Engine & WASM

### No Pure-TS EnginePort (Details)
Browser builds require WASM (`WasmEngine`); desktop uses Tauri IPC (`TauriIpcEngine`). If `initWasm()` fails, the app shows an error screen — there is no fallback. The TS engine modules (`deal-generator.ts`, `auction.ts`, etc.) contain all the logic but are not wired into an `EnginePort` adapter. Vercel deploys install Rust + wasm-pack via `scripts/vercel-build.sh` and produce a real WASM build. Stub files (`scripts/ensure-wasm-stubs.sh`) are retained as a fallback if the WASM toolchain is unavailable.

### DDS Browser Implementation
DDS `solveDeal()` works in browser via Emscripten-compiled C++ DDS in a Web Worker (`dds-client.ts`). Par is always null in browser (mode=-1). `suggestPlay()` remains desktop-only. DDS WASM artifacts (`static/dds/`) are committed; rebuild with `npm run dds:build` (requires Emscripten).

### vendor/dds
`vendor/dds/` is an upstream DDS C++ source checkout and `vendor/dds-patches/` holds local Emscripten/build patches for producing the browser double-dummy WASM bundle (`static/dds/`); app-level bridge logic in `src/` and `src-tauri/` remains clean-room.

## Convention System

### Convention Imports Barrel Enforcement
External consumers import from `conventions/index.ts` barrel — deep imports into `conventions/core/`, `conventions/pipeline/`, `conventions/teaching/`, or `conventions/definitions/` are ESLint-blocked. UI components should import convention types only through `service/index.ts`.

### All Conventions Use Meaning Pipeline
No tree/protocol/overlay pipeline remains. `ConventionConfig` is minimal (id, name, description, category, dealConstraints, teaching); convention logic lives in `ConventionBundle` with `meaningSurfaces`, `conversationMachine`, `factExtensions`, `explanationCatalog`. Deal constraints are DERIVED from capabilities + R1 surface analysis by `deriveBundleDealConstraints()` — not hand-authored on `BundleInput`. All teaching content (surface groups, alternatives) is auto-derived from module structure. No manual tags, scope annotations, or derivation files needed.

### Convention-Specific Details
- Bergen Raises uses Standard Bergen (3C=constructive 7-10, 3D=limit 10-12, 3M=preemptive 0-6, splinter with shortage 12+)
- Only duplicate bridge scoring implemented (rubber bridge out of scope for V1)

## CLI

### CLI Rule Enumeration
All CLI commands (`list`, `plan`, `selftest`, `describe`, `bundles`) use `enumerateRuleAtoms()` / `generateRuleCoverageManifest()` from `conventions/pipeline/rule-enumeration.ts`. Atom ID format: `moduleId/meaningId`. The old FSM-based BFS enumeration has been removed. Selftest uses strategy-driven forward auction construction instead of FSM path targeting.

## Deal Generation

### Rejection Sampling
Deal generator uses flat rejection sampling (no relaxation) with configurable `maxAttempts`, `minLengthAny` OR constraints, and `customCheck` escape hatch. `minLengthAny` is OR (any suit meets minimum), not AND.

## Architecture Reference

### Convention Deal Constraints
| Convention | Opener Constraints | Responder Constraints |
|---|---|---|
| Stayman | North: 15-17 HCP, balanced, no 5-card major | South: 8+ HCP, 4+ card major |
| DONT | East: 15-17 HCP, balanced (opens 1NT) | South: shape for DONT overcall |
| Bergen Raises | North: 12-21 HCP, 5+ card major | South: 6-12 HCP, 4+ card support |

### Screen Flow
```
ConventionSelect → GameScreen (Bidding) → GameScreen (Playing) → ExplanationScreen
                                                                     ↓
                                                              "Back to Menu" → ConventionSelect
                                                              "Next Deal" → GameScreen (Bidding)
```

### V1 → V2 Migration Path
- **Storage:** V2 replaces localStorage with SQLite via `tauri-plugin-sql` for stats/progress tracking
- **Mobile:** If Tauri 2.0 mobile insufficient, frontend lifts into Capacitor shell. Engine has zero Tauri imports.

## Learning Screen Vision

The learning screen should render meaning surfaces as multiple synchronized views — not one static flowchart — so a generic renderer can teach *any* convention without custom screens.

**Four planned views:**
1. **Guided Flow** — user inputs auction context + hand features; UI walks the next discriminating question
2. **Explorable Map** — meaning surfaces grouped by conversation machine state
3. **Cheat Sheet** — "lookup under time pressure" keyed by auction trigger → call → meaning
4. **Practice / Quiz Mode** — retrieval practice with spacing

**Learning science principles applied:** Cognitive load theory (progressive disclosure, segmenting), worked examples → faded practice (expertise reversal effect), retrieval practice (Roediger & Karpicke), spaced practice (Cepeda).

**Current status:** LearningScreen shell exists with sidebar + about card. Surface→display adapter, guided flow, quiz mode, and skill-adaptive presentation are not yet started. The research strongly supports one source of truth (meaning surfaces + fact catalog) → multiple rendered views.

## Total Points & System Facts

### `TotalPointEquivalent.nt` is display-only
`TotalPointEquivalent.nt` values (Profiles screen reference) are NOT used in runtime fact evaluation. Only `.trump` is used at runtime by system-fact relational evaluators when `fitAgreed` is present. Standard bridge uses HCP for NT evaluation.

### System facts auto-detect HCP vs trump TP via `fitAgreed`
System facts (`system.responder.inviteValues`, etc.) use `fitAgreed` from the negotiation kernel to detect trump context — not `bindings.suit`. `bindings.suit` means "parameterized suit" (not "agreed suit"). Using it for system facts would mis-detect non-support modules (e.g., a future "New Suit Response" module parameterized with `$suit` is not a fit agreement). Both standard (HCP-only) and relational (fitAgreed-aware) evaluators exist for these facts — the standard evaluator runs as baseline, and the relational evaluator overrides when relational context is provided.
