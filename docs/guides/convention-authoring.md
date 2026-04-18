# Convention Authoring Guide

Complete guide for writing new convention bundles. Covers the full lifecycle from file creation to verification.

## Authoritative Bridge Rules Sources

Authority policy (tier table, Category A vs B, invariants) lives in
`docs/architecture/authority-and-module-composition.md`. Read that before
picking a new authority or swapping an existing one. Quick summary:

- Tier 1 authorities: **ACBL SAYC booklet PDF**, **Larry Cohen** (`larryco.com/bridge-articles`), **Karen Walker** (`kwbridge.com`).
- Wikipedia and bridgebum.com are **discovery only**, never authority.
- `references.authority.url` must not equal `references.discovery.url` (structural invariant).
- Dead sites and Wayback snapshots are forbidden.

Cross-reference for composition concepts (`variantOf`, `delegate_to`, `requires`)
is in the same doc.

## Convention Quick Reference

- **NT Bundle (1NT Responses):** Stayman (2C ask) + Jacoby Transfers (2D→H, 2H→S) + Smolen (3H/3S game-forcing after denial with 5-4 majors). 35 surfaces, 4 fact extensions.
- **Bergen Bundle:** Standard Bergen (3C=constructive 7–10, 3D=limit 10–12, 3M=preemptive 0–6, splinter 12+). `$suit` binding for DRY heart/spade parameterization.
- **Weak Two Bundle:** Weak Two openings (2D/2H/2S) with Feature responses. `2NT` asks opener to rebid the weak-two suit with a minimum, show a side ace/king with extras, or bid `3NT` with a solid trump suit.
- **DONT Bundle:** Competitive overcalls after opponent's 1NT. No `match.turn` — uses phase + route scoping. Modern variant with natural direct 2S, direct monster two-suiters, direct preempts, and relay continuations. 114 surfaces, 31 facts.

Deal constraints are never listed per bundle here because they are auto-derived from surface preconditions at runtime — add a surface and the generator will find hands. See `docs/architecture/teaching-architecture.md` § Deal Generation.

## Completeness Checklist

Every convention bundle must satisfy all items:

1. **`meaningSurfaces` with grouped surfaces.** Every surface needs `meaningId`, `encoding`, `clauses` (with `factId`, `operator`, `value`), and `ranking` (`band`, `declarationOrder`). `modulePrecedence` defaults to 0 — do NOT set it. Specificity is pipeline-derived. All `FactDefinition` objects must declare `constrainsDimensions`.
2. **`factExtensions` for module-derived facts.** Facts not in shared `BRIDGE_DERIVED_FACTS` must be defined in `facts.ts`. Use factory helpers (`defineBooleanFact`, `definePerSuitFacts`, `defineHcpRangeFact`, `buildExtension`) from `conventions/pipeline/fact-factory.ts`.
3. **`modules` for surface selection.** `ConventionModule[]` with `local` (LocalFsm) and `states` (StateEntry[]).
4. **`systemProfile` for activation.**
5. **`defaultRole` for practice defaults.** Every module fixture needs a top-level `defaultRole` with one of `"opener"`, `"responder"`, or `"both"`. This is module-level metadata, not a per-system override.
6. **Deal constraints are auto-derived, not authored.** The runtime unions surface preconditions across target-bundle + base-system modules (`fact_dsl::inversion::derive_deal_constraints`) and rejection-samples deals until the user's expected bid lands on a target-module surface. Never add `dealConstraints` / `offConventionConstraints` to a bundle fixture — those fields no longer exist. Your only input is the surface clauses themselves; make them tight enough to describe the lesson and the generator will find hands.
7. **`category` and `description`** required on `ConventionBundle`.
8. **`explanationCatalog` entries.** Template-keyed explanations for teaching projections.
9. **`semantic-classes.ts` constants.** Module-local, not in central registry.

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

## Authoring `biddingContext`

Every module fixture carries an optional top-level `biddingContext` tuple that names the auction position where the module fires. It complements the prose `reference.summaryCard.trigger` with a machine-groupable value used by future auto-derived related-links, structured trigger rendering, and engine-side module gating.

