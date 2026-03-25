# NT-Bundle Playthrough Report (Agent 9)

## Summary

Played 4 seeds through the `nt-bundle` CLI (`play` command) covering Jacoby Transfer conventions. One **convention correctness bug** was found: the app recommends **2NT (invite)** after a Jacoby Transfer with a hand containing a singleton, which contradicts bridgebum.com's explicit requirement that 2NT rebids require "balanced or semi-balanced (no singletons or voids)" distribution.

- **Seeds played**: 4
- **Total steps evaluated**: 10 (across seeds 9, 59, 159; seed 109 had 0 steps)
- **Grading correctness**: 9/10 steps agreed with bridgebum.com
- **Findings**: 1 (2NT invite recommended for hand with singleton -- contradicts bridgebum)

## Step-by-Step Results Table

| Seed | Vuln | Step | Seat | Hand Summary | Auction Before | App Recommends | My Bid | Correct? |
|------|------|------|------|-------------|---------------|----------------|--------|----------|
| 9 | None | 0 | S | 4S 6H 1D 2C, 5 HCP | 1NT-P | 2D | 2D | Yes |
| 9 | None | 1 | N | 2S 3H 5D 3C, 15 HCP | 1NT-P-2D(xfer)-P | 2H | 2H | Yes |
| 9 | None | 2 | S | 4S 6H 1D 2C, 5 HCP | 1NT-P-2D-P-2H-P | Pass | Pass | Yes |
| 59 | NS | 0 | S | 5S 2H 3D 3C, 7 HCP | 1NT-P | 2H | 2H | Yes |
| 59 | NS | 1 | N | 3S 2H 4D 4C, 15 HCP | 1NT-P-2H(xfer)-P | 2S | 2S | Yes |
| 59 | NS | 2 | S | 5S 2H 3D 3C, 7 HCP | 1NT-P-2H-P-2S-3H(E) | Pass | 3S | Yes (app correct) |
| 109 | EW | -- | -- | *(0 steps -- no practice points generated)* | -- | -- | -- | N/A |
| 159 | Both | 0 | S | 5S 3H 1D 4C, 9 HCP | 1NT-P | 2H | 2H | Yes |
| 159 | Both | 1 | N | 3S 4H 4D 2C, 15 HCP | 1NT-P-2H(xfer)-P | 2S | 2S | Yes |
| 159 | Both | 2 | S | 5S 3H 1D 4C, 9 HCP | 1NT-P-2H-P-2S-P | **2NT** | 3C | **No** (Finding 1) |
| 159 | Both | 3 | N | 3S 4H 4D 2C, 15 HCP | 1NT-P-2H-P-2S-P-2NT-P | 3S | 3S | Yes |

## Findings

### Finding 1: App Recommends 2NT Invite With Singleton (Severity: Medium-High)

**Seed**: 159, **Step**: 2, **Seat**: South

**Situation**: After 1NT - Pass - 2H(transfer) - Pass - 2S(accept) - Pass, South holds:

- **Shape**: 5S-3H-**1D**-4C (singleton diamond)
- **HCP**: 9
- **App recommends**: 2NT (invite)
- **Bridgebum recommends**: 3C (5+ spades, 4+ clubs, game forcing)

**What**: The app recommends 2NT as the rebid after a Jacoby Transfer, but the hand contains a **singleton diamond**. According to [bridgebum.com Jacoby Transfers](https://www.bridgebum.com/jacoby_transfers.php), the 2NT rebid after a spade transfer explicitly requires:

> "A balanced or semi-balanced **(no singletons or voids)** distribution, 5 spades, and invitational."

The hand's 5-3-1-4 shape violates this requirement.

**Correct Bid per Bridgebum**: 3C, described as:

> "5+ spades, 4+ clubs and game forcing."

This fits the hand exactly: 5 spades and 4 clubs. While 9 HCP is at the lower end for a game-forcing bid, the singleton diamond adds 2-3 distributional points (total ~11-12), which is adequate for game forcing opposite a 15-17 NT opener (combined 26-29 total points).

**Impact**:
- **User-facing grading is affected**: A user who correctly bids 3C (per bridgebum) would be graded "incorrect" by the app.
- **Teaching is misleading**: The app teaches that 2NT is correct with a singleton, contradicting standard convention definitions.
- **Contract quality**: Playing in 2NT/3NT with a singleton diamond could be a poor contract; 3C lets partner evaluate whether spades or NT is better with full shape information.

**Root Cause (Likely)**: The app's convention logic for "transfer:invite-spades" likely checks only HCP range (8-9) and spade count (5), without enforcing the shape constraint (no singletons or voids) required for the 2NT rebid.

**Suggested Fix**: Add a shape filter to the 2NT invite pathway requiring balanced or semi-balanced distribution (no singletons or voids). When the hand has a singleton and a 4+ card side suit, route to the appropriate new-suit game-forcing rebid (3C/3D).

## Convention Correctness Verification

All other bids verified against standard bridge conventions (bridgebum.com reference):

- **Seed 9, Step 0**: 2D Jacoby Transfer with 6 hearts, 5 HCP = correct (5+ hearts -> bid 2D)
- **Seed 9, Step 1**: 2H accepting transfer with 3 hearts, 15 HCP = correct (opener completes transfer)
- **Seed 9, Step 2**: Pass with 5 HCP after transfer = correct (0-7 HCP = weak signoff)
- **Seed 59, Step 0**: 2H Jacoby Transfer with 5 spades, 7 HCP = correct (5+ spades -> bid 2H)
- **Seed 59, Step 1**: 2S accepting transfer with 3 spades, 15 HCP = correct (opener completes transfer)
- **Seed 59, Step 2**: Pass with 7 HCP after transfer + opponent 3H = correct (weak hand, defer to opener to compete)
- **Seed 159, Step 0**: 2H Jacoby Transfer with 5 spades, 9 HCP = correct (5+ spades -> bid 2H)
- **Seed 159, Step 1**: 2S accepting transfer with 3 spades, 15 HCP = correct (opener completes transfer)
- **Seed 159, Step 3**: 3S with 3-card fit, 15 HCP minimum after 2NT invite = correct (sign off with fit, decline invite)

## Passed Seeds

| Seed | Vuln | Steps | Result |
|------|------|-------|--------|
| 9 | None | 3 | PASS (all correct) |
| 59 | NS | 3 | PASS (all correct) |
| 109 | EW | 0 | PASS (no steps) |
| 159 | Both | 4 | **FAIL** (Finding 1: 2NT invite with singleton at step 2) |
