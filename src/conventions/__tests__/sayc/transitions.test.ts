import { describe, test, expect } from "vitest";
import { refDescribe, policyDescribe } from "../../../test-support/tiers";
import { Seat, BidSuit, Suit } from "../../../engine/types";
import { computeDialogueState } from "../../core/dialogue/dialogue-manager";
import { buildAuction } from "../../../engine/auction-helpers";
import { saycTransitionRules } from "../../definitions/sayc/transitions";
import { baselineTransitionRules } from "../../core/dialogue/baseline-transitions";
import { ForcingState } from "../../../core/contracts";
import { CompetitionMode, SystemMode } from "../../core/dialogue/dialogue-state";

function dialogueAfter(bids: string[], dealer: Seat = Seat.North) {
  const auction = buildAuction(dealer, bids);
  return computeDialogueState(auction, saycTransitionRules, baselineTransitionRules);
}

refDescribe("[ref:SAYC]", "SAYC transition rules", () => {
  describe("opening family detection", () => {
    test("1NT opening → familyId: sayc-1nt", () => {
      const state = dialogueAfter(["1NT"]);
      expect(state.familyId).toBe("sayc-1nt");
    });

    test("1NT opening stores openerSeat", () => {
      const state = dialogueAfter(["1NT"]);
      expect(state.conventionData["openerSeat"]).toBe(Seat.North);
    });

    test("2NT opening → familyId: sayc-2nt", () => {
      const state = dialogueAfter(["2NT"]);
      expect(state.familyId).toBe("sayc-2nt");
    });

    test("2C opening → familyId: sayc-2c", () => {
      const state = dialogueAfter(["2C"]);
      expect(state.familyId).toBe("sayc-2c");
    });

    test("1-level suit opening → familyId: sayc-suit + openingSuit", () => {
      const state = dialogueAfter(["1H"]);
      expect(state.familyId).toBe("sayc-suit");
      expect(state.conventionData["openingSuit"]).toBe(BidSuit.Hearts);
    });

    test("1-level major opening sets openingFamily to major", () => {
      const state = dialogueAfter(["1S"]);
      expect(state.conventionData["openingFamily"]).toBe("major");
    });

    test("1-level minor opening sets openingFamily to minor", () => {
      const state = dialogueAfter(["1D"]);
      expect(state.conventionData["openingFamily"]).toBe("minor");
    });

    test("weak two opening → familyId: sayc-weak", () => {
      const state = dialogueAfter(["2H"]);
      expect(state.familyId).toBe("sayc-weak");
      expect(state.conventionData["openingSuit"]).toBe(BidSuit.Hearts);
    });

    test("weak two opening (2D) → familyId: sayc-weak", () => {
      const state = dialogueAfter(["2D"]);
      expect(state.familyId).toBe("sayc-weak");
    });

    test("preempt opening → familyId: sayc-preempt", () => {
      const state = dialogueAfter(["3C"]);
      expect(state.familyId).toBe("sayc-preempt");
      expect(state.conventionData["openingSuit"]).toBe(BidSuit.Clubs);
    });

    test("all opening rules store openerSeat", () => {
      expect(dialogueAfter(["1H"]).conventionData["openerSeat"]).toBe(Seat.North);
      expect(dialogueAfter(["2C"]).conventionData["openerSeat"]).toBe(Seat.North);
      expect(dialogueAfter(["2H"]).conventionData["openerSeat"]).toBe(Seat.North);
      expect(dialogueAfter(["3S"]).conventionData["openerSeat"]).toBe(Seat.North);
    });
  });

  describe("forcing state tracking", () => {
    test("2C opening sets game forcing", () => {
      const state = dialogueAfter(["2C"]);
      expect(state.forcingState).toBe(ForcingState.GameForcing);
    });

    test("new suit response at 1-level sets forcing one round", () => {
      // North opens 1H, East passes, South responds 1S
      const state = dialogueAfter(["1H", "P", "1S"]);
      expect(state.forcingState).toBe(ForcingState.ForcingOneRound);
    });

    test("1NT response sets non-forcing", () => {
      const state = dialogueAfter(["1H", "P", "1NT"]);
      expect(state.forcingState).toBe(ForcingState.Nonforcing);
    });

    test("jump shift response sets game forcing", () => {
      // After 1H, 2S is a jump shift (could bid 1S at 1-level)
      const state = dialogueAfter(["1H", "P", "2S"]);
      expect(state.forcingState).toBe(ForcingState.GameForcing);
    });

    test("2-over-1 response sets forcing one round", () => {
      // After 1H, 2C is at minimum level for clubs — not a jump shift
      const state = dialogueAfter(["1H", "P", "2C"]);
      expect(state.forcingState).toBe(ForcingState.ForcingOneRound);
    });
  });

  describe("response type classification", () => {
    test("new suit at 1-level classified as new-suit", () => {
      const state = dialogueAfter(["1H", "P", "1S"]);
      expect(state.conventionData["responseType"]).toBe("new-suit");
    });

    test("1NT response classified as 1nt", () => {
      const state = dialogueAfter(["1H", "P", "1NT"]);
      expect(state.conventionData["responseType"]).toBe("1nt");
    });

    test("raise classified as raise", () => {
      const state = dialogueAfter(["1H", "P", "2H"]);
      expect(state.conventionData["responseType"]).toBe("raise");
    });

    test("jump shift classified as jump-shift", () => {
      const state = dialogueAfter(["1H", "P", "2S"]);
      expect(state.conventionData["responseType"]).toBe("jump-shift");
    });

    test("2-over-1 response in lower suit is new-suit", () => {
      // After 1S, 2C is at minimum level for clubs — not a jump shift
      const state = dialogueAfter(["1S", "P", "2C"]);
      expect(state.conventionData["responseType"]).toBe("new-suit");
    });

    test("2-over-1 response in lower suit after 1H is new-suit", () => {
      // After 1H, 2D is at minimum level for diamonds — not a jump shift
      const state = dialogueAfter(["1H", "P", "2D"]);
      expect(state.conventionData["responseType"]).toBe("new-suit");
    });
  });

  describe("agreed strain updates", () => {
    test("raise of hearts → agreed strain hearts", () => {
      const state = dialogueAfter(["1H", "P", "2H"]);
      expect(state.agreedStrain.type).toBe("suit");
      expect(state.agreedStrain.suit).toBe(Suit.Hearts);
      expect(state.agreedStrain.confidence).toBe("agreed");
    });

    test("raise of spades → agreed strain spades", () => {
      const state = dialogueAfter(["1S", "P", "2S"]);
      expect(state.agreedStrain.type).toBe("suit");
      expect(state.agreedStrain.suit).toBe(Suit.Spades);
    });

    test("new suit response → no agreed strain", () => {
      const state = dialogueAfter(["1H", "P", "1S"]);
      expect(state.agreedStrain.type).toBe("none");
    });
  });

  describe("competitive action tracking", () => {
    test("1NT doubled → systems OFF + competition doubled", () => {
      const state = dialogueAfter(["1NT", "X"]);
      expect(state.systemMode).toBe(SystemMode.Off);
      expect(state.competitionMode).toBe(CompetitionMode.Doubled);
      expect(state.conventionData["interferenceType"]).toBe("doubled");
    });
  });
});
