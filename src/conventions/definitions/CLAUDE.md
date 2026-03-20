# Convention Definitions

Convention bundles that each implement a bridge bidding convention using the meaning pipeline. Each bundle is self-contained with deal constraints, meaning surfaces, fact extensions, a conversation machine FSM, and teaching metadata.

## Folder Structure

**Shared files** (at `definitions/` root):
- `pedagogical-vocabulary.ts` — 6 general-purpose tags (`SAME_FAMILY`, `STRONGER_THAN`, `CONTINUATION_OF`, `NEAR_MISS_OF`, `FALLBACK_OF`, `ALTERNATIVES`). Modules annotate surfaces with these + a scope string to express any pedagogical relationship.
- `derive-cross-module.ts` — `derivePedagogicalContent(modules)` — derives all pedagogical relations, alternatives, and intent families from `pedagogicalTags` on surfaces. Groups by `(tagId, scope)`. Supports ordinal chains for strength progressions. Called by `aggregateModuleContent()` in `system-registry.ts`.
- `bidding-system.ts` — `BiddingSystem` interface for system-level composition.
- `system-registry.ts` — System definitions and module aggregation.
- `module-registry.ts` — Convention module registry.

**Architectural rule:** ALL pedagogical content (relations, alternatives, intent families) — both intra-module and cross-module — is derived from `pedagogicalTags` on surfaces. `ConventionModule` has no `pedagogicalRelations`, `alternatives`, or `intentFamilies` fields. Modules are portable building blocks: compose any set into a bundle and pedagogical content derives automatically. Do not create standalone `pedagogical-relations.ts` or `alternatives.ts` files.

4 convention bundles: `nt-bundle/`, `bergen-bundle/`, `weak-twos-bundle/`, `dont-bundle/`. Each folder has a parallel set of modules:

| File | Purpose |
|------|---------|
| `config.ts` | `ConventionBundle` object wiring all bundle modules together |
| `convention-config.ts` | Thin `ConventionConfig` wrapper for registry/UI compatibility |
| `convention-spec.ts` | `ConventionSpec` declarative specification — single source of truth for bundle metadata, deal constraints, and member declarations |
| `base-track.ts` | `BaseTrackTable` defining the FSM state→surface mapping as a declarative table. Used by `compose.ts` to build the conversation machine and surface routing. |
| `meaning-surfaces.ts` | `MeaningSurface[]` definitions — the core bidding logic (single-module bundles). In multi-module bundles like nt-bundle, this is `composed-surfaces.ts` (cross-module composition re-exports). |
| `facts.ts` | `FactCatalogExtension`s for module-derived facts |
| `semantic-classes.ts` | Module-local semantic class constants (not in central registry) |
| `machine.ts` | `ConversationMachine` FSM for hierarchical state tracking |
| `system-profile.ts` | `SystemProfileIR` for profile-based module activation |
| `explanation-catalog.ts` | `ExplanationCatalogIR` entries for teaching projections |
| `compose.ts` | Bundle composition from base-track table, convention spec, and module contributions |
| `packages/` | ModulePackage definitions for profile-based compilation |
| `module.ts` | *(dont-bundle, weak-twos-bundle only)* Single-module convention definition |
| `surface-routing.ts` | *(nt-bundle only)* `RoutedSurfaceGroup[]` for round-aware surface selection. Newer bundles use `base-track.ts` instead. |
| `index.ts` | Barrel exports |
| `__tests__/` | Bundle-specific tests |


