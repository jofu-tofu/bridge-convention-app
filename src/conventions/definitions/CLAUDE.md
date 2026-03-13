# Convention Definitions

Convention folders that each implement a bridge bidding convention. Each is self-contained with deal constraints, protocol trees, config, and teaching metadata.

## Folder Structure

5 conventions: `stayman/`, `bergen-raises/`, `sayc/`, `weak-twos/`, `lebensohl-lite/`. Each folder has:
- `tree.ts` — protocol + hand subtrees
- `config.ts` — deal constraints + ConventionConfig with `protocol` field
- `explanations.ts` — teaching metadata scaffold (ConventionExplanations)
- `index.ts` — barrel exports + `registerConvention()` call
- Optional: `helpers.ts`, `conditions.ts`, `transitions.ts`, `resolvers.ts`, `overlays.ts`, `constants.ts`

**`nt-bundle/`** -- Combines Stayman + Jacoby Transfers into a single 1NT response bundle. Files:
- `config.ts` -- `ConventionBundle` with `meaningSurfaces`, `factExtensions`, `surfaceRouter`, `conversationMachine`, `declaredCapabilities: { ntOpenerContext: "active" }`
- `meaning-surfaces.ts` -- `MeaningSurface[]` definitions: responder R1 (5), opener Stayman response (3), opener transfer accept hearts (1), opener transfer accept spades (1), Stayman R3 after 2H/2S/2D (4+4+2), transfer R3 after hearts/spades accept (4+4) -- 28 surfaces total
- `facts.ts` -- `FactCatalogExtension`s for module-derived facts (`module.stayman.*`, `module.transfer.*`, `module.ntResponse.*`)
- `semantic-classes.ts` -- module-local semantic class constants (not in central registry)
- `surface-routing.ts` -- `RoutedSurfaceGroup[]` for round-aware surface selection
- `activation.ts` -- activation filter for 1NT opening detection
- `alternatives.ts` -- cross-convention alternative groups for teaching
- `system-profile.ts` -- `NT_SAYC_PROFILE` SystemProfileIR for profile-based module activation
- `machine.ts` -- Conversation machine FSM (13 states: idle -> nt-opened -> responder-r1/opener-stayman/opener-transfer/terminal/nt-contested)
- `pedagogical-relations.ts` -- `NT_PEDAGOGICAL_RELATIONS` pedagogical relation graph (same-family, stronger-than, fallback-of, continuation-of, near-miss-of)

