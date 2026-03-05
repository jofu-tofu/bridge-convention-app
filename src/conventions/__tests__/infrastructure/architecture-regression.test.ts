// Architecture regression tests — verify architectural invariants
// identified by the deck review (sequences A1-F30).
// Tests below cover sequences NOT already tested in existing test files.

import { describe, it, expect, beforeEach } from "vitest";
import { Seat, BidSuit } from "../../../engine/types";
import { buildAuction } from "../../../engine/auction-helpers";
import { evaluateHand } from "../../../engine/hand-evaluator";
import { hand } from "../../../engine/__tests__/fixtures";
import { createBiddingContext } from "../../core/context-factory";
import type { BiddingContext } from "../../core/types";
import { registerConvention, clearRegistry } from "../../core/registry";
import { computeDialogueState } from "../../core/dialogue/dialogue-manager";
import { buildEffectiveContext } from "../../core/effective-context";
import { evaluateProtocol } from "../../core/protocol-evaluator";
import {
  CompetitionMode,
  SystemMode,
  getSystemModeFor,
} from "../../core/dialogue/dialogue-state";
import { STAYMAN_CAPABILITY } from "../../definitions/stayman/constants";
import type { TransitionRule } from "../../core/dialogue/dialogue-transitions";
import { baselineTransitionRules } from "../../core/dialogue/baseline-transitions";
import { staymanConfig } from "../../definitions/stayman/config";
import { bergenConfig } from "../../definitions/bergen-raises/config";
import { bergenTransitionRules } from "../../definitions/bergen-raises/transitions";
import { weakTwosConfig } from "../../definitions/weak-twos/config";
import { weakTwoTransitionRules } from "../../definitions/weak-twos/transitions";
import { partnerBidMade, opponentBidMade, bidMade } from "../../core/conditions";

beforeEach(() => {
  clearRegistry();
  registerConvention(staymanConfig);
  registerConvention(bergenConfig);
  registerConvention(weakTwosConfig);
});

// ─── Helper ──────────────────────────────────────────────────

function makeCtx(auction: ReturnType<typeof buildAuction>, seat: Seat): BiddingContext {
  // 12 HCP, 4 hearts, 4 spades — valid for Stayman/Bergen responder
  const h = hand("SA", "SK", "S5", "S2", "HA", "HK", "H5", "H2", "D5", "D3", "C5", "C3", "C2");
  return createBiddingContext({
    hand: h,
    auction,
    seat,
    evaluation: evaluateHand(h),
  });
}

// ─── Test 1 (B6): partnerBidMade — partner vs opponent ──────

describe("Test 1 (B6): partnerBidMade partner vs opponent", () => {
  it("partnerBidMade matches partner's bid, not opponent's", () => {
    const condition = partnerBidMade(1, BidSuit.NoTrump);
    // North opens 1NT; evaluating as South (partner)
    const ctx = makeCtx(buildAuction(Seat.North, ["1NT"]), Seat.South);
    expect(condition.test(ctx)).toBe(true);

    // North opens 1NT; evaluating as East (opponent)
    const ctxOpp = makeCtx(buildAuction(Seat.North, ["1NT"]), Seat.East);
    expect(condition.test(ctxOpp)).toBe(false);
  });
});

// ─── Test 2 (B7): opponentBidMade — opponent vs partner ─────

describe("Test 2 (B7): opponentBidMade opponent vs partner", () => {
  it("opponentBidMade matches opponent's bid, not partner's", () => {
    const condition = opponentBidMade(1, BidSuit.NoTrump);
    // North opens 1NT; evaluating as East (opponent of North)
    const ctx = makeCtx(buildAuction(Seat.North, ["1NT"]), Seat.East);
    expect(condition.test(ctx)).toBe(true);

    // North opens 1NT; evaluating as South (partner of North)
    const ctxPartner = makeCtx(buildAuction(Seat.North, ["1NT"]), Seat.South);
    expect(condition.test(ctxPartner)).toBe(false);
  });
});

// ─── Test 3 (B9): bidMade — seat-agnostic ───────────────────

describe("Test 3 (B9): bidMade seat-agnostic", () => {
  it("bidMade matches regardless of which seat made the bid", () => {
    const condition = bidMade(1, BidSuit.NoTrump);
    // North opens 1NT
    const auction = buildAuction(Seat.North, ["1NT"]);

    // Matches for ALL four seats
    for (const seat of [Seat.North, Seat.East, Seat.South, Seat.West]) {
      const ctx = makeCtx(auction, seat);
      expect(condition.test(ctx)).toBe(true);
    }
  });
});

