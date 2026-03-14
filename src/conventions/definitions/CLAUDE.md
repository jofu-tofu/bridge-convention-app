# Convention Definitions

Convention bundles that each implement a bridge bidding convention using the meaning pipeline. Each bundle is self-contained with deal constraints, meaning surfaces, fact extensions, a conversation machine FSM, and teaching metadata.

## Folder Structure

2 convention bundles: `nt-bundle/`, `bergen-bundle/`. Each folder has a parallel set of modules:

| File | Purpose |
|------|---------|
| `config.ts` | `ConventionBundle` object wiring all bundle modules together |
| `convention-config.ts` | Thin `ConventionConfig` wrapper for registry/UI compatibility |
| `meaning-surfaces.ts` | `MeaningSurface[]` definitions — the core bidding logic |
| `facts.ts` | `FactCatalogExtension`s for module-derived facts |
| `semantic-classes.ts` | Module-local semantic class constants (not in central registry) |
| `surface-routing.ts` | `RoutedSurfaceGroup[]` for round-aware surface selection |
| `machine.ts` | `ConversationMachine` FSM for hierarchical state tracking |
| `system-profile.ts` | `SystemProfileIR` for profile-based module activation |
| `explanation-catalog.ts` | `ExplanationCatalogIR` entries for teaching projections |
| `pedagogical-relations.ts` | `PedagogicalRelation[]` graph (same-family, stronger-than, fallback-of, etc.) |
| `alternatives.ts` | `AlternativeGroup[]` for cross-convention or within-bundle alternatives |
| `index.ts` | Barrel exports |
| `__tests__/` | Bundle-specific tests |
| `activation.ts` | *(NT only)* Activation filter for 1NT opening detection |

**`nt-bundle/`** — Combines Stayman + Jacoby Transfers into a single 1NT response bundle.
- `config.ts` — `ConventionBundle` with `meaningSurfaces` (9 groups, 28 surfaces), `factExtensions` (staymanFacts, transferFacts, ntResponseFacts), `surfaceRouter`, `conversationMachine`, `declaredCapabilities: { ntOpenerContext: "active" }`. `memberIds: ["jacoby-transfers", "stayman"]` (Jacoby first for tie-breaking priority).
- `meaning-surfaces.ts` — 28 `MeaningSurface` definitions across responder R1 (5), opener Stayman response (3), opener transfer accept hearts (1) + spades (1), Stayman R3 after 2H/2S/2D (4+4+2), transfer R3 after hearts/spades accept (4+4). 982 lines — largest file in the bundle.
- `facts.ts` — 3 `FactCatalogExtension`s: `staymanFacts` (module.stayman.*, posterior facts), `transferFacts` (module.transfer.*), `ntResponseFacts` (module.ntResponse.inviteValues/gameValues/slamValues).
- `machine.ts` — 13-state hierarchical FSM: idle → nt-opened → responder-r1 → opener-stayman / opener-transfer-hearts / opener-transfer-spades → responder-r3 variants → terminal / nt-contested. Uses hierarchical parent states (`nt-opened` as parent).
- `activation.ts` — `ntActivationFilter()` returns `["jacoby-transfers", "stayman"]` when 1NT is in the auction.
- `alternatives.ts` — 1 cross-convention `AlternativeGroup`: "NT response: transfer vs Stayman".
- `pedagogical-relations.ts` — `NT_PEDAGOGICAL_RELATIONS` graph.
- `surface-routing.ts` — 9 `RoutedSurfaceGroup` entries; `createNtSurfaceRouter()` delegates to `evaluateMachine()`.

**`bergen-bundle/`** — Bergen Raises using the meaning pipeline with `$suit` binding parameterization for hearts and spades.
- `config.ts` — `ConventionBundle` with `meaningSurfaces` (13 groups), `factExtensions`, `surfaceRouter`, `conversationMachine`. `memberIds: ["bergen-raises"]`. `internal: true` (parity testing). Inline `activationFilter` checks for 1-level major bid.
- `meaning-surfaces.ts` — `createBergenR1Surfaces(suit)` factory producing 5 surfaces per suit (splinter, game, limit, constructive, preemptive) parameterized by `$suit` bindings. Also includes R2–R4 surfaces. 604 lines total.
- `facts.ts` — 1 `FactCatalogExtension`: `bergenFacts` for `module.bergen.hasMajorSupport` (hearts ≥ 4 or spades ≥ 4).
- `machine.ts` — ~16-state flat FSM (`parentId: null` everywhere): idle → major-opened-hearts/spades → responder-r1 → R2 (opener-after-constructive/limit/preemptive) → R3 (responder-after-opener-rebid) → R4 → terminal / bergen-contested. Uses `surfaceGroupId` and `entryEffects` for `setCaptain`.
- `alternatives.ts` — `BERGEN_ALTERNATIVE_GROUPS` (per-suit strength raise groups).
- `pedagogical-relations.ts` — `BERGEN_PEDAGOGICAL_RELATIONS` graph.

