import { describe, test, expect } from "vitest";
import { render, fireEvent, screen } from "@testing-library/svelte";
import BidFeedbackPanel from "../../game/BidFeedbackPanel.svelte";
import type { BidFeedback } from "../../../stores/game.svelte";
import { BidGrade } from "../../../stores/bidding.svelte";
import type { PracticalRecommendation } from "../../../core/contracts";
import type { BidResult } from "../../../core/contracts/bidding";

function makeWrongBidFeedback(): BidFeedback {
  const expectedResult: BidResult = {
    call: { type: "bid", level: 2, strain: "C" as never },
    ruleName: "stayman-ask",
    explanation: "Stayman convention ask",
  };
  return {
    grade: BidGrade.Incorrect,
    userCall: { type: "pass" },
    expectedResult,
    teachingResolution: null,
  };
}

describe("BidFeedbackPanel", () => {
  const noop = () => {};

  test("shows answer panel when answer is revealed", async () => {
    const feedback = makeWrongBidFeedback();
    const { container } = render(BidFeedbackPanel, {
      props: { feedback, onContinue: noop, onSkipToReview: noop, onRetry: noop },
    });

    // Click the show answer button
    const showBtn = screen.getByLabelText("Show answer");
    await fireEvent.click(showBtn);

    // No fork point conditions since no decisionTrace
    const conditionList = container.querySelector("[aria-label='Bid conditions']");
    expect(conditionList).toBeNull();
  });

  test("does not show fork point conditions when decisionTrace is undefined", async () => {
    const feedback = makeWrongBidFeedback();
    const { container } = render(BidFeedbackPanel, {
      props: { feedback, onContinue: noop, onSkipToReview: noop, onRetry: noop },
    });

    const showBtn = screen.getByLabelText("Show answer");
    await fireEvent.click(showBtn);

    // With no conditions or fork point, no condition list rendered
    const conditionList = container.querySelector("[aria-label='Bid conditions']");
    expect(conditionList).toBeNull();
  });

  test("does not show fork point conditions when forkPoint is undefined", async () => {
    const feedback = makeWrongBidFeedback();
    const { container } = render(BidFeedbackPanel, {
      props: { feedback, onContinue: noop, onSkipToReview: noop, onRetry: noop },
    });

    const showBtn = screen.getByLabelText("Show answer");
    await fireEvent.click(showBtn);

    // No fork point means no condition nodes from it
    const conditionList = container.querySelector("[aria-label='Bid conditions']");
    expect(conditionList).toBeNull();
  });

  test("shows correct bid display for correct feedback", () => {
    const feedback: BidFeedback = {
      grade: BidGrade.Correct,
      userCall: { type: "bid", level: 2, strain: "C" as never },
      expectedResult: {
        call: { type: "bid", level: 2, strain: "C" as never },
        ruleName: "stayman-ask",
        explanation: "Stayman",
      },
      teachingResolution: null,
    };
    render(BidFeedbackPanel, {
      props: { feedback, onContinue: noop, onSkipToReview: noop },
    });

    expect(screen.getByText("Correct!")).toBeTruthy();
  });

  test("shows Acceptable feedback with teal styling and auto-dismiss", () => {
    const feedback: BidFeedback = {
      grade: BidGrade.Acceptable,
      userCall: { type: "bid", level: 2, strain: "D" as never },
      expectedResult: {
        call: { type: "bid", level: 2, strain: "C" as never },
        ruleName: "stayman-ask",
        explanation: "Stayman",
      },
      teachingResolution: {
        primaryBid: { type: "bid", level: 2, strain: "C" as never },
        acceptableBids: [
          {
            call: { type: "bid", level: 2, strain: "D" as never },
            bidName: "stayman-alt",
            meaning: "Alternative treatment",
            reason: "preferred alternative: Alternative treatment",
            fullCredit: true,
            tier: "preferred",
          },
        ],
        gradingType: "primary_plus_acceptable",
        ambiguityScore: 0.6,
      },
    };
    render(BidFeedbackPanel, {
      props: { feedback, onContinue: noop, onSkipToReview: noop },
    });

    expect(screen.getByText("Acceptable!")).toBeTruthy();
    expect(screen.getByText("Textbook bid is")).toBeTruthy();
  });

  test("shows practical note when practical call differs from teaching call", () => {
    const practicalRecommendation: PracticalRecommendation = {
      topCandidateBidName: "competitive-overcall",
      topCandidateCall: { type: "bid", level: 2, strain: "H" as never },
      topScore: 8.5,
      rationale: "Strong heart suit with competitive advantage",
    };
    const feedback: BidFeedback = {
      grade: BidGrade.Correct,
      userCall: { type: "bid", level: 2, strain: "C" as never },
      expectedResult: {
        call: { type: "bid", level: 2, strain: "C" as never },
        ruleName: "stayman-ask",
        explanation: "Stayman",
      },
      teachingResolution: null,
      practicalRecommendation,
    };
    const { container } = render(BidFeedbackPanel, {
      props: { feedback, onContinue: noop, onSkipToReview: noop },
    });

    const note = container.querySelector("[data-testid='practical-note']");
    expect(note).not.toBeNull();
    expect(note!.textContent).toContain("Experienced players might prefer");
    expect(note!.textContent).toContain("Strong heart suit");
  });

  test("does not show practical note when practical call matches teaching call", () => {
    const practicalRecommendation: PracticalRecommendation = {
      topCandidateBidName: "stayman-ask",
      topCandidateCall: { type: "bid", level: 2, strain: "C" as never },
      topScore: 12.0,
      rationale: "Stayman is correct here",
    };
    const feedback: BidFeedback = {
      grade: BidGrade.Correct,
      userCall: { type: "bid", level: 2, strain: "C" as never },
      expectedResult: {
        call: { type: "bid", level: 2, strain: "C" as never },
        ruleName: "stayman-ask",
        explanation: "Stayman",
      },
      teachingResolution: null,
      practicalRecommendation,
    };
    const { container } = render(BidFeedbackPanel, {
      props: { feedback, onContinue: noop, onSkipToReview: noop },
    });

    const note = container.querySelector("[data-testid='practical-note']");
    expect(note).toBeNull();
  });

  test("does not show practical note when practicalRecommendation is undefined", () => {
    const feedback: BidFeedback = {
      grade: BidGrade.Correct,
      userCall: { type: "bid", level: 2, strain: "C" as never },
      expectedResult: {
        call: { type: "bid", level: 2, strain: "C" as never },
        ruleName: "stayman-ask",
        explanation: "Stayman",
      },
      teachingResolution: null,
    };
    const { container } = render(BidFeedbackPanel, {
      props: { feedback, onContinue: noop, onSkipToReview: noop },
    });

    const note = container.querySelector("[data-testid='practical-note']");
    expect(note).toBeNull();
  });

  test("shows practical note on incorrect feedback too", async () => {
    const practicalRecommendation: PracticalRecommendation = {
      topCandidateBidName: "competitive-overcall",
      topCandidateCall: { type: "bid", level: 2, strain: "H" as never },
      topScore: 8.5,
      rationale: "Strong heart suit",
    };
    const feedback: BidFeedback = {
      grade: BidGrade.Incorrect,
      userCall: { type: "pass" },
      expectedResult: {
        call: { type: "bid", level: 2, strain: "C" as never },
        ruleName: "stayman-ask",
        explanation: "Stayman",
      },
      teachingResolution: null,
      practicalRecommendation,
    };
    const { container } = render(BidFeedbackPanel, {
      props: { feedback, onContinue: noop, onSkipToReview: noop, onRetry: noop },
    });

    // Practical note on incorrect should show without needing to reveal answer
    const note = container.querySelector("[data-testid='practical-note']");
    expect(note).not.toBeNull();
    expect(note!.textContent).toContain("Experienced players might prefer");
  });
});
