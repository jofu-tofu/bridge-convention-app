# Convention Authoring Guide

Complete guide for writing new convention bundles. Covers the full lifecycle from file creation to verification.

## Authoritative Bridge Rules Sources

Priority chain for resolving ambiguity:
1. **WBF Laws of Duplicate Bridge 2017** — https://www.worldbridge.org/rules-regulations/laws/
2. **ACBL SAYC Booklet** — https://www.acbl.org/learn_page/how-to-play-bridge/how-to-bid/
3. **bridgebum.com** — Convention encyclopedia (stayman.php, bergen_raises.php, dont.php, etc.)

## Convention Quick Reference

- **NT Bundle (1NT Responses):** Stayman (2C ask) + Jacoby Transfers (2D→H, 2H→S) + Smolen (3H/3S game-forcing after denial with 5-4 majors). 35 surfaces, 4 fact extensions. Deal: opener 15–17 HCP balanced, responder 6+ HCP with 4+ major.
- **Bergen Bundle:** Standard Bergen (3C=constructive 7–10, 3D=limit 10–12, 3M=preemptive 0–6, splinter 12+). `$suit` binding for DRY heart/spade parameterization. Deal: opener 12–21 HCP with 5+ major, responder 0+ HCP with 4+ major.
- **Weak Two Bundle:** Weak Two openings (2D/2H/2S) with Ogust responses. Ogust: 3C=min/bad, 3D=min/good, 3H=max/bad, 3S=max/good, 3NT=solid. Deal: opener 5–10 HCP with 6+, responder 12+ HCP.
- **DONT Bundle:** Competitive overcalls after opponent's 1NT. No `match.turn` — uses phase + route scoping. 24 surfaces, 21 facts. Deal: East 15–17 HCP (NT opener), South 8–15 HCP with 5+ suit.

## Completeness Checklist

Every convention bundle must satisfy all items:

1. **`meaningSurfaces` with grouped surfaces.** Every surface needs `meaningId`, `encoding`, `clauses` (with `factId`, `operator`, `value`), and `ranking` (`band`, `declarationOrder`). `modulePrecedence` defaults to 0 — do NOT set it. Specificity is pipeline-derived. All `FactDefinition` objects must declare `constrainsDimensions`.
2. **`factExtensions` for module-derived facts.** Facts not in shared `BRIDGE_DERIVED_FACTS` must be defined in `facts.ts`. Use factory helpers (`defineBooleanFact`, `definePerSuitFacts`, `defineHcpRangeFact`, `buildExtension`) from `conventions/pipeline/fact-factory.ts`.
3. **`modules` for surface selection.** `ConventionModule[]` with `local` (LocalFsm) and `states` (StateEntry[]).
4. **`systemProfile` for activation.**
5. **`declaredCapabilities` for deal constraint derivation.** Deal constraints are NOT hand-authored — derived from capabilities + R1 surface analysis.
6. **`category` and `description`** required on `ConventionBundle`.
7. **`explanationCatalog` entries.** Template-keyed explanations for teaching projections.
8. **`semantic-classes.ts` constants.** Module-local, not in central registry.

## Adding a New Convention Bundle (Step by Step)

1. Create `definitions/{name}-bundle/` folder
2. Define `BidMeaning[]` in `meaning-surfaces.ts` — each surface needs `meaningId`, `encoding`, `clauses`, `semanticClass`, `ranking`
3. Define `FactCatalogExtension`s in `facts.ts` for module-specific facts
4. Define semantic class constants in `semantic-classes.ts`
5. Define `LocalFsm` and `StateEntry[]` in `{name}-rules.ts`
6. Define `SystemProfile` in `system-profile.ts`
7. Populate `ExplanationCatalog` in `explanation-catalog.ts`
8. Wire `config.ts` as thin re-export from `system-registry.ts`
9. Create `index.ts` barrel
10. Register module in `module-registry.ts` and define bundle in `system-registry.ts` via `buildBundle()`
11. Create `__tests__/` with surface evaluation tests and config/factory E2E tests
12. **Verify:** `npm run lint`, `npm run test:run`, `npx tsx src/cli/main.ts selftest`
13. Run the completeness checklist above

## File Templates

### config.ts
```ts
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
  }, {NAME}_CTX),
];
```

### facts.ts
```ts
import type { FactCatalogExtension } from "../../../core/contracts/fact-catalog";
import { defineBooleanFact, defineHcpRangeFact, buildExtension } from "../../core/pipeline/fact-factory";

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
  ]),
};
```

### semantic-classes.ts
```ts
export const {NAME}_SEMANTIC = {
  MY_CLASS: "{name}:my-class",
} as const;
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
];

export const {NAME}_EXPLANATION_CATALOG: ExplanationCatalog =
  createExplanationCatalog("{name}", {NAME}_ENTRIES);
```

## Authoring Rules

- **Use `createSurface()` for all new surfaces.** Import from `conventions/core/surface-builder.ts` with a `ModuleContext`. Provide `description` only when it adds parenthetical rationale.
- **Modules are portable.** Never import from other modules. Never reference foreign surface IDs.
- **Adding a module must not edit existing modules.**
- **Generalize before specializing.** Infrastructure capabilities should work for any convention.
- **Module-derived facts must have `composition`.** Loosest correct composition for deal constraint derivation. Factory helpers auto-populate; hand-written evaluators must add manually.
- **System-fact-gated surfaces for cross-system modules.** Gate each with a system fact clause. Never create system-specific modules.
- **Mandatory explanation entries.** Every module-derived fact and meaning needs an entry — compile-time enforced.
- **Typed ID constants per module.** `ids.ts` with `as const` typed ID constants.
- **Template-form factIds are module-owned.** Platform catalog covers only concrete shared/system fact IDs.
- **Non-pedagogical facts use `displayText: 'internal'`.**

