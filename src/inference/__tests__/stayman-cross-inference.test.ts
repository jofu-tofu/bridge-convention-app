/**
 * Cross-convention inference tests for Stayman.
 *
 * These tests verify that the inference engine correctly extracts hand
 * constraints from observed Stayman convention bids -- both when WE observe
 * opponents using Stayman, and when inferences from our own Stayman sequence
 * inform subsequent competitive decisions.
 *
 * All tests are test.skip() -- they define target behavior for the inference
 * system that hasn't been implemented yet. Each test documents the bridge
 * theory, required infrastructure, and expected inference outcomes.
 */

import { describe, test, expect } from "vitest";
// These types are used in commented-out future API calls throughout this file.
// They document the expected imports for the inference engine API.
// import { Seat, BidSuit, Vulnerability } from "../../engine/types";
// import type { Hand } from "../../engine/types";
import { hand } from "../../conventions/__tests__/fixtures";

// ─── Placeholder inference API ───────────────────────────
// These represent the expected inference engine API. The actual
// implementation will provide these functions.

/**
 * Placeholder: Given an auction observed from a seat, infer constraints
 * on each player's hand based on their bids and known conventions.
 *
 * Future API: inferFromAuction(auction, observingSeat, conventionMap) -> InferenceResult
 * where InferenceResult has per-seat hand constraints (HCP range, suit lengths, etc.)
 */
// import { inferFromAuction } from "../inference-engine";

/**
 * Placeholder: Given our hand and inferences about opponents' hands,
 * determine what cards are "available" (not held by a specific player).
 *
 * Future API: computeAvailableCards(myHand, inferences) -> AvailableCards
 */
// import { computeAvailableCards } from "../inference-engine";

// ═══════════════════════════════════════════════════════════
// Positive inference from opponent's Stayman bids
// ═══════════════════════════════════════════════════════════

