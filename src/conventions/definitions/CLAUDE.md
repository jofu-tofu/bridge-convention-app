# Convention Definitions

Convention folders that each implement a bridge bidding convention. Each is self-contained with deal constraints, protocol trees, config, and teaching metadata.

## Folder Structure

5 conventions: `stayman/`, `bergen-raises/`, `sayc/`, `weak-twos/`, `lebensohl-lite/`. Each folder has:
- `tree.ts` — protocol + hand subtrees
- `config.ts` — deal constraints + ConventionConfig with `protocol` field
- `explanations.ts` — teaching metadata scaffold (ConventionExplanations)
- `index.ts` — barrel exports + `registerConvention()` call
- Optional: `helpers.ts`, `conditions.ts`, `transitions.ts`, `resolvers.ts`, `overlays.ts`, `constants.ts`

Shared across conventions: `shared-helpers.ts` — `STRAIN_TO_BIDSUIT` lookup and `strainToBidSuit()` function. Used by Stayman, Weak Twos, and Lebensohl Lite resolvers.

## Convention Quick Reference

- **Stayman:** Responds to NT openings (1NT and 2NT). Smolen (3H=4S+5H GF, 3S=5S+4H GF). Multi-round protocol with interference via overlays (`overlays.ts`: `stayman-doubled`, `stayman-overcalled`).
- **Bergen Raises:** Multi-round (constructive/limit/preemptive + opener rebids + game try). Standard Bergen variant (3C=constructive 7-10, 3D=limit 10-12, 3M=preemptive 0-6, splinter 12+).
- **SAYC:** User-drillable + E/W opponent AI default. 55+ flattened rules. All IntentNode leaves with empty resolvers (deterministic via defaultCall). Uses deprecated `intentBid()` (dynamic tree patterns).
- **Weak Twos:** Preemptive opening (2D/2H/2S, 6+ suit, 5-11 HCP), Ogust response system, vulnerability awareness.
- **Lebensohl Lite:** Uses deprecated `intentBid()` (dynamic tree patterns).

## Adding a Convention

1. Create `definitions/{name}/` folder with `tree.ts`, `config.ts`, `explanations.ts`, `index.ts`. Optionally add `helpers.ts`, `conditions.ts`, `transitions.ts`, `resolvers.ts`.
2. Build a `ConventionProtocol` using `protocol()`, `round()`, `semantic()` from `core/protocol`. Use `handDecision()`, `intentBid()`/`createIntentBidFactory()`, `fallback()` from `core/rule-tree` and `core/intent/`.
3. Add `registerConvention({name}Config)` in `index.ts`.
4. Create `__tests__/{name}/` with `rules.test.ts` and `edge-cases.test.ts`. Import shared helpers from `../fixtures` and `../tree-test-helpers`.
5. Test deal constraints with `checkConstraints()` — verify acceptance and rejection.
6. Test bidding rules with `evaluateBiddingRules()` — verify rule matching, call output, and `conditionResults`.

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
  infrastructure/            Shared engine primitives (rule-tree, tree-compat, registry, etc.)
  cross-convention.test.ts   Multi-convention interaction tests
  fixtures.ts                Shared helpers (hand, auctionFromBids, makeBiddingContext)
  tree-test-helpers.ts       Tree evaluation test utilities
  _convention-template.test.ts  Template for new conventions
```

Bergen splits into `rules-responder.test.ts` + `rules-opener-rebids.test.ts`. Stayman splits into `rules.test.ts` + `rules-extended.test.ts`.

---

## Context Maintenance

**After modifying files in this directory:** scan the entries above — if any claim is now
false or incomplete, update this file before ending the task. Do not defer.

**Staleness anchor:** This file assumes `stayman/index.ts` exists. If it doesn't, this file
is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-03-03 | last-audited=2026-03-03 | version=1 | dir-commits-at-audit=52 -->