Shape:

```json
"biddingContext": {
  "openerBids": [{ "type": "bid", "level": 1, "strain": "NT" }],
  "openerRole": "partner",
  "competitive": false
}
```

- `openerBids` is a non-empty list of `Call` values. `Call` is internally tagged — use the same `{"type":"bid","level":L,"strain":S}` shape as worked-auction `call` fields (see e.g. `fixtures/modules/stayman.json` around the first `"call"`). Strain values: `"C"`, `"D"`, `"H"`, `"S"`, `"NT"`. Empty list fails deserialize.
- Most modules have length 1 (Stayman: `[1NT]`). Length >1 is for modules that fire across a set of openings (Negative Doubles: `[1C, 1D, 1H, 1S]`).
- `openerRole` is `"partner"` (partner opened) or `"opponent"` (an opponent opened). Partnership-scoped, not seat-scoped.
- `competitive: true` when the module's trigger requires an intervening overcall/double (e.g. Negative Doubles). For uncontested triggers (Stayman, Jacoby transfers), set `false`.

The integration test `bidding_context_consistency.rs` asserts the authored tuple agrees with the FSM idle-exit edge where that's derivable (single-hop Inquire/Transfer → 1NT; single-hop Open → level+strain). Multi-hop modules are pinned via an allowlist in the test. If the test fails with a "not derivable and not in allowlist" message, either add `level`/`strain` to the FSM edge or add an allowlist entry.

## Authoring `defaultRole`

Every module fixture carries a required top-level `defaultRole`. This seeds the `/practice` Auto role selection and must be authored explicitly as `"opener"`, `"responder"`, or `"both"`.

Use this derivation table as the starting point:

| fixture shape                                                | `defaultRole` seed |
| ------------------------------------------------------------ | ------------------ |
| `biddingContext.openerRole: "partner"` + `competitive: true` | `Both`             |
| `biddingContext.openerRole: "partner"`                       | `Responder`        |
| `biddingContext.openerRole: "opponent"`                      | `Opener`           |
| no `biddingContext` block                                    | `Opener`           |

If ConventionForge verification disagrees with the heuristic, author the explicit `defaultRole` value from the authority and record the reason in the fixture's existing note metadata (for example `_notes` or a sibling variant-notes file when the fixture already uses one).

## Reference Block Authoring

Every fixture-backed learn page must carry a hand-authored `reference` block. It is the source of truth for the prerendered `/learn/[moduleId]` reference page, and fixture deserialization now fails if the block is missing. Treat it as editorial copy: concise, reference-first, and stable enough for deep links and print.

The fixture's top-level `displayName` is also authoritative for the learn-page H1 and catalog card title. If you rename a module for reference-page presentation, update `displayName` in the fixture and rerun `npm run static:extract` so `.generated/learn-data.json` picks up the new title.

### Reference block example