describe("Positive inference from opponent's Stayman bids", () => {
  test.skip("opponent's 1NT opening infers 15-17 HCP balanced", () => {
    /**
     * BRIDGE THEORY: A 1NT opening bid in standard methods promises:
     * (1) 15-17 HCP (this is the standard range; some play 12-14 or 16-18)
     * (2) Balanced distribution: 4-3-3-3, 4-4-3-2, or 5-3-3-2 (with 5 in a minor)
     * (3) No singleton or void
     * (4) No 5-card major (most partnerships)
     *
     * This is the foundation for all subsequent Stayman inferences. Once
     * the opener is placed in this narrow range, the responder's actions
     * refine the picture further.
     *
     * REQUIRES:
     * - InferenceEngine that recognizes 1NT opening from natural bidding theory
     * - Convention-aware provider OR natural provider (1NT is natural)
     * - HCP range narrowing: 15-17 (from initial 0-40 range)
     * - Shape inference: balanced (no suit > 5, no suit < 2)
     *
     * INFERENCE RESULT:
     * - Opener: 15 <= HCP <= 17, all suits 2-5, no 5-card major
     * - Other seats: HCP reduced by 15-17 total available
     */
    // Future API:
    // const result = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT"]),
    //   Seat.East,
    //   { north: "stayman", south: "stayman" }
    // );
    // expect(result.seats[Seat.North].hcpMin).toBe(15);
    // expect(result.seats[Seat.North].hcpMax).toBe(17);
    // expect(result.seats[Seat.North].isBalanced).toBe(true);
    expect(true).toBe(true); // Placeholder assertion
  });

  test.skip("opponent's 2C Stayman ask infers 8+ HCP and at least one 4-card major", () => {
    /**
     * BRIDGE THEORY: A Stayman 2C response to 1NT guarantees:
     * (1) At least 8 HCP (minimum for game invitation opposite 15-17)
     * (2) At least one 4-card major (otherwise Stayman serves no purpose)
     * (3) NOT a hand that would transfer (5+ major -> Jacoby transfer instead)
     *     Exception: 5-4 major hands may use Stayman then Smolen
     *
     * The 2C bid is artificial -- it says nothing about clubs. This is
     * critical for inference: do NOT infer club length from 2C Stayman.
     * The inference engine must recognize the alert/convention context
     * to avoid false natural inferences.
     *
     * REQUIRES:
     * - InferenceEngine.inferFromAuction() that recognizes Stayman sequences
     * - Convention-aware inference provider that knows Stayman conditions
     * - Per-seat constraint accumulation: responder's constraints from 2C bid
     * - Artificial bid detection: 2C is NOT natural clubs
     *
     * INFERENCE RESULT:
     * - Responder: HCP >= 8, max(spadeLength, heartLength) >= 4
     * - Opener: 15-17 HCP, balanced (already inferred from 1NT)
     * - Negative: responder unlikely to have 5+ major (would transfer)
     *   unless 5-4+ in majors (Smolen candidate)
     */
    // Future API:
    // const result = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT", "P", "2C"]),
    //   Seat.East,
    //   { north: "stayman", south: "stayman" }
    // );
    // expect(result.seats[Seat.South].hcpMin).toBeGreaterThanOrEqual(8);
    // expect(result.seats[Seat.South].hasFourCardMajor).toBe(true);
    // expect(result.seats[Seat.South].clubs).toBeUndefined(); // artificial, no club inference
    expect(true).toBe(true); // Placeholder assertion
  });

  test.skip("opponent opener responds 2H showing 4+ hearts", () => {
    /**
     * BRIDGE THEORY: After 1NT-P-2C-P, opener's 2H response shows:
     * (1) 4+ hearts (opener bids hearts when holding both majors, per
     *     standard agreement -- "up the line" or "hearts first")
     * (2) May or may not have 4 spades -- 2H does NOT deny spades
     * (3) Still 15-17 HCP balanced from the 1NT opening
     *
     * Some partnerships agree to bid 2S with both majors (show spades
     * first). The inference engine needs to handle both styles but should
     * default to the standard "hearts first with both" agreement.
     *
     * REQUIRES:
     * - Protocol-aware inference: 2H meaning depends on preceding 1NT-2C
     * - Positive suit length inference: hearts >= 4
     * - Accumulated opener constraints: 15-17 balanced + 4+ hearts
     *
     * INFERENCE RESULT:
     * - Opener: hearts >= 4, 15-17 HCP, balanced
     * - Responder: still 8+ HCP, has a 4-card major
     */
    // Future API:
    // const result = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT", "P", "2C", "P", "2H"]),
    //   Seat.East,
    //   { north: "stayman", south: "stayman" }
    // );
    // expect(result.seats[Seat.North].suits.hearts.min).toBeGreaterThanOrEqual(4);
    // expect(result.seats[Seat.North].hcpMin).toBe(15);
    expect(true).toBe(true); // Placeholder assertion
  });

  test.skip("opponent opener responds 2S showing 4+ spades and denying 4 hearts", () => {
    /**
     * BRIDGE THEORY: After 1NT-P-2C-P, opener's 2S response shows:
     * (1) 4+ spades
     * (2) Denies 4+ hearts (with both majors, standard agreement bids 2H)
     * (3) Hearts <= 3
     * (4) Still 15-17 HCP balanced
     *
     * This is a KEY inference for defenders: opener has at most 3 hearts.
     * If we hold a heart honor, we know it will be useful on defense.
     * The denial of hearts (negative inference from protocol path) is as
     * valuable as the positive spade inference.
     *
     * REQUIRES:
     * - Negative inference from protocol path: choosing 2S over 2H
     * - Standard "hearts first" partnership agreement
     * - Accumulated constraints on opener
     *
     * INFERENCE RESULT:
     * - Opener: spades >= 4, hearts <= 3, 15-17 HCP, balanced
     */
    // Future API:
    // const result = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT", "P", "2C", "P", "2S"]),
    //   Seat.East,
    //   { north: "stayman", south: "stayman" }
    // );
    // expect(result.seats[Seat.North].suits.spades.min).toBeGreaterThanOrEqual(4);
    // expect(result.seats[Seat.North].suits.hearts.max).toBeLessThanOrEqual(3);
    expect(true).toBe(true); // Placeholder assertion
  });

  test.skip("opponent opener responds 2D denying any 4-card major", () => {
    /**
     * BRIDGE THEORY: After 1NT-P-2C-P, opener's 2D "denial" response shows:
     * (1) No 4-card major (hearts <= 3, spades <= 3)
     * (2) The 2D bid is artificial -- says nothing about diamonds
     * (3) Still 15-17 HCP balanced
     * (4) Shape must be 3-3-x-x or 2-3-x-x or 3-2-x-x (minors heavy)
     *
     * This is the most informative single bid in Stayman: it tells us
     * opener has at most 7 cards in the majors combined, meaning at least
     * 6 cards in the minors. This significantly constrains opener's shape.
     *
     * REQUIRES:
     * - Artificial bid recognition (2D denial is not natural diamonds)
     * - Double negative inference: hearts <= 3 AND spades <= 3
     * - Shape deduction: minors >= 6 total
     *
     * INFERENCE RESULT:
     * - Opener: hearts <= 3, spades <= 3, 15-17 HCP, balanced
     * - Minor suits combined >= 6 cards
     */
    // Future API:
    // const result = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT", "P", "2C", "P", "2D"]),
    //   Seat.East,
    //   { north: "stayman", south: "stayman" }
    // );
    // expect(result.seats[Seat.North].suits.hearts.max).toBeLessThanOrEqual(3);
    // expect(result.seats[Seat.North].suits.spades.max).toBeLessThanOrEqual(3);
    expect(true).toBe(true); // Placeholder assertion
  });

  test.skip("opponent responder raises 2H to 4H showing game values with 4+ heart fit", () => {
    /**
     * BRIDGE THEORY: After 1NT-P-2C-P-2H-P, responder bidding 4H shows:
     * (1) 4+ hearts (fit found -- opener showed 4H, responder confirms)
     * (2) Game-going values: 10+ HCP (combined 25+ with opener's 15-17)
     * (3) Not slam interest (would bid 4NT or cue-bid with 16+ HCP)
     * (4) The 4H raise is a sign-off, not invitational
     *
     * Combined partnership inference: at least 8 hearts between them
     * (4+4), 25-27 combined HCP (15-17 + 10ish). Defenders know they
     * are outgunned in hearts and HCP.
     *
     * REQUIRES:
     * - Multi-round protocol inference tracking
     * - Responder's HCP range refinement: 10+ (game) but not 16+ (slam try)
     * - Partnership combined inference: heart fit >= 8 cards
     *
     * INFERENCE RESULT:
     * - Responder: 10+ HCP, hearts >= 4
     * - Combined: hearts >= 8, HCP 25-27
     */
    // Future API:
    // const result = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT", "P", "2C", "P", "2H", "P", "4H"]),
    //   Seat.East,
    //   { north: "stayman", south: "stayman" }
    // );
    // expect(result.seats[Seat.South].hcpMin).toBeGreaterThanOrEqual(10);
    // expect(result.seats[Seat.South].suits.hearts.min).toBeGreaterThanOrEqual(4);
    expect(true).toBe(true); // Placeholder assertion
  });

  test.skip("opponent responder bids 3NT after 2D denial showing game values without major fit", () => {
    /**
     * BRIDGE THEORY: After 1NT-P-2C-P-2D-P, responder bidding 3NT shows:
     * (1) Game-going values: 10+ HCP (combined 25+ for game)
     * (2) No 4-card major fit (opener denied with 2D, responder confirms
     *     by choosing NT instead of bidding a major)
     * (3) Balanced or semi-balanced hand (content to play 3NT)
     * (4) Responder had a 4-card major (bid Stayman) but it wasn't matched
     *
     * This refines the responder: they had exactly one 4-card major (or 4-4
     * in majors but settled for NT when opener denied both).
     *
     * REQUIRES:
     * - End-of-sequence inference: 3NT sign-off refines responder's hand
     * - Responder shape: had a 4-card major but no fit, so playing NT
     *
     * INFERENCE RESULT:
     * - Responder: 10+ HCP, at least one 4-card major (from 2C), balanced
     * - Opener: no 4-card major (from 2D denial)
     * - Combined: 25-27 HCP, no major fit
     */
    // Future API:
    // const result = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT", "P", "2C", "P", "2D", "P", "3NT"]),
    //   Seat.East,
    //   { north: "stayman", south: "stayman" }
    // );
    // expect(result.seats[Seat.South].hcpMin).toBeGreaterThanOrEqual(10);
    // expect(result.seats[Seat.North].suits.hearts.max).toBeLessThanOrEqual(3);
    // expect(result.seats[Seat.North].suits.spades.max).toBeLessThanOrEqual(3);
    expect(true).toBe(true); // Placeholder assertion
  });

  test.skip("opponent responder bids 2NT after 2D denial showing invitational values", () => {
    /**
     * BRIDGE THEORY: After 1NT-P-2C-P-2D-P, responder bidding 2NT shows:
     * (1) Invitational values: 8-9 HCP (combined 23-26 with opener's 15-17)
     * (2) No 4-card major fit (opener denied)
     * (3) Balanced hand, offering opener the choice of passing or bidding 3NT
     * (4) NOT game-forcing (that would be 3NT directly)
     *
     * The 2NT bid is the weakest game-try responder can make after
     * Stayman fails to find a fit. Opener passes with 15, bids 3NT with 17,
     * and uses judgment with 16.
     *
     * REQUIRES:
     * - Invitational range recognition: 8-9 HCP (not 10+ which bids 3NT)
     * - Precise HCP bounds from the non-forcing nature of 2NT
     *
     * INFERENCE RESULT:
     * - Responder: 8-9 HCP, at least one 4-card major, balanced
     * - Opener: no 4-card major, 15-17 HCP, will decide on 3NT
     */
    // Future API:
    // const result = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT", "P", "2C", "P", "2D", "P", "2NT"]),
    //   Seat.East,
    //   { north: "stayman", south: "stayman" }
    // );
    // expect(result.seats[Seat.South].hcpMin).toBe(8);
    // expect(result.seats[Seat.South].hcpMax).toBe(9);
    expect(true).toBe(true); // Placeholder assertion
  });

  test.skip("opponent responder bids Smolen 3H showing 4 spades and 5+ hearts game-forcing", () => {
    /**
     * BRIDGE THEORY: After 1NT-P-2C-P-2D-P, responder's 3H (Smolen) shows:
     * (1) 5+ hearts and exactly 4 spades (bids the 4-card major at 3-level)
     * (2) Game-forcing values: 10+ HCP
     * (3) Wants opener to choose between 3NT and 4H (opener bids 4H with 3+ hearts)
     * (4) The 3H bid is artificial under Smolen -- it shows the OTHER major's length
     *
     * Smolen is the exception to "5+ major -> transfer": with 5-4 in majors,
     * responder uses Stayman first, then bids the 4-card major to allow
     * opener to be declarer in the 5-3 fit.
     *
     * REQUIRES:
     * - Smolen convention recognition within Stayman protocol
     * - Precise shape inference: 5+ hearts, exactly 4 spades
     * - Game-forcing strength inference
     *
     * INFERENCE RESULT:
     * - Responder: hearts >= 5, spades == 4, HCP >= 10
     * - Opener: no 4-card major (from 2D denial), 15-17 HCP
     */
    // Future API:
    // const result = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT", "P", "2C", "P", "2D", "P", "3H"]),
    //   Seat.East,
    //   { north: "stayman", south: "stayman" }
    // );
    // expect(result.seats[Seat.South].suits.hearts.min).toBeGreaterThanOrEqual(5);
    // expect(result.seats[Seat.South].suits.spades.min).toBe(4);
    // expect(result.seats[Seat.South].suits.spades.max).toBe(4);
    // expect(result.seats[Seat.South].hcpMin).toBeGreaterThanOrEqual(10);
    expect(true).toBe(true); // Placeholder assertion
  });
});

// ═══════════════════════════════════════════════════════════
// Negative inference from tree rejection
// ═══════════════════════════════════════════════════════════

