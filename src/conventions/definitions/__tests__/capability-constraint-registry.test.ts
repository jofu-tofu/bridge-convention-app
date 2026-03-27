import { describe, it, expect } from "vitest";
import { archetypeSupportsRoleSelection } from "../capability-constraint-registry";
import { CAP_OPENING_1NT, CAP_OPENING_MAJOR, CAP_OPENING_WEAK_TWO, CAP_OPPONENT_1NT } from "../capability-vocabulary";

describe("archetypeSupportsRoleSelection", () => {
  it("returns true for partnership conventions (1NT, Bergen, Weak Twos)", () => {
    expect(archetypeSupportsRoleSelection(CAP_OPENING_1NT)).toBe(true);
    expect(archetypeSupportsRoleSelection(CAP_OPENING_MAJOR)).toBe(true);
    expect(archetypeSupportsRoleSelection(CAP_OPENING_WEAK_TWO)).toBe(true);
  });

  it("returns false for opponent conventions (DONT)", () => {
    expect(archetypeSupportsRoleSelection(CAP_OPPONENT_1NT)).toBe(false);
  });

  it("returns false for unknown capability IDs", () => {
    expect(archetypeSupportsRoleSelection("unknown-cap")).toBe(false);
  });
});
