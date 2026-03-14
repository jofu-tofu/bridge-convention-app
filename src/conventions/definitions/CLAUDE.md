# Convention Definitions

Convention bundles that implement bridge bidding conventions using the meaning pipeline. Each bundle is self-contained with meaning surfaces, fact extensions, conversation machine, deal constraints, and teaching metadata.

## Folder Structure

2 convention bundles: `nt-bundle/`, `bergen-bundle/`.

**`nt-bundle/`** — Combines Stayman + Jacoby Transfers into a single 1NT response bundle. Files:
- `config.ts` — `ConventionBundle` with `meaningSurfaces`, `factExtensions`, `surfaceRouter`, `conversationMachine`, `declaredCapabilities: { ntOpenerContext: "active" }`
- `convention-config.ts` — thin `ConventionConfig` wrapper for the convention registry/picker
- `meaning-surfaces.ts` — `MeaningSurface[]` definitions: 28 surfaces total across 9 surface groups (responder R1, opener Stayman response, opener transfer accept, Stayman R3 after 2H/2S/2D, transfer R3 after hearts/spades accept)
- `facts.ts` — `FactCatalogExtension`s for module-derived facts (`module.stayman.*`, `module.transfer.*`, `module.ntResponse.*`)
- `semantic-classes.ts` — module-local semantic class constants (not in central registry)
- `surface-routing.ts` — `RoutedSurfaceGroup[]` for round-aware surface selection
- `activation.ts` — activation filter for 1NT opening detection
- `alternatives.ts` — cross-convention alternative groups for teaching
- `system-profile.ts` — `NT_SAYC_PROFILE` SystemProfileIR for profile-based module activation
- `machine.ts` — Conversation machine FSM (13 states: idle -> nt-opened -> responder-r1/opener-stayman/opener-transfer/terminal/nt-contested)
- `pedagogical-relations.ts` — `NT_PEDAGOGICAL_RELATIONS` pedagogical relation graph
- `explanation-catalog.ts` — `ExplanationCatalogIR` entries for teaching projections
- `index.ts` — barrel exports + bundle/convention registration

**`bergen-bundle/`** — Bergen Raises using the meaning pipeline with surface bindings for suit parameterization. Files:
- `config.ts` — `ConventionBundle` with `meaningSurfaces`, `factExtensions`, `surfaceRouter`, `conversationMachine`
- `convention-config.ts` — thin `ConventionConfig` wrapper for the convention registry/picker
- `meaning-surfaces.ts` — `createBergenR1Surfaces(suit)` factory producing surfaces parameterized by `$suit` binding (splinter, game, limit, constructive, preemptive), instantiated for hearts and spades
- `facts.ts` — `FactCatalogExtension` for `module.bergen.hasMajorSupport`
- `semantic-classes.ts` — module-local Bergen semantic class constants
- `machine.ts` — conversation machine FSM (idle -> major-opened -> responder-r1 states)
- `system-profile.ts` — `BERGEN_PROFILE` SystemProfileIR
- `surface-routing.ts` — routed surface groups (responder-r1-hearts, responder-r1-spades)
- `explanation-catalog.ts` — `ExplanationCatalogIR` entries
- `index.ts` — barrel exports + bundle/convention registration

## Convention Quick Reference

- **1NT Responses (nt-bundle):** Full 1NT response system: Stayman (ask for 4-card majors), Jacoby Transfers (show 5+ in a major), and natural bids. Multi-round with 13-state conversation machine FSM.
- **Bergen Raises (bergen-bundle):** Standard Bergen variant — constructive (3C, 7-10 HCP), limit (3D, 10-12 HCP), preemptive (3M, 0-6 HCP), game raise (4M, 13+ HCP), splinter (shortage, 12+ HCP) after 1M opening.

## ConventionConfig Field Guide

`ConventionConfig` in `core/types.ts` is the minimal convention registry entry:

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `id` | Yes | `string` | Unique convention identifier (kebab-case). Used as registry key and URL parameter. |
| `name` | Yes | `string` | Human-readable display name. |
| `description` | Yes | `string` | One-line description for UI display. |
| `category` | Yes | `ConventionCategory` | One of `Asking`, `Defensive`, `Constructive`, `Competitive`. |
| `dealConstraints` | Yes | `DealConstraints` | Seat-specific HCP, shape, and balanced constraints for deal generation. |
| `teaching` | No | `ConventionTeaching` | Convention-level teaching metadata (purpose, whenToUse, etc.). |
| `defaultAuction` | No | `(seat, deal?) => Auction \| undefined` | Returns pre-filled auction for drill start position. |
| `internal` | No | `boolean` | If `true`, hidden from UI picker. |
| `allowedDealers` | No | `readonly Seat[]` | Random dealer selection; constraints rotate when dealer differs. |

## ConventionBundle Field Guide