describe("Negative inference from tree rejection", () => {
  test.skip("opponent did not redouble after our double of 1NT infers < 10 HCP", () => {
    /**
     * BRIDGE THEORY: After 1NT-X, responder's failure to redouble suggests:
     * (1) Less than 10 HCP (with 10+, redouble is standard to show strength)
     * (2) Redouble is penalty-oriented, showing the partnership has the
     *     majority of HCP and wants to defend 1NT-X
     * (3) Not redoubling leaves open escape routes (natural bids at 2-level)
     *
     * The tree rejection path: the inference engine tried the "redouble"
     * IntentNode, found the HCP condition (10+ HCP) failed, and the
     * inverse tells us responder has < 10 HCP.
     *
     * REQUIRES:
     * - Tree rejection data from evaluateTree(): rejectedDecisions
     * - invertInference() on the HCP minimum condition
     * - Negative inference accumulation: upper bound on responder's HCP
     *
     * INFERENCE RESULT:
     * - Responder: HCP <= 9 (failed the 10+ HCP check for redouble)
     * - Opener: still 15-17 HCP from 1NT
     */
    // Future API:
    // const result = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT", "X", "P"]),
    //   Seat.East,
    //   { north: "stayman", south: "stayman" }
    // );
    // expect(result.seats[Seat.South].hcpMax).toBeLessThanOrEqual(9);
    expect(true).toBe(true); // Placeholder assertion
  });

  test.skip("opponent passed after 1NT-X infers weak hand without escape suit", () => {
    /**
     * BRIDGE THEORY: After 1NT-X, responder passing (instead of running)
     * could mean several things, but the inference engine should extract:
     * (1) Fewer than 8 HCP (no Stayman, no transfer, no escape bid)
     * (2) No 5+ card suit worth escaping to (would bid a natural 2-level)
     * (3) OR: responder has a trap pass (good hand, wants to defend 1NTX)
     *
     * The ambiguity of the pass (weakness vs trap) limits inference
     * strength. The engine should provide a RANGE rather than a point
     * estimate, and flag the alternative interpretation.
     *
     * REQUIRES:
     * - Pass inference in competitive context (different from uncontested pass)
     * - Ambiguity modeling: pass could be weak OR trap
     * - Conservative inference: report the wider range
     *
     * INFERENCE RESULT:
     * - Responder: HCP 0-9 (wide range due to pass ambiguity)
     * - Negative: no 5+ suit (would have escaped)
     * - Alternative: HCP 10+ trap pass (flagged as lower-probability)
     */
    // Future API:
    // const result = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT", "X", "P"]),
    //   Seat.East,
    //   { north: "stayman", south: "stayman" }
    // );
    // expect(result.seats[Seat.South].hcpMax).toBeLessThanOrEqual(9);
    // expect(result.seats[Seat.South].alternatives).toContainEqual(
    //   expect.objectContaining({ type: "trap-pass", hcpMin: 10 })
    // );
    expect(true).toBe(true); // Placeholder assertion
  });

  test.skip("opponent escaped to 2H after double infers 5+ hearts and weak hand", () => {
    /**
     * BRIDGE THEORY: After 1NT-X, responder bidding 2H shows:
     * (1) 5+ hearts (natural escape, not Jacoby transfer in competition)
     * (2) Weak hand -- trying to find a safer contract than 1NTX
     * (3) Not interested in penalizing (would pass or redouble with strength)
     * (4) Systems are typically OFF after interference
     *
     * When systems are off, 2H is natural, not a transfer. The inference
     * engine must detect the interference context and adjust accordingly.
     *
     * REQUIRES:
     * - Interference-aware convention detection (systems off after X)
     * - Natural bid inference: 2H = 5+ hearts (not artificial)
     * - Competitive context HCP inference: weak (0-7 HCP typically)
     *
     * INFERENCE RESULT:
     * - Responder: hearts >= 5, HCP <= 7 (escape, not constructive)
     * - Systems are off: no Stayman/transfer inferences apply
     */
    // Future API:
    // const result = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT", "X", "2H"]),
    //   Seat.East,
    //   { north: "stayman", south: "stayman" }
    // );
    // expect(result.seats[Seat.South].suits.hearts.min).toBeGreaterThanOrEqual(5);
    // expect(result.seats[Seat.South].hcpMax).toBeLessThanOrEqual(7);
    expect(true).toBe(true); // Placeholder assertion
  });

  test.skip("opener's 2D denial infers no 4-card major (hearts <= 3 and spades <= 3)", () => {
    /**
     * BRIDGE THEORY: The 2D denial is the canonical negative inference
     * from Stayman. Opener choosing 2D over 2H or 2S means:
     * (1) hearts <= 3 (rejected the "has-4-hearts" decision node)
     * (2) spades <= 3 (rejected the "has-4-spades" decision node)
     *
     * This is STRUCTURAL negative inference from the tree: the evaluator
     * walked the tree, found the heart and spade length checks failed,
     * and the inverse of those conditions tells us the hand shape.
     *
     * REQUIRES:
     * - evaluateTree() returning rejectedDecisions for both major checks
     * - invertInference(suit-min hearts 4) -> suit-max hearts 3
     * - invertInference(suit-min spades 4) -> suit-max spades 3
     * - Both negatives accumulated on the same seat
     *
     * INFERENCE RESULT:
     * - Opener: hearts <= 3, spades <= 3 (from two rejected decisions)
     * - Opener: combined majors <= 6, combined minors >= 7
     */
    // Future API:
    // const result = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT", "P", "2C", "P", "2D"]),
    //   Seat.East,
    //   { north: "stayman", south: "stayman" }
    // );
    // expect(result.seats[Seat.North].suits.hearts.max).toBeLessThanOrEqual(3);
    // expect(result.seats[Seat.North].suits.spades.max).toBeLessThanOrEqual(3);
    expect(true).toBe(true); // Placeholder assertion
  });

  test.skip("responder did not bid Smolen infers not 5-4 in majors or < 10 HCP", () => {
    /**
     * BRIDGE THEORY: After 1NT-P-2C-P-2D-P, responder bidding 2NT or 3NT
     * (instead of Smolen 3H/3S) tells us:
     * (1) NOT 5-4+ in the majors (would use Smolen to show 5-4 shape)
     * (2) OR: less than 10 HCP (Smolen is game-forcing; with invite
     *     values and 5-4 shape, responder might just bid 2NT)
     *
     * The absence of Smolen is a negative inference: the engine checks
     * whether the Smolen path was available but not taken. If the hand
     * conditions for Smolen failed (not 5-4 shape), we learn the hand
     * is more balanced. If the HCP conditions failed, we learn it's weaker.
     *
     * REQUIRES:
     * - Negative inference from Smolen IntentNode rejection
     * - Shape negation: NOT (hearts >= 5 AND spades == 4) AND NOT (spades >= 5 AND hearts == 4)
     * - OR: HCP negation (< 10 HCP, Smolen requires game-forcing values)
     *
     * INFERENCE RESULT:
     * - Responder: either not 5-4 in majors, or < 10 HCP
     * - With 3NT: HCP >= 10 but shape is balanced (4-3-3-3 or 4-4-3-2 with 4M)
     * - With 2NT: HCP 8-9, any shape without 5-4 majors
     */
    // Future API:
    // const result = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT", "P", "2C", "P", "2D", "P", "3NT"]),
    //   Seat.East,
    //   { north: "stayman", south: "stayman" }
    // );
    // For 3NT: responder has game values but not 5-4 majors
    // expect(result.seats[Seat.South].hcpMin).toBeGreaterThanOrEqual(10);
    // Smolen shape should be negated: not 5-4 in majors
    // expect(result.seats[Seat.South].hasSmolenshape).toBe(false);
    expect(true).toBe(true); // Placeholder assertion
  });

  test.skip("responder bid 2NT invite not 3NT infers exactly 8-9 HCP", () => {
    /**
     * BRIDGE THEORY: After 1NT-P-2C-P-2D-P, the choice of 2NT vs 3NT
     * precisely defines responder's HCP range:
     * (1) 2NT = invitational = 8-9 HCP (might make game, might not)
     * (2) 3NT = game values = 10+ HCP (game is assured)
     *
     * The 2NT bid reveals that responder is NOT strong enough for game.
     * This is a choice-based inference: the fact that responder COULD have
     * bid 3NT but chose 2NT tells us the hand is in the 8-9 range.
     *
     * REQUIRES:
     * - Path comparison: 2NT path vs 3NT path, different HCP thresholds
     * - Precise range bounding: both floor (8) and ceiling (9)
     * - Negative inference from NOT bidding 3NT: HCP < 10
     *
     * INFERENCE RESULT:
     * - Responder: 8 <= HCP <= 9 (exactly invitational)
     */
    // Future API:
    // const result = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT", "P", "2C", "P", "2D", "P", "2NT"]),
    //   Seat.East,
    //   { north: "stayman", south: "stayman" }
    // );
    // expect(result.seats[Seat.South].hcpMin).toBe(8);
    // expect(result.seats[Seat.South].hcpMax).toBe(9);
    expect(true).toBe(true); // Placeholder assertion
  });
});

// ═══════════════════════════════════════════════════════════
// Alert-based inference
// ═══════════════════════════════════════════════════════════

