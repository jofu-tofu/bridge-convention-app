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
types.ts (ConventionConfig, BiddingRule, BiddingContext)
  ↑
registry.ts (registerConvention, getConvention, evaluateBiddingRules)
  ↑
stayman.ts (staymanConfig, staymanDealConstraints)
  ↑
index.ts (auto-registration entry point)
```

**Key files:**

| File | Role |
|------|------|
| `types.ts` | `ConventionConfig`, `BiddingRule`, `BiddingContext`, `ConventionCategory` |
| `registry.ts` | Convention map, `evaluateBiddingRules` (first-match), `clearRegistry` for tests |
| `stayman.ts` | Stayman convention: deal constraints (1NT opener + responder), 6 bidding rules |
| `index.ts` | Auto-registration entry point — import to activate all conventions |

## Convention Rules Reference

**Stayman** (`stayman.ts`):
- **Deal constraints:** Opener (North) 15-17 HCP, balanced, no 5-card major. Responder (South) 8+ HCP, at least one 4-card major.
- **Rules (in priority order):** `stayman-ask` (2C), `stayman-response-hearts` (2H), `stayman-response-spades` (2S), `stayman-response-denial` (2D), `stayman-rebid-major-fit` (4M), `stayman-rebid-no-fit` (3NT).
- **Priority:** Hearts shown before spades when opener has both 4-card majors.

**Bridge rules sources:** See `docs/bridge-rules-sources.md` for authoritative references and ambiguity resolution.
**Architecture details:** See `docs/architecture-reference.md` for convention constraints, AI heuristics, and phase details.

## Adding a Convention

1. Create `src/conventions/{name}.ts` — export a `ConventionConfig` with `id`, `name`, `description`, `category`, `dealConstraints`, `biddingRules`, `examples`
2. Add `registerConvention({name}Config)` call in `index.ts`
3. Write tests in `src/conventions/__tests__/{name}.test.ts`
4. Test deal constraints with `checkConstraints()` — verify both acceptance and rejection
5. Test bidding rules with `evaluateBiddingRules()` — verify rule matching and call output

## Gotchas

- `clearRegistry()` must be called in `beforeEach` for test isolation — conventions auto-register on import
- Deal constraint `minLengthAny` is OR (any suit meets minimum), not AND
- Shape indices follow `SUIT_ORDER`: [0]=Spades, [1]=Hearts, [2]=Diamonds, [3]=Clubs
- DONT and Bergen Raises variant selection must be resolved before implementation (see root CLAUDE.md)

---

## Context Maintenance

**After modifying files in this directory:** scan the entries above — if any claim is now
false or incomplete, update this file before ending the task. Do not defer.

**Staleness anchor:** This file assumes `registry.ts` exists. If it doesn't, this file
is stale — update or regenerate before relying on it.

<!-- context-layer: generated=2026-02-21 | last-audited=2026-02-21 | version=1 -->