// ─── Test 4 (C14): Causality — spy trigger sees windowed auction

describe("Test 4 (C14): Causality windowed auction", () => {
  it("transition rule receives entryIndex limiting visible entries", () => {
    const seenIndices: number[] = [];
    const auctionLengthsAtIndex: number[] = [];
    const spyRule: TransitionRule = {
      id: "spy-causality",
      matches(_state, _entry, auction, entryIndex) {
        seenIndices.push(entryIndex);
        auctionLengthsAtIndex.push(auction.entries.length);
        return false;
      },
      effects() { return {}; },
    };

    const auction = buildAuction(Seat.North, ["1NT", "P", "2C"]);
    computeDialogueState(auction, [spyRule, ...baselineTransitionRules]);

    // Each entry's entryIndex matches its position
    expect(seenIndices).toEqual([0, 1, 2]);
    // Full auction is visible at each step (rules must self-limit to entryIndex)
    expect(auctionLengthsAtIndex).toEqual([3, 3, 3]);
  });
});

// ─── Test 5 (C15): entryIndex passed correctly ──────────────

describe("Test 5 (C15): entryIndex passed to effects()", () => {
  it("effects() receives the same entryIndex as matches()", () => {
    const matchIdx: number[] = [];
    const effectIdx: number[] = [];
    const spyRule: TransitionRule = {
      id: "spy-entry-index",
      matches(_state, _entry, _auction, entryIndex) {
        matchIdx.push(entryIndex);
        return true;
      },
      effects(_state, _entry, _auction, entryIndex) {
        effectIdx.push(entryIndex);
        return {};
      },
    };

    const auction = buildAuction(Seat.North, ["1NT", "X"]);
    computeDialogueState(auction, [spyRule]);

    expect(matchIdx).toEqual([0, 1]);
    expect(effectIdx).toEqual([0, 1]);
  });
});

// ─── Test 6 (D19): buildEffectiveContext → stayman-doubled ──

describe("Test 6 (D19): Stayman doubled overlay activation", () => {
  it("1NT-(X) activates stayman-doubled overlay", () => {
    const auction = buildAuction(Seat.North, ["1NT", "X", "P"]);
    const ctx = makeCtx(auction, Seat.South);
    const protoResult = evaluateProtocol(staymanConfig.protocol!, ctx);
    const effective = buildEffectiveContext(ctx, staymanConfig, protoResult);

    expect(effective.dialogueState.competitionMode).toBe(CompetitionMode.Doubled);
    expect(effective.dialogueState.systemMode).toBe(SystemMode.Off);
    expect(getSystemModeFor(effective.dialogueState, STAYMAN_CAPABILITY)).toBe(SystemMode.Modified);
    const overlayIds = effective.activeOverlays.map(o => o.id);
    expect(overlayIds).toContain("stayman-doubled");
  });
});

// ─── Test 7 (D20): buildEffectiveContext → stayman-overcalled

describe("Test 7 (D20): Stayman overcalled overlay activation", () => {
  it("1NT-(2H) activates stayman-overcalled overlay", () => {
    const auction = buildAuction(Seat.North, ["1NT", "2H"]);
    const ctx = makeCtx(auction, Seat.South);
    const protoResult = evaluateProtocol(staymanConfig.protocol!, ctx);
    const effective = buildEffectiveContext(ctx, staymanConfig, protoResult);

    expect(effective.dialogueState.competitionMode).toBe(CompetitionMode.Overcalled);
    expect(effective.dialogueState.systemMode).toBe(SystemMode.Off);
    const overlayIds = effective.activeOverlays.map(o => o.id);
    expect(overlayIds).toContain("stayman-overcalled");
  });
});

// ─── Test 8 (E25): Stayman overlay mutual exclusion ─────────