describe("Alert-based inference", () => {
  test.skip("alerted 2C as Stayman (artificial) enables full convention inference", () => {
    /**
     * BRIDGE THEORY: In duplicate bridge, artificial bids must be alerted.
     * When 2C after 1NT is alerted as "Stayman, asking for majors":
     * (1) We KNOW it is artificial -- no club length inference
     * (2) Full Stayman convention inference applies (8+ HCP, 4-card major)
     * (3) The alert confirms the partnership agreement, removing ambiguity
     *
     * Alerts are the bridge mechanism for transparent convention usage.
     * The inference engine should treat alerts as confirmation of the
     * convention mapping, upgrading inference confidence from "probable"
     * to "certain" (within the convention's documented constraints).
     *
     * REQUIRES:
     * - Alert metadata on BidAnnotation (alert field)
     * - Alert-aware inference: confirmed artificial overrides natural
     * - Confidence levels: alerted convention = high confidence
     *
     * INFERENCE RESULT:
     * - Responder: confirmed 8+ HCP, confirmed 4-card major
     * - NO club inference (alert confirms artificial nature)
     * - Confidence: HIGH (alert confirms convention)
     */
    // Future API:
    // const result = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT", "P", "2C!"]),  // ! = alerted
    //   Seat.East,
    //   { north: "stayman", south: "stayman" }
    // );
    // expect(result.seats[Seat.South].hcpMin).toBeGreaterThanOrEqual(8);
    // expect(result.seats[Seat.South].confidence).toBe("high");
    // expect(result.seats[Seat.South].suits.clubs.inferred).toBe(false); // no club inference
    expect(true).toBe(true); // Placeholder assertion
  });

  test.skip("unalerted 2C after 1NT may be natural clubs producing weaker inference", () => {
    /**
     * BRIDGE THEORY: If 2C after 1NT is NOT alerted, there are two
     * possibilities:
     * (1) It is Stayman but the opponents forgot to alert (common at
     *     lower levels -- alert rules are sometimes missed)
     * (2) It is a natural 2C bid (rare in modern bridge after 1NT, but
     *     possible in some non-standard systems)
     *
     * Without an alert, the inference engine should hedge: give partial
     * weight to both interpretations. In practice, most 2C bids after
     * 1NT ARE Stayman, so the engine might still favor that interpretation
     * but with lower confidence.
     *
     * REQUIRES:
     * - Alert absence detection
     * - Dual interpretation with probability weights
     * - Conservative inference: wider HCP range, uncertain suit lengths
     *
     * INFERENCE RESULT:
     * - Responder: HCP >= 6 (wider range, could be natural or Stayman)
     * - Confidence: LOW (no alert, interpretation uncertain)
     * - Possible club length inference if natural interpretation weighted
     */
    // Future API:
    // const result = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT", "P", "2C"]),  // no alert
    //   Seat.East,
    //   { north: "unknown", south: "unknown" }  // no convention mapping
    // );
    // expect(result.seats[Seat.South].confidence).toBe("low");
    // expect(result.seats[Seat.South].hcpMin).toBeLessThanOrEqual(6); // wider range
    expect(true).toBe(true); // Placeholder assertion
  });

  test.skip("alert on redouble after double confirms penalty intent and strong hand", () => {
    /**
     * BRIDGE THEORY: After 1NT-X, a redouble that is alerted as
     * "penalty, wants to play 1NT redoubled" confirms:
     * (1) 10+ HCP (strong enough to want to defend)
     * (2) Partnership has 25+ combined HCP, likely making 1NTXX
     * (3) No desire to run -- confident in defense
     *
     * Some partnerships play redouble as an escape mechanism (asking
     * partner to bid a suit), so the alert is crucial to distinguish
     * penalty from escape redoubles.
     *
     * REQUIRES:
     * - Alert-based disambiguation: penalty vs escape redouble
     * - HCP lower bound from penalty intent: 10+
     * - Competitive inference: strong hand, wants to defend
     *
     * INFERENCE RESULT:
     * - Responder: HCP >= 10, balanced/semi-balanced (wants to defend)
     * - Combined NS: HCP >= 25 (1NT opener + strong responder)
     */
    // Future API:
    // const result = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT", "X", "XX!"]),  // XX! = alerted redouble
    //   Seat.East,
    //   { north: "stayman", south: "stayman" }
    // );
    // expect(result.seats[Seat.South].hcpMin).toBeGreaterThanOrEqual(10);
    // expect(result.alertInterpretation).toBe("penalty");
    expect(true).toBe(true); // Placeholder assertion
  });

  test.skip("alert 'asking for majors' confirms standard Stayman vs garbage Stayman", () => {
    /**
     * BRIDGE THEORY: There are variants of Stayman:
     * (1) Standard Stayman: 8+ HCP, at least one 4-card major, invitational+
     * (2) Garbage Stayman: any strength, 4-4-4-1 or similar, may pass
     *     any 2-level response (including 2D with short diamonds)
     *
     * The alert text disambiguates: "asking for majors" = standard Stayman
     * with strength requirements. "May pass any response" = garbage Stayman,
     * where responder could have any HCP and intends to sign off.
     *
     * REQUIRES:
     * - Alert text parsing: "asking for majors" vs "may pass"
     * - Variant-specific inference: standard vs garbage Stayman
     * - HCP range depends on variant: 8+ (standard) vs 0+ (garbage)
     *
     * INFERENCE RESULT:
     * - Standard alert: HCP >= 8, has 4-card major
     * - Garbage alert: HCP unconstrained, likely short in at least one suit
     */
    // Future API:
    // const standardResult = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT", "P", "2C!"]),
    //   Seat.East,
    //   { north: "standard-stayman", south: "standard-stayman" }
    // );
    // expect(standardResult.seats[Seat.South].hcpMin).toBeGreaterThanOrEqual(8);
    //
    // const garbageResult = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT", "P", "2C!"]),
    //   Seat.East,
    //   { north: "garbage-stayman", south: "garbage-stayman" }
    // );
    // expect(garbageResult.seats[Seat.South].hcpMin).toBe(0); // no HCP guarantee
    expect(true).toBe(true); // Placeholder assertion
  });

  test.skip("no alert on 2H response triggers natural inference showing hearts", () => {
    /**
     * BRIDGE THEORY: Opener's 2H response to Stayman is NOT alertable
     * because it shows a natural suit holding (4+ hearts). This is a
     * "self-alerting" bid in most regulatory environments.
     *
     * The inference engine should apply standard positive inference:
     * 2H shows hearts, regardless of whether the Stayman 2C was alerted.
     * The lack of alert on the response is normal and expected.
     *
     * REQUIRES:
     * - Natural responses within artificial conventions
     * - Alert not required for natural responses (no confidence reduction)
     * - Standard suit length inference: hearts >= 4
     *
     * INFERENCE RESULT:
     * - Opener: hearts >= 4, 15-17 HCP (no change from 1NT inference)
     * - Full confidence despite no alert (expected behavior)
     */
    // Future API:
    // const result = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT", "P", "2C!", "P", "2H"]),
    //   Seat.East,
    //   { north: "stayman", south: "stayman" }
    // );
    // expect(result.seats[Seat.North].suits.hearts.min).toBeGreaterThanOrEqual(4);
    // expect(result.seats[Seat.North].confidence).toBe("high"); // natural, no alert needed
    expect(true).toBe(true); // Placeholder assertion
  });
});

// ═══════════════════════════════════════════════════════════
// Our competitive bidding informed by opponent inference
// ═══════════════════════════════════════════════════════════

