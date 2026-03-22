# Convention Definitions

Convention bundles that each implement a bridge bidding convention using the meaning pipeline. Each bundle is self-contained with deal constraints, meaning surfaces, fact extensions, rule modules (RuleModule), and teaching metadata.

## Folder Structure

**Shared files** (at `definitions/` root):
- `teaching-vocabulary.ts` — 6 general-purpose tags (`SAME_FAMILY`, `STRONGER_THAN`, `CONTINUATION_OF`, `NEAR_MISS_OF`, `FALLBACK_OF`, `ALTERNATIVES`). Modules annotate surfaces with these + a scope string to express any pedagogical relationship.
- `derive-cross-module.ts` — `deriveTeachingContent(modules)` — derives all pedagogical relations, alternatives, and intent families from `teachingTags` on surfaces. Groups by `(tagId, scope)`. Supports ordinal chains for strength progressions. Called by `aggregateModuleContent()` in `system-registry.ts`.
- `surface-group-vocabulary.ts` — *(Removed. Cross-module surface groupIds are now defined locally in modules.)*
- `pedagogical-scope-vocabulary.ts` — Type-safe scope constants (branded `PedagogicalScope` type) for `teachingTags` scopes. Replaces free-form strings.
- `system-registry.ts` — System definitions (including NT sub-bundle systems), module aggregation. Defines bundles directly via `buildBundle()` and exports them. `getSystemBundle()`, `listSystemBundles()`, `specFromBundle()`.
- `module-registry.ts` — Convention module registry.
- `capability-vocabulary.ts` — Stable host-attachment capability IDs (`CAP_OPENING_1NT`, `CAP_OPENING_MAJOR`, `CAP_OPENING_WEAK_TWO`, `CAP_OPPONENT_1NT`).
- `system-fact-vocabulary.ts` (in `core/contracts/`) — System-provided fact IDs that modules reference for system-dependent thresholds and properties. Modules import these IDs, never concrete system configs.

**Architectural rule:** ALL pedagogical content (relations, alternatives, intent families) — both intra-module and cross-module — is derived from `teachingTags` on surfaces. `ConventionModule` has no `teachingRelations`, `alternatives`, or `intentFamilies` fields. Modules are portable building blocks: compose any set into a bundle and pedagogical content derives automatically. Do not create standalone `pedagogical-relations.ts` or `alternatives.ts` files.

4 convention bundles: `nt-bundle/`, `bergen-bundle/`, `weak-twos-bundle/`, `dont-bundle/`. Each folder has a parallel set of modules:

| File | Purpose |
|------|---------|
| `config.ts` | Re-export from system-registry (thin shim) |
| `meaning-surfaces.ts` | `BidMeaning[]` definitions — the core bidding logic (single-module bundles). In multi-module bundles like nt-bundle, this is `composed-surfaces.ts` (cross-module composition re-exports). |
| `facts.ts` | `FactCatalogExtension`s for module-derived facts. Use factory helpers from `core/pipeline/fact-factory.ts` for common patterns. |
| `semantic-classes.ts` | Module-local semantic class constants (not in central registry) |
| `system-profile.ts` | `SystemProfile` for profile-based module activation |
| `explanation-catalog.ts` | `ExplanationCatalog` entries for teaching projections |
| `module.ts` | *(dont-bundle, weak-twos-bundle only)* Single-module convention definition |
| `index.ts` | Barrel exports |
| `__tests__/` | Bundle-specific tests |