## Convention Quick Reference

- **NT Bundle (1NT Responses):** Stayman (2C ask for 4-card majors) + Jacoby Transfers (2D→hearts, 2H→spades). 28 meaning surfaces, 3 fact extensions, 13-state hierarchical FSM. Deal constraints: opener 15–17 HCP balanced, responder 6+ HCP with 4+ in any major.
- **Bergen Bundle (Bergen Raises):** Responder raises after 1M opening. Standard Bergen variant (3C=constructive 7–10, 3D=limit 10–12, 3M=preemptive 0–6, splinter 12+). `$suit` binding factory for DRY heart/spade parameterization. Deal constraints: opener 12–21 HCP with 5+ major, responder 0+ HCP with 4+ major.

## Convention Bundle Completeness Checklist

Every convention bundle must satisfy all items before being considered complete:

1. **`meaningSurfaces` with grouped surfaces.** At least one surface group with `groupId` and `surfaces` array. Every surface needs `meaningId`, `encoding`, `clauses` (with `factId`, `operator`, `value`), and `ranking` (`band`, `specificity`, `modulePrecedence`).
2. **`factExtensions` for module-derived facts.** Any fact referenced in surface clauses that isn't in the shared `BRIDGE_DERIVED_FACTS` must be defined in a `FactCatalogExtension` in `facts.ts`. Evaluators must be pure functions of hand/auction state.
3. **`surfaceRouter` for round-aware filtering.** Maps FSM state → surface group via `RoutedSurfaceGroup[]`. Without this, all surfaces are evaluated every round (expensive and semantically incorrect).
4. **`conversationMachine` FSM.** Tracks auction progress through states with transitions. States use `surfaceGroupId` to link to surface groups. Must include `idle`, at least one active state, `terminal`, and a contested state.
5. **`activationFilter` function.** Returns active convention IDs given auction state. Must return `[]` when the convention's trigger bid is absent.
6. **`dealConstraints` with HCP ranges and shape requirements.** Per-seat `minHcp`/`maxHcp` and `minLengthAny`/`maxLength` as appropriate.
7. **`convention-config.ts` wrapper.** Thin `ConventionConfig` that maps bundle fields to the registry interface. Required for UI picker compatibility.
8. **`explanationCatalog` entries.** Template-keyed explanations for teaching projections. Each entry links a `factId` to display text and contrastive templates.
9. **`systemProfile` IR.** Profile-based module activation metadata.
10. **`pedagogicalRelations` graph.** Relationship edges between surfaces (same-family, stronger-than, fallback-of, continuation-of, near-miss-of). Exported from `pedagogical-relations.ts`.
11. **`alternatives` groups.** `AlternativeGroup[]` for hands where multiple bids are reasonable. Exported from `alternatives.ts`.
12. **`semantic-classes.ts` constants.** Module-local semantic class strings. Do not add to central registry — keep them co-located with the surfaces that reference them.

## Type Reference

### ConventionConfig (`core/types.ts`)

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
| `defaultAuction` | No | `(seat, deal?) => Auction \| undefined` | Pre-filled auction for drill start. |
| `activationFilter` | Yes | `(auction, seat) => readonly string[]` | Returns active convention IDs given auction state. Returns `[]` when trigger bid absent. |
| `meaningSurfaces` | No* | `readonly { groupId: string; surfaces: readonly MeaningSurface[] }[]` | Meaning surfaces organized by group. When present, the meaning pipeline is used. |
| `factExtensions` | No | `readonly FactCatalogExtension[]` | Module-derived fact definitions for surface clause evaluation. |
| `surfaceRouter` | No | `(auction, seat) => readonly MeaningSurface[]` | Round-aware surface filtering. When absent, all surfaces are evaluated. |
| `systemProfile` | No | `SystemProfileIR` | Profile-based module activation. |
| `conversationMachine` | No | `ConversationMachine` | FSM for hierarchical state tracking and surface group selection. |
| `declaredCapabilities` | No | `Readonly<Record<string, string>>` | Capabilities injected into profile-based activation. Bundles without this get none. |
| `category` | No | `ConventionCategory` | Convention category for UI grouping. |
| `description` | No | `string` | Human-readable description for UI display. |
| `explanationCatalog` | No | `ExplanationCatalogIR` | Explanation catalog for enriching teaching projections. |

*Required in practice for a meaning-pipeline convention, though TypeScript marks it optional.

**Companion exports** (not on `ConventionBundle`, exported from separate modules):
- `PedagogicalRelation[]` — from `pedagogical-relations.ts`
- `AlternativeGroup[]` — from `alternatives.ts`

## File Templates

Skeleton templates for a new convention bundle. Replace `{name}` with bundle ID (kebab-case), `{Name}` with PascalCase name, `{NAME}` with SCREAMING_CASE.

### config.ts