describe("Our competitive bidding informed by opponent inference", () => {
  test.skip("after hearing 1NT-P-2C-P-2H we know opener has 4+ hearts for defense planning", () => {
    /**
     * BRIDGE THEORY: When we are defending and hear the opponents
     * complete a Stayman sequence, we gain usable information:
     * - 1NT-P-2C-P-2H tells us opener has 15-17 HCP, balanced, 4+ hearts
     * - This affects our opening lead choice (avoid leading hearts into
     *   a known 4+ card holding)
     * - This affects our defensive signaling (hearts are dangerous)
     *
     * Cross-convention inference: their bidding informs our decisions
     * even though we are not using Stayman ourselves.
     *
     * REQUIRES:
     * - Cross-partnership inference: observe opponents, infer their hands
     * - Lead inference: avoid leading into known strength
     * - Defender's view: what WE know about THEIR hands
     *
     * INFERENCE RESULT:
     * - Opener (opponent): hearts >= 4, 15-17 HCP, balanced
     * - Our defensive inference: leading hearts is dangerous
     * - Our combined HCP: 40 - (15-17 opener) - (8+ responder) = max 17
     */
    // Future API:
    // const result = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT", "P", "2C", "P", "2H"]),
    //   Seat.East,
    //   { north: "stayman", south: "stayman" }
    // );
    // expect(result.seats[Seat.North].suits.hearts.min).toBeGreaterThanOrEqual(4);
    // expect(result.defensiveHints.avoidLeading).toContain(BidSuit.Hearts);
    expect(true).toBe(true); // Placeholder assertion
  });

  test.skip("after hearing 1NT-P-2C-P-2D opener denied majors so lead a major", () => {
    /**
     * BRIDGE THEORY: When opponents' Stayman produces a 2D denial:
     * (1) Opener has max 3 hearts and max 3 spades
     * (2) Leading a major is SAFE: opener cannot have a long major suit
     * (3) If we have a major sequence (KQJx), it's an excellent lead
     * (4) Opener's strength is concentrated in the minors
     *
     * This is actionable defensive inference: the opponents' convention
     * usage has revealed that majors are their weak spot.
     *
     * REQUIRES:
     * - Negative inference from 2D denial on opener's major suit lengths
     * - Lead recommendation based on inferred hand constraints
     * - Cross-convention application: their Stayman informs our defense
     *
     * INFERENCE RESULT:
     * - Opener: hearts <= 3, spades <= 3 (major-short)
     * - Defensive hint: leading a major is favorable
     * - Opener strength: concentrated in minors (diamonds, clubs)
     */
    // Future API:
    // const result = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT", "P", "2C", "P", "2D"]),
    //   Seat.East,
    //   { north: "stayman", south: "stayman" }
    // );
    // expect(result.seats[Seat.North].suits.hearts.max).toBeLessThanOrEqual(3);
    // expect(result.seats[Seat.North].suits.spades.max).toBeLessThanOrEqual(3);
    // expect(result.defensiveHints.preferLeading).toContain(BidSuit.Hearts);
    expect(true).toBe(true); // Placeholder assertion
  });

  test.skip("opponent Stayman to 2NT to 3NT reveals balanced hands with no fit favoring our distribution", () => {
    /**
     * BRIDGE THEORY: When opponents bid 1NT-2C-2D-3NT, we know:
     * (1) Both opponents are balanced (opener 1NT, responder 3NT)
     * (2) No major suit fit found (2D denial, no raise)
     * (3) Combined opponent HCP: 25-27 (15-17 + 10+)
     * (4) Our side has 13-15 combined HCP at most
     *
     * If WE have a distributional hand (long suit, shortage), we know
     * that our distributional advantage compensates for HCP disadvantage.
     * Balanced vs balanced: HCP dominates. Distributional vs balanced:
     * shape and tricks matter more.
     *
     * REQUIRES:
     * - Combined partnership HCP inference
     * - Shape inference: both opponents balanced
     * - Competitive evaluation: our distribution vs their balance
     *
     * INFERENCE RESULT:
     * - NS combined: 25-27 HCP, no major fit, both balanced
     * - EW combined: 13-15 HCP, potential distributional advantage
     */
    // Future API:
    // const result = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT", "P", "2C", "P", "2D", "P", "3NT"]),
    //   Seat.East,
    //   { north: "stayman", south: "stayman" }
    // );
    // expect(result.combinedHcp.ns.min).toBeGreaterThanOrEqual(25);
    // expect(result.seats[Seat.North].isBalanced).toBe(true);
    // expect(result.seats[Seat.South].isBalanced).toBe(true); // chose NT, no major fit
    expect(true).toBe(true); // Placeholder assertion
  });

  test.skip("overcall timing: bidding immediately after 1NT vs waiting for Stayman information", () => {
    /**
     * BRIDGE THEORY: When opponents open 1NT, we face a strategic choice:
     * (1) Overcall immediately (2H, 2S, etc.) before Stayman reveals info
     * (2) Pass and wait -- Stayman will reveal opener's major holdings
     *
     * If we pass and hear 1NT-P-2C-P-2D, we LEARN that opener has no
     * 4-card major. This is free information for our competitive decisions.
     * But passing risks letting them find their fit unchallenged.
     *
     * The inference engine should model this information tradeoff: what
     * do we gain by listening vs what do we risk by staying silent?
     *
     * REQUIRES:
     * - Information value computation: what does waiting reveal?
     * - Risk assessment: does passing let them establish their contract?
     * - Position-dependent strategy: is it our turn to act?
     *
     * INFERENCE RESULT:
     * - If we pass and hear 2D: we gain major-length information on opener
     * - If we pass and hear 2H/2S: we gain positive suit information
     * - Cost: they may find their fit and reach game unchallenged
     */
    // Future API:
    // const infoGain = computeInformationValue(
    //   buildAuction(Seat.North, ["1NT"]),
    //   Seat.East,
    //   { waitForStayman: true }
    // );
    // expect(infoGain.potentialInferences).toContain("opener-major-lengths");
    // expect(infoGain.risk).toBe("opponents-find-fit");
    expect(true).toBe(true); // Placeholder assertion
  });

  test.skip("after 2C Stayman we know responder has 8+ HCP so our partnership has fewer HCP", () => {
    /**
     * BRIDGE THEORY: Every HCP point placed with an opponent is one
     * fewer for our side. After hearing 1NT-P-2C:
     * (1) Opener: 15-17 HCP
     * (2) Responder: 8+ HCP (Stayman guarantee)
     * (3) Combined opponents: 23+ HCP minimum
     * (4) Our side: at most 17 HCP combined (40 - 23)
     *
     * This "points available" inference constrains our bidding: we
     * should not expect game our way (typically need 25+ HCP). Our
     * bidding should be competitive/obstructive, not constructive.
     *
     * REQUIRES:
     * - Total HCP invariant: 40 points in every deal
     * - Partnership HCP subtraction: 40 - opponent_min = our_max
     * - Strategic implication: our side is outgunned
     *
     * INFERENCE RESULT:
     * - Our combined HCP max: 40 - 23 = 17
     * - Strategic: competitive bidding only, no game ambitions
     */
    // Future API:
    // const result = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT", "P", "2C"]),
    //   Seat.East,
    //   { north: "stayman", south: "stayman" }
    // );
    // const ourMaxHcp = 40 - result.combinedHcp.ns.min;
    // expect(ourMaxHcp).toBeLessThanOrEqual(17);
    expect(true).toBe(true); // Placeholder assertion
  });
});

// ═══════════════════════════════════════════════════════════
// Hand inference from our own known cards
// ═══════════════════════════════════════════════════════════