```json
"reference": {
  "summaryCard": {
    "trigger": "Partner opens one notrump, you respond",
    "definingMeaningId": "stayman:ask",
    "partnership": "Common agreement."
  },
  "whenToUse": [
    {
      "predicate": {
        "kind": "and",
        "operands": [
          { "kind": "extended", "clause": { "clauseKind": "booleanFact", "fact_id": "system.responder.inviteValues", "expected": true } },
          { "kind": "extended", "clause": { "clauseKind": "booleanFact", "fact_id": "bridge.hasFourCardMajor", "expected": true } }
        ]
      },
      "gloss": "Use Stayman with invitational values and a four-card major."
    }
  ],
  "workedAuctions": [
    {
      "kind": "positive",
      "label": "Main line: find the fit",
      "calls": [
        {
          "seat": "Responder",
          "call": { "type": "bid", "level": 2, "strain": "C" },
          "rationale": "Asks for a 4-card major with game interest."
        }
      ]
    },
    {
      "kind": "negative",
      "label": "Counter-example: flat shape reaches the wrong game",
      "responderHand": {
        "spades": "K J 3",
        "hearts": "Q 8 4 2",
        "diamonds": "K 7 4",
        "clubs": "Q 8 5"
      },
      "calls": [
        {
          "seat": "Responder",
          "call": { "type": "bid", "level": 4, "strain": "H" },
          "rationale": "The fit exists, but 3NT was cold while 4♥ needed a finesse and went down."
        }
      ]
    }
  ],
  "interference": {
    "status": "applicable",
    "items": [
      {
        "opponentAction": "Double of 2♣ or a 2♦ overcall",
        "ourAction": "Keep normal Stayman structure unless the opponents bid again.",
        "note": "Responder's 2♦ after a double is to play."
      }
    ]
  },
  "quickReference": {
    "kind": "grid",
    "rowAxis": {
      "kind": "systemFactLadder",
      "label": "Responder strength",
      "facts": [
        "system.responder.weakHand",
        "system.responder.inviteValues",
        "system.responder.gameValues"
      ]
    },
    "colAxis": {
      "kind": "partitionLadder",
      "label": "Major-suit shape",
      "fact": "responder.majorShape"
    },
    "cells": [
      [
        { "kind": "notApplicable", "reason": { "kind": "extended", "clause": { "clauseKind": "booleanFact", "fact_id": "bridge.hasFourCardMajor", "expected": false } } },
        { "kind": "auto" },
        { "kind": "surface", "id": "stayman:ask-major" },
        { "kind": "notApplicable", "reason": { "kind": "extended", "clause": { "clauseKind": "booleanFact", "fact_id": "hand.isBalanced", "expected": true } } }
      ],
      [
        { "kind": "notApplicable", "reason": { "kind": "extended", "clause": { "clauseKind": "booleanFact", "fact_id": "bridge.hasFourCardMajor", "expected": false } } },
        { "kind": "auto" },
        { "kind": "surface", "id": "stayman:ask-major" },
        { "kind": "notApplicable", "reason": { "kind": "extended", "clause": { "clauseKind": "booleanFact", "fact_id": "hand.isBalanced", "expected": true } } }
      ],
      [
        { "kind": "notApplicable", "reason": { "kind": "extended", "clause": { "clauseKind": "booleanFact", "fact_id": "bridge.hasFourCardMajor", "expected": false } } },
        { "kind": "auto" },
        { "kind": "surface", "id": "stayman:ask-major" },
        { "kind": "notApplicable", "reason": { "kind": "extended", "clause": { "clauseKind": "booleanFact", "fact_id": "hand.isBalanced", "expected": true } } }
      ]
    ]
  },
  "relatedLinks": [
    {
      "moduleId": "jacoby-transfers",
      "discriminator": "Show a 5-card major immediately instead of asking opener to choose."
    }
  ]
}
```

**What is NOT authored in `reference`:**

- `summaryCard.bid`, `summaryCard.promises`, `summaryCard.denies` — derived from `definingMeaningId` (`encoding.default_call` + public fact clauses).
- `summaryCard.guidingIdea` — defaults to `teaching.principle`; author only to override.
- `whenNotToUse` — derived from `teaching.commonMistakes` (`{ text, reason }[]`, ≥3 entries).
- `responseTable` — auto-discovered per module. Fixed columns are only `Response | Meaning`; further constraint columns come from the fact IDs present in the module's surfaces. There are no `responseTableOverrides`.
- `systemCompat` — removed; per-system differences render automatically from the active `SystemConfig` via the `systemFactLadder → describe_system_fact_value` chain.
- Worked-auction closing narration — remove `outcomeNote`; if the takeaway matters, put it on the final call's `rationale`.

### Field guide

