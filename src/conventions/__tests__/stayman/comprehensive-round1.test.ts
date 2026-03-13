import { describe, test, expect, beforeEach } from "vitest";
import { Seat, BidSuit } from "../../../engine/types";
import type { ContractBid, Hand } from "../../../engine/types";
import { registerConvention, clearRegistry } from "../../core/registry";
import { staymanConfig } from "../../definitions/stayman";
import { hand, makeBiddingContext } from "../fixtures";
import { conventionToStrategy } from "../../../strategy/bidding/convention-strategy";
import { policyDescribe } from "../../../test-support/tiers";

beforeEach(() => {
  clearRegistry();
  registerConvention(staymanConfig);
});

// ─── Helpers ────────────────────────────────────────────────

interface SuggestOptions {
  dealer?: Seat;
  opponentConventionIds?: readonly string[];
}

function suggestCall(h: Hand, seat: Seat, bids: string[], opts?: SuggestOptions) {
  const ctx = makeBiddingContext(h, seat, bids, opts?.dealer ?? Seat.North, opts?.opponentConventionIds);
  return conventionToStrategy(staymanConfig).suggest(ctx);
}

// ─── Test hands (Round 1) ─────────────────────────────────────
// All hands verified with explicit HCP calculation

// Strong hand: 14 HCP, 4S + 4H
// SK(3) + SJ(1) + S8 + S4 + HA(4) + HQ(2) + H9 + H3 + DK(3) + D5 + CJ(1) + C7 + C2 = 14 HCP
const strongWith4Spades4Hearts = () =>
  hand(
    "SK", "SJ", "S8", "S4",
    "HA", "HQ", "H9", "H3",
    "DK", "D5",
    "CJ", "C7", "C2",
  );

// Game-forcing hand: 12 HCP, 4H + 3S
// SA(4) + S7 + S3 + HK(3) + HQ(2) + H7 + H3 + DK(3) + D5 + D3 + C5 + C3 + C2 = 12 HCP
const gfWith4Hearts = () =>
  hand(
    "SA", "S7", "S3",
    "HK", "HQ", "H7", "H3",
    "DK", "D5", "D3",
    "C5", "C3", "C2",
  );

// Invitational: 9 HCP, 4S + 4H
// SK(3) + SQ(2) + S4 + S2 + HJ(1) + H8 + H5 + H3 + D9 + D2 + CK(3) + C6 + C3 = 9 HCP
const inviteWith4S4H = () =>
  hand(
    "SK", "SQ", "S4", "S2",
    "HJ", "H8", "H5", "H3",
    "D9", "D2",
    "CK", "C6", "C3",
  );

// Weak hand: 5 HCP, 5 hearts, no spade length
// S7 + S3 + HQ(2) + HJ(1) + H8 + H6 + H3 + DQ(2) + D5 + D3 + C9 + C5 + C2 = 5 HCP
const weakWith5Hearts = () =>
  hand(
    "S7", "S3",
    "HQ", "HJ", "H8", "H6", "H3",
    "DQ", "D5", "D3",
    "C9", "C5", "C2",
  );

// Weak with long spades: 4 HCP, 6 spades
// SQ(2) + SJ(1) + S9 + S7 + S5 + S3 + H8 + H3 + DJ(1) + D5 + C7 + C5 + C2 = 4 HCP
const weakWith6Spades = () =>
  hand(
    "SQ", "SJ", "S9", "S7", "S5", "S3",
    "H8", "H3",
    "DJ", "D5",
    "C7", "C5", "C2",
  );

// Balanced no major: 11 HCP, 3-3-4-3 shape
// SA(4) + S5 + S3 + HK(3) + H5 + H3 + DQ(2) + DJ(1) + D5 + D3 + CJ(1) + C5 + C2 = 11 HCP
const balancedNoMajor = () =>
  hand(
    "SA", "S5", "S3",
    "HK", "H5", "H3",
    "DQ", "DJ", "D5", "D3",
    "CJ", "C5", "C2",
  );

// Very strong: 16 HCP, 4S + 3H (penalty double territory)
// SA(4) + SK(3) + SQ(2) + S5 + HA(4) + H7 + H3 + DK(3) + D5 + D3 + C5 + C3 + C2 = 16 HCP
const veryStrong16HCP = () =>
  hand(
    "SA", "SK", "SQ", "S5",
    "HA", "H7", "H3",
    "DK", "D5", "D3",
    "C5", "C3", "C2",
  );

// Very weak: 0 HCP, all low cards, 4-4-3-2 shape
// S9 + S7 + S5 + S3 + H8 + H6 + H4 + H2 + D7 + D5 + D3 + C4 + C2 = 0 HCP
const veryWeak0HCP = () =>
  hand(
    "S9", "S7", "S5", "S3",
    "H8", "H6", "H4", "H2",
    "D7", "D5", "D3",
    "C4", "C2",
  );

// GF with 4 spades, no hearts: 13 HCP, 4S + 2H + 4D + 3C
// SA(4) + SK(3) + S8 + S3 + H5 + H2 + DQ(2) + DJ(1) + D8 + D4 + CK(3) + C6 + C3 = 13 HCP
const gfWith4Spades = () =>
  hand(
    "SA", "SK", "S8", "S3",
    "H5", "H2",
    "DQ", "DJ", "D8", "D4",
    "CK", "C6", "C3",
  );

// Balanced strong with stopper: 15 HCP, 3-3-4-3 shape, heart stopper
// SA(4) + S8 + S3 + HK(3) + HQ(2) + H5 + DA(4) + D7 + D5 + D3 + CQ(2) + C6 + C2 = 15 HCP
const balancedStrongHeartStopper = () =>
  hand(
    "SA", "S8", "S3",
    "HK", "HQ", "H5",
    "DA", "D7", "D5", "D3",
    "CQ", "C6", "C2",
  );

// GF with 5 hearts: 13 HCP, 2S + 5H + 3D + 3C
// S8 + S3 + HA(4) + HK(3) + HJ(1) + H7 + H4 + DK(3) + D6 + D2 + CQ(2) + C5 + C3 = 13 HCP
const gfWith5Hearts = () =>
  hand(
    "S8", "S3",
    "HA", "HK", "HJ", "H7", "H4",
    "DK", "D6", "D2",
    "CQ", "C5", "C3",
  );

// Weak with 6 clubs: 3 HCP, 2-2-3-6 shape
// S7 + S3 + H5 + H2 + D8 + D6 + D3 + CJ(1) + CT + C8 + C6 + C4 + C2 = 1 HCP
// Correction: CQ(2) instead of CT to get 3 HCP
// S7 + S3 + H5 + H2 + D8 + D6 + D3 + CQ(2) + CJ(1) + C8 + C6 + C4 + C2 = 3 HCP
const weakWith6Clubs = () =>
  hand(
    "S7", "S3",
    "H5", "H2",
    "D8", "D6", "D3",
    "CQ", "CJ", "C8", "C6", "C4", "C2",
  );

// Weak with 6 diamonds: 3 HCP, 2-2-6-3 shape
// S7 + S3 + H5 + H2 + DQ(2) + DJ(1) + D9 + D7 + D5 + D3 + C8 + C5 + C2 = 3 HCP
const weakWith6Diamonds = () =>
  hand(
    "S7", "S3",
    "H5", "H2",
    "DQ", "DJ", "D9", "D7", "D5", "D3",
    "C8", "C5", "C2",
  );

// Balanced strong with spade stopper: 14 HCP, 3-3-3-4 shape
// SK(3) + SQ(2) + S5 + HK(3) + H6 + H3 + DA(4) + D7 + D3 + CQ(2) + C8 + C5 + C2 = 14 HCP
const balancedStrongSpadeStopper = () =>
  hand(
    "SK", "SQ", "S5",
    "HK", "H6", "H3",
    "DA", "D7", "D3",
    "CQ", "C8", "C5", "C2",
  );

