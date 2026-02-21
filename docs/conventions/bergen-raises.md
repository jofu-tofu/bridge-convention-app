# Bergen Raises

## Sources

| Source | URL | Used For |
|--------|-----|----------|
| Bridge Bum — Bergen Raises | https://www.bridgebum.com/bergen_raises.php | Rule definitions, HCP ranges |
| ACBL SAYC Booklet | https://www.acbl.org/learn_page/how-to-play-bridge/how-to-bid/ | Major opening requirements |

## Rules

| Rule | Bid | Condition | Source |
|------|-----|-----------|--------|
| `bergen-game-raise` | 4M | After 1M-P, 13+ HCP, 4+ support | bridgebum/bergen |
| `bergen-limit-raise` | 3D | After 1M-P, 10-12 HCP, 4+ support | bridgebum/bergen |
| `bergen-constructive-raise` | 3C | After 1M-P, 7-9 HCP, 4+ support | bridgebum/bergen |
| `bergen-preemptive-raise` | 3M | After 1M-P, 0-6 HCP, 4+ support | bridgebum/bergen |

## Edge Cases

| Edge Case | Resolution | Rationale |
|-----------|------------|-----------|
| Responder has 4+ in wrong major | No Bergen match — support must be in opener's major | Bergen raises support opener's shown suit only |
| Opener with 5-5 majors | Opens 1S (higher-ranking per SAYC) | Standard American convention |
| HCP boundary 6/7 | 6 = preemptive, 7 = constructive | Boundaries are inclusive at each range's endpoints |
| HCP boundary 9/10 | 9 = constructive, 10 = limit | Boundaries are inclusive |
| HCP boundary 12/13 | 12 = limit, 13 = game raise | Game raise is direct 4M |
| Responder has support in both majors | Bergen for opener's suit only | Only opener's shown major matters |

## Variant Decision

**Standard Bergen** (3C=constructive 7-9, 3D=limit 10-12, 3M=preemptive 0-6).

Reverse Bergen (3C=limit, 3D=constructive) is a known variant but not implemented. Adding it requires only a new `ConventionConfig` with swapped rule HCP ranges.

## Simplifications

- Game raise (4M, 13+ HCP) included in Bergen rules for completeness, though some sources list it separately
- No distinction between support points and HCP (pure HCP evaluation)
- No interference handling (competitive auctions with opponent bids between 1M and response)
