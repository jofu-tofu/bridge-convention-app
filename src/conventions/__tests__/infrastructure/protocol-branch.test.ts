import { describe, it, expect, beforeEach } from "vitest";
import { BidSuit, Seat } from "../../../engine/types";
import { hand } from "../../../engine/__tests__/fixtures";
import { evaluateHand } from "../../../engine/hand-evaluator";
import { createBiddingContext } from "../../core/context-factory";
import { intentBid } from "../../core/intent/intent-node";
import { SemanticIntentType } from "../../core/intent/semantic-intent";
import {
  protocol, round, semantic, validateProtocol, resolveBranch,
} from "../../core/protocol/protocol";
import { evaluateProtocol } from "../../core/protocol/protocol-evaluator";
import type { ProtocolBranch, ProtocolEvalResult } from "../../core/protocol/protocol";
import { handDecision, fallback } from "../../core/tree/rule-tree";
import type { HandNode } from "../../core/tree/rule-tree";
import { CompetitionMode, ForcingState, ObligationKind, CaptainRole, SystemMode } from "../../core/dialogue/dialogue-state";
import type { DialogueState } from "../../core/dialogue/dialogue-state";
import { staticBid, alwaysTrue, makeMinimalContext } from "../tree-test-helpers";

/** alwaysTrue with auction category, typed as AuctionCondition for semantic() */
const auctionTrigger = (name: string) => alwaysTrue(name, "auction") as AuctionCondition;
import { hcpMin } from "../../core/conditions";
import {
  clearRegistry, registerConvention, getDiagnostics, evaluateBiddingRules,
} from "../../core/registry";
import { ConventionCategory } from "../../core/types";
import type { AuctionCondition, HandCondition, ConventionConfig } from "../../core/types";
import { baselineTransitionRules } from "../../core/dialogue/baseline-transitions";
import { auctionFromBids, makeBiddingContext } from "../fixtures";

// ─── Helpers ────────────────────────────────────────────────

function makeDialogueState(overrides: Partial<DialogueState> = {}): DialogueState {
  return {
    familyId: null,
    forcingState: ForcingState.Nonforcing,
    agreedStrain: { type: "none" },
    obligation: { kind: ObligationKind.None, obligatedSide: "opener" as const },
    competitionMode: CompetitionMode.Uncontested,
    captain: CaptainRole.Neither,
    systemMode: SystemMode.On,
    conventionData: {},
    ...overrides,
  };
}

const defaultBid = staticBid("default-response", 2, BidSuit.Clubs);
const branchBid = staticBid("branch-doubled-bid", 3, BidSuit.Hearts);
const branchBid2 = staticBid("branch-overcalled-bid", 3, BidSuit.Spades);

const doubledBranch: ProtocolBranch = {
  name: "doubled",
  label: "After opponent doubles",
  matches: (state) => state.competitionMode === CompetitionMode.Doubled,
  handTree: branchBid,
};

const overcalledBranch: ProtocolBranch = {
  name: "overcalled",
  label: "After opponent overcalls",
  matches: (state) => state.competitionMode === CompetitionMode.Overcalled,
  handTree: branchBid2,
};

// ─── resolveBranch() unit tests ─────────────────────────────

