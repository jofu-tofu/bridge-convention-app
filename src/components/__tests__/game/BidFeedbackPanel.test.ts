import { describe, test, expect } from "vitest";
import { render, fireEvent, screen } from "@testing-library/svelte";
import BidFeedbackPanel from "../../game/BidFeedbackPanel.svelte";
import type { BidFeedback } from "../../../stores/game.svelte";
import type { TreeEvalSummary, TreeForkPoint, TreePathEntry } from "../../../shared/types";

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
    isCorrect: false,
    userCall: { type: "pass" },
    expectedResult: {
      call: { type: "bid", level: 2, strain: "C" as never },
      ruleName: "stayman-ask",
      explanation: "Stayman convention ask",
      treePath,
    },
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

  test("shows correct bid display for correct feedback", () => {
    const feedback: BidFeedback = {
      isCorrect: true,
      userCall: { type: "bid", level: 2, strain: "C" as never },
      expectedResult: {
        call: { type: "bid", level: 2, strain: "C" as never },
        ruleName: "stayman-ask",
        explanation: "Stayman",
      },
    };
    render(BidFeedbackPanel, {
      props: { feedback, onContinue: noop, onSkipToReview: noop },
    });

    expect(screen.getByText("Correct!")).toBeTruthy();
  });
});
