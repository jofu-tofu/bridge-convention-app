# Weak Two Bids

## Sources

| Source                  | URL                                     | Used For                          |
| ----------------------- | --------------------------------------- | --------------------------------- |
| Bridge Bum — Weak Twos  | https://www.bridgebum.com/weak_two.php  | Rule definitions, response system |
| Bridge Bum — Ogust      | https://www.bridgebum.com/ogust.php     | Ogust rebid system                |
| ACBL SAYC Booklet       | https://www.acbl.org/learn_page/how-to-play-bridge/how-to-bid/ | HCP ranges, SAYC context |

## Rules

### Opener (Round 1)

| Rule                | Bid | Condition                          | Source          |
| ------------------- | --- | ---------------------------------- | --------------- |
| `has-6-hearts`      | 2H  | 6+ hearts, 5-11 NV / 6-11 vul HCP | bridgebum/weak  |
| `has-6-spades`      | 2S  | 6+ spades, 5-11 NV / 6-11 vul HCP | bridgebum/weak  |
| `has-6-diamonds`    | 2D  | 6+ diamonds, 5-11 NV / 6-11 vul HCP | bridgebum/weak  |
| `no-weak-two`       | —   | Fallback (no qualifying suit/HCP)  | —               |

Priority: hearts > spades > diamonds. Clubs excluded (2C reserved for strong opening).

### Responder (Round 2)

| Rule                    | Bid                | Condition                            | Source          |
| ----------------------- | ------------------ | ------------------------------------ | --------------- |
| `game-strength-with-fit`| 4M / 5m (dynamic)  | 16+ HCP, 3+ in partner's suit       | bridgebum/weak  |
| `ogust-ask`             | 2NT                | 16+ HCP (no fit required)           | bridgebum/ogust |
| `invite-with-fit`       | 3 of partner's suit| 14-15 HCP, 3+ in partner's suit     | bridgebum/weak  |
| `weak-pass`             | Pass               | Fallback (< 14 HCP or no fit)       | —               |

Game raise returns 4M for majors, 5m for diamonds.

### Ogust Rebid (Round 3 — Opener after partner's 2NT)

| Rule            | Bid | Condition                        | Source          |
| --------------- | --- | -------------------------------- | --------------- |
| `solid-suit`    | 3NT | 3 top honors (AKQ) in opened suit| bridgebum/ogust |
| `min-bad-suit`  | 3C  | 5-8 NV / 6-8 vul HCP, 0-1 top honors | bridgebum/ogust |
| `min-good-suit` | 3D  | 5-8 NV / 6-8 vul HCP, 2+ top honors  | bridgebum/ogust |
| `max-bad-suit`  | 3H  | 9-11 HCP, 0-1 top honors        | bridgebum/ogust |
| `max-good-suit` | 3S  | 9-11 HCP, 2+ top honors         | bridgebum/ogust |

Solid suit (3NT) is checked first. Mnemonic: "Minors are Minimum, 1-2-1-2-3."

```
             Bad Suit    Good Suit    Solid
Min HCP       3C          3D          —       (5-8 NV / 6-8 vul)
Max HCP       3H          3S          3NT     (9-11)
```

## Ogust System

After a weak two opening, responder's 2NT is an artificial asking bid (Ogust convention). Opener describes their hand along two dimensions:

1. **Strength:** min (5-8 NV / 6-8 vul HCP) vs max (9-11 HCP)
2. **Suit quality:** bad (0-1 top honors) vs good (2+ top honors) vs solid (AKQ)

"Top honors" = Ace, King, Queen only. Jack does not count.

Source: bridgebum/ogust — "Ogust is a conventional 2NT response to a weak two bid... It is an artificial strong bid, showing 15+ points with interest in game."

## Edge Cases

| Edge Case                              | Resolution                                          | Rationale                                          |
| -------------------------------------- | --------------------------------------------------- | -------------------------------------------------- |
| Hand with 6+ in two suits (e.g. H+S)  | Opens in higher-priority suit (hearts > spades > diamonds) | Tree priority order                        |
| 2C excluded                            | No weak two in clubs                                | 2C reserved for strong conventional opening        |
| Responder 16+ HCP with fit             | Game raise takes priority over Ogust                | Direct raise is more descriptive when fit is known |
| Responder 10-13 HCP                    | Falls through to pass (no bid in this range)        | Gap in response tree; only 14+ has actions         |
| Suit quality boundary                  | J does not count as a top honor                     | Only A, K, Q qualify                               |
| 11 HCP opening vs Rule of 20           | 11 HCP with 6-card suit technically meets Rule of 20 | SAYC specifies 5-11 NV / 6-11 vul range; partnership agreement on boundary |

## Variant Decision

**Standard Ogust** responses (3C=min/bad, 3D=min/good, 3H=max/bad, 3S=max/good, 3NT=solid).

Alternative response methods exist (e.g., 2NT as a feature ask showing A/K in side suits) but are not implemented. The feature-ask variant is mentioned in BridgeBum's weak two page but Ogust is used here as the more informative system.

## Simplifications

- No suit quality requirements beyond top-honor count for Ogust — no checks on intermediate cards (10, 9) or suit texture
- No side four-card major restriction — can open a weak two even with a 4-card major on the side
- No new suit forcing response — responder can only raise, bid 2NT (Ogust), or pass
- No feature-ask variant (2NT always uses Ogust, never side-suit feature showing)
- No interference handling — convention has no overlays for competitive auctions
- No responder continuation after Ogust — convention stops after opener's Ogust rebid (no Round 4)
- No preemptive raise by responder — no support for raising with weak hand + good support
- Responder HCP gap: hands with 10-13 HCP always pass (response tree has no action in this range without 3+ support at 14+ HCP)
