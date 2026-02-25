# Stayman Convention

## Sources

| Source | URL | Used For |
| --- | --- | --- |
| Bridge Bum — Stayman | https://www.bridgebum.com/stayman.php | Rebid sequences, Smolen |
| ACBL SAYC Booklet | https://www.acbl.org/learn_page/how-to-play-bridge/how-to-bid/ | HCP thresholds |

## Rules

### Round 1: Stayman Ask

| Rule | Bid | Condition | Source |
| --- | --- | --- | --- |
| `stayman-ask` | 2C (or 3C after 2NT) | After 1NT-P or 2NT-P, 8+ HCP, 4+ card major | bridgebum/stayman |

### Round 2: Opener Response

| Rule | Bid | Condition | Source |
| --- | --- | --- | --- |
| `stayman-response-hearts` | 2H (3H after 2NT) | Opener has 4+ hearts | bridgebum/stayman |
| `stayman-response-spades` | 2S (3S after 2NT) | Opener has 4+ spades, <4 hearts | bridgebum/stayman |
| `stayman-response-denial` | 2D (3D after 2NT) | No 4-card major | bridgebum/stayman |

### Round 3: Responder Rebids After 2D Denial

| Rule | Bid | Condition | Source |
| --- | --- | --- | --- |
| `stayman-rebid-smolen-hearts` | 3H | 10+ HCP, 4S + 5H (game-forcing Smolen) | bridgebum/stayman |
| `stayman-rebid-smolen-spades` | 3S | 10+ HCP, 5S + 4H (game-forcing Smolen) | bridgebum/stayman |
| `stayman-rebid-no-fit` | 3NT | 10+ HCP, signoff | bridgebum/stayman |
| `stayman-rebid-no-fit-invite` | 2NT | 8-9 HCP, invitational | bridgebum/stayman |

### Round 3: Responder Rebids After 2H Response

| Rule | Bid | Condition | Source |
| --- | --- | --- | --- |
| `stayman-rebid-major-fit` | 4H | 10+ HCP, 4+ hearts (game) | bridgebum/stayman |
| `stayman-rebid-major-fit-invite` | 3H | 8-9 HCP, 4+ hearts (invite) | bridgebum/stayman |
| `stayman-rebid-no-fit` | 3NT | 10+ HCP, <4 hearts (game) | bridgebum/stayman |
| `stayman-rebid-no-fit-invite` | 2NT | 8-9 HCP, <4 hearts (invite) | bridgebum/stayman |

### Round 3: Responder Rebids After 2S Response

| Rule | Bid | Condition | Source |
| --- | --- | --- | --- |
| `stayman-rebid-major-fit` | 4S | 10+ HCP, 4+ spades (game) | bridgebum/stayman |
| `stayman-rebid-major-fit-invite` | 3S | 8-9 HCP, 4+ spades (invite) | bridgebum/stayman |
| `stayman-rebid-no-fit` | 3NT | 10+ HCP, <4 spades (game) | bridgebum/stayman |
| `stayman-rebid-no-fit-invite` | 2NT | 8-9 HCP, <4 spades (invite) | bridgebum/stayman |

## Stayman After 2NT Opening

Same convention at the 3-level: 3C ask, 3D/3H/3S responses. HCP thresholds remain the same since 2NT opener already shows 20-21 HCP.

## Edge Cases

| Edge Case | Resolution | Rationale |
| --- | --- | --- |
| Both 4-card majors | Opener shows hearts first | Convention priority |
| 4-4 majors after 2D denial | Bid 3NT (not Smolen) | Smolen requires 5-4 shape |
| Smolen with 5-5 | Show higher suit (3S) | Longer spades take priority in tree |
| 4333 shape | Use Stayman anyway in implementation | Bridge Bum suggests bypassing, but simplification for drilling |

## Variant

Standard Stayman. Puppet Stayman (for 2NT) not implemented.

## Not Implemented

- Competitive sequences (opponent interferes after 2C)
- Stayman after strong 2C opener
- 4-level rebids after 2D (4H=4S+6H, 4S=6S+4H signoffs)
- 3C/3D natural rebids after 2D
- 4NT quantitative slam invitation
