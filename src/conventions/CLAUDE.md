# Conventions

Convention definitions for bridge bidding practice. Each convention is a self-contained module with deal constraints, bidding rules, and examples.

## Conventions

- **Registry pattern.** All conventions register via `registerConvention()` in `registry.ts`. Never hardcode convention logic in switch statements.
- **One file per convention.** Each convention exports a `ConventionConfig` (types in `types.ts`). See `stayman.ts` as the reference implementation.
- **Auto-registration.** `index.ts` imports each convention and calls `registerConvention()`. Importing `conventions/index` activates all conventions.
- **Rule name strings are public contract.** Rule names (e.g., `stayman-ask`, `stayman-response-hearts`) appear in CLI JSON output and are used in tests. Renaming a rule name is a breaking change.
- **`evaluateBiddingRules` is first-match.** Rules are evaluated in array order; the first matching rule wins. Rule ordering in `biddingRules` arrays is significant.

## Architecture

**Module graph:**

```
types.ts (ConventionConfig, BiddingRule, BiddingContext, RuleCondition, ConditionedBiddingRule)
  ↑
conditions.ts (condition factories, conditionedRule builder, combinators)
condition-evaluator.ts (evaluateConditions, buildExplanation, isConditionedRule)
  ↑
registry.ts (registerConvention, getConvention, evaluateBiddingRules)
  ↑
stayman.ts (staymanConfig, staymanDealConstraints)
gerber.ts (gerberConfig, gerberDealConstraints)
bergen-raises.ts (bergenConfig, bergenDealConstraints)
dont.ts (dontConfig, dontDealConstraints)
sayc.ts (saycConfig — internal, hidden from UI)
  ↑
index.ts (auto-registration entry point)
```

**Key files:**

