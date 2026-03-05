import { describe, it, expect } from "vitest";
import { BidSuit, Seat } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import { buildAuction } from "../../../engine/auction-helpers";
import { evaluateHand } from "../../../engine/hand-evaluator";
import { hand } from "../../../engine/__tests__/fixtures";
import type { BiddingContext } from "../../core/types";
import { handDecision, fallback } from "../../core/rule-tree";
import type { HandNode } from "../../core/rule-tree";
import { evaluateTree } from "../../core/tree-evaluator";
import { flattenTree } from "../../core/tree-compat";
import { findSiblingBids } from "../../core/sibling-finder";
import { hcpMin, suitMin } from "../../core/conditions";
import {
  SemanticIntentType,
  intentBid,
  resolveIntent,
} from "../../core/intent";
import type { IntentNode } from "../../core/intent";
import type { SemanticIntent, IntentResolverMap } from "../../core/intent";
import {
  ForcingState,
  PendingAction,
  CompetitionMode,
  CaptainRole,
  SystemMode,
} from "../../core/dialogue/dialogue-state";
import type { DialogueState } from "../../core/dialogue/dialogue-state";
import { staymanResolvers } from "../../definitions/stayman/resolvers";

// ─── Test fixtures ────────────────────────────────────────────

/** Responder: 10 HCP, 4 hearts, 3 spades */
const responderHand = () =>
  hand("SK", "S5", "S2", "HA", "HK", "HQ", "H3", "D5", "D3", "D2", "C5", "C3", "C2");

function makeContext(h: ReturnType<typeof hand>, bids: string[]): BiddingContext {
  return {
    hand: h,
    auction: buildAuction(Seat.North, bids),
    seat: Seat.South,
    evaluation: evaluateHand(h),
    opponentConventionIds: [],
  };
}

/** A 1NT-opened dialogue state for resolver tests. */
const ntDialogueState: DialogueState = {
  familyId: "1nt",
  forcingState: ForcingState.Nonforcing,
  agreedStrain: { type: "none" },
  pendingAction: PendingAction.None,
  competitionMode: CompetitionMode.Uncontested,
  captain: CaptainRole.Responder,
  systemMode: SystemMode.On,
  conventionData: {},
};

// ─── Tree with IntentNode leaves ──────────────────────────────

function makeIntentTree(): HandNode {
  return handDecision(
    "hcp-8-plus",
    hcpMin(8),
    handDecision(
      "has-4-hearts",
      suitMin(1, "hearts", 4),
      intentBid(
        "stayman-ask",
        "Asks for a 4-card major",
        {
          type: SemanticIntentType.AskForMajor,
          params: {},
        },
        (): Call => ({ type: "bid", level: 2, strain: BidSuit.Clubs }),
      ),
      fallback("no-major"),
    ),
    fallback("too-weak"),
  );
}

// ─── Tests ────────────────────────────────────────────────────

