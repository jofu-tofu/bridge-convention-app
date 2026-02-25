# Conventions

Convention definitions for bridge bidding practice. Each convention is a self-contained module with deal constraints, bidding rules, and examples.

## Conventions

- **Registry pattern.** All conventions register via `registerConvention()` in `registry.ts`. Never hardcode convention logic in switch statements.
- **One file per convention.** Each convention exports a `ConventionConfig` (types in `types.ts`). See `stayman.ts` as the reference implementation.
- **Auto-registration.** `index.ts` imports each convention and calls `registerConvention()`. Importing `conventions/index` activates all conventions.
- **Rule name strings are public contract.** Rule names (e.g., `stayman-ask`, `stayman-response-hearts`) appear in CLI JSON output and are used in tests. Renaming a rule name is a breaking change.
- **`evaluateBiddingRules(context, config)` is tree-only.** Takes `BiddingContext` and `ConventionConfig` (no `rules` param). Dispatches via tree evaluator for all conventions.

## Architecture

**Module graph:**

```
types.ts (ConventionConfig, BiddingRule, BiddingContext, RuleCondition, ConditionedBiddingRule)
  ↑
conditions.ts (condition factories, conditionedRule builder, combinators)
condition-evaluator.ts (evaluateConditions, buildExplanation, isConditionedRule)
rule-tree.ts (RuleNode, DecisionNode, BidNode, FallbackNode, TreeConventionConfig, builder helpers)
tree-evaluator.ts (evaluateTree, evaluateTreeFast, TreeEvalResult, PathEntry)
tree-compat.ts (flattenTree, treeResultToBiddingRuleResult — temporary compat adapter)
context-factory.ts (createBiddingContext — canonical BiddingContext constructor)
  ↑
registry.ts (registerConvention, getConvention, evaluateBiddingRules — dispatches tree conventions)
  ↑
stayman.ts (staymanConfig, staymanDealConstraints)
gerber.ts (gerberConfig, gerberDealConstraints)
bergen-raises.ts (bergenConfig, bergenDealConstraints)
dont.ts (dontConfig, dontDealConstraints)
landy.ts (landyConfig, landyDealConstraints)
sayc.ts (saycConfig — user-drillable, South 10+ HCP)
  ↑
index.ts (auto-registration entry point)
```

**Key files:**

