# SAYC (Standard American Yellow Card)

## Sources

| Source                       | URL                                              | Used For                              |
| ---------------------------- | ------------------------------------------------ | ------------------------------------- |
| Bridge Bum — SAYC            | https://www.bridgebum.com/sayc.php               | System overview, bid definitions      |
| ACBL SAYC Booklet            | https://www.acbl.org/learn_page/how-to-play-bridge/how-to-bid/ | Official HCP ranges, rules  |
| ACBL SAYC Convention Card    | http://web2.acbl.org/documentlibrary/play/sayc_card.pdf | Convention card reference    |

## Overview

SAYC is a complete bidding system based on 5-card majors and a strong 1NT (15-17). It is the de facto standard for online bridge (BBO, OKbridge) and derives from the ACBL. Unlike the other conventions in this app (Stayman, Bergen, DONT, etc.) which are individual treatments, SAYC is a **full bidding system** covering openings, responses, rebids, and competitive actions.

## Opening Bids

Checked in priority order (first match wins):

| Priority | Bid  | Condition                                    | Source      |
| -------- | ---- | -------------------------------------------- | ----------- |
| 1        | 2C   | 22+ HCP (strong, artificial)                | bridgebum   |
| 2        | 2NT  | 20-21 HCP, balanced                         | bridgebum   |
| 3        | 1NT  | 15-17 HCP, balanced, no 5-card major        | bridgebum   |
| 4        | 1S   | 12+ HCP, 5+ spades (longer/equal major)     | bridgebum   |
| 5        | 1H   | 12+ HCP, 5+ hearts                          | bridgebum   |
| 6        | 1D   | 12+ HCP, 4+ diamonds (no 5-card major)      | bridgebum   |
| 7        | 1C   | 12+ HCP, 3+ clubs (no 5-card major)         | bridgebum   |
| 8        | 3S   | 5-11 HCP, 7+ spades (preempt)               | bridgebum   |
| 9        | 3H   | 5-11 HCP, 7+ hearts (preempt)               | bridgebum   |
| 10       | 3D   | 5-11 HCP, 7+ diamonds (preempt)             | bridgebum   |
| 11       | 3C   | 5-11 HCP, 7+ clubs (preempt)                | bridgebum   |
| 12       | 2H   | 5-11 HCP, 6+ hearts (weak two)              | bridgebum   |
| 13       | 2S   | 5-11 HCP, 6+ spades (weak two)              | bridgebum   |
| 14       | 2D   | 5-11 HCP, 6+ diamonds (weak two)            | bridgebum   |
| 15       | Pass | Fallback                                     | —           |

**Key rules:**
- 5-card majors in all seats
- Open higher of equal-length suits (5-5 or 6-6 → open the higher-ranking)
- 1D with 4-4 in minors, 1C with 3-3 in minors
- 7-card preempts checked before 6-card weak twos
- 2C is always strong/artificial (no weak 2C)

## Responses

### To 1NT Opening (15-17 HCP)

| Bid | Condition                    | Forcing? | Source      |
| --- | ---------------------------- | -------- | ----------- |
| 2D  | 5+ hearts (Jacoby transfer)  | F1R      | bridgebum   |
| 2H  | 5+ spades (Jacoby transfer)  | F1R      | bridgebum   |
| 2C  | 8+ HCP, 4-card major (Stayman) | F1R   | bridgebum   |
| 3NT | 10-15 HCP, balanced          | —        | bridgebum   |
| 2NT | 8-9 HCP, balanced (invite)   | NF       | bridgebum   |
| Pass| 0-7 HCP                      | —        | —           |

Transfers take priority over Stayman — with 5+ major AND 4-card major, transfer wins.

### To 2NT Opening (20-21 HCP)

