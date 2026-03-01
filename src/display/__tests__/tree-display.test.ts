import { describe, it, expect } from "vitest";
import { flattenTreeForDisplay, formatBidToken } from "../tree-display";
import type { TreeDisplayRow as _TreeDisplayRow } from "../tree-display";
import {
  decision,
  fallback,
  handDecision,
} from "../../conventions/core/rule-tree";
import type { ConventionExplanations } from "../../conventions/core/rule-tree";
import { intentBid } from "../../conventions/core/intent/intent-node";
import { SemanticIntentType } from "../../conventions/core/intent/semantic-intent";
import {
  hcpMin,
  suitMin,
  auctionMatches,
  auctionMatchesAny,
  isOpener,
} from "../../conventions/core/conditions";
import type { BiddingContext } from "../../conventions/core/types";
import type { Call } from "../../engine/types";
import { BidSuit } from "../../engine/types";

const makeCall =
  (level: 1 | 2 | 3 | 4 | 5 | 6 | 7, strain: BidSuit) =>
  (_ctx: BiddingContext): Call => ({
    type: "bid",
    level,
    strain,
  });

/** Test helper: wraps intentBid with a default Signoff intent for tree-display tests. */
import type { BidMetadata } from "../../conventions/core/rule-tree";
function bid(name: string, meaning: string, callFn: (ctx: BiddingContext) => Call, metadata?: BidMetadata) {
  return intentBid(name, meaning, { type: SemanticIntentType.Signoff, params: {} }, callFn, metadata);
}