`ConventionBundle` in `core/bundle/bundle-types.ts` is the full convention definition:

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `id` | Yes | `string` | Bundle identifier. |
| `name` | Yes | `string` | Human-readable name. |
| `description` | Yes | `string` | Description for display. |
| `category` | Yes | `ConventionCategory` | Convention category. |
| `memberIds` | Yes | `readonly string[]` | Convention IDs this bundle supersedes. |
| `dealConstraints` | Yes | `DealConstraints` | Deal generation constraints. |
| `activationFilter` | Yes | `(auction, seat) => readonly string[]` | Returns active module IDs given auction state. |
| `meaningSurfaces` | Yes* | `readonly { groupId, surfaces }[]` | Meaning surfaces organized by group. Drives the meaning pipeline. |
| `factExtensions` | No | `readonly FactCatalogExtension[]` | Module-derived fact definitions beyond shared facts. |
| `surfaceRouter` | No | `(auction, seat) => readonly MeaningSurface[]` | Round-aware surface filtering. |
| `conversationMachine` | No | `ConversationMachine` | FSM for hierarchical surface selection and auction state tracking. |
| `systemProfile` | No | `SystemProfileIR` | Profile-based module activation. |
| `declaredCapabilities` | No | `Record<string, string>` | Capabilities injected into profile-based activation. |
| `explanationCatalog` | No | `ExplanationCatalogIR` | Explanation entries for teaching projection enrichment. |
| `pedagogicalRelations` | No | `readonly PedagogicalRelation[]` | Pedagogical relation graph for "why not X?" teaching. |
| `alternativeGroups` | No | `readonly AlternativeGroup[]` | Groups of semantically interchangeable bids for grading. |
| `intentFamilies` | No | `readonly IntentFamily[]` | Conceptual families for relationship-aware grading. |
| `defaultAuction` | No | `(seat, deal?) => Auction \| undefined` | Default auction for drill start. |
| `internal` | No | `boolean` | Hidden from UI picker. |

*`meaningSurfaces` is the core of the meaning pipeline — required for the convention to function.

## Bundle Completeness Checklist

Every convention bundle should satisfy:

1. **`meaningSurfaces`** — define `MeaningSurface[]` covering all bids the convention teaches. Each surface has `meaningId`, `semanticClassId`, `clauses` (hand/auction predicates), `encoder` (how the meaning maps to a call), and optional `teachingLabel`.
2. **`conversationMachine`** — define an FSM with states for each phase of the convention dialogue. States have `surfaceGroupId` linking to surface groups, transitions matching auction patterns, and effects (forcing state, obligation, etc.).
3. **`factExtensions`** — define `FactCatalogExtension` for any module-specific facts beyond `SHARED_FACTS`. Use `module.{bundleName}.*` naming.
4. **`dealConstraints`** — per-seat HCP ranges and shape requirements for deal generation.
5. **`explanationCatalog`** — define `ExplanationEntry` items for each fact and meaning used by surfaces. Include `displayText` for immediate rendering and `templateKey` for future i18n.
6. **`pedagogicalRelations`** — define relations (same-family, stronger-than, weaker-than, fallback-of, continuation-of, near-miss-of) between meanings for "why not X?" teaching.
7. **`alternativeGroups`** — define groups of semantically interchangeable bids for teaching grading (Correct/Acceptable/Incorrect).
8. **`convention-config.ts`** — thin `ConventionConfig` wrapper so the bundle appears in the convention picker.
9. **`index.ts`** — barrel exports + `registerBundle()` + `registerConvention()` calls.

## File Templates

### config.ts (ConventionBundle)

```ts
import type { ConventionBundle } from "../../core/bundle/bundle-types";
import type { DealConstraints } from "../../../engine/types";
import { Seat, Suit } from "../../../engine/types";
import { ConventionCategory } from "../../core/types";
import { buildAuction } from "../../../engine/auction-helpers";
import { MY_SURFACES } from "./meaning-surfaces";
import { myFacts } from "./facts";
import { MY_PROFILE } from "./system-profile";
import { createMySurfaceRouter } from "./surface-routing";
import { createMyConversationMachine } from "./machine";
import { MY_EXPLANATION_CATALOG } from "./explanation-catalog";

const dealConstraints: DealConstraints = {
  seats: [
    { seat: Seat.North, minHcp: 15, maxHcp: 17 },
    { seat: Seat.South, minHcp: 0 },
  ],
  dealer: Seat.North,
};

export const myBundle: ConventionBundle = {
  id: "my-bundle",
  name: "My Convention Bundle",
  description: "Description of what this convention bundle teaches",
  category: ConventionCategory.Asking,
  memberIds: ["my-bundle"],
  dealConstraints,
  activationFilter: (auction) => {
    // Return module IDs that are active given this auction state
    return [];
  },
  meaningSurfaces: MY_SURFACES,
  factExtensions: [myFacts],
  surfaceRouter: createMySurfaceRouter(),
  conversationMachine: createMyConversationMachine(),
  systemProfile: MY_PROFILE,
  explanationCatalog: MY_EXPLANATION_CATALOG,
  defaultAuction: (seat) => {
    if (seat === Seat.South) {
      return buildAuction(Seat.North, ["1NT", "P"]);
    }
    return undefined;
  },
};
```