**`nt-bundle/`** — Bottom-up composition of Stayman + Jacoby Transfers + Smolen + Natural NT into a single 1NT response bundle. Each convention is a self-contained `ConventionModule` (from `conventions/core/composition`) in `modules/`; the bundle is assembled by `compose.ts`.
- `modules/` — Convention modules (source of truth for all bidding logic):
  - ~~`module-types.ts`~~ — Removed. Was an alias for `ConventionModule` from `conventions/core/composition/module-types`. Import `ConventionModule` directly.
  - `stayman.ts` — Stayman convention: R1 surface (2C ask), opener response surfaces (show-hearts/spades/deny-major), R3 continuation surfaces, 4 FSM states, 2 facts + posterior evaluators.
  - `jacoby-transfers.ts` — Jacoby Transfers convention: R1 surfaces (2D/2H transfer), opener accept surfaces, R3 continuation surfaces, 4 FSM states, 3 facts.
  - `smolen.ts` — Smolen convention: R3 surfaces (3H/3S after 2D denial), opener placement surfaces, 2 FSM states + submachine (5 states), hooks into Stayman's R3-2D state via `hookTransitions`, 6 facts.
  - `natural-nt.ts` — Natural NT responses: R1 surfaces (2NT invite, 3NT game), 1NT opening surface, R1 terminal transitions, 3 HCP threshold facts, shared explanation entries.
- `compose.ts` — `composeNtModules()`: assembles `ConventionModule[]` bottom-up into shared FSM infrastructure (idle, nt-opened, responder-r1, terminal) with per-module scope states (`stayman-scope`, `transfers-scope`, `smolen-scope`) that each own an interrupted target state for opponent interference. Merges surface groups, combined facts/explanations/relations. Handles `hookTransitions` (e.g., Smolen prepending transitions to Stayman states).
- `config.ts` — `ConventionBundle` composed from all 4 modules. `memberIds: ["jacoby-transfers", "stayman", "smolen"]` (Jacoby first for tie-breaking priority).
- `sub-bundles.ts` — Stayman-only and Transfer-only sub-bundles, each composed from a subset of modules.
- `composed-surfaces.ts` — Cross-module composition re-exports. `RESPONDER_SURFACES` assembled from modules; individual arrays re-exported from owning modules.
- ~~`facts.ts`~~ — Removed. Facts (`staymanFacts`, `transferFacts`, `ntResponseFacts`, `smolenFacts`) are now re-exported directly from `modules/` via the barrel `index.ts`.
- `machine.ts` — Re-export shim: `createNtConversationMachine()` delegates to `composeNtModules()`.
- `semantic-classes.ts` — Re-export shim from modules.
- `explanation-catalog.ts` — Composed from all modules' explanation entries.
- ~~`pedagogical-relations.ts`~~ — Removed. All relations derived from `pedagogicalTags` on surfaces.
- ~~`alternatives.ts`~~ — Removed. All alternatives derived from `pedagogicalTags` on surfaces.
- `surface-routing.ts` — `NT_ROUTED_SURFACES` and `createNtSurfaceRouter()` for backward compatibility.

**`bergen-bundle/`** — Bergen Raises using the meaning pipeline with `$suit` binding parameterization for hearts and spades.
- `config.ts` — `ConventionBundle` with `meaningSurfaces` (13 groups), `factExtensions`, `surfaceRouter`, `conversationMachine`. `memberIds: ["bergen-raises"]`. `internal: true` (parity testing). Activation handled by `systemProfile: BERGEN_PROFILE`.
- `meaning-surfaces.ts` — `createBergenR1Surfaces(suit)` factory producing 5 surfaces per suit (splinter, game, limit, constructive, preemptive) parameterized by `$suit` bindings. Also includes R2–R4 surfaces. 604 lines total.
- `facts.ts` — 1 `FactCatalogExtension`: `bergenFacts` for `module.bergen.hasMajorSupport` (hearts ≥ 4 or spades ≥ 4).
- `machine.ts` — ~16-state hierarchical FSM using `bergen-active` abstract parent state that owns `opponent-action` interrupt transitions targeting local interrupted states. States: idle → major-opened-hearts/spades → responder-r1 → R2 (opener-after-constructive/limit/preemptive) → R3 (responder-after-opener-rebid) → R4 → terminal. Uses `surfaceGroupId` and `entryEffects` for `setCaptain`.
- ~~`alternatives.ts`~~ — Removed. Alternatives now derived from `pedagogicalTags` on surfaces.
- ~~`pedagogical-relations.ts`~~ — Removed. Relations now derived from `pedagogicalTags` on surfaces.

## Convention Quick Reference