describe("flattenTreeForDisplay", () => {
  it("returns one row for a single BidNode", () => {
    const tree = bid("test-bid", "Shows strength", makeCall(1, BidSuit.Clubs));
    const rows = flattenTreeForDisplay(tree);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.type).toBe("bid");
    expect(rows[0]!.name).toBe("test-bid");
    expect(rows[0]!.meaning).toBe("Shows strength");
    expect(rows[0]!.depth).toBe(0);
    expect(rows[0]!.callResolver).toBeTypeOf("function");
    expect(rows[0]!.parentId).toBeNull();
    expect(rows[0]!.branch).toBeNull();
  });

  it("skips FallbackNodes without a reason", () => {
    const tree = decision(
      "check-hcp",
      hcpMin(10),
      bid("open", "Opens the bidding", makeCall(1, BidSuit.Clubs)),
      fallback(),
    );
    const rows = flattenTreeForDisplay(tree);

    // decision + bid = 2 rows (fallback without reason skipped)
    expect(rows).toHaveLength(2);
    expect(rows[0]!.type).toBe("decision");
    expect(rows[1]!.type).toBe("bid");
  });

  it("includes FallbackNodes with a reason", () => {
    const tree = decision(
      "check-hcp",
      hcpMin(10),
      bid("open", "Opens the bidding", makeCall(1, BidSuit.Clubs)),
      fallback("Not enough HCP"),
    );
    const rows = flattenTreeForDisplay(tree);

    expect(rows).toHaveLength(3);
    expect(rows[2]!.type).toBe("fallback");
    expect(rows[2]!.name).toBe("Not enough HCP");
    expect(rows[2]!.branch).toBe("no");
  });

  it("produces correct depth chain for nested decisions", () => {
    const tree = decision(
      "outer",
      hcpMin(10),
      decision(
        "inner",
        suitMin(0, "spades", 4),
        bid("spade-bid", "Shows spades", makeCall(1, BidSuit.Spades)),
        fallback(),
      ),
      fallback(),
    );
    const rows = flattenTreeForDisplay(tree);

    expect(rows[0]!.depth).toBe(0); // outer decision
    expect(rows[1]!.depth).toBe(1); // inner decision
    expect(rows[2]!.depth).toBe(2); // spade-bid
    expect(rows[0]!.name).toBe("outer");
    expect(rows[1]!.name).toBe("inner");
    expect(rows[2]!.name).toBe("spade-bid");
  });

  it("sets parentId correctly", () => {
    const tree = decision(
      "root",
      hcpMin(10),
      bid("yes-bid", "Yes branch", makeCall(1, BidSuit.Clubs)),
      bid("no-bid", "No branch", makeCall(1, BidSuit.Diamonds)),
    );
    const rows = flattenTreeForDisplay(tree);

    expect(rows[0]!.parentId).toBeNull(); // root
    expect(rows[1]!.parentId).toBe(rows[0]!.id); // yes child
    expect(rows[2]!.parentId).toBe(rows[0]!.id); // no child
  });

  it("labels branches correctly (yes/no)", () => {
    const tree = decision(
      "root",
      hcpMin(10),
      bid("yes-bid", "Yes branch", makeCall(1, BidSuit.Clubs)),
      bid("no-bid", "No branch", makeCall(1, BidSuit.Diamonds)),
    );
    const rows = flattenTreeForDisplay(tree);

    expect(rows[1]!.branch).toBe("yes");
    expect(rows[2]!.branch).toBe("no");
  });

  it("sets conditionCategory from condition.category", () => {
    const tree = decision(
      "auction-check",
      auctionMatchesAny([["1NT", "P"]]),
      decision(
        "hand-check",
        hcpMin(8),
        bid("respond", "Responds", makeCall(2, BidSuit.Clubs)),
        fallback(),
      ),
      fallback(),
    );
    const rows = flattenTreeForDisplay(tree);

    const auctionRow = rows.find((r) => r.name === "auction-check");
    const handRow = rows.find((r) => r.name === "hand-check");
    expect(auctionRow!.conditionCategory).toBe("auction");
    expect(handRow!.conditionCategory).toBe("hand");
  });

  it("sets conditionLabel from condition.label", () => {
    const tree = decision(
      "check-hcp",
      hcpMin(10),
      bid("open", "Opens", makeCall(1, BidSuit.Clubs)),
      fallback(),
    );
    const rows = flattenTreeForDisplay(tree);

    expect(rows[0]!.conditionLabel).toBe(hcpMin(10).label);
    expect(rows[0]!.conditionLabel).toBeTruthy();
  });

  it("flattens a multi-level tree with nonzero rows", () => {
    // Synthetic tree with auction + hand conditions (all conventions now use protocol)
    const tree = decision(
      "auction-check",
      auctionMatches(["1NT", "P"]),
      decision(
        "hcp-check",
        hcpMin(10),
        bid("strong-bid", "Shows strength", makeCall(3, BidSuit.NoTrump)),
        bid("weak-bid", "Shows weakness", makeCall(2, BidSuit.NoTrump)),
      ),
      fallback(),
    );

    const rows = flattenTreeForDisplay(tree);

    expect(rows.length).toBeGreaterThan(0);
    // All rows have valid types
    for (const row of rows) {
      expect(["decision", "bid", "fallback"]).toContain(row.type);
      expect(row.id).toMatch(/^row-\d+$/);
      expect(row.depth).toBeGreaterThanOrEqual(0);
    }
    // At least some bid rows exist
    const bidRows = rows.filter((r) => r.type === "bid");
    expect(bidRows.length).toBeGreaterThan(0);
    // All bid rows have callResolver
    for (const r of bidRows) {
      expect(r.callResolver).toBeTypeOf("function");
    }
  });

  it("decision rows have hasChildren=true, bid/fallback have false", () => {
    const tree = decision(
      "root",
      hcpMin(10),
      bid("yes-bid", "Yes", makeCall(1, BidSuit.Clubs)),
      fallback("No match"),
    );
    const rows = flattenTreeForDisplay(tree);

    expect(rows.find((r) => r.type === "decision")!.hasChildren).toBe(true);
    expect(rows.find((r) => r.type === "bid")!.hasChildren).toBe(false);
    expect(rows.find((r) => r.type === "fallback")!.hasChildren).toBe(false);
  });
});

