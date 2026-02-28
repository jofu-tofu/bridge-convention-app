import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";
import DecisionTree from "../../game/DecisionTree.svelte";
import type { TreeDisplayRow } from "../../../display/tree-display";
import { BidSuit } from "../../../engine/types";

function makeRows(): TreeDisplayRow[] {
  return [
    {
      id: "row-0",
      depth: 0,
      type: "decision",
      name: "is-responder",
      conditionLabel: "Auction is 1NT - Pass",
      conditionCategory: "auction",
      meaning: null,
      callResolver: null,
      hasChildren: true,
      parentId: null,
      branch: null,
      teachingExplanation: null,
      decisionMetadata: null,
      bidMetadata: null,
      denialImplication: null,
    },
    {
      id: "row-1",
      depth: 1,
      type: "bid",
      name: "stayman-ask",
      conditionLabel: null,
      conditionCategory: null,
      meaning: "Asks for a 4-card major",
      callResolver: () => ({ type: "bid" as const, level: 2 as const, strain: BidSuit.Clubs }),
      hasChildren: false,
      parentId: "row-0",
      branch: "yes",
      teachingExplanation: null,
      decisionMetadata: null,
      bidMetadata: null,
      denialImplication: null,
    },
    {
      id: "row-2",
      depth: 1,
      type: "decision",
      name: "has-points",
      conditionLabel: "8+ HCP",
      conditionCategory: "hand",
      meaning: null,
      callResolver: null,
      hasChildren: true,
      parentId: "row-0",
      branch: "no",
      teachingExplanation: null,
      decisionMetadata: null,
      bidMetadata: null,
      denialImplication: null,
    },
    {
      id: "row-3",
      depth: 2,
      type: "bid",
      name: "invite-bid",
      conditionLabel: null,
      conditionCategory: null,
      meaning: "Invites to game",
      callResolver: () => ({ type: "bid" as const, level: 2 as const, strain: BidSuit.NoTrump }),
      hasChildren: false,
      parentId: "row-2",
      branch: "yes",
      teachingExplanation: null,
      decisionMetadata: null,
      bidMetadata: null,
      denialImplication: null,
    },
    {
      id: "row-4",
      depth: 2,
      type: "fallback",
      name: "Not enough points",
      conditionLabel: null,
      conditionCategory: null,
      meaning: null,
      callResolver: null,
      hasChildren: false,
      parentId: "row-2",
      branch: "no",
      teachingExplanation: null,
      decisionMetadata: null,
      bidMetadata: null,
      denialImplication: null,
    },
  ];
}

/** Rows with teaching metadata populated for depth mode tests. */
function makeMetadataRows(): TreeDisplayRow[] {
  return [
    {
      id: "row-0",
      depth: 0,
      type: "decision",
      name: "check-hcp",
      conditionLabel: "8+ HCP",
      conditionCategory: "hand",
      meaning: null,
      callResolver: null,
      hasChildren: true,
      parentId: null,
      branch: null,
      teachingExplanation: "You need game-going values to explore",
      decisionMetadata: {
        whyThisMatters: "HCP determines if game is reachable",
        commonMistake: "Bidding Stayman with only 7 HCP",
        denialImplication: "Partner knows you have fewer than 8 HCP",
      },
      bidMetadata: null,
      denialImplication: null,
    },
    {
      id: "row-1",
      depth: 1,
      type: "bid",
      name: "stayman-ask",
      conditionLabel: null,
      conditionCategory: null,
      meaning: "Asks for a 4-card major",
      callResolver: () => ({ type: "bid" as const, level: 2 as const, strain: BidSuit.Clubs }),
      hasChildren: false,
      parentId: "row-0",
      branch: "yes",
      teachingExplanation: null,
      decisionMetadata: null,
      bidMetadata: {
        whyThisBid: "Finds a 4-4 major fit",
        partnerExpects: "Opener must respond 2D, 2H, or 2S",
        isArtificial: true,
        forcingType: "forcing",
        commonMistake: "Confusing with a natural 2C bid",
      },
      denialImplication: null,
    },
    {
      id: "row-2",
      depth: 1,
      type: "decision",
      name: "no-branch-child",
      conditionLabel: "4-card major",
      conditionCategory: "hand",
      meaning: null,
      callResolver: null,
      hasChildren: true,
      parentId: "row-0",
      branch: "no",
      teachingExplanation: null,
      decisionMetadata: null,
      bidMetadata: null,
      denialImplication: "Partner knows you have fewer than 8 HCP",
    },
    {
      id: "row-3",
      depth: 2,
      type: "fallback",
      name: "Convention does not apply",
      conditionLabel: null,
      conditionCategory: null,
      meaning: null,
      callResolver: null,
      hasChildren: false,
      parentId: "row-2",
      branch: "no",
      teachingExplanation: null,
      decisionMetadata: null,
      bidMetadata: null,
      denialImplication: null,
    },
  ];
}