**`nt-bundle/`** — Bottom-up composition of Stayman + Jacoby Transfers + Smolen + Natural NT into a single 1NT response bundle. Each convention is a self-contained `ConventionModule` in `modules/`; the bundle is assembled from `RuleModule` rule claims via `bundleFromRuleModules()`.
- `modules/` — Convention modules (source of truth for all bidding logic):
  - `stayman.ts` — Stayman convention: R1 surface (2C ask), opener response surfaces (show-hearts/spades/deny-major), R3 continuation surfaces, 4 FSM states with exportTags, 2 facts + posterior evaluators.
  - `jacoby-transfers.ts` — Jacoby Transfers convention: R1 surfaces (2D/2H transfer), opener accept surfaces, R3 continuation surfaces, 8 FSM states with exportTags, 5 facts.
  - `smolen.ts` — Smolen convention: R3 surfaces (3H/3S after 2D denial), opener placement surfaces, 2 FSM states + submachine (5 states) with exportTags, hooks into Stayman's R3-2D state via `hookTransitions`, 6 facts.
  - `natural-nt.ts` — Natural NT responses: R1 surfaces (2NT invite, 3NT game), 1NT opening surface, R1 terminal transitions, shared explanation entries.
  - `natural-nt-rules.ts` — RuleModule for natural-nt (phases: idle/opened/responded). No negotiationDelta needed (INITIAL_NEGOTIATION correct for opening/R1).
  - `stayman-rules.ts` — RuleModule for Stayman (phases: idle/asked/shown-hearts/shown-spades/denied/inactive). Claims carry `negotiationDelta` for forcing/captain effects.
  - `jacoby-transfers-rules.ts` — RuleModule for Jacoby Transfers (phases: idle/inactive/transferred-*/accepted-*/placing-*/invited-*). Claims carry `negotiationDelta` for forcing/fitAgreed/captain effects.
  - `smolen-rules.ts` — RuleModule for Smolen (phases: idle/post-r1/placing-hearts/placing-spades/done). Claims carry `negotiationDelta` for game-forcing/fitAgreed/captain effects. Proof case: uses route pattern `subseq([inquire(majorSuit), deny(majorSuit)])` instead of hookTransitions.
- `config.ts` — Re-exports `ntBundle` from `system-registry.ts`.
- `sub-bundles.ts` — Stayman-only and Transfer-only sub-bundles via `buildBundle()`, auto-composing pedagogical content from module subsets.
- `composed-surfaces.ts` — Cross-module composition re-exports. `RESPONDER_SURFACES` assembled from modules; individual arrays re-exported from owning modules.
- `semantic-classes.ts` — Re-export shim from modules.
- `explanation-catalog.ts` — Composed from all modules' explanation entries.

**`bergen-bundle/`** — Bergen Raises using the meaning pipeline with `$suit` binding parameterization for hearts and spades.
- `config.ts` — `ConventionBundle` with `meaningSurfaces` (13 groups), `factExtensions`, `ruleModules`. `memberIds: ["bergen-raises"]`. `internal: true` (parity testing). Activation handled by `systemProfile: BERGEN_PROFILE`.
- `meaning-surfaces.ts` — `createBergenR1Surfaces(suit)` factory producing 5 surfaces per suit (splinter, game, limit, constructive, preemptive) parameterized by `$suit` bindings. Also includes R2–R4 surfaces.
- `facts.ts` — 1 `FactCatalogExtension`: `bergenFacts` for `module.bergen.hasMajorSupport` (hearts ≥ 4 or spades ≥ 4). Uses `buildExtension()` from fact-factory.
- `modules/bergen/bergen-rules.ts` — RuleModule for Bergen (15 phases: idle/opened-H/S/after-constructive-H/S/after-limit-H/S/after-preemptive-H/S/after-game/after-signoff/after-game-try-H/S/r4/done). Includes stub 1H/1S opening surfaces with `MajorOpen` intent for phase transitions. Claims carry captain/fitAgreed kernel deltas.

## Convention Quick Reference