// ─── Tests: Competitive bidding after 2D overcall ─────────────

policyDescribe("[policy]", "competitive actions after 2D overcall: system off, no Stayman available", "Round 1: competitive bidding after 2D overcall", () => {
  test.skip("after 1NT-2D: strong hand doubles for penalty", () => {
    /**
     * BRIDGE THEORY: When opponent overcalls 2D after partner's 1NT, responder
     * with 14+ HCP should double for penalty. The combined partnership has 29+
     * HCP minimum, making 2D doubled very attractive.
     *
     * [PARTNERSHIP-DEPENDENT] Some partnerships play negative doubles after 1NT
     * overcalls. This test assumes standard penalty doubles.
     *
     * REQUIRES:
     * - Competitive action overlay for "nt-opening" round after overcall
     * - Currently stayman-overcalled overlay returns fallback("system-off-overcall")
     *   so evaluateBiddingRules returns null. Future: dispatch to competitive tree.
     * - DialogueState: competitionMode=Overcalled, systemMode=Off
     *
     * INFERENCE: Penalty double of 2D shows 14+ HCP and willingness to defend
     * 2D doubled. Partner passes unless very distributional.
     */
    const result = suggestCall(strongWith4Spades4Hearts(), Seat.South, ["1NT", "2D"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("double");
  });

  test.skip("after 1NT-2D: GF hand with 4H bids 2H (natural)", () => {
    /**
     * BRIDGE THEORY: After opponent overcalls, system is off. Natural bids apply.
     * With 12 HCP and a 4-card heart suit, 2H is a natural game-forcing bid
     * showing 5+ hearts (some play 4+). System off means no Stayman/transfers.
     *
     * REQUIRES:
     * - Natural bidding overlay/tree for "nt-opening" round after overcall
     * - Competitive action dispatch: 2H = natural, forcing
     * - Dialog state: systemMode=Off, competitionMode=Overcalled
     *
     * INFERENCE: 2H after 1NT-2D shows 5+ hearts (natural) and game-forcing
     * values (10+ HCP with an NT opener). Partner raises with support or
     * bids 2NT/3NT with a diamond stopper.
     */
    const result = suggestCall(gfWith4Hearts(), Seat.South, ["1NT", "2D"]);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Hearts });
  });

  test.skip("after 1NT-2D: invite hand passes (insufficient strength to act)", () => {
    /**
     * BRIDGE THEORY: With only 9 HCP and no 5-card suit, responder lacks the
     * strength to act at the 2-level in competition. 9 HCP opposite 15-17 is
     * 24-26 total — borderline for game. Without a source of tricks, pass.
     *
     * REQUIRES:
     * - Competitive action overlay with pass logic for sub-10 HCP balanced hands
     * - DialogueState: competitionMode=Overcalled, systemMode=Off
     *
     * INFERENCE: Pass after partner's 1NT and opponent's overcall shows
     * insufficient values to compete. Could be 0-9 HCP.
     */
    const result = suggestCall(inviteWith4S4H(), Seat.South, ["1NT", "2D"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("pass");
  });

  test.skip("after 1NT-2D: weak hand with 5H bids 2H (competitive)", () => {
    /**
     * BRIDGE THEORY: With a weak hand (5 HCP) and 5+ hearts, bidding 2H is
     * competitive — not a strength-showing bid. The purpose is to compete
     * for the partscore and obstruct opponents. Some play this as weak, others
     * as constructive; depends on partnership agreement.
     *
     * [PARTNERSHIP-DEPENDENT] Whether 2H here is weak/competitive or
     * constructive varies by partnership. This test assumes competitive style.
     *
     * REQUIRES:
     * - Competitive action overlay: 2-level suit bids = natural, competitive
     * - Hand conditions: 5+ suit length, OR some minimum (e.g., 5+ HCP)
     *
     * INFERENCE: 2H over 2D could be weak or constructive. Partner must
     * not assume game-forcing values.
     */
    const result = suggestCall(weakWith5Hearts(), Seat.South, ["1NT", "2D"]);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Hearts });
  });

  test.skip("after 1NT-2D: balanced no major passes", () => {
    /**
     * BRIDGE THEORY: With 11 HCP but no 5-card suit and no major fit to explore,
     * pass is reasonable. Without Stayman available, there's no way to check for
     * a 4-4 major fit. 2NT would show a diamond stopper and invite, but that
     * requires specific partnership agreement.
     *
     * REQUIRES:
     * - Competitive action overlay: balanced hand without major suit = pass
     * - Future: 2NT might be available as natural invite with stopper
     *
     * INFERENCE: Pass shows no convenient action. Partner may reopen with a
     * double if short in diamonds.
     */
    const result = suggestCall(balancedNoMajor(), Seat.South, ["1NT", "2D"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("pass");
  });
});

// ─── Tests: Competitive bidding after 2H overcall ─────────────

policyDescribe("[policy]", "competitive actions after 2H overcall", "Round 1: competitive bidding after 2H overcall", () => {
  test.skip("after 1NT-2H: strong hand (14+ HCP, 4S) doubles for penalty", () => {
    /**
     * BRIDGE THEORY: When opponent overcalls 2H after partner's 1NT, responder
     * with 14+ HCP can double for penalty. After 1NT, doubles of overcalls are
     * penalty-oriented (not negative doubles). Combined 29+ HCP makes defense
     * very attractive.
     *
     * [PARTNERSHIP-DEPENDENT] Some partnerships play negative doubles after 1NT
     * overcalls. This test assumes standard penalty doubles.
     *
     * REQUIRES:
     * - Competitive action overlay for "nt-opening" round after overcall
     * - Currently stayman-overcalled overlay returns fallback("system-off-overcall")
     *   so evaluateBiddingRules returns null. Future: dispatch to competitive tree.
     * - DialogueState: competitionMode=Overcalled, systemMode=Off
     *
     * INFERENCE: Penalty double of 2H shows 14+ HCP and tolerance for
     * defending 2H doubled. Partner knows not to pull the double.
     */
    const result = suggestCall(strongWith4Spades4Hearts(), Seat.South, ["1NT", "2H"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("double");
  });

  test.skip("after 1NT-2H: GF with 4S bids 2S (natural)", () => {
    /**
     * BRIDGE THEORY: With game-forcing values and 4+ spades, bid 2S naturally.
     * System is off after overcall, so this is NOT a transfer — it shows a real
     * spade suit. Being at the 2-level is convenient since spades outrank hearts.
     *
     * REQUIRES:
     * - Competitive action overlay: natural suit bids at 2-level
     * - Hand condition: 10+ HCP + 4+ spades
     *
     * INFERENCE: 2S is natural, forcing. Shows 4+ spades and 10+ HCP.
     * Partner raises with fit, bids 2NT/3NT with heart stopper.
     */
    const result = suggestCall(gfWith4Spades(), Seat.South, ["1NT", "2H"]);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Spades });
  });

  test.skip("after 1NT-2H: invite with 4S bids 2S (competitive)", () => {
    /**
     * BRIDGE THEORY: With 9 HCP and 4 spades, 2S is competitive/invitational.
     * Since spades outrank hearts, we can bid at the 2-level. Partner can
     * raise to 3S/4S with a fit and maximum, or pass with minimum.
     *
     * REQUIRES:
     * - Competitive action overlay: 2S = natural, competitive/invitational
     * - Hand condition: 8+ HCP + 4+ spades over a heart overcall
     *
     * INFERENCE: 2S shows 4+ spades, competitive to invitational values.
     * Not necessarily game-forcing.
     */
    const result = suggestCall(inviteWith4S4H(), Seat.South, ["1NT", "2H"]);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Spades });
  });

  test.skip("after 1NT-2H: weak hand (5 HCP, no spades) passes", () => {
    /**
     * BRIDGE THEORY: With only 5 HCP and no spade suit to compete with,
     * pass is the only option. Can't bid hearts (opponent's suit), can't go
     * to the 3-level with this weakness, and doubling is out of the question.
     *
     * REQUIRES:
     * - Competitive action overlay: weak hand with no convenient action = pass
     *
     * INFERENCE: Pass shows inability to act. Could have 0-8 HCP or longer
     * hearts with no other suit.
     */
    const result = suggestCall(weakWith5Hearts(), Seat.South, ["1NT", "2H"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("pass");
  });

  test.skip("after 1NT-2H: balanced strong bids 2NT (natural, shows stopper)", () => {
    /**
     * BRIDGE THEORY: 2NT after an overcall is natural, showing a stopper in the
     * opponent's suit and invitational-to-game values (roughly 10-12 HCP over a
     * 1NT opening, i.e., invitational). With 15 HCP and HKQ in hearts, 2NT
     * describes this hand well.
     *
     * [PARTNERSHIP-DEPENDENT] Some play 2NT as Lebensohl relay. This test
     * assumes direct 2NT = natural with stopper, invitational+.
     *
     * REQUIRES:
     * - Competitive action overlay: 2NT = natural, stopper-showing
     * - Hand condition: 10+ HCP, stopper in overcalled suit, balanced
     *
     * INFERENCE: 2NT shows heart stopper, 10+ HCP, invitational+ values.
     * Partner bids 3NT with maximum or passes with minimum.
     */
    const result = suggestCall(balancedStrongHeartStopper(), Seat.South, ["1NT", "2H"]);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.NoTrump });
  });
});

