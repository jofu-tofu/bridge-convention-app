/**
 * Comprehensive Round 3 tests for Stayman convention.
 *
 * Round 3 = responder's rebid after opener's response (2D/2H/2S),
 * with opponent interference at each stage.
 *
 * All tests are test.skip() — these document expected behavior for
 * future implementation of contested Round 3 handling.
 */

import { describe, test, expect, beforeEach } from "vitest";
import { Seat, BidSuit } from "../../../engine/types";
import type { ContractBid, Hand } from "../../../engine/types";
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

// ─── Responder test hands (Round 3) ──────────────────────
// Responder rebids after opener's response with interference

// GF with heart fit: 12 HCP, 4S + 4H
// SA(4) + HK(3) + HQ(2) + DK(3) = 12 HCP
const gfHeartFit = () =>
  hand("SA", "S7", "S5", "S3", "HK", "HQ", "H5", "H3", "DK", "D5", "D3", "C5", "C2");

// GF no heart fit: 11 HCP, 4S + 3H
// SA(4) + SK(3) + DK(3) + CJ(1) = 11 HCP
const gfNoHeartFit = () =>
  hand("SA", "SK", "S7", "S3", "HQ", "H5", "H3", "DK", "D5", "D3", "CJ", "C5", "C2");

// GF with spade fit: 12 HCP, 4S + 3H
// SA(4) + SK(3) + HQ(2) + DK(3) = 12 HCP
const gfSpadeFit = () =>
  hand("SA", "SK", "S7", "S3", "HQ", "H5", "H3", "DK", "D5", "D3", "C5", "C3", "C2");

// Invite heart fit: 9 HCP, 4H + 3S
// SK(3) + HQ(2) + HJ(1) + DK(3) = 9 HCP
const inviteHeartFit = () =>
  hand("SK", "S7", "S3", "HQ", "HJ", "H5", "H3", "DK", "D5", "D3", "C5", "C3", "C2");

// Invite spade fit: 9 HCP, 4S + 3H
// SK(3) + SQ(2) + HJ(1) + DK(3) = 9 HCP
const inviteSpadeFit = () =>
  hand("SK", "SQ", "S7", "S3", "HJ", "H5", "H3", "DK", "D5", "D3", "C5", "C3", "C2");

// Strong with both majors: 14 HCP, 4S + 4H
// SK(3) + SJ(1) + HA(4) + HQ(2) + DK(3) + CJ(1) = 14 HCP
const strongBothMajors = () =>
  hand("SK", "SJ", "S8", "S4", "HA", "HQ", "H9", "H3", "DK", "D5", "CJ", "C7", "C2");

// Weak minimum: 8 HCP, 4H + 4S (barely in range for Stayman)
// SK(3) + HQ(2) + HJ(1) + DQ(2) = 8 HCP
const weakMinimum = () =>
  hand("SK", "S7", "S5", "S3", "HQ", "HJ", "H5", "H3", "DQ", "D5", "D3", "C5", "C2");

// Smolen hand: 12 HCP, 5H + 4S (after 2D denial: bids 3H Smolen)
// SA(4) + HK(3) + HQ(2) + DK(3) = 12 HCP
const smolenHearts = () =>
  hand("SA", "S7", "S5", "S3", "HK", "HQ", "H7", "H5", "H3", "DK", "D3", "C5", "C2");

// GF balanced no fit: 12 HCP, 4S + 2H (no heart fit after 2H response)
// SA(4) + SK(3) + DK(3) + CQ(2) = 12 HCP
const gfBalancedNoFit = () =>
  hand("SA", "SK", "S7", "S3", "H5", "H3", "DK", "D7", "D5", "D3", "CQ", "C5", "C2");

// ─── Round 3 after 2H response: opponent overcalls ───────

