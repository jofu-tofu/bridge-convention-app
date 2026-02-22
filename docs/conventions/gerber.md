# Gerber Convention

## Sources

| Source                           | URL                                                                         | Used For                         |
| -------------------------------- | --------------------------------------------------------------------------- | -------------------------------- |
| Bridge Bum — Gerber Convention   | https://www.bridgebum.com/gerber_convention.php                             | Rule definitions, response table |
| ACBL SAYC Booklet — Slam Bidding | https://www.acbl.org/learn_page/how-to-play-bridge/how-to-bid/slam-bidding/ | HCP thresholds                   |

## Rules

| Rule                        | Bid             | Condition                            | Source           |
| --------------------------- | --------------- | ------------------------------------ | ---------------- |
| `gerber-ask`                | 4C              | After 1NT-P, responder 13+ HCP       | bridgebum/gerber |
| `gerber-response-zero-four` | 4D              | After 4C ask, opener has 0 or 4 aces | bridgebum/gerber |
| `gerber-response-one`       | 4H              | Opener has 1 ace                     | bridgebum/gerber |
| `gerber-response-two`       | 4S              | Opener has 2 aces                    | bridgebum/gerber |
| `gerber-response-three`     | 4NT             | Opener has 3 aces                    | bridgebum/gerber |
| `gerber-signoff`            | 4NT/5NT/6NT/7NT | Based on combined ace count          | bridgebum/gerber |

## Edge Cases

| Edge Case                           | Resolution                                    | Rationale                                                     |
| ----------------------------------- | --------------------------------------------- | ------------------------------------------------------------- |
| 0 vs 4 aces ambiguity (4D response) | Disambiguate using responder's own ace count  | If responder has 4 aces, opener has 0; otherwise opener has 4 |
| Gerber vs Stayman after 1NT         | No conflict — different bid levels (4C vs 2C) | Each convention evaluated independently                       |
| Opener with 0 aces                  | Valid: 15 HCP from K+Q+J combinations only    | Rare but possible (e.g., KQJ in multiple suits)               |
| Responder exactly 13 HCP            | Fires gerber-ask (boundary inclusive)         | 13+ means >= 13                                               |
| Signoff after 4S response (2 aces)  | Bid 5NT (4NT would be below 4S)               | Can't sign off at 4NT when response was 4S                    |

## Variant

Standard Gerber (0123 step responses). Roman Key Card Gerber (1430 responses) not implemented.

## Simplifications

- Only handles ace-asking (no king-asking follow-up with 5C)
- Signoff logic simplified: 4 aces = 7NT, 3 aces = 6NT, fewer = cheapest NT signoff
- No vulnerability-dependent decisions