// ─── Tests: Competitive bidding after 2S overcall ─────────────

policyDescribe("[policy]", "competitive actions after 2S overcall", "Round 1: competitive bidding after 2S overcall", () => {
  test.skip("after 1NT-2S: strong hand doubles for penalty", () => {
    /**
     * BRIDGE THEORY: 16 HCP opposite 15-17 = 31+ HCP. Opponent is in trouble
     * at 2S. Penalty double is clear with trump tricks (SA, SK, SQ).
     *
     * REQUIRES:
     * - Competitive action overlay: penalty double with 14+ HCP
     * - Hand condition: 14+ HCP + defensive values
     *
     * INFERENCE: Penalty double of 2S shows 14+ HCP and spade length/strength.
     * Partner passes. Expected set: 2-4 tricks.
     */
    const result = suggestCall(veryStrong16HCP(), Seat.South, ["1NT", "2S"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("double");
  });

  test.skip("after 1NT-2S: GF with 4H bids 3H (forced to 3-level)", () => {
    /**
     * BRIDGE THEORY: After 2S overcall, hearts must be bid at the 3-level since
     * 2H is no longer available (lower than 2S). With 12 HCP and a 4-card heart
     * suit, 3H is game-forcing and natural. The extra level required means
     * you need extra values compared to a 2-level bid.
     *
     * REQUIRES:
     * - Competitive action overlay: 3-level bids = GF, natural
     * - Hand condition: 10+ HCP + 4+ hearts for 3H over 2S
     *
     * INFERENCE: 3H shows 4+ hearts, game-forcing values (10+ HCP opposite NT).
     * Partner raises, bids 3NT, or returns to 4H.
     */
    const result = suggestCall(gfWith4Hearts(), Seat.South, ["1NT", "2S"]);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 3, strain: BidSuit.Hearts });
  });

  test.skip("after 1NT-2S: invite hand passes (can't bid 3H with only invite values)", () => {
    /**
     * BRIDGE THEORY: With only 9 HCP, bidding at the 3-level is too risky.
     * 3H would be game-forcing and responder doesn't have the values for that.
     * Unlike over a 2D or 2H overcall where 2S was available cheaply, over 2S
     * all actions are expensive.
     *
     * REQUIRES:
     * - Competitive action overlay: pass with sub-10 HCP over 2S overcall
     *
     * INFERENCE: Pass shows insufficient values to compete at the 3-level.
     * Could have up to 9 HCP with hearts but not enough for 3H game-force.
     */
    const result = suggestCall(inviteWith4S4H(), Seat.South, ["1NT", "2S"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("pass");
  });

  test.skip("after 1NT-2S: weak with 6S — pass (can't outbid)", () => {
    /**
     * BRIDGE THEORY: Even with 6 spades, we can't outbid the opponent in their
     * own suit. 3S would be interpreted as showing values. With only 4 HCP,
     * the hand is too weak for any action. Pass and let partner decide.
     *
     * REQUIRES:
     * - Competitive action overlay: weak hands always pass over 2S
     *
     * INFERENCE: Pass is forced with weak hand regardless of shape.
     */
    const result = suggestCall(weakWith6Spades(), Seat.South, ["1NT", "2S"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("pass");
  });

  test.skip("after 1NT-2S: GF with 5 hearts bids 3H", () => {
    /**
     * BRIDGE THEORY: With 13 HCP and 5 hearts, 3H is natural and game-forcing.
     * The 5-card suit provides a source of tricks. Partner can raise to 4H with
     * 3-card support or bid 3NT with a spade stopper.
     *
     * REQUIRES:
     * - Competitive action overlay: 3H = natural, GF, 5+ hearts
     *
     * INFERENCE: 3H shows 5+ hearts and GF values. Stronger message than over
     * 2D/2H overcalls because forced to the 3-level.
     */
    const result = suggestCall(gfWith5Hearts(), Seat.South, ["1NT", "2S"]);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 3, strain: BidSuit.Hearts });
  });
});

// ─── Tests: Competitive bidding after 2C overcall ─────────────

policyDescribe("[policy]", "competitive actions after 2C overcall blocks Stayman", "Round 1: competitive bidding after 2C overcall", () => {
  test.skip("after 1NT-2C: with 4H+4S, GF values, bids 2H (natural, Stayman unavailable)", () => {
    /**
     * BRIDGE THEORY: 2C overcall takes away Stayman (also 2C). With both majors
     * and GF values, bid the lower major first (2H) to explore for a fit.
     * If partner doesn't have hearts, they can bid 2S with 4 spades.
     *
     * REQUIRES:
     * - Competitive action overlay: natural major suit bids after 2C overcall
     * - Condition: 10+ HCP + 4+ card major, bid lower suit first
     *
     * INFERENCE: 2H shows 4+ hearts, GF values. May also have 4 spades.
     * Partner bids 2S with 4 spades and no heart fit.
     */
    const result = suggestCall(strongWith4Spades4Hearts(), Seat.South, ["1NT", "2C"]);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Hearts });
  });

  test.skip("after 1NT-2C: strong hand (16 HCP) doubles for penalty", () => {
    /**
     * BRIDGE THEORY: With 16 HCP opposite 15-17, the partnership has 31+ HCP.
     * 2C doubled should go for a large penalty. No need to explore suit contracts
     * when the penalty is this attractive.
     *
     * REQUIRES:
     * - Competitive action overlay: penalty double with 14+ HCP over 2C
     *
     * INFERENCE: Double of 2C shows 14+ HCP and tolerance for defending.
     * Club length is less important than raw HCP for penalty.
     */
    const result = suggestCall(veryStrong16HCP(), Seat.South, ["1NT", "2C"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("double");
  });

  test.skip("after 1NT-2C: GF balanced bids 3NT", () => {
    /**
     * BRIDGE THEORY: With 15 HCP, balanced shape, and a club stopper (from
     * partner's 1NT), 3NT is the practical choice. No need to explore when
     * you have the values for game and no interest in a major.
     *
     * REQUIRES:
     * - Competitive action overlay: 3NT = natural, GF, balanced with stopper
     * - Hand condition: 13+ HCP, balanced, no 4-card major
     *
     * INFERENCE: 3NT shows game values, no major suit interest, club stopper
     * (or reliance on partner's NT stopper coverage).
     */
    const result = suggestCall(balancedStrongHeartStopper(), Seat.South, ["1NT", "2C"]);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 3, strain: BidSuit.NoTrump });
  });

  test.skip("after 1NT-2C: invite hand with majors bids 2H (competitive)", () => {
    /**
     * BRIDGE THEORY: With 9 HCP and both majors, bidding 2H is competitive.
     * At the 2-level, this doesn't promise game-forcing values. Partner
     * evaluates whether to raise or pass.
     *
     * [PARTNERSHIP-DEPENDENT] Whether 2H is competitive or forcing varies.
     * Some play all new suits as forcing after 1NT overcall.
     *
     * REQUIRES:
     * - Competitive action overlay: 2-level majors competitive with 8+ HCP
     *
     * INFERENCE: 2H may be competitive (8-9) or forcing (10+). Ambiguous
     * without further partnership agreement.
     */
    const result = suggestCall(inviteWith4S4H(), Seat.South, ["1NT", "2C"]);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Hearts });
  });

  test.skip("after 1NT-2C: weak hand with no 5-card suit passes", () => {
    /**
     * BRIDGE THEORY: With 0 HCP and no long suit, pass is the only option.
     * No competitive action is possible.
     *
     * REQUIRES:
     * - Competitive action overlay: weak balanced hands pass
     *
     * INFERENCE: Pass shows inability to act.
     */
    const result = suggestCall(veryWeak0HCP(), Seat.South, ["1NT", "2C"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("pass");
  });
});