| File                     | Role                                                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`               | `ConventionConfig`, `BiddingRule`, `BiddingContext`, `ConventionCategory`, `RuleCondition`, `ConditionedBiddingRule`       |
| `conditions.ts`          | Condition factories (`hcpMin`, `suitMin`, `auctionMatches`, relational: `isOpener`, `isResponder`, `partnerOpened`, `biddingRound`, `partnerBidAt`, etc.), SAYC-extracted: `hasFourCardMajor`, `partnerOpenedMajor/Minor`, `majorSupportN`, `partnerRaisedOurMajor`, `partnerRespondedMajorWithSupport`, `sixPlusInOpenedSuit`, `goodSuitAtLevel`; helpers: `partnerOpeningStrain`, `seatFirstBidStrain`, `lastBid`, `bidIsHigher`; `conditionedRule()` builder, `or()`/`and()` combinators |
| `condition-evaluator.ts` | `evaluateConditions()`, `buildExplanation()`, `isConditionedRule()` type guard                                             |
| `rule-tree.ts`           | `RuleNode` (DecisionNode, BidNode, FallbackNode), `TreeConventionConfig`, `decision()`/`bid()`/`fallback()` builders     |
| `tree-evaluator.ts`      | `evaluateTree()` (path + visited traversal order), `evaluateTreeFast()` (match only, used by registry hot path)          |
| `tree-compat.ts`         | `flattenTree()`, `treeResultToBiddingRuleResult()` — temporary compat during migration                                   |
| `context-factory.ts`     | `createBiddingContext()` — canonical constructor with `vulnerability`/`dealer` defaults                                   |
| `registry.ts`            | Convention map, `evaluateBiddingRules` (tree-aware dispatch via `isTreeConvention()`; attaches `treeEvalResult` + `treeRoot` to result), `clearRegistry` for tests |
| `stayman.ts`             | Stayman convention: deal constraints (1NT opener + responder), 6 bidding rules                                             |
| `gerber.ts`              | Gerber convention: deal constraints (NT opener + 16+ HCP responder), tree-based (11 flattened rules)                       |
| `bergen-raises.ts`       | Bergen Raises convention: deal constraints (1M opener + responder), tree-based (16 flattened rules)                         |
| `dont.ts`                | DONT convention: deal constraints (1NT opponent + overcaller), 7 bidding rules                                             |
| `landy.ts`               | Landy convention: deal constraints (1NT opponent + overcaller), 5 bidding rules                                            |
| `sayc.ts`                | SAYC convention: user-drillable (South 10+ HCP), also E/W opponent AI default, tree-based (40 flattened rules)            |
| `index.ts`               | Auto-registration entry point — import to activate all conventions                                                         |

## Convention Rules Reference

**Stayman** (`stayman.ts`):

- **Deal constraints:** Opener (North) 15-17 HCP, balanced, no 5-card major. Responder (South) 8+ HCP, at least one 4-card major.
- **Rules (in priority order):** `stayman-ask` (2C or 3C after 2NT), `stayman-response-hearts` (2H/3H), `stayman-response-spades` (2S/3S), `stayman-response-denial` (2D/3D), `stayman-rebid-smolen-hearts` (3H after 2D, 4S+5H GF), `stayman-rebid-smolen-spades` (3S after 2D, 5S+4H GF), `stayman-rebid-major-fit` (4M), `stayman-rebid-major-fit-invite` (3M), `stayman-rebid-no-fit` (3NT), `stayman-rebid-no-fit-invite` (2NT).
- **2NT opening Stayman:** Same convention at 3-level (3C ask → 3D/3H/3S responses).
- **Priority:** Hearts shown before spades when opener has both 4-card majors. Smolen checked before generic NT signoff after 2D denial.

**Gerber** (`gerber.ts`):

- **Deal constraints:** Opener (North) 15-17 HCP, balanced. Responder (South) 16+ HCP (slam interest), no void.
- **Trigger:** 4C response to any NT opening (1NT or 2NT).
- **Ace-asking rules (in priority order):** `gerber-ask` (4C), `gerber-response-zero-four` (4D), `gerber-response-one` (4H), `gerber-response-two` (4S), `gerber-response-three` (4NT).
- **King-asking rules:** `gerber-king-ask` (5C, fires when total aces >= 3), `gerber-king-response-zero-four` (5D), `gerber-king-response-one` (5H), `gerber-king-response-two` (5S), `gerber-king-response-three` (5NT).
- **Signoff:** `gerber-signoff` (4NT/5NT/6NT/7NT) — fires after ace response (< 3 aces) or after king response.
- **Ace/King disambiguation:** 4D/5D response = 0 or 4; responder's own count disambiguates.

**Bergen Raises** (`bergen-raises.ts`):

- **Deal constraints:** Opener (North) 12-21 HCP, 5+ card major. Responder (South) 0+ HCP, exactly 4-card major.
- **Responder initial rules (after 1M-P):** `bergen-splinter` (3-other-major, 12+ HCP with shortage), `bergen-game-raise` (4M, 13+ HCP), `bergen-limit-raise` (3D, 10-12 HCP), `bergen-constructive-raise` (3C, 7-10 HCP), `bergen-preemptive-raise` (3M, 0-6 HCP).
- **Opener rebids after constructive (1M P 3C P):** `bergen-rebid-game-after-constructive` (4M, 17+ HCP), `bergen-rebid-try-after-constructive` (3D help-suit game try, 14-16 HCP), `bergen-rebid-signoff-after-constructive` (Pass, 12-13 HCP).
- **Responder game try continuation (1M P 3C P 3D P):** `bergen-try-accept` (4M, 9-10 HCP top of constructive), `bergen-try-reject` (3M, 7-8 HCP bottom of constructive).
- **Opener rebids after limit (1M P 3D P):** `bergen-rebid-game-after-limit` (4M, 15+ HCP), `bergen-rebid-signoff-after-limit` (3M, 12-14 HCP).
- **Opener rebids after preemptive (1M P 3M P):** `bergen-rebid-game-after-preemptive` (4M, 18+ HCP), `bergen-rebid-pass-after-preemptive` (Pass, 12-17 HCP).
- **Variant:** Standard Bergen (3C=constructive, 3D=limit, 3M=preemptive).
- **Multi-round framework:** Uses `biddingRound(n)` + `isOpener()`/`isResponder()` for clean round separation. `partnerBidAt()` and inline `partnerRaisedToThreeOfMajor()` detect specific partner bids.
- **Default auction:** Deal-aware -- opens opener's longer major (1S with 5-5).

**Landy** (`landy.ts`):

- **Deal constraints:** Opponent (East) 15-17 HCP, balanced (opens 1NT). Overcaller (South) 10+ HCP, 5-4+ in both majors.
- **Rules (in priority order):** `landy-2c` (2C showing both majors), `landy-response-2nt` (12+ HCP inquiry), `landy-response-3h`/`landy-response-3s` (10-12 HCP invitational with 4+ support), `landy-response-pass` (5+ clubs, play 2C), `landy-response-2h` (4+ hearts signoff), `landy-response-2s` (4+ spades, <4 hearts signoff), `landy-response-2d` (relay). Overcaller rebids after 2NT: `landy-rebid-3nt` (max 5-5), `landy-rebid-3s` (med 5-5), `landy-rebid-3d` (max 5-4), `landy-rebid-3c` (med 5-4).
- **Priority:** 2NT (12+) before invitational (10-12) before signoff. Hearts before spades; relay is catchall.
- **Dealer:** East (same as DONT).

**DONT** (`dont.ts`):

- **Deal constraints:** Opponent (East) 15-17 HCP, balanced (opens 1NT). Overcaller (South) 8-15 HCP, one 6+ suit OR 5-4+ two-suited.
- **Rules (in priority order):** `dont-2h` (both majors), `dont-2d` (diamonds+major), `dont-2c` (clubs+higher), `dont-2s` (6+ spades natural), `dont-double` (single-suited non-spades), `dont-advance-long-suit` (6+ suit bypass relay), `dont-advance-pass` (support), `dont-advance-next-step` (relay/ask), `dont-reveal-pass` (stay in 2C after relay), `dont-reveal-suit` (show long suit after relay).
- **Advancer extensions:** 6+ suit bypasses relay (bids directly) after double, 2C, or 2D. Checked before pass/relay.
- **Overcaller reveal:** After 1NT-X-P-2C-P, overcaller passes (6+ clubs) or corrects to their suit.
- **Priority:** Two-suited bids (rules 1-3) before single-suited (rules 4-5). 6-4 hands use two-suited bid, not double. Advancer 6+ suit bypass before pass/relay.
- **Dealer:** East (not North like Stayman).

**SAYC** (`sayc.ts`):

- **User-drillable** — visible in UI convention picker. Also used as E/W opponent AI default (SAYC vs SAYC mirror match).
- **Deal constraints:** South 10+ HCP (enables both opening and responding practice; 12+ biases too heavily toward opening).
- **Rules (in priority order):** Opening bids (`sayc-open-2c`, `sayc-open-1nt`, `sayc-open-2nt`, `sayc-open-1s`, `sayc-open-1h`, `sayc-open-1d`, `sayc-open-1c`, `sayc-open-weak-2h`, `sayc-open-weak-2s`), 1NT responses (`sayc-respond-1nt-stayman`, `sayc-respond-1nt-pass`), suit responses (`sayc-respond-raise-major`, `sayc-respond-jump-raise-major`, `sayc-respond-1h-over-minor`, `sayc-respond-1s-over-minor`, `sayc-respond-1s-over-1h`, `sayc-respond-1nt`, `sayc-respond-2nt`, `sayc-respond-3nt`), competitive (`sayc-overcall-1level`, `sayc-overcall-2level`), default (`sayc-pass`).
- **Relational conditions:** Uses `isOpener()`, `isResponder()`, `partnerOpened()`, `opponentBid()`, `noPriorBid()`, `isBalanced()`, `noFiveCardMajor()`, `longerMajor()` from `conditions.ts`.

**Bridge rules sources:** See `docs/bridge-rules-sources.md` for authoritative references and ambiguity resolution.
**Architecture details:** See `docs/architecture-reference.md` for convention constraints, AI heuristics, and phase details.

## Conditioned Rules

- **`conditionedRule()` factory mandate.** All new rules MUST use `conditionedRule()` from `conditions.ts`. Never hand-build a `ConditionedBiddingRule` object (risks split-brain between `matches()` and `conditions[]`).
- **Auction/hand condition split.** `conditionedRule()` requires explicit `auctionConditions` and `handConditions` arrays (both required, use `[]` if empty). The flattened `.conditions` getter provides backward compat for `evaluateConditions()` and `buildExplanation()`.
- **Hybrid conditions belong in `handConditions`.** Conditions like `majorSupport()`, `gerberSignoffCondition()`, `advanceSupportFor()` that check auction state to resolve parameters but ultimately gate on hand properties belong in `handConditions`, not `auctionConditions`. The inference engine iterates only `handConditions` for `.inference` metadata.
- **Auction conditions must NOT carry `.inference` metadata** — enforced by test in `conditions.test.ts`.
- **`or()` always-evaluate invariant.** `or()` MUST evaluate all branches unconditionally — short-circuiting breaks the UI branch-highlighting feature. Max 4 branches, nesting depth ≤ 2.
- **Imperative escape hatch.** A rule MAY stay as plain `BiddingRule` (with static `explanation`) if the declarative model cannot express its logic. All rules across 5 conventions use `conditionedRule()`. New conventions should use `conditionedRule()`.

## Adding a Convention

1. Create `src/conventions/{name}.ts` — export a `ConventionConfig` with `id`, `name`, `description`, `category`, `dealConstraints`, `biddingRules`, `examples`
2. Use `conditionedRule()` from `conditions.ts` for all bidding rules — compose from existing condition factories
3. Add `registerConvention({name}Config)` call in `index.ts`
4. Create `src/conventions/__tests__/{name}/` with `rules.test.ts` and `edge-cases.test.ts`. Import shared helpers from `../fixtures` and `../tree-test-helpers`.
5. Test deal constraints with `checkConstraints()` — verify both acceptance and rejection
6. Test bidding rules with `evaluateBiddingRules()` — verify rule matching, call output, and `conditionResults`

## Test Organization

```
__tests__/
  ├── {convention}/          Per-convention test folders
  │   ├── rules.test.ts      Core bidding rules + deal constraints
  │   └── edge-cases.test.ts Interference, boundaries, unusual shapes
  ├── sayc/                  SAYC split by position (large convention)
  │   ├── helpers.ts         Shared makeBiddingContext + callFromRules
  │   ├── drillability.test.ts  Drill config + UI visibility tests
  │   ├── opening.test.ts    Opening bids + edge cases
  │   ├── responses.test.ts  Responses to suit + NT openings
  │   ├── rebids.test.ts     Opener rebids after various responses
  │   ├── competitive.test.ts  Overcalls + competitive bids
  │   └── disjoint.test.ts   Rule overlap + reachability checks
  ├── infrastructure/        Shared engine primitives
  │   ├── rule-tree.test.ts, tree-compat.test.ts, registry*.test.ts
  │   ├── conditions.test.ts, debug-utils.test.ts
  ├── cross-convention.test.ts  Multi-convention interaction tests
  ├── fixtures.ts            Shared helpers (hand, auctionFromBids, makeBiddingContext)
  ├── tree-test-helpers.ts   Tree evaluation test utilities
  └── _convention-template.test.ts  Template for new conventions