- `summaryCard.trigger`: Exact auction slot. Keep it concrete and short.
- `summaryCard.definingMeaningId`: ID of the module meaning that defines the convention. Bid / promises / denies render from this meaning's `encoding.default_call` and public fact clauses — do not hand-author them.
- `summaryCard.partnership`: Agreement note such as "requires partnership discussion". Do not name systems (SAYC / 2-1 / Acol / Precision) in this prose; per-system nuance is rendered from the active `SystemConfig`.
- `summaryCard.peers[]` (optional): Authored peer list for peer-structured conventions (Bergen, Jacoby transfers, DONT, Two-way NMF, Unusual NT). When absent the hero layout renders. When present the learn page renders a peer grid. Each entry is `{ definingMeaningId, discriminatorLabel }`; bid / promises / denies derive from `definingMeaningId` via the same pipeline as the top-level summary card. Authoring invariants (enforced by `summary_card_peers_are_well_formed` + `reference_prose_invariants`):
  - `peers.length >= 2` when authored.
  - Every `peers[i].definingMeaningId` resolves to a surface on the same module.
  - The top-level `summaryCard.definingMeaningId` must appear in `peers[]` (the canonical hero within the peer set, used by fallback contexts).
  - `discriminatorLabel` is short authored prose subject to the standard reference-prose invariants (no digits, no system names).
  - Hierarchical conventions (Stayman, Puppet Stayman, Strong 2♣) omit `peers`.
- `whenToUse[]`: Authored `PredicateBullet { predicate, gloss }`. `predicate` is the typed structural condition; `gloss` is the reader-facing bullet text. Prefer existing fact-catalog thresholds and partition predicates over ad-hoc prose conditions.
- `workedAuctions[].kind`: Optional `"positive" | "negative"` discriminator. Omit only when the default positive example is obvious; use `"negative"` for counter-examples you may want to style differently later.
- `workedAuctions[].label`: Short title for the example line, alternative line, or non-example.
- `workedAuctions[].responderHand`: Optional compact hand sample (`{ spades, hearts, diamonds, clubs }`). Use when the worked auction needs a concrete visual counter-example. The current learn page carries this through the payload; a parallel UI pass may still need to render it.
- `workedAuctions[].calls[].seat`: Seat label shown in small caps, typically `Opener` / `Responder`.
- `workedAuctions[].calls[].call`: Bid object or rendered bid string.
- `workedAuctions[].calls[].rationale`: One-line reason for that bid. No paragraph narration.
- `interference`: Tagged union. `{ status: "applicable", items: [{ opponentAction, ourAction, note }] }` with ≥1 item, or `{ status: "notApplicable", reason }`. Empty `items` is illegal.
- `quickReference`: Tagged union. `{ kind: "grid", rowAxis, colAxis, cells }` for 2-D decisions; `{ kind: "list", axis, items: [{ recommendation, note }] }` for 1-D. Grid `cells` are typed bindings: `{"kind":"auto"}`, `{"kind":"surface","id":"..."}`, or `{"kind":"notApplicable","reason":<FactComposition>}`.
- `quickReference.*Axis`: Tagged either `systemFactLadder` (labels derived from active `SystemConfig`) or `partitionLadder` (labels derived from the fact catalog). There is no prose-axis fallback.
- `relatedLinks[].moduleId`: Target learn-page module id.
- `relatedLinks[].discriminator`: The scent text that tells the reader why this other page is different or adjacent.
- Reference prose digit rule: authored strings under `reference.*` must not contain ASCII digits, except in `workedAuctions[].calls[].rationale`, `workedAuctions[].calls[].call`, and `workedAuctions[].responderHand.*`. Spell out auction slots in prose (`"one notrump"`, not `"1NT"`).

### Reference-page authoring checklist

- [ ] `summaryCard` authored fields are `{ trigger, definingMeaningId, partnership }` only.
- [ ] `reference` is present on the fixture; omission is a deserialize error.
- [ ] `whenToUse` is authored as typed `PredicateBullet` entries with non-empty `gloss`.
- [ ] `teaching.commonMistakes` has >=3 entries, each `{ text, reason }` (feeds `whenNotToUse`; do not re-author).
- [ ] `quickReference` is `kind: "grid"` or `kind: "list"`; use `CellBinding` cells and `partitionLadder` / `systemFactLadder` axes only; no null-escape or legacy prose-axis branch.
- [ ] `interference` is either applicable-with-items or notApplicable-with-reason. Empty items is illegal.
- [ ] Every response row and continuation sub-line has a stable anchor id routed through `slugifyMeaningId`.
- [ ] > =3 worked auctions, each annotated inline (no paragraph narration); at least one non-example.
- [ ] Cross-links are labelled with discriminators, not just target names.
- [ ] No history, no re-motivation, no preamble.
- [ ] All bids render in monospace, all seats in small-caps; zero ambiguous pronouns in response-table rows.
- [ ] No ASCII digits in authored `reference.*` prose outside worked-auction rationales, raw worked-auction call fields, and hand-sample strings.
- [ ] No system names (SAYC / 2-1 / Acol / Precision) in authored prose.

