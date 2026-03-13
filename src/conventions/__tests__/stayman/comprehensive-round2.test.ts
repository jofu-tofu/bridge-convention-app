/**
 * Comprehensive Round 2 tests: Opener's response after Stayman 2C ask
 * when opponents interfere.
 *
 * All tests are skipped (test.skip) — they document the desired behavior
 * for interference handling in the Stayman opener-response round. Each test
 * includes bridge theory, implementation requirements, and inference notes.
 *
 * Auction context: 1NT-P-2C-(interference), opener's turn.
 * Opener = North (dealer), Responder = South.
 */

import { describe, test, expect, beforeEach } from "vitest";
import { Seat, BidSuit } from "../../../engine/types";
import type { Hand } from "../../../engine/types";
// eslint-disable-next-line unused-imports/no-unused-imports
import { policyDescribe } from "../../../test-support/tiers";
import { registerConvention, clearRegistry } from "../../core/registry";
import { staymanConfig } from "../../definitions/stayman";
import { hand, makeBiddingContext } from "../fixtures";
import { conventionToStrategy } from "../../../strategy/bidding/convention-strategy";

beforeEach(() => {
  clearRegistry();
  registerConvention(staymanConfig);
});

interface SuggestOptions {
  dealer?: Seat;
  opponentConventionIds?: readonly string[];
}

function suggestCall(h: Hand, seat: Seat, bids: string[], opts?: SuggestOptions) {
  const ctx = makeBiddingContext(h, seat, bids, opts?.dealer ?? Seat.North, opts?.opponentConventionIds);
  return conventionToStrategy(staymanConfig).suggest(ctx);
}

// ─── Opener test hands (Round 2) ─────────────────────────
// Opener responded after 1NT-P-2C-(interference)

// Opener with 4 hearts: 16 HCP, 4H + 3S balanced
// SA(4) + SK(3) + HK(3) + HQ(2) + DK(3) + CJ(1) = 16 HCP
const openerWith4H = () =>
  hand("SA", "SK", "S3", "HK", "HQ", "H5", "H3", "DK", "D5", "D3", "CJ", "C5", "C2");

// Opener with 4 spades: 16 HCP, 4S + 3H balanced
// SA(4) + SK(3) + SQ(2) + HK(3) + DK(3) + CJ(1) = 16 HCP
const openerWith4S = () =>
  hand("SA", "SK", "SQ", "S5", "HK", "H5", "H3", "DK", "D5", "D3", "CJ", "C5", "C2");

// Opener with both majors: 17 HCP, 4S + 4H
// SA(4) + SK(3) + HK(3) + HQ(2) + DA(4) + CJ(1) = 17 HCP
const openerWithBothMajors = () =>
  hand("SA", "SK", "S5", "S3", "HK", "HQ", "H5", "H3", "DA", "D5", "D3", "CJ", "C2");

// Opener no major: 16 HCP, 3S + 3H + 4D + 3C balanced
// SA(4) + HK(3) + DA(4) + DK(3) + CQ(2) = 16 HCP
const openerNoMajor = () =>
  hand("SA", "S5", "S3", "HK", "H5", "H3", "DA", "DK", "D5", "D3", "CQ", "C5", "C2");

// Strong opener: 18 HCP, 4H + 4D
// SA(4) + HA(4) + HK(3) + HQ(2) + DA(4) + DJ(1) = 18 HCP
const strongOpener18 = () =>
  hand("SA", "S5", "S3", "HA", "HK", "HQ", "H3", "DA", "DJ", "D5", "C5", "C3", "C2");

// ─── Round 2: opponent doubles the 2C Stayman ask ─────────