describe("DecisionTree", () => {
  it("renders all rows when fully expanded", () => {
    render(DecisionTree, { props: { rows: makeRows() } });

    // Decision rows show conditionLabel (not name) when available
    expect(screen.getByText("Auction is 1NT - Pass")).toBeTruthy();
    expect(screen.getByText("Stayman Ask")).toBeTruthy();
    expect(screen.getByText("8+ HCP")).toBeTruthy();
    expect(screen.getByText("Invite Bid")).toBeTruthy();
    expect(screen.getByText("Not enough points")).toBeTruthy();
  });

  it("collapses children when chevron is clicked", async () => {
    render(DecisionTree, { props: { rows: makeRows() } });

    // Click the toggle for "has-points" (row-2) to collapse it
    const toggles = screen.getAllByRole("button", { name: /toggle/i });
    // Second toggle is "has-points" (row-2)
    const hasPointsToggle = toggles[1]!;
    await fireEvent.click(hasPointsToggle);

    // Children of row-2 (invite-bid, fallback) should disappear
    expect(screen.queryByText("Invite Bid")).toBeNull();
    expect(screen.queryByText("Not enough points")).toBeNull();
    // Sibling of row-2 (stayman-ask) should remain
    expect(screen.getByText("Stayman Ask")).toBeTruthy();
  });

  it("expands children when collapsed chevron is clicked again", async () => {
    render(DecisionTree, { props: { rows: makeRows() } });

    const toggles = screen.getAllByRole("button", { name: /toggle/i });
    const hasPointsToggle = toggles[1]!;

    // Collapse
    await fireEvent.click(hasPointsToggle);
    expect(screen.queryByText("Invite Bid")).toBeNull();

    // Expand again
    await fireEvent.click(hasPointsToggle);
    expect(screen.getByText("Invite Bid")).toBeTruthy();
    expect(screen.getByText("Not enough points")).toBeTruthy();
  });

  it("shows category tag text on decision rows", () => {
    render(DecisionTree, { props: { rows: makeRows() } });

    expect(screen.getByText("Auction")).toBeTruthy();
    expect(screen.getByText("Hand")).toBeTruthy();
  });

  it("has role=tree on container and role=treeitem on rows", () => {
    render(DecisionTree, { props: { rows: makeRows() } });

    expect(screen.getByRole("tree")).toBeTruthy();
    const treeitems = screen.getAllByRole("treeitem");
    expect(treeitems.length).toBe(5);
  });

  it("renders bid meaning text", () => {
    render(DecisionTree, { props: { rows: makeRows() } });

    expect(screen.getByText("Asks for a 4-card major")).toBeTruthy();
    expect(screen.getByText("Invites to game")).toBeTruthy();
  });
});