## Common Pitfalls

1. **Surface clause `factId` not in catalog.** Missing facts cause clauses to fail closed.
2. **Reusing `meaningId` across surfaces.** Each surface must have a unique `meaningId`.
3. **`$suit` binding errors.** Clauses must reference the binding variable and surface must include `bindings`.
4. **Missing `category` or `description` on bundle.** Both required.
5. **Hand-authoring clauseId/description.** These are auto-derived by the builder.
6. **Semantic class IDs are module-local.** Define in `{bundle}/semantic-classes.ts`, not central registry.
7. **Phase transition vs route matching confusion.** Phase transitions advance FSM state (actor-agnostic). Route matching filters active surfaces (actor-aware). Do not conflate.

## Convention-Specific Edge Cases

### Bergen Raises
- Standard Bergen (3C=constructive 7-10, 3D=limit 10-12, 3M=preemptive 0-6, splinter with shortage 12+)
- Reverse Bergen variant not implemented
- Passed hand: Bergen OFF
- Splinter continuations: opener relays (3NT/3S), responder discloses shortage suit
- Help-suit game tries: opener bids weakest side suit after constructive raise

### DONT
- Standard DONT (original Marty Bergen), Modified/Meckwell not implemented
- 6-4 hand → two-suited bid, NOT double (rule ordering)
- Only direct seat overcall; balancing seat not implemented
- 2NT inquiry rebid system: min/max split at 11 HCP

### Stayman
- Standard Stayman; Puppet Stayman not implemented
- Both 4-card majors → opener shows hearts first
- Smolen requires 5-4 shape (not 4-4)
- Competitive sequences not handled

### Weak Twos
- Standard Ogust responses (3C=min/bad through 3NT=solid)
- 2C excluded (reserved for strong conventional opening)
- Hearts priority > Spades > Diamonds
- Responder 10-13 HCP gap (no action in this range without fit)

### Michaels / Unusual 2NT
- Cue bid over minor opening = both majors (5-5+); cue bid over major = other major + unknown minor (5-5+)
- Unusual 2NT = both minors (5-5+)
- Vulnerability-gated HCP: NV 6-15, Vul 8-15
- Multi-trigger convention: 4 separate FSM phases per opponent opening (r1-after-1c/1d/1h/1s) because cue bid encoding differs per opening suit
- After Michaels over major: 2NT relay asks for the minor; overcaller reveals
- Advancer responses: simple preference (weak), invite, game jump
- Game-forcing sequences: none (all levels are invitational at most)

### Strong 2C Opening
- Artificial game-forcing 2C opening with 22+ HCP
- 2D = waiting/negative (0-7 HCP), positive = 8+ HCP with suit or balanced 2NT
- After 2D waiting: opener rebids suit (5+), 2NT (22-24 balanced), or 3NT (25-27 balanced)
- Game-forcing discipline: no pass surfaces in after-suit-rebid, after-positive, after-2nt-positive phases
- Exception: pass IS legal after 2NT rebid (responder with 0-2 HCP opposite 22-24)
- Multi-phase opener: the FSM has 8 phases to cover different response paths

### Lebensohl (Lite)
- Only handles overcalls in D/H/S — no 2C overcall
- "Slow shows" implemented, "fast denies" not
- Simplified stopper check: any single top honor (A, K, Q)
- Direct 3-level suit bids are game-forcing (10+ HCP)

### SAYC
- Full bidding system, not just a convention treatment
- 5-card majors in all seats, strong 1NT (15-17)
- Transfer priority over Stayman with 5+ major AND 4-card major
- Opening priority: strong 2C > 2NT > 1NT > majors > minors > preempts > weak twos
- Known gaps: no minor raises, limited opener rebid coverage

### Negative Doubles
- **Opponent overcall observations:** The module includes its own surfaces for opponent overcalls (5+ card suit, 8-16 HCP) to produce committed observations that advance the FSM. These are real surfaces with clauses, not stubs.
- **Per-opening phase pattern:** Each opening suit gets its own `r1-after-1x` → `after-oc-1x` phase pair. The meaning of a negative double depends on which suits are unbid, so encoding the opening suit in the phase name makes surfaces self-contained. Route matching within the `after-oc-1x` phase further distinguishes by overcall suit.
- **Level-dependent HCP thresholds:** 1-level negative doubles require 6+ HCP; 2-level require 8+ HCP. Surfaces use direct `hand.hcp` clauses, not module-derived facts, since the threshold depends on the specific overcall level.

### New Minor Forcing (NMF)
- **3-round auction prefix:** NMF fires after 1m - 1M - 1NT, which is 3 bids before the convention's main decision point. The FSM tracks this with idle → after-1m-open → after-1m-1M → after-1nt-rebid progression.
- **Route-dependent NMF minor:** The NMF bid itself depends on which minor was opened — 2D after 1C opening, 2C after 1D opening. Route matching on `{"act": "open", "strain": "clubs"}` vs `"diamonds"` selects the correct encoding.
- **Inquire reuse:** Both NMF and Stayman produce `Inquire { feature: MajorSuit }`. This is safe because they occupy different FSM phases — Stayman is in `idle` (after 1NT opening), NMF is in `after-1nt-rebid` (after 1m-1M-1NT). Modules sharing the same `BidAction` shape are safe as long as they occupy different FSM phases.