## Common Pitfalls

1. **Surface clause `factId` not in catalog.** Missing facts cause clauses to fail closed.
2. **Reusing `meaningId` across surfaces.** Each surface must have a unique `meaningId`.
3. **`$suit` binding errors.** Clauses must reference the binding variable and surface must include `bindings`.
4. **Missing `category` or `description` on bundle.** Both required.
5. **Hand-authoring clauseId/description.** These are auto-derived by the builder.
6. **Semantic class IDs are module-local.** Define in `{bundle}/semantic-classes.ts`, not central registry.
7. **Phase transition vs route matching confusion.** Phase transitions advance FSM state (actor-agnostic). Route matching filters active surfaces (actor-aware). Do not conflate.

## Empirical Mistake Patterns

Recurring errors observed across 18 convention fix commits (2025–2026). Ranked by frequency. Patterns marked **[TESTED]** are caught by `cargo test -p bridge-conventions --test structural_invariants`.

### 1. Missing Surfaces / HCP Dead Zones (most common — 6 occurrences)

Authors implement happy-path surfaces and miss edge cases at HCP boundaries or after less common responses. Examples: Bergen had no surface for 14-16 HCP after constructive raise (hands fell to Pass); Blackwood only handled 0 aces, not 4; Stayman was missing 15 continuation surfaces.

**Prevention checklist:**

- For every opener response, ask: "what does responder do with weak / invite / game / slam values?"
- For every HCP range in a surface, check: "what happens to hands just above and just below this range?"
- Walk through BridgeBum line by line and check off each bid sequence against a surface
- Run `selftest --bundle=<id>` — it catches hands that match no surface (graded as off-system)

### 2. Intent/ID String Mismatches (3 occurrences, all silent failures) **[TESTED]**

After copy-paste or rename, string IDs are not updated. `SuitOpening` vs `SuitOpen` in Michaels. `weak-two` vs `weak-twos` moduleId in 13 surfaces. `bergen-raises` missing from memberIds. The pipeline uses string matching, so typos cause silent breakage.

**Prevention:** The `structural_invariants` test suite checks:

- Every surface `moduleId` matches the file's top-level `moduleId` (or `variant_of` parent)
- Module fixture filename matches the top-level `moduleId`
- Every clause `factId` uses a valid namespace prefix (`hand.`, `system.`, `module.`, `bridge.`)

### 3. Incorrect HCP Ranges / Thresholds (3 occurrences)

Numeric boundaries don't match BridgeBum. Ogust min/max boundary was 8/9 split (should be 7/8). N/S deal constraints were swapped in Negative Doubles. These require domain knowledge to catch.

**Prevention:**

- Always have the BridgeBum page open while authoring
- Cross-check teaching text (`commonMistakes`, `principle`) against clause thresholds — if the teaching text says "6+ HCP" but the clause says 8, one of them is wrong
- Run BridgeBum verification (dispatch verification agents or use BridgeExpertReview skill)

### 4. Surface Priority / Specificity Ordering (2 occurrences)

More specific surfaces (with shape requirements) must rank higher than broader HCP-only surfaces. Bergen splinter (12+ HCP with shortage) was evaluated after game-raise (13+ HCP), so shortage hands matched the broader surface first.

**Prevention:**

- Surfaces with additional shape constraints should have lower `declarationOrder` (higher priority) than broader surfaces in the same state
- Use `recommendationBand: "must"` for the most specific surface when it should always win

### 5. FSM State Machine Gaps — Missing Pass Self-Loops (2 occurrences)