describe("formatBidToken", () => {
  it("formats suit bids with symbols", () => {
    expect(formatBidToken("1C")).toBe("1♣");
    expect(formatBidToken("2H")).toBe("2♥");
    expect(formatBidToken("3D")).toBe("3♦");
    expect(formatBidToken("4S")).toBe("4♠");
  });

  it("formats NT bids", () => {
    expect(formatBidToken("1NT")).toBe("1NT");
    expect(formatBidToken("2NT")).toBe("2NT");
  });

  it("formats pass, double, redouble", () => {
    expect(formatBidToken("P")).toBe("Pass");
    expect(formatBidToken("X")).toBe("Dbl");
    expect(formatBidToken("XX")).toBe("Rdbl");
  });
});

describe("auction chain flattening", () => {
  it("flattens auction NO-chains to siblings at the same depth", () => {
    const tree = decision(
      "after-1nt-p",
      auctionMatches(["1NT", "P"]),
      bid("ask", "Asks", makeCall(2, BidSuit.Clubs)),
      decision(
        "after-1nt-p-2c-p",
        auctionMatches(["1NT", "P", "2C", "P"]),
        bid("respond", "Responds", makeCall(2, BidSuit.Hearts)),
        fallback(),
      ),
    );
    const rows = flattenTreeForDisplay(tree);

    const row1 = rows.find((r) => r.name === "after-1nt-p")!;
    const row2 = rows.find((r) => r.name === "after-1nt-p-2c-p")!;

    // Both auction contexts at same depth (siblings, not nested)
    expect(row1.depth).toBe(0);
    expect(row2.depth).toBe(0);
    // Same parent
    expect(row1.parentId).toBe(row2.parentId);
  });

  it("flattened siblings use full 'After' labels, not incremental 'Then'", () => {
    const tree = decision(
      "after-1nt-p",
      auctionMatches(["1NT", "P"]),
      bid("ask", "Asks", makeCall(2, BidSuit.Clubs)),
      decision(
        "after-1nt-p-2c-p",
        auctionMatches(["1NT", "P", "2C", "P"]),
        bid("respond", "Responds", makeCall(2, BidSuit.Hearts)),
        fallback(),
      ),
    );
    const rows = flattenTreeForDisplay(tree);
    const row2 = rows.find((r) => r.name === "after-1nt-p-2c-p")!;

    // Full label, not incremental "Then ..." since it's a sibling
    expect(row2.conditionLabel).toBe("After 1NT — Pass — 2♣ — Pass");
  });

  it("skips terminal fallback at end of auction chain", () => {
    const tree = decision(
      "after-1nt-p",
      auctionMatches(["1NT", "P"]),
      bid("ask", "Asks", makeCall(2, BidSuit.Clubs)),
      decision(
        "after-1nt-p-2c-p",
        auctionMatches(["1NT", "P", "2C", "P"]),
        bid("respond", "Responds", makeCall(2, BidSuit.Hearts)),
        fallback("not-applicable"),
      ),
    );
    const rows = flattenTreeForDisplay(tree);

    // Terminal fallback in auction chain is skipped
    expect(rows.filter((r) => r.type === "fallback")).toHaveLength(0);
  });

  it("YES-branch children remain nested under their auction parent", () => {
    const tree = decision(
      "after-1nt-p",
      auctionMatches(["1NT", "P"]),
      decision(
        "hcp-check",
        hcpMin(8),
        bid("ask", "Asks", makeCall(2, BidSuit.Clubs)),
        fallback(),
      ),
      decision(
        "after-1nt-p-2c-p",
        auctionMatches(["1NT", "P", "2C", "P"]),
        bid("respond", "Responds", makeCall(2, BidSuit.Hearts)),
        fallback(),
      ),
    );
    const rows = flattenTreeForDisplay(tree);

    const auctionRow1 = rows.find((r) => r.name === "after-1nt-p")!;
    const handRow = rows.find((r) => r.name === "hcp-check")!;
    const auctionRow2 = rows.find((r) => r.name === "after-1nt-p-2c-p")!;

    // Hand check is nested under first auction context
    expect(handRow.depth).toBe(1);
    expect(handRow.parentId).toBe(auctionRow1.id);
    // Second auction context is sibling at same depth
    expect(auctionRow2.depth).toBe(0);
  });

  it("flattens three-deep auction chain to same depth", () => {
    const tree = decision(
      "ctx-a",
      auctionMatches(["1NT", "P"]),
      bid("bid-a", "Bid A", makeCall(2, BidSuit.Clubs)),
      decision(
        "ctx-b",
        auctionMatches(["2NT", "P"]),
        bid("bid-b", "Bid B", makeCall(3, BidSuit.Clubs)),
        decision(
          "ctx-c",
          auctionMatches(["1NT", "P", "2C", "P"]),
          bid("bid-c", "Bid C", makeCall(2, BidSuit.Hearts)),
          fallback(),
        ),
      ),
    );
    const rows = flattenTreeForDisplay(tree);

    const ctxA = rows.find((r) => r.name === "ctx-a")!;
    const ctxB = rows.find((r) => r.name === "ctx-b")!;
    const ctxC = rows.find((r) => r.name === "ctx-c")!;

    expect(ctxA.depth).toBe(0);
    expect(ctxB.depth).toBe(0);
    expect(ctxC.depth).toBe(0);
  });

  it("non-auction NO branches are not flattened", () => {
    const tree = decision(
      "after-1nt-p",
      auctionMatches(["1NT", "P"]),
      bid("ask", "Asks", makeCall(2, BidSuit.Clubs)),
      decision(
        "hcp-check",
        hcpMin(8),
        bid("pass", "Passes", makeCall(1, BidSuit.Diamonds)),
        fallback(),
      ),
    );
    const rows = flattenTreeForDisplay(tree);

    const auctionRow = rows.find((r) => r.name === "after-1nt-p")!;
    const handRow = rows.find((r) => r.name === "hcp-check")!;

    // Hand decision on NO branch stays nested (not flattened)
    expect(handRow.depth).toBe(1);
    expect(handRow.parentId).toBe(auctionRow.id);
  });
});