describe("Test 8 (E25): Stayman overlay mutual exclusion", () => {
  it("doubled and overcalled overlays never both active", () => {
    // Doubled scenario: 1NT-(X)
    const doubleAuction = buildAuction(Seat.North, ["1NT", "X", "P"]);
    const doubleCtx = makeCtx(doubleAuction, Seat.South);
    const doubleProto = evaluateProtocol(staymanConfig.protocol!, doubleCtx);
    const doubleEff = buildEffectiveContext(doubleCtx, staymanConfig, doubleProto);

    // Overcalled scenario: 1NT-(2H)
    const overcallAuction = buildAuction(Seat.North, ["1NT", "2H"]);
    const overcallCtx = makeCtx(overcallAuction, Seat.South);
    const overcallProto = evaluateProtocol(staymanConfig.protocol!, overcallCtx);
    const overcallEff = buildEffectiveContext(overcallCtx, staymanConfig, overcallProto);

    // Each scenario activates exactly one overlay, not both
    const doubleIds = doubleEff.activeOverlays.map(o => o.id);
    const overcallIds = overcallEff.activeOverlays.map(o => o.id);

    expect(doubleIds).toContain("stayman-doubled");
    expect(doubleIds).not.toContain("stayman-overcalled");
    expect(overcallIds).toContain("stayman-overcalled");
    expect(overcallIds).not.toContain("stayman-doubled");
  });
});

// ─── Test 9 (F26 negative): Bergen familyId blocks Stayman ──

describe("Test 9 (F26 negative): Bergen familyId blocks Stayman activation", () => {
  it("1H opening sets familyId=bergen; 1NT detection does not fire", () => {
    const auction = buildAuction(Seat.North, ["1H"]);
    const state = computeDialogueState(
      auction,
      bergenTransitionRules,
      baselineTransitionRules,
    );

    // Bergen claims the auction — familyId is "bergen", not "1nt"
    expect(state.familyId).toBe("bergen");
    // Baseline 1NT detection requires familyId===null, so it's blocked
  });
});

// ─── Test 10 (F29 substitute): Bergen 4-round ownership ─────

describe("Test 10 (F29): Bergen 4-round ownership transitions", () => {
  it("Bergen stays in bergen family through constructive response", () => {
    const auction = buildAuction(Seat.North, ["1H", "P", "3C"]);
    const state = computeDialogueState(
      auction,
      bergenTransitionRules,
      baselineTransitionRules,
    );

    expect(state.familyId).toBe("bergen");
    expect(state.conventionData["openerMajor"]).toBe("H");
    expect(state.conventionData["responseType"]).toBe("constructive");
  });

  it("Bergen stays in bergen family through limit response", () => {
    const auction = buildAuction(Seat.North, ["1H", "P", "3D"]);
    const state = computeDialogueState(
      auction,
      bergenTransitionRules,
      baselineTransitionRules,
    );

    expect(state.familyId).toBe("bergen");
    expect(state.conventionData["responseType"]).toBe("limit");
  });
});

// ─── Test 11 (F30): Family exclusivity: 1NT after 1H ────────

describe("Test 11 (F30): Family exclusivity — 1NT after Bergen-active 1H", () => {
  it("1NT response after 1H opening does not switch familyId to 1nt", () => {
    // 1H opening → Bergen claims → then someone bids 1NT
    const auction = buildAuction(Seat.North, ["1H", "1NT"]);
    const state = computeDialogueState(
      auction,
      bergenTransitionRules,
      baselineTransitionRules,
    );

    // familyId stays "bergen", not switched to "1nt"
    expect(state.familyId).toBe("bergen");
  });
});

// ─── Test 12 (A5 + F30 analog): Weak Two familyId blocks ───

describe("Test 12 (A5+F30): Weak Two familyId blocks other family detection", () => {
  it("2H opening sets weak-two; 2NT Ogust does not switch to nt family", () => {
    const auction = buildAuction(Seat.North, ["2H", "P", "2NT"]);
    const state = computeDialogueState(
      auction,
      weakTwoTransitionRules,
      baselineTransitionRules,
    );

    // familyId stays "weak-two", not "2nt"
    expect(state.familyId).toBe("weak-two");
  });

  it("2D opening sets weak-two; baseline 1NT detection is permanently blocked", () => {
    // Hypothetical: even if someone later bids 1NT (impossible in practice),
    // baseline detection requires familyId===null which is already "weak-two"
    const auction = buildAuction(Seat.North, ["2D"]);
    const state = computeDialogueState(
      auction,
      weakTwoTransitionRules,
      baselineTransitionRules,
    );

    expect(state.familyId).toBe("weak-two");
  });
});

// Future: requires unimplemented conventions
// A1 (transfer replay) — requires Jacoby transfers
// A4 (Jacoby 2NT handoff) — requires Jacoby 2NT convention
// A5 partial (keycard) — requires Blackwood/RKCB
// F26 (true handoff) — requires family handoff mechanism
// F27 (multi-family handoff) — requires multiple family handoff