### meaning-surfaces.ts

```ts
import type { MeaningSurface } from "../../../core/contracts/meaning-surface";

export const MY_SURFACES: readonly { groupId: string; surfaces: readonly MeaningSurface[] }[] = [
  {
    groupId: "responder-r1",
    surfaces: [
      {
        meaningId: "my-convention:response-bid",
        semanticClassId: "bridge:conventional-ask",
        teachingLabel: "Convention ask",
        clauses: [
          { factId: "hand.hcp", op: ">=", threshold: 8, description: "8+ HCP" },
          { factId: "hand.suitLength.clubs", op: ">=", threshold: 3, description: "3+ clubs" },
        ],
        encoder: { kind: "direct", call: { type: "bid", level: 2, strain: "C" } },
      },
      // More surfaces...
    ],
  },
];
```

### convention-config.ts

```ts
import type { ConventionConfig } from "../../core/types";
import { ConventionCategory } from "../../core/types";
import { myBundle } from "./config";

export const myBundleConventionConfig: ConventionConfig = {
  id: myBundle.id,
  name: "My Convention",
  description: myBundle.description,
  category: myBundle.category ?? ConventionCategory.Asking,
  dealConstraints: myBundle.dealConstraints,
  defaultAuction: myBundle.defaultAuction,
};
```

### index.ts

```ts
import { registerConvention } from "../../core/registry";
import { registerBundle } from "../../core/bundle";
import { myBundle } from "./config";
import { myBundleConventionConfig } from "./convention-config";

export { myBundle } from "./config";
export { myBundleConventionConfig } from "./convention-config";

registerBundle(myBundle);
registerConvention(myBundleConventionConfig);
```

## Adding a Convention Bundle

1. Create `definitions/{name}/` folder with `config.ts`, `meaning-surfaces.ts`, `facts.ts`, `machine.ts`, `semantic-classes.ts`, `surface-routing.ts`, `system-profile.ts`, `explanation-catalog.ts`, `convention-config.ts`, `index.ts`.
2. Define `MeaningSurface[]` covering all bids the convention teaches.
3. Define a `ConversationMachine` FSM tracking the convention dialogue flow.
4. Define `FactCatalogExtension` for any module-specific facts.
5. Define `ExplanationCatalogIR` entries for teaching.
6. Define `PedagogicalRelation[]` for "why not X?" relationships.
7. Define `AlternativeGroup[]` for acceptable-alternative grading.
8. Wire `convention-config.ts` and `index.ts` for registration.
9. Create `__tests__/` with pipeline evaluation tests.
10. Test deal constraints with integration tests.

## Authoring Rules

- **Generalize before specializing.** When a convention needs a capability that doesn't exist in `core/`, design the solution to work for any convention — not just yours. If the abstraction only makes sense for one convention, it belongs in `definitions/{name}/`, not in `core/`. See root `CLAUDE.md` Design Philosophy.

## Gotchas

- **Module-derived facts for NT-specific thresholds.** `module.ntResponse.inviteValues`, `module.ntResponse.gameValues`, `module.ntResponse.slamValues` are in `nt-bundle/facts.ts` as `ntResponseFacts` extension (not in shared `BRIDGE_DERIVED_FACTS`). They fail the promotion rule (cannot be named without "1NT"). Any test or strategy that evaluates NT surfaces must include `ntResponseFacts` in its `createFactCatalog()` call, or these facts will be absent and clauses referencing them will fail closed.
- **Semantic class IDs are module-local.** Define them in `{bundle}/semantic-classes.ts`, not in the central `BRIDGE_SEMANTIC_CLASSES`. Adding a convention does NOT require editing the central registry.
- **Surface `$suit` bindings** (Bergen pattern): use `$suit` in `factId` references and a `surfaceBindings` map on the surface. The meaning-evaluator resolves `$suit` at evaluation time via the relational fact context.

## Test Organization

```
__tests__/
  fixtures.test.ts, fixtures.ts  Shared helpers (hand, auctionFromBids, makeBiddingContext)
  infrastructure/               Shared pipeline infrastructure tests
  nt-bundle/                    NT bundle-specific tests
```

Bergen bundle tests are in `definitions/bergen-bundle/__tests__/`.

---

## Context Maintenance

**After modifying files in this directory:** scan the entries above — if any claim is now
false or incomplete, update this file before ending the task. Do not defer.

**Staleness anchor:** This file assumes `nt-bundle/index.ts` exists. If it doesn't, this file
is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-03-14 | last-audited=2026-03-14 | version=4 | dir-commits-at-audit=62 | tree-sig=dirs:4,files:30,exts:ts:28,md:1 -->
