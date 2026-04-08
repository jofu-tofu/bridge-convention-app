# Gotchas & Historical Context

Detailed technical notes, historical context, and non-obvious decisions. Read when you encounter something surprising or need to understand "why."

## Engine & WASM

### WASM Required for Browser
All game logic runs in Rust via WASM (`WasmService`). If WASM init fails, the app shows an error screen — there is no fallback. TS engine modules (`deal-generator.ts`, `auction.ts`, etc.) exist as reference implementations but are not used at runtime. Vercel deploys install Rust + wasm-pack via `scripts/vercel-build.sh` and produce a real WASM build. Stub files (`scripts/ensure-wasm-stubs.sh`) are retained as a fallback if the WASM toolchain is unavailable.

### DDS Browser Implementation
DDS table analysis works via Emscripten-compiled C++ DDS in a Web Worker (`dds-client.ts`). The deal is extracted from the Rust service as a PBN string (`getDealPBN`), then sent to the worker for solving. `initDDS()` fires at app startup (fire-and-forget); `isDDSAvailable()` gates calls. Par is always null (mode=-1). DDS WASM artifacts (`static/dds/`) are committed; rebuild with `npm run dds:build` (requires Emscripten).

### vendor/dds
`vendor/dds/` is an upstream DDS C++ source checkout and `vendor/dds-patches/` holds local Emscripten/build patches for producing the browser double-dummy WASM bundle (`static/dds/`); app-level bridge logic in `src/` and `crates/` remains clean-room.

## DDS Architecture (Post-Migration)

- DDS runs via Emscripten C++ Web Worker in browser only
- `getDealPBN(handle)` extracts deal as PBN string from Rust service for DDS worker

## Convention System

### Convention System (Now in Rust)
Convention logic has been migrated to Rust (`bridge-conventions` crate). TS `src/conventions/` directory is deleted. All convention types, fact DSL, pipeline, teaching, and adapter logic live in Rust. UI components access convention data only through `service/index.ts` which proxies to WASM.

### All Conventions Use Meaning Pipeline
No tree/protocol/overlay pipeline remains. Convention logic lives in `ConventionBundle` with `meaningSurfaces`, `conversationMachine`, `factExtensions`, `explanationCatalog`. Deal constraints are DERIVED from capabilities + R1 surface analysis — not hand-authored. All teaching content is auto-derived from module structure.

### Convention-Specific Details
- Bergen Raises uses Standard Bergen (3C=constructive 7-10, 3D=limit 10-12, 3M=preemptive 0-6, splinter with shortage 12+)
- Only duplicate bridge scoring implemented (rubber bridge out of scope for V1)

## CLI

### CLI Rule Enumeration
All CLI commands (`list`, `plan`, `selftest`, `describe`, `bundles`) use rule enumeration via `ServicePort`. Atom ID format: `moduleId/meaningId`. Selftest uses strategy-driven forward auction construction instead of FSM path targeting.

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
- **Storage:** V2 replaces localStorage with SQLite via bridge-api for stats/progress tracking

## Learning Screen Vision

The learning screen should render meaning surfaces as multiple synchronized views — not one static flowchart — so a generic renderer can teach *any* convention without custom screens.

**Four planned views:**
1. **Guided Flow** — user inputs auction context + hand features; UI walks the next discriminating question
2. **Explorable Map** — meaning surfaces grouped by conversation machine state
3. **Cheat Sheet** — "lookup under time pressure" keyed by auction trigger → call → meaning
4. **Practice / Quiz Mode** — retrieval practice with spacing

**Learning science principles applied:** Cognitive load theory (progressive disclosure, segmenting), worked examples → faded practice (expertise reversal effect), retrieval practice (Roediger & Karpicke), spaced practice (Cepeda).

**Current status:** LearningScreen shell exists with sidebar + about card. Surface→display adapter, guided flow, quiz mode, and skill-adaptive presentation are not yet started. The research strongly supports one source of truth (meaning surfaces + fact catalog) → multiple rendered views.

## Multi-Trigger Conventions (FSM Phase Pattern)

When a convention module responds to multiple opponent openings with different cue bid encodings, use **separate FSM phases per trigger** — not one shared phase. Each r1 phase contains only the surfaces with the correct encoding for that trigger.

**Example:** Michaels uses 4 separate r1 phases (`r1-after-1c`, `r1-after-1d`, `r1-after-1h`, `r1-after-1s`) because the cue bid is 2C over 1C but 2D over 1D. DONT avoids this because all its overcalls occur after a single trigger (1NT).

## Game-Forcing Surface Discipline

Game-forcing behavior (e.g., Strong 2C after 2D waiting) is enforced by **omitting pass/signoff surfaces** from the relevant FSM phases. There is no runtime FSM guard. Authors must not add pass surfaces to game-forcing phases. If a pass IS legal (e.g., after 2NT rebid with 0-2 HCP), include it explicitly — the absence of pass is what creates the forcing effect.

## Total Points & System Facts

### System configs store suit TP only
`TotalPointEquivalent` now carries suit/trump total points only. NT evaluation and NT-facing profile display use HCP directly. Runtime system-fact relational evaluators read only `.trump` when `fitAgreed` is present.

### System facts auto-detect HCP vs trump TP via `fitAgreed`
System facts (`system.responder.inviteValues`, etc.) use `fitAgreed` from the negotiation kernel to detect trump context — not `bindings.suit`. `bindings.suit` means "parameterized suit" (not "agreed suit"). Using it for system facts would mis-detect non-support modules (e.g., a future "New Suit Response" module parameterized with `$suit` is not a fit agreement). Both standard (HCP-only) and relational (fitAgreed-aware) evaluators exist for these facts — the standard evaluator runs as baseline, and the relational evaluator overrides when relational context is provided.
