# NT-Bundle Playthrough Report (Agent 24)

## Summary

Played 4 seeds through the `nt-bundle` CLI (`play` command) covering Jacoby Transfer conventions, post-transfer continuations, and NT invitational sequences. All **graded bids are conventionally correct** -- the bidding engine produces the right calls and the teaching feedback is accurate. The **reveal-layer atom mislabeling bug** previously identified in Agent 8's report is confirmed and reproduced across new seeds.

- **Seeds played**: 4
- **Total steps evaluated**: 7 (across seeds 24 and 74; seeds 124 and 174 had 0 steps)
- **Grading correctness**: 7/7 steps correct
- **Findings**: 1 (reveal atom mislabeling -- confirms Agent 8 finding, no new bugs)

## Step-by-Step Results Table

| Seed | Vuln | Step | Seat | Hand Summary | Auction Before | App Recommends | Convention (Graded) | Atom (Reveal) | Correct? |
|------|------|------|------|-------------|---------------|----------------|---------------------|---------------|----------|
| 24 | None | 0 | S | 5S 3H 1D 4C, 5 HCP | 1NT-P | 2H | Jacoby transfer:to-spades | **stayman/stayman:show-hearts** | Yes* |
| 24 | None | 1 | N | 5S 3H 2D 3C, 15 HCP | 1NT-P-2H(xfer)-P | 2S | Jacoby transfer:accept-spades | **stayman/stayman:show-spades** | Yes* |
| 24 | None | 2 | S | 5S 3H 1D 4C, 5 HCP | 1NT-P-2H-P-2S-3H(E) | P | Jacoby transfer:signoff-spades | jacoby-transfers/transfer:signoff-hearts | Yes** |
| 74 | NS | 0 | S | 4S 5H 4D 0C, 8 HCP | 1NT-P | 2D | Jacoby transfer:to-hearts | **stayman/stayman:deny-major** | Yes* |
| 74 | NS | 1 | N | 4S 3H 3D 3C, 17 HCP | 1NT-P-2D(xfer)-P | 2H | Jacoby transfer:accept-hearts | **stayman/stayman:show-hearts** | Yes* |
| 74 | NS | 2 | S | 4S 5H 4D 0C, 8 HCP | 1NT-P-2D-P-2H-P | 2NT | NT invite (after transfer) | natural-nt/bridge:nt-invite | Yes |
| 74 | NS | 3 | N | 4S 3H 3D 3C, 17 HCP | 1NT-P-2D-P-2H-P-2NT-P | 3NT | Accept invite to 3NT | natural-nt/bridge:to-3nt | Yes |
| 124 | EW | -- | -- | *(0 steps -- no practice points generated)* | -- | -- | -- | -- | N/A |
| 174 | Both | -- | -- | *(0 steps -- no practice points generated)* | -- | -- | -- | -- | N/A |

\* Bid and grading are correct; reveal atom ID is mislabeled (see Finding 1).
\*\* Atom says "signoff-hearts" but the context is a spade signoff after heart transfer -- minor label inaccuracy.

## Findings

### Finding 1 (Confirmed): Reveal Atom IDs Mislabeled for Jacoby Transfer Bids (Severity: Medium)

**Status**: Reproduces identically to Agent 8's report. Same root cause in `buildAtomCallMap()`.

**New instances observed**:

| Seed | Bid | Actual Convention | Reveal Atom (Wrong) |
|------|-----|-------------------|---------------------|
| 24 | 2H (step 0) | Jacoby Transfer to Spades | `stayman/stayman:show-hearts` |
| 24 | 2S (step 1) | Accept Transfer to Spades | `stayman/stayman:show-spades` |
| 74 | 2D (step 0) | Jacoby Transfer to Hearts | `stayman/stayman:deny-major` |
| 74 | 2H (step 1) | Accept Transfer to Hearts | `stayman/stayman:show-hearts` |

**Root Cause** (unchanged): `buildAtomCallMap()` in `src/cli/playthrough.ts` maps atoms by `callKey` alone without auction context. Stayman atoms win by module precedence over Jacoby Transfer atoms for the same call keys (2D, 2H, 2S).

**Impact**: Grading is unaffected. Coverage tracking (`atomsCovered`) will misattribute transfer practice as Stayman coverage.

### Additional Observation: Seed 24 Step 2 -- Signoff Label

The atom `jacoby-transfers/transfer:signoff-hearts` is used for Seed 24 Step 2, but the hand transferred to spades (not hearts) and is signing off in the spade contract (passing after E's 3H interference). The atom label "signoff-hearts" is slightly misleading in this context -- the convention mechanism is correct (pass = signoff after transfer completion), but the suit in the label doesn't match the transfer suit. This may be a separate minor labeling issue or a generic atom name reuse.

## Convention Correctness Verification

All bids verified against standard bridge conventions (bridgebum.com reference):

- **Seed 24, Step 0**: 2H Jacoby Transfer with 5 spades, 5 HCP = correct. With 5+ spades, bid 2H to transfer. Weak hand (0-7 HCP) intends to sign off.
- **Seed 24, Step 1**: 2S accepting transfer = correct. Opener always completes the transfer. With 5 spades and 15 HCP, a super-accept (3S) is a style choice; 2S is standard and correct.
- **Seed 24, Step 2**: Pass after 1NT-2H-2S-3H(E) = correct. With only 5 HCP, South was signing off. Too weak to compete at the 3-level; opener can bid 3S with extras.
- **Seed 74, Step 0**: 2D Jacoby Transfer with 5 hearts, 8 HCP = correct. With 5+ hearts and invitational values, transfer then rebid 2NT. The alternative (2C Stayman with 5-4 majors) is also reasonable but the transfer approach preserves the invitational rebid.
- **Seed 74, Step 1**: 2H accepting transfer = correct. Opener completes the transfer with 3 hearts and 17 HCP.
- **Seed 74, Step 2**: 2NT invite after 1NT-2D-2H = correct. Shows 5 hearts and invitational values (8-9 HCP). Opener can pass, bid 3H, 3NT, or 4H.
- **Seed 74, Step 3**: 3NT with 17 HCP maximum after partner's 2NT invite = correct. Combined 25-26 HCP. With only 3 hearts and balanced shape, 3NT is preferred over 4H.

## Passed Seeds

| Seed | Vuln | Steps | Result |
|------|------|-------|--------|
| 24 | None | 3 | PASS (all correct, reveal labels wrong for steps 0-1) |
| 74 | NS | 4 | PASS (all correct, reveal labels wrong for steps 0-1) |
| 124 | EW | 0 | PASS (no steps) |
| 174 | Both | 0 | PASS (no steps) |