describe("DecisionTree depth modes", () => {
  describe("compact mode", () => {
    it("does not render teaching explanations", () => {
      render(DecisionTree, { props: { rows: makeMetadataRows(), depth: "compact" } });

      expect(screen.queryByText("You need game-going values to explore")).toBeNull();
    });

    it("does not render whyThisMatters or commonMistake", () => {
      render(DecisionTree, { props: { rows: makeMetadataRows(), depth: "compact" } });

      expect(screen.queryByText("HCP determines if game is reachable")).toBeNull();
      expect(screen.queryByText("Bidding Stayman with only 7 HCP")).toBeNull();
    });

    it("does not render artificial or forcing badges", () => {
      render(DecisionTree, { props: { rows: makeMetadataRows(), depth: "compact" } });

      expect(screen.queryByText("Artificial")).toBeNull();
      expect(screen.queryByText("Forcing")).toBeNull();
    });

    it("does not render denial implication", () => {
      render(DecisionTree, { props: { rows: makeMetadataRows(), depth: "compact" } });

      expect(screen.queryByText(/fewer than 8 HCP/)).toBeNull();
    });
  });

  describe("study mode", () => {
    it("renders teaching explanation on decision rows", () => {
      render(DecisionTree, { props: { rows: makeMetadataRows(), depth: "study" } });

      expect(screen.getByText("You need game-going values to explore")).toBeTruthy();
    });

    it("renders denial implication on NO-branch rows", () => {
      render(DecisionTree, { props: { rows: makeMetadataRows(), depth: "study" } });

      expect(screen.getByText("Partner knows you have fewer than 8 HCP")).toBeTruthy();
    });

    it("renders artificial and forcing badges on bid rows", () => {
      render(DecisionTree, { props: { rows: makeMetadataRows(), depth: "study" } });

      expect(screen.getByText("Artificial")).toBeTruthy();
      expect(screen.getByText("Forcing")).toBeTruthy();
    });

    it("does not render whyThisMatters or commonMistake", () => {
      render(DecisionTree, { props: { rows: makeMetadataRows(), depth: "study" } });

      expect(screen.queryByText("HCP determines if game is reachable")).toBeNull();
      expect(screen.queryByText("Bidding Stayman with only 7 HCP")).toBeNull();
    });

    it("does not render partnerExpects or whyThisBid", () => {
      render(DecisionTree, { props: { rows: makeMetadataRows(), depth: "study" } });

      expect(screen.queryByText("Finds a 4-4 major fit")).toBeNull();
      expect(screen.queryByText(/Opener must respond/)).toBeNull();
    });
  });

  describe("learn mode", () => {
    it("renders whyThisMatters as info block", () => {
      render(DecisionTree, { props: { rows: makeMetadataRows(), depth: "learn" } });

      expect(screen.getByText("HCP determines if game is reachable")).toBeTruthy();
    });

    it("renders commonMistake on decision rows", () => {
      render(DecisionTree, { props: { rows: makeMetadataRows(), depth: "learn" } });

      expect(screen.getByText("Bidding Stayman with only 7 HCP")).toBeTruthy();
    });

    it("renders whyThisBid on bid rows", () => {
      render(DecisionTree, { props: { rows: makeMetadataRows(), depth: "learn" } });

      expect(screen.getByText("Finds a 4-4 major fit")).toBeTruthy();
    });

    it("renders partnerExpects on bid rows", () => {
      render(DecisionTree, { props: { rows: makeMetadataRows(), depth: "learn" } });

      expect(screen.getByText(/Opener must respond/)).toBeTruthy();
    });

    it("renders commonMistake on bid rows", () => {
      render(DecisionTree, { props: { rows: makeMetadataRows(), depth: "learn" } });

      expect(screen.getByText("Confusing with a natural 2C bid")).toBeTruthy();
    });

    it("also renders all study mode content", () => {
      render(DecisionTree, { props: { rows: makeMetadataRows(), depth: "learn" } });

      // Teaching explanation
      expect(screen.getByText("You need game-going values to explore")).toBeTruthy();
      // Badges
      expect(screen.getByText("Artificial")).toBeTruthy();
      expect(screen.getByText("Forcing")).toBeTruthy();
      // Denial implication
      expect(screen.getByText("Partner knows you have fewer than 8 HCP")).toBeTruthy();
    });
  });

  it("gracefully handles missing metadata fields", () => {
    // makeRows() has all null metadata — should render without errors in all modes
    for (const depth of ["compact", "study", "learn"] as const) {
      const { unmount } = render(DecisionTree, { props: { rows: makeRows(), depth } });
      expect(screen.getByRole("tree")).toBeTruthy();
      unmount();
    }
  });
});