```ts
import type { ConventionBundle } from "../../core/bundle/bundle-types";
import { ConventionCategory } from "../../core/types";
import type { Seat, Auction } from "../../../engine/types";
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
  activationFilter: (auction: Auction, _seat: Seat): readonly string[] => {
    // Return member IDs when trigger bid is present, [] otherwise
    return [];
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
import type { MeaningSurface } from "../../../core/contracts/meaning-surface";
import type { Call } from "../../../engine/types";
import { BidSuit } from "../../../engine/types";
import { BRIDGE_SEMANTIC_CLASSES } from "../../../core/contracts/semantic-classes";
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
    ranking: { band: "should", specificity: 2, modulePrecedence: 1 },
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
      {
        stateId: "{name}-opened",
        parentId: null,
        surfaceGroupId: "responder-r1",  // links to meaningSurfaces groupId
        entryEffects: { setCaptain: "responder" },
        transitions: [
          // Transitions to next states...
          { on: { kind: "opponent-action" }, target: "{name}-contested" },
        ],
      },
      {
        stateId: "terminal",
        parentId: null,
        transitions: [],  // terminal — no outgoing transitions
      },
      {
        stateId: "{name}-contested",
        parentId: null,
        entryEffects: { setCompetitionMode: "contested" },
        transitions: [],
      },
    ],
  };
}
```

### convention-config.ts

```ts
import type { ConventionConfig } from "../../core/types";
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
import type { MeaningSurface } from "../../../core/contracts/meaning-surface";
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

### pedagogical-relations.ts

```ts
import type { PedagogicalRelation } from "../../../core/contracts/pedagogical-relations";

export const {NAME}_PEDAGOGICAL_RELATIONS: readonly PedagogicalRelation[] = [
  {
    source: "{name}:surface-a",
    target: "{name}:surface-b",
    relation: "stronger-than",  // same-family | stronger-than | fallback-of | continuation-of | near-miss-of
  },
  // Additional relations...
];
```

### alternatives.ts

```ts
import type { AlternativeGroup } from "../../../core/contracts";

export const {NAME}_ALTERNATIVE_GROUPS: readonly AlternativeGroup[] = [
  {
    label: "{Name} alternatives",
    members: ["{name}:surface-a", "{name}:surface-b"],
    tier: "alternative",  // "preferred" | "alternative"
  },
];
```

## Adding a Convention Bundle

1. Create `definitions/{name}-bundle/` folder with the modules listed in the Folder Structure table above.
2. Define `MeaningSurface[]` in `meaning-surfaces.ts`. Each surface needs `meaningId`, `encoding` (the `Call`), `clauses` (fact-based conditions), `semanticClass`, and `ranking`. Use the factory pattern with `$suit` bindings when parameterizing across suits.
3. Define `FactCatalogExtension`s in `facts.ts` for any module-specific facts referenced by surface clauses.
4. Define module-local semantic class constants in `semantic-classes.ts`.
5. Build a `ConversationMachine` FSM in `machine.ts`. States map to surface groups via `surfaceGroupId`. Include `idle`, active states, `terminal`, and a contested state.
6. Wire `RoutedSurfaceGroup[]` in `surface-routing.ts` and create a router function that delegates to the machine.
7. Define `SystemProfileIR` in `system-profile.ts`.
8. Populate `ExplanationCatalogIR` in `explanation-catalog.ts` with template-keyed explanations.
9. Define `PedagogicalRelation[]` in `pedagogical-relations.ts`.
10. Define `AlternativeGroup[]` in `alternatives.ts`.
11. Assemble the `ConventionBundle` in `config.ts`, wiring all modules.
12. Create `convention-config.ts` — thin `ConventionConfig` wrapper for the registry.
13. Create `index.ts` barrel with re-exports.
14. Create `__tests__/` with at minimum: surface evaluation tests, machine tests, and config/factory E2E tests. Import shared helpers from `../../__tests__/fixtures`.
15. Run the completeness checklist above before considering the bundle complete.

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
  nt-bundle/__tests__/
    explanation-catalog.test.ts    Explanation catalog entry tests
    machine.test.ts                FSM state transition tests
    meaning-pipeline.test.ts       Surface evaluation pipeline tests
    pedagogical-relations.test.ts  Relation graph validation
    system-profile.test.ts         Profile activation tests
  bergen-bundle/__tests__/
    config-factory-e2e.test.ts     Bundle config + factory integration
    machine.test.ts                FSM state transition tests
    surface-evaluation.test.ts     Surface clause evaluation tests

__tests__/                          (at src/conventions/__tests__/)
  _convention-template.test.ts     Template for new convention tests
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

**Staleness anchor:** This file assumes `nt-bundle/config.ts` and `bergen-bundle/config.ts` exist.
If either is missing, this file is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-03-03 | last-audited=2026-03-15 | version=5 | dir-commits-at-audit=unknown | tree-sig=dirs:4,files:30,exts:ts:28,md:1 -->