describe("Hand inference from our own known cards", () => {
  test.skip("we hold KQJx of hearts and opponent showed 4+ hearts so opener has at most Ax", () => {
    /**
     * BRIDGE THEORY: Card-counting inference combines what we know
     * from our own hand with what the convention reveals:
     * (1) We (East) hold KQJ3 of hearts (4 hearts including top honors)
     * (2) Opener (North) showed 4+ hearts via 2H response to Stayman
     * (3) There are 13 hearts total in the deck
     * (4) Opener has 4+ hearts, we have 4 hearts -> partner + responder
     *     have at most 5 hearts between them
     * (5) Opener's hearts are constrained: we hold KQJ, so opener's
     *     best heart is the Ace (AT-size cards at most)
     *
     * This is the synthesis of convention inference + own-hand knowledge.
     * Extremely valuable for defense: we know our heart holding will
     * dominate opener's heart holding.
     *
     * REQUIRES:
     * - Own hand integration: our known cards reduce available cards
     * - Rank inference: we hold KQJ, so opponent's hearts contain at most A
     * - computeAvailableCards() combining hand + inference data
     *
     * INFERENCE RESULT:
     * - Opener's hearts: 4+ cards but missing KQJ (we have them)
     * - Opener's best heart: Ace (if they have it) or Ten
     * - Partner + responder: at most 5 hearts combined
     */
    const ourHand = hand(
      "SA", "S5", "S2",
      "HK", "HQ", "HJ", "H3",
      "DA", "D7", "D3",
      "C5", "C3", "C2",
    ); // 13 HCP, 4 hearts (KQJ3)
    // Future API:
    // const auctionResult = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT", "P", "2C", "P", "2H"]),
    //   Seat.East,
    //   { north: "stayman", south: "stayman" }
    // );
    // const available = computeAvailableCards(ourHand, auctionResult);
    // expect(available.seats[Seat.North].hearts.possibleRanks).not.toContain("K");
    // expect(available.seats[Seat.North].hearts.possibleRanks).not.toContain("Q");
    // expect(available.seats[Seat.North].hearts.possibleRanks).not.toContain("J");
    expect(ourHand.cards).toHaveLength(13); // Placeholder: verify hand is valid
  });

  test.skip("we hold 3 aces and Stayman pair has at most 1 ace between them", () => {
    /**
     * BRIDGE THEORY: There are exactly 4 aces in every deal. If we hold 3:
     * (1) The remaining ace is split between the other 3 players
     * (2) Our partner holds 0 or 1 aces (at most 1)
     * (3) The Stayman pair (opener + responder) holds 0 or 1 aces combined
     *
     * Combined with HCP inference: aces are 4 HCP each. If opener has
     * 15-17 HCP and we know they have at most 1 ace (4 HCP), their
     * remaining 11-13 HCP must come from KQJ combinations. This
     * constrains which honor cards they can hold.
     *
     * REQUIRES:
     * - Ace counting: 4 total, we hold N, remaining = 4-N
     * - Honor card distribution inference
     * - HCP composition: knowing ace count constrains king/queen/jack count
     *
     * INFERENCE RESULT:
     * - Opponent pair: at most 1 ace combined
     * - Opener with 15-17 HCP and max 1 ace: 11-13 HCP from KQJ
     * - Partner: has 0 or 1 ace
     */
    const ourHand = hand(
      "SA", "S5", "S2",
      "HA", "H7", "H3",
      "DA", "D7", "D3",
      "C5", "C4", "C3", "C2",
    ); // 12 HCP (3 aces), 3 aces held
    // Future API:
    // const result = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT", "P", "2C", "P", "2H"]),
    //   Seat.East,
    //   { north: "stayman", south: "stayman" }
    // );
    // const available = computeAvailableCards(ourHand, result);
    // expect(available.totalAcesAvailable).toBe(1); // 4 - 3 we hold
    // expect(available.seats[Seat.North].maxAces).toBeLessThanOrEqual(1);
    expect(ourHand.cards).toHaveLength(13); // Placeholder: verify hand is valid
  });

  test.skip("we hold 4 spades and opener denied 4S via 2D so responder may have long spades", () => {
    /**
     * BRIDGE THEORY: Spade distribution inference:
     * (1) 13 spades total in the deck
     * (2) We hold 4 spades -> 9 spades remain among 3 other players
     * (3) Opener denied 4+ spades (via 2D) -> opener has max 3 spades
     * (4) Remaining: 9 - 3 = at least 6 spades between partner and responder
     * (5) Responder bid Stayman (has a 4-card major) -- could have 4+ spades
     *
     * If responder then bids 3NT (not Smolen), they have at most 4 spades
     * (Smolen would show 5). So: responder has exactly 4 spades, partner
     * has at least 2 spades.
     *
     * REQUIRES:
     * - Suit distribution counting: 13 per suit
     * - Multiple constraint intersection: our hand + denial + Stayman response
     * - Partner's inferred spade length from remainder
     *
     * INFERENCE RESULT:
     * - Opener: spades <= 3
     * - Responder: spades 4 (from Stayman + not Smolen)
     * - Partner: spades >= 2 (13 - 4 - 3 - 4 = 2 minimum)
     */
    const ourHand = hand(
      "SA", "SK", "SQ", "S5",
      "H7", "H3",
      "DK", "D7", "D3",
      "C5", "C4", "C3", "C2",
    ); // 12 HCP, 4 spades
    // Future API:
    // const result = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT", "P", "2C", "P", "2D", "P", "3NT"]),
    //   Seat.East,
    //   { north: "stayman", south: "stayman" }
    // );
    // const available = computeAvailableCards(ourHand, result);
    // expect(result.seats[Seat.North].suits.spades.max).toBeLessThanOrEqual(3);
    // expect(available.seats[Seat.West].suits.spades.min).toBeGreaterThanOrEqual(2);
    expect(ourHand.cards).toHaveLength(13); // Placeholder: verify hand is valid
  });

  test.skip("combined own hand plus Stayman inference gives approximate opponent shape", () => {
    /**
     * BRIDGE THEORY: The full power of cross-inference emerges when
     * we combine EVERYTHING we know:
     * (1) Our own 13 cards (exact knowledge)
     * (2) Convention inference (opener: 15-17 balanced, 4+ hearts from 2H)
     * (3) Responder inference (8+ HCP, has a 4-card major)
     * (4) Total card count (13 per suit, 40 HCP total)
     * (5) Partner's hand = 40 - our_HCP - opener_range - responder_range
     *
     * With all this combined, we can often narrow down each opponent's
     * hand to within 1-2 cards per suit and 2-3 HCP points. This is
     * the foundation for expert-level defensive play.
     *
     * REQUIRES:
     * - Full constraint propagation across all four seats
     * - Residual inference: what's left after placing known cards
     * - Shape + HCP joint constraint satisfaction
     *
     * INFERENCE RESULT:
     * - Each opponent's suit lengths known within +/- 1-2 cards
     * - Each opponent's HCP known within +/- 2-3 points
     * - Partner's hand approximated by subtraction
     */
    const ourHand = hand(
      "SJ", "S9", "S5",
      "H8", "H6", "H2",
      "DA", "DK", "DQ", "D4",
      "CK", "C7", "C3",
    ); // 13 HCP, 3-3-4-3 shape
    // Future API:
    // const result = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT", "P", "2C", "P", "2H", "P", "4H"]),
    //   Seat.East,
    //   { north: "stayman", south: "stayman" }
    // );
    // const available = computeAvailableCards(ourHand, result);
    // Opener: 15-17 HCP, 4+ hearts, balanced
    // Responder: 10+ HCP (bid 4H game), 4+ hearts
    // Us: 13 HCP -> partner has 40 - 13 - 15..17 - 10+ = max 2 HCP
    // expect(available.seats[Seat.West].hcpMax).toBeLessThanOrEqual(4);
    expect(ourHand.cards).toHaveLength(13); // Placeholder: verify hand is valid
  });

  test.skip("we hold heart void and opponent showed 4H so partner likely has hearts", () => {
    /**
     * BRIDGE THEORY: Void + convention inference is powerful:
     * (1) We hold 0 hearts -> 13 hearts split among 3 other players
     * (2) Opener showed 4+ hearts via 2H Stayman response
     * (3) Responder has 4+ hearts (raised to 4H -- fit confirmed)
     * (4) That accounts for 8+ hearts between opponents
     * (5) Partner has at most 5 hearts (13 - 8 = 5)
     *
     * But our void means we can ruff hearts! Combined with the knowledge
     * that opponents have 8+ hearts between them, we know hearts will be
     * led frequently. Our void is a defensive asset.
     *
     * REQUIRES:
     * - Void detection in our hand
     * - Suit total counting with void: 13 - 0 = 13 among others
     * - Ruffing potential inference for play strategy
     *
     * INFERENCE RESULT:
     * - Opponents: 8+ hearts combined
     * - Partner: 1-5 hearts (13 - 0 - 4 - 4 = 5 max, could be fewer)
     * - Our tactical advantage: can ruff hearts
     */
    const ourHand = hand(
      "SA", "SK", "SQ", "SJ", "S9",
      // no hearts -- void
      "DA", "DK", "DQ", "D7",
      "CK", "CQ", "C5", "C3",
    ); // 20 HCP, heart void, 5-0-4-4
    // Future API:
    // const result = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT", "P", "2C", "P", "2H", "P", "4H"]),
    //   Seat.East,
    //   { north: "stayman", south: "stayman" }
    // );
    // const available = computeAvailableCards(ourHand, result);
    // expect(available.seats[Seat.West].suits.hearts.max).toBeLessThanOrEqual(5);
    // expect(available.ruffingPotential[Seat.East]).toContain("hearts");
    expect(ourHand.cards).toHaveLength(13); // Placeholder: verify hand is valid
  });

  test.skip("we hold 5 diamonds and opponent is balanced so our side has diamond advantage", () => {
    /**
     * BRIDGE THEORY: Distribution advantage in a specific suit:
     * (1) We hold 5 diamonds -> at most 8 diamonds among 3 other players
     * (2) Opener is balanced (from 1NT) -> max 5 diamonds, typical 3-4
     * (3) Responder is balanced-ish (bid NT, no suit shown) -> similar
     * (4) Our partner has the remaining diamonds
     *
     * If both opponents have 3-4 diamonds each (typical for balanced),
     * that's 6-8 opponent diamonds, leaving partner with 0-2 diamonds.
     * But if we have 5 good diamonds (AKQxx), we have a running suit
     * on defense that opponents cannot stop easily.
     *
     * REQUIRES:
     * - Balanced hand shape inference on opponents
     * - Suit length distribution across all four hands
     * - "Running suit" detection for defense/offense
     *
     * INFERENCE RESULT:
     * - Each opponent: 2-5 diamonds (balanced constraint)
     * - Partner: 0-4 diamonds (residual)
     * - Our diamond advantage: long suit vs balanced opponents
     */
    const ourHand = hand(
      "SJ", "S5",
      "H8", "H6", "H2",
      "DA", "DK", "DQ", "D7", "D4",
      "C7", "C5", "C3",
    ); // 11 HCP, 5 diamonds (AKQ74)
    // Future API:
    // const result = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT", "P", "2C", "P", "2D", "P", "3NT"]),
    //   Seat.East,
    //   { north: "stayman", south: "stayman" }
    // );
    // const available = computeAvailableCards(ourHand, result);
    // Opponents balanced -> diamonds typically 3-4 each
    // expect(available.seats[Seat.North].suits.diamonds.min).toBeGreaterThanOrEqual(2);
    // expect(available.seats[Seat.North].suits.diamonds.max).toBeLessThanOrEqual(5);
    // expect(available.suitAdvantage[Seat.East]).toContain("diamonds");
    expect(ourHand.cards).toHaveLength(13); // Placeholder: verify hand is valid
  });
});

