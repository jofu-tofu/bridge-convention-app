import { describe, test, expect, beforeEach } from "vitest";
import { Seat, BidSuit } from "../../../engine/types";
import type { ContractBid } from "../../../engine/types";
import { registerConvention, clearRegistry } from "../../core/registry";
import { saycConfig } from "../../definitions/sayc";
import { saycOverlays } from "../../definitions/sayc/overlays";
import { hand } from "../fixtures";
import { callFromRules } from "./helpers";
import { CompetitionMode, SystemMode } from "../../core/dialogue/dialogue-state";
import { refDescribe, policyDescribe } from "../../../test-support/tiers";
import type { DialogueState } from "../../core/dialogue/dialogue-state";
import { INITIAL_DIALOGUE_STATE } from "../../core/dialogue/dialogue-manager";

function stateWith(overrides: Partial<DialogueState>): DialogueState {
  return { ...INITIAL_DIALOGUE_STATE, ...overrides };
}

beforeEach(() => {
  clearRegistry();
  registerConvention(saycConfig);
});

refDescribe("[ref:SAYC]", "SAYC competitive bids", () => {
  // Migrated from rules.test.ts
  test("1NT overcall: 15-18 balanced, not opener/responder", () => {
    // Opponent (North) opened 1D, East overcalls 1NT with 15-18 balanced
    // A(4)+K(3) spades + A(4) hearts + K(3) diamonds + J(1) clubs = 15 HCP
    const overcaller = hand(
      "SA", "SK", "S5",
      "HA", "H5", "H3",
      "DK", "D5", "D3",
      "CJ", "C5", "C3", "C2",
    );
    const result = callFromRules(overcaller, Seat.East, ["1D"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-1nt-overcall");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(1);
    expect(call.strain).toBe(BidSuit.NoTrump);
  });

  // New tests
  test("1-level overcall: 8+ HCP, 5+ card suit higher than opponent", () => {
    // North opens 1C, East overcalls with 5+ spades and 10 HCP
    // A(4)+K(3) spades + Q(2) hearts + J(1) diamonds = 10 HCP
    const overcaller = hand(
      "SA", "SK", "S7", "S5", "S3", // 5 spades, 7 HCP
      "HQ", "H5", "H3",              // 3 hearts, 2 HCP
      "DJ", "D5", "D3",              // 3 diamonds, 1 HCP
      "C5", "C2",                     // 2 clubs, 0 HCP
    );
    const result = callFromRules(overcaller, Seat.East, ["1C"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-overcall-1level");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(1);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("2-level overcall: 10+ HCP, 5+ card suit", () => {
    // North opens 1S, East overcalls 2H with 5+ hearts and 12 HCP
    // A(4)+K(3)+Q(2) hearts + K(3) diamonds = 12 HCP
    const overcaller = hand(
      "S5", "S3", "S2",                    // 3 spades, 0 HCP
      "HA", "HK", "HQ", "H7", "H3",       // 5 hearts, 9 HCP (A4+K3+Q2=9)
      "DK", "D5", "D3",                    // 3 diamonds, 3 HCP
      "C5", "C2",                           // 2 clubs, 0 HCP
    );
    // 0+9+3+0 = 12 HCP
    const result = callFromRules(overcaller, Seat.East, ["1S"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-overcall-2level");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("no overcall: insufficient HCP or no good suit", () => {
    // North opens 1S, East has only 6 HCP and no 5-card suit
    // K(3) hearts + Q(2) diamonds + J(1) clubs = 6 HCP
    const overcaller = hand(
      "S5", "S3", "S2",        // 3 spades, 0 HCP
      "HK", "H5", "H3", "H2", // 4 hearts, 3 HCP
      "DQ", "D5", "D3",        // 3 diamonds, 2 HCP
      "CJ", "C5", "C3",        // 3 clubs, 1 HCP
    );
    // 6 HCP, no 5-card suit — passes
    const result = callFromRules(overcaller, Seat.East, ["1S"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-pass-no-overcall");
    expect(result!.call.type).toBe("pass");
  });
});

describe("SAYC overlay registration", () => {
  test("overlays validate against protocol on registration", () => {
    // Registration should not throw — overlays reference valid round "dispatch"
    expect(() => {
      clearRegistry();
      registerConvention(saycConfig);
    }).not.toThrow();
  });
});

policyDescribe("[policy]", "overlay activation depends on familyId and competitionMode", "SAYC overlay matching", () => {
  test("sayc-1nt-doubled activates when 1NT is doubled", () => {
    const state = stateWith({
      familyId: "sayc-1nt",
      competitionMode: CompetitionMode.Doubled,
      systemMode: SystemMode.Off,
    });
    const overlay = saycOverlays.find(o => o.id === "sayc-1nt-doubled");
    expect(overlay).toBeDefined();
    expect(overlay!.matches(state)).toBe(true);
  });

  test("sayc-1nt-doubled does NOT activate in uncontested auction", () => {
    const state = stateWith({
      familyId: "sayc-1nt",
      competitionMode: CompetitionMode.Uncontested,
      systemMode: SystemMode.On,
    });
    const overlay = saycOverlays.find(o => o.id === "sayc-1nt-doubled");
    expect(overlay!.matches(state)).toBe(false);
  });

  test("sayc-1nt-doubled does NOT activate for other families", () => {
    const state = stateWith({
      familyId: "sayc-suit",
      competitionMode: CompetitionMode.Doubled,
    });
    const overlay = saycOverlays.find(o => o.id === "sayc-1nt-doubled");
    expect(overlay!.matches(state)).toBe(false);
  });

  test("sayc-overcalled activates when suit opening is overcalled", () => {
    const state = stateWith({
      familyId: "sayc-suit",
      competitionMode: CompetitionMode.Overcalled,
      systemMode: SystemMode.Off,
    });
    const overlay = saycOverlays.find(o => o.id === "sayc-overcalled");
    expect(overlay).toBeDefined();
    expect(overlay!.matches(state)).toBe(true);
  });

  test("sayc-overcalled does NOT activate in uncontested auction", () => {
    const state = stateWith({
      familyId: "sayc-suit",
      competitionMode: CompetitionMode.Uncontested,
    });
    const overlay = saycOverlays.find(o => o.id === "sayc-overcalled");
    expect(overlay!.matches(state)).toBe(false);
  });

  test("sayc-overcalled does NOT activate for 1NT family", () => {
    const state = stateWith({
      familyId: "sayc-1nt",
      competitionMode: CompetitionMode.Overcalled,
    });
    const overlay = saycOverlays.find(o => o.id === "sayc-overcalled");
    expect(overlay!.matches(state)).toBe(false);
  });
});
