# Lebensohl Lite

## Sources

| Source                         | URL                                                  | Used For                         |
| ------------------------------ | ---------------------------------------------------- | -------------------------------- |
| Bridge Bum — Lebensohl (1NT)   | https://www.bridgebum.com/lebensohl_after_1nt.php    | Relay mechanics, stopper logic   |
| ACBL SAYC Booklet              | https://www.acbl.org/learn_page/how-to-play-bridge/how-to-bid/ | 1NT opening range (15-17)  |

## Overview

Lebensohl is a convention used when partner opens 1NT and an opponent overcalls at the 2-level. The key mechanism is using **2NT as an artificial relay** to 3C, which allows responder to distinguish between weak hands wanting to compete at the 3-level and strong hands forcing to game.

This is the "Lite" version — it models relay continuations but not full Lebensohl competitive branches (cue bids, Stayman-through-relay, etc.).

## Rules

### Round 1 — Responder's Initial Action (after 1NT — 2-level overcall)

| Rule                         | Bid      | Condition                       | Source              |
| ---------------------------- | -------- | ------------------------------- | ------------------- |
| `lebensohl-penalty-double`   | Double   | 10+ HCP, 4+ in overcall suit   | bridgebum/lebensohl |
| `lebensohl-direct-gf-spades` | 3S       | 10+ HCP, 5+ spades             | bridgebum/lebensohl |
| `lebensohl-direct-gf-hearts` | 3H       | 10+ HCP, 5+ hearts             | bridgebum/lebensohl |
| `lebensohl-direct-gf-diamonds`| 3D      | 10+ HCP, 5+ diamonds           | bridgebum/lebensohl |
| `lebensohl-direct-gf-clubs`  | 3C       | 10+ HCP, 5+ clubs              | bridgebum/lebensohl |
| `lebensohl-relay`            | 2NT      | 10+ HCP, no 5-card suit, no penalty double | bridgebum/lebensohl |
| `lebensohl-weak-signoff`     | Pass     | 0-9 HCP                        | bridgebum/lebensohl |

Priority: penalty double > spades > hearts > diamonds > clubs > relay > pass.

**Direct 3-level suit bids are game-forcing** (10+ HCP, 5+ card suit). Source: bridgebum/lebensohl — "any bid at the three-level is game-forcing."

### Round 2 — Opener's Forced Response (after responder's 2NT relay)

| Rule                      | Bid | Condition   | Source              |
| ------------------------- | --- | ----------- | ------------------- |
| `lebensohl-relay-accept`  | 3C  | Always      | bridgebum/lebensohl |

Completely forced — opener has no decision. The 2NT relay is a "puppet" bid.

### Round 3 — Responder's Continuation (after 2NT → 3C)

| Rule                            | Bid  | Condition                                | Source              |
| ------------------------------- | ---- | ---------------------------------------- | ------------------- |
| `lebensohl-relay-3nt`           | 3NT  | 10+ HCP, stopper in overcall suit        | bridgebum/lebensohl |
| `lebensohl-relay-pass-clubs`    | Pass | 0-9 HCP, 5+ clubs                       | bridgebum/lebensohl |
| `lebensohl-relay-signoff-spades`| 3S   | 5+ spades                               | bridgebum/lebensohl |
| `lebensohl-relay-signoff-hearts`| 3H   | 5+ hearts                               | bridgebum/lebensohl |
| `lebensohl-relay-signoff-diamonds`| 3D | 5+ diamonds                             | bridgebum/lebensohl |
| (default)                       | Pass | No 5-card suit                          | —                   |

## Relay Mechanics

The 2NT relay is the core mechanism. Responder bids 2NT (artificial), opener is forced to bid 3C, and then responder places the contract:

```
1NT — (2X overcall) — 2NT — (P) — 3C — (P) — ?
```

After the relay completes:
- **Pass** = weak hand with clubs (stay in 3C)
- **3D/3H/3S** = weak signoff in that suit (non-forcing)
- **3NT** = game values with stopper in overcall suit ("slow shows")

## Stopper Logic — Slow Shows / Fast Denies

The convention partially implements the "slow shows / fast denies" principle:

- **Slow shows (implemented):** Going through the 2NT→3C relay and then bidding 3NT shows a stopper in the opponent's suit.
- **Fast denies (NOT implemented):** A direct 3NT (bypassing the relay) should deny a stopper — but the Lite version has no direct 3NT path. Direct 3-level bids are only suit bids.

**Stopper definition (simplified):** 1+ top honor (A, K, or Q) in the overcall suit. Real Lebensohl typically requires more nuanced stoppers (e.g., Kx, Qxx, Jxxx).

## Suit Hierarchy

Suits below the overcall can be shown via the relay (non-forcing signoff). Suits at or above the overcall level require direct 3-level bids (game-forcing only):

| Overcall | Via Relay (weak signoff) | Direct (game-forcing) |
| -------- | ------------------------ | --------------------- |
| 2D       | —                        | 3D, 3H, 3S           |
| 2H       | 3C (pass), 3D            | 3H, 3S               |
| 2S       | 3C (pass), 3D, 3H       | 3S                    |

Note: The current implementation does not distinguish by overcall suit for relay vs direct paths — all direct 3-level bids are game-forcing regardless, and all post-relay bids are signoffs.

## Edge Cases

| Edge Case                              | Resolution                                          | Rationale                                          |
| -------------------------------------- | --------------------------------------------------- | -------------------------------------------------- |
| 2C overcall                            | Not handled (no trigger)                            | 2C interferes with 2NT→3C relay; excluded in Lite  |
| 10+ HCP with both 5-card suit and 4+ in overcall suit | Penalty double wins (checked first) | Priority order in decision tree                   |
| 10+ HCP with no 5-card suit, no penalty double | Uses 2NT relay → 3NT (with stopper) or pass | Relay is the catch-all for balanced game-going hands |
| Opponent bids over the 2NT relay       | Convention silently stops                           | `passedAfter()` seatFilter gates rounds 2 and 3   |
| Weak hand (0-9 HCP) with long suit     | Must pass (no 2-level signoff available)            | Lite version has no weak suit bids below relay     |

## Deal Constraints

- **North (opener):** 15-17 HCP, balanced, max 4 spades, max 4 hearts
- **South (responder):** 0+ HCP (no constraint)
- **Default auction seed:** `["1NT", "2D"]` (2D overcall as default scenario)

## Simplifications

- Only handles overcalls in diamonds, hearts, and spades — no 2C overcall (conflicts with relay structure)
- No "fast denies" path (direct 3NT to deny a stopper) — only "slow shows" is implemented
- No Stayman-through-relay (2NT→3C→cue bid to invoke Stayman for 4-4 major fit)
- No cue bid paths for showing/denying stoppers while looking for game
- Simplified stopper check — any single top honor (A, K, Q) qualifies as a stopper
- No interference handling over the relay — if opponents bid again after 2NT, the convention stops
- No competitive doubles after relay (responsive/competitive doubles not modeled)
- No opener rebid after responder places the contract
- No invitational sequences (relay → suit above overcall = invite) — Lite version treats all post-relay suit bids as signoffs
- Empty explanations — no teaching metadata authored yet