describe("incremental auction labels", () => {
  it("root auction node uses 'After' prefix with formatted tokens", () => {
    const tree = decision(
      "after-1nt-p",
      auctionMatches(["1NT", "P"]),
      bid("respond", "Responds", makeCall(2, BidSuit.Clubs)),
      fallback(),
    );
    const rows = flattenTreeForDisplay(tree);
    const auctionRow = rows.find((r) => r.name === "after-1nt-p")!;

    expect(auctionRow.conditionLabel).toBe("After 1NT — Pass");
  });

  it("flattened auction siblings use full 'After' labels (not incremental 'Then')", () => {
    const tree = decision(
      "after-1nt-p",
      auctionMatches(["1NT", "P"]),
      bid("ask", "Asks", makeCall(2, BidSuit.Clubs)),
      decision(
        "after-1nt-p-2c-p",
        auctionMatches(["1NT", "P", "2C", "P"]),
        bid("respond", "Responds", makeCall(2, BidSuit.Hearts)),
        fallback(),
      ),
    );
    const rows = flattenTreeForDisplay(tree);
    const childRow = rows.find((r) => r.name === "after-1nt-p-2c-p")!;

    // Flattened to sibling — uses full "After" label
    expect(childRow.conditionLabel).toBe("After 1NT — Pass — 2♣ — Pass");
  });

  it("fullConditionLabel preserves original raw label", () => {
    const tree = decision(
      "after-1nt-p",
      auctionMatches(["1NT", "P"]),
      bid("ask", "Asks", makeCall(2, BidSuit.Clubs)),
      decision(
        "after-1nt-p-2c-p",
        auctionMatches(["1NT", "P", "2C", "P"]),
        bid("respond", "Responds", makeCall(2, BidSuit.Hearts)),
        fallback(),
      ),
    );
    const rows = flattenTreeForDisplay(tree);
    const rootRow = rows.find((r) => r.name === "after-1nt-p")!;
    const childRow = rows.find((r) => r.name === "after-1nt-p-2c-p")!;

    expect(rootRow.fullConditionLabel).toBe("After 1NT — P");
    expect(childRow.fullConditionLabel).toBe("After 1NT — P — 2C — P");
  });

  it("hand-category conditions are unchanged", () => {
    const tree = decision(
      "check-hcp",
      hcpMin(10),
      bid("open", "Opens", makeCall(1, BidSuit.Clubs)),
      fallback(),
    );
    const rows = flattenTreeForDisplay(tree);
    const hcpRow = rows.find((r) => r.name === "check-hcp")!;

    expect(hcpRow.conditionLabel).toBe(hcpMin(10).label);
    expect(hcpRow.fullConditionLabel).toBe(hcpMin(10).label);
  });

  it("relational auction conditions pass through unchanged", () => {
    const tree = decision(
      "opener-check",
      isOpener(),
      bid("open", "Opens", makeCall(1, BidSuit.Clubs)),
      fallback(),
    );
    const rows = flattenTreeForDisplay(tree);
    const openerRow = rows.find((r) => r.name === "opener-check")!;

    expect(openerRow.conditionLabel).toBe("Opening bidder");
  });

  it("auctionMatches formats auction labels with suit symbols", () => {
    // Synthetic tree testing auction label formatting (all conventions now use protocol)
    const tree = decision(
      "auction-check",
      auctionMatches(["1NT", "P", "2C", "P"]),
      bid("test-bid", "Test bid", makeCall(2, BidSuit.Hearts)),
      fallback(),
    );

    const rows = flattenTreeForDisplay(tree);
    const auctionRows = rows.filter(
      (r) => r.conditionCategory === "auction" && r.conditionLabel?.startsWith("After "),
    );

    expect(auctionRows.length).toBeGreaterThan(0);
    // All "After ..." auction labels have formatted tokens (Pass instead of P, suit symbols)
    for (const row of auctionRows) {
      expect(row.conditionLabel).toContain("Pass");
      expect(row.conditionLabel).not.toMatch(/— P( |$)/);
    }
    // At least one has a suit symbol
    const hasSuitSymbol = auctionRows.some(
      (r) =>
        r.conditionLabel!.includes("♣") ||
        r.conditionLabel!.includes("♥") ||
        r.conditionLabel!.includes("♦") ||
        r.conditionLabel!.includes("♠"),
    );
    expect(hasSuitSymbol).toBe(true);
  });

  it("nested auction conditions produce multiple auction condition labels", () => {
    // Synthetic tree with nested auction conditions (all conventions now use protocol)
    const tree = decision(
      "auction-1",
      auctionMatches(["1NT", "P"]),
      decision(
        "auction-2",
        auctionMatches(["1NT", "P", "4C", "P"]),
        bid("deep-bid", "Deep", makeCall(4, BidSuit.Diamonds)),
        fallback(),
      ),
      decision(
        "auction-3",
        isOpener(),
        bid("opener-bid", "Opener", makeCall(1, BidSuit.Clubs)),
        fallback(),
      ),
    );

    const rows = flattenTreeForDisplay(tree);
    const auctionRows = rows.filter(
      (r) => r.conditionCategory === "auction",
    );

    expect(auctionRows.length).toBeGreaterThanOrEqual(3);
  });

  it("auctionMatchesAny flattened siblings show full labels with alternatives", () => {
    // Simulates Gerber: root = "1NT-P or 2NT-P", child = "1NT-P-4C-P or 2NT-P-4C-P"
    const tree = decision(
      "root-auction",
      auctionMatchesAny([
        ["1NT", "P"],
        ["2NT", "P"],
      ]),
      bid("ask", "Asks", makeCall(4, BidSuit.Clubs)),
      decision(
        "ace-ask",
        auctionMatchesAny([
          ["1NT", "P", "4C", "P"],
          ["2NT", "P", "4C", "P"],
        ]),
        bid("respond", "Shows aces", makeCall(4, BidSuit.Diamonds)),
        fallback(),
      ),
    );
    const rows = flattenTreeForDisplay(tree);
    const aceAskRow = rows.find((r) => r.name === "ace-ask")!;

    // Flattened sibling — full labels with both alternatives
    expect(aceAskRow.conditionLabel).toBe(
      "After 1NT — Pass — 4♣ — Pass or 2NT — Pass — 4♣ — Pass",
    );
  });

  it("prefix mismatch falls back to full formatted 'After' label", () => {
    // Child auction doesn't start with parent's tokens
    const tree = decision(
      "root-auction",
      auctionMatches(["1NT", "P"]),
      bid("ask", "Asks", makeCall(2, BidSuit.Clubs)),
      decision(
        "unrelated-auction",
        auctionMatches(["2C", "P"]),
        bid("respond", "Responds", makeCall(2, BidSuit.Hearts)),
        fallback(),
      ),
    );
    const rows = flattenTreeForDisplay(tree);
    const unrelatedRow = rows.find((r) => r.name === "unrelated-auction")!;

    // Falls back to full formatted label since "2C — P" doesn't start with "1NT — P"
    expect(unrelatedRow.conditionLabel).toBe("After 2♣ — Pass");
  });
});

