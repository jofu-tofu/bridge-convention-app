import { describe, it, expect } from "vitest";
import { Seat } from "../../../engine/types";
import {
  CaptainRole,
  ObligationKind,
  ForcingState,
  CompetitionMode,
  SystemMode,
} from "../../core/dialogue/dialogue-state";
import type { DialogueState } from "../../core/dialogue/dialogue-state";
import { getLocalRoles } from "../../core/dialogue/helpers";

function makeState(overrides: Partial<DialogueState> = {}): DialogueState {
  return {
    familyId: "test",
    forcingState: ForcingState.ForcingOneRound,
    agreedStrain: { type: "none" },
    obligation: { kind: ObligationKind.None, obligatedSide: "opener" },
    competitionMode: CompetitionMode.Uncontested,
    captain: CaptainRole.Neither,
    systemMode: SystemMode.On,
    conventionData: { openerSeat: Seat.North },
    ...overrides,
  };
}

describe("getLocalRoles", () => {
  it("captain + opener seat includes 'captain'", () => {
    const state = makeState({ captain: CaptainRole.Opener });
    const roles = getLocalRoles(state, Seat.North);
    expect(roles).toContain("captain");
  });

  it("captain=Responder + partner of opener includes 'captain'", () => {
    const state = makeState({ captain: CaptainRole.Responder });
    // South is partner of North (opener)
    const roles = getLocalRoles(state, Seat.South);
    expect(roles).toContain("captain");
  });

  it("captain role not assigned to wrong seat", () => {
    const state = makeState({ captain: CaptainRole.Opener });
    // South is NOT opener (North is)
    const roles = getLocalRoles(state, Seat.South);
    expect(roles).not.toContain("captain");
  });

  it("obligation matches seat → includes 'obligated-bidder'", () => {
    const state = makeState({
      obligation: { kind: ObligationKind.ShowMajor, obligatedSide: "opener" },
    });
    const roles = getLocalRoles(state, Seat.North);
    expect(roles).toContain("obligated-bidder");
  });

  it("partner is obligated, we're waiting → includes 'waiting'", () => {
    const state = makeState({
      obligation: { kind: ObligationKind.ShowMajor, obligatedSide: "opener" },
    });
    // South is partner of opener, not the obligated side
    const roles = getLocalRoles(state, Seat.South);
    expect(roles).toContain("waiting");
  });

  it("frame owner matches seat → includes 'frame-owner'", () => {
    const state = makeState({
      frames: [{ kind: "relay", owner: "opener", pushedAt: 0 }],
    });
    const roles = getLocalRoles(state, Seat.North);
    expect(roles).toContain("frame-owner");
  });

  it("captain + frame-owner simultaneously → includes both", () => {
    const state = makeState({
      captain: CaptainRole.Opener,
      frames: [{ kind: "relay", owner: "opener", pushedAt: 0 }],
    });
    const roles = getLocalRoles(state, Seat.North);
    expect(roles).toContain("captain");
    expect(roles).toContain("frame-owner");
  });

  it("no special local role → ['participant']", () => {
    const state = makeState();
    const roles = getLocalRoles(state, Seat.North);
    expect(roles).toEqual(["participant"]);
  });

  it("always returns at least one role", () => {
    const state = makeState();
    expect(getLocalRoles(state, Seat.North).length).toBeGreaterThanOrEqual(1);
    expect(getLocalRoles(state, Seat.South).length).toBeGreaterThanOrEqual(1);
    expect(getLocalRoles(state, Seat.East).length).toBeGreaterThanOrEqual(1);
    expect(getLocalRoles(state, Seat.West).length).toBeGreaterThanOrEqual(1);
  });
});
