# Design Philosophy

Principles that guide architectural decisions across the codebase. Read this before making design choices with multiple viable approaches.

## Core Principles

1. **Design for 100+ modules.** Every interface, registry, and derivation mechanism must scale to 100+ convention modules composed into many bundles. No O(N²) cross-references between modules; no hand-authored wiring that grows with module count. If adding a new module requires editing existing modules or shared files (beyond the vocabulary), the design is wrong.

2. **Modules are portable building blocks.** A module must work correctly when composed into ANY bundle — not just the one it was written for. Modules never import from other modules. Cross-module relationships emerge from shared vocabulary tags, not explicit references to foreign IDs. Test: if you move a module from bundle A to bundle B, does everything still derive correctly?

3. **Convention-universality is the litmus test.** When choosing between design approaches, ask: "does this work for all conventions — including ones we haven't written yet?" If you can imagine a convention where approach A breaks, A is the wrong approach. Never optimize for a single convention at the expense of generality.

4. **Contain complexity through modularity.** Low impact radius (changes to one convention don't ripple), clean module boundaries (runtime/pipeline are separate subsystems), and convention-agnostic infrastructure that never assumes convention-specific structure.

5. **Semantic ownership: fields belong where they mean something.** Before adding a field to a type, ask: "does this describe what this type IS, or is it metadata about how something else uses it?" Derive what you can from existing data; don't store what can be computed.

6. **No backwards compatibility during migrations.** When refactoring types or interfaces, delete the old versions immediately. Do not keep deprecated shims or backward-compat aliases — removing them lets the compiler surface every call site that needs updating, ensuring the migration is completed fully rather than left half-done.

7. **Hexagonal architecture: service as the port.** `ServicePort` is the hexagonal port — all game logic lives behind it, and all UI consumers (stores, components) call through it. This enables: (1) server-side deployment of convention logic, (2) tiered WASM builds, (3) a remote service adapter replacing `local-service.ts`. When evaluating any change, ask: "does this work if service runs on a different machine?" If it requires the UI to import backend types directly, it's wrong.

8. **Refactor before feature work.** When a new feature would be cleaner with a structural change, do the refactor first as a separate step — then build the feature on the clean foundation. The codebase must stay clean at all times; never bolt a feature onto messy code when a refactor would make the integration natural.

9. **Bundle-specific knowledge stays in the bundle.** Infrastructure modules (`inference/`, `conventions/core/`, `conventions/pipeline/`) must not contain convention-specific fact IDs, heuristics, or special-case logic. If a behavior differs between conventions, the bundle declares it (e.g., `isPublic` on clauses) and the framework reads the declaration.

10. **System-agnostic modules, system-aware facts.** Modules never import concrete system configs or branch on system identity. System-level differences (HCP thresholds, forcing durations) are expressed as `SystemConfig` fields, surfaced as system facts via `system-fact-vocabulary.ts`, and referenced in surface clauses.

11. **Test behavior, not implementation.** Tests assert WHAT the code does, never HOW it does it. A test must pass unchanged after a legitimate refactoring (different algorithm, changed internals, added caching). If you must change tests to refactor code, the tests are coupled to implementation. Test the public contract: given these inputs, expect these outputs. This applies at every layer — engine unit tests verify bidding/scoring behavior, convention tests verify pipeline outputs, component tests verify what the user sees.

12. **Functional core, imperative shell.** Separate pure logic from side effects so testing is trivial. Pure functions (engine, conventions, inference) need no mocks — pass data in, assert data out. Side effects (WASM init, localStorage, DOM) live at the edges. Code that is hard to test is poorly designed; fix the design, don't add mocks. This principle is why `src/engine/` has zero framework imports and why the service boundary exists.

13. **Static HTML for SEO, WASM for interaction.** Learn pages are pre-rendered as static HTML at build time for search engine discoverability; a Rust binary (`bridge-static`) extracts viewport JSON from `bridge-session`, a Node script (`build-learn-html.ts`) renders it to HTML. The WASM app is not hydrated on static pages — they are standalone, no-JS documents. The SPA is one click away via practice CTAs.

14. **Characterize before changing.** When modifying code you don't fully understand, write characterization tests first — tests that capture current behavior as-is, without judging correctness. These act as a safety net: if your refactor changes behavior unintentionally, a characterization test fails. Especially important for convention pipeline logic where subtle bid-evaluation changes can cascade.

## Subsystem Design Rationale

### Stores: Correct-path-only bidding
Only the #1 truth-set winner (`BidGrade.Correct`) advances the auction. All other grades block with feedback and require retry. Wrong bids are never applied to the auction — the user sees feedback, retries, and the auction state is unchanged. Rationale: convention surfaces are authored for specific auction paths; allowing non-primary bids to proceed creates uncharted pipeline states.

### Stores: Convention-exhausted = Pass
When `conventionStrategy` exists but `suggest()` returns null (weak hand, second-round bid with no surfaces), the expected bid is Pass. The user's bid is graded against Pass.

### Service: IP Protection Affordance
The service boundary enables three future strategies:
- **Server-side evaluation**: Deploy `local-service.ts` on a server; convention definitions never leave the server
- **Tiered WASM**: Free tier WASM includes only free conventions; paid tier includes all
- **Hybrid**: Free conventions client-side, premium conventions server-side

### Definitions: ConventionConfig as separate DTO
UI/stores should consume minimal types, not full pipeline bundles with 20+ fields. ConventionConfig is the stable UI contract — auto-derived by `registerBundle()`.

### Definitions: Explicit registration over auto-discovery
Explicit `registerBundle()` calls are traceable and debuggable. Auto-discovery adds implicit ordering and makes registration non-obvious.

### Definitions: Two layers (Bundle → Config) not three
BiddingSystem added no fields or behavior that ConventionBundle didn't already provide. The indirection created wiring fragility without architectural benefit.
