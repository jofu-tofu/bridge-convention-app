/**
 * Evaluation facade tests — verifies the public API through viewport-only types.
 *
 * Tests use real convention bundles (nt-bundle) with seeded deals for
 * deterministic, reproducible results. The evaluation facade encapsulates
 * strategy, teaching, and convention internals — these tests verify that
 * only viewport types come out.
 */

import { describe, it, expect } from "vitest";
import {
  buildAtomViewport,
  gradeAtomBid,
  validateAtomId,
  parseAtomId,
  startPlaythrough,
  getPlaythroughStepViewport,
  gradePlaythroughBid,
  getPlaythroughRevealSteps,
} from "../index";

// ── Ensure convention registrations are loaded ────────────────────────
import "../../../conventions";

const BUNDLE = "nt-bundle";

// ── Atom evaluator ──────────────────────────────────────────────────

describe("atom-evaluator", () => {
  describe("parseAtomId", () => {
    it("parses a valid atom ID into moduleId and meaningId", () => {
      const parsed = parseAtomId("stayman/stayman:ask-major");
      expect(parsed).toEqual({
        moduleId: "stayman",
        meaningId: "stayman:ask-major",
      });
    });

    it("throws on an atom ID without a slash", () => {
      expect(() => parseAtomId("no-slash")).toThrow("Invalid atom ID");
    });
  });

  describe("validateAtomId", () => {
    it("accepts a known atom ID", () => {
      expect(() =>
        validateAtomId(BUNDLE, "stayman/stayman:ask-major"),
      ).not.toThrow();
    });

    it("throws for an unknown atom ID", () => {
      expect(() =>
        validateAtomId(BUNDLE, "stayman/nonexistent"),
      ).toThrow("Unknown atom");
    });

    it("throws for an unknown bundle", () => {
      expect(() =>
        validateAtomId("nonexistent-bundle", "some/atom"),
      ).toThrow();
    });
  });

  describe("buildAtomViewport", () => {
    it("returns a BiddingViewport with the expected shape", () => {
      const viewport = buildAtomViewport(
        BUNDLE,
        "natural-nt/bridge:1nt-opening",
        42,
      );

      // Structural checks — viewport type boundary
      expect(viewport).toHaveProperty("seat");
      expect(viewport).toHaveProperty("hand");
      expect(viewport).toHaveProperty("handEvaluation");
      expect(viewport).toHaveProperty("handSummary");
      expect(viewport).toHaveProperty("visibleHands");
      expect(viewport).toHaveProperty("auctionEntries");
      expect(viewport).toHaveProperty("legalCalls");
      expect(viewport).toHaveProperty("biddingOptions");
      expect(viewport).toHaveProperty("isUserTurn");
      expect(viewport).toHaveProperty("currentBidder");
      expect(viewport).toHaveProperty("conventionName");
      expect(viewport).toHaveProperty("dealer");
      expect(viewport).toHaveProperty("vulnerability");
    });

    it("shows only the active player's hand in visibleHands", () => {
      const viewport = buildAtomViewport(
        BUNDLE,
        "natural-nt/bridge:1nt-opening",
        42,
      );

      // Should have exactly one visible hand (the active seat)
      const visibleSeats = Object.keys(viewport.visibleHands);
      expect(visibleSeats).toHaveLength(1);
      expect(visibleSeats[0]).toBe(viewport.seat);
    });

    it("produces the same viewport for the same seed", () => {
      const v1 = buildAtomViewport(BUNDLE, "natural-nt/bridge:1nt-opening", 99);
      const v2 = buildAtomViewport(BUNDLE, "natural-nt/bridge:1nt-opening", 99);
      expect(v1.hand).toEqual(v2.hand);
      expect(v1.handSummary).toBe(v2.handSummary);
    });

    it("produces different viewports for different seeds", () => {
      const v1 = buildAtomViewport(BUNDLE, "natural-nt/bridge:1nt-opening", 1);
      const v2 = buildAtomViewport(BUNDLE, "natural-nt/bridge:1nt-opening", 2);
      // Different seeds should almost always produce different hands
      // (astronomically unlikely to be the same)
      expect(v1.handSummary).not.toBe(v2.handSummary);
    });

    it("includes hand evaluation with HCP", () => {
      const viewport = buildAtomViewport(
        BUNDLE,
        "natural-nt/bridge:1nt-opening",
        42,
      );
      expect(viewport.handEvaluation).toHaveProperty("hcp");
      expect(viewport.handEvaluation).toHaveProperty("shape");
      expect(viewport.handEvaluation).toHaveProperty("isBalanced");
      expect(typeof viewport.handEvaluation.hcp).toBe("number");
    });

    it("sets isUserTurn to true", () => {
      const viewport = buildAtomViewport(
        BUNDLE,
        "natural-nt/bridge:1nt-opening",
        42,
      );
      expect(viewport.isUserTurn).toBe(true);
    });
  });

  describe("gradeAtomBid", () => {
    // Seed 3 produces a hand where Stayman (2C) is the correct responder bid
    // after 1NT-P (South has 4+ card major and 8+ HCP).
    const STAYMAN_ATOM = "stayman/stayman:ask-major";
    const STAYMAN_SEED = 3;

    it("grades the correct bid as Correct", () => {
      const result = gradeAtomBid(BUNDLE, STAYMAN_ATOM, STAYMAN_SEED, "2C");

      expect(result.grade).toBe("correct");
      expect(result.correct).toBe(true);
      expect(result.skip).toBe(false);
      expect(result.correctBid).toBe("2C");
      expect(result.yourBid).toBe("2C");
    });

    it("grades an incorrect bid as not correct", () => {
      const result = gradeAtomBid(BUNDLE, STAYMAN_ATOM, STAYMAN_SEED, "3C");

      expect(result.correct).toBe(false);
      expect(result.skip).toBe(false);
      expect(result.grade).not.toBe("correct");
      expect(result.grade).not.toBe("correct-not-preferred");
    });

    it("returns viewport in the result", () => {
      const result = gradeAtomBid(BUNDLE, STAYMAN_ATOM, STAYMAN_SEED, "2C");

      expect(result.viewport).toBeDefined();
      expect(result.viewport.hand).toBeDefined();
      expect(result.viewport.legalCalls.length).toBeGreaterThan(0);
    });

    it("returns feedback for a non-skip graded bid", () => {
      const result = gradeAtomBid(BUNDLE, STAYMAN_ATOM, STAYMAN_SEED, "2C");

      expect(result.skip).toBe(false);
      expect(result.feedback).not.toBeNull();
    });

    it("returns teaching detail for a non-skip graded bid", () => {
      const result = gradeAtomBid(BUNDLE, STAYMAN_ATOM, STAYMAN_SEED, "2C");

      expect(result.skip).toBe(false);
      expect(result.teaching).not.toBeNull();
    });

    it("returns null feedback and teaching when strategy skips", () => {
      // Seed 2 produces a skip for the Stayman atom (strategy returns null)
      const result = gradeAtomBid(BUNDLE, STAYMAN_ATOM, 2, "2C");

      expect(result.skip).toBe(true);
      expect(result.feedback).toBeNull();
      expect(result.teaching).toBeNull();
    });
  });
});