policyDescribe("[policy]", "opener response when opponent doubles Stayman ask", "Round 2: opponent doubles the 2C Stayman ask", () => {
  // Auction: 1NT-P-2C-X, opener's (North's) turn

  test.skip("after 1NT-P-2C-X: opener with 4H still bids 2H", () => {
    /**
     * BRIDGE THEORY: When opponent doubles the Stayman 2C ask, many partnerships
     * play that opener can still respond normally. The double of 2C usually shows
     * clubs, not strength, so it is safe to continue with standard responses.
     * This is the most common treatment: "system on" after the double.
     *
     * REQUIRES:
     * - Overlay on "stayman-response" round: handles doubled state
     * - matchesState: competitionMode=Doubled after the 2C ask
     * - handTree: same response structure (2H/2S/2D) as uncontested
     * - Transition rule: X after 2C sets competitionMode=Doubled, systemMode=Modified
     *
     * INFERENCE: Double of 2C by opponent shows good clubs (lead-directing).
     * Opener's response is unchanged; partner now knows about opponent's clubs.
     */
    const result = suggestCall(openerWith4H(), Seat.North, ["1NT", "P", "2C", "X"]);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Hearts });
  });

  test.skip("after 1NT-P-2C-X: opener with 4S still bids 2S", () => {
    /**
     * BRIDGE THEORY: Same principle as above. The double does not disrupt the
     * Stayman responses. Opener with four spades shows them at the 2-level
     * just as in the uncontested auction.
     *
     * REQUIRES:
     * - Same overlay as the 4H case: system-on after double
     * - Hand subtree checks spades (NO branch of hearts-first check)
     *
     * INFERENCE: Opener denies 4 hearts (hearts checked first in tree).
     */
    const result = suggestCall(openerWith4S(), Seat.North, ["1NT", "P", "2C", "X"]);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Spades });
  });

  test.skip("after 1NT-P-2C-X: opener with both majors bids 2H (hearts first)", () => {
    /**
     * BRIDGE THEORY: With both four-card majors, opener shows hearts first.
     * This is tree priority order — the hand decision checks hearts before spades.
     * The double does not change this ordering convention.
     *
     * REQUIRES:
     * - Same overlay with system-on behavior
     * - Tree structure: hearts checked before spades (same as uncontested)
     *
     * INFERENCE: Opener shows 4+ hearts. Responder who also has 4 hearts
     * can raise; with only 4 spades, responder asks further or bids NT.
     */
    const result = suggestCall(openerWithBothMajors(), Seat.North, ["1NT", "P", "2C", "X"]);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Hearts });
  });

  test.skip("after 1NT-P-2C-X: opener with no major bids 2D denial", () => {
    /**
     * BRIDGE THEORY: Without a four-card major, opener bids the standard 2D
     * denial response. The opponent's double of 2C does not change this —
     * responder still needs the denial to continue the Stayman sequence.
     *
     * REQUIRES:
     * - Same overlay: system-on after double of 2C
     * - Fallthrough to 2D when no 4-card major found
     *
     * INFERENCE: Opener denies both 4-card majors. Responder now chooses
     * between NT, Smolen, or invitational actions.
     */
    const result = suggestCall(openerNoMajor(), Seat.North, ["1NT", "P", "2C", "X"]);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Diamonds });
  });

  test.skip("[PARTNERSHIP-DEPENDENT] after 1NT-P-2C-X: pass = no major, XX = both majors", () => {
    /**
     * BRIDGE THEORY: An alternative partnership agreement after the double of 2C:
     * - Pass = no four-card major (replaces 2D denial)
     * - Redouble = both four-card majors
     * - 2H/2S = single four-card major (unchanged)
     * This uses the double for informational advantage. Some experts prefer this
     * because pass saves bidding space and redouble is otherwise unused.
     *
     * REQUIRES:
     * - Alternative overlay with different hand subtree
     * - Pass node instead of 2D denial node
     * - Redouble node for both-majors case
     * - Partnership agreement selector (future: difficulty/agreement config)
     *
     * INFERENCE: More granular information than standard treatment.
     * [PARTNERSHIP-DEPENDENT] — not all partnerships play this way.
     */
    const result = suggestCall(openerWithBothMajors(), Seat.North, ["1NT", "P", "2C", "X"]);
    expect(result).not.toBeNull();
    // Under the alternative agreement, both majors → redouble
    expect(result!.call.type).toBe("redouble");
  });

  test.skip("after 1NT-P-2C-X: strong opener (18 HCP) redoubles to show extras", () => {
    /**
     * BRIDGE THEORY: Some partnerships play that a redouble by opener after
     * 1NT-P-2C-X shows maximum NT range (17-18 HCP) regardless of major
     * holding. This is a strength-showing bid rather than a shape-showing bid.
     * Less common than system-on, but documented in advanced treatments.
     *
     * REQUIRES:
     * - Additional overlay branch for maximum hands
     * - HCP threshold check (17+ or 18+ depending on agreement)
     * - Redouble intent node with "shows maximum NT" meaning
     *
     * INFERENCE: Partner knows opener is at top of 15-17 range.
     * [PARTNERSHIP-DEPENDENT] — conflicts with "XX = both majors" treatment.
     */
    const result = suggestCall(strongOpener18(), Seat.North, ["1NT", "P", "2C", "X"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("redouble");
  });
});

