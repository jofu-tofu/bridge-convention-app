import { describe, expect, test } from "vitest";
import { refDescribe } from "../../../test-support/tiers";
import { Seat } from "../../../engine/types";
import { buildAuction } from "../../../engine/auction-helpers";
import { computeDialogueState } from "../../core/dialogue/dialogue-manager";
import { baselineTransitionRules } from "../../core/dialogue/baseline-transitions";
import { ForcingState } from "../../core/dialogue/dialogue-state";
import { lebensohlTransitionRules } from "../../definitions/lebensohl-lite/transitions";

function computeLebensohlState(bids: string[]) {
  return computeDialogueState(
    buildAuction(Seat.North, bids),
    lebensohlTransitionRules,
    baselineTransitionRules,
  );
}

refDescribe("[ref:bridgebum/lebensohl]", "Lebensohl Lite transitions", () => {
  test("relay-request pushes relay frame and sets forcing one round", () => {
    const state = computeLebensohlState(["1NT", "2H", "2NT"]);

    expect(state.forcingState).toBe(ForcingState.ForcingOneRound);
    expect(state.frames).toEqual([
      {
        kind: "relay",
        owner: "opener",
        targetStrain: "C",
        targetLevel: 3,
        pushedAt: 2,
      },
    ]);
  });

  test("relay-complete pops relay frame, pushes place-contract frame, clears forcing", () => {
    const state = computeLebensohlState(["1NT", "2H", "2NT", "P", "3C"]);

    expect(state.forcingState).toBe(ForcingState.Nonforcing);
    expect(state.frames).toEqual([
      {
        kind: "place-contract",
        owner: "responder",
        pushedAt: 4,
      },
    ]);
  });

  test("place-contract pops continuation frame after responder contract bid", () => {
    const state = computeLebensohlState(["1NT", "2H", "2NT", "P", "3C", "P", "3S"]);

    expect(state.forcingState).toBe(ForcingState.Nonforcing);
    expect(state.frames).toEqual([]);
  });

  test("direct-gf sets game-forcing without any frame", () => {
    const state = computeLebensohlState(["1NT", "2D", "3H"]);

    expect(state.forcingState).toBe(ForcingState.GameForcing);
    expect(state.frames).toEqual([]);
  });
});
