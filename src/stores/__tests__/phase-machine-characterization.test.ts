/**
 * Characterization tests for the extracted phase machine.
 *
 * Tests the pure isValidTransition() function directly.
 */
import { describe, it, expect } from "vitest";
import { isValidTransition, VALID_TRANSITIONS } from "../phase-machine";
import type { GamePhase } from "../phase-machine";

describe("phase machine — pure logic", () => {
  describe("valid transitions", () => {
    it("BIDDING → DECLARER_PROMPT is valid", () => {
      expect(isValidTransition("BIDDING", "DECLARER_PROMPT")).toBe(true);
    });

    it("BIDDING → EXPLANATION is valid (passed-out deal)", () => {
      expect(isValidTransition("BIDDING", "EXPLANATION")).toBe(true);
    });

    it("DECLARER_PROMPT → PLAYING is valid", () => {
      expect(isValidTransition("DECLARER_PROMPT", "PLAYING")).toBe(true);
    });

    it("DECLARER_PROMPT → EXPLANATION is valid (decline play)", () => {
      expect(isValidTransition("DECLARER_PROMPT", "EXPLANATION")).toBe(true);
    });

    it("PLAYING → EXPLANATION is valid", () => {
      expect(isValidTransition("PLAYING", "EXPLANATION")).toBe(true);
    });

    it("EXPLANATION → DECLARER_PROMPT is valid (playThisHand)", () => {
      expect(isValidTransition("EXPLANATION", "DECLARER_PROMPT")).toBe(true);
    });
  });

  describe("invalid transitions", () => {
    it("BIDDING → PLAYING is invalid", () => {
      expect(isValidTransition("BIDDING", "PLAYING")).toBe(false);
    });

    it("PLAYING → BIDDING is invalid", () => {
      expect(isValidTransition("PLAYING", "BIDDING")).toBe(false);
    });

    it("EXPLANATION → PLAYING is invalid", () => {
      expect(isValidTransition("EXPLANATION", "PLAYING")).toBe(false);
    });

    it("EXPLANATION → BIDDING is invalid", () => {
      expect(isValidTransition("EXPLANATION", "BIDDING")).toBe(false);
    });

    it("self-transitions are invalid", () => {
      const phases: GamePhase[] = ["BIDDING", "DECLARER_PROMPT", "PLAYING", "EXPLANATION"];
      for (const phase of phases) {
        expect(isValidTransition(phase, phase)).toBe(false);
      }
    });
  });

  describe("VALID_TRANSITIONS completeness", () => {
    it("every phase has at least one valid target", () => {
      const phases: GamePhase[] = ["BIDDING", "DECLARER_PROMPT", "PLAYING", "EXPLANATION"];
      for (const phase of phases) {
        expect(VALID_TRANSITIONS[phase].length).toBeGreaterThan(0);
      }
    });
  });
});