// ─── Round 2: opponent overcalls 2D after 2C ask ──────────

policyDescribe("[policy]", "opener response after 2D overcall of Stayman ask", "Round 2: opponent overcalls 2D after 2C ask", () => {
  // Auction: 1NT-P-2C-2D, opener's turn

  test.skip("after 1NT-P-2C-2D: opener with 4H free bids 2H", () => {
    /**
     * BRIDGE THEORY: When opponent overcalls 2D, the 2H and 2S bids are still
     * available at the same level. Opener can "free bid" to show a four-card
     * major. A free bid in competition is voluntary and shows genuine values
     * plus the suit — here the values are already known (NT opener), so it
     * simply shows the major.
     *
     * REQUIRES:
     * - Overlay on "stayman-response" round for 2D overcall
     * - matchesState: competitionMode after 2D overcall, system still partially on
     * - Hand subtree: 2H/2S available, but 2D denial is stolen
     *
     * INFERENCE: Opener has 4+ hearts. The 2D denial is unavailable since
     * opponent bid 2D, so passing implicitly denies both majors.
     */
    const result = suggestCall(openerWith4H(), Seat.North, ["1NT", "P", "2C", "2D"]);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Hearts });
  });

  test.skip("after 1NT-P-2C-2D: opener with 4S free bids 2S", () => {
    /**
     * BRIDGE THEORY: Same as above — 2S is still available at the same level
     * despite the 2D overcall. Opener shows four spades.
     *
     * REQUIRES:
     * - Same overlay as the 4H case
     * - Tree checks hearts first, then spades (same priority as uncontested)
     *
     * INFERENCE: Opener denies 4 hearts (checked first), shows 4+ spades.
     */
    const result = suggestCall(openerWith4S(), Seat.North, ["1NT", "P", "2C", "2D"]);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Spades });
  });

  test.skip("after 1NT-P-2C-2D: opener with no major passes (2D denial stolen)", () => {
    /**
     * BRIDGE THEORY: The standard 2D denial is no longer available because
     * opponent has bid 2D. Opener cannot rebid 2D as a denial — that would
     * be interpreted as a cue bid or raise. Instead, opener passes to deny
     * both four-card majors. Responder understands the pass as "no major"
     * in this context.
     *
     * REQUIRES:
     * - Overlay: when 2D overcalled and no 4-card major, pass
     * - Pass intent node with meaning "Denies 4-card major (2D denial stolen)"
     * - Responder must understand pass = no major in this auction
     *
     * INFERENCE: Opener denies both four-card majors. Responder proceeds
     * as if opener had bid 2D denial — bids NT, Smolen, or invites.
     */
    const result = suggestCall(openerNoMajor(), Seat.North, ["1NT", "P", "2C", "2D"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("pass");
  });

  test.skip("after 1NT-P-2C-2D: opener with both majors free bids 2H", () => {
    /**
     * BRIDGE THEORY: With both four-card majors available and 2H/2S still at
     * the same level, opener shows hearts first (same tree priority as
     * uncontested). The free bid costs nothing extra and the Stayman
     * continuation still works normally.
     *
     * REQUIRES:
     * - Same overlay: free bids available
     * - Hearts-first priority unchanged
     *
     * INFERENCE: Opener shows 4+ hearts. May also have 4 spades — responder
     * can ask further if needed.
     */
    const result = suggestCall(openerWithBothMajors(), Seat.North, ["1NT", "P", "2C", "2D"]);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Hearts });
  });

  test.skip("after 1NT-P-2C-2D: opener doubles with extras and diamond stopper", () => {
    /**
     * BRIDGE THEORY: A double of the overcall by opener is penalty-oriented.
     * Opener has opened 1NT, so partner already knows the hand type. Doubling
     * 2D says "I have diamonds well stopped and extras — let's penalize them."
     * This is attractive with a strong holding in the overcalled suit.
     *
     * REQUIRES:
     * - Overlay branch: double when 17+ HCP and diamond length/stopper
     * - Diamond stopper condition (e.g., Dx or better in diamonds)
     * - HCP threshold for penalty double (17+ typical)
     *
     * INFERENCE: Opener has extras (17+) and diamond strength. Partner can
     * pass for penalty or pull with a distributional hand.
     * [PARTNERSHIP-DEPENDENT] — some play double as "card-showing" not penalty.
     */
    const result = suggestCall(strongOpener18(), Seat.North, ["1NT", "P", "2C", "2D"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("double");
  });
});

