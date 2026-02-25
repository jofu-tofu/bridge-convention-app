# Landy Convention

## Sources

| Source | URL | Used For |
| --- | --- | --- |
| Bridge Bum — Landy | https://www.bridgebum.com/landy.php | All rules, response table, overcaller rebids |

## Rules

### Overcall

| Rule | Bid | Condition | Source |
| --- | --- | --- | --- |
| `landy-2c` | 2C | After opponent's 1NT, 10+ HCP, 5-4+ in both majors | bridgebum/landy |

### Responder Bids (after 1NT-2C-P)

| Rule | Bid | Condition | Source |
| --- | --- | --- | --- |
| `landy-response-2nt` | 2NT | 12+ HCP, artificial forcing inquiry | bridgebum/landy |
| `landy-response-3h` | 3H | 10-12 HCP, 4+ hearts, invitational | bridgebum/landy |
| `landy-response-3s` | 3S | 10-12 HCP, 4+ spades, invitational | bridgebum/landy |
| `landy-response-pass` | Pass | 5+ clubs, happy to play 2C | bridgebum/landy |
| `landy-response-2h` | 2H | 4+ hearts, signoff | bridgebum/landy |
| `landy-response-2s` | 2S | 4+ spades, <4 hearts, signoff | bridgebum/landy |
| `landy-response-2d` | 2D | No strong major preference, relay | bridgebum/landy |

### Overcaller Rebids After 2NT Inquiry (1NT-2C-P-2NT-P)

| Rule | Bid | Condition | Source |
| --- | --- | --- | --- |
| `landy-rebid-3nt` | 3NT | 12+ HCP (maximum), 5-5+ majors | bridgebum/landy |
| `landy-rebid-3s` | 3S | 10-11 HCP (medium), 5-5+ majors | bridgebum/landy |
| `landy-rebid-3d` | 3D | 12+ HCP (maximum), 5-4 or 4-5 | bridgebum/landy |
| `landy-rebid-3c` | 3C | 10-11 HCP (medium), 5-4 or 4-5 | bridgebum/landy |

## Strength Categories (per Bridge Bum)

| Category | HCP Range |
| --- | --- |
| Minimum | 6-9 (below deal constraint minimum of 10) |
| Medium | 10-11 |
| Maximum | 12+ |

## Edge Cases

| Edge Case | Resolution | Rationale |
| --- | --- | --- |
| Hearts vs spades preference | Hearts shown first | Convention priority |
| 5+ clubs with strong hand | 2NT inquiry takes priority (12+) | Inquiry checked before pass |
| 4-3 majors | Not sufficient for Landy | Requires 5-4+ |
| Minimum overcaller (6-9) | 3H rebid after 2NT (5-5) or 3C (5-4) | Below deal constraint; rarely fires |

## Not Implemented

- Competitive sequences (opponent doubles 2C)
- Responder's follow-up after overcaller rebid
- 3-level natural bids by responder (3C/3D)
