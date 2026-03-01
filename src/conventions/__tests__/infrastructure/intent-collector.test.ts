import { describe, it, expect } from "vitest";
import { Seat, BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import { evaluateHand } from "../../../engine/hand-evaluator";
import { buildAuction } from "../../../engine/auction-helpers";
import { hand } from "../fixtures";
import type { BiddingContext } from "../../core/types";
import { handDecision, fallback } from "../../core/rule-tree";
import { decision } from "../../core/rule-tree";
import { intentBid } from "../../core/intent/intent-node";
import { hcpMin, suitMin } from "../../core/conditions/hand-conditions";
// Suit indices: [0]=S, [1]=H, [2]=D, [3]=C
import { isOpener } from "../../core/conditions/auction-conditions";
import { SemanticIntentType } from "../../core/intent/semantic-intent";
import { collectIntentProposals } from "../../core/intent-collector";

const bid1C: Call = { type: "bid", level: 1, strain: BidSuit.Clubs };
const bid1D: Call = { type: "bid", level: 1, strain: BidSuit.Diamonds };
const bid1H: Call = { type: "bid", level: 1, strain: BidSuit.Hearts };

function makeContext(h = hand("SA", "SK", "SQ", "SJ", "HA", "HK", "DA", "DK", "DQ", "CA", "CK", "CQ", "CJ")): BiddingContext {
  return {
    hand: h,
    auction: buildAuction(Seat.South, []),
    seat: Seat.South,
    evaluation: evaluateHand(h),
    opponentConventionIds: [],
  };
}

function makeIntent(name: string, meaning: string, call: Call) {
  return intentBid(
    name,
    meaning,
    { type: SemanticIntentType.NaturalBid, params: {} },
    () => call,
  );
}

describe("collectIntentProposals", () => {
  it("single IntentNode tree returns 1 proposal with empty pathConditions and sourceNode set", () => {
    const node = makeIntent("open-1c", "Opens 1C", bid1C);
    const ctx = makeContext();

    const proposals = collectIntentProposals(node, ctx);

    expect(proposals).toHaveLength(1);
    expect(proposals[0]!.intent.type).toBe(SemanticIntentType.NaturalBid);
    expect(proposals[0]!.nodeName).toBe("open-1c");
    expect(proposals[0]!.meaning).toBe("Opens 1C");
    expect(proposals[0]!.pathConditions).toHaveLength(0);
    expect(proposals[0]!.sourceNode).toBe(node);
  });

  it("binary hand decision returns 2 proposals with appropriate pathConditions", () => {
    const strongNode = makeIntent("strong", "Strong opening", bid1C);
    const weakNode = makeIntent("weak", "Weak opening", bid1D);
    const tree = handDecision("has-12-hcp", hcpMin(12), strongNode, weakNode);
    const ctx = makeContext();

    const proposals = collectIntentProposals(tree, ctx);

    expect(proposals).toHaveLength(2);

    const strong = proposals.find(p => p.nodeName === "strong")!;
    expect(strong.pathConditions).toHaveLength(1);
    expect(strong.pathConditions[0]!.requiredResult).toBe(true);
    expect(strong.sourceNode).toBe(strongNode);

    const weak = proposals.find(p => p.nodeName === "weak")!;
    expect(weak.pathConditions).toHaveLength(1);
    expect(weak.pathConditions[0]!.requiredResult).toBe(false);
    expect(weak.sourceNode).toBe(weakNode);
  });

  it("nested decisions accumulate pathConditions for all leaves", () => {
    const leaf1 = makeIntent("strong-hearts", "Strong with hearts", bid1H);
    const leaf2 = makeIntent("strong-other", "Strong other", bid1C);
    const leaf3 = makeIntent("weak", "Weak", bid1D);
    const innerDecision = handDecision("has-4-hearts", suitMin(1, "hearts", 4), leaf1, leaf2);
    const tree = handDecision("has-12-hcp", hcpMin(12), innerDecision, leaf3);
    const ctx = makeContext();

    const proposals = collectIntentProposals(tree, ctx);

    expect(proposals).toHaveLength(3);

    const hearts = proposals.find(p => p.nodeName === "strong-hearts")!;
    expect(hearts.pathConditions).toHaveLength(2);
    expect(hearts.pathConditions[0]!.requiredResult).toBe(true); // 12+ HCP
    expect(hearts.pathConditions[1]!.requiredResult).toBe(true); // 4+ hearts

    const other = proposals.find(p => p.nodeName === "strong-other")!;
    expect(other.pathConditions).toHaveLength(2);
    expect(other.pathConditions[0]!.requiredResult).toBe(true); // 12+ HCP
    expect(other.pathConditions[1]!.requiredResult).toBe(false); // not 4+ hearts

    const weak = proposals.find(p => p.nodeName === "weak")!;
    expect(weak.pathConditions).toHaveLength(1);
    expect(weak.pathConditions[0]!.requiredResult).toBe(false); // not 12+ HCP
  });

  it("FallbackNode is skipped", () => {
    const leaf = makeIntent("open", "Opens", bid1C);
    const tree = handDecision("has-12-hcp", hcpMin(12), leaf, fallback());
    const ctx = makeContext();

    const proposals = collectIntentProposals(tree, ctx);

    expect(proposals).toHaveLength(1);
    expect(proposals[0]!.nodeName).toBe("open");
  });

  it("auction condition prefix is walked through — hand subtree traversed", () => {
    const leaf = makeIntent("open-1c", "Opens 1C", bid1C);
    const fb = fallback();
    // Auction condition wrapping a hand subtree
    const tree = decision("is-opener", isOpener(), leaf, fb);
    const ctx = makeContext();

    const proposals = collectIntentProposals(tree, ctx);

    // Should walk past auction condition and collect the IntentNode
    expect(proposals).toHaveLength(1);
    expect(proposals[0]!.nodeName).toBe("open-1c");
    // Auction conditions not included in pathConditions
    expect(proposals[0]!.pathConditions).toHaveLength(0);
  });

  it("auction condition prefix with hand subtree underneath", () => {
    const strongNode = makeIntent("strong", "Strong", bid1C);
    const weakNode = makeIntent("weak", "Weak", bid1D);
    const handTree = handDecision("has-12-hcp", hcpMin(12), strongNode, weakNode);
    const tree = decision("is-opener", isOpener(), handTree, fallback());
    const ctx = makeContext();

    const proposals = collectIntentProposals(tree, ctx);

    expect(proposals).toHaveLength(2);
    // Only hand conditions in pathConditions, not auction condition
    for (const p of proposals) {
      for (const pc of p.pathConditions) {
        expect(pc.condition.category).toBe("hand");
      }
    }
  });

  it("preserves metadata and alert from IntentNode", () => {
    const node = intentBid(
      "ask",
      "Asks for major",
      { type: SemanticIntentType.AskForMajor, params: {} },
      () => bid1C,
      { whyThisBid: "Checking for fit" },
      { artificial: true, forcingType: "forcing" },
    );
    const ctx = makeContext();

    const proposals = collectIntentProposals(node, ctx);

    expect(proposals).toHaveLength(1);
    expect(proposals[0]!.metadata).toEqual({ whyThisBid: "Checking for fit" });
    expect(proposals[0]!.alert).toEqual({ artificial: true, forcingType: "forcing" });
  });

  it("defaultCall function is preserved and callable", () => {
    const node = makeIntent("open-1c", "Opens 1C", bid1C);
    const ctx = makeContext();

    const proposals = collectIntentProposals(node, ctx);

    expect(proposals[0]!.defaultCall(ctx)).toEqual(bid1C);
  });
});