- **NT Bundle (1NT Responses):** Stayman (2C ask for 4-card majors) + Jacoby Transfers (2D→hearts, 2H→spades) + Smolen (3H/3S game-forcing after 2D denial with 5-4 majors). 35 meaning surfaces, 4 fact extensions, 15-state hierarchical FSM with per-module scope states (`stayman-scope`, `transfers-scope`, `smolen-scope`) for scoped opponent interrupts + 5-state Smolen submachine (first real convention to use submachine invocation with guard-based routing). Deal constraints: opener 15–17 HCP balanced, responder 6+ HCP with 4+ in any major.
- **Bergen Bundle (Bergen Raises):** Responder raises after 1M opening. Standard Bergen variant (3C=constructive 7–10, 3D=limit 10–12, 3M=preemptive 0–6, splinter 12+). `$suit` binding factory for DRY heart/spade parameterization. Deal constraints: opener 12–21 HCP with 5+ major, responder 0+ HCP with 4+ major.
- **Weak Two Bundle:** Weak Two openings (2D/2H/2S) with Ogust responses. `modules/weak-twos/weak-twos-rules.ts` — RuleModule (11 phases: idle/opened-H/S/D/ogust-asked-H/S/D/post-ogust-H/S/D/done). Ogust ask carries `forcing: "one-round"` kernel delta. Deal constraints: opener 5–10 HCP with 6+ in a suit, responder 12+ HCP.
- **DONT Bundle (Disturbing Opponent's No Trump):** Competitive overcalls after opponent's 1NT. `modules/dont/dont-rules.ts` — RuleModule (11 phases: idle/r1/after-2h/2d/2c/2s/double/wait-reveal/wait-2d-relay/wait-2c-relay/done). **No `match.turn`** — uses phase + route scoping because `deriveTurnRole()` classifies the overcaller as "opponent". Includes stub 1NT opening surface for phase transitions. 9 surface groups, 24 surfaces, 21 facts. Deal constraints: East 15–17 HCP (NT opener), South 8–15 HCP with 5+ in any suit.

## Convention Bundle Completeness Checklist

Every convention bundle must satisfy all items before being considered complete:

1. **`meaningSurfaces` with grouped surfaces.** At least one surface group with `groupId` and `surfaces` array. Every surface needs `meaningId`, `encoding`, `clauses` (with `factId`, `operator`, `value`), and `ranking` (`band`, `declarationOrder`). `modulePrecedence` defaults to 0 — do NOT set it on surfaces. **Specificity is pipeline-derived from the communicative dimensions of the surface's clauses** — do NOT set it on surfaces. All `FactDefinition` objects must declare `constrainsDimensions` (required field).
2. **`factExtensions` for module-derived facts.** Any fact referenced in surface clauses that isn't in the shared `BRIDGE_DERIVED_FACTS` must be defined in a `FactCatalogExtension` in `facts.ts`. Evaluators must be pure functions of hand/auction state. Use factory helpers (`defineBooleanFact`, `definePerSuitFacts`, `defineHcpRangeFact`, `buildExtension`) from `core/pipeline/fact-factory.ts` for common patterns.
3. **`ruleModules` for surface selection.** `RuleModule[]` with phases, phase transitions, and rules. Each rule declares turn role, phase match, optional route/kernel constraints, and surfaces to emit. The rule interpreter (`collectMatchingClaims()`) handles surface selection.
4. **`systemProfile` for activation.** Profile-based module activation via `SystemProfile`.
6. **`dealConstraints` with HCP ranges and shape requirements.** Per-seat `minHcp`/`maxHcp` and `minLengthAny`/`maxLength` as appropriate.
7. **`category` and `description` are required** on `ConventionBundle`. `registerBundle()` auto-derives `ConventionConfig` — no separate wrapper needed.
8. **`explanationCatalog` entries.** Template-keyed explanations for teaching projections. Each entry links a `factId` to display text and contrastive templates.
9. **`systemProfile` IR.** Profile-based module activation metadata.
10. **`teachingTags` on surfaces.** All surfaces participating in pedagogical relations or grading alternatives must have `teachingTags` annotations using the 6 general tags from `teaching-vocabulary.ts`. No separate `pedagogical-relations.ts` or `alternatives.ts` files.
12. **`semantic-classes.ts` constants.** Module-local semantic class strings. Do not add to central registry — keep them co-located with the surfaces that reference them.

## Type Reference

### ConventionConfig (`core/contracts/convention.ts`)

The minimal registry interface. Auto-derived by `registerBundle()` from `ConventionBundle` fields.

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `id` | Yes | `string` | Unique convention identifier (kebab-case). Used as registry key and URL parameter. |
| `name` | Yes | `string` | Human-readable display name. |
| `description` | Yes | `string` | One-line description for UI display. |
| `category` | Yes | `ConventionCategory` | One of `Asking`, `Defensive`, `Constructive`, `Competitive`. |
| `teaching` | No | `ConventionTeaching` | Convention-level teaching metadata (purpose, whenToUse, whenNotToUse, tradeoff, principle, roles). |
| `dealConstraints` | Yes | `DealConstraints` | Seat-specific HCP, shape, and balanced constraints for deal generation. |
| `defaultAuction` | No | `(seat, deal?) => Auction \| undefined` | Returns pre-filled auction for drill start position. Return `undefined` for empty auction. |
| `internal` | No | `boolean` | If `true`, hidden from UI picker. |
| `allowedDealers` | No | `readonly Seat[]` | Random dealer selection; constraints rotate 180° when dealer differs from `dealConstraints.dealer`. |

### ConventionBundle (`core/bundle/bundle-types.ts`)

The full bundle interface — the primary authoring surface for new conventions.

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `id` | Yes | `string` | Unique bundle identifier (kebab-case). |
| `name` | Yes | `string` | Human-readable display name. |
| `memberIds` | Yes | `readonly string[]` | Convention IDs this bundle implements. Order matters for tie-breaking priority. |
| `internal` | No | `boolean` | If `true`, hidden from UI picker (e.g., parity testing). |
| `dealConstraints` | Yes | `DealConstraints` | Seat-specific HCP, shape, and balanced constraints. |
| `offConventionConstraints` | No | `DealConstraints` | Anti-constraints for off-convention drills (hands where the convention doesn't apply). Used by `startDrill()` when `DrillTuning.includeOffConvention` is set. |
| `defaultAuction` | No | `(seat, deal?) => Auction \| undefined` | Pre-filled auction for drill start. |
| `meaningSurfaces` | No* | `readonly { groupId: string; surfaces: readonly BidMeaning[] }[]` | Meaning surfaces organized by group. When present, the meaning pipeline is used. |
| `factExtensions` | No | `readonly FactCatalogExtension[]` | Module-derived fact definitions for surface clause evaluation. |
| `systemProfile` | No | `SystemProfile` | Profile-based module activation. |
| `declaredCapabilities` | No | `Readonly<Record<string, string>>` | Capabilities injected into profile-based activation. Bundles without this get none. |
| `category` | Yes | `ConventionCategory` | Convention category for UI grouping. |
| `description` | Yes | `string` | Human-readable description for UI display. |
| `teaching` | No | `ConventionTeaching` | Convention-level teaching metadata (purpose, whenToUse, whenNotToUse, tradeoff, principle, roles). |
| `allowedDealers` | No | `readonly Seat[]` | Random dealer selection; constraints rotate 180° when dealer differs from `dealConstraints.dealer`. |
| `ruleModules` | No | `readonly RuleModule[]` | Rule-based convention modules for surface selection via `collectMatchingClaims()`. |
| `explanationCatalog` | Yes | `ExplanationCatalog` | Explanation catalog for enriching teaching projections. |
| `teachingRelations` | Yes | `readonly TeachingRelation[]` | Derived from `teachingTags` on surfaces by `deriveTeachingContent()`. |
| `acceptableAlternatives` | Yes | `readonly AlternativeGroup[]` | Derived from `teachingTags` on surfaces by `deriveTeachingContent()`. |
| `intentFamilies` | Yes | `readonly IntentFamily[]` | Derived from `teachingTags` on surfaces (currently empty for all bundles). |

*Required in practice for a meaning-pipeline convention, though TypeScript marks it optional.

## File Templates

Skeleton templates for a new convention bundle. Replace `{name}` with bundle ID (kebab-case), `{Name}` with PascalCase name, `{NAME}` with SCREAMING_CASE.

### config.ts

Thin re-export from `system-registry.ts`. The bundle is defined in the system registry; `config.ts` re-exports it for backward compatibility.

```ts
// Re-export the bundle from system-registry
export { {name}Bundle } from "../system-registry";
```

### meaning-surfaces.ts

```ts
import { BidSuit } from "../../../engine/types";
import { bid } from "../../core/surface-helpers";
import { createSurface } from "../../core/surface-builder";
import type { ModuleContext } from "../../core/surface-builder";
import { {NAME}_SEMANTIC } from "./semantic-classes";

const {NAME}_CTX: ModuleContext = { moduleId: "{name}" };

export const {NAME}_SURFACES: readonly BidMeaning[] = [
  createSurface({
    meaningId: "{name}:surface-name",
    semanticClassId: {NAME}_SEMANTIC.MY_CLASS,
    encoding: bid(2, BidSuit.Clubs),
    clauses: [
      { factId: "hand.hcp", operator: "gte", value: 10 },
      { factId: "hand.suitLength.clubs", operator: "gte", value: 4 },
    ],
    band: "should",
    declarationOrder: 0,
    sourceIntent: { type: "MyBid", params: {} },
    teachingLabel: "My bid",
    // Optional: surfaceBindings: { suit: "hearts" } for parameterized surfaces
    // Optional: description on clauses — only when adding parenthetical rationale
  }, {NAME}_CTX),
  // Additional surfaces...
];
```

### facts.ts

```ts
import type { FactCatalogExtension } from "../../../core/contracts/fact-catalog";
import {
  defineBooleanFact,
  defineHcpRangeFact,
  buildExtension,
  type FactEntry,
} from "../../core/pipeline/fact-factory";

// Use factory helpers for common patterns; hand-write complex evaluators as FactEntry
export const {name}Facts: FactCatalogExtension = {
  moduleId: "{name}",
  ...buildExtension([
    defineBooleanFact({
      id: "module.{name}.hasSuit",
      description: "Has 4+ cards in suit",
      factId: "hand.suitLength.hearts",
      operator: "gte",
      value: 4,
      constrainsDimensions: ["suitIdentity"],
    }),
    defineHcpRangeFact({
      id: "module.{name}.inRange",
      description: "HCP in range for this bid",
      range: { min: 10, max: 15 },
    }),
    // Hand-written FactEntry for complex evaluators:
    // { definition: { ... }, evaluator: ["factId", (hand, auction, memo) => ...] },
  ]),
};
```

### {name}-rules.ts (RuleModule)

```ts
import type { RuleModule } from "../../core/rule-module";
import { {NAME}_SURFACES } from "./meaning-surfaces";

export const {name}Rules: RuleModule = {
  moduleId: "{name}",
  phases: ["idle", "opened", "responded", "done"],
  initialPhase: "idle",
  phaseTransitions: [
    { from: "idle", obs: { type: "BidAction", call: { type: "bid", level: 1, suit: "notrump" } }, to: "opened" },
    // Additional transitions...
  ],
  rules: [
    {
      phase: "opened",
      match: { turn: "responder" },
      surfaces: {NAME}_SURFACES,
      // Optional: route, kernel, negotiationDelta
    },
    // Additional rules...
  ],
};
```

### semantic-classes.ts

```ts
/** Module-local semantic classes for {Name} surfaces.
 *  NOT registered in the central BRIDGE_SEMANTIC_CLASSES registry. */
export const {NAME}_SEMANTIC = {
  MY_CLASS: "{name}:my-class",
  ANOTHER_CLASS: "{name}:another-class",
} as const;
```

### system-profile.ts

```ts
import type { SystemProfile } from "../../../core/contracts/agreement-module";

export const {NAME}_PROFILE: SystemProfile = {
  profileId: "{name}-profile",
  modules: [
    {
      moduleId: "{name}",
      description: "Description of what this module provides",
      activationConditions: [
        // Conditions under which this module is active
      ],
    },
  ],
};
```

### explanation-catalog.ts

```ts
import type { ExplanationCatalog } from "../../../core/contracts/explanation-catalog";
import { createExplanationCatalog } from "../../../core/contracts/explanation-catalog";

const {NAME}_ENTRIES = [
  {
    explanationId: "{name}.hcp.threshold",
    factId: "hand.hcp",
    templateKey: "{name}.threshold.met",
    displayText: "You have enough HCP for this bid",
    contrastiveTemplateKey: "{name}.threshold.missed",
    contrastiveDisplayText: "You don't have enough HCP for this bid",
    preferredLevel: "semantic" as const,
    roles: ["supporting", "blocking"] as const,
  },
  // Additional entries...
];

export const {NAME}_EXPLANATION_CATALOG: ExplanationCatalog =
  createExplanationCatalog("{name}", {NAME}_ENTRIES);
```

*(No separate `pedagogical-relations.ts` or `alternatives.ts` needed — use `teachingTags` on surfaces instead.)*

## Adding a Convention Bundle

1. Create `definitions/{name}-bundle/` folder with the modules listed in the Folder Structure table above.
2. Define `BidMeaning[]` in `meaning-surfaces.ts`. Each surface needs `meaningId`, `encoding` (the `Call`), `clauses` (fact-based conditions), `semanticClass`, and `ranking`. Use the factory pattern with `$suit` bindings when parameterizing across suits.
3. Define `FactCatalogExtension`s in `facts.ts` for any module-specific facts referenced by surface clauses. Use factory helpers from `core/pipeline/fact-factory.ts` for common patterns.
4. Define module-local semantic class constants in `semantic-classes.ts`.
5. Define `RuleModule` in `{name}-rules.ts`. Declare phases, phase transitions (observation patterns that advance the local FSM), and rules (phase + turn + optional route/kernel constraints → surfaces).
6. Define `SystemProfile` in `system-profile.ts`.
7. Populate `ExplanationCatalog` in `explanation-catalog.ts` with template-keyed explanations.
8. Add `teachingTags` to surfaces using the 6 general tags from `teaching-vocabulary.ts`. Use scope strings to group related surfaces.
9. Wire `config.ts` as a thin re-export from `system-registry.ts`.
10. Create `index.ts` barrel with re-exports.
11. Create `__tests__/` with at minimum: surface evaluation tests and config/factory E2E tests.
12. Run the completeness checklist above before considering the bundle complete.

## Authoring Rules

- **Use `createSurface()` for all new surfaces.** Import from `conventions/core/surface-builder.ts` with a `ModuleContext`. The builder derives `clauseId` and `description` automatically. Provide `description` only when it adds parenthetical rationale beyond the mechanical constraint (test: contains `(`). `moduleId` is injected from `ModuleContext`. `modulePrecedence` defaults to 0 — not hand-authored.
- **Modules are portable.** A module must work in any bundle. Never import from other modules. Never reference foreign surface IDs. Use `teachingTags` with shared vocabulary scopes for cross-module relationships.
- **Adding a module must not edit existing modules.** If your new module needs to relate to existing ones (same-family, near-miss, etc.), use shared scope strings in `teachingTags`. The derivation function handles the wiring.
- **Cross-module groupIds must use shared constants.** Never use string literals for groupIds that another module also references.
- **Use scope constants from `pedagogical-scope-vocabulary.ts`** for `teachingTags` scopes. The branded `PedagogicalScope` type catches typos at compile time. Do not use free-form strings.
- **Generalize before specializing.** When a convention needs a capability that doesn't exist in `core/`, design the solution to work for any convention — not just yours. If the abstraction only makes sense for one convention, it belongs in `definitions/{name}-bundle/`, not in `core/`.
- **System-fact-gated surfaces for cross-system modules.** When a bid has different meanings in different systems (e.g., jump shift: strong in SAYC, weak in 2/1), author surfaces for ALL meanings in the same module. Gate each with a system fact clause (`{ factId: SYSTEM_SUIT_RESPONSE_IS_GAME_FORCING, operator: "eq", value: true/false }`). The pipeline evaluates all surfaces and selects only those matching the active `SystemConfig`. Never create system-specific modules or branch on `systemId` in module code.

## Common Pitfalls

1. **Surface clause `factId` not in catalog.** Every `factId` referenced in a surface clause must either be in the shared `BRIDGE_DERIVED_FACTS` or defined in a `FactCatalogExtension` in `facts.ts`. Missing facts cause clauses to fail closed (treated as not satisfied).

2. **Reusing `meaningId` across surfaces.** Each surface must have a unique `meaningId`. Duplicates cause unpredictable surface selection.

3. **`$suit` binding errors in parameterized surfaces.** When using the factory pattern (like Bergen's `createBergenR1Surfaces(suit)`), clauses must reference the binding variable (e.g., `hand.suitLength.$suit`) and the surface must include a `bindings: { suit }` field. Missing bindings cause clause evaluation to fail.

4. **Missing `category` or `description` on bundle.** Both are required on `ConventionBundle`. `registerBundle()` auto-derives `ConventionConfig` from these fields.

5. **Hand-authoring clauseId/description in surfaces.** These are auto-derived by the builder and pipeline. Only provide `description` when adding convention-specific rationale in parentheses.

6. **Semantic class IDs are module-local.** Define them in `{bundle}/semantic-classes.ts`, not in the central `BRIDGE_SEMANTIC_CLASSES`. Adding a convention does NOT require editing the central registry.

7. **Phase transition vs route matching confusion.** Phase transitions (`phaseTransitions` in RuleModule) advance the local FSM state — they are actor-agnostic and fire on observation shape. Route matching (`RouteExpr` in rules) filters which surfaces are active — it supports actor-aware patterns. Do not conflate the two.

## Test Organization

```
definitions/
  __tests__/
  nt-bundle/__tests__/
    explanation-catalog.test.ts          Explanation catalog entry tests
    sub-bundles.test.ts                  Sub-bundle composition tests
    system-profile.test.ts               Profile activation tests
  bergen-bundle/__tests__/
    config-factory-e2e.test.ts           Bundle config + factory integration
    golden-master.test.ts                Golden master snapshot tests
    surface-evaluation.test.ts           Surface clause evaluation tests
  weak-twos-bundle/__tests__/
    golden-master.test.ts                Golden master snapshot tests
    surface-evaluation.test.ts           Surface clause evaluation tests
  dont-bundle/__tests__/
    bundle-composition.test.ts           Bundle composition tests
    surface-evaluation.test.ts           R1 overcaller + reveal + relay response tests

__tests__/                          (at src/conventions/__tests__/)
  fixtures.test.ts                 Shared test helper tests
  fixtures.ts                      Shared helpers (hand, auctionFromBids, makeBiddingContext)
  infrastructure/
    structural-health.test.ts      Structural health checks
    module-conventions.test.ts     Module convention enforcement tests
  nt-bundle/
    commitment-integration.test.ts Commitment-level integration tests
    fact-evaluation.test.ts        Fact catalog evaluation tests
    machine-integration.test.ts    Pipeline integration tests
    profile-tests.test.ts          Profile-based activation tests
    snapshot-integration.test.ts   Snapshot-based regression tests
```

Bundle-local tests (`definitions/{name}-bundle/__tests__/`) test individual modules in isolation. Cross-cutting integration tests (`src/conventions/__tests__/nt-bundle/`) test the full pipeline end-to-end.

## New Convention Checklist

Step-by-step for adding a new convention. All work stays inside `src/conventions/definitions/`.

1. **Create the module** in `modules/<name>/index.ts`. Export a `ConventionModule` with `moduleId`, `surfaces`, `facts`, and `explanationEntries`. Supporting files go alongside it:
   - `meaning-surfaces.ts` — `BidMeaning[]` definitions
   - `facts.ts` — `FactCatalogExtension` for module-derived facts
   - `explanation-catalog.ts` — `ExplanationCatalog` entries
   - `semantic-classes.ts` — module-local semantic class constants
2. **Create the RuleModule** in `modules/<name>/<name>-rules.ts`. Define phases, claims with `ObsPattern`/`RouteExpr`/`NegotiationExpr`, and `negotiationDelta` where needed.
3. **Create the bundle** in `<name>-bundle/`. Minimum files:
   - `system-profile.ts` — `SystemProfile` for activation
   - `config.ts` — thin re-export from `system-registry.ts`
   - `index.ts` — barrel re-export
   - `__tests__/` — machine, surface evaluation, and golden-master tests
4. **Register the module** in `module-registry.ts`: import the `ConventionModule` and add it to `ALL_MODULES`.
5. **Define the bundle** in `system-registry.ts`: import the profile and `RuleModule`, define the bundle via `buildBundle()`, and register it.
6. **Verify:**
   - `npm run lint` — confirms no boundary violations (ESLint enforces module isolation)
   - `npm run test:run` — all existing + new tests pass
   - `npx tsx src/cli/main.ts selftest` — end-to-end pipeline selftest passes

## Boundary Contract

Adding a new convention is a **definitions-only** change. The following directories must NOT be modified:

| Directory | Reason |
|-----------|--------|
| `src/engine/` | Bridge engine types/logic are convention-agnostic |
| `src/strategy/` | Strategy layer consumes bundles generically via `meaningBundleToStrategy()` |
| `src/teaching/` | Teaching system reads `ExplanationCatalog` and `TeachingRelation[]` from bundles |
| `src/service/` | Service layer is convention-agnostic orchestration |
| `src/stores/` | Stores bind to the convention registry, not individual conventions |
| `src/components/` | UI renders from generic `ConventionConfig` and `DecisionSurfaceEntry[]` |
| `src/conventions/core/` | Pipeline infrastructure is convention-universal (see `core/CLAUDE.md`) |
| `src/core/contracts/` | Shared contracts are stable; adding a new fact type is a separate task |

If any of these need changes to support a new convention, the boundary has leaked and the core architecture should be fixed instead. ESLint import boundaries enforce this at build time -- a convention that compiles and passes lint has respected the contract.

## Design Decisions

- **Why ConventionConfig is kept as a separate DTO:** UI/stores should consume minimal types, not full pipeline bundles with 20+ fields. ConventionConfig is the stable UI contract — auto-derived by `registerBundle()`.
- **Why explicit registration over auto-discovery:** Explicit `registerBundle()` calls are traceable and debuggable. Auto-discovery adds implicit ordering and makes registration non-obvious.
- **Why two layers (Bundle → Config) not three:** BiddingSystem added no fields or behavior that ConventionBundle didn't already provide. The indirection created wiring fragility without architectural benefit.
- **Why PedagogicalScope lives in definitions, not contracts:** Scope strings are convention-specific vocabulary. Contracts contains only convention-agnostic types. Enforcement via scope constants catches errors at authoring time without polluting the contracts tier.

---

## Context Maintenance

**After modifying files in this directory:** scan the entries above — if any claim is now
false or incomplete, update this file before ending the task. Do not defer.

**Staleness anchor:** This file assumes `nt-bundle/config.ts`, `bergen-bundle/config.ts`, `weak-twos-bundle/config.ts`, and `dont-bundle/config.ts` exist.
If any is missing, this file is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-03-03 | last-audited=2026-03-22 | version=9 | dir-commits-at-audit=unknown | tree-sig=dirs:6,files:90+,exts:ts:88+,md:1 -->
