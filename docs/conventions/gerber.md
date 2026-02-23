# Gerber Convention

## Sources

| Source                           | URL                                                                         | Used For                         |
| -------------------------------- | --------------------------------------------------------------------------- | -------------------------------- |
| Bridge Bum — Gerber Convention   | https://www.bridgebum.com/gerber.php                                        | Rule definitions, response table |
| ACBL SAYC Booklet — Slam Bidding | https://www.acbl.org/learn_page/how-to-play-bridge/how-to-bid/slam-bidding/ | HCP thresholds                   |

## Rules

### Ace-Asking (4C)

| Rule                        | Bid  | Condition                                        | Source           |
| --------------------------- | ---- | ------------------------------------------------ | ---------------- |
| `gerber-ask`                | 4C   | After 1NT-P or 2NT-P, responder 16+ HCP, no void | bridgebum/gerber |
| `gerber-response-zero-four` | 4D   | After 4C ask, opener has 0 or 4 aces             | bridgebum/gerber |
| `gerber-response-one`       | 4H   | Opener has 1 ace                                 | bridgebum/gerber |
| `gerber-response-two`       | 4S   | Opener has 2 aces                                | bridgebum/gerber |
| `gerber-response-three`     | 4NT  | Opener has 3 aces                                | bridgebum/gerber |

### King-Asking (5C)

| Rule                             | Bid  | Condition                                        | Source           |
| -------------------------------- | ---- | ------------------------------------------------ | ---------------- |
| `gerber-king-ask`                | 5C   | After ace response, total aces >= 3              | bridgebum/gerber |
| `gerber-king-response-zero-four` | 5D   | After 5C ask, opener has 0 or 4 kings            | bridgebum/gerber |
| `gerber-king-response-one`       | 5H   | Opener has 1 king                                | bridgebum/gerber |
| `gerber-king-response-two`       | 5S   | Opener has 2 kings                               | bridgebum/gerber |
| `gerber-king-response-three`     | 5NT  | Opener has 3 kings                               | bridgebum/gerber |

### Signoff

| Rule             | Bid             | Condition                                         | Source           |
| ---------------- | --------------- | ------------------------------------------------- | ---------------- |
| `gerber-signoff` | 4NT/5NT/6NT/7NT | Based on combined ace count (and king count if asked) | bridgebum/gerber |

**Signoff after ace response only (< 3 total aces):** cheapest NT signoff.
**Signoff after king response:** 7NT with 4 aces + 4 kings, 6NT with 3+ aces, 5NT otherwise.

## Edge Cases

| Edge Case                              | Resolution                                    | Rationale                                                     |
| -------------------------------------- | --------------------------------------------- | ------------------------------------------------------------- |
| 0 vs 4 aces ambiguity (4D response)   | Disambiguate using responder's own ace count  | If responder has 4 aces, opener has 0; otherwise opener has 4 |
| 0 vs 4 kings ambiguity (5D response)  | Disambiguate using responder's own king count | Same logic as ace disambiguation                              |
| Gerber vs Stayman after 1NT           | No conflict — different bid levels (4C vs 2C) | Each convention evaluated independently                       |
| Opener with 0 aces                    | Valid: 15 HCP from K+Q+J combinations only    | Rare but possible (e.g., KQJ in multiple suits)               |
| Responder exactly 16 HCP              | Fires gerber-ask (boundary inclusive)         | 16+ means >= 16                                               |
| Signoff after 4S response (< 3 aces)  | Bid 5NT (4NT would be below 4S)               | Can't sign off at 4NT when response was 4S                    |
| Responder with void                   | Does not fire gerber-ask                       | Per bridgebum: "Gerber should not be used with a void"        |
| Gerber after 2NT opening              | Fires normally                                 | Gerber applies after any NT opening per bridgebum             |

## Variant

Standard Gerber (0123 step responses). Roman Key Card Gerber (1430 responses) not implemented.

## Simplifications

- Signoff logic simplified: decisions based on ace/king totals only
- No vulnerability-dependent decisions
- King-ask always fires with 3+ total aces (no responder discretion)
