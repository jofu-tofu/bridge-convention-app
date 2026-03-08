// Tests for Ogust response tracking and direct/invite raise tracking
// via dialogue transition rules.

import { describe, test, expect, beforeEach } from "vitest";
import { Seat, BidSuit } from "../../../engine/types";
import {
  registerConvention,
  clearRegistry,
} from "../../core/registry";
import { weakTwosConfig } from "../../definitions/weak-twos";
import { weakTwoTransitionRules } from "../../definitions/weak-twos/transitions";
import { baselineTransitionRules } from "../../core/dialogue/baseline-transitions";
import { computeDialogueState } from "../../core/dialogue/dialogue-manager";
import { ObligationKind } from "../../core/dialogue/dialogue-state";
import { auctionFromBids } from "../fixtures";

beforeEach(() => {
  clearRegistry();
  registerConvention(weakTwosConfig);
});

// ─── Helpers ────────────────────────────────────────────────

function computeState(bids: string[], dealer: Seat = Seat.North) {
  const auction = auctionFromBids(dealer, bids);
  return computeDialogueState(auction, weakTwoTransitionRules, baselineTransitionRules);
}

// ─── Ogust Response Classification ─────────────────────────

describe("Ogust response tracking", () => {
  // Auction: North opens 2H, East passes, South asks 2NT (Ogust), West passes,
  // North responds with Ogust classification

  test("3C response stores ogustResponse: min-bad", () => {
    const state = computeState(["2H", "P", "2NT", "P", "3C"]);
    expect(state.conventionData["ogustResponse"]).toBe("min-bad");
  });

  test("3D response stores ogustResponse: min-good", () => {
    const state = computeState(["2H", "P", "2NT", "P", "3D"]);
    expect(state.conventionData["ogustResponse"]).toBe("min-good");
  });

  test("3H response stores ogustResponse: max-bad", () => {
    const state = computeState(["2H", "P", "2NT", "P", "3H"]);
    expect(state.conventionData["ogustResponse"]).toBe("max-bad");
  });

  test("3S response stores ogustResponse: max-good", () => {
    const state = computeState(["2H", "P", "2NT", "P", "3S"]);
    expect(state.conventionData["ogustResponse"]).toBe("max-good");
  });

  test("3NT response stores ogustResponse: solid", () => {
    const state = computeState(["2H", "P", "2NT", "P", "3NT"]);
    expect(state.conventionData["ogustResponse"]).toBe("solid");
  });

  test("Ogust response clears ShowSuit obligation", () => {
    // After Ogust ask, obligation is ShowSuit
    const stateAfterAsk = computeState(["2H", "P", "2NT"]);
    expect(stateAfterAsk.obligation.kind).toBe(ObligationKind.ShowSuit);

    // After response, obligation should be cleared
    const stateAfterResponse = computeState(["2H", "P", "2NT", "P", "3C"]);
    expect(stateAfterResponse.obligation.kind).toBe(ObligationKind.None);
  });

  test("Ogust tracking works for spade openings", () => {
    const state = computeState(["2S", "P", "2NT", "P", "3S"]);
    expect(state.conventionData["ogustResponse"]).toBe("max-good");
    expect(state.conventionData["openingSuit"]).toBe(BidSuit.Spades);
  });

  test("Ogust tracking works for diamond openings", () => {
    const state = computeState(["2D", "P", "2NT", "P", "3D"]);
    expect(state.conventionData["ogustResponse"]).toBe("min-good");
    expect(state.conventionData["openingSuit"]).toBe(BidSuit.Diamonds);
  });
});

// ─── Direct Raise Tracking ──────────────────────────────────

describe("Direct raise tracking", () => {
  test("partner raises to game (4H after 2H) sets directRaise", () => {
    // North opens 2H, East passes, South raises to 4H
    const state = computeState(["2H", "P", "4H"]);
    expect(state.conventionData["directRaise"]).toBe(true);
  });

  test("partner raises to game (4S after 2S) sets directRaise", () => {
    const state = computeState(["2S", "P", "4S"]);
    expect(state.conventionData["directRaise"]).toBe(true);
  });

  test("partner raises to game (5D after 2D) sets directRaise", () => {
    const state = computeState(["2D", "P", "5D"]);
    expect(state.conventionData["directRaise"]).toBe(true);
  });
});

// ─── Invite Tracking ────────────────────────────────────────

describe("Invite tracking", () => {
  test("partner raises to 3H (invite) after 2H sets inviteMade", () => {
    const state = computeState(["2H", "P", "3H"]);
    expect(state.conventionData["inviteMade"]).toBe(true);
  });

  test("partner raises to 3S (invite) after 2S sets inviteMade", () => {
    const state = computeState(["2S", "P", "3S"]);
    expect(state.conventionData["inviteMade"]).toBe(true);
  });

  test("partner raises to 3D (invite) after 2D sets inviteMade", () => {
    const state = computeState(["2D", "P", "3D"]);
    expect(state.conventionData["inviteMade"]).toBe(true);
  });

  test("invite is NOT set when partner raises directly to game", () => {
    const state = computeState(["2H", "P", "4H"]);
    expect(state.conventionData["inviteMade"]).toBeUndefined();
  });
});
