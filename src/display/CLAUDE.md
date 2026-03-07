# Display

UI display utilities and pure functions. Consumer of `engine/`, `conventions/core/`, and `contracts/`.

## Architecture

| File                   | Role                                                              |
| ---------------------- | ----------------------------------------------------------------- |
| `format.ts`            | `formatCall()`, `formatRuleName()`, `SUIT_SYMBOLS`, `STRAIN_SYMBOLS` |
| `hand-summary.ts`      | `formatHandSummary()` — compact shape + HCP summary for bidding feedback |
| `tokens.ts`            | CSS design tokens, suit color classes (`BID_SUIT_COLOR_CLASS`, `SUIT_CARD_COLOR_CLASS`) |
| `sort-cards.ts`        | `sortCards()` — visual card ordering for hand display             |
| `seat-mapping.ts`      | `viewSeat()` — logical-to-physical seat mapping for table rotation |
| `hcp.ts`               | `computeHcp()` — HCP display helper                              |
| `rules-display.ts`     | `prepareRulesForDisplay()`, `groupBidsByRound()`, `DisplayRule` type |
| `debug-bid-eval.ts`    | `computeBidEvalTraces()` — debug display utility                  |
| `filter-conventions.ts`| `filterConventions()` — convention picker search/filter           |
| `tree-display.ts`      | `flattenTreeForDisplay()` — RuleNode tree to flat `TreeDisplayRow[]` for UI (accepts optional `ConventionExplanations` for teaching fields). `TreeDisplayRow` includes `denialImplication` pre-computed from parent DecisionNode for NO-branch children. |
| `condition-explanations.ts` | `getConditionExplanation()`, `getConditionExplanationWithParams()`, `getFailureExplanation()` — condition teaching text from inference types |
| `teaching-content.ts`  | `extractTeachingContent()`, `evaluateTeachingRound()` — extract structured teaching data from convention trees |
| `table-scale.ts`       | `computeTableScale()` — responsive table scaling                  |

## Gotchas

- Suit colors use 4-color scheme — card-face colors differ from on-dark-bg colors (see `tokens.ts`)
- `filterConventions()` hides conventions with `internal: true`

---

## Context Maintenance

**After modifying files in this directory:** scan the entries above — if any claim is now
false or incomplete, update this file before ending the task. Do not defer.

**Add** an entry only if an agent would fail without knowing it, it is not obvious from
the code, and it belongs at this scope (project-wide rule → root CLAUDE.md; WHY decision
→ inline comment or ADR; inferable from code → nowhere).

**Remove** any entry that fails the falsifiability test: if removing it would not change
how an agent acts here, remove it. If a convention here conflicts with the codebase,
the codebase wins — update this file, do not work around it. Prune aggressively.

**Track follow-up work:** After modifying files, evaluate whether changes create incomplete
work or break an assumption tracked elsewhere. If so, create a task or update tracking before ending.

**Staleness anchor:** This file assumes `format.ts` exists. If it doesn't, this file
is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-02-25 | last-audited=2026-02-27 | version=3 | dir-commits-at-audit=0 | tree-sig=dirs:2,files:19,exts:ts:18,md:1 -->