// ─── Tests: Competitive bidding after 2NT overcall ────────────

policyDescribe("[policy]", "competitive actions after 2NT overcall", "Round 1: competitive bidding after 2NT overcall", () => {
  test.skip("after 1NT-2NT (unusual): strong hand doubles for penalty", () => {
    /**
     * BRIDGE THEORY: 2NT overcall of 1NT typically shows an unusual 2NT
     * (minors) or a natural 2NT (rare). With 16 HCP, the partnership has
     * 31+ HCP — double for penalty. 2NT doubled is a massive penalty.
     *
     * [PARTNERSHIP-DEPENDENT] Interpretation of 2NT overcall varies: unusual
     * (both minors), natural, or other. Defense response varies accordingly.
     *
     * REQUIRES:
     * - Competitive action overlay: penalty double of 2NT with 14+ HCP
     * - Dialog state: competitionMode=Overcalled
     *
     * INFERENCE: Double of 2NT shows 14+ HCP. If 2NT is unusual,
     * double says "we own the hand, let's defend."
     */
    const result = suggestCall(veryStrong16HCP(), Seat.South, ["1NT", "2NT"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("double");
  });

  test.skip("after 1NT-2NT: GF with 5H bids 3H", () => {
    /**
     * BRIDGE THEORY: Over 2NT overcall, 3-level bids are natural and forcing.
     * With 13 HCP and 5 hearts, 3H shows a real suit and game values.
     *
     * REQUIRES:
     * - Competitive action overlay: 3-level suits = natural, forcing after 2NT
     *
     * INFERENCE: 3H shows 5+ hearts, GF values. Partner chooses between 3NT,
     * 4H, and other game contracts.
     */
    const result = suggestCall(gfWith5Hearts(), Seat.South, ["1NT", "2NT"]);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 3, strain: BidSuit.Hearts });
  });

  test.skip("after 1NT-2NT: weak hand passes", () => {
    /**
     * BRIDGE THEORY: With 0 HCP and no shape, pass. Let partner decide
     * whether to reopen. The opponents probably have a misfit for minors
     * if 2NT is unusual.
     *
     * REQUIRES:
     * - Competitive action overlay: weak hands pass over 2NT overcall
     *
     * INFERENCE: Pass shows weak hand.
     */
    const result = suggestCall(veryWeak0HCP(), Seat.South, ["1NT", "2NT"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("pass");
  });

  test.skip("after 1NT-2NT: invite hand with majors bids 3H (lowest 4-card major)", () => {
    /**
     * BRIDGE THEORY: With 9 HCP and both 4-card majors, the hand is borderline.
     * Over 2NT, bidding 3H shows the lower major first, competitive/invitational.
     * This is more aggressive than over a simple 2-level overcall since
     * opponents have shown distribution.
     *
     * [PARTNERSHIP-DEPENDENT] Some would pass with only invite values at the
     * 3-level. This test assumes competitive action with 4-card major.
     *
     * REQUIRES:
     * - Competitive action overlay: 3-level major with 8+ HCP after 2NT
     *
     * INFERENCE: 3H shows 4+ hearts, competitive values.
     */
    const result = suggestCall(inviteWith4S4H(), Seat.South, ["1NT", "2NT"]);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 3, strain: BidSuit.Hearts });
  });
});

// ─── Tests: Competitive bidding after 3-level overcall ────────

policyDescribe("[policy]", "competitive actions after 3-level preemptive overcall", "Round 1: competitive bidding after 3-level overcall", () => {
  test.skip("after 1NT-3C: strong hand (16 HCP) doubles", () => {
    /**
     * BRIDGE THEORY: After 3C overcall (preemptive), double with 16 HCP is
     * penalty/values-showing. Partnership has 31+ HCP; 3C doubled should be
     * a significant penalty.
     *
     * [PARTNERSHIP-DEPENDENT] Some play this as takeout double. Standard after
     * 1NT is penalty.
     *
     * REQUIRES:
     * - Competitive action overlay: penalty double at 3-level with 14+ HCP
     *
     * INFERENCE: Double of 3C shows 14+ HCP, penalty intent. Partner passes
     * unless very distributional.
     */
    const result = suggestCall(veryStrong16HCP(), Seat.South, ["1NT", "3C"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("double");
  });

  test.skip("after 1NT-3D: GF with 4H bids 3H", () => {
    /**
     * BRIDGE THEORY: After 3D overcall, 3H is still available (one step up).
     * With 12 HCP and 4 hearts, 3H is natural and game-forcing.
     *
     * REQUIRES:
     * - Competitive action overlay: 3H over 3D = natural, GF
     *
     * INFERENCE: 3H shows 4+ hearts, game-forcing values. Despite being at
     * the 3-level, no extra values needed since hearts are above diamonds.
     */
    const result = suggestCall(gfWith4Hearts(), Seat.South, ["1NT", "3D"]);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 3, strain: BidSuit.Hearts });
  });

  test.skip("after 1NT-3H: GF with 4S bids 3S", () => {
    /**
     * BRIDGE THEORY: After 3H overcall, 3S is the only major suit action.
     * With GF values and 4+ spades, 3S is natural. Hearts are opponent's
     * suit, so no heart bid is possible.
     *
     * REQUIRES:
     * - Competitive action overlay: 3S over 3H = natural, GF
     *
     * INFERENCE: 3S shows 4+ spades, game-forcing. Partner raises to 4S
     * with fit or bids 3NT without.
     */
    const result = suggestCall(gfWith4Spades(), Seat.South, ["1NT", "3H"]);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 3, strain: BidSuit.Spades });
  });

  test.skip("after 1NT-3S: very strong (16 HCP) doubles", () => {
    /**
     * BRIDGE THEORY: After 3S preempt, double with 16 HCP is penalty.
     * SA+SK+SQ provide excellent defensive tricks against a spade contract.
     * 3S doubled should yield a large penalty.
     *
     * REQUIRES:
     * - Competitive action overlay: penalty double of 3S preempt
     *
     * INFERENCE: Double of 3S shows 14+ HCP, defensive spade tricks.
     */
    const result = suggestCall(veryStrong16HCP(), Seat.South, ["1NT", "3S"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("double");
  });

  test.skip("after 1NT-3S: invite hand passes (too dangerous at 4-level)", () => {
    /**
     * BRIDGE THEORY: After 3S preempt, the only actions are at the 4-level
     * or double. With only 9 HCP, neither is appropriate. 4H would need
     * game-forcing values AND a 5+ card suit. Pass is prudent.
     *
     * REQUIRES:
     * - Competitive action overlay: pass with sub-12 HCP after 3-level preempt
     *
     * INFERENCE: Pass shows insufficient values for 4-level action.
     */
    const result = suggestCall(inviteWith4S4H(), Seat.South, ["1NT", "3S"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("pass");
  });

  test.skip("after 1NT-3C: GF balanced bids 3NT with club stopper", () => {
    /**
     * BRIDGE THEORY: With 15 HCP and balanced shape, 3NT is the target.
     * Partner has 15-17 HCP, so combined 30+ is enough for game. No need
     * to explore suits when 3NT is the most likely game.
     *
     * REQUIRES:
     * - Competitive action overlay: 3NT over 3C = to play, balanced
     *
     * INFERENCE: 3NT shows game values, no interest in a major, willing
     * to play 3NT.
     */
    const result = suggestCall(balancedStrongHeartStopper(), Seat.South, ["1NT", "3C"]);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 3, strain: BidSuit.NoTrump });
  });
});