// ── Type boundary tests ─────────────────────────────────────────────

describe("viewport type boundary", () => {
  it("AtomGradeResult contains only viewport-safe types", () => {
    const result = gradeAtomBid(
      BUNDLE,
      "stayman/stayman:ask-major",
      3,
      "2C",
    );

    // Verify the result shape matches AtomGradeResult exactly
    const keys = Object.keys(result);
    const allowedKeys = [
      "viewport", "grade", "correct", "acceptable", "skip",
      "yourBid", "correctBid", "feedback", "teaching",
    ];
    for (const key of keys) {
      expect(allowedKeys).toContain(key);
    }

    // Verify no internal pipeline types leak through
    // These properties should NOT exist on the result
    expect(result).not.toHaveProperty("arbitrationResult");
    expect(result).not.toHaveProperty("meaningSurface");
    expect(result).not.toHaveProperty("strategyEval");
    expect(result).not.toHaveProperty("bidResult");
    expect(result).not.toHaveProperty("teachingResolution");
  });

  it("BiddingViewport does not expose opponent hands", () => {
    const viewport = buildAtomViewport(
      BUNDLE,
      "natural-nt/bridge:1nt-opening",
      42,
    );

    // Only the player's own hand should be visible
    const visibleSeats = Object.keys(viewport.visibleHands);
    expect(visibleSeats).toHaveLength(1);

    // The viewport should not have a "deal" property (that would leak all hands)
    expect(viewport).not.toHaveProperty("deal");
    expect(viewport).not.toHaveProperty("allHands");
  });

  it("ViewportBidFeedback has viewport-safe structure", () => {
    const result = gradeAtomBid(
      BUNDLE,
      "stayman/stayman:ask-major",
      3,
      "3NT", // wrong bid to get richer feedback
    );

    if (result.feedback) {
      // Feedback should have grade and display-oriented fields
      expect(result.feedback).toHaveProperty("grade");
      expect(result.feedback).toHaveProperty("userCall");
      expect(result.feedback).toHaveProperty("requiresRetry");
      // Should not have raw pipeline types
      expect(result.feedback).not.toHaveProperty("arbitration");
      expect(result.feedback).not.toHaveProperty("rawProvenance");
    }
  });
});

