# DONT (Disturbing Opponent's No Trump)

## Sources

| Source                       | URL                                | Used For                       |
| ---------------------------- | ---------------------------------- | ------------------------------ |
| Bridge Bum — DONT            | https://www.bridgebum.com/dont.php | Rule definitions, bid meanings |
| Marty Bergen — Original DONT | N/A (book reference)               | Original convention design     |

## Rules

### Overcaller (South, after East opens 1NT)

| Rule          | Bid | Condition                                  | Source         |
| ------------- | --- | ------------------------------------------ | -------------- |
| `dont-2h`     | 2H  | Both majors: H5+S4+ or S5+H4+              | bridgebum/dont |
| `dont-2d`     | 2D  | Diamonds 5+ and a major 4+                 | bridgebum/dont |
| `dont-2c`     | 2C  | Clubs 5+ and a higher suit 4+              | bridgebum/dont |
| `dont-2s`     | 2S  | Spades 6+ (natural)                        | bridgebum/dont |
| `dont-double` | X   | One suit 6+, no second suit 4+, not spades | bridgebum/dont |

### Advancer (North, partner of overcaller)

| Rule                     | Bid       | Condition                                | Source         |
| ------------------------ | --------- | ---------------------------------------- | -------------- |
| `dont-advance-pass`      | Pass      | Support for partner's shown/implied suit | bridgebum/dont |
| `dont-advance-next-step` | Next step | Ask partner for second/actual suit (or prefer spades after 2H) | bridgebum/dont |
| `dont-advance-long-suit` | Own suit  | 6+ card suit, bypasses relay at 2-level  | bridgebum/dont |
| `dont-advance-3-level`   | 3-level   | 6+ card suit escape, non-forcing         | bridgebum/dont |

### Overcaller Reveal (after 1NT-X-P-2C-P)

| Rule               | Bid      | Condition          | Source         |
| ------------------ | -------- | ------------------ | -------------- |
| `dont-reveal-pass` | Pass     | 6+ clubs           | bridgebum/dont |
| `dont-reveal-suit` | Own suit | Corrects to 6+ suit | bridgebum/dont |

### 2NT Inquiry Rebid (after 1NT-2X-P-2NT-P)

| Rule             | Bid     | Condition                              | Source         |
| ---------------- | ------- | -------------------------------------- | -------------- |
| `dont-2nt-rebid` | 3-level | Shows min/max and suit distribution    | bridgebum/dont |

After 2C-P-2NT: 3C=min, 3D/3H/3S=max (showing second suit).
After 2D-P-2NT: 3C=min+equal/shorter major, 3D=min+longer major, 3H/3S=max (showing which major).
After 2H-P-2NT: 3C=min+equal/shorter spades, 3D=min+longer spades, 3H=max+equal/shorter spades, 3S=max+longer spades.

Min/max split: 11 HCP threshold.

## Edge Cases

| Edge Case                         | Resolution                      | Rationale                                                                  |
| --------------------------------- | ------------------------------- | -------------------------------------------------------------------------- |
| 6-4 hand (e.g., 6C+4H)            | Two-suited bid (2C), NOT double | Rule ordering: two-suited rules 1-3 checked before single-suited rules 4-5 |
| 6S+4H hand                        | 2H (both majors), not 2S        | dont-2h (both majors) has priority over dont-2s (natural spades)           |
| 4-4 shape                         | No DONT bid applies             | Minimum 5-4 for two-suited, 6+ for single-suited                           |
| 5-3 shape                         | No DONT bid applies             | Need 5-4+ for two-suited, 6+ for single-suited                             |
| Balanced hand with HCP in range   | No DONT bid                     | Shape required for all DONT actions                                        |
| North opens 1NT (not East)        | DONT rules return null          | Auction pattern mismatch: DONT checks for exactly ["1NT"] (1 entry)        |
| After double: advancer action     | Always bid 2C relay             | Can't leave the double in — must discover partner's suit                   |
| After 2H: advancer with hearts    | Pass (accept hearts)            | 3+ hearts = adequate support                                               |
| After 2H: advancer without hearts | Bid 2S (prefer spades)          | Shows spade preference of the two majors                                   |
| After 2H: advancer with 6+ minor  | Bid 3C/3D escape                | Non-forcing escape to long minor                                           |
| After 2S: advancer without support | 3-level escape or fallback     | Need 6+ suit to escape at 3-level                                          |

## Variant Decision

**Standard DONT** (original Marty Bergen). Modified DONT and Meckwell are known variants but not implemented.

## Simplifications

- Only handles direct seat overcall (South over East's 1NT). Balancing seat not implemented.
- Advancer 2NT inquiry bid is not in the tree (handled by AI strategy when available). Overcaller rebid responses to 2NT ARE implemented.
- No vulnerability-dependent HCP adjustments
- West (RHO of overcaller) assumed to pass — no handling of West's interference
- Support thresholds: 3+ for suited bids, 2+ for natural 2S, always relay after double