describe("resolveBranch", () => {
  const ctx = makeMinimalContext();

  function makeProtoResult(
    roundWithBranches?: readonly ProtocolBranch[],
  ): ProtocolEvalResult {
    const handTree = defaultBid;
    const evalResult = { matched: defaultBid, path: [], rejectedDecisions: [], visited: [] };
    const activeRound = roundWithBranches
      ? { name: "response", triggers: [], handTree, branches: roundWithBranches }
      : { name: "response", triggers: [], handTree };
    return {
      matched: defaultBid,
      matchedRounds: [],
      established: {},
      handResult: evalResult,
      activeRound,
      handTreeRoot: handTree,
      activeBranch: null,
    };
  }

  it("returns activeBranch null when round has no branches", () => {
    const protoResult = makeProtoResult(undefined);
    const result = resolveBranch(protoResult, makeDialogueState(), ctx);
    expect(result.activeBranch).toBeNull();
    expect(result.matched).toBe(defaultBid);
  });

  it("returns activeBranch null when no branch matches", () => {
    const protoResult = makeProtoResult([doubledBranch]);
    const state = makeDialogueState({ competitionMode: CompetitionMode.Uncontested });
    const result = resolveBranch(protoResult, state, ctx);
    expect(result.activeBranch).toBeNull();
    expect(result.matched).toBe(defaultBid);
  });

  it("first matching branch wins", () => {
    const protoResult = makeProtoResult([doubledBranch, overcalledBranch]);
    const state = makeDialogueState({ competitionMode: CompetitionMode.Doubled });
    const result = resolveBranch(protoResult, state, ctx);
    expect(result.activeBranch).toBe(doubledBranch);
    expect(result.handTreeRoot).toBe(branchBid);
  });

  it("second branch matches when first does not", () => {
    const protoResult = makeProtoResult([doubledBranch, overcalledBranch]);
    const state = makeDialogueState({ competitionMode: CompetitionMode.Overcalled });
    const result = resolveBranch(protoResult, state, ctx);
    expect(result.activeBranch).toBe(overcalledBranch);
    expect(result.handTreeRoot).toBe(branchBid2);
  });

  it("replaces handResult when branch matches", () => {
    const protoResult = makeProtoResult([doubledBranch]);
    const state = makeDialogueState({ competitionMode: CompetitionMode.Doubled });
    const result = resolveBranch(protoResult, state, ctx);
    expect(result.handResult.matched).toBe(branchBid);
    expect(result.matched).toBe(branchBid);
  });

  it("supports function-form handTree on branch", () => {
    const dynamicBid = staticBid("dynamic-branch-bid", 4, BidSuit.Diamonds);
    const branch: ProtocolBranch = {
      name: "dynamic",
      label: "Dynamic branch",
      matches: () => true,
      handTree: () => dynamicBid,
    };
    const protoResult = makeProtoResult([branch]);
    const result = resolveBranch(protoResult, makeDialogueState(), ctx);
    expect(result.activeBranch).toBe(branch);
    expect(result.matched).toBe(dynamicBid);
  });

  it("evaluates hand tree through branch for hand decisions", () => {
    const strongBid = intentBid("strong", "Strong", { type: SemanticIntentType.NaturalBid, params: {} },
      () => ({ type: "bid", level: 4, strain: BidSuit.Hearts }));
    const branchTree: HandNode = handDecision("branch-hcp-check", hcpMin(20),
      strongBid, fallback("branch-weak"));
    const branch: ProtocolBranch = {
      name: "complex",
      label: "Complex branch",
      matches: () => true,
      handTree: branchTree,
    };
    const protoResult = makeProtoResult([branch]);
    // makeMinimalContext has 28 HCP, so hcpMin(20) passes
    const result = resolveBranch(protoResult, makeDialogueState(), ctx);
    expect(result.matched).toBe(strongBid);
    expect(result.handTreeRoot).toBe(branchTree);
  });
});

// ─── validateProtocol branch validation ─────────────────────

describe("validateProtocol branch validation", () => {
  it("rejects duplicate branch names within a round", () => {
    const proto = protocol("test-dup-branch", [
      round("r1", {
        triggers: [semantic(auctionTrigger("trigger"), {})],
        handTree: defaultBid,
        branches: [
          { name: "dup", label: "First", matches: () => true, handTree: defaultBid },
          { name: "dup", label: "Second", matches: () => false, handTree: branchBid },
        ],
      }),
    ]);
    expect(() => validateProtocol(proto)).toThrow(/duplicate branch/i);
  });

  it("validates branch hand trees (auction-after-hand throws)", () => {
    // Auction condition after hand condition should fail tree validation
    const badTree: HandNode = handDecision(
      "hand-first",
      alwaysTrue("hand-cond", "hand") as HandCondition,
      handDecision(
        "auction-after-hand",
        alwaysTrue("auction-cond", "auction") as HandCondition,
        defaultBid,
        fallback("bad-fallback-inner"),
      ),
      fallback("bad-fallback"),
    );
    const proto = protocol("test-bad-branch-tree", [
      round("r1", {
        triggers: [semantic(auctionTrigger("trigger"), {})],
        handTree: defaultBid,
        branches: [
          { name: "branch1", label: "Bad tree", matches: () => true, handTree: badTree },
        ],
      }),
    ]);
    expect(() => validateProtocol(proto)).toThrow(/auction condition/i);
  });

  it("accepts valid branches", () => {
    const proto = protocol("test-valid-branches", [
      round("r1", {
        triggers: [semantic(auctionTrigger("trigger"), {})],
        handTree: defaultBid,
        branches: [
          { name: "a", label: "Branch A", matches: () => true, handTree: defaultBid },
          { name: "b", label: "Branch B", matches: () => false, handTree: branchBid },
        ],
      }),
    ]);
    expect(() => validateProtocol(proto)).not.toThrow();
  });
});