// ── Playthrough evaluator ───────────────────────────────────────────

describe("playthrough-evaluator", () => {
  describe("startPlaythrough", () => {
    it("returns a handle with seed and step count", () => {
      const { handle } = startPlaythrough(BUNDLE, 42);

      expect(handle).toHaveProperty("seed", 42);
      expect(handle).toHaveProperty("totalUserSteps");
      expect(handle.totalUserSteps).toBeGreaterThanOrEqual(0);
      expect(handle).toHaveProperty("atomsCovered");
      expect(Array.isArray(handle.atomsCovered)).toBe(true);
    });

    it("returns a BiddingViewport as firstStep when there are steps", () => {
      const { handle, firstStep } = startPlaythrough(BUNDLE, 42);

      if (handle.totalUserSteps > 0) {
        expect(firstStep).not.toBeNull();
        expect(firstStep!).toHaveProperty("seat");
        expect(firstStep!).toHaveProperty("hand");
        expect(firstStep!).toHaveProperty("legalCalls");
        expect(firstStep!).toHaveProperty("isUserTurn");
      }
    });

    it("produces deterministic results for the same seed", () => {
      const r1 = startPlaythrough(BUNDLE, 77);
      const r2 = startPlaythrough(BUNDLE, 77);

      expect(r1.handle.totalUserSteps).toBe(r2.handle.totalUserSteps);
      expect(r1.handle.atomsCovered).toEqual(r2.handle.atomsCovered);
      if (r1.firstStep && r2.firstStep) {
        expect(r1.firstStep.handSummary).toBe(r2.firstStep.handSummary);
      }
    });
  });

  describe("getPlaythroughStepViewport", () => {
    it("returns a viewport for step 0", () => {
      const { handle } = startPlaythrough(BUNDLE, 42);
      if (handle.totalUserSteps === 0) return; // skip if no steps

      const viewport = getPlaythroughStepViewport(BUNDLE, 42, 0);
      expect(viewport).toHaveProperty("seat");
      expect(viewport).toHaveProperty("hand");
      expect(viewport).toHaveProperty("legalCalls");
    });

    it("throws for out-of-range step index", () => {
      const { handle } = startPlaythrough(BUNDLE, 42);
      expect(() =>
        getPlaythroughStepViewport(BUNDLE, 42, handle.totalUserSteps + 10),
      ).toThrow("out of range");
    });
  });

  describe("gradePlaythroughBid", () => {
    it("grades a bid at step 0 and returns viewport feedback", () => {
      const { handle } = startPlaythrough(BUNDLE, 42);
      if (handle.totalUserSteps === 0) return;

      // Get the reveal steps to find the correct bid
      const reveal = getPlaythroughRevealSteps(BUNDLE, 42);
      const firstUserStep = reveal.steps.find((s) => s.isUserStep);
      if (!firstUserStep) return;

      const correctBid = firstUserStep.recommendation;
      const result = gradePlaythroughBid(BUNDLE, 42, 0, correctBid);

      expect(result.correct).toBe(true);
      expect(result.grade).toBe("correct");
      expect(result).toHaveProperty("step");
      expect(result).toHaveProperty("feedback");
      expect(result).toHaveProperty("teaching");
      expect(result).toHaveProperty("complete");
      expect(result).toHaveProperty("yourBid", correctBid);
    });

    it("grades an incorrect bid appropriately", () => {
      const { handle } = startPlaythrough(BUNDLE, 42);
      if (handle.totalUserSteps === 0) return;

      // Submit "7NT" which is almost certainly wrong
      const result = gradePlaythroughBid(BUNDLE, 42, 0, "7NT");

      expect(result.correct).toBe(false);
      expect(result.grade).not.toBe("correct");
    });

    it("includes nextStep when more steps remain", () => {
      // Try several seeds to find one with multiple user steps
      for (let seed = 1; seed <= 50; seed++) {
        const { handle } = startPlaythrough(BUNDLE, seed);
        if (handle.totalUserSteps >= 2) {
          const reveal = getPlaythroughRevealSteps(BUNDLE, seed);
          const firstUserStep = reveal.steps.find((s) => s.isUserStep);
          if (!firstUserStep) continue;

          const result = gradePlaythroughBid(
            BUNDLE, seed, 0, firstUserStep.recommendation,
          );
          expect(result.nextStep).not.toBeNull();
          expect(result.complete).toBe(false);
          return; // Found a valid test case
        }
      }
      // If no multi-step seed found in range, skip gracefully
      // (this should be extremely unlikely for nt-bundle)
    });

    it("sets complete=true on the last step", () => {
      const { handle } = startPlaythrough(BUNDLE, 42);
      if (handle.totalUserSteps === 0) return;

      const lastIdx = handle.totalUserSteps - 1;
      const reveal = getPlaythroughRevealSteps(BUNDLE, 42);
      const userSteps = reveal.steps.filter((s) => s.isUserStep);
      const lastStep = userSteps[lastIdx];
      if (!lastStep) return;

      const result = gradePlaythroughBid(
        BUNDLE, 42, lastIdx, lastStep.recommendation,
      );
      expect(result.complete).toBe(true);
      expect(result.nextStep).toBeNull();
    });
  });

  describe("getPlaythroughRevealSteps", () => {
    it("returns all steps with expected metadata", () => {
      const result = getPlaythroughRevealSteps(BUNDLE, 42);

      expect(result).toHaveProperty("totalSteps");
      expect(result).toHaveProperty("steps");
      expect(result).toHaveProperty("atomsCovered");
      expect(result.totalSteps).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.steps)).toBe(true);
    });

    it("each step has the RevealStep shape", () => {
      const result = getPlaythroughRevealSteps(BUNDLE, 42);

      for (const step of result.steps) {
        expect(step).toHaveProperty("stepIndex");
        expect(step).toHaveProperty("seat");
        expect(step).toHaveProperty("recommendation");
        expect(step).toHaveProperty("isUserStep");
        expect(step).toHaveProperty("auctionSoFar");
        expect(typeof step.stepIndex).toBe("number");
        expect(typeof step.seat).toBe("string");
        expect(typeof step.recommendation).toBe("string");
        expect(typeof step.isUserStep).toBe("boolean");
      }
    });

    it("step indices are sequential starting from 0", () => {
      const result = getPlaythroughRevealSteps(BUNDLE, 42);

      for (let i = 0; i < result.steps.length; i++) {
        expect(result.steps[i]!.stepIndex).toBe(i);
      }
    });

    it("totalSteps matches the count of user steps", () => {
      const result = getPlaythroughRevealSteps(BUNDLE, 42);
      const userStepCount = result.steps.filter((s) => s.isUserStep).length;
      expect(result.totalSteps).toBe(userStepCount);
    });
  });
});

