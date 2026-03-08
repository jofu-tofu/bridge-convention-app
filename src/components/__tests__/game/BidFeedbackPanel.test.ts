import { describe, test, expect } from "vitest";
import { render, fireEvent, screen } from "@testing-library/svelte";
import BidFeedbackPanel from "../../game/BidFeedbackPanel.svelte";
import type { BidFeedback } from "../../../stores/game.svelte";
import { BidGrade } from "../../../stores/bidding.svelte";
import type { TreeEvalSummary, TreeForkPoint, TreePathEntry, PracticalRecommendation } from "../../../core/contracts";

function makeForkPoint(): TreeForkPoint {
  const matched: TreePathEntry = {
    nodeName: "has-4-card-major",
    passed: true,
    description: "Has 4+ card major (4 hearts)",
    depth: 1,
    parentNodeName: "is-responder",
  };
  const rejected: TreePathEntry = {
    nodeName: "is-balanced",
    passed: false,
    description: "Hand is balanced (4-3-3-3)",
    depth: 1,
    parentNodeName: "is-responder",
  };
  return { matched, rejected };
}

function makeTreePath(forkPoint?: TreeForkPoint): TreeEvalSummary {
  return {
    matchedNodeName: "stayman-ask",
    path: [
      { nodeName: "is-responder", passed: true, description: "Is responder", depth: 0, parentNodeName: null },
    ],
    visited: [
      { nodeName: "is-responder", passed: true, description: "Is responder", depth: 0, parentNodeName: null },
    ],
    forkPoint,
  };
}

function makeWrongBidFeedback(treePath?: TreeEvalSummary): BidFeedback {
  return {
    grade: BidGrade.Incorrect,
    userCall: { type: "pass" },
    expectedResult: {
      call: { type: "bid", level: 2, strain: "C" as never },
      ruleName: "stayman-ask",
      explanation: "Stayman convention ask",
      treePath,
    },
    teachingResolution: null,
  };
}

describe("BidFeedbackPanel", () => {
  const noop = () => {};

  test("shows fork point when treePath.forkPoint exists and answer is revealed", async () => {
    const feedback = makeWrongBidFeedback(makeTreePath(makeForkPoint()));
    const { container } = render(BidFeedbackPanel, {
      props: { feedback, onContinue: noop, onSkipToReview: noop, onRetry: noop },
    });

    // Click the show answer button
    const showBtn = screen.getByLabelText("Show answer");
    await fireEvent.click(showBtn);

    // Fork point should be visible
    const forkSection = container.querySelector("[data-testid='fork-point']");
    expect(forkSection).not.toBeNull();
    expect(forkSection!.textContent).toContain("Has 4+ card major");
    expect(forkSection!.textContent).toContain("Hand is balanced");
  });

  test("does not show fork point when treePath is undefined", async () => {
    const feedback = makeWrongBidFeedback(undefined);
    const { container } = render(BidFeedbackPanel, {
      props: { feedback, onContinue: noop, onSkipToReview: noop, onRetry: noop },
    });

    const showBtn = screen.getByLabelText("Show answer");
    await fireEvent.click(showBtn);

    const forkSection = container.querySelector("[data-testid='fork-point']");
    expect(forkSection).toBeNull();
  });

  test("does not show fork point when forkPoint is undefined", async () => {
    const feedback = makeWrongBidFeedback(makeTreePath(undefined));
    const { container } = render(BidFeedbackPanel, {
      props: { feedback, onContinue: noop, onSkipToReview: noop, onRetry: noop },
    });

    const showBtn = screen.getByLabelText("Show answer");
    await fireEvent.click(showBtn);

    const forkSection = container.querySelector("[data-testid='fork-point']");
    expect(forkSection).toBeNull();
  });

  test("shows divergence note when resolvedCandidate has isDefaultCall: false", async () => {
    const treePath: TreeEvalSummary = {
      ...makeTreePath(),
      resolvedCandidates: [
        {
          bidName: "stayman-ask",
          meaning: "Asks for a 4-card major",
          call: { type: "bid", level: 2, strain: "C" as never },
          resolvedCall: { type: "bid", level: 2, strain: "D" as never },
          isDefaultCall: false,
          legal: true,
          isMatched: true,
          intentType: "AskForMajor",
          failedConditions: [],
        },
      ],
    };
    const feedback = makeWrongBidFeedback(treePath);
    const { container } = render(BidFeedbackPanel, {
      props: { feedback, onContinue: noop, onSkipToReview: noop, onRetry: noop },
    });

    const showBtn = screen.getByLabelText("Show answer");
    await fireEvent.click(showBtn);

    const note = container.querySelector("[data-testid='divergence-note']");
    expect(note).not.toBeNull();
    expect(note!.textContent).toContain("resolves differently");
  });

  test("no divergence note when resolvedCandidate has isDefaultCall: true", async () => {
    const treePath: TreeEvalSummary = {
      ...makeTreePath(),
      resolvedCandidates: [
        {
          bidName: "stayman-ask",
          meaning: "Asks for a 4-card major",
          call: { type: "bid", level: 2, strain: "C" as never },
          resolvedCall: { type: "bid", level: 2, strain: "C" as never },
          isDefaultCall: true,
          legal: true,
          isMatched: true,
          intentType: "AskForMajor",
          failedConditions: [],
        },
      ],
    };
    const feedback = makeWrongBidFeedback(treePath);
    const { container } = render(BidFeedbackPanel, {
      props: { feedback, onContinue: noop, onSkipToReview: noop, onRetry: noop },
    });

    const showBtn = screen.getByLabelText("Show answer");
    await fireEvent.click(showBtn);

    const note = container.querySelector("[data-testid='divergence-note']");
    expect(note).toBeNull();
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

  test("shows practical note when agreesWithTeaching is false", () => {
    const practicalRecommendation: PracticalRecommendation = {
      topCandidateBidName: "competitive-overcall",
      topCandidateCall: { type: "bid", level: 2, strain: "H" as never },
      topScore: 8.5,
      agreesWithTeaching: false,
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

  test("does not show practical note when agreesWithTeaching is true", () => {
    const practicalRecommendation: PracticalRecommendation = {
      topCandidateBidName: "stayman-ask",
      topCandidateCall: { type: "bid", level: 2, strain: "C" as never },
      topScore: 12.0,
      agreesWithTeaching: true,
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
      agreesWithTeaching: false,
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