// ─── Tests: Lebensohl 2NT relay after overcall ────────────────

policyDescribe("[policy]", "Lebensohl 2NT relay as competitive tool after overcall", "Round 1: Lebensohl 2NT relay after overcall", () => {
  test.skip("after 1NT-2D: 2NT Lebensohl relay (puppet to 3C)", () => {
    /**
     * BRIDGE THEORY: Lebensohl 2NT is an artificial relay asking partner to bid
     * 3C. Used with weak hands wanting to sign off at the 3-level, or strong
     * hands wanting to distinguish "slow" vs "fast" 3NT. After 1NT-2D, 2NT says
     * "bid 3C, I may pass or correct."
     *
     * [PARTNERSHIP-DEPENDENT] Lebensohl is an add-on convention, not universal.
     * Many casual partnerships don't play it.
     *
     * REQUIRES:
     * - Lebensohl overlay: 2NT = relay after any 2-level overcall
     * - IntentNode: SemanticIntentType.Relay with defaultCall 2NT
     * - Partner must alert this as conventional
     *
     * INFERENCE: 2NT Lebensohl shows either weak (will pass 3C or correct to 3D)
     * or strong (will bid over 3C). Ambiguous at this point.
     */
    const result = suggestCall(weakWith6Diamonds(), Seat.South, ["1NT", "2D"]);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.NoTrump });
  });

  test.skip("after 1NT-2H: 2NT Lebensohl relay", () => {
    /**
     * BRIDGE THEORY: Same Lebensohl structure as after 2D overcall. 2NT asks
     * partner to bid 3C. Responder will then pass (weak clubs), correct to 3D
     * (weak diamonds), or bid on (strong hand going through Lebensohl).
     *
     * [PARTNERSHIP-DEPENDENT] Requires Lebensohl agreement.
     *
     * REQUIRES:
     * - Lebensohl overlay for 2H overcall
     *
     * INFERENCE: 2NT relay — ambiguous strength, partner must bid 3C.
     */
    const result = suggestCall(weakWith6Diamonds(), Seat.South, ["1NT", "2H"]);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.NoTrump });
  });

  test.skip("after 1NT-2S: 2NT Lebensohl relay", () => {
    /**
     * BRIDGE THEORY: Lebensohl applies regardless of which suit was overcalled.
     * After 2S overcall, 2NT still asks partner to bid 3C. Responder can then
     * pass, correct to 3D, or bid 3H (weak with hearts).
     *
     * [PARTNERSHIP-DEPENDENT] Requires Lebensohl agreement.
     *
     * REQUIRES:
     * - Lebensohl overlay for 2S overcall
     *
     * INFERENCE: 2NT relay — ambiguous, partner bids 3C.
     */
    const result = suggestCall(weakWith6Clubs(), Seat.South, ["1NT", "2S"]);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.NoTrump });
  });

  test.skip("after 1NT-2H: slow 3NT (direct) shows stopper, no 4-card major", () => {
    /**
     * BRIDGE THEORY: In Lebensohl, direct (fast) 3NT vs going through 2NT (slow)
     * carry different meanings. Actually, convention is reversed from intuition:
     * DIRECT 3NT = "fast" denies stopper OR shows stopper without 4-card major
     * depending on partnership style (Fast Denies vs Slow Shows). Standard:
     * Direct 3NT = stopper, no 4-card major.
     *
     * [PARTNERSHIP-DEPENDENT] Fast Denies vs Slow Shows is a partnership choice.
     * This test assumes Slow Shows (direct 3NT = stopper, no 4oM).
     *
     * REQUIRES:
     * - Lebensohl overlay: direct 3NT = stopper + no 4M
     * - Hand condition: 10+ HCP, heart stopper, no 4-card major
     *
     * INFERENCE: Direct 3NT shows heart stopper and no 4-card major. Partner
     * passes; game found.
     */
    const result = suggestCall(balancedStrongHeartStopper(), Seat.South, ["1NT", "2H"]);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 3, strain: BidSuit.NoTrump });
  });

  test.skip("after 1NT-2H: fast 3NT (via Lebensohl) shows stopper + 4-card major", () => {
    /**
     * BRIDGE THEORY: Going through Lebensohl 2NT → partner bids 3C → then
     * bidding 3NT (slow) shows stopper + 4-card major. This lets partner
     * choose between 3NT and 4M. The extra round of bidding conveys more info.
     *
     * [PARTNERSHIP-DEPENDENT] Slow Shows vs Fast Denies affects meaning.
     *
     * REQUIRES:
     * - Lebensohl overlay: 2NT relay then 3NT = stopper + 4M
     * - Multi-round mechanism for Lebensohl (relay → correction → final bid)
     *
     * INFERENCE: 3NT via Lebensohl shows heart stopper AND 4-card major.
     * Partner pulls to 4M with fit, stays in 3NT without.
     */
    const result = suggestCall(strongWith4Spades4Hearts(), Seat.South, ["1NT", "2H"]);
    // First bid is 2NT Lebensohl relay
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.NoTrump });
  });

  test.skip("after Lebensohl: 3C then pass shows weak with clubs", () => {
    /**
     * BRIDGE THEORY: After 1NT-2D-2NT-P-3C, responder passes 3C showing a weak
     * hand with club length. The Lebensohl relay has achieved its purpose:
     * getting to 3C as a signoff.
     *
     * REQUIRES:
     * - Lebensohl continuation overlay: pass after partner's forced 3C
     * - Multi-round Lebensohl protocol
     * - Auction: 1NT(N)-2D(E)-2NT(S)-P(W)-3C(N)-P(E) → South acts
     *
     * INFERENCE: Pass of 3C shows weak hand with 5+ clubs. Signoff.
     */
    const result = suggestCall(
      weakWith6Clubs(),
      Seat.South,
      ["1NT", "2D", "2NT", "P", "3C", "P"],
    );
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("pass");
  });

  test.skip("after Lebensohl: 3C then 3D shows weak with diamonds", () => {
    /**
     * BRIDGE THEORY: After 1NT-2H-2NT-P-3C, responder bids 3D showing a weak
     * hand with diamond length. This is the "correction" step of Lebensohl:
     * partner was forced to bid 3C, and responder corrects to their real suit.
     *
     * REQUIRES:
     * - Lebensohl continuation overlay: 3D after 3C = correction, weak diamonds
     * - Multi-round Lebensohl protocol
     * - Auction: 1NT(N)-2H(E)-2NT(S)-P(W)-3C(N)-P(E) → South acts
     *
     * INFERENCE: 3D after Lebensohl shows weak hand with 5+ diamonds. Signoff.
     */
    const result = suggestCall(
      weakWith6Diamonds(),
      Seat.South,
      ["1NT", "2H", "2NT", "P", "3C", "P"],
    );
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 3, strain: BidSuit.Diamonds });
  });
});