// ─── Round 2: opponent overcalls 2H after 2C ask ──────────

policyDescribe("[policy]", "opener response after 2H overcall of Stayman ask", "Round 2: opponent overcalls 2H after 2C ask", () => {
  // Auction: 1NT-P-2C-2H, opener's turn

  test.skip("after 1NT-P-2C-2H: opener with 4S bids 2S (still available)", () => {
    /**
     * BRIDGE THEORY: When opponent overcalls 2H, the 2S bid is still available
     * at the 2-level. Opener with four spades can show them cheaply. The heart
     * response is stolen, but spades are unaffected at this level.
     *
     * REQUIRES:
     * - Overlay for 2H overcall: 2S still available, hearts stolen
     * - Hand subtree: spade check proceeds normally
     * - No 2H or 2D response available (both stolen/blocked)
     *
     * INFERENCE: Opener shows 4+ spades. Heart holding is unknown — opener
     * could not bid 2H even with four hearts since opponent took that bid.
     */
    const result = suggestCall(openerWith4S(), Seat.North, ["1NT", "P", "2C", "2H"]);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Spades });
  });

  test.skip("after 1NT-P-2C-2H: opener with 4H passes (bid stolen)", () => {
    /**
     * BRIDGE THEORY: Opener wanted to bid 2H to show four hearts, but
     * opponent has taken that bid. Opener cannot bid 2H (it would raise
     * opponent). Without four spades to show, opener must pass. The pass
     * is ambiguous — it could mean no major OR hearts that cannot be shown.
     *
     * REQUIRES:
     * - Overlay: pass when hearts stolen and no spades to show
     * - Pass intent with meaning "Cannot show hearts (bid stolen)"
     * - Responder needs to handle this ambiguity in Round 3
     *
     * INFERENCE: Opener may have 4 hearts but cannot show them. Responder
     * cannot distinguish "no major" from "hearts stolen" by pass alone.
     */
    const result = suggestCall(openerWith4H(), Seat.North, ["1NT", "P", "2C", "2H"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("pass");
  });

  test.skip("after 1NT-P-2C-2H: opener with no major passes", () => {
    /**
     * BRIDGE THEORY: Without any four-card major, opener passes. This is
     * the natural action — there is nothing to show. The 2D denial is not
     * available (opponent bid 2H, so 2D would be a new bid below the
     * overcall level, which is unusual in this context — most play pass).
     *
     * REQUIRES:
     * - Same overlay pass behavior as hearts-stolen case
     * - No distinction needed from opener's side (both pass)
     *
     * INFERENCE: Opener has no four-card major OR has hearts but cannot
     * show them. Ambiguity is inherent in this competitive auction.
     */
    const result = suggestCall(openerNoMajor(), Seat.North, ["1NT", "P", "2C", "2H"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("pass");
  });

  test.skip("after 1NT-P-2C-2H: opener doubles for penalty with 4+ hearts", () => {
    /**
     * BRIDGE THEORY: When opponent overcalls in a suit opener holds well,
     * a penalty double is attractive. Opener has 1NT strength and four+
     * hearts — exactly the suit opponent bid. The double says "I wanted
     * to bid 2H myself and I have them well held for defense."
     *
     * REQUIRES:
     * - Overlay branch: double with 4+ hearts when 2H overcalled
     * - Heart length/quality condition (4+ hearts with honors)
     * - This is a penalty double, not takeout
     *
     * INFERENCE: Opener has 4+ hearts with defensive strength in hearts.
     * Partner should pass unless very distributional.
     * [PARTNERSHIP-DEPENDENT] — some play this as "stolen bid" showing hearts.
     */
    const result = suggestCall(openerWith4H(), Seat.North, ["1NT", "P", "2C", "2H"]);
    // Under penalty-double agreement, opener doubles with heart stack
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("double");
  });
});

// ─── Round 2: opponent overcalls 2S after 2C ask ──────────

policyDescribe("[policy]", "opener response after 2S overcall of Stayman ask", "Round 2: opponent overcalls 2S after 2C ask", () => {
  // Auction: 1NT-P-2C-2S, opener's turn

  test.skip("after 1NT-P-2C-2S: opener with 4H and 17+ bids 3H (extras required)", () => {
    /**
     * BRIDGE THEORY: When opponent overcalls 2S, showing a major requires
     * going to the 3-level (3H). This is a significant escalation from the
     * planned 2-level response. Only acceptable with extra values (17+ HCP
     * within the 15-17 NT range) because the partnership is being pushed a
     * level higher. The 3-level commitment needs extras to justify the risk.
     *
     * REQUIRES:
     * - Overlay for 2S overcall: 3-level responses only with extras
     * - HCP threshold: 17+ to compete at 3-level
     * - 3H intent node with meaning "Shows 4+ hearts with extras"
     * - Opener must have genuine extras, not just a minimum NT
     *
     * INFERENCE: Opener has 4+ hearts AND maximum/near-maximum NT hand.
     * Partner can raise with confidence knowing opener has extras.
     */
    const result = suggestCall(strongOpener18(), Seat.North, ["1NT", "P", "2C", "2S"]);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 3, strain: BidSuit.Hearts });
  });

  test.skip("after 1NT-P-2C-2S: opener with 4H minimum (16 HCP) passes", () => {
    /**
     * BRIDGE THEORY: With a minimum 1NT (15-16 HCP) and four hearts, opener
     * cannot afford to compete at the 3-level. Bidding 3H with a minimum
     * risks playing at too high a level if responder has only invitational
     * values. The pass is disciplined — opener preserves the option for
     * responder to act (double, 3H, or pass).
     *
     * REQUIRES:
     * - Overlay: pass with minimum (15-16 HCP) when forced to 3-level
     * - HCP ceiling check: below 17, pass even with a major
     * - Responder must handle this in Round 3 (can double or bid)
     *
     * INFERENCE: Opener's pass is ambiguous — could have hearts but not
     * enough strength to compete. Responder should not assume denial.
     */
    const result = suggestCall(openerWith4H(), Seat.North, ["1NT", "P", "2C", "2S"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("pass");
  });

  test.skip("after 1NT-P-2C-2S: opener with no major passes", () => {
    /**
     * BRIDGE THEORY: Without a four-card major and opponents at 2S, there is
     * nothing to show. Passing is automatic. Any action at the 3-level would
     * promise more than opener has to offer.
     *
     * REQUIRES:
     * - Same overlay pass path as the minimum-with-major case
     * - No need to distinguish "no major" from "minimum with major" from
     *   opener's perspective — both pass
     *
     * INFERENCE: Opener has no four-card major OR has hearts with minimum
     * values. Ambiguity is acceptable; responder decides next action.
     */
    const result = suggestCall(openerNoMajor(), Seat.North, ["1NT", "P", "2C", "2S"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("pass");
  });

  test.skip("after 1NT-P-2C-2S: opener doubles for penalty with spade stack", () => {
    /**
     * BRIDGE THEORY: With four+ spades well held (the suit opponent bid),
     * opener can double for penalty. Opener has NT values and spade length
     * behind the overcaller — ideal for a penalty double. The partnership
     * was looking for a major fit, and opponent helpfully bid opener's best
     * suit.
     *
     * REQUIRES:
     * - Overlay branch: double with 4+ spades when 2S overcalled
     * - Spade length/quality condition (4+ spades, good honors)
     * - Penalty double intent node
     *
     * INFERENCE: Opener has 4+ spades with defensive values. Partner
     * should pass for penalty in most cases.
     * [PARTNERSHIP-DEPENDENT] — some play double as showing spades (stolen bid).
     */
    const result = suggestCall(openerWith4S(), Seat.North, ["1NT", "P", "2C", "2S"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("double");
  });

  test.skip("after 1NT-P-2C-2S: opener with both majors and extras bids 3H", () => {
    /**
     * BRIDGE THEORY: With both four-card majors and extras (17+ HCP), opener
     * bids 3H. Hearts are shown first per standard tree priority, same as
     * uncontested. The extras justify competing at the 3-level. If responder
     * does not have hearts, responder can still bid 3NT or explore further.
     *
     * REQUIRES:
     * - Same overlay branch as single-major-with-extras case
     * - Hearts-first priority preserved at 3-level
     * - 17+ HCP threshold
     *
     * INFERENCE: Opener has 4+ hearts and maximum values. May also have
     * 4 spades (cannot show both at 3-level without bidding twice).
     */
    const result = suggestCall(openerWithBothMajors(), Seat.North, ["1NT", "P", "2C", "2S"]);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 3, strain: BidSuit.Hearts });
  });
});

// ─── Round 2: opponent convention informs opener response ──

policyDescribe("[policy]", "opponent convention identification adjusts opener response", "Round 2: opponent convention informs opener response", () => {
  test.skip("1NT-P-2C-2H(DONT): opener with 4S free bids 2S (DONT = hearts+minor, spades safe)", () => {
    /**
     * BRIDGE THEORY: When opponent's 2H overcall is DONT (hearts + a minor),
     * opener with 4 spades should still show them. The DONT bid means opponent
     * has hearts but may be lighter than a natural overcall. Spades are safe
     * to bid at the 2-level.
     *
     * REQUIRES:
     * - opponentConventionIds: ["dont"] on the BiddingContext
     * - Inference: DONT 2H = 5+ hearts + 4+ minor
     * - Opener still shows spades (unaffected by DONT)
     *
     * INFERENCE: DONT overcaller has hearts + minor, our spades are uncontested.
     */
    const result = suggestCall(
      // Opener: 16 HCP, 4S + 3H balanced
      hand("SA", "SK", "SQ", "S5", "HK", "H5", "H3", "DK", "D5", "D3", "CJ", "C5", "C2"),
      Seat.North, ["1NT", "P", "2C", "2H"],
      { opponentConventionIds: ["dont"] },
    );
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Spades });
  });

  test.skip("1NT-P-2C-2H(DONT): opener with 4H doubles for penalty (they bid our suit)", () => {
    /**
     * BRIDGE THEORY: When DONT opponent bids 2H and opener has 4+ hearts,
     * a penalty double is very attractive. DONT 2H shows only 5 hearts
     * (lighter than natural), and we have heart length behind them. The
     * penalty double says "I have your suit well held."
     *
     * REQUIRES:
     * - DONT 2H inference: only 5 hearts (lighter than natural)
     * - Penalty double more attractive vs 5-card suit than 6-card
     * - Opener's hearts are behind the DONT bidder (positional advantage)
     *
     * INFERENCE: DONT 2H = 5 hearts. Our 4H behind them = strong defense.
     */
    const result = suggestCall(
      // Opener: 16 HCP, 4H + 3S balanced
      hand("SA", "SK", "S3", "HK", "HQ", "H5", "H3", "DK", "D5", "D3", "CJ", "C5", "C2"),
      Seat.North, ["1NT", "P", "2C", "2H"],
      { opponentConventionIds: ["dont"] },
    );
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("double");
  });

  test.skip("1NT-P-2C-2D(natural): opener with no major passes (natural 2D stole denial)", () => {
    /**
     * BRIDGE THEORY: When opponent's 2D overcall is natural (6+ diamonds),
     * the standard 2D denial is stolen. Opener with no four-card major must
     * pass. The natural overcall means opponent has real diamond length.
     *
     * REQUIRES:
     * - opponentConventionIds: [] → natural bidding
     * - Natural 2D = 6+ diamonds
     * - Pass when denial bid is stolen and no major to show
     *
     * INFERENCE: Natural 2D = 6+ diamonds. Pass = no 4-card major.
     */
    const result = suggestCall(
      // Opener: 16 HCP, no 4-card major
      hand("SA", "S5", "S3", "HK", "H5", "H3", "DA", "DK", "D5", "D3", "CQ", "C5", "C2"),
      Seat.North, ["1NT", "P", "2C", "2D"],
      { opponentConventionIds: [] },
    );
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("pass");
  });

  test.skip("1NT-P-2C-2D(natural): opener with 4H free bids 2H (space available)", () => {
    /**
     * BRIDGE THEORY: Despite the 2D overcall, 2H is still available at the
     * same level. Opener with 4 hearts can show them as a free bid. Natural
     * 2D doesn't affect the heart or spade responses.
     *
     * REQUIRES:
     * - 2H free bid still available after 2D overcall
     * - Natural overcall doesn't block major responses
     *
     * INFERENCE: Free bid 2H = 4+ hearts, voluntary action.
     */
    const result = suggestCall(
      // Opener: 16 HCP, 4H balanced
      hand("SA", "SK", "S3", "HK", "HQ", "H5", "H3", "DK", "D5", "D3", "CJ", "C5", "C2"),
      Seat.North, ["1NT", "P", "2C", "2D"],
      { opponentConventionIds: [] },
    );
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Hearts });
  });
});