// ═══════════════════════════════════════════════════════════
// Vulnerability and position effects on inference
// ═══════════════════════════════════════════════════════════

describe("Vulnerability and position effects on inference", () => {
  test.skip("vulnerable 1NT confirms standard 15-17 HCP range with narrow inference", () => {
    /**
     * BRIDGE THEORY: When the 1NT opener is vulnerable:
     * (1) The 15-17 HCP range is essentially guaranteed (players don't
     *     psyche or shade 1NT openings when vulnerable)
     * (2) The cost of going down is higher (vulnerable penalties)
     * (3) Therefore, the inference is TIGHT: 15-17 is reliable
     * (4) This gives us narrow bounds on the remaining HCP
     *
     * Vulnerability makes people conservative. A vulnerable 1NT means
     * "I really do have 15-17 HCP and a balanced hand." The inference
     * engine should reflect this with high confidence.
     *
     * REQUIRES:
     * - Vulnerability-aware inference: tighter bounds when vulnerable
     * - Confidence levels: vulnerable = higher confidence on HCP range
     * - Vulnerability passed through InferenceConfig
     *
     * INFERENCE RESULT:
     * - Opener: 15-17 HCP (high confidence, narrow range)
     * - Vulnerability bonus: inference is more reliable
     */
    // Future API:
    // const result = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT"]),
    //   Seat.East,
    //   { north: "stayman", south: "stayman" },
    //   { vulnerability: Vulnerability.NorthSouth }
    // );
    // expect(result.seats[Seat.North].hcpMin).toBe(15);
    // expect(result.seats[Seat.North].hcpMax).toBe(17);
    // expect(result.seats[Seat.North].confidence).toBe("high");
    expect(true).toBe(true); // Placeholder assertion
  });

  test.skip("non-vulnerable 1NT may be lighter in some systems weakening inference", () => {
    /**
     * BRIDGE THEORY: Non-vulnerable 1NT has more system variation:
     * (1) Standard ACBL: still 15-17 NV (same as vulnerable)
     * (2) Some play "weak NT" NV: 12-14 HCP (common in UK/European systems)
     * (3) Some play 14-16 NV (compromise range)
     * (4) Without knowing the exact system, inference is wider
     *
     * If we don't know the opponents' system, we should use a wider
     * range for NV 1NT. If we know they play standard ACBL, 15-17 applies
     * regardless of vulnerability. The convention map resolves this.
     *
     * REQUIRES:
     * - System-specific HCP ranges for 1NT
     * - Vulnerability-conditional range selection
     * - Convention map specifies "standard" vs "weak" NT
     *
     * INFERENCE RESULT:
     * - Unknown system: HCP 12-17 (wide range, could be weak or strong NT)
     * - Known standard: HCP 15-17 (same as vulnerable)
     * - Known weak NT: HCP 12-14 (different inference entirely)
     */
    // Future API:
    // const unknownResult = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT"]),
    //   Seat.East,
    //   { north: "unknown", south: "unknown" },
    //   { vulnerability: Vulnerability.None }
    // );
    // expect(unknownResult.seats[Seat.North].hcpMin).toBeLessThanOrEqual(12);
    // expect(unknownResult.seats[Seat.North].hcpMax).toBeGreaterThanOrEqual(17);
    //
    // const standardResult = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT"]),
    //   Seat.East,
    //   { north: "stayman", south: "stayman" },  // known standard system
    //   { vulnerability: Vulnerability.None }
    // );
    // expect(standardResult.seats[Seat.North].hcpMin).toBe(15);
    expect(true).toBe(true); // Placeholder assertion
  });

  test.skip("3rd seat 1NT may be lighter producing weaker HCP inference", () => {
    /**
     * BRIDGE THEORY: Third seat (after two passes) sometimes allows
     * a lighter 1NT opening:
     * (1) Two passes mean partner is limited (passed hand, usually < 12 HCP)
     * (2) Some players open 1NT with 14 HCP in 3rd seat (light opening)
     * (3) The strategic goal is to shut out 4th seat from a cheap overcall
     * (4) Standard methods: 3rd seat 1NT = still 15-17, but "tactical"
     *     1NT with 14 HCP is common at the expert level
     *
     * The inference engine should widen the HCP range for 3rd seat 1NT:
     * 14-17 instead of 15-17, reflecting the possibility of a light opening.
     *
     * REQUIRES:
     * - Seat position awareness: 1st/2nd vs 3rd seat
     * - Position-conditional HCP ranges
     * - Partner-is-passed-hand inference (from two initial passes)
     *
     * INFERENCE RESULT:
     * - 3rd seat opener: HCP 14-17 (wider than standard 15-17)
     * - Passed partner: HCP <= 11 (didn't open)
     */
    // Future API:
    // const result = inferFromAuction(
    //   buildAuction(Seat.North, ["P", "P", "1NT"]),  // 3rd seat 1NT
    //   Seat.West,
    //   { north: "stayman", south: "stayman" }
    // );
    // expect(result.seats[Seat.South].hcpMin).toBe(14); // could be light
    // expect(result.seats[Seat.South].hcpMax).toBe(17);
    // expect(result.seats[Seat.North].hcpMax).toBeLessThanOrEqual(11); // passed hand
    expect(true).toBe(true); // Placeholder assertion
  });

  test.skip("1st or 2nd seat 1NT gives standard full inference on HCP range", () => {
    /**
     * BRIDGE THEORY: In 1st or 2nd seat, 1NT is a standard opening:
     * (1) 15-17 HCP, balanced (universal standard ACBL agreement)
     * (2) No positional "light" adjustments (those apply to 3rd seat)
     * (3) The most reliable inference in all of bridge bidding
     * (4) Partner has not passed, so no constraint on partner's hand
     *
     * 1st/2nd seat 1NT is the baseline: full standard inference applies
     * with maximum confidence. The inference engine should use the
     * tightest possible HCP bounds here.
     *
     * REQUIRES:
     * - Seat position: 1st or 2nd seat detection
     * - Standard HCP range: exactly 15-17
     * - No positional adjustments
     *
     * INFERENCE RESULT:
     * - Opener: 15-17 HCP, balanced (high confidence)
     * - No additional positional adjustments
     */
    // Future API:
    // const result1st = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT"]),  // 1st seat
    //   Seat.East,
    //   { north: "stayman", south: "stayman" }
    // );
    // expect(result1st.seats[Seat.North].hcpMin).toBe(15);
    // expect(result1st.seats[Seat.North].hcpMax).toBe(17);
    //
    // const result2nd = inferFromAuction(
    //   buildAuction(Seat.North, ["P", "1NT"]),  // 2nd seat
    //   Seat.South,
    //   { north: "stayman", south: "stayman" }
    // );
    // expect(result2nd.seats[Seat.East].hcpMin).toBe(15);
    // expect(result2nd.seats[Seat.East].hcpMax).toBe(17);
    expect(true).toBe(true); // Placeholder assertion
  });

  test.skip("vulnerable opponents bidding Stayman are serious about game with conservative inference", () => {
    /**
     * BRIDGE THEORY: When vulnerable opponents use Stayman:
     * (1) They are committing to at least an invitational sequence (8+ HCP)
     * (2) Vulnerable penalties are severe -- going down costs more
     * (3) Therefore, vulnerable Stayman implies REAL values, not speculative
     * (4) We can trust the 8+ HCP inference more strongly
     * (5) If they reach game (4H/4S/3NT), they are likely to make it
     *
     * Vulnerability affects the CONFIDENCE of our inferences, not the
     * inferences themselves. A vulnerable Stayman 2C still shows 8+ HCP
     * and a 4-card major, but we trust these bounds more.
     *
     * REQUIRES:
     * - Vulnerability awareness in confidence modeling
     * - Tighter inference bounds when opponents are vulnerable
     * - Game likelihood assessment based on vulnerability
     *
     * INFERENCE RESULT:
     * - Responder: 8+ HCP (high confidence due to vulnerability)
     * - If reaching game: likely making (vulnerable, wouldn't risk it)
     * - Our defensive posture: respect their values
     */
    // Future API:
    // const result = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT", "P", "2C"]),
    //   Seat.East,
    //   { north: "stayman", south: "stayman" },
    //   { vulnerability: Vulnerability.NorthSouth }
    // );
    // expect(result.seats[Seat.South].hcpMin).toBeGreaterThanOrEqual(8);
    // expect(result.seats[Seat.South].confidence).toBe("high");
    // expect(result.gameLikelihood).toBe("high"); // vulnerable, committed
    expect(true).toBe(true); // Placeholder assertion
  });

  test.skip("non-vulnerable opponents bidding Stayman may be lighter with aggressive inference", () => {
    /**
     * BRIDGE THEORY: When non-vulnerable opponents use Stayman:
     * (1) They might shade down: Stayman with 7 HCP is not uncommon NV
     * (2) Non-vulnerable penalties are less severe (going down costs less)
     * (3) Some players use Stayman more aggressively NV (looking for part-score)
     * (4) The 8+ HCP floor might be closer to 7+ HCP in practice
     *
     * The inference engine should widen the HCP range slightly for NV
     * Stayman: perhaps 7-40 instead of 8-40. This reflects the
     * possibility that NV players take more liberties.
     *
     * REQUIRES:
     * - Vulnerability-conditional HCP floors for convention bids
     * - Wider range for non-vulnerable Stayman (7+ vs 8+)
     * - Conservative: still mostly 8+, but allowing 7 as possible
     *
     * INFERENCE RESULT:
     * - Responder: 7+ HCP (slightly wider than vulnerable)
     * - Confidence: MEDIUM (NV allows more liberties)
     * - May be looking for part-score rather than game
     */
    // Future API:
    // const result = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT", "P", "2C"]),
    //   Seat.East,
    //   { north: "stayman", south: "stayman" },
    //   { vulnerability: Vulnerability.None }
    // );
    // expect(result.seats[Seat.South].hcpMin).toBeGreaterThanOrEqual(7);
    // expect(result.seats[Seat.South].confidence).toBe("medium");
    expect(true).toBe(true); // Placeholder assertion
  });
});