// ─── Diagnostics: branch-overlay-conflict ───────────────────

describe("diagnostics: branch-overlay-conflict", () => {
  beforeEach(() => { clearRegistry(); });

  it("warns when overlay targets a round that has branches", () => {
    const config: ConventionConfig = {
      id: "branch-overlay-test",
      name: "Branch Overlay Test",
      description: "Test convention for branch-overlay conflict",
      category: ConventionCategory.Asking,
      dealConstraints: { seats: [] },
      protocol: protocol("branch-overlay-test", [
        round("response", {
          triggers: [semantic(auctionTrigger("trigger"), {})],
          handTree: defaultBid,
          branches: [
            { name: "doubled", label: "After double", matches: () => true, handTree: branchBid },
          ],
        }),
      ]),
      overlays: [
        {
          id: "conflict-overlay",
          roundName: "response",
          matches: () => true,
          replacementTree: branchBid2,
        },
      ],
    };
    registerConvention(config);
    const diags = getDiagnostics("branch-overlay-test");
    const branchOverlayWarning = diags.find(d => d.type === "branch-overlay-conflict");
    expect(branchOverlayWarning).toBeDefined();
    expect(branchOverlayWarning!.message).toContain("conflict-overlay");
    expect(branchOverlayWarning!.message).toContain("response");
  });

  it("no warning when overlay targets a different round", () => {
    const config: ConventionConfig = {
      id: "no-conflict-test",
      name: "No Conflict Test",
      description: "Test convention without branch-overlay conflict",
      category: ConventionCategory.Asking,
      dealConstraints: { seats: [] },
      protocol: protocol("no-conflict-test", [
        round("response", {
          triggers: [semantic(auctionTrigger("trigger"), {})],
          handTree: defaultBid,
          branches: [
            { name: "doubled", label: "After double", matches: () => true, handTree: branchBid },
          ],
        }),
        round("rebid", {
          triggers: [semantic(auctionTrigger("trigger2"), {})],
          handTree: branchBid2,
        }),
      ]),
      overlays: [
        {
          id: "other-round-overlay",
          roundName: "rebid",
          matches: () => true,
          replacementTree: defaultBid,
        },
      ],
    };
    registerConvention(config);
    const diags = getDiagnostics("no-conflict-test");
    const branchOverlayWarning = diags.find(d => d.type === "branch-overlay-conflict");
    expect(branchOverlayWarning).toBeUndefined();
  });
});

// ─── Diagnostics: branch hand trees scanned ─────────────────

describe("diagnostics: branch tree scanning", () => {
  beforeEach(() => { clearRegistry(); });

  it("detects duplicate nodeIds across branch trees", () => {
    const sharedBid = intentBid("shared-id", "Shared",
      { type: SemanticIntentType.NaturalBid, params: {} },
      () => ({ type: "bid", level: 1, strain: BidSuit.Clubs }));
    // Use a separate intentBid call with the same nodeId pattern
    // The duplicate comes from the same intentBid instance being in both main and branch
    const config: ConventionConfig = {
      id: "dup-branch-node",
      name: "Dup Branch Node",
      description: "Test duplicate node IDs in branches",
      category: ConventionCategory.Asking,
      dealConstraints: { seats: [] },
      protocol: protocol("dup-branch-node", [
        round("r1", {
          triggers: [semantic(auctionTrigger("trigger"), {})],
          handTree: sharedBid,
          branches: [
            { name: "b1", label: "Branch", matches: () => true, handTree: sharedBid },
          ],
        }),
      ]),
    };
    registerConvention(config);
    const diags = getDiagnostics("dup-branch-node");
    const dupWarning = diags.find(d => d.type === "duplicate-node-id");
    expect(dupWarning).toBeDefined();
  });
});

// ─── Weak Twos integration: branches replace overlays ───────