describe("explanations parameter", () => {
  it("populates decisionMetadata from explanations for matching decision name", () => {
    const tree = decision(
      "check-hcp",
      hcpMin(10),
      bid("open", "Opens", makeCall(1, BidSuit.Clubs)),
      fallback(),
    );
    const explanations: ConventionExplanations = {
      decisions: {
        "check-hcp": {
          whyThisMatters: "HCP determines opening strength",
          commonMistake: "Counting distribution points as HCP",
        },
      },
    };
    const rows = flattenTreeForDisplay(tree, explanations);
    const decisionRow = rows.find((r) => r.name === "check-hcp")!;

    expect(decisionRow.decisionMetadata).toEqual({
      whyThisMatters: "HCP determines opening strength",
      commonMistake: "Counting distribution points as HCP",
    });
  });

  it("populates bidMetadata from explanations for matching bid name", () => {
    const tree = bid("stayman-ask", "Asks for a major", makeCall(2, BidSuit.Clubs));
    const explanations: ConventionExplanations = {
      bids: {
        "stayman-ask": {
          whyThisBid: "Finds a 4-4 major fit",
          isArtificial: true,
          forcingType: "forcing",
        },
      },
    };
    const rows = flattenTreeForDisplay(tree, explanations);

    expect(rows[0]!.bidMetadata).toEqual({
      whyThisBid: "Finds a 4-4 major fit",
      isArtificial: true,
      forcingType: "forcing",
    });
  });

  it("populates teachingExplanation from explanations.conditions for matching condition name", () => {
    const tree = decision(
      "check-hcp",
      hcpMin(10),
      bid("open", "Opens", makeCall(1, BidSuit.Clubs)),
      fallback(),
    );
    const explanations: ConventionExplanations = {
      conditions: {
        "hcp-min": "In Stayman, 8+ HCP ensures game-level values",
      },
    };
    const rows = flattenTreeForDisplay(tree, explanations);
    const decisionRow = rows.find((r) => r.name === "check-hcp")!;

    expect(decisionRow.teachingExplanation).toBe(
      "In Stayman, 8+ HCP ensures game-level values",
    );
  });

  it("populates teachingExplanation from condition.teachingNote when no convention explanation exists", () => {
    const conditionWithNote = {
      ...hcpMin(10),
      teachingNote: "Need opening strength to bid",
    };
    const tree = decision(
      "check-hcp",
      conditionWithNote,
      bid("open", "Opens", makeCall(1, BidSuit.Clubs)),
      fallback(),
    );
    const rows = flattenTreeForDisplay(tree);
    const decisionRow = rows.find((r) => r.name === "check-hcp")!;

    expect(decisionRow.teachingExplanation).toBe(
      "Need opening strength to bid",
    );
  });

  it("convention explanation takes priority over teachingNote", () => {
    const conditionWithNote = {
      ...hcpMin(10),
      teachingNote: "Generic note from condition",
    };
    const tree = decision(
      "check-hcp",
      conditionWithNote,
      bid("open", "Opens", makeCall(1, BidSuit.Clubs)),
      fallback(),
    );
    const explanations: ConventionExplanations = {
      conditions: {
        "hcp-min": "Convention-specific explanation wins",
      },
    };
    const rows = flattenTreeForDisplay(tree, explanations);
    const decisionRow = rows.find((r) => r.name === "check-hcp")!;

    expect(decisionRow.teachingExplanation).toBe(
      "Convention-specific explanation wins",
    );
  });

  it("defaults all teaching fields to null when no explanations provided", () => {
    const tree = decision(
      "check-hcp",
      hcpMin(10),
      bid("open", "Opens", makeCall(1, BidSuit.Clubs)),
      fallback("Not enough"),
    );
    const rows = flattenTreeForDisplay(tree);

    for (const row of rows) {
      expect(row.teachingExplanation).toBeNull();
      expect(row.decisionMetadata).toBeNull();
      expect(row.bidMetadata).toBeNull();
    }
  });

  it("explanations.bids wins over inline node.metadata", () => {
    const tree = bid("my-bid", "Shows clubs", makeCall(1, BidSuit.Clubs), {
      whyThisBid: "Inline metadata reason",
    });
    const explanations: ConventionExplanations = {
      bids: {
        "my-bid": {
          whyThisBid: "Explanations file reason wins",
          isArtificial: true,
        },
      },
    };
    const rows = flattenTreeForDisplay(tree, explanations);

    expect(rows[0]!.bidMetadata).toEqual({
      whyThisBid: "Explanations file reason wins",
      isArtificial: true,
    });
  });

  it("falls back to inline node.metadata when no explanations match", () => {
    const tree = bid("my-bid", "Shows clubs", makeCall(1, BidSuit.Clubs), {
      whyThisBid: "Inline metadata reason",
      forcingType: "signoff",
    });
    const rows = flattenTreeForDisplay(tree);

    expect(rows[0]!.bidMetadata).toEqual({
      whyThisBid: "Inline metadata reason",
      forcingType: "signoff",
    });
  });

  it("propagates denialImplication from parent decision to NO-branch children", () => {
    const tree = decision(
      "check-hcp",
      hcpMin(10),
      bid("open", "Opens", makeCall(1, BidSuit.Clubs)),
      bid("pass", "Passes", makeCall(1, BidSuit.Diamonds)),
    );
    const explanations: ConventionExplanations = {
      decisions: {
        "check-hcp": {
          denialImplication: "Partner knows you have fewer than 10 HCP",
        },
      },
    };
    const rows = flattenTreeForDisplay(tree, explanations);
    const yesRow = rows.find((r) => r.branch === "yes")!;
    const noRow = rows.find((r) => r.branch === "no")!;

    expect(yesRow.denialImplication).toBeNull();
    expect(noRow.denialImplication).toBe(
      "Partner knows you have fewer than 10 HCP",
    );
  });

  it("propagates denialImplication from inline metadata when no explanations match", () => {
    const tree = decision(
      "check-hcp",
      hcpMin(10),
      bid("open", "Opens", makeCall(1, BidSuit.Clubs)),
      bid("pass", "Passes", makeCall(1, BidSuit.Diamonds)),
      { denialImplication: "Inline denial" },
    );
    const rows = flattenTreeForDisplay(tree);
    const noRow = rows.find((r) => r.branch === "no")!;

    expect(noRow.denialImplication).toBe("Inline denial");
  });

  it("sets denialImplication to null when parent has no denial metadata", () => {
    const tree = decision(
      "check-hcp",
      hcpMin(10),
      bid("open", "Opens", makeCall(1, BidSuit.Clubs)),
      bid("pass", "Passes", makeCall(1, BidSuit.Diamonds)),
    );
    const rows = flattenTreeForDisplay(tree);

    for (const row of rows) {
      expect(row.denialImplication).toBeNull();
    }
  });

  it("explanations.decisions wins over inline decision metadata", () => {
    const tree = decision(
      "check-hcp",
      hcpMin(10),
      bid("open", "Opens", makeCall(1, BidSuit.Clubs)),
      fallback(),
      { whyThisMatters: "Inline decision metadata" },
    );
    const explanations: ConventionExplanations = {
      decisions: {
        "check-hcp": {
          whyThisMatters: "Explanations file decision metadata wins",
        },
      },
    };
    const rows = flattenTreeForDisplay(tree, explanations);
    const decisionRow = rows.find((r) => r.name === "check-hcp")!;

    expect(decisionRow.decisionMetadata).toEqual({
      whyThisMatters: "Explanations file decision metadata wins",
    });
  });
});

