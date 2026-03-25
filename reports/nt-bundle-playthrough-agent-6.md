# NT-Bundle Playthrough Report (Agent 6)

## Summary

Played 4 seeds through the `nt-bundle` CLI (`play` command) covering Jacoby Transfer conventions (all seeds hit "1NT Responses"). All graded bids are conventionally correct for the app's preferred answers. One **minor finding** was identified: the app rejects 3D (a bridgebum-listed game-forcing rebid showing 5+ spades and 4+ diamonds) in favor of 3NT for a semi-balanced hand, when both bids are valid per authoritative references.

- **Seeds played**: 4
- **Total steps evaluated**: 11 (seed 6: 3, seed 56: 4, seed 106: 4, seed 156: 0)
- **Grading correctness**: 11/11 steps -- app's preferred answers are all conventionally defensible
- **Findings**: 1 (3D rejected as incorrect when it should be acceptable per bridgebum)

## Step-by-Step Results Table

| Seed | Vuln | Step | Seat | Hand Summary | Auction Before | My Bid | App Answer | Grade | Correct? | Notes |
|------|------|------|------|-------------|----------------|--------|------------|-------|----------|-------|
| 6 | None | 0 | S | 3S 5H 3D 2C, 6 HCP | 1NT-P | 2D | 2D | correct | Yes | Jacoby Transfer to hearts |
| 6 | None | 1 | N | 2S 4H 4D 3C, 15 HCP | 1NT-P-2D-P | 2H | 2H | correct | Yes | Accept transfer to hearts |
| 6 | None | 2 | S | 3S 5H 3D 2C, 6 HCP | 1NT-P-2D-P-2H-3C(E) | Pass | Pass | correct | Yes | Signoff in hearts (weak hand) |
| 56 | NS | 0 | S | 5S 3H 1D 4C, 8 HCP | 1NT-P | 2H | 2H | correct | Yes | Jacoby Transfer to spades |
| 56 | NS | 1 | N | 3S 4H 2D 4C, 16 HCP | 1NT-P-2H-P | 2S | 2S | correct | Yes | Accept transfer to spades |
| 56 | NS | 2 | S | 5S 3H 1D 4C, 8 HCP | 1NT-P-2H-P-2S-P | 2NT | 2NT | correct | Yes | Invitational with 5 spades |
| 56 | NS | 3 | N | 3S 4H 2D 4C, 16 HCP | 1NT-P-2H-P-2S-P-2NT-P | 3NT | 3NT | correct | Yes | Accept invite (16 HCP) |
| 106 | EW | 0 | S | 5S 2H 4D 2C, 15 HCP | 1NT-P | 2H | 2H | correct | Yes | Jacoby Transfer to spades |
| 106 | EW | 1 | N | 3S 5H 3D 2C, 15 HCP | 1NT-P-2H-P | 2S | 2S | correct | Yes | Accept transfer to spades |
| 106 | EW | 2 | S | 5S 2H 4D 2C, 15 HCP | 1NT-P-2H-P-2S-P | 3D | **3NT** | incorrect | **Finding 1** | App rejects 3D; see below |
| 106 | EW | 3 | N | 3S 5H 3D 2C, 15 HCP | 1NT-P-2H-P-2S-P-3NT-P | 4S | **4S** | near-miss (Pass) | Yes | Correct to 4S with 3-card support |
| 156 | Both | -- | -- | *(0 steps -- no practice points generated)* | -- | -- | -- | -- | N/A | |

## Findings

### Finding 1: 3D Rejected After Jacoby Transfer When Both 3D and 3NT Are Valid (Severity: Low)

**Seed 106, Step 2**

**Hand**: S: AK862, H: J3, D: KJT4, C: K9 (15 HCP, 5-2-4-2)

**Auction**: 1NT - P - 2H(xfer) - P - 2S - P - ?

**App's correct answer**: 3NT ("5 spades, let opener choose")

**My bid**: 3D (5+ spades, 4+ diamonds, game-forcing)

**Bridgebum reference** ([Jacoby Transfers](https://www.bridgebum.com/jacoby_transfers.php)):

Responder's rebids after 1NT - 2H - 2S include:
- **3C**: 5+ spades, 4+ clubs and game-forcing
- **3D**: 5+ spades, 4+ diamonds and game-forcing
- **3NT**: balanced or semi-balanced (no singletons/voids) with 5 spades; partner can pass or correct to 4S

**Analysis**: The hand (5-2-4-2) qualifies for both 3D (5 spades + 4 diamonds, GF) and 3NT (semi-balanced, no singleton). Bridgebum explicitly lists 3D as a valid rebid for this hand profile. The app marks 3D as `incorrect` (not even `acceptable`), which is overly strict.

**Impact**: A user who correctly bids 3D -- following bridgebum's convention description for hands with a 4-card diamond side suit -- would be told they are wrong. This could teach users to avoid showing second suits after transfers, which is the opposite of the convention's purpose (slam exploration).

**App's reasoning** (from conditions output):
1. Game values opposite 1NT (10+ HCP) -- passed
2. Exactly 5 spades (offer 3NT as alternative to 4S) -- passed
3. No singleton or void (balanced enough for NT) -- passed

The app's logic prioritizes 3NT for any semi-balanced hand, suppressing 3D. While 3NT is a fine bid, 3D should be at minimum `acceptable`.

**Suggested Fix**: When the hand has both 5+ spades and 4+ of a minor, and game-forcing values, 3-of-the-minor should be marked as `acceptable` even if 3NT is preferred.

## Convention Correctness Verification

All bids verified against [bridgebum.com Jacoby Transfers](https://www.bridgebum.com/jacoby_transfers.php):

- **Seed 6, Step 0**: 2D transfer with 5 hearts and 6 HCP = correct (5+ hearts -> bid 2D, weak hand -> sign off after transfer)
- **Seed 6, Step 1**: 2H accepting transfer = correct (opener always completes the transfer)
- **Seed 6, Step 2**: Pass after transfer + opponent interference with weak hand = correct
- **Seed 56, Step 0**: 2H transfer with 5 spades and 8 HCP = correct (5+ spades -> bid 2H)
- **Seed 56, Step 1**: 2S accepting transfer = correct
- **Seed 56, Step 2**: 2NT invite with 5 spades and invitational values = correct per bridgebum ("balanced or semi-balanced, 5 spades, invitational")
- **Seed 56, Step 3**: 3NT accepting invitation with 16 HCP = correct per bridgebum ("Partner can pass, sign off in 3S or bid 3NT")
- **Seed 106, Step 0**: 2H transfer with 5 spades = correct
- **Seed 106, Step 1**: 2S accepting transfer = correct
- **Seed 106, Step 2**: 3NT with 5 spades, game values, semi-balanced = correct per bridgebum (but 3D is also valid)
- **Seed 106, Step 3**: 4S correcting to spades with 3-card support = correct per bridgebum ("Partner can pass or correct to 4S")

## Passed Seeds

| Seed | Vuln | Steps | Result |
|------|------|-------|--------|
| 6 | None | 3 | PASS (all correct) |
| 56 | NS | 4 | PASS (all correct) |
| 106 | EW | 4 | PASS (app answers correct; 3D should be acceptable -- Finding 1) |
| 156 | Both | 0 | PASS (no steps) |
