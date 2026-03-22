# Convention Bundle File Templates

Skeleton templates for a new convention bundle. Replace `{name}` with bundle ID (kebab-case), `{Name}` with PascalCase name, `{NAME}` with SCREAMING_CASE.

See `src/conventions/definitions/CLAUDE.md` for the full authoring guide, checklist, and boundary contract.

## config.ts

Thin re-export from `system-registry.ts`. The bundle is defined in the system registry; `config.ts` re-exports it for backward compatibility.

```ts
// Re-export the bundle from system-registry
export { {name}Bundle } from "../system-registry";
```

## meaning-surfaces.ts

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

## facts.ts

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

## {name}-rules.ts (RuleModule)

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

## semantic-classes.ts

```ts
/** Module-local semantic classes for {Name} surfaces.
 *  NOT registered in the central BRIDGE_SEMANTIC_CLASSES registry. */
export const {NAME}_SEMANTIC = {
  MY_CLASS: "{name}:my-class",
  ANOTHER_CLASS: "{name}:another-class",
} as const;
```

## system-profile.ts

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

## explanation-catalog.ts

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