describe("Round 3 after 2H response: opponent overcalls", () => {
  test.skip("after 2H-2S(opp): GF with heart fit raises to 4H (free raise to game)", () => {
    /**
     * BRIDGE THEORY: When opener shows 4 hearts via 2H and responder has
     * 4-card heart support with GF values, the fit is confirmed. An opponent's
     * 2S overcall doesn't change the fit — responder should bid game in hearts.
     * A free raise in competition shows genuine values (not competitive noise).
     *
     * REQUIRES: Round 3 overlay for "2H overcalled at 2S" that still allows
     * responder to show heart fit at the 4-level with GF values.
     *
     * INFERENCE: Responder's 4H in competition = 4+ hearts, 10+ HCP (GF).
     * [PARTNERSHIP-DEPENDENT] — some partnerships might use 3H as forcing here.
     */
    const result = suggestCall(gfHeartFit(), Seat.South, ["1NT", "P", "2C", "P", "2H", "2S"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test.skip("after 2H-2S(opp): invite with heart fit competes with 3H", () => {
    /**
     * BRIDGE THEORY: With invitational values (8-9 HCP) and a heart fit,
     * responder can compete at 3H. This is competitive — not forcing.
     * The 2S overcall pushed the level up but responder has enough to compete.
     *
     * REQUIRES: Round 3 contested overlay recognizing 3H as competitive raise
     * with invitational values after opponent's 2S overcall.
     *
     * INFERENCE: 3H over opponent's 2S = 4+ hearts, 8-9 HCP (invitational).
     */
    const result = suggestCall(inviteHeartFit(), Seat.South, ["1NT", "P", "2C", "P", "2H", "2S"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test.skip("after 2H-2S(opp): GF no heart fit bids 3NT (natural game)", () => {
    /**
     * BRIDGE THEORY: When opener showed hearts but responder has only 3 hearts
     * (no fit) with GF values, 3NT is the natural landing spot. The opponent's
     * 2S overcall doesn't change the no-fit conclusion — responder still wants
     * to play 3NT with stoppers implied by GF values.
     *
     * REQUIRES: Round 3 contested overlay for "no fit + GF after 2H overcalled."
     *
     * INFERENCE: 3NT in competition = no heart fit, 10+ HCP, likely spade stopper.
     */
    const result = suggestCall(gfNoHeartFit(), Seat.South, ["1NT", "P", "2C", "P", "2H", "2S"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.NoTrump);
  });

  test.skip("after 2H-2S(opp): weak minimum passes (can't compete at 3-level)", () => {
    /**
     * BRIDGE THEORY: With only 8 HCP and no strong fit, responder cannot
     * safely compete at the 3-level. Passing lets opener decide. The hand
     * is too weak to volunteer at an elevated level.
     *
     * REQUIRES: Round 3 contested overlay where weak hands pass after overcall.
     *
     * INFERENCE: Pass after opponent's overcall = too weak to compete, <10 HCP
     * without compensating distribution.
     */
    const result = suggestCall(weakMinimum(), Seat.South, ["1NT", "P", "2C", "P", "2H", "2S"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("pass");
  });

  test.skip("after 2H-3C(opp): strong with heart fit bids 4H game", () => {
    /**
     * BRIDGE THEORY: Opponent's 3C overcall pushes the auction higher, but
     * with strong values (14 HCP) and a confirmed heart fit, responder should
     * bid game directly. The 3-level overcall actually makes the decision
     * easier — there's no room for invitational sequences.
     *
     * REQUIRES: Round 3 overlay handling overcalls at the 3-level after 2H.
     *
     * INFERENCE: 4H over 3C = 4+ hearts, strong hand, forcing to game.
     */
    const result = suggestCall(strongBothMajors(), Seat.South, ["1NT", "P", "2C", "P", "2H", "3C"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test.skip("after 2H-3C(opp): invite hand passes (3-level too high)", () => {
    /**
     * BRIDGE THEORY: When the opponent overcalls at the 3-level and responder
     * only has invitational values (9 HCP), competing is dangerous. 3H would
     * be at the 3-level with marginal values — better to pass and let opener
     * decide with their known 15-17 HCP.
     *
     * REQUIRES: Round 3 contested overlay recognizing that invite hands cannot
     * safely compete at the 3-level after a 3C overcall.
     *
     * INFERENCE: Pass over 3C with invite = 8-9 HCP, not enough to compete.
     */
    const result = suggestCall(inviteHeartFit(), Seat.South, ["1NT", "P", "2C", "P", "2H", "3C"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("pass");
  });

  test.skip("after 2H-3D(opp): strong hand doubles for penalty", () => {
    /**
     * BRIDGE THEORY: With 14 HCP opposite opener's 15-17, the partnership
     * has 29-31 HCP. When the opponent overcalls 3D, a penalty double is
     * attractive — the combined strength should defeat 3D easily. This is
     * a classic "strength double" in a known-fit auction.
     *
     * REQUIRES: Round 3 contested overlay where strong hands can penalize
     * opponent overcalls when combined strength is overwhelming.
     *
     * INFERENCE: Double of 3D = penalty-oriented, 12+ HCP, defensive values.
     * [PARTNERSHIP-DEPENDENT] — some play this as competitive/takeout.
     */
    const result = suggestCall(strongBothMajors(), Seat.South, ["1NT", "P", "2C", "P", "2H", "3D"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("double");
  });
});

// ─── Round 3 after 2H response: opponent doubles ─────────

describe("Round 3 after 2H response: opponent doubles", () => {
  test.skip("after 2H-X(opp): GF with heart fit redoubles (support redouble)", () => {
    /**
     * BRIDGE THEORY: When opener's 2H is doubled, a redouble by responder
     * shows a strong hand (10+) with heart support. This is the "support
     * redouble" convention — it distinguishes real heart fit from competitive
     * passes. Tells opener the hand is strong enough for game if hearts play.
     *
     * REQUIRES: Round 3 overlay for "2H doubled" — support redouble with GF
     * values and confirmed heart fit.
     *
     * INFERENCE: XX after 2H-X = 4+ hearts, 10+ HCP, genuine support.
     * [PARTNERSHIP-DEPENDENT] — support redouble is not universal.
     */
    const result = suggestCall(gfHeartFit(), Seat.South, ["1NT", "P", "2C", "P", "2H", "X"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("redouble");
  });

  test.skip("after 2H-X(opp): strong no heart fit bids 2NT (GF, no fit)", () => {
    /**
     * BRIDGE THEORY: After 2H is doubled, responder with GF values but no
     * heart fit (only 2 hearts) should bid 2NT to show strength without
     * heart support. This clarifies for opener that game is likely but not
     * in hearts — 3NT is the target.
     *
     * REQUIRES: Round 3 overlay for "2H doubled" with no-fit GF branch
     * leading to 2NT natural.
     *
     * INFERENCE: 2NT over double = 10+ HCP, fewer than 4 hearts, stopper implied.
     */
    const result = suggestCall(gfBalancedNoFit(), Seat.South, ["1NT", "P", "2C", "P", "2H", "X"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.NoTrump);
  });

  test.skip("after 2H-X(opp): invite with heart fit bids 3H (competitive)", () => {
    /**
     * BRIDGE THEORY: With invitational values and heart support after the
     * double, 3H shows a competitive raise with real values. This is
     * stronger than a simple 2H raise (which would just be competing)
     * but not as strong as a redouble.
     *
     * REQUIRES: Round 3 overlay for "2H doubled" with invite + fit branch.
     *
     * INFERENCE: 3H over double = 4+ hearts, 8-9 HCP (invitational with fit).
     */
    const result = suggestCall(inviteHeartFit(), Seat.South, ["1NT", "P", "2C", "P", "2H", "X"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test.skip("after 2H-X(opp): weak hand passes (no values to compete)", () => {
    /**
     * BRIDGE THEORY: With only 8 HCP and marginal values, responder should
     * pass the double. Opener can redouble if strong, or the partnership
     * can play 2H doubled if that's where they land. No reason to escalate
     * with a minimum hand.
     *
     * REQUIRES: Round 3 overlay for "2H doubled" with weak pass branch.
     *
     * INFERENCE: Pass of double = less than invitational, 8 HCP or fewer.
     */
    const result = suggestCall(weakMinimum(), Seat.South, ["1NT", "P", "2C", "P", "2H", "X"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("pass");
  });
});

// ─── Round 3 after 2S response: opponent overcalls ───────

describe("Round 3 after 2S response: opponent overcalls", () => {
  test.skip("after 2S-3C(opp): GF with spade fit bids 4S (jump to game)", () => {
    /**
     * BRIDGE THEORY: Opener showed 4 spades via 2S, responder has 4 spades
     * and GF values (12 HCP). The 3C overcall takes away bidding space but
     * with a confirmed fit and game-forcing values, bid game directly.
     *
     * REQUIRES: Round 3 overlay for "2S overcalled at 3C" with spade fit GF.
     *
     * INFERENCE: 4S over 3C = 4+ spades, 10+ HCP (GF with confirmed fit).
     */
    const result = suggestCall(gfSpadeFit(), Seat.South, ["1NT", "P", "2C", "P", "2S", "3C"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test.skip("after 2S-3C(opp): invite with spade fit passes (3-level risky)", () => {
    /**
     * BRIDGE THEORY: With invitational values (9 HCP) and a spade fit, the
     * 3C overcall makes it dangerous to bid 3S — it's at the 3-level with
     * only invitational values. Better to pass and let opener re-evaluate.
     *
     * REQUIRES: Round 3 overlay where invite hands pass 3-level overcalls.
     *
     * INFERENCE: Pass over 3C with fit = 8-9 HCP, not enough to freely bid 3S.
     */
    const result = suggestCall(inviteSpadeFit(), Seat.South, ["1NT", "P", "2C", "P", "2S", "3C"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("pass");
  });

  test.skip("after 2S-3D(opp): strong hand doubles for penalty", () => {
    /**
     * BRIDGE THEORY: With 14 HCP opposite opener's 15-17 and a known spade
     * fit, the partnership has overwhelming strength. A penalty double of 3D
     * is attractive — combined 29-31 HCP should easily defeat 3D.
     *
     * REQUIRES: Round 3 contested overlay where strong hands can penalize
     * high-level overcalls with confirmed fit.
     *
     * INFERENCE: Double of 3D = penalty, 12+ HCP, strong defensively.
     * [PARTNERSHIP-DEPENDENT] — some play as competitive/cards.
     */
    const result = suggestCall(strongBothMajors(), Seat.South, ["1NT", "P", "2C", "P", "2S", "3D"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("double");
  });

  test.skip("after 2S-3H(opp): GF with spade fit bids 4S (bypasses hearts)", () => {
    /**
     * BRIDGE THEORY: Opponent's 3H overcall steals the 3-level in hearts,
     * but responder has a confirmed spade fit with GF values. Bidding 4S
     * is clear — the spade fit was already established by opener's 2S
     * response, and game values are present.
     *
     * REQUIRES: Round 3 overlay for high-level overcalls after 2S response.
     *
     * INFERENCE: 4S over 3H = confirmed spade fit, 10+ HCP, game values.
     */
    const result = suggestCall(gfSpadeFit(), Seat.South, ["1NT", "P", "2C", "P", "2S", "3H"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test.skip("after 2S-X(opp): redouble with strong spade fit (support redouble)", () => {
    /**
     * BRIDGE THEORY: When opener's 2S is doubled, redouble with GF values
     * and a confirmed spade fit shows strength. Analogous to the support
     * redouble after 2H — confirms strong fit and warns opponents.
     *
     * REQUIRES: Round 3 overlay for "2S doubled" with support redouble.
     *
     * INFERENCE: XX after 2S-X = 4+ spades, 10+ HCP, genuine support.
     * [PARTNERSHIP-DEPENDENT] — requires support redouble agreement.
     */
    const result = suggestCall(gfSpadeFit(), Seat.South, ["1NT", "P", "2C", "P", "2S", "X"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("redouble");
  });
});

// ─── Round 3 after 2D denial: opponent overcalls ─────────

describe("Round 3 after 2D denial: opponent overcalls", () => {
  test.skip("after 2D-2H(opp): Smolen 3H ambiguous with natural 2H overcall", () => {
    /**
     * BRIDGE THEORY: After 2D denial, responder with 5H+4S GF would normally
     * bid 3H Smolen. But when opponent overcalls 2H, the meaning of 3H becomes
     * ambiguous — is it Smolen (artificial) or natural/competitive? Most
     * partnerships treat it as natural (showing hearts) since Smolen is off
     * in competition.
     *
     * REQUIRES: Round 3 overlay for "2D overcalled at 2H" that turns off
     * Smolen and reverts to natural bidding.
     *
     * INFERENCE: 3H after opponent's 2H = natural, 5+ hearts, 10+ HCP.
     * [PARTNERSHIP-DEPENDENT] — Smolen in competition is a rare agreement.
     */
    const result = suggestCall(smolenHearts(), Seat.South, ["1NT", "P", "2C", "P", "2D", "2H"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    // In competition, 3H should be natural (not Smolen)
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test.skip("after 2D-X(opp): Smolen should still work (double doesn't block bids)", () => {
    /**
     * BRIDGE THEORY: A double of 2D doesn't consume bidding space — all
     * bids at the 2- and 3-level remain available. Therefore Smolen should
     * still operate normally. The double only adds information (opponent
     * has diamond values), but doesn't prevent conventional bids.
     *
     * REQUIRES: Round 3 overlay for "2D doubled" that keeps Smolen active
     * (since no bids are blocked by the double).
     *
     * INFERENCE: 3H after 2D-X = Smolen (4S+5H, GF) — same as uncontested.
     * [PARTNERSHIP-DEPENDENT] — some turn off all conventions after any interference.
     */
    const result = suggestCall(smolenHearts(), Seat.South, ["1NT", "P", "2C", "P", "2D", "X"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test.skip("after 2D-2S(opp): GF balanced bids 3NT directly", () => {
    /**
     * BRIDGE THEORY: After 2D denial and opponent's 2S overcall, responder
     * with GF balanced values and no fit should bid 3NT directly. The 2S
     * overcall blocks 2NT (invitational) so there's no room for delicate
     * sequences — go straight to game.
     *
     * REQUIRES: Round 3 overlay for "2D overcalled at 2S" with GF no-fit path.
     *
     * INFERENCE: 3NT over 2S = 10+ HCP, no major fit, game values, spade stopper.
     */
    const result = suggestCall(gfBalancedNoFit(), Seat.South, ["1NT", "P", "2C", "P", "2D", "2S"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.NoTrump);
  });

  test.skip("after 2D-2H(opp): GF balanced bids 2NT or 3NT", () => {
    /**
     * BRIDGE THEORY: After 2D denial with GF balanced values and opponent's
     * 2H overcall, responder should bid notrump at an appropriate level.
     * 2NT remains available (opponent bid 2H, not 2NT), showing GF values
     * without a major fit. Or 3NT directly with extras.
     *
     * REQUIRES: Round 3 overlay for "2D overcalled at 2H" with NT rebids.
     *
     * INFERENCE: 2NT/3NT after 2H overcall = 10+ HCP, no major fit confirmed.
     */
    const result = suggestCall(gfBalancedNoFit(), Seat.South, ["1NT", "P", "2C", "P", "2D", "2H"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.strain).toBe(BidSuit.NoTrump);
  });

  test.skip("after 2D-2S(opp): GF with 5H bids 3H (natural, not Smolen)", () => {
    /**
     * BRIDGE THEORY: After 2D denial and opponent's 2S overcall, responder
     * with 5 hearts should bid 3H naturally. Since Smolen is typically off
     * in competition, 3H just shows a real heart suit. This is different from
     * uncontested Smolen where 3H would show 4S+5H.
     *
     * REQUIRES: Round 3 contested overlay turning off Smolen when opponents
     * overcall, reverting 3H to a natural bid showing 5+ hearts.
     *
     * INFERENCE: 3H after 2S overcall = natural, 5+ hearts, 10+ HCP.
     * [PARTNERSHIP-DEPENDENT] — Smolen off in competition is standard.
     */
    const result = suggestCall(smolenHearts(), Seat.South, ["1NT", "P", "2C", "P", "2D", "2S"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test.skip("after 2D-3C(opp): strong hand doubles for penalty", () => {
    /**
     * BRIDGE THEORY: After 2D denial with 14 HCP, opponent's 3C overcall
     * can be penalized. Combined partnership strength is 29-31 HCP, so
     * defending 3C doubled should yield a good score. No major fit was
     * found so there's no game to pursue in a suit.
     *
     * REQUIRES: Round 3 overlay for "2D overcalled at 3C" with penalty
     * double branch for strong hands.
     *
     * INFERENCE: Double of 3C = penalty, 12+ HCP, strong defensive hand.
     * [PARTNERSHIP-DEPENDENT] — some play negative/takeout doubles here.
     */
    const result = suggestCall(strongBothMajors(), Seat.South, ["1NT", "P", "2C", "P", "2D", "3C"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("double");
  });

  test.skip("after 2D-2H(opp): invite passes (can't compete safely)", () => {
    /**
     * BRIDGE THEORY: With only 9 HCP after 2D denial (no major fit found)
     * and opponent's 2H overcall, responder doesn't have enough to compete.
     * Bidding 2NT with only invite values risks going minus. Pass is the
     * disciplined action — opener can still act with a maximum.
     *
     * REQUIRES: Round 3 overlay for "2D overcalled" with pass branch for
     * invitational hands that can't safely compete.
     *
     * INFERENCE: Pass over 2H = 8-9 HCP, no fit, can't compete safely.
     */
    const result = suggestCall(inviteHeartFit(), Seat.South, ["1NT", "P", "2C", "P", "2D", "2H"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("pass");
  });
});

// ─── Round 3: delayed competition effects ────────────────

describe("Round 3: delayed competition effects", () => {
  test.skip("1NT-X-2C-P-2H-P: normal rebid despite Round 1 double", () => {
    /**
     * BRIDGE THEORY: If responder bid 2C Stayman despite the double in
     * Round 1 (showing values), and opener responded 2H normally in Round 2,
     * then Round 3 proceeds as if uncontested. The double was handled in
     * Round 1; the auction is now on track.
     *
     * REQUIRES: Protocol memory that Round 1 interference was handled and
     * subsequent rounds proceed normally when opponents pass.
     *
     * INFERENCE: Normal rebid = Round 1 interference resolved, standard logic.
     */
    const result = suggestCall(gfHeartFit(), Seat.South, ["1NT", "X", "2C", "P", "2H", "P"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    // With 12 HCP and 4 hearts, should raise to 4H (GF with fit)
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test.skip("1NT-X-XX-P-P-P: penalty passed out (no Round 3 needed)", () => {
    /**
     * BRIDGE THEORY: After 1NT-X-XX, if everyone passes, the contract is
     * 1NT redoubled. There is no Round 3 because the Stayman convention
     * was abandoned in favor of a penalty action. This is a terminal
     * sequence — the auction is complete.
     *
     * REQUIRES: Protocol recognizes that XX terminates the Stayman sequence;
     * no further rounds should activate.
     *
     * INFERENCE: Redouble = penalty-oriented, expects to make 1NT.
     */
    const result = suggestCall(gfHeartFit(), Seat.South, ["1NT", "X", "XX", "P", "P", "P"]);
    // Auction is complete — either null or pass
    if (result) {
      expect(result.call.type).toBe("pass");
    }
  });

  test.skip("1NT-P-2C-X-2H-P: responder rebids normally (Round 2 X ignored)", () => {
    /**
     * BRIDGE THEORY: When opponent doubles 2C in Round 2 but opener still
     * responds 2H, the Stayman sequence continues normally. The double of
     * 2C doesn't affect Round 3 — opener's 2H response is authoritative
     * regardless of the double.
     *
     * REQUIRES: Protocol tracking that Round 2 interference (double of 2C)
     * was absorbed by opener's bid, so Round 3 is uncontested.
     *
     * INFERENCE: Normal rebid = Round 2 interference didn't disrupt the sequence.
     */
    const result = suggestCall(gfHeartFit(), Seat.South, ["1NT", "P", "2C", "X", "2H", "P"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    // With 12 HCP and 4 hearts, should raise to 4H
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Hearts);
  });
});

// ─── Round 3: opponent's actions inform rebid ────────────

describe("Round 3: opponent's actions inform rebid", () => {
  test.skip("after 2H-2S(opp): responder avoids competing in spades", () => {
    /**
     * BRIDGE THEORY: When opponent overcalls 2S, they've shown spade length
     * and strength. Responder should NOT try to compete in spades even if
     * holding 4 spades — the opponent has spades. With 4S and GF values but
     * no heart fit, the right action is notrump (not 3S or 4S).
     *
     * REQUIRES: Round 3 overlay that recognizes opponent's suit and avoids
     * competing in that suit.
     *
     * INFERENCE: Opponent bid spades = they have 5+ spades. Our spades are
     * likely behind theirs positionally. Notrump or hearts preferred.
     */
    const result = suggestCall(gfNoHeartFit(), Seat.South, ["1NT", "P", "2C", "P", "2H", "2S"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    // Should NOT bid spades — opponent owns that suit
    expect(call.strain).not.toBe(BidSuit.Spades);
  });

  test.skip("after 2D-2H(opp): heart fit is defensive only (opponent has hearts)", () => {
    /**
     * BRIDGE THEORY: When opponent overcalls 2H after 2D denial, and
     * responder has 4+ hearts, those hearts are a defensive asset (sitting
     * behind declarer) but NOT suitable for declaring. The heart fit is
     * compromised by opponent's overcall — prefer notrump or a minor.
     *
     * REQUIRES: Round 3 overlay adjusting fit evaluation when opponent
     * has shown the same suit.
     *
     * INFERENCE: Opponent bid hearts = competing for hearts is dangerous.
     * Hearts might play poorly as trumps with opponent's length.
     */
    const result = suggestCall(inviteHeartFit(), Seat.South, ["1NT", "P", "2C", "P", "2D", "2H"]);
    if (result && result.call.type === "bid") {
      const call = result.call;
      // Should NOT bid hearts — opponent has shown heart length
      expect(call.strain).not.toBe(BidSuit.Hearts);
    }
  });

  test.skip("after 2S-3D(opp): responder avoids diamond contracts", () => {
    /**
     * BRIDGE THEORY: When opponent overcalls 3D after opener's 2S response,
     * opponent has shown diamond length. Responder should avoid competing in
     * diamonds and prefer the confirmed spade fit or notrump. Diamond
     * contracts would face a bad trump break.
     *
     * REQUIRES: Round 3 overlay where opponent's suit is marked as unsafe
     * for our contracts.
     *
     * INFERENCE: Opponent's 3D = 5+ diamonds, our diamond holdings are
     * behind theirs. Spade fit or notrump preferred.
     */
    const result = suggestCall(gfSpadeFit(), Seat.South, ["1NT", "P", "2C", "P", "2S", "3D"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.strain).not.toBe(BidSuit.Diamonds);
  });

  test.skip("after opener's 2H alerted: confirms conventional response strengthens inference", () => {
    /**
     * BRIDGE THEORY: When opener's 2H is alerted (confirming it's the
     * conventional Stayman response showing 4 hearts), responder can be
     * more confident about the fit quality. The alert confirms this is a
     * precise 4-card holding rather than a possible 5+ suit from a natural
     * bid. Responder's rebid decisions are sharper.
     *
     * REQUIRES: Alert-awareness in the protocol — strengthens confidence
     * in opener's hand shape for Round 3 decisions.
     *
     * INFERENCE: Alerted 2H = exactly 4 hearts (conventional). Unalerted
     * 2H in a natural context could be 4+ or 5+.
     */
    const result = suggestCall(gfHeartFit(), Seat.South, ["1NT", "P", "2C", "P", "2H", "P"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    // Standard rebid with confirmed fit — game in hearts
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test.skip("opponent's overcall reveals suit — adjusts competitive decisions", () => {
    /**
     * BRIDGE THEORY: When opponent overcalls after opener's response, the
     * overcall reveals information about opponent's hand. This knowledge
     * should influence responder's competitive decisions. For example, if
     * opponent bids 2S showing spade length, responder with spade honors
     * has positional advantage in notrump but disadvantage in a spade contract.
     *
     * REQUIRES: Inference system feeds opponent's shown suit into Round 3
     * decision logic, adjusting strain preference and competitive threshold.
     *
     * INFERENCE: Opponent's overcall = known suit length in that hand.
     * Our honors in that suit are better on defense (behind declarer).
     * [PARTNERSHIP-DEPENDENT] — degree of inference varies by agreement.
     */
    // GF with spades — but opponent has shown spades via 2S overcall
    const result = suggestCall(gfSpadeFit(), Seat.South, ["1NT", "P", "2C", "P", "2H", "2S"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    // With opponent showing spades, prefer hearts (fit found) or NT
    // Should NOT bid spades despite holding 4
    expect(call.strain).not.toBe(BidSuit.Spades);
  });
});

// ─── Round 3: additional competitive scenarios ───────────

describe("Round 3: competitive judgment edge cases", () => {
  test.skip("after 2H-2S(opp): GF with heart fit and spade stopper prefers 4H over 3NT", () => {
    /**
     * BRIDGE THEORY: With a confirmed 4-4 heart fit and GF values, 4H is
     * usually better than 3NT. Even though responder has a spade stopper
     * (SA), the 4-4 major fit typically produces more tricks. The overcall
     * doesn't change the preference for the major.
     *
     * REQUIRES: Round 3 overlay preferring major-fit game over NT game
     * when fit is confirmed, even in competition.
     *
     * INFERENCE: 4H over 2S with fit = fit preference over NT, standard.
     */
    const result = suggestCall(gfHeartFit(), Seat.South, ["1NT", "P", "2C", "P", "2H", "2S"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test.skip("after 2D-X(opp): GF balanced bids 2NT (pass available but wrong)", () => {
    /**
     * BRIDGE THEORY: After 2D is doubled, a GF hand should NOT pass just
     * because doubling happened. The 2D was artificial (Stayman denial),
     * so the double is lead-directing at best. Responder should continue
     * the sequence — 2NT shows GF values without a major fit.
     *
     * REQUIRES: Round 3 overlay where double of artificial 2D doesn't
     * derail the Stayman continuation.
     *
     * INFERENCE: 2NT over 2D-X = GF values, no major fit. Double of 2D
     * doesn't show real diamond strength (2D was artificial).
     */
    const result = suggestCall(gfBalancedNoFit(), Seat.South, ["1NT", "P", "2C", "P", "2D", "X"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.strain).toBe(BidSuit.NoTrump);
  });

  test.skip("after 2S-3C(opp): strong with spade fit cue-bids 4C (slam interest)", () => {
    /**
     * BRIDGE THEORY: With 14 HCP, a confirmed 4-4 spade fit, and club
     * control, cue-bidding 4C over the 3C overcall shows slam interest.
     * This is an advanced action — game is certain, responder is exploring
     * whether slam is possible with the combined 29-31 HCP.
     *
     * REQUIRES: Round 3 overlay with slam-try branch for very strong hands
     * (14+ HCP) with confirmed fit after opponent overcall.
     *
     * INFERENCE: 4C cue-bid = slam interest, club control, confirmed spade fit.
     * [PARTNERSHIP-DEPENDENT] — cue-bidding agreements vary widely.
     */
    const result = suggestCall(strongBothMajors(), Seat.South, ["1NT", "P", "2C", "P", "2S", "3C"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    // Either 4S (game) or 4C (cue-bid for slam) — both valid
    expect(call.level).toBe(4);
  });

  test.skip("after 2H-P: invite with no heart fit bids 2NT (standard invite)", () => {
    /**
     * BRIDGE THEORY: In an uncontested auction after opener's 2H, responder
     * with invitational values (9 HCP) and no heart fit (only 3 hearts)
     * bids 2NT as an invitation to 3NT. This is the standard rebid path.
     * Included here as a regression baseline for contested variations.
     *
     * REQUIRES: Standard Round 3 uncontested logic (already implemented).
     *
     * INFERENCE: 2NT = 8-9 HCP, no heart fit, inviting 3NT.
     */
    const result = suggestCall(inviteSpadeFit(), Seat.South, ["1NT", "P", "2C", "P", "2H", "P"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    // Invite with no heart fit — should bid 2NT or head toward NT
    expect(call.strain).toBe(BidSuit.NoTrump);
  });

  test.skip("after 2D-2H(opp): GF with 4S+4H bids 3NT (both majors denied by 2D)", () => {
    /**
     * BRIDGE THEORY: After 2D denial, opener has no 4-card major. Responder
     * with 4S+4H and GF values knows there's no major fit possible. With
     * opponent's 2H overcall, the auction should head toward 3NT — the
     * default game without a major fit.
     *
     * REQUIRES: Round 3 overlay for "2D overcalled" with GF no-fit path
     * leading to 3NT.
     *
     * INFERENCE: 3NT = game values, no major fit (2D denied), sufficient
     * stoppers for notrump play.
     */
    const result = suggestCall(strongBothMajors(), Seat.South, ["1NT", "P", "2C", "P", "2D", "2H"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.NoTrump);
  });

  test.skip("after 2H-4C(opp): GF with heart fit bids 4H (preempt doesn't prevent game)", () => {
    /**
     * BRIDGE THEORY: Even a high-level preemptive overcall (4C) cannot prevent
     * responder from bidding 4H with a confirmed fit and GF values. The 4C
     * bid is below 4H, so the game contract is still available. Responder
     * should bid it confidently.
     *
     * REQUIRES: Round 3 overlay for high-level preemptive overcalls.
     *
     * INFERENCE: 4H over 4C = confirmed fit, GF values, not intimidated by preempt.
     */
    const result = suggestCall(gfHeartFit(), Seat.South, ["1NT", "P", "2C", "P", "2H", "4C"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test.skip("after 2D-3S(opp): high preempt blocks most rebids — double or pass", () => {
    /**
     * BRIDGE THEORY: After 2D denial and opponent's 3S preempt, most rebid
     * options are blocked. With GF values but no fit, responder must choose
     * between doubling for penalty (with strong defensive values) or bidding
     * 3NT with a spade stopper. A pass is dangerous with GF values.
     *
     * REQUIRES: Round 3 overlay for high-level preempts after 2D denial.
     *
     * INFERENCE: Action over 3S preempt = strong hand forced to act at high level.
     */
    const result = suggestCall(strongBothMajors(), Seat.South, ["1NT", "P", "2C", "P", "2D", "3S"]);
    expect(result).not.toBeNull();
    // Should either double (penalty) or bid 3NT — not pass with 14 HCP
    expect(result!.call.type).not.toBe("pass");
  });

  test.skip("after 2S-X(opp): invite with spade fit bids 3S (competitive raise)", () => {
    /**
     * BRIDGE THEORY: When opener's 2S is doubled and responder has
     * invitational values with a spade fit, 3S is a competitive raise.
     * It's not as strong as a redouble (which would show GF values)
     * but shows genuine spade support with moderate values.
     *
     * REQUIRES: Round 3 overlay for "2S doubled" with invite + fit path.
     *
     * INFERENCE: 3S over double = 4+ spades, 8-9 HCP (competitive raise).
     */
    const result = suggestCall(inviteSpadeFit(), Seat.South, ["1NT", "P", "2C", "P", "2S", "X"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test.skip("after 2H-2S(opp): invite with no heart fit bids 2NT (competing for NT)", () => {
    /**
     * BRIDGE THEORY: With invitational values (9 HCP), a spade suit but no
     * heart fit after opener's 2H, responder should bid 2NT as a competitive
     * invitation. The opponent's 2S shows spades, making our spade holding
     * less valuable for suit play but fine for notrump stoppers.
     *
     * REQUIRES: Round 3 overlay for invite hands without fit after overcall,
     * allowing 2NT as a competitive invite.
     *
     * INFERENCE: 2NT over 2S with no fit = 8-9 HCP invite, spade stopper likely.
     */
    const result = suggestCall(inviteSpadeFit(), Seat.South, ["1NT", "P", "2C", "P", "2H", "2S"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.strain).toBe(BidSuit.NoTrump);
  });

  test.skip("after 2S-3H(opp): invite with spade fit bids 3S (competitive)", () => {
    /**
     * BRIDGE THEORY: After opener's 2S and opponent's 3H overcall, responder
     * with invitational values and a spade fit should compete with 3S. The
     * 3H overcall forces the decision: 3S is still available and shows a
     * competitive raise with moderate values.
     *
     * REQUIRES: Round 3 overlay for "2S overcalled at 3H" with invite fit path.
     *
     * INFERENCE: 3S over 3H = 4+ spades, 8-9 HCP, competitive raise.
     */
    const result = suggestCall(inviteSpadeFit(), Seat.South, ["1NT", "P", "2C", "P", "2S", "3H"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test.skip("after 2D-2S(opp): invite passes (can't invite at 3-level safely)", () => {
    /**
     * BRIDGE THEORY: After 2D denial and opponent's 2S overcall, an invite
     * hand (9 HCP) with no fit cannot safely bid 3NT (not enough values)
     * or 2NT (blocked by 2S). The prudent action is to pass and let opener
     * compete or defend.
     *
     * REQUIRES: Round 3 overlay where invite hands without fit pass when
     * the overcall blocks invitational bids.
     *
     * INFERENCE: Pass over 2S = 8-9 HCP, no fit, can't invite safely.
     */
    const result = suggestCall(inviteSpadeFit(), Seat.South, ["1NT", "P", "2C", "P", "2D", "2S"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("pass");
  });

  test.skip("after 2H-3D(opp): invite with heart fit bids 3H (competitive)", () => {
    /**
     * BRIDGE THEORY: After opener's 2H and opponent's 3D overcall, responder
     * with invitational values and a heart fit should compete with 3H. The
     * 3D overcall pushes the auction up but 3H is still available to show
     * competitive support.
     *
     * REQUIRES: Round 3 overlay for "2H overcalled at 3D" with invite fit path.
     *
     * INFERENCE: 3H over 3D = 4+ hearts, 8-9 HCP, competitive raise.
     */
    const result = suggestCall(inviteHeartFit(), Seat.South, ["1NT", "P", "2C", "P", "2H", "3D"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test.skip("after 2D-X(opp): weak minimum passes (no reason to act)", () => {
    /**
     * BRIDGE THEORY: After 2D denial and opponent's double, with only 8 HCP
     * and no major fit found, there's no compelling reason to act. The double
     * was of an artificial bid (2D denial), so sitting it out is reasonable.
     * Opener can handle the situation with their 15-17 HCP.
     *
     * REQUIRES: Round 3 overlay for "2D doubled" with weak pass option.
     *
     * INFERENCE: Pass of 2D-X = minimum values, no direction, leaving to opener.
     */
    const result = suggestCall(weakMinimum(), Seat.South, ["1NT", "P", "2C", "P", "2D", "X"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("pass");
  });

  test.skip("after 2S-3D(opp): GF with spade fit bids 4S (bypasses contested minors)", () => {
    /**
     * BRIDGE THEORY: After opener's 2S and opponent's 3D overcall, responder
     * with GF values and a confirmed 4-4 spade fit bids game directly in
     * spades. The diamond overcall is irrelevant — the major fit is established
     * and game values are present. No need to cue-bid or probe further.
     *
     * REQUIRES: Round 3 overlay for "2S overcalled at 3D" with GF + fit path.
     *
     * INFERENCE: 4S over 3D = confirmed spade fit, 10+ HCP, game values.
     */
    const result = suggestCall(gfSpadeFit(), Seat.South, ["1NT", "P", "2C", "P", "2S", "3D"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Spades);
  });
});

// ─── Round 3: opponent convention informs rebid ──────────

describe("Round 3: opponent convention informs rebid", () => {
  test.skip("after 2H-2S(natural): GF heart fit bids 3H (natural 6+S, conservative)", () => {
    /**
     * BRIDGE THEORY: When opponent's 2S is a natural overcall (6+ spades),
     * responder with GF heart fit should bid 3H rather than jumping to 4H.
     * The natural overcaller has real spade length and may compete further.
     * A 3H bid preserves room for opener to evaluate.
     *
     * REQUIRES:
     * - Natural 2S = 6+ spades inference
     * - Conservative action (3H not 4H) when opponent has real suit
     *
     * INFERENCE: Natural 2S = 6+ spades. Conservative raise preferred.
     */
    const result = suggestCall(
      // GF with heart fit: 12 HCP, 4S + 4H
      hand("SA", "S7", "S5", "S3", "HK", "HQ", "H5", "H3", "DK", "D5", "D3", "C5", "C2"),
      Seat.South, ["1NT", "P", "2C", "P", "2H", "2S"],
      { opponentConventionIds: [] },
    );
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test.skip("after 2H-2S(DONT): GF heart fit jumps to 4H (DONT lighter, game direct)", () => {
    /**
     * BRIDGE THEORY: When opponent's 2S is DONT (spades + minor, lighter hand),
     * responder can be more aggressive. DONT overcalls are typically lighter than
     * natural overcalls, so jumping to 4H is justified — the opponents are less
     * likely to compete effectively.
     *
     * REQUIRES:
     * - DONT 2S inference: spades + minor, 8-15 HCP (lighter)
     * - More aggressive action when opponent is known to be lighter
     *
     * INFERENCE: DONT 2S = lighter hand. 4H justified by opponent weakness.
     */
    const result = suggestCall(
      hand("SA", "S7", "S5", "S3", "HK", "HQ", "H5", "H3", "DK", "D5", "D3", "C5", "C2"),
      Seat.South, ["1NT", "P", "2C", "P", "2H", "2S"],
      { opponentConventionIds: ["dont"] },
    );
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test.skip("after 2D-2H(natural): GF balanced bids 3NT (natural 6+H, need stopper)", () => {
    /**
     * BRIDGE THEORY: After 2D denial and opponent's natural 2H overcall (6+ hearts),
     * responder with GF balanced values bids 3NT. The natural overcall means
     * opponent has genuine heart length — stopper is important.
     *
     * REQUIRES:
     * - Natural 2H = 6+ hearts
     * - 3NT requires heart stopper awareness
     *
     * INFERENCE: Natural 2H = 6+ hearts. 3NT needs heart stopper.
     */
    const result = suggestCall(
      // GF balanced: 12 HCP, 4S + 2H
      hand("SA", "SK", "S7", "S3", "H5", "H3", "DK", "D7", "D5", "D3", "CQ", "C5", "C2"),
      Seat.South, ["1NT", "P", "2C", "P", "2D", "2H"],
      { opponentConventionIds: [] },
    );
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.NoTrump);
  });

  test.skip("after 2D-2H(DONT): GF balanced bids 3NT (DONT 5H, thinner stopper ok)", () => {
    /**
     * BRIDGE THEORY: Against DONT 2H (hearts + minor, only 5 hearts), the heart
     * stopper requirement is slightly relaxed. With only 5 hearts in opponent's
     * hand vs 6+ natural, our heart holding is more adequate for stopper purposes.
     *
     * REQUIRES:
     * - DONT 2H = 5+ hearts (thinner than natural)
     * - Stopper evaluation adjusted for 5-card suit
     *
     * INFERENCE: DONT 2H = 5 hearts. Thinner stopper sufficient for 3NT.
     */
    const result = suggestCall(
      hand("SA", "SK", "S7", "S3", "H5", "H3", "DK", "D7", "D5", "D3", "CQ", "C5", "C2"),
      Seat.South, ["1NT", "P", "2C", "P", "2D", "2H"],
      { opponentConventionIds: ["dont"] },
    );
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.NoTrump);
  });

  test.skip("after 2S-3C(natural): strong hand doubles for penalty (natural long clubs)", () => {
    /**
     * BRIDGE THEORY: Against a natural 3C overcall (6+ clubs), a penalty double
     * with strong values is attractive. The natural overcaller has genuine club
     * length, and combined with our strength, defending 3C doubled should yield
     * a good score.
     *
     * REQUIRES:
     * - Natural 3C = 6+ clubs inference
     * - Penalty double with 14+ HCP and confirmed fit elsewhere
     *
     * INFERENCE: Natural 3C = 6+ clubs. Penalty double viable.
     */
    const result = suggestCall(
      // Strong: 14 HCP, 4S + 4H
      hand("SK", "SJ", "S8", "S4", "HA", "HQ", "H9", "H3", "DK", "D5", "CJ", "C7", "C2"),
      Seat.South, ["1NT", "P", "2C", "P", "2S", "3C"],
      { opponentConventionIds: [] },
    );
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("double");
  });

  test.skip("after 2H-2S(natural): no convention same as empty array (regression)", () => {
    /**
     * BRIDGE THEORY: Regression test — passing no opponentConventionIds should
     * produce the same result as explicitly passing []. Both mean natural bidding.
     *
     * REQUIRES:
     * - Default opponentConventionIds: [] behavior matches explicit []
     *
     * INFERENCE: Same result either way.
     */
    const resultExplicit = suggestCall(
      hand("SA", "S7", "S5", "S3", "HK", "HQ", "H5", "H3", "DK", "D5", "D3", "C5", "C2"),
      Seat.South, ["1NT", "P", "2C", "P", "2H", "2S"],
      { opponentConventionIds: [] },
    );
    const resultDefault = suggestCall(
      hand("SA", "S7", "S5", "S3", "HK", "HQ", "H5", "H3", "DK", "D5", "D3", "C5", "C2"),
      Seat.South, ["1NT", "P", "2C", "P", "2H", "2S"],
    );
    expect(resultExplicit?.call).toEqual(resultDefault?.call);
  });
});