| Bid | Condition                    | Forcing? | Source      |
| --- | ---------------------------- | -------- | ----------- |
| 3D  | 4+ HCP, 5+ hearts (transfer) | F1R     | bridgebum   |
| 3H  | 4+ HCP, 5+ spades (transfer) | F1R     | bridgebum   |
| 3C  | 4+ HCP, 4-card major (Stayman)| F1R    | bridgebum   |
| 3NT | 4-10 HCP, balanced           | —        | bridgebum   |
| Pass| 0-3 HCP                      | —        | —           |

### To Strong 2C Opening (22+ HCP)

| Bid | Condition                    | Forcing? | Source      |
| --- | ---------------------------- | -------- | ----------- |
| 2S  | 8+ HCP, 5+ spades (positive) | GF      | bridgebum   |
| 2H  | 8+ HCP, 5+ hearts (positive) | GF      | bridgebum   |
| 3D  | 8+ HCP, 5+ diamonds (positive)| GF     | bridgebum   |
| 3C  | 8+ HCP, 5+ clubs (positive)  | GF      | bridgebum   |
| 2NT | 8+ HCP, balanced (positive)  | GF      | bridgebum   |
| 2D  | 0-7 HCP (waiting, artificial)| F1R     | bridgebum   |

2C is game-forcing. 2D waiting is the standard negative/waiting response.

### To Weak Two Bids (2D/2H/2S, 5-11 HCP)

| Bid              | Condition                  | Forcing? | Source      |
| ---------------- | -------------------------- | -------- | ----------- |
| 2NT              | 16+ HCP (feature ask)     | F1R      | bridgebum   |
| Raise to 3       | 6-15 HCP, 3+ support      | NF       | bridgebum   |
| Pass             | Fallback                   | —        | —           |

### To Suit Openings (1C/1D/1H/1S)

#### Responding to 1H/1S (Major)

| Bid          | Condition                        | Forcing? | Source      |
| ------------ | -------------------------------- | -------- | ----------- |
| 4M (raise)   | 13+ HCP, 4+ support             | —        | bridgebum   |
| 3M (jump)    | 10-12 HCP, 4+ support (limit)   | NF       | bridgebum   |
| 2M (raise)   | 6-10 HCP, 3+ support            | NF       | bridgebum   |
| 1S over 1H   | 6+ HCP, 4+ spades               | F1R      | bridgebum   |
| 2C/2D (2/1)  | 10+ HCP, 4+ in suit             | F1R      | bridgebum   |
| 1NT          | 6-10 HCP (no fit, no new suit)  | NF       | bridgebum   |
| 2NT          | 13-15 HCP, balanced             | NF       | bridgebum   |
| 3NT          | 16-18 HCP, balanced             | —        | bridgebum   |

Priority: support (raises) > new suit > NT.

#### Responding to 1C/1D (Minor)

| Bid          | Condition                        | Forcing? | Source      |
| ------------ | -------------------------------- | -------- | ----------- |
| 1H           | 6+ HCP, 4+ hearts               | F1R      | bridgebum   |
| 1S           | 6+ HCP, 4+ spades               | F1R      | bridgebum   |
| 1NT          | 6-10 HCP                        | NF       | bridgebum   |
| 2NT          | 13-15 HCP, balanced             | NF       | bridgebum   |
| 3NT          | 16-18 HCP, balanced             | —        | bridgebum   |

New suit at 1-level = forcing one round. No minor raises implemented.

## Opener Rebids

### After Jacoby Transfer (1NT — P — 2D/2H — P)

| Bid | Condition                  | Source      |
| --- | -------------------------- | ----------- |
| 2H  | After 1NT-P-2D (accept)   | bridgebum   |
| 2S  | After 1NT-P-2H (accept)   | bridgebum   |

Opener always accepts the transfer at the minimum level (no super-accept).

### After Partner Raised Our Major (1M — P — 2M — P)

| Bid   | Condition                  | Source      |
| ----- | -------------------------- | ----------- |
| 4M    | 19+ HCP (bid game)        | bridgebum   |
| 3M    | 17-18 HCP (invite)        | bridgebum   |
| Pass  | 12-16 HCP (minimum)       | bridgebum   |

### After Partner Did Not Raise

