/**
 * Comprehensive 2NT Stayman interference tests.
 *
 * 2NT Stayman operates at the 3-level: 2NT-P-3C ask, 3D/3H/3S responses.
 * This creates unique challenges compared to 1NT Stayman at the 2-level:
 *
 * 1. Interference enters at 3-level where space is already compressed
 * 2. Rebids must be at 4-level (no invite level exists — 2NT already commits to game)
 * 3. Smolen shifts up one level (3H→4H, 3S→4S after 3D denial)
 * 4. Current tree reuses 2-level rebid logic, producing wrong levels after 2NT
 *
 * All tests are skipped pending:
 * - Level-aware resolvers via staymanLevel(state)
 * - 2NT-specific overlay trees for interference
 * - Separate rebid trees for 2NT or level-aware intent resolvers
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

// ─── Test hands (2NT Stayman) ────────────────────────────
// 2NT opening promises 20-21 HCP balanced. Responses at 3-level.

// Responder: 10 HCP, 4H + 3S (enough for game opposite 2NT)
// SA(4) + HK(3) + DQ(2) + CJ(1) = 10 HCP
const responder10With4H = () =>
  hand("SA", "S5", "S3", "HK", "H7", "H5", "H3", "DQ", "D5", "D3", "CJ", "C5", "C2");

// Responder: 8 HCP, 4S + 4H
// SK(3) + HQ(2) + HJ(1) + DQ(2) = 8 HCP
const responder8With4S4H = () =>
  hand("SK", "S7", "S5", "S3", "HQ", "HJ", "H5", "H3", "DQ", "D5", "D3", "C5", "C2");

// Responder: 5 HCP, 4H (marginal for 2NT Stayman)
// HK(3) + DQ(2) = 5 HCP
const responder5With4H = () =>
  hand("S7", "S5", "S3", "HK", "H7", "H5", "H3", "DQ", "D5", "D3", "C7", "C5", "C2");

// GF balanced: 12 HCP, no 4M
// SA(4) + SK(3) + DK(3) + CQ(2) = 12 HCP
const gfBalanced = () =>
  hand("SA", "SK", "S5", "HK", "H5", "H3", "DK", "D5", "D3", "CQ", "C7", "C5", "C2");

// Opener 2NT: 20 HCP, 4H balanced
// SA(4) + SK(3) + HA(4) + HK(3) + DA(4) + CQ(2) = 20 HCP
const opener2NTWith4H = () =>
  hand("SA", "SK", "S5", "HA", "HK", "H5", "H3", "DA", "D5", "D3", "CQ", "C5", "C2");

// Opener 2NT: 21 HCP, 4S balanced
// SA(4) + SK(3) + SQ(2) + HA(4) + DA(4) + DK(3) + CJ(1) = 21 HCP
const opener2NTWith4S = () =>
  hand("SA", "SK", "SQ", "S5", "HA", "H5", "H3", "DA", "DK", "D3", "CJ", "C5", "C2");

// Opener 2NT: 20 HCP, no major
// SA(4) + HA(4) + DA(4) + DK(3) + CA(4) + CJ(1) = 20 HCP
const opener2NTNoMajor = () =>
  hand("SA", "S5", "S3", "HA", "H5", "H3", "DA", "DK", "D5", "CA", "CJ", "C5", "C2");

// Responder: 12 HCP, 5H + 4S (Smolen after 2NT denial)
// SA(4) + HK(3) + HQ(2) + DK(3) = 12 HCP
const smolen5H4S = () =>
  hand("SA", "S7", "S5", "S3", "HK", "HQ", "H7", "H5", "H3", "DK", "D3", "C5", "C2");

// Responder: 11 HCP, 5S + 4H (Smolen after 2NT denial)
// SA(4) + SK(3) + HQ(2) + DQ(2) = 11 HCP
const smolen5S4H = () =>
  hand("SA", "SK", "S7", "S5", "S3", "HQ", "H7", "H5", "H3", "DQ", "D3", "C5", "C2");

// ─── Round 1: Interference over 2NT opening ─────────────

describe("2NT Round 1: interference handling", () => {
  test.skip("after 2NT-X: responder with strong hand redoubles for penalty", () => {
    /*
     * BRIDGE THEORY:
     * When 2NT is doubled, responder with 10+ HCP should redouble for penalty.
     * At the 2-level (1NT-X), the Stayman overlay handles this with penalty redouble.
     * At the 2NT level, the same principle applies but no contested tree exists yet.
     * With 20-21 HCP in opener + 10 in responder = 30-31 combined, penalty is attractive.
     *
     * REQUIRES:
     * - 2NT-specific overlay tree for doubled auctions
     * - staymanLevel(state) returning 3 for "2nt" familyId
     * - Overlay matching CompetitionMode.Doubled + SystemMode.Modified for 2NT
     *
     * INFERENCE:
     * Redouble shows 10+ HCP, denies interest in Stayman (or defers it).
     * [PARTNERSHIP-DEPENDENT] — some partnerships play "systems on" over 2NT-X.
     */
    const result = suggestCall(responder10With4H(), Seat.South, ["2NT", "X"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("redouble");
  });

  test.skip("after 2NT-X: responder with 4H bids 3C Stayman despite double", () => {
    /*
     * BRIDGE THEORY:
     * Alternative treatment: some partnerships play "systems on" after 2NT-X,
     * meaning 3C is still Stayman. This is the more common expert treatment
     * because 2NT is already game-forcing strength, and finding a major fit
     * is more valuable than penalizing the opponents.
     *
     * REQUIRES:
     * - 2NT overlay for doubled auction with "systems on" option
     * - Level-aware Stayman ask resolver producing 3C (not 2C)
     * - Partnership agreement flag for systems-on vs penalty treatment
     *
     * INFERENCE:
     * 3C after 2NT-X = Stayman (systems on), 4+ card major, 5+ HCP.
     * [PARTNERSHIP-DEPENDENT] — depends on whether systems are on or off after X.
     */
    const result = suggestCall(responder10With4H(), Seat.South, ["2NT", "X"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Clubs);
  });

  test.skip("after 2NT-X: weak responder passes", () => {
    /*
     * BRIDGE THEORY:
     * With only 5 HCP opposite 2NT (20-21), combined count is 25-26 — enough
     * for game but not slam. After double, responder with no game interest
     * beyond 3NT should pass and let opener decide (redouble for penalty or bid).
     * At 1NT level, weak pass after double is 0-7 HCP. At 2NT level, any
     * responder hand < 5 HCP is extremely rare (they have 5 HCP here).
     *
     * REQUIRES:
     * - 2NT doubled overlay with pass option for weak hands
     * - Threshold adjustment: "weak" opposite 2NT is different from opposite 1NT
     *
     * INFERENCE:
     * Pass after 2NT-X shows < 5 HCP (extremely rare), or no clear direction.
     */
    const result = suggestCall(responder5With4H(), Seat.South, ["2NT", "X"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("pass");
  });

  test.skip("after 2NT-3C(opp blocks Stayman): GF bids 3NT directly", () => {
    /*
     * BRIDGE THEORY:
     * When opponent overcalls 3C over 2NT, they steal the Stayman bid.
     * Responder with game-forcing values and no 4-card major bids 3NT directly.
     * Unlike after 1NT-2C(opp), there's no room for a 2NT invite — we're already
     * above 2NT. Any action is game-forcing.
     *
     * REQUIRES:
     * - 2NT overcalled overlay: opponent 3C blocks Stayman
     * - Fallback path: GF balanced → 3NT
     * - SystemMode.Off detection when opponent steals convention bid
     *
     * INFERENCE:
     * 3NT directly over interference = balanced GF, no 4-card major or no way to show it.
     */
    const result = suggestCall(gfBalanced(), Seat.South, ["2NT", "3C"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.NoTrump);
  });

  test.skip("after 2NT-3C(opp): responder with 4H can't ask Stayman, bids 3H natural", () => {
    /*
     * BRIDGE THEORY:
     * Opponent's 3C blocks the Stayman ask. Responder with 4H and enough strength
     * for game bids 3H as a natural bid showing 4+ hearts. This is a key difference
     * from 1NT: after 1NT-2C(opp), responder might use double for Stayman. After
     * 2NT-3C(opp), responder can still bid naturally at the 3-level.
     *
     * REQUIRES:
     * - 2NT overcalled overlay with natural major bids
     * - 3H = natural 4+ hearts, game-forcing (opposite 2NT, everything is GF)
     *
     * INFERENCE:
     * 3H over 3C interference = natural 4+ hearts, game-forcing.
     * [PARTNERSHIP-DEPENDENT] — some play double = Stayman over 3C overcall.
     */
    const result = suggestCall(responder10With4H(), Seat.South, ["2NT", "3C"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test.skip("after 2NT-3D(opp): responder with 4H bids 3H", () => {
    /*
     * BRIDGE THEORY:
     * 3D overcall doesn't block Stayman (3C is still available), but bypasses
     * the 3D denial response. Responder with 4H can bid 3H naturally since
     * it's still available. Alternatively, 3C could still be Stayman — but
     * the simpler treatment is natural bids after interference.
     *
     * REQUIRES:
     * - Interference overlay for 3D overcall after 2NT
     * - Decision: is 3C still Stayman after 2NT-3D? Or natural?
     * - Natural 3H = 4+ hearts, GF
     *
     * INFERENCE:
     * 3H after 2NT-3D(opp) = natural 4+ hearts, GF.
     * [PARTNERSHIP-DEPENDENT] — 3C meaning after 3D overcall varies.
     */
    const result = suggestCall(responder10With4H(), Seat.South, ["2NT", "3D"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test.skip("after 2NT-3H(opp): responder with 4S bids 3S", () => {
    /*
     * BRIDGE THEORY:
     * 3H overcall blocks hearts but leaves 3S available. Responder with 4S
     * bids 3S naturally. With 4H, responder cannot compete in hearts (opp took it).
     * This is more compressed than 1NT interference because we're already at
     * the 3-level.
     *
     * REQUIRES:
     * - Natural 3S bid available after 2NT-3H(opp)
     * - Overlay tree: 3S = 4+ spades, GF
     * - Double = penalty interest (alternative)
     *
     * INFERENCE:
     * 3S after 2NT-3H(opp) = natural 4+ spades, GF.
     */
    const result = suggestCall(responder8With4S4H(), Seat.South, ["2NT", "3H"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test.skip("after 2NT-3S(opp): responder doubles with strong hand", () => {
    /*
     * BRIDGE THEORY:
     * 3S overcall blocks both majors. Responder with 10+ HCP and 4H can't
     * bid hearts at the 3-level (blocked). With combined 30+ HCP and good
     * defense, double is penalty-oriented. At this level, the auction is
     * already at game territory — penalty may score better than any game contract.
     *
     * REQUIRES:
     * - Penalty double overlay for high-level interference
     * - HCP threshold for penalty double vs forcing pass
     * - Level-awareness: 3S overcall is more damaging than 2S overcall
     *
     * INFERENCE:
     * Double of 3S after 2NT = penalty, 8+ HCP, good defense.
     */
    const result = suggestCall(responder10With4H(), Seat.South, ["2NT", "3S"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("double");
  });

  test.skip("after 2NT-3S(opp): responder passes with minimum", () => {
    /*
     * BRIDGE THEORY:
     * With only 5 HCP and no penalty interest, responder passes 3S.
     * Opener with 20-21 HCP may reopen with double. At this vulnerability,
     * defending 3S doubled may be better than attempting 3NT with only 25 combined.
     * Forcing pass is not in effect (2NT is not a game-force agreement by itself).
     *
     * REQUIRES:
     * - Pass option in 2NT overcalled overlay
     * - HCP threshold below which pass is correct
     *
     * INFERENCE:
     * Pass after 2NT-3S(opp) = weak hand, no penalty interest, defers to opener.
     */
    const result = suggestCall(responder5With4H(), Seat.South, ["2NT", "3S"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("pass");
  });
});

// ─── Round 2: Opener response under interference ────────

describe("2NT Round 2: opener response under interference", () => {
  test.skip("after 2NT-P-3C-X: opener with 4H still bids 3H", () => {
    /*
     * BRIDGE THEORY:
     * When 3C Stayman is doubled, opener should still show a 4-card major.
     * The double typically shows clubs, not a desire to penalize Stayman.
     * Opener's 3H bid is natural and doesn't change meaning. Same principle
     * as 1NT-P-2C-X-2H, but at one level higher.
     *
     * REQUIRES:
     * - Round 2 overlay for 3C doubled
     * - Opener still shows majors after 3C-X
     * - staymanLevel(state) = 3 for responses
     *
     * INFERENCE:
     * 3H after 3C-X = 4+ hearts, same as uncontested 3H response.
     */
    const result = suggestCall(opener2NTWith4H(), Seat.North, ["2NT", "P", "3C", "X"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test.skip("after 2NT-P-3C-X: opener with 4S bids 3S", () => {
    /*
     * BRIDGE THEORY:
     * Same as above but with spades. Opener shows 4S despite the double
     * of Stayman. At the 2NT level, space is tight — 3S is still available
     * and keeps the auction at the 3-level.
     *
     * REQUIRES:
     * - Round 2 overlay for doubled Stayman
     * - Level-aware response: 3S (not 2S)
     *
     * INFERENCE:
     * 3S after 3C-X = 4+ spades, denies 4 hearts (hearts checked first).
     */
    const result = suggestCall(opener2NTWith4S(), Seat.North, ["2NT", "P", "3C", "X"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test.skip("after 2NT-P-3C-3D(opp): opener with 4H free bids 3H", () => {
    /*
     * BRIDGE THEORY:
     * 3D overcall steals the denial response. Opener with 4H can still bid
     * 3H (it's available). This is a "free bid" — opener chose to bid rather
     * than pass, confirming real values in hearts. The 3D overcall actually
     * helps by removing ambiguity: 3H here is natural, not a denial.
     *
     * REQUIRES:
     * - Round 2 interference overlay for 3D overcall
     * - Free bid logic: 3H shows 4H voluntarily
     * - Pass option for no major (defers to responder)
     *
     * INFERENCE:
     * 3H free bid after 3D(opp) = 4+ hearts, voluntarily shown over interference.
     */
    const result = suggestCall(opener2NTWith4H(), Seat.North, ["2NT", "P", "3C", "3D"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test.skip("after 2NT-P-3C-3H(opp): opener with 4S bids 3S", () => {
    /*
     * BRIDGE THEORY:
     * 3H overcall blocks the hearts response. Opener with 4S can still bid
     * 3S (available). With 4H only, opener cannot show hearts (blocked) and
     * must pass or bid 3NT. The level pressure is critical: after 2NT Stayman,
     * every response is already at the 3-level, so interference is more damaging.
     *
     * REQUIRES:
     * - Round 2 interference overlay for 3H overcall
     * - 3S = 4+ spades (hearts blocked)
     * - Level-aware: response at 3-level, not 2-level
     *
     * INFERENCE:
     * 3S after 3H(opp) = 4+ spades. Opener might or might not have 4H (blocked).
     */
    const result = suggestCall(opener2NTWith4S(), Seat.North, ["2NT", "P", "3C", "3H"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test.skip("after 2NT-P-3C-3H(opp): opener no major passes", () => {
    /*
     * BRIDGE THEORY:
     * With no 4-card major and 3H blocking the denial bid (3D), opener
     * passes. Responder can then bid 3NT, double for penalty, or compete.
     * Unlike after 1NT where opener would bid 2D denial, at 2NT level the
     * 3D denial is stolen by the 3H overcall. Pass is the only option.
     *
     * REQUIRES:
     * - Round 2 interference overlay: pass when no major and overcalled
     * - Responder handles the pass correctly in round 3
     *
     * INFERENCE:
     * Pass by opener after 3H(opp) = no 4-card major available to show.
     * [PARTNERSHIP-DEPENDENT] — some play double = "I have something to say."
     */
    const result = suggestCall(opener2NTNoMajor(), Seat.North, ["2NT", "P", "3C", "3H"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("pass");
  });

  test.skip("after 2NT-P-3C-3S(opp): opener must bid at 4-level — only with extras", () => {
    /*
     * BRIDGE THEORY:
     * 3S overcall blocks both major responses at the 3-level. To show hearts,
     * opener must bid 4H (game level). This should only happen with maximum 2NT
     * (21 HCP) and genuine 4+ hearts, because 4H is already game. With 4S,
     * opener cannot bid 4S over 3S (that would be a cue bid). With no major
     * or minimum, opener passes or doubles.
     *
     * REQUIRES:
     * - Round 2 interference overlay for 3S overcall
     * - Level-awareness: responses forced to 4-level
     * - Extra-values check for 4-level free bid (21 HCP, not 20)
     *
     * INFERENCE:
     * 4H after 3S(opp) = 4+ hearts, maximum 2NT (21 HCP), game commitment.
     */
    const result = suggestCall(opener2NTWith4H(), Seat.North, ["2NT", "P", "3C", "3S"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Hearts);
  });
});

// ─── Round 3: Responder rebids (level-awareness) ────────

describe("2NT Round 3: responder rebids (level-awareness)", () => {
  test.skip("after 3D denial: responder bids 3NT (NOT 2NT invite — already above 2NT)", () => {
    /*
     * BRIDGE THEORY:
     * After 2NT-P-3C-P-3D-P, responder bids 3NT. The critical difference from
     * 1NT Stayman: after 1NT-P-2C-P-2D-P, responder with 8-9 HCP bids 2NT
     * (invitational). After 2NT, there IS no invite level — we're already
     * above 2NT. Any continuation is game-forcing. 3NT is the natural game bid.
     *
     * REQUIRES:
     * - Level-aware rebid tree: 3NT (not 2NT) after 2NT Stayman denial
     * - staymanLevel(state) returning 3 for "2nt" familyId
     * - Current tree produces 2NT (wrong level) — needs separate 2NT rebid tree
     *
     * INFERENCE:
     * 3NT after 3D denial = balanced game values, no 4-card major fit found.
     */
    const result = suggestCall(responder10With4H(), Seat.South, ["2NT", "P", "3C", "P", "3D", "P"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.NoTrump);
  });

  test.skip("after 3H response: responder with 4H raises to 4H", () => {
    /*
     * BRIDGE THEORY:
     * Opener showed 4H with 3H. Responder with 4H raises to 4H (game).
     * After 1NT Stayman, responder raises 2H to 4H with GF or 3H with invite.
     * After 2NT, there's no invite level — responder jumps directly to 4H (game).
     * The raise is one level higher than after 1NT (3H→4H vs 2H→4H/3H).
     *
     * REQUIRES:
     * - Level-aware major-fit rebid: 4H (not 3H invite or 4H from 2-level)
     * - Rebid tree must produce 4H when opener showed 3H
     *
     * INFERENCE:
     * 4H = major fit confirmed, game. No invite distinction at 2NT level.
     */
    const result = suggestCall(responder10With4H(), Seat.South, ["2NT", "P", "3C", "P", "3H", "P"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test.skip("after 3S response: responder with 4S raises to 4S", () => {
    /*
     * BRIDGE THEORY:
     * Mirror of 3H→4H: opener showed 4S with 3S, responder with 4S raises to 4S.
     * After 2NT, all fits go directly to game. No invite level exists.
     *
     * REQUIRES:
     * - Level-aware major-fit rebid: 4S
     * - Rebid tree aware of 3-level responses from 2NT Stayman
     *
     * INFERENCE:
     * 4S = major fit confirmed, game.
     */
    const result = suggestCall(responder8With4S4H(), Seat.South, ["2NT", "P", "3C", "P", "3S", "P"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test.skip("after 3D denial: Smolen 4H (5H+4S GF) — level shifted from 3H", () => {
    /*
     * BRIDGE THEORY:
     * After 1NT Stayman: 2D denial → Smolen 3H shows 4S+5H GF (bid shorter major).
     * After 2NT Stayman: 3D denial → Smolen shifts UP one level to 4H.
     * This is because 3H is "consumed" by the 2NT response level.
     * Smolen 4H = 4S + 5H, asking opener to choose between 4H (with 3H fit)
     * or 4S (with 4S fit) or 3NT.
     *
     * REQUIRES:
     * - Level-aware Smolen resolver: 4H (not 3H) after 2NT denial
     * - staymanLevel(state) = 3 → Smolen at level 4
     * - Current tree produces 3H Smolen (wrong level for 2NT)
     *
     * INFERENCE:
     * 4H Smolen after 3D = 4S + 5H, game-forcing. Level-shifted from 1NT's 3H Smolen.
     */
    const result = suggestCall(smolen5H4S(), Seat.South, ["2NT", "P", "3C", "P", "3D", "P"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test.skip("after 3D denial: Smolen 4S (5S+4H GF) — level shifted from 3S", () => {
    /*
     * BRIDGE THEORY:
     * Mirror of Smolen 4H: after 2NT-P-3C-P-3D-P, Smolen 4S shows 5S + 4H GF.
     * At 1NT level this would be 3S. At 2NT level it shifts to 4S.
     * Opener chooses between 4S (with 3S fit) or 4H (with 4H fit) or pass (4S).
     *
     * REQUIRES:
     * - Level-aware Smolen resolver: 4S (not 3S) after 2NT denial
     * - staymanLevel(state) = 3 → Smolen at level 4
     *
     * INFERENCE:
     * 4S Smolen after 3D = 5S + 4H, game-forcing. Level-shifted from 1NT's 3S Smolen.
     */
    const result = suggestCall(smolen5S4H(), Seat.South, ["2NT", "P", "3C", "P", "3D", "P"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test.skip("after 3D-3H(opp): Smolen blocked, bid 4H natural", () => {
    /*
     * BRIDGE THEORY:
     * After 2NT-P-3C-P-3D-3H(opp), opponent's 3H blocks the Smolen 3H bid
     * (which at 2NT level would be 4H anyway). With 5H, responder bids 4H
     * as a natural bid showing 5+ hearts. The Smolen convention is abandoned
     * under interference — natural bids take over.
     *
     * REQUIRES:
     * - Round 3 interference overlay for 3H overcall after 3D denial
     * - Natural 4H = 5+ hearts (no longer Smolen)
     * - Level-awareness: 4H is game, commitment is automatic
     *
     * INFERENCE:
     * 4H over 3H(opp) after 3D denial = 5+ hearts, natural, GF.
     * [PARTNERSHIP-DEPENDENT] — Smolen vs natural treatment under interference.
     */
    const result = suggestCall(smolen5H4S(), Seat.South, ["2NT", "P", "3C", "P", "3D", "3H"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test.skip("after 3H-3S(opp): responder with heart fit bids 4H game", () => {
    /*
     * BRIDGE THEORY:
     * After 2NT-P-3C-P-3H-3S(opp), opponent overcalls 3S. Responder with
     * heart fit still raises to 4H (game). The 3S overcall doesn't block
     * the 4H raise. At 2NT level, the raise to game is automatic — no
     * invite level exists.
     *
     * REQUIRES:
     * - Round 3 interference overlay for 3S overcall after 3H response
     * - 4H = heart fit, game (not invitational raise to 3H)
     *
     * INFERENCE:
     * 4H over 3S(opp) = 4+ hearts, game raise, fit confirmed.
     */
    const result = suggestCall(responder10With4H(), Seat.South, ["2NT", "P", "3C", "P", "3H", "3S"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test.skip("after 3D denial: invite hand bids 3NT (game is minimum opposite 2NT)", () => {
    /*
     * BRIDGE THEORY:
     * After 1NT Stayman denial, an 8-9 HCP hand bids 2NT (invite). After
     * 2NT Stayman denial, there IS no invite — 3NT is the minimum game bid.
     * With 8 HCP opposite 20-21, combined is 28-29 — enough for 3NT.
     * The invite/signoff distinction disappears at the 2NT level.
     * ANY hand that used Stayman over 2NT commits to at least 3NT.
     *
     * REQUIRES:
     * - Level-aware rebid tree: no 2NT invite after 2NT opening
     * - 3NT = to play, no fit found, game values confirmed
     * - Current tree may produce 2NT invite (wrong for 2NT Stayman)
     *
     * INFERENCE:
     * 3NT after 3D = game signoff, no major fit. Not invitational.
     */
    const result = suggestCall(responder8With4S4H(), Seat.South, ["2NT", "P", "3C", "P", "3D", "P"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.NoTrump);
  });

  test.skip("after 3S-4C(opp): responder passes with minimum", () => {
    /*
     * BRIDGE THEORY:
     * After 2NT-P-3C-P-3S-4C(opp), opponent competes at 4C. Responder with
     * minimum hand (5 HCP, no spade fit) passes. 4H would be the 4-level and
     * risks going down. Opener with extra values can double or bid.
     * At 2NT level, even minimum responders have some values — but not enough
     * to compete at the 4-level without a fit.
     *
     * REQUIRES:
     * - Round 3 interference overlay for 4C overcall after 3S
     * - Pass threshold for no-fit minimum after 2NT Stayman
     * - Level-awareness: 4-level competition very different from 3-level
     *
     * INFERENCE:
     * Pass after 4C(opp) = no spade fit, insufficient values to compete at 4-level.
     */
    const result = suggestCall(responder5With4H(), Seat.South, ["2NT", "P", "3C", "P", "3S", "4C"]);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("pass");
  });

  test.skip("after 3H response with interference: responder competes", () => {
    /*
     * BRIDGE THEORY:
     * After 2NT-P-3C-P-3H-X (opponent doubles 3H), responder with 4H and
     * game values should redouble (showing heart fit + strength) or bid 4H
     * directly. With 10 HCP opposite 20-21, combined is 30-31 — plenty
     * for 4H game. The double actually helps: redouble shows extras, or
     * responder can bid 4H to end the auction.
     *
     * REQUIRES:
     * - Round 3 interference overlay for doubled 3H response
     * - Redouble vs direct raise decision
     * - Level-aware: 4H is game (not competitive raise)
     *
     * INFERENCE:
     * 4H after 3H-X = heart fit, game bid, rejecting penalty redouble.
     * [PARTNERSHIP-DEPENDENT] — redouble vs direct raise treatment.
     */
    const result = suggestCall(responder10With4H(), Seat.South, ["2NT", "P", "3C", "P", "3H", "X"]);
    expect(result).not.toBeNull();
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Hearts);
  });
});