| File                     | Role                                                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`               | `ConventionConfig`, `BiddingRule`, `BiddingContext`, `ConventionCategory`, `RuleCondition`, `ConditionedBiddingRule`       |
| `conditions.ts`          | Condition factories (`hcpMin`, `suitMin`, `auctionMatches`, relational: `isOpener`, `isResponder`, `partnerOpened`, etc.), `conditionedRule()` builder, `or()`/`and()` combinators |
| `condition-evaluator.ts` | `evaluateConditions()`, `buildExplanation()`, `isConditionedRule()` type guard                                             |
| `registry.ts`            | Convention map, `evaluateBiddingRules` (first-match, condition-aware), `clearRegistry` for tests                           |
| `stayman.ts`             | Stayman convention: deal constraints (1NT opener + responder), 6 bidding rules                                             |
| `gerber.ts`              | Gerber convention: deal constraints (1NT opener + 13+ HCP responder), 6 bidding rules                                      |
| `bergen-raises.ts`       | Bergen Raises convention: deal constraints (1M opener + responder), 4 bidding rules                                        |
| `dont.ts`                | DONT convention: deal constraints (1NT opponent + overcaller), 7 bidding rules                                             |
| `sayc.ts`                | SAYC convention: internal (opponent AI), no deal constraints, ~22 bidding rules                                            |
| `index.ts`               | Auto-registration entry point — import to activate all conventions                                                         |

## Convention Rules Reference

**Stayman** (`stayman.ts`):

- **Deal constraints:** Opener (North) 15-17 HCP, balanced, no 5-card major. Responder (South) 8+ HCP, at least one 4-card major.
- **Rules (in priority order):** `stayman-ask` (2C), `stayman-response-hearts` (2H), `stayman-response-spades` (2S), `stayman-response-denial` (2D), `stayman-rebid-major-fit` (4M), `stayman-rebid-no-fit` (3NT).
- **Priority:** Hearts shown before spades when opener has both 4-card majors.

**Gerber** (`gerber.ts`):

- **Deal constraints:** Opener (North) 15-17 HCP, balanced. Responder (South) 13+ HCP (slam interest).
- **Rules (in priority order):** `gerber-ask` (4C), `gerber-response-zero-four` (4D), `gerber-response-one` (4H), `gerber-response-two` (4S), `gerber-response-three` (4NT), `gerber-signoff` (4NT/5NT/6NT/7NT).
- **Ace disambiguation:** 4D response = 0 or 4 aces; responder's own ace count disambiguates.
- **Signoff logic:** totalAces=4 -> 7NT, totalAces=3 -> 6NT, else signoff (4NT after 4D/4H, 5NT after 4S).

**Bergen Raises** (`bergen-raises.ts`):

- **Deal constraints:** Opener (North) 12-21 HCP, 5+ card major. Responder (South) 6-12 HCP, 4+ card major.
- **Rules (in priority order):** `bergen-game-raise` (4M, 13+ HCP), `bergen-limit-raise` (3D, 10-12 HCP), `bergen-constructive-raise` (3C, 7-9 HCP), `bergen-preemptive-raise` (3M, 0-6 HCP).
- **Variant:** Standard Bergen (3C=constructive, 3D=limit, 3M=preemptive).
- **Default auction:** Deal-aware -- opens opener's longer major (1S with 5-5).

**DONT** (`dont.ts`):

- **Deal constraints:** Opponent (East) 15-17 HCP, balanced (opens 1NT). Overcaller (South) 8-15 HCP, one 6+ suit OR 5-4+ two-suited.
- **Rules (in priority order):** `dont-2h` (both majors), `dont-2d` (diamonds+major), `dont-2c` (clubs+higher), `dont-2s` (6+ spades natural), `dont-double` (single-suited non-spades), `dont-advance-pass` (support), `dont-advance-next-step` (relay/ask).
- **Priority:** Two-suited bids (rules 1-3) before single-suited (rules 4-5). 6-4 hands use two-suited bid, not double. Advance pass checked before next-step.
- **Dealer:** East (not North like Stayman).

**SAYC** (`sayc.ts`):

- **Internal convention** (`internal: true`) — hidden from UI convention picker, used for opponent AI bidding.
- **No deal constraints** — SAYC works with any hand.
- **Rules (in priority order):** Opening bids (`sayc-open-2c`, `sayc-open-1nt`, `sayc-open-2nt`, `sayc-open-1s`, `sayc-open-1h`, `sayc-open-1d`, `sayc-open-1c`, `sayc-open-weak-2h`, `sayc-open-weak-2s`), 1NT responses (`sayc-respond-1nt-stayman`, `sayc-respond-1nt-pass`), suit responses (`sayc-respond-raise-major`, `sayc-respond-jump-raise-major`, `sayc-respond-1h-over-minor`, `sayc-respond-1s-over-minor`, `sayc-respond-1s-over-1h`, `sayc-respond-1nt`, `sayc-respond-2nt`, `sayc-respond-3nt`), competitive (`sayc-overcall-1level`, `sayc-overcall-2level`), default (`sayc-pass`).
- **Relational conditions:** Uses `isOpener()`, `isResponder()`, `partnerOpened()`, `opponentBid()`, `noPriorBid()`, `isBalanced()`, `noFiveCardMajor()`, `longerMajor()` from `conditions.ts`.

**Bridge rules sources:** See `docs/bridge-rules-sources.md` for authoritative references and ambiguity resolution.
**Architecture details:** See `docs/architecture-reference.md` for convention constraints, AI heuristics, and phase details.

## Conditioned Rules

- **`conditionedRule()` factory mandate.** All new rules MUST use `conditionedRule()` from `conditions.ts`. Never hand-build a `ConditionedBiddingRule` object (risks split-brain between `matches()` and `conditions[]`).
- **`or()` always-evaluate invariant.** `or()` MUST evaluate all branches unconditionally — short-circuiting breaks the UI branch-highlighting feature. Max 4 branches, nesting depth ≤ 2.
- **Imperative escape hatch.** A rule MAY stay as plain `BiddingRule` (with static `explanation`) if the declarative model cannot express its logic. All rules across 5 conventions use `conditionedRule()`. New conventions should use `conditionedRule()`.

## Adding a Convention

1. Create `src/conventions/{name}.ts` — export a `ConventionConfig` with `id`, `name`, `description`, `category`, `dealConstraints`, `biddingRules`, `examples`
2. Use `conditionedRule()` from `conditions.ts` for all bidding rules — compose from existing condition factories
3. Add `registerConvention({name}Config)` call in `index.ts`
4. Write tests in `src/conventions/__tests__/{name}.test.ts`
5. Test deal constraints with `checkConstraints()` — verify both acceptance and rejection
6. Test bidding rules with `evaluateBiddingRules()` — verify rule matching, call output, and `conditionResults`

## Gotchas

- `clearRegistry()` must be called in `beforeEach` for test isolation — conventions auto-register on import
- Deal constraint `minLengthAny` is OR (any suit meets minimum), not AND
- Shape indices follow `SUIT_ORDER`: [0]=Spades, [1]=Hearts, [2]=Diamonds, [3]=Clubs
- DONT uses East as dealer (not North like Stayman) — all DONT auctions start from East's 1NT opening
- Bergen Raises variant is Standard Bergen (3C=constructive 7-9, 3D=limit 10-12, 3M=preemptive 0-6)
- Internal conventions (`internal: true`) are filtered from the UI by `filterConventions()` in `src/lib/filter-conventions.ts`

---

## Context Maintenance

**After modifying files in this directory:** scan the entries above — if any claim is now
false or incomplete, update this file before ending the task. Do not defer.

**Staleness anchor:** This file assumes `registry.ts` exists. If it doesn't, this file
is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-02-21 | last-audited=2026-02-22 | version=3 | dir-commits-at-audit=7 | tree-sig=dirs:1,files:21,exts:ts:20,md:1 -->