| Bid                    | Condition                                  | Source      |
| ---------------------- | ------------------------------------------ | ----------- |
| Raise partner's major  | 12-16 HCP, 4+ in partner's responded major | bridgebum   |
| Rebid own suit         | 12-17 HCP, 6+ in opened suit              | bridgebum   |
| 1NT                    | 12-14 HCP, balanced                        | bridgebum   |
| 2NT                    | 18-19 HCP, balanced                        | bridgebum   |

## Competitive Bidding

Only simple overcalls are implemented:

| Bid              | Condition                                  | Source      |
| ---------------- | ------------------------------------------ | ----------- |
| 1NT overcall     | 15-18 HCP, balanced                        | bridgebum   |
| 1-level overcall | 8-16 HCP, 5+ card suit (legally higher)    | bridgebum   |
| 2-level overcall | 10-16 HCP, 5+ card suit (legally higher)   | bridgebum   |
| Pass             | Fallback                                   | —           |

The `findBestOvercallSuit` helper picks the longest 5+ card suit that is legally biddable above the last bid.

## Key Point Ranges

| Range    | Meaning                               |
| -------- | ------------------------------------- |
| 0-7      | Pass (or 2D waiting after 2C)         |
| 5-11     | Weak two (6+ suit) or preempt (7+ suit) |
| 6-10     | Simple raise of partner's suit        |
| 8-9      | 2NT invite over 1NT                   |
| 10-12    | Limit raise (jump raise of major)     |
| 12+      | Opening bid (1-level suit)            |
| 13+      | Game raise of partner's major         |
| 15-17    | 1NT opening (balanced)                |
| 20-21    | 2NT opening (balanced)                |
| 22+      | 2C opening (strong, artificial)       |

## Edge Cases

| Edge Case                              | Resolution                                          | Rationale                                          |
| -------------------------------------- | --------------------------------------------------- | -------------------------------------------------- |
| 5-5 majors                             | Open 1S (higher-ranking)                            | SAYC standard: open higher of equal length         |
| 4-4 minors                             | Open 1D                                             | SAYC booklet convention                            |
| 3-3 minors                             | Open 1C                                             | SAYC booklet convention                            |
| 12-14 balanced, no 5M                  | Open 1m (not 1NT)                                   | 1NT requires 15-17; rebid 1NT shows 12-14          |
| Transfer vs Stayman (5M + 4M)          | Transfer wins (checked first)                       | Implementation priority order                      |
| 2/1 response (e.g. 1H-2C)             | 10+ HCP, 4+ suit                                   | Simplified — some treatments require 12+/GF        |
| 1-level overcall                       | 8+ HCP, 5+ suit                                    | Simplified — expert practice often looser          |

## Simplifications

### Conventions Not Implemented

- No Blackwood (4NT ace-asking) or Gerber (4C ace-asking over NT)
- No negative doubles (only simple overcalls in competitive)
- No takeout doubles by either side
- No Michaels cue bids or Unusual 2NT
- No fourth-suit forcing
- No jump shifts (only simple new-suit responses)
- No slam bidding infrastructure
- No SOS redoubles

### Bidding Logic Gaps

- No minor suit raises in response to 1C/1D (only new-suit and NT responses)
- No responder rebids (conversation ends after opener's rebid in most sequences)
- No opener rebid after 2/1 response (limited rebid coverage)
- No game-try sequences beyond simple raise re-raises
- No super-accept of Jacoby transfers (opener always bids minimum)
- No reverse bids or jump rebids by opener
- No 3-level preempt responses (e.g., 3NT over partner's 3-level preempt)
- No Stayman follow-ups after 2C response to 1NT (Stayman is a separate convention module)

### System Gaps

- No interference/overlay handling — convention has no overlays
- Empty explanations — no teaching metadata authored yet
- Empty resolvers — all bids use `defaultCall` (deterministic, no dialogue-state-dependent resolution)
- No transition rules for 2NT opening, weak twos, or 3-level preempts (transitions only detect 1NT, 1-level suit, and 2C openings)