When opponent passes after a response, the FSM walks the ancestor chain back, resetting the convention. Bergen R2 states routed to wrong R3 states. NT Bundle had 4 states with empty transition arrays.

**Prevention:**

- Every non-terminal FSM state needs a pass self-loop (transition that keeps the machine in the same state when an opponent passes)
- The `all_state_phases_reachable_from_fsm` structural invariant test catches orphaned states with no inbound transition **[TESTED]**

### 6. Shape Constraint Guards Missing (2 occurrences)

HCP-only clauses are insufficient for balanced/unbalanced decisions. Jacoby Transfers 3NT surface had no `bridge.hasShortage` clause — recommended 3NT with 5-1-2-5 shape where a new suit is preferred. 2NT invite lacked shortage guard.

**Prevention:**

- Any surface recommending NT (2NT, 3NT) after a suit transfer should have `bridge.hasShortage: false` or equivalent balanced-shape clause
- Ask: "would this bid be wrong for any hand shape that satisfies these HCP clauses?"

### 7. Asymmetric State Coverage (2 occurrences)

When a convention has symmetric paths (hearts vs spades, 1C vs 1D opening), one path has surfaces that the other lacks. Michaels `after-michaels-1s` was missing an invitational heart raise that existed in `after-michaels-1h`.

**Prevention:**

- When authoring symmetric states, count surfaces in each and verify they match
- Copy-paste the symmetric state and swap suits — don't author from scratch

### 8. Deal Constraint / Envelope Errors (2 occurrences)

Historically, hand-authored `dealConstraints` drifted from surface semantics — Stayman envelope was too loose (allowed transfer hands); Michaels only generated major-suit openings. Constraints are now auto-derived from surface preconditions, so this class of error surfaces as **too-loose surface clauses** or **too-loose opening surfaces in the base system** rather than envelope mismatches.

**Prevention:**

- After authoring, run `selftest` with multiple seeds and check that generated hands hit the intended surfaces (not fallback/escape surfaces)
- Tighten surface clauses rather than reaching for a deal-constraint override — the override no longer exists
- If rejection sampling exhausts (`tracing::warn` in `start_drill` logs), the derived envelope is too loose relative to the target surfaces — see Known Limitations in `docs/architecture/teaching-architecture.md`

### 9. Serde / Cross-Boundary Mismatches (2 occurrences)

Data shape on TS side doesn't match Rust expectations. BidGrade used SCREAMING_SNAKE_CASE but TS used kebab-case. TS nested fields inside a `drill` object but Rust expected top-level. All silent — wrong defaults, no runtime error.

**Prevention:**

- When adding new fields that cross the WASM boundary, test the round-trip immediately
- Check `#[serde(rename_all = "...")]` attributes match the TS serialization format

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

- Standard Feature responses (`3M` = minimum, side-suit rebid = outside feature, `3NT` = solid suit with balanced extras)
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
- **2-level shape requirements:** At the 2-level, a negative double promises the unbid major(s), NOT all unbid suits. For example, 1H-(2C)-Dbl shows 4+ spades but does NOT promise 4+ diamonds. Exception: 1S-(2H)-Dbl requires both minors since there is no unbid major.

### New Minor Forcing (NMF)

- **3-round auction prefix:** NMF fires after 1m - 1M - 1NT, which is 3 bids before the convention's main decision point. The FSM tracks this with idle → after-1m-open → after-1m-1M → after-1nt-rebid progression.
- **Route-dependent NMF minor:** The NMF bid itself depends on which minor was opened — 2D after 1C opening, 2C after 1D opening. Route matching on `{"act": "open", "strain": "clubs"}` vs `"diamonds"` selects the correct encoding.
- **Inquire reuse:** Both NMF and Stayman produce `Inquire { feature: MajorSuit }`. This is safe because they occupy different FSM phases — Stayman is in `idle` (after 1NT opening), NMF is in `after-1nt-rebid` (after 1m-1M-1NT). Modules sharing the same `BidAction` shape are safe as long as they occupy different FSM phases.