// ═══════════════════════════════════════════════════════════
// Opponent convention type affects inference computation
// ═══════════════════════════════════════════════════════════

describe("Opponent convention type affects inference computation", () => {
  test.skip("DONT 2H overcall infers hearts + minor (5+H, 4+m, 8-15 HCP)", () => {
    /**
     * BRIDGE THEORY: DONT (Disturbing Opponent's No Trump) 2H shows hearts
     * plus a minor suit. The typical shape is 5+4 or better. HCP range is
     * 8-15 (lighter than a natural overcall because the bid is conventional).
     *
     * REQUIRES:
     * - opponentConventionIds: ["dont"] passed to inference engine
     * - Engine looks up DONT convention definition for 2H
     * - Extracts: H min 5, minor suit min 4, HCP 8-15
     *
     * INFERENCE: DONT 2H → { hearts: { min: 5 }, hcp: { min: 8, max: 15 } }
     */
    // Future API:
    // const result = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT", "2H"]),
    //   Seat.South,
    //   { opponentConventionIds: ["dont"] }
    // );
    // expect(result.seats[Seat.East].suits.hearts.minLength).toBe(5);
    // expect(result.seats[Seat.East].hcpMin).toBe(8);
    // expect(result.seats[Seat.East].hcpMax).toBe(15);
    expect(true).toBe(true); // Placeholder
  });

  test.skip("natural 2H overcall infers 6+ hearts, 10-16 HCP", () => {
    /**
     * BRIDGE THEORY: A natural 2H overcall at the 2-level promises a good
     * 6-card suit and opening-bid values (roughly 10-16 HCP). This is stronger
     * and longer than a DONT 2H (which is only 5+).
     *
     * REQUIRES:
     * - opponentConventionIds: [] → natural bidding inference
     * - Natural 2-level overcall = 6+ suit, 10-16 HCP
     *
     * INFERENCE: Natural 2H → { hearts: { min: 6 }, hcp: { min: 10, max: 16 } }
     */
    // Future API:
    // const result = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT", "2H"]),
    //   Seat.South,
    //   { opponentConventionIds: [] }
    // );
    // expect(result.seats[Seat.East].suits.hearts.minLength).toBe(6);
    // expect(result.seats[Seat.East].hcpMin).toBe(10);
    // expect(result.seats[Seat.East].hcpMax).toBe(16);
    expect(true).toBe(true); // Placeholder
  });

  test.skip("Landy 2C overcall infers both majors (4+S, 4+H)", () => {
    /**
     * BRIDGE THEORY: Landy 2C over 1NT shows both majors (at least 4-4).
     * The bid is artificial — it says nothing about clubs. HCP range is
     * typically 10-15.
     *
     * REQUIRES:
     * - opponentConventionIds: ["landy"] passed to inference engine
     * - Landy 2C = both majors, 4+/4+
     *
     * INFERENCE: Landy 2C → { spades: { min: 4 }, hearts: { min: 4 } }
     */
    // Future API:
    // const result = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT", "2C"]),
    //   Seat.South,
    //   { opponentConventionIds: ["landy"] }
    // );
    // expect(result.seats[Seat.East].suits.spades.minLength).toBe(4);
    // expect(result.seats[Seat.East].suits.hearts.minLength).toBe(4);
    expect(true).toBe(true); // Placeholder
  });

  test.skip("natural 2C overcall infers 6+ clubs", () => {
    /**
     * BRIDGE THEORY: A natural 2C overcall promises a good 6-card club suit.
     * This is fundamentally different from Landy 2C (which shows majors, not
     * clubs). The inference engine must distinguish based on opponentConventionIds.
     *
     * REQUIRES:
     * - opponentConventionIds: [] → natural bidding
     * - Natural 2C = 6+ clubs
     *
     * INFERENCE: Natural 2C → { clubs: { min: 6 } }
     */
    // Future API:
    // const result = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT", "2C"]),
    //   Seat.South,
    //   { opponentConventionIds: [] }
    // );
    // expect(result.seats[Seat.East].suits.clubs.minLength).toBe(6);
    expect(true).toBe(true); // Placeholder
  });

  test.skip("unknown convention defaults to natural inference", () => {
    /**
     * BRIDGE THEORY: When opponentConventionIds contains an unrecognized ID,
     * the inference engine should fall back to natural bidding inference.
     * This prevents crashes and provides reasonable defaults.
     *
     * REQUIRES:
     * - Graceful fallback for unknown convention IDs
     * - Same result as natural bidding when convention not found
     *
     * INFERENCE: Unknown convention → natural inference defaults.
     */
    // Future API:
    // const resultUnknown = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT", "2H"]),
    //   Seat.South,
    //   { opponentConventionIds: ["nonexistent-convention"] }
    // );
    // const resultNatural = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT", "2H"]),
    //   Seat.South,
    //   { opponentConventionIds: [] }
    // );
    // expect(resultUnknown.seats[Seat.East]).toEqual(resultNatural.seats[Seat.East]);
    expect(true).toBe(true); // Placeholder
  });

  test.skip("same bid with different opponentConventionIds produces different inference", () => {
    /**
     * BRIDGE THEORY: The core value proposition: the same opponent bid (2H)
     * means different things depending on their convention. DONT 2H = 5 hearts
     * + minor. Natural 2H = 6+ hearts. The inference engine MUST produce
     * different outputs for the same auction with different convention IDs.
     *
     * REQUIRES:
     * - Inference engine is parameterized by opponentConventionIds
     * - Same auction + different conventions → different inferences
     *
     * INFERENCE: DONT 2H ≠ Natural 2H (different suit length, HCP range).
     */
    // Future API:
    // const dontResult = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT", "2H"]),
    //   Seat.South,
    //   { opponentConventionIds: ["dont"] }
    // );
    // const naturalResult = inferFromAuction(
    //   buildAuction(Seat.North, ["1NT", "2H"]),
    //   Seat.South,
    //   { opponentConventionIds: [] }
    // );
    // // DONT shows fewer hearts than natural
    // expect(dontResult.seats[Seat.East].suits.hearts.minLength)
    //   .toBeLessThan(naturalResult.seats[Seat.East].suits.hearts.minLength!);
    expect(true).toBe(true); // Placeholder
  });
});
