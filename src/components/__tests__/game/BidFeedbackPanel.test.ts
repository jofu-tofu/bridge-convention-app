import { describe, test, expect } from "vitest";
import { render, fireEvent, screen } from "@testing-library/svelte";
import BidFeedbackPanel from "../../game/bid-feedback/BidFeedbackPanel.svelte";
import type { ViewportBidFeedback, TeachingDetail } from "../../../service";

function makeWrongViewportFeedback(): ViewportBidFeedback {
  return {
    grade: "incorrect",
    userCall: { type: "pass" },
    userCallDisplay: "Pass",
    correctCall: { type: "bid", level: 2, strain: "C" as never },
    correctCallDisplay: "2C",
    correctBidLabel: "Stayman",
    correctBidExplanation: "Stayman convention ask",
    requiresRetry: true,
  };
}

function makeWrongTeaching(): TeachingDetail {
  return {
    handSummary: undefined,
    fallbackExplanation: "Stayman convention ask",
    primaryBid: { type: "bid", level: 2, strain: "C" as never },
  };
}

describe("BidFeedbackPanel", () => {
  const noop = () => {};

  test("shows answer panel when answer is revealed", async () => {
    const feedback = makeWrongViewportFeedback();
    const { container } = render(BidFeedbackPanel, {
      props: { feedback, teaching: makeWrongTeaching(), onRetry: noop },
    });

    // Click the show answer button
    const showBtn = screen.getByLabelText("Show answer");
    await fireEvent.click(showBtn);

    // No fork point conditions since no decisionTrace
    const conditionList = container.querySelector("[aria-label='Bid conditions']");
    expect(conditionList).toBeNull();
  });

  test("does not show fork point conditions when decisionTrace is undefined", async () => {
    const feedback = makeWrongViewportFeedback();
    const { container } = render(BidFeedbackPanel, {
      props: { feedback, teaching: makeWrongTeaching(), onRetry: noop },
    });

    const showBtn = screen.getByLabelText("Show answer");
    await fireEvent.click(showBtn);

    const conditionList = container.querySelector("[aria-label='Bid conditions']");
    expect(conditionList).toBeNull();
  });

  test("does not show fork point conditions when forkPoint is undefined", async () => {
    const feedback = makeWrongViewportFeedback();
    const { container } = render(BidFeedbackPanel, {
      props: { feedback, teaching: makeWrongTeaching(), onRetry: noop },
    });

    const showBtn = screen.getByLabelText("Show answer");
    await fireEvent.click(showBtn);

    const conditionList = container.querySelector("[aria-label='Bid conditions']");
    expect(conditionList).toBeNull();
  });

  test("shows correct bid display for correct feedback", () => {
    const feedback: ViewportBidFeedback = {
      grade: "correct",
      userCall: { type: "bid", level: 2, strain: "C" as never },
      userCallDisplay: "2C",
      requiresRetry: false,
    };
    render(BidFeedbackPanel, {
      props: { feedback, teaching: null, onRetry: noop },
    });

    expect(screen.getByText("Correct!")).toBeTruthy();
  });

  test("shows Acceptable feedback with teal styling and auto-dismiss", () => {
    const feedback: ViewportBidFeedback = {
      grade: "acceptable",
      userCall: { type: "bid", level: 2, strain: "D" as never },
      userCallDisplay: "2D",
      requiresRetry: false,
    };
    const teaching: TeachingDetail = {
      primaryBid: { type: "bid", level: 2, strain: "C" as never },
      acceptableBids: [
        {
          call: { type: "bid", level: 2, strain: "D" as never },
          meaning: "Alternative treatment",
          reason: "preferred alternative: Alternative treatment",
          fullCredit: true,
        },
      ],
    };
    render(BidFeedbackPanel, {
      props: { feedback, teaching, onRetry: noop },
    });

    expect(screen.getByText("Acceptable!")).toBeTruthy();
    expect(screen.getByText("Textbook bid is")).toBeTruthy();
  });

  test("shows practical note when practical call differs from teaching call", () => {
    const feedback: ViewportBidFeedback = {
      grade: "correct",
      userCall: { type: "bid", level: 2, strain: "C" as never },
      userCallDisplay: "2C",
      correctCall: { type: "bid", level: 2, strain: "C" as never },
      correctCallDisplay: "2C",
      requiresRetry: false,
    };
    const teaching: TeachingDetail = {
      practicalRecommendation: {
        topCandidateCall: { type: "bid", level: 2, strain: "H" as never },
        rationale: "Strong heart suit with competitive advantage",
      },
    };
    const { container } = render(BidFeedbackPanel, {
      props: { feedback, teaching, onRetry: noop },
    });

    const note = container.querySelector("[data-testid='practical-note']");
    expect(note).not.toBeNull();
    expect(note!.textContent).toContain("Experienced players might prefer");
    expect(note!.textContent).toContain("Strong heart suit");
  });

  test("does not show practical note when practical call matches teaching call", () => {
    const feedback: ViewportBidFeedback = {
      grade: "correct",
      userCall: { type: "bid", level: 2, strain: "C" as never },
      userCallDisplay: "2C",
      correctCall: { type: "bid", level: 2, strain: "C" as never },
      correctCallDisplay: "2C",
      requiresRetry: false,
    };
    const teaching: TeachingDetail = {
      practicalRecommendation: {
        topCandidateCall: { type: "bid", level: 2, strain: "C" as never },
        rationale: "Stayman is correct here",
      },
    };
    const { container } = render(BidFeedbackPanel, {
      props: { feedback, teaching, onRetry: noop },
    });

    const note = container.querySelector("[data-testid='practical-note']");
    expect(note).toBeNull();
  });

  test("does not show practical note when practicalRecommendation is undefined", () => {
    const feedback: ViewportBidFeedback = {
      grade: "correct",
      userCall: { type: "bid", level: 2, strain: "C" as never },
      userCallDisplay: "2C",
      requiresRetry: false,
    };
    const { container } = render(BidFeedbackPanel, {
      props: { feedback, teaching: null, onRetry: noop },
    });

    const note = container.querySelector("[data-testid='practical-note']");
    expect(note).toBeNull();
  });

  test("shows practical note on incorrect feedback too", async () => {
    const feedback: ViewportBidFeedback = {
      grade: "incorrect",
      userCall: { type: "pass" },
      userCallDisplay: "Pass",
      correctCall: { type: "bid", level: 2, strain: "C" as never },
      correctCallDisplay: "2C",
      requiresRetry: true,
    };
    const teaching: TeachingDetail = {
      fallbackExplanation: "Stayman",
      practicalRecommendation: {
        topCandidateCall: { type: "bid", level: 2, strain: "H" as never },
        rationale: "Strong heart suit",
      },
    };
    const { container } = render(BidFeedbackPanel, {
      props: { feedback, teaching, onRetry: noop },
    });

    // Practical note on incorrect should show without needing to reveal answer
    const note = container.querySelector("[data-testid='practical-note']");
    expect(note).not.toBeNull();
    expect(note!.textContent).toContain("Experienced players might prefer");
  });
});
