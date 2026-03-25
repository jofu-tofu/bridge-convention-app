# NT-Bundle Playthrough Report (Agent 8)

## Summary

Played 4 seeds through the `nt-bundle` CLI (`play` command) covering Stayman and Jacoby Transfer conventions. All **graded bids are conventionally correct** -- the bidding engine produces the right calls and the teaching feedback is accurate. However, a systematic **reveal-layer atom mislabeling bug** was found: the `--reveal` output assigns Stayman atom IDs to Jacoby Transfer bids because `buildAtomCallMap` maps by call key alone, without auction context.

- **Seeds played**: 4
- **Total steps evaluated**: 6 (across seeds 58, 108, 158; seed 8 had 0 steps)
- **Grading correctness**: 6/6 steps correct
- **Findings**: 1 (reveal atom mislabeling -- affects coverage tracking, not user-facing grading)

## Step-by-Step Results Table

| Seed | Vuln | Step | Seat | Hand Summary | Auction Before | App Recommends | Convention (Graded) | Atom (Reveal) | Correct? |
|------|------|------|------|-------------|---------------|----------------|---------------------|---------------|----------|
| 8 | None | -- | -- | *(0 steps -- no practice points generated)* | -- | -- | -- | -- | N/A |
| 58 | NS | 0 | S | 4S 4H 1D 4C, 8 HCP | 1NT-P | 2C | Stayman ask-major | stayman/stayman:ask-major | Yes |
| 58 | NS | 1 | N | 5S 3H 2D 3C, 16 HCP | 1NT-P-2C-2D(W) | 2S | Stayman show-spades | stayman/stayman:show-spades | Yes |
| 58 | NS | 2 | S | 4S 4H 1D 4C, 8 HCP | 1NT-P-2C-2D(W)-2S-P | 3S | Stayman raise-invite-spades | stayman/stayman:raise-invite-spades | Yes |
| 108 | EW | 0 | S | 5S 1H 3D 4C, 11 HCP | 1NT-P | 2H | **Jacoby transfer:to-spades** | **stayman/stayman:show-hearts** | Yes* |
| 108 | EW | 1 | N | 4S 2H 3D 4C, 17 HCP | 1NT-P-2H(xfer)-P | 2S | **Jacoby transfer:accept-spades** | **stayman/stayman:show-spades** | Yes* |
| 158 | Both | 0 | S | 1S 5H 2D 5C, 7 HCP | 1NT-P | 2D | **Jacoby transfer:to-hearts** | **stayman/stayman:deny-major** | Yes* |

\* Bid and grading are correct; reveal atom ID is mislabeled (see Finding 1).

## Findings

### Finding 1: Reveal Atom IDs Mislabeled for Jacoby Transfer Bids (Severity: Medium)

**What**: The `play --reveal` output assigns **Stayman** atom IDs to bids that are actually **Jacoby Transfers**. Three instances observed:

| Seed | Bid | Actual Convention | Reveal Atom (Wrong) |
|------|-----|-------------------|---------------------|
| 108 | 2H | Jacoby Transfer to Spades | `stayman/stayman:show-hearts` |
| 108 | 2S | Accept Transfer to Spades | `stayman/stayman:show-spades` |
| 158 | 2D | Jacoby Transfer to Hearts | `stayman/stayman:deny-major` |

**Root Cause**: `buildAtomCallMap()` in `src/cli/playthrough.ts` (line 54) maps atoms by **`callKey` only** (e.g. "2D", "2H", "2S") without considering auction state. Since Stayman atoms are enumerated before Jacoby Transfer atoms (higher module precedence), the first-write-wins logic maps:
- `2D` -> `stayman:deny-major` instead of `transfer:to-hearts`
- `2H` -> `stayman:show-hearts` instead of `transfer:to-spades`
- `2S` -> `stayman:show-spades` instead of `transfer:accept-spades`

**Impact**:
- **User-facing grading is NOT affected** -- `gradePlaythroughStep()` rebuilds full context and correctly identifies Jacoby transfers.
- **`--reveal` output is misleading** -- atom IDs and meaning labels are wrong for transfer bids.
- **Coverage tracking (`atomsCovered`) is incorrect** -- the `plan` command would think Stayman atoms are covered when actually Jacoby Transfer atoms were exercised. This could cause the planner to under-schedule Jacoby Transfer practice and over-report Stayman coverage.

**Reference**: Per [bridgebum.com Jacoby Transfers](https://www.bridgebum.com/jacoby_transfers.php), 2D over 1NT is a transfer to hearts (5+ hearts) and 2H over 1NT is a transfer to spades (5+ spades). These are distinct conventions from Stayman responses.

**Suggested Fix**: `buildAtomCallMap` needs to be context-aware. Either:
1. Include auction state in the map key (not just call key), or
2. Run atom matching per-step using the actual strategy evaluation result (which already has the correct convention ID), rather than the flat pre-built map.

## Convention Correctness Verification

All bids verified against standard bridge conventions (bridgebum.com reference):

- **Seed 58, Step 0**: 2C Stayman with 4-4 majors and 8 HCP = correct (8+ HCP, 4-card major, no 5-card major)
- **Seed 58, Step 1**: 2S showing spades after Stayman with opponent interference = correct (4+ spades, denies 4 hearts)
- **Seed 58, Step 2**: 3S invite with 4-card fit and 8 HCP = correct (invitational range 8-9 HCP)
- **Seed 108, Step 0**: 2H Jacoby transfer with 5 spades = correct (5+ spades -> bid 2H)
- **Seed 108, Step 1**: 2S completing transfer = correct (opener always accepts)
- **Seed 158, Step 0**: 2D Jacoby transfer with 5 hearts = correct (5+ hearts -> bid 2D)

## Passed Seeds

| Seed | Vuln | Steps | Result |
|------|------|-------|--------|
| 8 | None | 0 | PASS (no steps) |
| 58 | NS | 3 | PASS (all correct) |
| 108 | EW | 2 | PASS (all correct, reveal labels wrong) |
| 158 | Both | 1 | PASS (all correct, reveal label wrong) |