// ─── Tests: Extended contested after double ───────────────────

policyDescribe("[policy]", "redouble 10+ HCP, Stayman on after double, weak escapes", "Round 1: extended contested after double", () => {
  test.skip("after 1NT-X: XX(penalty) — opener passes (forcing penalty)", () => {
    /**
     * BRIDGE THEORY: After 1NT-X-XX, the redouble is for penalty (in the
     * existing overlay). The question is what opener does next. With the
     * redouble penalty enforced, opener should pass — the XX is an instruction
     * to play 1NT redoubled.
     *
     * REQUIRES:
     * - This tests Round 2 opener behavior after responder's XX
     * - Opener tree/overlay for handling penalty redouble continuation
     * - Auction: 1NT(N)-X(E)-XX(S)-P(W) → North acts
     *
     * INFERENCE: Opener's pass confirms the penalty. 1NT XX played for a
     * big score if opener has a normal 1NT.
     */
    const result = suggestCall(
      balancedNoMajor(),
      Seat.North,
      ["1NT", "X", "XX", "P"],
    );
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("pass");
  });

  test.skip("after 1NT-X: Stayman 2C still works despite double (doubled overlay)", () => {
    /**
     * BRIDGE THEORY: The stayman-doubled overlay supports system ON (modified)
     * after a double. 2C Stayman should still be available. The existing
     * interference.test.ts confirms this with medium hand.
     *
     * REQUIRES:
     * - Already implemented: stayman-doubled overlay with system modified
     * - Hand condition: 8+ HCP with 4-card major
     *
     * INFERENCE: 2C after 1NT-X is still Stayman. Alert required.
     */
    const result = suggestCall(inviteWith4S4H(), Seat.South, ["1NT", "X"]);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Clubs });
  });

  test.skip("after 1NT-X-2H(escape): opponent bids 2S → responder acts", () => {
    /**
     * BRIDGE THEORY: After 1NT-X-2H(escape)-2S, the responder has escaped
     * to 2H but the opponent has competed with 2S. Now it's opener's turn.
     * This is a complex competitive sequence where the partnership needs to
     * decide whether to compete further.
     *
     * REQUIRES:
     * - Multi-round competitive overlay handling
     * - Auction: 1NT(N)-X(E)-2H(S)-2S(W) → North acts
     * - Opener needs to evaluate whether to compete or defend
     *
     * INFERENCE: The auction is getting competitive. Opener evaluates based
     * on heart fit and overall strength.
     */
    const result = suggestCall(
      balancedStrongHeartStopper(),
      Seat.North,
      ["1NT", "X", "2H", "2S"],
    );
    // Opener should either pass, double, or raise hearts
    expect(result).not.toBeNull();
  });

  test.skip("after 1NT-X-P-P: opener must act (run to best suit)", () => {
    /**
     * BRIDGE THEORY: After 1NT-X-P-P, the double is left in and partner
     * has passed (weak, no escape suit). Opener is playing 1NT doubled.
     * This sequence is actually complete — 1NT-X-P-P means two passes
     * so the contract is set. But if we model it as 1NT-X-P(E passes)-P(S
     * passes), then West acts.
     *
     * Actually, after 1NT-X, there are only two more actions before it's
     * settled. 1NT(N)-X(E)-P(S)-P(W) = contract set as 1NT doubled.
     * The interesting case is 1NT(N)-X(E)-P(S)-2D(W) where West runs.
     *
     * REQUIRES:
     * - Understanding of when auctions are complete
     * - This may not be a valid test scenario
     *
     * INFERENCE: After three passes, contract is established.
     */
    const result = suggestCall(
      veryWeak0HCP(),
      Seat.South,
      ["1NT", "X", "P", "P"],
    );
    // After 1NT-X-P-P, it's North's turn — auction may be over if North passes
    expect(result).not.toBeNull();
  });

  test.skip("after 1NT-X-P-2D(opp): responder acts over opponent's runout", () => {
    /**
     * BRIDGE THEORY: After 1NT-X-P-2D, the doubler's partner has run to 2D
     * (perhaps a weak hand with diamonds). South passed over the double
     * (weak/no suit), but now might compete at the 2-level.
     *
     * REQUIRES:
     * - Extended competitive overlay: action after opponent runs from double
     * - Auction: 1NT(N)-X(E)-P(S)-2D(W) → North acts
     *
     * INFERENCE: The double has been pulled, so defensive prospects are lower.
     * Now it's a competitive auction.
     */
    const result = suggestCall(
      strongWith4Spades4Hearts(),
      Seat.North,
      ["1NT", "X", "P", "2D"],
    );
    // Opener might double 2D for penalty or bid a suit
    expect(result).not.toBeNull();
  });

  test.skip("after 1NT-X: weak hand with 5+ diamonds escapes to 2D", () => {
    /**
     * BRIDGE THEORY: After 1NT is doubled, a weak hand with a long suit
     * should escape. 2D with 6 diamonds is a clear escape bid — running
     * from the danger of 1NT doubled to a safer partscore.
     *
     * REQUIRES:
     * - Already partially implemented via stayman-doubled overlay
     * - Escape bids at 2-level with 5+ card suit
     *
     * INFERENCE: 2D escape shows 5+ diamonds, weak hand. Not constructive,
     * purely survival.
     */
    const result = suggestCall(weakWith6Diamonds(), Seat.South, ["1NT", "X"]);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Diamonds });
  });

  test.skip("after 1NT-X: very weak 0 HCP with no 5-card suit passes", () => {
    /**
     * BRIDGE THEORY: With 0 HCP and 4-4-3-2 shape, there is no safe escape
     * suit. Bidding 2 of a 4-card suit is likely worse than defending 1NT
     * doubled. Partner has 15-17 HCP and may make 1NT doubled.
     *
     * REQUIRES:
     * - Escape logic: only escape with 5+ card suit
     * - Already implemented in existing interference tests
     *
     * INFERENCE: Pass after 1NT-X with no escape suit shows no 5+ suit.
     * Partner plays 1NT doubled.
     */
    const result = suggestCall(veryWeak0HCP(), Seat.South, ["1NT", "X"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("pass");
  });
});

// ─── Tests: Vulnerability-aware competitive decisions ─────────