- **NT Bundle (1NT Responses):** Stayman (2C ask for 4-card majors) + Jacoby Transfers (2D→hearts, 2H→spades) + Smolen (3H/3S game-forcing after 2D denial with 5-4 majors). 35 meaning surfaces, 4 fact extensions, 15-state hierarchical FSM with per-module scope states (`stayman-scope`, `transfers-scope`, `smolen-scope`) for scoped opponent interrupts + 5-state Smolen submachine (first real convention to use submachine invocation with guard-based routing). Deal constraints: opener 15–17 HCP balanced, responder 6+ HCP with 4+ in any major.
- **Bergen Bundle (Bergen Raises):** Responder raises after 1M opening. Standard Bergen variant (3C=constructive 7–10, 3D=limit 10–12, 3M=preemptive 0–6, splinter 12+). `$suit` binding factory for DRY heart/spade parameterization. Deal constraints: opener 12–21 HCP with 5+ major, responder 0+ HCP with 4+ major.
- **DONT Bundle (Disturbing Opponent's No Trump):** Competitive overcalls after opponent's 1NT. Pattern 3 convention — first to use hierarchical parent/child states (21-state FSM with `dont-active` parent providing inherited interference transitions), predicate transitions (for matching doubles), and multi-stage relay (overcaller → advancer → overcaller reveal). 9 surface groups, 24 surfaces, 21 facts. Deal constraints: East 15–17 HCP (NT opener), South 8–15 HCP with 5+ in any suit.

## Convention Bundle Completeness Checklist

Every convention bundle must satisfy all items before being considered complete:

1. **`meaningSurfaces` with grouped surfaces.** At least one surface group with `groupId` and `surfaces` array. Every surface needs `meaningId`, `encoding`, `clauses` (with `factId`, `operator`, `value`), and `ranking` (`band`, `modulePrecedence`, `intraModuleOrder`). **Specificity is pipeline-derived from the communicative dimensions of the surface's clauses** — do NOT set it on surfaces. All `FactDefinition` objects must declare `constrainsDimensions` (required field).
2. **`factExtensions` for module-derived facts.** Any fact referenced in surface clauses that isn't in the shared `BRIDGE_DERIVED_FACTS` must be defined in a `FactCatalogExtension` in `facts.ts`. Evaluators must be pure functions of hand/auction state.
3. **`surfaceRouter` for round-aware filtering.** Maps FSM state → surface group via `RoutedSurfaceGroup[]`. Without this, all surfaces are evaluated every round (expensive and semantically incorrect).
4. **`conversationMachine` FSM.** Tracks auction progress through states with transitions. States use `surfaceGroupId` to link to surface groups. Must include `idle`, at least one active state, and `terminal`. **Scoped interrupt pattern:** opponent interference is handled by abstract scope states (parent states with `opponent-action` transitions targeting local interrupted states) — not a single global contested sink. Design rule: external events are handled by the nearest enclosing interrupt scope. `call` and `any-bid` transitions are role-safe by default (self+partner only); use `opponent-action` with `callType: "bid"` to match opponent bids explicitly.
5. **`systemProfile` for activation.** Profile-based module activation via `SystemProfileIR`. The legacy `activationFilter` field is optional and no longer needed when `systemProfile` is present.
6. **`dealConstraints` with HCP ranges and shape requirements.** Per-seat `minHcp`/`maxHcp` and `minLengthAny`/`maxLength` as appropriate.
7. **`convention-config.ts` wrapper.** Thin `ConventionConfig` that maps bundle fields to the registry interface. Required for UI picker compatibility.
8. **`explanationCatalog` entries.** Template-keyed explanations for teaching projections. Each entry links a `factId` to display text and contrastive templates.
9. **`systemProfile` IR.** Profile-based module activation metadata.
10. **`pedagogicalTags` on surfaces.** All surfaces participating in pedagogical relations or grading alternatives must have `pedagogicalTags` annotations using the 6 general tags from `pedagogical-vocabulary.ts`. No separate `pedagogical-relations.ts` or `alternatives.ts` files.
12. **`semantic-classes.ts` constants.** Module-local semantic class strings. Do not add to central registry — keep them co-located with the surfaces that reference them.

## Type Reference

### ConventionConfig (`core/contracts/convention.ts`)

The minimal registry interface. Bundles expose this via `convention-config.ts` wrappers.

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
| `activationFilter` | No | `(auction, seat) => readonly string[]` | Legacy activation filter. Optional when `systemProfile` is present. |
| `meaningSurfaces` | No* | `readonly { groupId: string; surfaces: readonly MeaningSurface[] }[]` | Meaning surfaces organized by group. When present, the meaning pipeline is used. |
| `factExtensions` | No | `readonly FactCatalogExtension[]` | Module-derived fact definitions for surface clause evaluation. |
| `surfaceRouter` | No | `(auction, seat) => readonly MeaningSurface[]` | Round-aware surface filtering. When absent, all surfaces are evaluated. |
| `systemProfile` | No | `SystemProfileIR` | Profile-based module activation. |
| `conversationMachine` | No | `ConversationMachine` | FSM for hierarchical state tracking and surface group selection. |
| `declaredCapabilities` | No | `Readonly<Record<string, string>>` | Capabilities injected into profile-based activation. Bundles without this get none. |
| `category` | No | `ConventionCategory` | Convention category for UI grouping. |
| `description` | No | `string` | Human-readable description for UI display. |
| `explanationCatalog` | Yes | `ExplanationCatalogIR` | Explanation catalog for enriching teaching projections. |
| `pedagogicalRelations` | Yes | `readonly PedagogicalRelation[]` | Derived from `pedagogicalTags` on surfaces by `derivePedagogicalContent()`. |
| `acceptableAlternatives` | Yes | `readonly AlternativeGroup[]` | Derived from `pedagogicalTags` on surfaces by `derivePedagogicalContent()`. |
| `intentFamilies` | Yes | `readonly IntentFamily[]` | Derived from `pedagogicalTags` on surfaces (currently empty for all bundles). |

*Required in practice for a meaning-pipeline convention, though TypeScript marks it optional.

## File Templates

Skeleton templates for a new convention bundle. Replace `{name}` with bundle ID (kebab-case), `{Name}` with PascalCase name, `{NAME}` with SCREAMING_CASE.

### config.ts

```ts
import type { ConventionBundle } from "../../core/bundle/bundle-types";
import { ConventionCategory } from "../../../core/contracts/convention";
import { {NAME}_SURFACES } from "./meaning-surfaces";
import { {name}Facts } from "./facts";
import { create{Name}SurfaceRouter } from "./surface-routing";
import { create{Name}ConversationMachine } from "./machine";
import { {NAME}_PROFILE } from "./system-profile";
import { {NAME}_EXPLANATION_CATALOG } from "./explanation-catalog";

export const {name}Bundle: ConventionBundle = {
  id: "{name}-bundle",
  name: "{Name} Bundle",
  memberIds: ["{member-convention-id}"],
  category: ConventionCategory.Constructive,
  description: "One-line description",
  dealConstraints: {
    seats: [
      { seat: "N" as any, minHcp: 12, maxHcp: 21 },
      { seat: "S" as any, minHcp: 0 },
    ],
  },
  meaningSurfaces: [
    { groupId: "responder-r1", surfaces: {NAME}_SURFACES },
  ],
  factExtensions: [{name}Facts],
  surfaceRouter: create{Name}SurfaceRouter(),
  conversationMachine: create{Name}ConversationMachine(),
  systemProfile: {NAME}_PROFILE,
  explanationCatalog: {NAME}_EXPLANATION_CATALOG,
};
```

### meaning-surfaces.ts

```ts
import type { MeaningSurface } from "../../../core/contracts/meaning";
import type { Call } from "../../../engine/types";
import { BidSuit } from "../../../engine/types";
import { {NAME}_SEMANTIC } from "./semantic-classes";

const bid = (level: number, strain: BidSuit): Call => ({
  type: "bid", level, strain,
});

export const {NAME}_SURFACES: readonly MeaningSurface[] = [
  {
    meaningId: "{name}:surface-name",
    encoding: bid(2, BidSuit.Clubs),
    clauses: [
      { factId: "hand.hcp", operator: "gte", value: 10 },
      { factId: "hand.suitLength.clubs", operator: "gte", value: 4 },
    ],
    semanticClass: {NAME}_SEMANTIC.MY_CLASS,
    ranking: { band: "should", modulePrecedence: 1, intraModuleOrder: 0 },
    // specificity is pipeline-derived from clause dimensions — do NOT set it here
    // Optional: bindings: { suit: "hearts" } for parameterized surfaces
  },
  // Additional surfaces...
];
```

### facts.ts

```ts
import type {
  FactCatalogExtension,
  FactDefinition,
} from "../../../core/contracts/fact-catalog";

const {name}Definitions: readonly FactDefinition[] = [
  {
    factId: "module.{name}.myFact",
    type: "boolean",
    description: "Whether condition X holds",
    evaluator: (hand, _auction) => {
      // Pure function of hand/auction state
      return hand.suitLengths.hearts >= 4;
    },
  },
];

export const {name}Facts: FactCatalogExtension = {
  moduleId: "{name}",
  facts: {name}Definitions,
};
```

### machine.ts

```ts
import type { ConversationMachine } from "../../core/runtime/machine-types";

export function create{Name}ConversationMachine(): ConversationMachine {
  return {
    machineId: "{name}-conversation",
    initialStateId: "idle",
    states: [
      {
        stateId: "idle",
        parentId: null,
        transitions: [
          {
            on: { kind: "call", level: 1, strain: "notrump" },
            target: "{name}-opened",
          },
        ],
      },
      // Scope state — abstract parent that owns the interrupt transition.
      // Child states inherit this opponent-action handler automatically.
      {
        stateId: "{name}-scope",
        parentId: null,
        isAbstract: true,
        transitions: [
          { on: { kind: "opponent-action" }, target: "{name}-interrupted" },
        ],
      },
      {
        stateId: "{name}-opened",
        parentId: "{name}-scope",  // child of scope — inherits interrupt
        surfaceGroupId: "responder-r1",  // links to meaningSurfaces groupId
        entryEffects: { setCaptain: "responder" },
        transitions: [
          // Transitions to next states...
        ],
      },
      {
        stateId: "{name}-interrupted",
        parentId: "{name}-scope",  // local to scope — not a global sink
        surfaceGroupId: "responder-r1-contested",
        entryEffects: { setCompetitionMode: "contested" },
        transitions: [
          { on: { kind: "pass" }, target: "terminal" },
          // Handle double, bid-over-bid, etc.
        ],
      },
      {
        stateId: "terminal",
        parentId: null,
        transitions: [],  // terminal — no outgoing transitions
      },
    ],
  };
}
```

### convention-config.ts

```ts
import type { ConventionConfig } from "../../../core/contracts/convention";
import { {name}Bundle } from "./config";

export const {name}BundleConventionConfig: ConventionConfig = {
  id: {name}Bundle.id,
  name: "{Name}",
  description: {name}Bundle.description ?? "",
  category: {name}Bundle.category!,
  dealConstraints: {name}Bundle.dealConstraints,
  defaultAuction: {name}Bundle.defaultAuction,
  internal: {name}Bundle.internal,
};
```

### surface-routing.ts

```ts
import type { MeaningSurface } from "../../../core/contracts/meaning";
import type { Auction, Seat } from "../../../engine/types";
import type { ConversationMachine } from "../../core/runtime/machine-types";
import { {NAME}_SURFACES } from "./meaning-surfaces";

export interface RoutedSurfaceGroup {
  readonly groupId: string;
  readonly surfaces: readonly MeaningSurface[];
}

const {NAME}_ROUTED_SURFACES: readonly RoutedSurfaceGroup[] = [
  { groupId: "responder-r1", surfaces: {NAME}_SURFACES },
  // Additional groups...
];

export function create{Name}SurfaceRouter(
  routedGroups: readonly RoutedSurfaceGroup[] = {NAME}_ROUTED_SURFACES,
  machine?: ConversationMachine,
): (auction: Auction, seat: Seat) => readonly MeaningSurface[] {
  const lookup = new Map(routedGroups.map(g => [g.groupId, g.surfaces]));
  return (auction, seat) => {
    // Use machine to determine current state → groupId → surfaces
    // Fallback: return all surfaces if no machine or no match
    return routedGroups.flatMap(g => g.surfaces);
  };
}
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
import type { SystemProfileIR } from "../../../core/contracts/agreement-module";

export const {NAME}_PROFILE: SystemProfileIR = {
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
import type { ExplanationCatalogIR } from "../../../core/contracts/explanation-catalog";
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

export const {NAME}_EXPLANATION_CATALOG: ExplanationCatalogIR =
  createExplanationCatalog("{name}", {NAME}_ENTRIES);
```

*(No separate `pedagogical-relations.ts` or `alternatives.ts` needed — use `pedagogicalTags` on surfaces instead.)*

## Adding a Convention Bundle

1. Create `definitions/{name}-bundle/` folder with the modules listed in the Folder Structure table above.
2. Define `convention-spec.ts` with a `ConventionSpec` — the single source of truth for bundle metadata, deal constraints, and member declarations.
3. Define `base-track.ts` with a `BaseTrackTable` — the declarative state→surface mapping used by `compose.ts`.
4. Define `MeaningSurface[]` in `meaning-surfaces.ts`. Each surface needs `meaningId`, `encoding` (the `Call`), `clauses` (fact-based conditions), `semanticClass`, and `ranking`. Use the factory pattern with `$suit` bindings when parameterizing across suits.
5. Define `FactCatalogExtension`s in `facts.ts` for any module-specific facts referenced by surface clauses.
6. Define module-local semantic class constants in `semantic-classes.ts`.
7. Build a `ConversationMachine` FSM in `machine.ts`. States map to surface groups via `surfaceGroupId`. Include `idle`, active states, and `terminal`. Use the **scoped interrupt pattern** for opponent interference: create abstract scope states (parents) with `opponent-action` transitions targeting local interrupted states. Do not use a single global contested sink. See DONT's `dont-active` as the reference pattern.
8. Define `SystemProfileIR` in `system-profile.ts`.
9. Populate `ExplanationCatalogIR` in `explanation-catalog.ts` with template-keyed explanations.
10. Add `pedagogicalTags` to surfaces using the 6 general tags from `pedagogical-vocabulary.ts`. Use scope strings to group related surfaces.
11. Assemble the bundle in `compose.ts` using the base-track table and convention spec.
13. Wire the `ConventionBundle` in `config.ts`.
14. Create `convention-config.ts` — thin `ConventionConfig` wrapper for the registry.
15. Create `index.ts` barrel with re-exports.
16. Create `__tests__/` with at minimum: base-track tests, surface evaluation tests, machine tests, and config/factory E2E tests.
17. Run the completeness checklist above before considering the bundle complete.

## Authoring Rules

- **Generalize before specializing.** When a convention needs a capability that doesn't exist in `core/`, design the solution to work for any convention — not just yours. If the abstraction only makes sense for one convention, it belongs in `definitions/{name}-bundle/`, not in `core/`. See root `CLAUDE.md` § Design Philosophy.

## Common Pitfalls

1. **Forgetting `activationFilter`.** Without an activation filter, the bundle never activates. The filter must check for the convention's trigger bid in the auction and return member IDs when present, `[]` otherwise.

2. **Surface clause `factId` not in catalog.** Every `factId` referenced in a surface clause must either be in the shared `BRIDGE_DERIVED_FACTS` or defined in a `FactCatalogExtension` in `facts.ts`. Missing facts cause clauses to fail closed (treated as not satisfied).

3. **`surfaceGroupId` mismatch between machine and config.** The `surfaceGroupId` on FSM states must exactly match a `groupId` in the bundle's `meaningSurfaces` array. Mismatches cause the surface router to return no surfaces for that state.

4. **Reusing `meaningId` across surfaces.** Each surface must have a unique `meaningId`. Duplicates cause unpredictable surface selection.

5. **Missing `surfaceRouter`.** Without a router, ALL surfaces are evaluated on every round — semantically incorrect and expensive. Always wire a router that delegates to the conversation machine.

6. **`$suit` binding errors in parameterized surfaces.** When using the factory pattern (like Bergen's `createBergenR1Surfaces(suit)`), clauses must reference the binding variable (e.g., `hand.suitLength.$suit`) and the surface must include a `bindings: { suit }` field. Missing bindings cause clause evaluation to fail.

7. **Module-derived facts for NT-specific thresholds.** `module.ntResponse.inviteValues`, `module.ntResponse.gameValues`, `module.ntResponse.slamValues` are in `nt-bundle/facts.ts` as the `ntResponseFacts` extension (not in shared `BRIDGE_DERIVED_FACTS`). They fail the promotion rule (cannot be named without "1NT"). Any test or strategy that evaluates NT surfaces must include `ntResponseFacts` in its `createFactCatalog()` call, or these facts will be absent and clauses referencing them will fail closed.

8. **`convention-config.ts` wrapper omitted.** The registry and UI picker use `ConventionConfig`, not `ConventionBundle`. Every bundle needs a thin `convention-config.ts` that maps bundle fields to the `ConventionConfig` interface.

9. **Semantic class IDs are module-local.** Define them in `{bundle}/semantic-classes.ts`, not in the central `BRIDGE_SEMANTIC_CLASSES`. Adding a convention does NOT require editing the central registry.

## Test Organization

```
definitions/
  __tests__/
    convention-specs.test.ts             Cross-bundle convention spec validation
  nt-bundle/__tests__/
    base-track.test.ts                   Base-track table validation
    explanation-catalog.test.ts          Explanation catalog entry tests
    machine.test.ts                      FSM state transition tests
    meaning-pipeline.test.ts             Surface evaluation pipeline tests
    pedagogical-relations.test.ts        Relation graph validation
    profile-compilation.test.ts          Profile compilation tests
    smolen.test.ts                       Smolen-specific tests
    sub-bundles.test.ts                  Sub-bundle composition tests
    system-profile.test.ts               Profile activation tests
  bergen-bundle/__tests__/
    base-track.test.ts                   Base-track table validation
    config-factory-e2e.test.ts           Bundle config + factory integration
    golden-master.test.ts                Golden master snapshot tests
    machine.test.ts                      FSM state transition tests
    surface-evaluation.test.ts           Surface clause evaluation tests
  weak-twos-bundle/__tests__/
    base-track.test.ts                   Base-track table validation
    golden-master.test.ts                Golden master snapshot tests
    machine.test.ts                      FSM state transition tests
    surface-evaluation.test.ts           Surface clause evaluation tests
  dont-bundle/__tests__/
    base-track.test.ts                   Base-track table validation
    bundle-composition.test.ts           Bundle composition tests
    machine.test.ts                      Hierarchical FSM + predicate transition tests
    surface-evaluation.test.ts           R1 overcaller + reveal + relay response tests

__tests__/                          (at src/conventions/__tests__/)
  fixtures.test.ts                 Shared test helper tests
  fixtures.ts                      Shared helpers (hand, auctionFromBids, makeBiddingContext)
  infrastructure/
    _synthetic-fixtures.ts         Synthetic test fixture factories
    synthetic-fixtures.test.ts     Synthetic fixture tests
  nt-bundle/
    commitment-integration.test.ts Commitment-level integration tests
    fact-evaluation.test.ts        Fact catalog evaluation tests
    machine-integration.test.ts    Machine + pipeline integration tests
    profile-tests.test.ts          Profile-based activation tests
    snapshot-integration.test.ts   Snapshot-based regression tests
```

Bundle-local tests (`definitions/{name}-bundle/__tests__/`) test individual modules in isolation. Cross-cutting integration tests (`src/conventions/__tests__/nt-bundle/`) test the full pipeline end-to-end.

---

## Context Maintenance

**After modifying files in this directory:** scan the entries above — if any claim is now
false or incomplete, update this file before ending the task. Do not defer.

**Staleness anchor:** This file assumes `nt-bundle/config.ts`, `bergen-bundle/config.ts`, `weak-twos-bundle/config.ts`, and `dont-bundle/config.ts` exist.
If any is missing, this file is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-03-03 | last-audited=2026-03-18 | version=7 | dir-commits-at-audit=unknown | tree-sig=dirs:6,files:90+,exts:ts:88+,md:1 -->
