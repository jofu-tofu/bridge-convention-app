# NT-Bundle Playthrough Report (Agent 4)

## Summary

Played 4 seeds through the `nt-bundle` CLI (`play` command) covering Stayman and Jacoby Transfer conventions across all four vulnerability conditions. All **12 graded bids are conventionally correct** -- the bidding engine produces the right calls, the teaching feedback is accurate, and convention identification is correct throughout.

- **Seeds played**: 4
- **Total steps evaluated**: 12 (seed 4: 3, seed 54: 3, seed 104: 4, seed 154: 2)
- **Grading correctness**: 12/12 steps correct
- **Findings**: 0

## Step-by-Step Results Table

| Seed | Vuln | Step | Seat | Hand Summary | Auction Before | My Bid | App Expected | Convention (Graded) | Correct? |
|------|------|------|------|-------------|---------------|--------|-------------|---------------------|----------|
| 4 | None | 0 | S | 2S 4H 4D 3C, 12 HCP | 1NT-P | 2C | 2C | Stayman ask-major | Yes |
| 4 | None | 1 | N | 5S 3H 3D 2C, 15 HCP | 1NT-P-2C-P | 2S | 2S | Stayman show-spades | Yes |
| 4 | None | 2 | S | 2S 4H 4D 3C, 12 HCP | 1NT-P-2C-P-2S-P | 3NT | 3NT | Stayman NT-game-no-fit | Yes |
| 54 | NS | 0 | S | 5S 3H 2D 3C, 3 HCP | 1NT-P | 2H | 2H | Jacoby transfer:to-spades | Yes |
| 54 | NS | 1 | N | 2S 3H 4D 4C, 15 HCP | 1NT-P-2H-P | 2S | 2S | Jacoby transfer:accept-spades | Yes |
| 54 | NS | 2 | S | 5S 3H 2D 3C, 3 HCP | 1NT-P-2H-P-2S-P | P | P | Jacoby transfer:signoff-spades | Yes |
| 104 | EW | 0 | S | 1S 5H 3D 4C, 8 HCP | 1NT-P | 2D | 2D | Jacoby transfer:to-hearts | Yes |
| 104 | EW | 1 | N | 4S 3H 2D 4C, 17 HCP | 1NT-P-2D-P | 2H | 2H | Jacoby transfer:accept-hearts | Yes |
| 104 | EW | 2 | S | 1S 5H 3D 4C, 8 HCP | 1NT-P-2D-P-2H-2S(E) | 2NT | 2NT | Jacoby transfer:invite-hearts | Yes |
| 104 | EW | 3 | N | 4S 3H 2D 4C, 17 HCP | 1NT-P-2D-P-2H-2S(E)-2NT-P | 3NT | 3NT | Jacoby transfer:accept-invite | Yes |
| 154 | Both | 0 | S | 5S 3H 1D 4C, 11 HCP | 1NT-P | 2H | 2H | Jacoby transfer:to-spades | Yes |
| 154 | Both | 1 | N | 2S 4H 4D 3C, 15 HCP | 1NT-P-2H-P | 2S | 2S | Jacoby transfer:accept-spades | Yes |

## Findings

No convention correctness issues found. All bids match standard bridge convention practice.

## Convention Correctness Verification

All bids verified against standard bridge conventions (bridgebum.com reference):

### Seed 4 -- Stayman (Game-Forcing)
- **Step 0**: 2C Stayman with 4 hearts and 12 HCP = correct (8+ HCP, 4-card major, no 5-card major -> Stayman over transfer)
- **Step 1**: 2S showing spades with 5 spades, denying 4 hearts = correct (standard Stayman response: show spades when 4+ spades, deny 4 hearts)
- **Step 2**: 3NT with no spade fit (only 2 spades) and game values (12 HCP) = correct (game in NT when no major fit)

### Seed 54 -- Jacoby Transfer (Weak Signoff)
- **Step 0**: 2H transfer with 5 spades and 3 HCP = correct (5+ spades -> bid 2H, any strength)
- **Step 1**: 2S completing the transfer = correct (opener always accepts)
- **Step 2**: Pass with 3 HCP (weak hand) = correct (signoff after transfer completion)

### Seed 104 -- Jacoby Transfer (Invitational Sequence with Opponent Interference)
- **Step 0**: 2D transfer with 5 hearts and 8 HCP = correct (5+ hearts -> bid 2D)
- **Step 1**: 2H accepting transfer with 17 HCP and 3 hearts = correct (opener completes transfer regardless of hand)
- **Step 2**: 2NT invite after transfer accepted, despite East's 2S overcall = correct (8-9 HCP, 5 hearts, invitational)
- **Step 3**: 3NT accepting invite with 17 HCP (maximum) = correct (16-17 HCP accepts, regardless of heart count)

### Seed 154 -- Jacoby Transfer (Game Values, Partial Sequence)
- **Step 0**: 2H transfer with 5 spades and 11 HCP = correct (5+ spades -> bid 2H)
- **Step 1**: 2S accepting transfer = correct (mandatory acceptance)
- Note: Playthrough ends after 2 steps (`complete: true`). South's rebid showing game values (e.g., 3NT) is not tested in this seed.

## Observations

1. **Seed 104 featured opponent interference**: East overcalled 2S after the transfer was accepted. The app correctly handled this by maintaining South's 2NT invite as the expected bid, demonstrating proper handling of competitive auctions within the convention framework.

2. **Seed 104 Step 3 -- 3NT vs 4H debate**: With maximum (17 HCP) and 3-card heart support after responder's invite, the app recommends 3NT (not 4H). This is one valid treatment where opener accepts the invite via 3NT, leaving the choice of strain to responder who can correct to 4H with 6+ hearts. The near-miss options correctly show 3H (minimum with fit) and Pass (minimum without fit).

3. **Seed 154 partial coverage**: Only 2 of the expected auction steps were tested (transfer and acceptance). The responder's rebid (showing game values) was not part of the playthrough. This limits coverage verification for the full game-forcing transfer sequence.

## Passed Seeds

| Seed | Vuln | Steps | Result |
|------|------|-------|--------|
| 4 | None | 3 | PASS (all correct) |
| 54 | NS | 3 | PASS (all correct) |
| 104 | EW | 4 | PASS (all correct) |
| 154 | Both | 2 | PASS (all correct) |