policyDescribe("[policy]", "vulnerability affects competitive decisions", "Round 1: vulnerability-aware competitive decisions", () => {
  test.skip("vulnerable: don't compete at 3-level with invite values after 2S overcall", () => {
    /**
     * BRIDGE THEORY: When vulnerable, going down at the 3-level costs more
     * (100/trick vs 50 non-vul). With only 9 HCP and 4 hearts, 3H is risky
     * vulnerable. The potential loss from -200 or -300 outweighs the partscore
     * gain. Pass is safer.
     *
     * REQUIRES:
     * - Vulnerability-aware competitive overlay
     * - BiddingContext.vulnerability field populated
     * - Threshold: at 3-level vulnerable, need 10+ HCP for competitive action
     *
     * INFERENCE: Pass when vulnerable shows respect for the vulnerability.
     * Not necessarily weak — could have invite values but wrong conditions.
     */
    const result = suggestCall(inviteWith4S4H(), Seat.South, ["1NT", "2S"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("pass");
  });

  test.skip("non-vulnerable: compete more freely at 3-level after 2S overcall", () => {
    /**
     * BRIDGE THEORY: Non-vulnerable, going down at 3-level costs only 50/trick.
     * With 9 HCP and 4 hearts, 3H is more attractive non-vul since the risk/reward
     * ratio favors competing. A -100 or -150 is acceptable if it pushes opponents
     * to a worse contract.
     *
     * [PARTNERSHIP-DEPENDENT] Aggressiveness of competing varies by style.
     *
     * REQUIRES:
     * - Vulnerability-aware competitive overlay
     * - Lower threshold for non-vul competitive actions
     *
     * INFERENCE: 3H non-vul shows competitive intent. Lower threshold
     * than vulnerable for same action.
     */
    const result = suggestCall(inviteWith4S4H(), Seat.South, ["1NT", "2S"]);
    // Non-vul might bid 3H; vul would pass
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 3, strain: BidSuit.Hearts });
  });

  test.skip("vulnerable vs non-vul opponents: double for extra penalty", () => {
    /**
     * BRIDGE THEORY: When opponents are vulnerable and we have the balance of
     * power (14+ HCP + partner's 15-17 NT), doubling is especially attractive.
     * Vulnerable opponents go down for 200+/trick. 2H doubled vulnerable
     * down 3 = -800, much better than our +600 for 3NT.
     *
     * REQUIRES:
     * - Vulnerability-aware penalty double threshold
     * - Extra incentive for doubling vulnerable opponents
     *
     * INFERENCE: Double of vulnerable opponents shows awareness of scoring
     * implications. More likely to lead to a big penalty.
     */
    const result = suggestCall(strongWith4Spades4Hearts(), Seat.South, ["1NT", "2H"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("double");
  });

  test.skip("non-vul vs vul: bid game more aggressively (3NT over 3C overcall)", () => {
    /**
     * BRIDGE THEORY: When we are non-vulnerable and opponents are vulnerable,
     * game bonuses are the same but our risk for going down is lower. With
     * 11 HCP opposite 15-17, the combined 26+ HCP justifies a game try even
     * at the 3-level, especially since going down one non-vul is only -50.
     *
     * REQUIRES:
     * - Vulnerability-aware game threshold
     * - Non-vul game bidding more aggressive
     *
     * INFERENCE: 3NT non-vul shows willingness to stretch for game.
     */
    const result = suggestCall(balancedNoMajor(), Seat.South, ["1NT", "3C"]);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 3, strain: BidSuit.NoTrump });
  });
});

// ─── Tests: Edge cases and boundary conditions ────────────────

policyDescribe("[policy]", "competitive edge cases at HCP boundaries", "Round 1: edge cases and boundary conditions", () => {
  test.skip("after 1NT-2D: 0 HCP hand always passes", () => {
    /**
     * BRIDGE THEORY: With 0 HCP, no competitive action is ever justified.
     * Partner has 15-17 HCP but the hand contributes nothing to the partnership.
     * Any bid at the 2-level risks a big minus score.
     *
     * REQUIRES:
     * - Competitive action overlay with minimum HCP threshold
     *
     * INFERENCE: Pass with 0 HCP is automatic. No inference needed.
     */
    const result = suggestCall(veryWeak0HCP(), Seat.South, ["1NT", "2D"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("pass");
  });

  test.skip("after 1NT-2H: hand with 4 hearts (opponent's suit) passes", () => {
    /**
     * BRIDGE THEORY: When opponent overcalls in your best suit, pass. You can't
     * bid their suit naturally, and doubling with 9 HCP is too light for penalty.
     * The 4 hearts are a defensive asset — opponent may go down.
     *
     * REQUIRES:
     * - Competitive action overlay: no action when holding opponent's suit
     * - Hand has 4 hearts (same suit as overcall) but not enough for penalty X
     *
     * INFERENCE: Pass with opponent's suit shows defensive values in their suit.
     * Partner may reopen with a double.
     */
    const result = suggestCall(inviteWith4S4H(), Seat.South, ["1NT", "2H"]);
    // With 4 hearts, best to let partner reopen or defend
    // But also has 4 spades, so 2S might be right — test documents the tension
    expect(result).not.toBeNull();
  });

  test.skip("after 1NT-2C: hand with long clubs does not bid 3C (opponent's suit)", () => {
    /**
     * BRIDGE THEORY: You cannot bid the opponent's suit as a natural bid.
     * 3C over their 2C would be cuebid (game-forcing, asking for stopper)
     * not a natural club bid. With a weak hand and long clubs, pass.
     *
     * REQUIRES:
     * - Competitive action overlay: opponent's suit is not available naturally
     * - 3C = cuebid (GF, stopper ask) or not available
     *
     * INFERENCE: Cannot bid opponent's suit naturally. Must pass or bid
     * a different suit.
     */
    const result = suggestCall(weakWith6Clubs(), Seat.South, ["1NT", "2C"]);
    expect(result).not.toBeNull();
    // Should NOT bid 3C (opponent's suit)
    if (result!.call.type === "bid") {
      const bid = result!.call;
      if (bid.level === 3) {
        expect(bid.strain).not.toBe(BidSuit.Clubs);
      }
    }
  });

  test.skip("after 1NT-3D: GF with 4S bids 3S (spades still available)", () => {
    /**
     * BRIDGE THEORY: After 3D preempt, 3H and 3S are both still available.
     * With 13 HCP and 4 spades, 3S is natural and game-forcing. The higher
     * the preempt, the more you need to bid with shape.
     *
     * REQUIRES:
     * - Competitive action overlay: 3S over 3D = natural, GF
     * - Hand condition: GF values + 4+ spades
     *
     * INFERENCE: 3S shows 4+ spades, GF values. Partner chooses game.
     */
    const result = suggestCall(gfWith4Spades(), Seat.South, ["1NT", "3D"]);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 3, strain: BidSuit.Spades });
  });

  test.skip("after 1NT-3S: balanced with spade stopper bids 3NT", () => {
    /**
     * BRIDGE THEORY: After 3S preempt, 3NT is a practical bid with balanced
     * shape and a spade stopper. With 14 HCP (SK + SQ as stopper) and partner's
     * 15-17, the combined 29+ HCP makes 3NT likely to succeed.
     *
     * REQUIRES:
     * - Competitive action overlay: 3NT = to play with stopper
     * - Hand condition: 10+ HCP, spade stopper, balanced
     *
     * INFERENCE: 3NT shows spade stopper and game values. Partner passes.
     */
    const result = suggestCall(balancedStrongSpadeStopper(), Seat.South, ["1NT", "3S"]);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 3, strain: BidSuit.NoTrump });
  });

  test.skip("after 1NT-4H: very strong doubles for penalty (high-level action)", () => {
    /**
     * BRIDGE THEORY: After 4H preempt, the only actions are double, 4S, 4NT,
     * or 5-level. With 16 HCP and HA as a certain trick, double is attractive.
     * Partner has 15-17 HCP, so 31+ total — 4H doubled should go down.
     *
     * REQUIRES:
     * - Competitive action overlay: high-level penalty doubles
     * - Hand condition: 14+ HCP with defensive tricks for penalty
     *
     * INFERENCE: Double of 4H shows 14+ HCP and at least one defensive
     * heart trick. Very high level action.
     */
    const result = suggestCall(veryStrong16HCP(), Seat.South, ["1NT", "4H"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("double");
  });

  test.skip("after 1NT-4S: GF with 5H bids 5H (only option for hearts)", () => {
    /**
     * BRIDGE THEORY: After 4S preempt, to show hearts you must bid at the
     * 5-level. With 13 HCP and 5 hearts, 5H is a bold but reasonable action.
     * Combined with partner's 15-17 and a heart fit, 5H or 4S doubled
     * might both be good results.
     *
     * REQUIRES:
     * - Competitive action overlay: 5-level actions after 4-level preempt
     * - Hand condition: strong hand with long suit for 5-level bid
     *
     * INFERENCE: 5H shows 5+ hearts and game/slam values. Extremely
     * distributional or strong hand required.
     */
    const result = suggestCall(gfWith5Hearts(), Seat.South, ["1NT", "4S"]);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 5, strain: BidSuit.Hearts });
  });
});