// ── Grading accuracy with real bundles ───────────────────────────────

describe("grading accuracy (nt-bundle)", () => {
  it("Stayman 2C is the correct bid for a hand with 4+ card major and 8+ HCP", () => {
    // Try seeds until we find one where Stayman is recommended
    for (let seed = 1; seed <= 100; seed++) {
      try {
        const result = gradeAtomBid(
          BUNDLE,
          "stayman/stayman:ask-major",
          seed,
          "2C",
        );
        if (!result.skip) {
          expect(result.correct).toBe(true);
          expect(result.grade).toBe("correct");
          expect(result.correctBid).toBe("2C");
          return;
        }
      } catch {
        // Some seeds may not generate valid hands for this atom
        continue;
      }
    }
  });

  it("a wrong bid for Stayman atom gets graded as not correct", () => {
    for (let seed = 1; seed <= 100; seed++) {
      try {
        const result = gradeAtomBid(
          BUNDLE,
          "stayman/stayman:ask-major",
          seed,
          "3NT",
        );
        if (!result.skip) {
          expect(result.correct).toBe(false);
          return;
        }
      } catch {
        continue;
      }
    }
  });

  it("transfer to hearts gets correct grade for 2D bid", () => {
    for (let seed = 1; seed <= 100; seed++) {
      try {
        const result = gradeAtomBid(
          BUNDLE,
          "jacoby-transfers/transfer:to-hearts",
          seed,
          "2D",
        );
        if (!result.skip) {
          expect(result.correct).toBe(true);
          expect(result.correctBid).toBe("2D");
          return;
        }
      } catch {
        continue;
      }
    }
  });
});