```

## Tree System

**Why Rule Trees?** The flat `conditionedRule()` system has 11 gaps (see `_output/contexts/260223-1730-audit-conditions-respect-unexpected-senarios-bridge/notes/condition-audit.md`). Most critically: (1) interference blindness — all 65 rules assume uncontested auctions; (2) no negative inference — flat condition lists can't express "this convention path was rejected, so these hand constraints DON'T apply." Three options were evaluated; Option C (rule trees) was chosen because tree path rejection data is the only architecture that enables negative inference. Both flat and tree systems coexist during migration.

**Coexistence:** `registry.ts` dispatches via `isTreeConvention()`. Non-tree conventions use the flat `conditionedRule()` → `evaluateConditions()` path unchanged. Tree conventions use `evaluateTree()` → `treeResultToBiddingRuleResult()`. Both produce the same `BiddingRuleResult` shape.

**Tree Authoring Rules:**
- Auction checks = parent DecisionNodes, hand checks = child DecisionNodes (auction narrows first, then hand evaluates)
- DecisionNode names: descriptive kebab-case slugs (e.g., `is-responder`, `has-4-card-major`)
- FallbackNode = "convention doesn't apply to this hand/auction"; BidNode = "convention fires with this call"
- Strict tree constraint: do not reuse node object references across branches (breaks `flattenTree()` path accumulation)
- Use `createBiddingContext()` factory from `context-factory.ts` for all new BiddingContext construction
- `biddingRules` is optional on tree conventions — use `getConventionRules(id)` from registry for flattened rules
- `flattenTree()` splits accumulated conditions: pure auction conditions → `auctionConditions`, hand conditions → `handConditions`
- `auctionMatches()` uses exact match (via `auctionMatchesExact()`), not prefix. `["1NT", "P"]` does NOT match when auction is `["1NT", "P", "2C", "P"]`. This is why chaining rounds off the NO branch works — longer auctions fall through to later checks.
- Multiple BidNodes may share the same name (e.g., `dont-advance-pass` × 3). This is safe for all consumers (registry, inference, CLI, RulesPanel).

**Migration status:** Complete. All 6 conventions on trees. Flat dispatch path removed. Negative inference via `invertInference()` wired to inference engine.

**SAYC tree pattern:** SAYC uses `saycPass()` factory at all terminal positions instead of `fallback()` because SAYC is a catch-all convention — any hand that enters produces a bid or pass. Other conventions use `fallback()` to indicate "convention doesn't apply."

**Extracted SAYC condition factories** (in `conditions.ts`): `hasFourCardMajor()`, `partnerOpenedMajor()`, `partnerOpenedMinor()`, `majorSupportN(n)`, `partnerRaisedOurMajor()`, `partnerRespondedMajorWithSupport()`, `sixPlusInOpenedSuit()`, `goodSuitAtLevel(level)`. Helpers also exported: `partnerOpeningStrain()`, `seatFirstBidStrain()`, `partnerRespondedMajor()`, `lastBid()`, `bidIsHigher()`. Internal helper: `partnerRaisedOurSuit()` (not exported, used by `partnerRaisedOurMajor()`).

## Gotchas

- `clearRegistry()` must be called in `beforeEach` for test isolation — conventions auto-register on import
- Deal constraint `minLengthAny` is OR (any suit meets minimum), not AND
- Shape indices follow `SUIT_ORDER`: [0]=Spades, [1]=Hearts, [2]=Diamonds, [3]=Clubs
- DONT uses East as dealer (not North like Stayman) — all DONT auctions start from East's 1NT opening
- Bergen Raises variant is Standard Bergen (3C=constructive 7-10, 3D=limit 10-12, 3M=preemptive 0-6, splinter with shortage 12+)
- Conventions with `internal: true` are filtered from the UI by `filterConventions()` in `src/lib/filter-conventions.ts` (currently no conventions use this)

---

## Context Maintenance

**After modifying files in this directory:** scan the entries above — if any claim is now
false or incomplete, update this file before ending the task. Do not defer.

**Staleness anchor:** This file assumes `registry.ts` exists. If it doesn't, this file
is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-02-21 | last-audited=2026-02-23 | version=4 | dir-commits-at-audit=7 | tree-sig=dirs:1,files:27,exts:ts:26,md:1 -->