**`bergen-bundle/`** -- Bergen Raises R1 (responder's initial response to 1M-P) using the meaning pipeline with surface bindings for suit parameterization. Files:
- `config.ts` -- `ConventionBundle` with `meaningSurfaces`, `factExtensions`, `surfaceRouter`, `conversationMachine`, `internal: true` (parity testing)
- `meaning-surfaces.ts` -- `createBergenR1Surfaces(suit)` factory producing 5 surfaces parameterized by `$suit` binding (splinter, game, limit, constructive, preemptive), instantiated for hearts and spades (10 surfaces total)
- `facts.ts` -- `FactCatalogExtension` for `module.bergen.hasMajorSupport`
- `semantic-classes.ts` -- module-local Bergen semantic class constants
- `machine.ts` -- minimal FSM: idle -> major-opened -> responder-r1-hearts/spades -> terminal
- `system-profile.ts` -- `BERGEN_PROFILE` SystemProfileIR
- `surface-routing.ts` -- 2 routed surface groups (responder-r1-hearts, responder-r1-spades)

Shared across conventions and bundles: `shared-helpers.ts` -- `STRAIN_TO_BIDSUIT` lookup and `strainToBidSuit()` function. Used by Stayman, Weak Twos, and Lebensohl Lite resolvers.

## Convention Quick Reference

- **Stayman:** Responds to NT openings (1NT and 2NT). Smolen (3H=4S+5H GF, 3S=5S+4H GF). Multi-round protocol with interference via overlays (`overlays.ts`: `stayman-doubled`, `stayman-overcalled`).
- **Bergen Raises:** Multi-round (constructive/limit/preemptive + opener rebids + game try). Standard Bergen variant (3C=constructive 7-10, 3D=limit 10-12, 3M=preemptive 0-6, splinter 12+).
- **SAYC:** User-drillable + E/W opponent AI default. 55+ flattened rules. All IntentNode leaves with empty resolvers (deterministic via defaultCall). Uses `createIntentBidFactory("sayc")` for deterministic nodeIds (`sayc/{name}`).
- **Weak Twos:** Preemptive opening (2D/2H/2S, 6+ suit, 5-11 HCP), Ogust response system, vulnerability awareness. Interference via protocol branches on `"response"` round (doubled + overcalled), not overlays.
- **Lebensohl Lite:** Uses deprecated `intentBid()` (dynamic tree patterns).

## Convention Parity Checklist

Every convention must satisfy all items before being considered complete:

1. **Factory IDs.** Use `createIntentBidFactory("<convention-id>")` for deterministic `prefix/name` nodeIds. Never use deprecated `intentBid()` (counter-based, non-deterministic). Lebensohl Lite is the only remaining exception.
2. **`intentResolvers` map.** Cover every `SemanticIntentType` used in the tree. If resolvers are empty (all intents use `defaultCall`), document the reason in config (see SAYC: deterministic via `defaultCall`).
3. **`transitionRules` with `baselineRules`.** Convention-specific rules in `transitionRules`, plus `baselineRules: baselineTransitionRules` for two-pass mode. At minimum 4+ convention-specific rules covering the opening/ask/response/denial cycle.
4. **Interference handling (overlay or branch).** Handle at least doubled and overcalled states. Preferred: use `ProtocolBranch` on the round for full tree replacements that students should learn (e.g., Weak Twos `"response"` round). Alternative: use overlay patches in `overlays.ts` for fine-grained hooks (suppress, add, override). Use `matches(state)` predicate with `competitionMode` and/or `getSystemModeFor()` checks.
5. **Non-empty explanations.** `explanations.ts` must have both `convention` (purpose, whenToUse, whenNotToUse, tradeoff, principle, roles) and `decisions` entries for every `handDecision()` node ID in the tree.
6. **`acceptableAlternatives` AlternativeGroup array.** Define in config for adjacent-boundary hands where multiple bids are reasonable. Members reference IntentNode IDs. Tier is `"preferred"` or `"alternative"`.
7. **`dealConstraints` with HCP ranges and shape requirements.** Per-seat `minHcp`/`maxHcp` and `minLengthAny`/`maxLength` as appropriate. Include `dealer` when the convention requires a specific opening position.
8. **`intentFamilies` array (if applicable).** If the convention has multiple IntentNode leaves that form conceptual groups (e.g., equivalent encodings for the same semantic meaning), define IntentFamily entries in config. analyzeIntentFamilies() diagnostic checks member references against protocol trees/overlays.

## ConventionConfig Field Guide

All fields from `ConventionConfig` in `core/types.ts`:

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `id` | Yes | `string` | Unique convention identifier (kebab-case). Used as registry key and URL parameter. |
| `name` | Yes | `string` | Human-readable display name. |
| `description` | Yes | `string` | One-line description for UI display. |
| `category` | Yes | `ConventionCategory` | One of `Asking`, `Defensive`, `Constructive`, `Competitive`. |
| `dealConstraints` | Yes | `DealConstraints` | Seat-specific HCP, shape, and balanced constraints for deal generation. |
| `protocol` | Yes* | `ConventionProtocol<any>` | Protocol definition from `protocol()` builder. All conventions must use protocols. |
| `explanations` | Yes* | `ConventionExplanations` | Teaching metadata keyed by node name. Has `convention`, `decisions`, `bids`, `conditions` sections. |
| `defaultAuction` | No | `(seat, deal?) => Auction \| undefined` | Returns pre-filled auction for drill start position. Return `undefined` for empty auction. |
| `transitionRules` | Yes* | `readonly TransitionRule[]` | Convention-specific dialogue state transitions. Required when tree has IntentNode leaves. |
| `baselineRules` | No | `readonly TransitionRule[]` | Set to `baselineTransitionRules` for two-pass mode (convention rules first, baseline backfills). |
| `intentResolvers` | Yes* | `IntentResolverMap` | `Map<string, IntentResolverFn>` keyed by `SemanticIntentType`. Required when tree has IntentNode leaves. |
| `overlays` | No | `readonly ConventionOverlayPatch[]` | Overlay patches for interference handling. Validated against protocol round names at registration. |
| `acceptableAlternatives` | No | `readonly AlternativeGroup[]` | Groups of semantically interchangeable intents for grading. |
| `internal` | No | `boolean` | If `true`, hidden from UI picker (e.g., SAYC as opponent AI). |
| `allowedDealers` | No | `readonly Seat[]` | Random dealer selection; constraints rotate 180 degrees when dealer differs from `dealConstraints.dealer`. |
| `teaching` | No | `ConventionTeaching` | Convention-level teaching metadata (purpose, whenToUse, etc.). Usually set in `explanations.convention` instead. |
| `interferenceSignatures` | No | `readonly InterferenceSignature[]` | Bid signatures opponents may classify as interference. |
| `rankCandidates` | No | `(candidates, context) => candidates` | Optional candidate ranker. No conventions use this yet (future seam). |
| `pedagogicalCheck` | No | `(candidate, ctx) => { acceptable, reasons }` | Optional pedagogical filter — feeds the pedagogical dimension of CandidateEligibility. Checked via isPedagogicallyAcceptable() (post-selection annotation, not a selection gate). No conventions use this yet. |
| `intentFamilies` | No | `readonly IntentFamily[]` | Groups of semantically related IntentNode leaves for diagnostics and family-aware teaching grading. Members reference IntentNode names. IntentRelationship: mutually_exclusive, equivalent_encoding, policy_alternative. |
| `activationFilter` | Yes (bundles) | `(auction, seat) => readonly string[]` | Returns active convention IDs given auction state. |
| `meaningSurfaces` | No | `readonly { groupId, surfaces }[]` | Meaning surfaces organized by group. When present, meaning pipeline is used. |
| `factExtensions` | No | `readonly FactCatalogExtension[]` | Module-derived fact definitions. |
| `surfaceRouter` | No | `(auction, seat) => readonly MeaningSurface[]` | Round-aware surface filtering. |
| `systemProfile` | No | `SystemProfileIR` | Profile-based module activation. |
| `conversationMachine` | No | `ConversationMachine` | FSM for hierarchical surface selection. |
| `declaredCapabilities` | No | `Readonly<Record<string, string>>` | Capabilities injected into profile-based activation. Bundles without this field get no capabilities. |

*Required in practice for a complete convention, though TypeScript marks them optional.

**Examples:**

Stayman config (full-featured with overlays):
```ts
export const staymanConfig: ConventionConfig = {
  id: "stayman",
  name: "Stayman",
  description: "Stayman convention: 2C response to 1NT asking for 4-card majors",
  category: ConventionCategory.Asking,
  dealConstraints: staymanDealConstraints,
  protocol: staymanProtocol,
  explanations: staymanExplanations,
  defaultAuction: staymanDefaultAuction,
  transitionRules: staymanTransitionRules,
  baselineRules: baselineTransitionRules,
  intentResolvers: staymanResolvers,
  overlays: staymanOverlays,
};
```

SAYC config (empty resolvers, no overlays at convention level):
```ts
export const saycConfig: ConventionConfig = {
  id: "sayc",
  name: "Standard American Yellow Card",
  description: "Standard American Yellow Card — full bidding system...",
  category: ConventionCategory.Constructive,
  dealConstraints: { seats: [{ seat: Seat.South, minHcp: 10 }] },
  defaultAuction: () => undefined,
  protocol: saycProtocol,
  transitionRules: saycTransitionRules,
  baselineRules: baselineTransitionRules,
  intentResolvers: saycResolvers,
  overlays: saycOverlays,
  acceptableAlternatives: saycAlternativeGroups,
};
```

## File Templates

Skeleton templates based on Stayman (reference implementation). Replace `{name}` with convention ID (kebab-case) and `{Name}` with PascalCase name.

### tree.ts

```ts
import { BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import {
  bidMade, isResponder, isOpener, lastEntryIsPass,
  hcpMin, hcpRange, suitMin, anySuitMin, and,
} from "../../core/conditions";
import { handDecision, fallback } from "../../core/tree/rule-tree";
import type { HandNode } from "../../core/tree/rule-tree";
import { createIntentBidFactory } from "../../core/intent/intent-node";
import { SemanticIntentType } from "../../core/intent/semantic-intent";
import { protocol, round, semantic } from "../../core/protocol/protocol";
import type { ConventionProtocol, EstablishedContext } from "../../core/protocol/protocol";

const bid = createIntentBidFactory("{name}");

// ─── Established context ────────────────────────────────────
interface {Name}Established extends EstablishedContext {
  // Convention-specific fields set by semantic() triggers
}

// ─── Hand subtrees ──────────────────────────────────────────
const round1Tree: HandNode = handDecision(
  "decision-id",
  hcpMin(/* threshold */),
  bid("{name}-intent-name", "Describes what this bid communicates",
    { type: SemanticIntentType.NaturalBid, params: {} },
    (): Call => ({ type: "bid", level: 1, strain: BidSuit.Clubs })),
  fallback("fallback-id"),
);

// ─── Protocol ────────────────────────────────────────────────
export const {name}Protocol: ConventionProtocol<{Name}Established> =
  protocol<{Name}Established>("{name}", [
    round<{Name}Established>("round-1-name", {
      triggers: [
        semantic<{Name}Established>(bidMade(1, BidSuit.NoTrump), { /* established */ }),
      ],
      handTree: round1Tree,
      seatFilter: and(isResponder(), lastEntryIsPass()),
    }),
    // Additional rounds...
  ]);
```

### resolvers.ts

```ts
import { BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import { SystemMode, getSystemModeFor } from "../../core/dialogue/dialogue-state";
import type { DialogueState } from "../../core/dialogue/dialogue-state";
import { SemanticIntentType } from "../../core/intent/semantic-intent";
import type { IntentResolverFn, IntentResolverMap } from "../../core/intent/intent-resolver";
// import { {NAME}_CAPABILITY } from "./constants";  // if using per-capability system mode

const myResolver: IntentResolverFn = (intent, state) => {
  // System mode check (if convention has per-capability mode):
  // if (getSystemModeFor(state, {NAME}_CAPABILITY) === SystemMode.Off) return { status: "declined" };

  // ResolverResult union: "resolved" | "use_default" | "declined"
  return {
    status: "resolved",
    calls: [{ call: { type: "bid", level: 2, strain: BidSuit.Clubs } }],
  };
};

export const {name}Resolvers: IntentResolverMap = new Map<string, IntentResolverFn>([
  [SemanticIntentType.NaturalBid, myResolver],
  // Map every SemanticIntentType used in tree.ts
]);
```

### transitions.ts

```ts
import type { TransitionRule } from "../../core/dialogue/dialogue-transitions";
import { ForcingState, ObligationKind } from "../../core/dialogue/dialogue-state";
import type { DialogueState } from "../../core/dialogue/dialogue-state";
import type { Seat } from "../../../engine/types";
import { BidSuit } from "../../../engine/types";
import { areSamePartnership, partnerOfOpener, isOpenerSeat } from "../../core/dialogue/helpers";

export const {name}TransitionRules: readonly TransitionRule[] = [
  // Rule 1: Opening / triggering bid
  {
    id: "{name}-opening",
    matchDescriptor: { familyId: "1nt", callType: "bid", level: 1, strain: BidSuit.NoTrump },
    matches(state: DialogueState, entry) {
      const { call } = entry;
      return call.type === "bid" && call.level === 1 && call.strain === BidSuit.NoTrump;
    },
    effects() {
      return {
        setFamilyId: "1nt",
        setForcingState: ForcingState.ForcingOneRound,
      };
    },
  },
  // Rule 2: Convention ask
  {
    id: "{name}-ask",
    matchDescriptor: { /* ... */ },
    matches(state: DialogueState, entry) { /* ... */ return false; },
    effects() { return { setForcingState: ForcingState.ForcingOneRound }; },
  },
  // Rule 3: Response
  {
    id: "{name}-response",
    matchDescriptor: { /* ... */ },
    matches(state: DialogueState, entry) { /* ... */ return false; },
    effects() { return { setForcingState: ForcingState.Nonforcing }; },
  },
  // Rule 4: Interference handling
  {
    id: "{name}-interference",
    matchDescriptor: { callType: "double", actorRelation: "opponent" },
    matches(state: DialogueState, entry) {
      const { call, seat } = entry;
      return call.type === "double" &&
        !areSamePartnership(seat, state.conventionData["openerSeat"] as Seat);
    },
    effects() { return { /* setSystemCapability, etc. */ }; },
  },
];
```

### overlays.ts

```ts
import { CompetitionMode, SystemMode } from "../../core/dialogue/dialogue-state";
import { getSystemModeFor } from "../../core/dialogue/dialogue-state";
import type { ConventionOverlayPatch } from "../../core/overlay/overlay";
import { fallback } from "../../core/tree/rule-tree";
// import { {NAME}_CAPABILITY } from "./constants";

export const {name}Overlays: readonly ConventionOverlayPatch[] = [
  {
    id: "{name}-doubled",
    roundName: "round-1-name",  // must match a protocol round name
    matches: (state) =>
      state.competitionMode === CompetitionMode.Doubled,
      // && getSystemModeFor(state, {NAME}_CAPABILITY) === SystemMode.Modified,
    // Hook options: replacementTree, suppressIntent, addIntents, overrideResolver
    replacementTree: fallback("system-off"),  // or a real hand tree
  },
  {
    id: "{name}-overcalled",
    roundName: "round-1-name",
    matches: (state) =>
      state.competitionMode !== CompetitionMode.Uncontested,
      // && getSystemModeFor(state, {NAME}_CAPABILITY) === SystemMode.Off,
    replacementTree: fallback("system-off-overcall"),
  },
];
```

### explanations.ts

```ts
import type { ConventionExplanations } from "../../core/tree/rule-tree";

export const {name}Explanations: ConventionExplanations = {
  convention: {
    purpose: "What problem this convention solves",
    whenToUse: "Trigger conditions in plain English",
    whenNotToUse: [
      "Situation where this convention should not be used",
    ],
    tradeoff: "What you give up by playing this convention",
    principle: "The underlying bridge principle",
    roles: "Who controls the auction (captain/describer)",
  },

  // One entry per handDecision() node ID in tree.ts
  decisions: {
    "decision-id": {
      whyThisMatters: "Why this decision point exists",
      commonMistake: "What beginners get wrong here",
      // Optional: denialImplication
    },
  },

  // One entry per intentBid() node ID in tree.ts
  bids: {
    "{name}-intent-name": {
      whyThisBid: "Why this specific call is made",
      partnerExpects: "What partner should do next",
      forcingType: "forcing",  // "forcing" | "game-forcing" | "invitational" | "signoff"
      // Optional: isArtificial, commonMistake
    },
  },

  // Condition-type explanations (optional, shared across conditions of same type)
  conditions: {
    "hcp-min": "Why the HCP threshold matters in this convention",
    "suit-min": "Why the suit length requirement exists",
  },
};
```

## Common Pitfalls

1. **Using deprecated `intentBid()` instead of factory.** `intentBid()` generates counter-based nodeIds that are non-deterministic across builds. Always use `createIntentBidFactory("{convention-id}")` which produces stable `prefix/name` IDs. Duplicates within a factory throw at construction time.

2. **Missing `baselineRules` in config.** Without `baselineRules: baselineTransitionRules`, the dialogue manager runs single-pass mode and baseline patterns (NT family detection, interference classification, pass handling) are not applied. Always set `baselineRules` for two-pass mode.

3. **Forgetting system mode checks in resolvers.** When interference modifies or disables the convention, resolvers must check `getSystemModeFor(state, CAPABILITY)` and return `{ status: "declined" }` when the system is off. Without this, the resolver produces bids that conflict with the overlay's intent. Define capability constants in `constants.ts` (not `index.ts`) to avoid circular dependencies.

4. **Empty `decisions` in explanations.** Every `handDecision("node-id", ...)` in the tree must have a corresponding entry in `explanations.decisions["node-id"]`. Missing entries cause the teaching UI to show blank explanation panels.

5. **Overlay `roundName` mismatch.** The `roundName` in an overlay must exactly match a `round()` name in the protocol. Mismatches are caught by `validateOverlayPatches()` at registration time, but typos cause silent failures during development.

6. **Reusing node object references across tree branches.** Each `handDecision()` / `intentBid()` node must be a unique object instance. Sharing references breaks `flattenTree()` traversal. Create separate instances even if the logic is identical.

7. **Mixing auction and hand conditions in `and()`/`or()`.** Compound conditions throw if they mix `category: "auction"` and `category: "hand"`. Use nested `handDecision()` nodes instead.

8. **Not wiring `establishes`/`conventionData` synchrony.** When a protocol trigger sets a field via `establishes`, the same field must be set in `conventionData` via transition rules. Add a synchrony test in `cross-engine-invariants.test.ts` (Invariant 5).

## Authoring Guides

### Resolver Authoring

Resolvers map `SemanticIntent` to concrete `Call` objects. They receive `(intent, state)` and must return a `ResolverResult`:

- **`{ status: "resolved", calls: [{ call }] }`** — one or more concrete encodings. First legal call wins.
- **`{ status: "use_default" }`** — fall back to the IntentNode's `defaultCall`.
- **`{ status: "declined" }`** — intent is invalid in this context; exclude the candidate entirely.

**Pattern:**
```ts
const myResolver: IntentResolverFn = (intent, state) => {
  // 1. Check system mode (if applicable)
  if (getSystemModeFor(state, CAPABILITY) === SystemMode.Off) return { status: "declined" };

  // 2. Extract intent params
  const suit = intent.params["suit"] as string;

  // 3. Compute the call
  const strain = STRAIN_TO_BIDSUIT[suit];
  if (!strain) return { status: "declined" };

  return { status: "resolved", calls: [{ call: { type: "bid", level: 2, strain } }] };
};
```

**Rules:**
- Cover every `SemanticIntentType` used in the tree, or the candidate pipeline will use `defaultCall` only.
- Return `"declined"` (not `"use_default"`) when the intent is semantically invalid (e.g., system off).
- Use `STRAIN_TO_BIDSUIT` from `shared-helpers.ts` for suit-to-BidSuit conversion.
- For deterministic conventions (SAYC), resolvers can be empty Maps — all intents use `defaultCall`.

### Overlay Authoring

Overlays patch protocol rounds for interference. Each `ConventionOverlayPatch` has:

- **`id`** — unique overlay identifier.
- **`roundName`** — must exactly match a `round()` name in the protocol.
- **`matches(state)`** — predicate on `DialogueState`. Check `competitionMode`, `systemMode`, `interferenceDetail`, etc.
- **`priority?`** — lower number = higher precedence. Default is 0. Only matters when multiple overlays match the same round.

**Hook types** (applied in order in `generateCandidates()`):
1. `replacementTree` — replaces the entire hand tree for the round. First matching overlay wins.
2. `suppressIntent(intent, ctx)` — return `true` to suppress an intent. All overlays compose (all suppressions apply).
3. `addIntents(ctx)` — inject intents not in the tree. All overlays concatenate. Can rescue empty candidate pools.
4. `overrideResolver(intent, ctx)` — return a `Call` to override, `null` to fallthrough. First non-null wins.

**Pattern:**
```ts
{
  id: "{name}-doubled",
  roundName: "nt-opening",
  matches: (state) =>
    state.competitionMode === CompetitionMode.Doubled &&
    getSystemModeFor(state, CAPABILITY) === SystemMode.Modified,
  replacementTree: modifiedHandTree,  // or use hooks for finer control
}
```

**Branch vs overlay heuristic:** Use a `ProtocolBranch` (on the round's `branches` array) when ALL three conditions hold: (1) the overlay has `replacementTree` with >1 hand decision node, (2) it represents a named interference scenario a student should learn (e.g., "after opponent doubles"), and (3) the convention already has 3+ overlays on the same round. Use an overlay for everything else (suppress, addIntents, overrideResolver, trivial fallback trees, single-node replacement trees). Branches are first-class protocol variants with teaching labels; overlays are local patches. Branch `handTree` takes precedence over overlay `replacementTree` on the same round.

### Transition Rule Authoring

Transition rules define how the dialogue state evolves as the auction progresses. Each `TransitionRule` has:

- **`id`** — unique rule identifier (convention-scoped, appears in diagnostics).
- **`matchDescriptor`** — required `TransitionRuleDescriptor` on all convention transition rules (validated at registration; missing descriptors throw). Fields: `familyId`, `obligationKind`, `callType`, `level`, `strain`, `actorRelation`. Used by diagnostics to detect overlapping rules. Optional only for baseline rules and test fixtures.
- **`matches(state, entry, auction, entryIndex)`** — predicate on current state + auction entry. `entry: AuctionEntry` bundles `{ call, seat }`.
- **`effects(state, entry, auction, entryIndex)`** — returns a `DialogueEffect` with `set*` prefix fields.

**Key `DialogueEffect` fields:**
- `setFamilyId` — convention family (e.g., `"1nt"`, `"2nt"`)
- `setForcingState` — `ForcingState.ForcingOneRound`, `Nonforcing`, `GameForcing`
- `setObligation` — `{ kind: ObligationKind, obligatedSide: "opener" | "responder" }`
- `setAgreedStrain` — `{ type: "suit", suit, confidence }` or `{ type: "none" }`
- `setSystemCapability` — `Record<string, SystemMode>` for per-capability mode
- `mergeConventionData` — `Record<string, unknown>` merged into `conventionData`

**Causality contract:** Use actor-aware helpers (`areSamePartnership`, `partnerOfOpener`, `isOpenerSeat`) to prevent opponent bids from triggering partnership effects. Always check the seat relationship in `matches()`.

**Two-pass mode:** Convention rules fire first-match-wins, then `baselineRules` backfill untouched fields. Registration validates no rule ID appears in both arrays.

## Adding a Convention

1. Create `definitions/{name}/` folder with `tree.ts`, `config.ts`, `explanations.ts`, `index.ts`. Optionally add `helpers.ts`, `conditions.ts`, `transitions.ts`, `resolvers.ts`, `overlays.ts`, `constants.ts`.
2. Build a `ConventionProtocol` using `protocol()`, `round()`, `semantic()` from `core/protocol`. Use `handDecision()`, `createIntentBidFactory()`, `fallback()` from `core/rule-tree` and `core/intent/`.
3. Wire resolvers for every `SemanticIntentType` used in the tree.
4. Write transition rules with `baselineRules` for two-pass mode.
5. Add at least one overlay for opponent interference.
6. Populate `explanations.ts` with `convention`, `decisions`, and `bids` entries.
7. Define `acceptableAlternatives` for adjacent-boundary intents.
8. Add `registerConvention({name}Config)` in `index.ts` and import in `definitions/index.ts`.
9. Create `__tests__/{name}/` with `rules.test.ts` and `edge-cases.test.ts`. Import shared helpers from `../fixtures` and `../tree-test-helpers`.
10. Test deal constraints with `checkConstraints()` — verify acceptance and rejection.
11. Test bidding rules with `evaluateBiddingRules()` — verify rule matching, call output, and `conditionResults`.
12. Run the parity checklist above before considering the convention complete.

## Authoring Rules

- **Generalize before specializing.** When a convention needs a capability that doesn't exist in `core/`, design the solution to work for any convention — not just yours. If the abstraction only makes sense for one convention, it belongs in `definitions/{name}/`, not in `core/`. See root `CLAUDE.md` § Design Philosophy.
- **Established↔conventionData synchrony.** When a protocol trigger's `establishes` field sets a semantic fact that downstream consumers need (resolvers, overlays, teaching), the convention's transition rules MUST set the same fact in `conventionData`. Add a synchrony test in `cross-engine-invariants.test.ts` (Invariant 5) for each such shared fact.

## Test Organization

```
__tests__/
  {convention}/              Per-convention test folders
    rules.test.ts            Core bidding rules + deal constraints
    edge-cases.test.ts       Interference, boundaries, unusual shapes
  sayc/                      SAYC split by position (large convention)
    helpers.ts               Shared makeBiddingContext + callFromRules
    opening.test.ts, responses.test.ts, rebids.test.ts, competitive.test.ts
    disjoint.test.ts         Rule overlap + reachability checks
    edge-cases.test.ts
    factory-migration.test.ts  Factory pattern + explanations population checks
    transitions.test.ts      Dialogue state transition tests
  infrastructure/            Shared engine primitives (rule-tree, tree-compat, registry, etc.)
  cross-convention.test.ts   Multi-convention interaction tests
  fixtures.ts                Shared helpers (hand, auctionFromBids, makeBiddingContext)
  tree-test-helpers.ts       Tree evaluation test utilities
  _convention-template.test.ts  Template for new conventions
```

Bergen splits into `rules-responder.test.ts` + `rules-opener-rebids.test.ts`. Stayman splits into `rules.test.ts` + `rules-extended.test.ts`.

5. **Module-derived facts for NT-specific thresholds.** `module.ntResponse.inviteValues`, `module.ntResponse.gameValues`, `module.ntResponse.slamValues` are in `nt-bundle/facts.ts` as `ntResponseFacts` extension (not in shared `BRIDGE_DERIVED_FACTS`). They fail the promotion rule (cannot be named without "1NT"). Any test or strategy that evaluates NT surfaces must include `ntResponseFacts` in its `createFactCatalog()` call, or these facts will be absent and clauses referencing them will fail closed.

---

## Context Maintenance

**After modifying files in this directory:** scan the entries above — if any claim is now
false or incomplete, update this file before ending the task. Do not defer.

**Staleness anchor:** This file assumes `stayman/index.ts` exists. If it doesn't, this file
is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-03-03 | last-audited=2026-03-08 | version=3 | dir-commits-at-audit=55 | tree-sig=dirs:22,files:110,exts:ts:109,md:3 -->