describe("IntentNode + Intent Resolver", () => {
  describe("tree evaluation with IntentNode", () => {
    it("evaluates IntentNode as leaf with matched.type === 'intent'", () => {
      const tree = makeIntentTree();
      const ctx = makeContext(responderHand(), ["1NT", "P"]);
      const result = evaluateTree(tree as import("../../core/rule-tree").RuleNode, ctx);

      expect(result.matched).not.toBeNull();
      expect(result.matched!.type).toBe("intent");
      expect((result.matched as IntentNode).intent.type).toBe(SemanticIntentType.AskForMajor);
    });

  });

  describe("flattenTree with IntentNode", () => {
    it("produces ConditionedBiddingRule[] with callable call from defaultCall", () => {
      const tree = makeIntentTree();
      const rules = flattenTree(tree as import("../../core/rule-tree").RuleNode);

      // Should have rules (at least the intent node path)
      expect(rules.length).toBeGreaterThan(0);

      // Find the stayman-ask rule
      const askRule = rules.find((r) => r.name === "stayman-ask");
      expect(askRule).toBeDefined();

      // Its call() should return 2C (the defaultCall)
      const ctx = makeContext(responderHand(), ["1NT", "P"]);
      const call = askRule!.call(ctx);
      expect(call).toEqual({ type: "bid", level: 2, strain: BidSuit.Clubs });
    });
  });

  describe("findSiblingBids with IntentNode", () => {
    it("collects IntentNode as sibling alternative", () => {
      // Use a tree with multiple IntentNode leaves
      const tree = handDecision(
        "has-4-hearts",
        suitMin(1, "hearts", 4),
        intentBid(
          "show-hearts",
          "Shows 4+ hearts",
          { type: SemanticIntentType.ShowHeldSuit, params: { suit: "hearts" } },
          (): Call => ({ type: "bid", level: 2, strain: BidSuit.Hearts }),
        ),
        intentBid(
          "deny-hearts",
          "Denies 4 hearts",
          { type: SemanticIntentType.DenyHeldSuit, params: { suit: "hearts" } },
          (): Call => ({ type: "bid", level: 2, strain: BidSuit.Diamonds }),
        ),
      );

      const ctx = makeContext(responderHand(), ["1NT", "P", "2C", "P"]);
      const result = evaluateTree(tree as import("../../core/rule-tree").RuleNode, ctx);

      // Should match show-hearts (hand has 4 hearts)
      expect(result.matched).not.toBeNull();
      expect(result.matched!.name).toBe("show-hearts");

      // Find siblings — deny-hearts should appear
      const siblings = findSiblingBids(
        tree as import("../../core/rule-tree").RuleNode,
        result.matched!,
        ctx,
      );
      expect(siblings.length).toBe(1);
      expect(siblings[0]!.bidName).toBe("deny-hearts");
      expect(siblings[0]!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Diamonds });
    });
  });

  describe("resolveIntent", () => {
    it("resolves ShowHeldSuit with hearts to 2H", () => {
      const intent: SemanticIntent = {
        type: SemanticIntentType.ShowHeldSuit,
        params: { suit: "hearts" },
      };

      const resolvers: IntentResolverMap = new Map([
        [
          SemanticIntentType.ShowHeldSuit,
          (i) => ({
            status: "resolved" as const,
            calls: [{
              call: {
                type: "bid" as const,
                level: 2 as const,
                strain: i.params["suit"] === "hearts" ? BidSuit.Hearts : BidSuit.Spades,
              },
            }],
          }),
        ],
      ]);

      const ctx = makeContext(responderHand(), ["1NT", "P", "2C", "P"]);
      const result = resolveIntent(intent, ntDialogueState, ctx, resolvers);

      expect(result).not.toBeNull();
      expect(result!.status).toBe("resolved");
      if (result!.status === "resolved") {
        expect(result!.calls[0]!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Hearts });
      }
    });

    it("returns null for unregistered intent type", () => {
      const intent: SemanticIntent = {
        type: SemanticIntentType.AskForMajor,
        params: {},
      };

      const resolvers: IntentResolverMap = new Map(); // empty

      const ctx = makeContext(responderHand(), ["1NT", "P"]);
      const result = resolveIntent(intent, ntDialogueState, ctx, resolvers);

      expect(result).toBeNull();
    });

    it("returns declined when resolver declines", () => {
      const intent: SemanticIntent = {
        type: SemanticIntentType.AskForMajor,
        params: {},
      };

      const resolvers: IntentResolverMap = new Map([
        [SemanticIntentType.AskForMajor, () => ({ status: "declined" as const })],
      ]);

      const ctx = makeContext(responderHand(), ["1NT", "P"]);
      const result = resolveIntent(intent, ntDialogueState, ctx, resolvers);

      expect(result).not.toBeNull();
      expect(result!.status).toBe("declined");
    });
  });

  describe("Stayman interference resolvers", () => {
    const doubledState: DialogueState = {
      ...ntDialogueState,
      competitionMode: CompetitionMode.Doubled,
      systemMode: SystemMode.Off,
      systemCapabilities: { stayman: SystemMode.Modified },
    };

    const overcalledState: DialogueState = {
      ...ntDialogueState,
      competitionMode: CompetitionMode.Overcalled,
      systemMode: SystemMode.Off,
    };

    it("PenaltyRedouble resolves to redouble under Modified", () => {
      const intent: SemanticIntent = {
        type: SemanticIntentType.PenaltyRedouble,
        params: {},
      };
      const ctx = makeContext(responderHand(), ["1NT", "X"]);
      const result = resolveIntent(intent, doubledState, ctx, staymanResolvers);

      expect(result).not.toBeNull();
      expect(result!.status).toBe("resolved");
      if (result!.status === "resolved") {
        expect(result!.calls[0]!.call).toEqual({ type: "redouble" });
      }
    });

    it("EscapeRescue resolves to 2-level suit bid", () => {
      const intent: SemanticIntent = {
        type: SemanticIntentType.EscapeRescue,
        params: { suit: "hearts" },
      };
      const ctx = makeContext(responderHand(), ["1NT", "X"]);
      const result = resolveIntent(intent, doubledState, ctx, staymanResolvers);

      expect(result).not.toBeNull();
      expect(result!.status).toBe("resolved");
      if (result!.status === "resolved") {
        expect(result!.calls[0]!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Hearts });
      }
    });

    it("CompetitivePass resolves to pass", () => {
      const intent: SemanticIntent = {
        type: SemanticIntentType.CompetitivePass,
        params: {},
      };
      const ctx = makeContext(responderHand(), ["1NT", "X"]);
      const result = resolveIntent(intent, doubledState, ctx, staymanResolvers);

      expect(result).not.toBeNull();
      expect(result!.status).toBe("resolved");
      if (result!.status === "resolved") {
        expect(result!.calls[0]!.call).toEqual({ type: "pass" });
      }
    });

    it("AskForMajor resolves to 2C under Modified", () => {
      const intent: SemanticIntent = {
        type: SemanticIntentType.AskForMajor,
        params: {},
      };
      const ctx = makeContext(responderHand(), ["1NT", "X"]);
      const result = resolveIntent(intent, doubledState, ctx, staymanResolvers);

      expect(result).not.toBeNull();
      expect(result!.status).toBe("resolved");
      if (result!.status === "resolved") {
        expect(result!.calls[0]!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Clubs });
      }
    });

    it("AskForMajor returns declined under Off (system disabled)", () => {
      const intent: SemanticIntent = {
        type: SemanticIntentType.AskForMajor,
        params: {},
      };
      const ctx = makeContext(responderHand(), ["1NT", "2H"]);
      const result = resolveIntent(intent, overcalledState, ctx, staymanResolvers);

      expect(result).not.toBeNull();
      expect(result!.status).toBe("declined");
    });
  });

});
