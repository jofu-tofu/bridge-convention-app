# Bergen Raises

## Sources

| Source                     | URL                                                            | Used For                     |
| -------------------------- | -------------------------------------------------------------- | ---------------------------- |
| Bridge Bum — Bergen Raises | https://www.bridgebum.com/bergen_raises.php                    | Rule definitions, HCP ranges |
| ACBL SAYC Booklet          | https://www.acbl.org/learn_page/how-to-play-bridge/how-to-bid/ | Major opening requirements   |

## Rules

| Rule                        | Bid             | Condition                                          | Source           |
| --------------------------- | --------------- | -------------------------------------------------- | ---------------- |
| `bergen-splinter`           | 3-other-major   | After 1M-P, 12+ HCP, 4 support, shortage, not passed hand | bridgebum/bergen |
| `bergen-game-raise`         | 4M              | After 1M-P, 13+ HCP, 4 support, not passed hand   | bridgebum/bergen |
| `bergen-limit-raise`        | 3D              | After 1M-P, 10-12 HCP, 4 support, not passed hand | bridgebum/bergen |
| `bergen-constructive-raise` | 3C              | After 1M-P, 7-10 HCP, 4 support, not passed hand  | bridgebum/bergen |
| `bergen-preemptive-raise`   | 3M              | After 1M-P, 0-6 HCP, 4 support, not passed hand   | bridgebum/bergen |
| `bergen-splinter-relay`     | 3NT/3S          | Opener relays after splinter to ask for shortage    | bridgebum/bergen |
| `bergen-splinter-disclose`  | step response   | Responder discloses shortage suit after relay       | bridgebum/bergen |
| `bergen-rebid-try-*`        | help-suit       | Opener makes help-suit game try in weakest side suit | bridgebum/bergen |

## Splinter Continuations

After 1H-P-3S (splinter):
- Opener bids 3NT (relay to ask for shortage)
- Responder discloses: 4C=clubs shortage, 4D=diamonds shortage, 4H=spades shortage

After 1S-P-3H (splinter):
- Opener bids 3S (relay to ask for shortage)
- Responder discloses: 3NT=clubs shortage, 4C=diamonds shortage, 4D=hearts shortage

## Help-Suit Game Tries

After constructive raise (1M-P-3C-P), opener with 14-16 HCP makes a help-suit game try by bidding their weakest side suit at the 3-level. This asks responder to evaluate their holding in that suit.

## Edge Cases

| Edge Case                            | Resolution                                          | Rationale                                          |
| ------------------------------------ | --------------------------------------------------- | -------------------------------------------------- |
| Responder has 4+ in wrong major      | No Bergen match -- support must be in opener's major | Bergen raises support opener's shown suit only     |
| Opener with 5-5 majors               | Opens 1S (higher-ranking per SAYC)                  | Standard American convention                       |
| HCP boundary 6/7                     | 6 = preemptive, 7 = constructive                    | Boundaries are inclusive at each range's endpoints |
| HCP boundary 9/10                    | 10 HCP: limit wins (checked first in tree)           | Tree priority resolves overlap                     |
| Splinter vs game raise (12+ HCP)     | Splinter wins if hand has shortage (singleton/void)  | Splinter checked first; balanced 13+ gets game raise |
| HCP boundary 12/13                   | 12 = limit, 13 = game raise                         | Game raise is direct 4M                            |
| Responder has support in both majors | Bergen for opener's suit only                       | Only opener's shown major matters                  |
| Passed hand                          | Bergen OFF -- falls through to fallback              | Bridge Bum: "Bergen raises are OFF by a passed hand" |

## Variant Decision

**Standard Bergen** (3C=constructive 7-10, 3D=limit 10-12, 3M=preemptive 0-6, splinter with shortage 12+).

Reverse Bergen (3C=limit, 3D=constructive) is a known variant but not implemented. Adding it requires only a new `ConventionConfig` with swapped rule HCP ranges.

## Simplifications

- Game raise (4M, 13+ HCP) included in Bergen rules for completeness, though some sources list it separately
- No distinction between support points and HCP (pure HCP evaluation)
- No interference handling (competitive auctions with opponent bids between 1M and response)
- Help-suit game try bids opener's weakest (shortest) side suit; more sophisticated implementations might consider suit quality
