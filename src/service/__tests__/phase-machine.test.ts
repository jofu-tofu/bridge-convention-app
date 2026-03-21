/**
 * Phase machine tests — direct tests of pure isValidTransition().
 * Reuses Phase 0 characterization tests against the extracted pure function.
 */
import { describe, it, expect } from "vitest";
import { isValidTransition } from "../../core/phase-machine";

describe("phase machine (service)", () => {
  it("BIDDING → DECLARER_PROMPT is valid", () => {
    expect(isValidTransition("BIDDING", "DECLARER_PROMPT")).toBe(true);
  });

  it("BIDDING → EXPLANATION is valid", () => {
    expect(isValidTransition("BIDDING", "EXPLANATION")).toBe(true);
  });

  it("BIDDING → PLAYING is invalid", () => {
    expect(isValidTransition("BIDDING", "PLAYING")).toBe(false);
  });

  it("PLAYING → BIDDING is invalid", () => {
    expect(isValidTransition("PLAYING", "BIDDING")).toBe(false);
  });

  it("EXPLANATION → DECLARER_PROMPT is valid (playThisHand)", () => {
    expect(isValidTransition("EXPLANATION", "DECLARER_PROMPT")).toBe(true);
  });
});