describe("overlay context support", () => {
  const baseTree = handDecision(
    "base-check",
    hcpMin(8),
    intentBid("base-bid", "Base bid",
      { type: SemanticIntentType.Signoff, params: {} },
      (): Call => ({ type: "bid", level: 2, strain: BidSuit.Clubs })),
    fallback("base-weak"),
  );

  const replacementTree = handDecision(
    "overlay-check",
    hcpMin(5),
    intentBid("overlay-bid", "Overlay bid",
      { type: SemanticIntentType.EscapeRescue, params: {} },
      (): Call => ({ type: "bid", level: 2, strain: BidSuit.Hearts })),
    fallback("overlay-weak"),
  );

  it("with replacementTree: rows come from replacement tree", () => {
    const rows = flattenTreeForDisplay(baseTree, undefined, {
      replacementTree: replacementTree,
    });
    const bidRow = rows.find(r => r.type === "bid");
    expect(bidRow).toBeDefined();
    expect(bidRow!.name).toBe("overlay-bid");
    // No rows from base tree
    expect(rows.find(r => r.name === "base-bid")).toBeUndefined();
  });

  it("with overlayContext but no replacementTree: base tree used", () => {
    const rows = flattenTreeForDisplay(baseTree, undefined, {});
    const bidRow = rows.find(r => r.type === "bid");
    expect(bidRow).toBeDefined();
    expect(bidRow!.name).toBe("base-bid");
  });

  it("without overlayContext: unchanged (backward compat)", () => {
    const rows = flattenTreeForDisplay(baseTree);
    const bidRow = rows.find(r => r.type === "bid");
    expect(bidRow).toBeDefined();
    expect(bidRow!.name).toBe("base-bid");
  });

  it("systemOff indicator present when set", () => {
    const rows = flattenTreeForDisplay(baseTree, undefined, {
      systemOff: true,
    });
    // All rows should have systemOff: true
    for (const row of rows) {
      expect(row.systemOff).toBe(true);
    }
  });

  it("systemOff defaults to false when not in overlayContext", () => {
    const rows = flattenTreeForDisplay(baseTree);
    for (const row of rows) {
      expect(row.systemOff).toBeUndefined();
    }
  });

  it("suppressedIntents marks matching bid rows", () => {
    const rows = flattenTreeForDisplay(baseTree, undefined, {
      suppressedIntents: new Set(["base-bid"]),
    });
    const bidRow = rows.find(r => r.type === "bid" && r.name === "base-bid");
    expect(bidRow).toBeDefined();
    expect(bidRow!.suppressedByOverlay).toBe(true);
  });

  it("overriddenIntents marks matching bid rows", () => {
    const rows = flattenTreeForDisplay(baseTree, undefined, {
      overriddenIntents: new Set(["base-bid"]),
    });
    const bidRow = rows.find(r => r.type === "bid" && r.name === "base-bid");
    expect(bidRow).toBeDefined();
    expect(bidRow!.overriddenByOverlay).toBe(true);
  });

  it("non-matching intent names are not marked", () => {
    const rows = flattenTreeForDisplay(baseTree, undefined, {
      suppressedIntents: new Set(["nonexistent-bid"]),
    });
    const bidRow = rows.find(r => r.type === "bid" && r.name === "base-bid");
    expect(bidRow).toBeDefined();
    expect(bidRow!.suppressedByOverlay).toBeUndefined();
  });

  it("addedIntents appear as extra bid rows", () => {
    const rows = flattenTreeForDisplay(baseTree, undefined, {
      addedIntents: [{ name: "emergency-bid", meaning: "Emergency escape" }],
    });
    const addedRow = rows.find(r => r.name === "emergency-bid");
    expect(addedRow).toBeDefined();
    expect(addedRow!.type).toBe("bid");
    expect(addedRow!.meaning).toBe("Emergency escape");
  });
});
