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
| `dont-advance-next-step` | Next step | Ask partner for second/actual suit       | bridgebum/dont |

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

## Variant Decision

**Standard DONT** (original Marty Bergen). Modified DONT and Meckwell are known variants but not implemented.

## Simplifications

- Only handles direct seat overcall (South over East's 1NT). Balancing seat not implemented.
- Advance rules simplified: pass with support or bid next step. No jump responses or cuebids.
- No vulnerability-dependent HCP adjustments
- West (RHO of overcaller) assumed to pass — no handling of West's interference
- Support thresholds: 3+ for suited bids, 2+ for natural 2S, always relay after double