// ─── Round 1: opponent convention awareness ─────────────

policyDescribe("[policy]", "opponent convention identification affects competitive response", "Round 1: opponent convention awareness", () => {
  test.skip("1NT-2H with DONT: strong hand doubles (DONT = only 5H, penalty viable)", () => {
    /**
     * BRIDGE THEORY: When opponents play DONT, a 2H overcall shows hearts + a minor
     * (typically 5+4). With only 5 hearts (vs 6+ natural), a penalty double is more
     * attractive because declarer has fewer trumps.
     *
     * REQUIRES:
     * - Inference pipeline reads opponentConventionIds: ["dont"]
     * - Looks up DONT rules for 2H → infers 5+ hearts, 4+ minor, 8-15 HCP
     * - Penalty double threshold adjusted for 5-card suit (vs 6-card natural)
     *
     * INFERENCE: DONT 2H = hearts + minor, 5+4 shape, 8-15 HCP.
     */
    const result = suggestCall(
      hand("SK", "SJ", "S8", "S4", "HA", "HQ", "H9", "H3", "DK", "D5", "CJ", "C7", "C2"),
      Seat.South, ["1NT", "2H"],
      { opponentConventionIds: ["dont"] },
    );
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("double");
  });

  test.skip("1NT-2H natural: strong hand passes (natural = 6+H, penalty risky)", () => {
    /**
     * BRIDGE THEORY: A natural 2H overcall promises 6+ hearts. Penalizing a
     * 6-card suit is riskier than a 5-card suit — declarer has more trump tricks.
     * With 14 HCP, pass is safer than double against a natural overcaller.
     *
     * REQUIRES:
     * - opponentConventionIds: [] → natural bidding inference
     * - Natural 2H = 6+ hearts, 10-16 HCP
     * - Higher threshold for penalty double vs 6-card suit
     *
     * INFERENCE: Natural 2H = 6+ hearts, 10-16 HCP.
     */
    const result = suggestCall(
      hand("SK", "SJ", "S8", "S4", "HA", "HQ", "H9", "H3", "DK", "D5", "CJ", "C7", "C2"),
      Seat.South, ["1NT", "2H"],
      { opponentConventionIds: [] },
    );
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("pass");
  });

  test.skip("1NT-2C with Landy: GF 12 HCP bids 2NT (Landy = both majors)", () => {
    /**
     * BRIDGE THEORY: Landy 2C shows both majors (4+/4+). With GF values but no
     * desire to compete in either major, 2NT is the natural game try showing
     * balanced strength without a major fit.
     *
     * REQUIRES:
     * - Inference pipeline reads opponentConventionIds: ["landy"]
     * - Landy 2C = 4+ spades, 4+ hearts, 10-15 HCP
     * - Responder avoids majors (opponent owns both), bids NT
     *
     * INFERENCE: Landy 2C = 4+/4+ in both majors.
     */
    const result = suggestCall(
      hand("SA", "S7", "S3", "HK", "HQ", "H7", "H3", "DK", "D5", "D3", "C5", "C3", "C2"),
      Seat.South, ["1NT", "2C"],
      { opponentConventionIds: ["landy"] },
    );
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.NoTrump);
  });

  test.skip("1NT-2C with Landy: strong 16 HCP doubles for penalty", () => {
    /**
     * BRIDGE THEORY: Against Landy 2C (both majors), a penalty double with 16 HCP
     * is attractive — we have the balance of power and opponent's 2C is artificial.
     * They may not have a club fit to escape to.
     *
     * REQUIRES:
     * - Strong hand (16+ HCP) can penalize artificial Landy 2C
     * - Inference: Landy bidder may have short clubs (exposed)
     *
     * INFERENCE: Penalty double of Landy shows strength, not clubs.
     */
    const result = suggestCall(
      hand("SA", "SK", "S5", "HA", "HK", "H5", "H3", "DK", "D5", "D3", "CJ", "C5", "C2"),
      Seat.South, ["1NT", "2C"],
      { opponentConventionIds: ["landy"] },
    );
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("double");
  });

  test.skip("1NT-2D with DONT: invite passes (DONT single-suited, unknown suit)", () => {
    /**
     * BRIDGE THEORY: DONT 2D shows a single-suited hand (not diamonds necessarily —
     * it's a relay showing an unspecified suit). With only invitational values,
     * passing is safe because we don't know which suit they really have.
     *
     * REQUIRES:
     * - DONT 2D inference: single-suited hand, suit unknown until they bid again
     * - With unknown suit distribution, conservative action preferred
     *
     * INFERENCE: DONT 2D = single-suited hand, suit TBD.
     */
    const result = suggestCall(
      hand("SK", "SQ", "S4", "S2", "HJ", "H8", "H5", "H3", "D9", "D2", "CK", "C6", "C3"),
      Seat.South, ["1NT", "2D"],
      { opponentConventionIds: ["dont"] },
    );
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("pass");
  });

  test.skip("1NT-2NT with Unusual NT: GF with 4H bids 3H (unusual = minors, hearts free)", () => {
    /**
     * BRIDGE THEORY: Unusual 2NT shows both minors (5+/5+). This means the majors
     * are "free" — opponent doesn't have major length. With 4 hearts and GF values,
     * bidding 3H is safe because opponent can't have heart length.
     *
     * REQUIRES:
     * - Unusual NT inference: 5+ diamonds, 5+ clubs
     * - Majors are uncontested → free to bid naturally
     *
     * INFERENCE: Unusual 2NT = 5+/5+ minors, short in both majors.
     */
    const result = suggestCall(
      hand("SA", "S7", "S3", "HK", "HQ", "H7", "H3", "DK", "D5", "D3", "C5", "C3", "C2"),
      Seat.South, ["1NT", "2NT"],
      { opponentConventionIds: ["unusual-nt"] },
    );
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test.skip("1NT-2S natural: strong with 4S passes (natural 6+S, no spade competition)", () => {
    /**
     * BRIDGE THEORY: Against a natural 2S overcall (6+ spades), competing in
     * spades with only 4 is pointless — opponent has more spades. Even with
     * strong values, pass is correct. Let partner decide.
     *
     * REQUIRES:
     * - Natural 2S = 6+ spades inference
     * - Suppress spade competition when opponent shows 6+ spades
     *
     * INFERENCE: Natural 2S = 6+ spades, 10-16 HCP.
     */
    const result = suggestCall(
      hand("SK", "SJ", "S8", "S4", "HA", "HQ", "H9", "H3", "DK", "D5", "CJ", "C7", "C2"),
      Seat.South, ["1NT", "2S"],
      { opponentConventionIds: [] },
    );
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("pass");
  });

  test.skip("1NT-2H natural: default natural same as empty opponentConventionIds", () => {
    /**
     * BRIDGE THEORY: When no opponent conventions are specified (natural bidding),
     * the inference should be the same as explicitly passing empty array.
     * This is a regression test ensuring the default path works.
     *
     * REQUIRES:
     * - opponentConventionIds: [] produces same result as natural default
     *
     * INFERENCE: Natural 2H = 6+ hearts (same either way).
     */
    const resultExplicit = suggestCall(
      hand("SK", "SJ", "S8", "S4", "HA", "HQ", "H9", "H3", "DK", "D5", "CJ", "C7", "C2"),
      Seat.South, ["1NT", "2H"],
      { opponentConventionIds: [] },
    );
    const resultDefault = suggestCall(
      hand("SK", "SJ", "S8", "S4", "HA", "HQ", "H9", "H3", "DK", "D5", "CJ", "C7", "C2"),
      Seat.South, ["1NT", "2H"],
    );
    expect(resultExplicit?.call).toEqual(resultDefault?.call);
  });
});