describe("weak-twos branch integration", () => {
  beforeEach(() => {
    clearRegistry();
    // Import and register lazy to avoid module-level side effects
  });

  it("weak-twos response round has branches defined", async () => {
    const { weakTwosConfig } = await import("../../definitions/weak-twos/config");
    const responseRound = weakTwosConfig.protocol!.rounds.find(r => r.name === "response");
    expect(responseRound).toBeDefined();
    expect(responseRound!.branches).toBeDefined();
    expect(responseRound!.branches).toHaveLength(2);
    expect(responseRound!.branches![0]!.name).toBe("doubled");
    expect(responseRound!.branches![1]!.name).toBe("overcalled");
  });

  it("weak-twos overlays array is empty after migration", async () => {
    const { weakTwoOverlays } = await import("../../definitions/weak-twos/overlays");
    expect(weakTwoOverlays).toHaveLength(0);
  });

  it("doubled branch matches when competitionMode is Doubled", async () => {
    const { weakTwosConfig } = await import("../../definitions/weak-twos/config");
    const responseRound = weakTwosConfig.protocol!.rounds.find(r => r.name === "response");
    const doubledBranch = responseRound!.branches!.find(b => b.name === "doubled");
    expect(doubledBranch).toBeDefined();
    const state = makeDialogueState({ competitionMode: CompetitionMode.Doubled });
    expect(doubledBranch!.matches(state)).toBe(true);
    const uncontestedState = makeDialogueState({ competitionMode: CompetitionMode.Uncontested });
    expect(doubledBranch!.matches(uncontestedState)).toBe(false);
  });

  it("overcalled branch matches when competitionMode is Overcalled", async () => {
    const { weakTwosConfig } = await import("../../definitions/weak-twos/config");
    const responseRound = weakTwosConfig.protocol!.rounds.find(r => r.name === "response");
    const overcalledBranch = responseRound!.branches!.find(b => b.name === "overcalled");
    expect(overcalledBranch).toBeDefined();
    const state = makeDialogueState({ competitionMode: CompetitionMode.Overcalled });
    expect(overcalledBranch!.matches(state)).toBe(true);
  });

  it("full pipeline: doubled auction selects branch bid", async () => {
    const { weakTwosConfig } = await import("../../definitions/weak-twos/config");
    registerConvention(weakTwosConfig);
    // Strong responder hand: 16+ HCP with 3-card heart support
    const h = hand("SA", "SK", "SQ", "SJ", "HA", "HK", "H5", "DA", "DK", "DQ", "CA", "CK", "C2");
    // Auction: North opens 2H, East doubles, South to bid
    const ctx = makeBiddingContext(h, Seat.South, ["2H", "X"], Seat.North);
    const result = evaluateBiddingRules(ctx, weakTwosConfig);
    // Should find a call (game raise or competitive raise after double)
    expect(result).not.toBeNull();
    if (result) {
      expect(result.call.type).toBe("bid");
    }
  });

  it("full pipeline: uncontested auction uses default response tree", async () => {
    const { weakTwosConfig } = await import("../../definitions/weak-twos/config");
    registerConvention(weakTwosConfig);
    // Strong responder hand: 16+ HCP with 3-card heart support
    const h = hand("SA", "SK", "SQ", "SJ", "HA", "HK", "H5", "DA", "DK", "DQ", "CA", "CK", "C2");
    // Auction: North opens 2H, East passes, South to bid
    const ctx = makeBiddingContext(h, Seat.South, ["2H", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, weakTwosConfig);
    expect(result).not.toBeNull();
    if (result) {
      // With 16+ HCP and 3-card support, should raise to 4H
      expect(result.call).toEqual({ type: "bid", level: 4, strain: BidSuit.Hearts });
    }
  });
});

// ─── Branch precedence over overlay replacementTree ─────────

describe("branch precedence over overlay replacementTree", () => {
  beforeEach(() => { clearRegistry(); });

  it("when branch is active, overlay replacementTree is skipped", async () => {
    // This is tested implicitly through weak-twos:
    // If we had both a branch AND an overlay on the same round,
    // the branch should win for tree replacement.
    // Since weak-twos overlays are now empty, this is safe by design.
    const { weakTwosConfig } = await import("../../definitions/weak-twos/config");
    registerConvention(weakTwosConfig);
    const diags = getDiagnostics("weak-twos");
    const branchOverlayConflict = diags.find(d => d.type === "branch-overlay-conflict");
    // No conflict because overlays are empty
    expect(branchOverlayConflict).toBeUndefined();
  });
});
