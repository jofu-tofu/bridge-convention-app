import { describe, test, expect, vi } from "vitest";
import { Seat } from "../../../engine/types";
import type { ConventionOverlayPatch } from "../../core/overlay/overlay";
import { validateOverlayPatches, collectTriggerOverrides } from "../../core/overlay/overlay";
import { buildEffectiveContext } from "../../core/pipeline/effective-context";
import { evaluateBiddingRules } from "../../core/registry";
import { generateCandidates } from "../../core/pipeline/candidate-generator";
import { selectMatchedCandidate } from "../../core/pipeline/candidate-selector";
import { protocol, round, semantic } from "../../core/protocol/protocol";
import type { ConventionProtocol, ProtocolEvalResult } from "../../core/protocol/protocol";
import { handDecision, decision, fallback } from "../../core/tree/rule-tree";
import type { HandNode } from "../../core/tree/rule-tree";
import { intentBid } from "../../core/intent/intent-node";
import { SemanticIntentType } from "../../core/intent/semantic-intent";
import { hcpMin, bidMade, isResponder } from "../../core/conditions";
import { evaluateTree } from "../../core/tree/tree-evaluator";
import type { DialogueState } from "../../core/dialogue/dialogue-state";
import type { BiddingContext, ConventionConfig } from "../../core/types";
import { ConventionCategory } from "../../core/types";
import { evaluateHand } from "../../../engine/hand-evaluator";
import { hand, auctionFromBids } from "../fixtures";
import { BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import type { CollectedIntent } from "../../core/pipeline/intent-collector";

// ─── Test fixtures ──────────────────────────────────────────

const normalTree = handDecision(
  "hcp-check",
  hcpMin(8),
  intentBid("normal-bid", "Normal bid",
    { type: SemanticIntentType.Signoff, params: {} },
    (): Call => ({ type: "bid", level: 2, strain: BidSuit.Clubs })),
  fallback("too-weak"),
);

const overlayTree = handDecision(
  "overlay-hcp-check",
  hcpMin(5),
  intentBid("overlay-bid", "Overlay bid",
    { type: SemanticIntentType.EscapeRescue, params: {} },
    (): Call => ({ type: "bid", level: 2, strain: BidSuit.Hearts })),
  fallback("overlay-weak"),
);

const testProtocol: ConventionProtocol = protocol("test-conv", [
  round("opening", {
    triggers: [semantic(bidMade(1, BidSuit.NoTrump), {})],
    handTree: normalTree,
    seatFilter: isResponder(),
  }),
  round("response", {
    triggers: [semantic(bidMade(2, BidSuit.Clubs), {})],
    handTree: normalTree,
  }),
]);

function makeOverlay(
  id: string,
  roundName: string,
  matchesFn: (state: DialogueState) => boolean,
  tree?: HandNode,
): ConventionOverlayPatch {
  return { id, roundName, matches: matchesFn, replacementTree: tree ?? overlayTree };
}

function makeConfig(overlays?: readonly ConventionOverlayPatch[]): ConventionConfig {
  return {
    id: "test-conv",
    name: "Test Convention",
    description: "Test",
    category: ConventionCategory.Asking,
    dealConstraints: { seats: [] },
    protocol: testProtocol,
    overlays,
  };
}

function makeContext(bids: string[]): BiddingContext {
  const h = hand("SA", "SK", "SQ", "S2", "HK", "H5", "H3", "DK", "D5", "D3", "C5", "C3", "C2");
  return {
    hand: h,
    auction: auctionFromBids(Seat.North, bids),
    seat: Seat.South,
    evaluation: evaluateHand(h),
    opponentConventionIds: [],
  };
}

function makeProtocolResult(roundName: string): ProtocolEvalResult {
  return {
    matched: null,
    matchedRounds: [],
    established: { role: "responder" as const },
    handResult: evaluateTree(normalTree, makeContext(["1NT", "P"])),
    activeRound: (testProtocol.rounds).find(r => r.name === roundName) ?? null,
    handTreeRoot: normalTree,
  };
}

// ─── validateOverlayPatches ──────────────────────────────────

describe("validateOverlayPatches", () => {
  test("passes with valid round names", () => {
    const overlays = [makeOverlay("o1", "opening", () => true)];
    expect(() => validateOverlayPatches(overlays, testProtocol)).not.toThrow();
  });

  test("throws on invalid round name", () => {
    const overlays = [makeOverlay("o1", "nonexistent-round", () => true)];
    expect(() => validateOverlayPatches(overlays, testProtocol)).toThrow(/nonexistent-round/);
  });

  test("passes with valid protocol for overlay validation", () => {
    const overlays = [makeOverlay("o1", "opening", () => true)];
    expect(() => validateOverlayPatches(overlays, testProtocol)).not.toThrow();
  });
});

describe("validateOverlayPatches — replacement tree validation", () => {
  test("overlay with invalid replacement tree throws", () => {
    // Auction condition after hand condition — invalid tree structure
    const invalidTree = decision(
      "hand-first",
      hcpMin(8),
      decision(
        "auction-after-hand",
        bidMade(1, BidSuit.NoTrump),
        intentBid("bad-bid", "Bad",
          { type: SemanticIntentType.Signoff, params: {} },
          (): Call => ({ type: "bid", level: 2, strain: BidSuit.Clubs })),
        fallback("no"),
      ),
      fallback("weak"),
    ) as HandNode;

    const overlays: ConventionOverlayPatch[] = [{
      id: "invalid-tree-overlay",
      roundName: "opening",
      matches: () => true,
      replacementTree: invalidTree,
    }];
    expect(() => validateOverlayPatches(overlays, testProtocol)).toThrow(/auction condition/i);
  });

  test("overlay with valid replacement tree passes", () => {
    const overlays: ConventionOverlayPatch[] = [{
      id: "valid-tree-overlay",
      roundName: "opening",
      matches: () => true,
      replacementTree: overlayTree,
    }];
    expect(() => validateOverlayPatches(overlays, testProtocol)).not.toThrow();
  });

  test("overlay without replacementTree has no validation error", () => {
    const overlays: ConventionOverlayPatch[] = [{
      id: "no-tree-overlay",
      roundName: "opening",
      matches: () => true,
      suppressIntent: () => false,
    }];
    expect(() => validateOverlayPatches(overlays, testProtocol)).not.toThrow();
  });

  test("existing Stayman overlays pass validation (regression)", async () => {
    const { staymanConfig } = await import("../../definitions/stayman");
    const proto = staymanConfig.protocol!;
    const overlays = staymanConfig.overlays ?? [];
    expect(overlays.length).toBeGreaterThan(0);
    expect(() => validateOverlayPatches(overlays, proto)).not.toThrow();
  });
});

// ─── buildEffectiveContext overlay resolution ────────────────

describe("buildEffectiveContext — overlay resolution", () => {
  test("no overlays on config → activeOverlays is empty", () => {
    const config = makeConfig();
    const ctx = makeContext(["1NT", "P"]);
    const result = buildEffectiveContext(ctx, config, makeProtocolResult("opening"));
    expect(result.activeOverlays).toEqual([]);
  });

  test("matching overlay for active round → activeOverlays contains it", () => {
    const overlay = makeOverlay("o1", "opening", () => true);
    const config = makeConfig([overlay]);
    const ctx = makeContext(["1NT", "P"]);
    const result = buildEffectiveContext(ctx, config, makeProtocolResult("opening"));
    expect(result.activeOverlays).toEqual([overlay]);
  });

  test("non-matching overlay → activeOverlays is empty", () => {
    const overlay = makeOverlay("o1", "opening", () => false);
    const config = makeConfig([overlay]);
    const ctx = makeContext(["1NT", "P"]);
    const result = buildEffectiveContext(ctx, config, makeProtocolResult("opening"));
    expect(result.activeOverlays).toEqual([]);
  });

  test("overlay for wrong round name → not activated even if matches() returns true", () => {
    const overlay = makeOverlay("o1", "response", () => true);
    const config = makeConfig([overlay]);
    const ctx = makeContext(["1NT", "P"]);
    const result = buildEffectiveContext(ctx, config, makeProtocolResult("opening"));
    expect(result.activeOverlays).toEqual([]);
  });

  test("multiple overlays both matching → both in array", () => {
    const overlay1 = makeOverlay("o1", "opening", () => true);
    const overlay2 = makeOverlay("o2", "opening", () => true);
    const config = makeConfig([overlay1, overlay2]);
    const ctx = makeContext(["1NT", "P"]);
    const result = buildEffectiveContext(ctx, config, makeProtocolResult("opening"));
    expect(result.activeOverlays).toEqual([overlay1, overlay2]);
  });

  test("first overlay doesn't match, second does → only second in array", () => {
    const overlay1 = makeOverlay("o1", "opening", () => false);
    const overlay2 = makeOverlay("o2", "opening", () => true);
    const config = makeConfig([overlay1, overlay2]);
    const ctx = makeContext(["1NT", "P"]);
    const result = buildEffectiveContext(ctx, config, makeProtocolResult("opening"));
    expect(result.activeOverlays).toEqual([overlay2]);
  });
});

// ─── generateCandidates with overlays ────────────────────────

describe("generateCandidates — overlay tree application", () => {
  test("with activeOverlay replacementTree → candidates come from overlay tree", () => {
    const overlay = makeOverlay("o1", "opening", () => true);
    const config = makeConfig([overlay]);
    const ctx = makeContext(["1NT", "P"]);
    const protoResult = makeProtocolResult("opening");

    const effectiveCtx = buildEffectiveContext(ctx, config, protoResult);
    expect(effectiveCtx.activeOverlays).toEqual([overlay]);

    const { candidates } = generateCandidates(normalTree, protoResult.handResult, effectiveCtx);
    const matched = candidates.find(c => c.isMatched);
    expect(matched).toBeDefined();
    expect(matched!.bidName).toBe("overlay-bid");
    expect(matched!.resolvedCall).toEqual({ type: "bid", level: 2, strain: BidSuit.Hearts });
  });

  test("without activeOverlay → candidates come from original tree", () => {
    const config = makeConfig();
    const ctx = makeContext(["1NT", "P"]);
    const protoResult = makeProtocolResult("opening");

    const effectiveCtx = buildEffectiveContext(ctx, config, protoResult);
    expect(effectiveCtx.activeOverlays).toEqual([]);

    const { candidates } = generateCandidates(normalTree, protoResult.handResult, effectiveCtx);
    const matched = candidates.find(c => c.isMatched);
    expect(matched).toBeDefined();
    expect(matched!.bidName).toBe("normal-bid");
  });

  test("activeOverlay whose replacementTree is fallback() → returns empty array", () => {
    const fallbackOverlay = makeOverlay("o-fb", "opening", () => true, fallback("no-match"));
    const config = makeConfig([fallbackOverlay]);
    const ctx = makeContext(["1NT", "P"]);
    const protoResult = makeProtocolResult("opening");

    const effectiveCtx = buildEffectiveContext(ctx, config, protoResult);
    expect(effectiveCtx.activeOverlays).toHaveLength(1);

    const { candidates } = generateCandidates(normalTree, protoResult.handResult, effectiveCtx);
    expect(candidates).toEqual([]);
  });
});

// ─── Overlay patch hooks ─────────────────────────────────────

describe("overlay patch hooks", () => {
  const bid2D: Call = { type: "bid", level: 2, strain: BidSuit.Diamonds };

  test("suppressIntent filters a proposal → candidate list shrinks", () => {
    // Overlay with suppressIntent that removes "normal-bid"
    const overlay: ConventionOverlayPatch = {
      id: "suppress-test",
      roundName: "opening",
      matches: () => true,
      suppressIntent: (intent) => intent.nodeName === "normal-bid",
    };
    const config = makeConfig([overlay]);
    const ctx = makeContext(["1NT", "P"]);
    const protoResult = makeProtocolResult("opening");

    const effectiveCtx = buildEffectiveContext(ctx, config, protoResult);
    const { candidates } = generateCandidates(normalTree, protoResult.handResult, effectiveCtx);

    // Normal tree has 1 IntentNode that matches (normal-bid) + potentially fallback.
    // With suppression, the matched candidate should be gone.
    const normalBid = candidates.find(c => c.bidName === "normal-bid");
    expect(normalBid).toBeUndefined();
  });

  test("addIntents appends proposals → list grows, added intents never matched", () => {
    const addedIntent: CollectedIntent = {
      intent: { type: SemanticIntentType.EscapeRescue, params: {} },
      nodeName: "emergency-bid",
      meaning: "Emergency escape",
      defaultCall: () => bid2D,
      pathConditions: [],
      // No sourceNode — overlay-injected
    };
    const overlay: ConventionOverlayPatch = {
      id: "add-test",
      roundName: "opening",
      matches: () => true,
      addIntents: () => [addedIntent],
    };
    const config = makeConfig([overlay]);
    const ctx = makeContext(["1NT", "P"]);
    const protoResult = makeProtocolResult("opening");

    const effectiveCtx = buildEffectiveContext(ctx, config, protoResult);
    const { candidates } = generateCandidates(normalTree, protoResult.handResult, effectiveCtx);

    const added = candidates.find(c => c.bidName === "emergency-bid");
    expect(added).toBeDefined();
    expect(added!.isMatched).toBe(false); // Added intents never matched
    expect(added!.resolvedCall).toEqual(bid2D);
  });

  test("overrideResolver returns resolved → used instead of standard resolver", () => {
    const overlay: ConventionOverlayPatch = {
      id: "override-test",
      roundName: "opening",
      matches: () => true,
      overrideResolver: () => ({ status: "resolved", calls: [{ call: bid2D }] }),
    };
    const config = makeConfig([overlay]);
    const ctx = makeContext(["1NT", "P"]);
    const protoResult = makeProtocolResult("opening");

    const effectiveCtx = buildEffectiveContext(ctx, config, protoResult);
    const { candidates } = generateCandidates(normalTree, protoResult.handResult, effectiveCtx);

    const matched = candidates.find(c => c.isMatched);
    expect(matched).toBeDefined();
    expect(matched!.resolvedCall).toEqual(bid2D);
    expect(matched!.isDefaultCall).toBe(false);
  });

  test("overrideResolver returns null → standard resolver used (fallthrough)", () => {
    const overlay: ConventionOverlayPatch = {
      id: "null-override",
      roundName: "opening",
      matches: () => true,
      overrideResolver: () => null,
    };
    const config = makeConfig([overlay]);
    const ctx = makeContext(["1NT", "P"]);
    const protoResult = makeProtocolResult("opening");

    const effectiveCtx = buildEffectiveContext(ctx, config, protoResult);
    const { candidates } = generateCandidates(normalTree, protoResult.handResult, effectiveCtx);

    const matched = candidates.find(c => c.isMatched);
    expect(matched).toBeDefined();
    // No resolver registered → falls back to defaultCall (2C)
    expect(matched!.resolvedCall).toEqual({ type: "bid", level: 2, strain: BidSuit.Clubs });
    expect(matched!.isDefaultCall).toBe(true);
  });

  test("hook throws → console.warn called, graceful degradation", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const overlay: ConventionOverlayPatch = {
      id: "throw-test",
      roundName: "opening",
      matches: () => true,
      suppressIntent: () => { throw new Error("suppress boom"); },
      addIntents: () => { throw new Error("add boom"); },
      overrideResolver: () => { throw new Error("override boom"); },
    };
    const config = makeConfig([overlay]);
    const ctx = makeContext(["1NT", "P"]);
    const protoResult = makeProtocolResult("opening");

    const effectiveCtx = buildEffectiveContext(ctx, config, protoResult);
    const { candidates } = generateCandidates(normalTree, protoResult.handResult, effectiveCtx);

    // Should still produce candidates despite hook errors
    expect(candidates.length).toBeGreaterThan(0);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  test("backward compat: overlay with only replacementTree works unchanged", () => {
    const overlay = makeOverlay("compat-test", "opening", () => true);
    const config = makeConfig([overlay]);
    const ctx = makeContext(["1NT", "P"]);
    const protoResult = makeProtocolResult("opening");

    const effectiveCtx = buildEffectiveContext(ctx, config, protoResult);
    const { candidates } = generateCandidates(normalTree, protoResult.handResult, effectiveCtx);

    const matched = candidates.find(c => c.isMatched);
    expect(matched).toBeDefined();
    expect(matched!.bidName).toBe("overlay-bid");
  });

  test("suppressIntent on matched intent causes matchedIntentSuppressed", () => {
    const overlay: ConventionOverlayPatch = {
      id: "suppress-matched-integration",
      roundName: "opening",
      matches: () => true,
      suppressIntent: (intent) => intent.nodeName === "normal-bid",
    };
    const config = makeConfig([overlay]);
    const ctx = makeContext(["1NT", "P"]);
    const protoResult = makeProtocolResult("opening");

    const effectiveCtx = buildEffectiveContext(ctx, config, protoResult);
    const result = generateCandidates(normalTree, protoResult.handResult, effectiveCtx);
    expect(result.matchedIntentSuppressed).toBe(true);

    const selected = selectMatchedCandidate(result.candidates);
    expect(selected).toBeNull();
  });
});

// ─── Overlay composition (multi-overlay) ─────────────────────

describe("overlay composition (multi-overlay)", () => {
  test("buildEffectiveContext returns activeOverlays as array", () => {
    const overlay = makeOverlay("o1", "opening", () => true);
    const config = makeConfig([overlay]);
    const ctx = makeContext(["1NT", "P"]);
    const result = buildEffectiveContext(ctx, config, makeProtocolResult("opening"));
    expect(result.activeOverlays).toEqual([overlay]);
  });

  test("two matching overlays both in array", () => {
    const overlay1 = makeOverlay("o1", "opening", () => true);
    const overlay2: ConventionOverlayPatch = {
      id: "o2", roundName: "opening", matches: () => true,
      suppressIntent: (intent) => intent.nodeName === "never-match",
    };
    const config = makeConfig([overlay1, overlay2]);
    const ctx = makeContext(["1NT", "P"]);
    const result = buildEffectiveContext(ctx, config, makeProtocolResult("opening"));
    expect(result.activeOverlays).toHaveLength(2);
  });

  test("first replacementTree wins across multiple overlays", () => {
    const secondTree = handDecision("alt-check", hcpMin(3),
      intentBid("alt-bid", "Alt bid",
        { type: SemanticIntentType.Signoff, params: {} },
        (): Call => ({ type: "bid", level: 3, strain: BidSuit.Clubs })),
      fallback("alt-weak"));

    const o1 = makeOverlay("o1", "opening", () => true, overlayTree);
    const o2 = makeOverlay("o2", "opening", () => true, secondTree);
    const config = makeConfig([o1, o2]);
    const ctx = makeContext(["1NT", "P"]);
    const protoResult = makeProtocolResult("opening");
    const effectiveCtx = buildEffectiveContext(ctx, config, protoResult);

    const { candidates } = generateCandidates(normalTree, protoResult.handResult, effectiveCtx);
    const matched = candidates.find(c => c.isMatched);
    expect(matched!.bidName).toBe("overlay-bid"); // from first overlay's tree
  });

  test("suppressIntent from ALL overlays composes", () => {
    const o1: ConventionOverlayPatch = {
      id: "suppress-1", roundName: "opening", matches: () => true,
      suppressIntent: (intent) => intent.nodeName === "normal-bid",
    };
    const o2: ConventionOverlayPatch = {
      id: "suppress-2", roundName: "opening", matches: () => true,
      suppressIntent: () => false,
    };
    const config = makeConfig([o1, o2]);
    const ctx = makeContext(["1NT", "P"]);
    const protoResult = makeProtocolResult("opening");
    const effectiveCtx = buildEffectiveContext(ctx, config, protoResult);

    const { candidates, matchedIntentSuppressed } = generateCandidates(normalTree, protoResult.handResult, effectiveCtx);
    expect(matchedIntentSuppressed).toBe(true);
    expect(candidates.find(c => c.bidName === "normal-bid")).toBeUndefined();
  });

  test("addIntents from ALL overlays concatenate in config order", () => {
    const bid2D: Call = { type: "bid", level: 2, strain: BidSuit.Diamonds };
    const bid3D: Call = { type: "bid", level: 3, strain: BidSuit.Diamonds };
    const o1: ConventionOverlayPatch = {
      id: "add-1", roundName: "opening", matches: () => true,
      addIntents: () => [{
        intent: { type: SemanticIntentType.EscapeRescue, params: {} },
        nodeName: "added-1", meaning: "Added 1", defaultCall: () => bid2D, pathConditions: [],
      }],
    };
    const o2: ConventionOverlayPatch = {
      id: "add-2", roundName: "opening", matches: () => true,
      addIntents: () => [{
        intent: { type: SemanticIntentType.EscapeRescue, params: {} },
        nodeName: "added-2", meaning: "Added 2", defaultCall: () => bid3D, pathConditions: [],
      }],
    };
    const config = makeConfig([o1, o2]);
    const ctx = makeContext(["1NT", "P"]);
    const protoResult = makeProtocolResult("opening");
    const effectiveCtx = buildEffectiveContext(ctx, config, protoResult);

    const { candidates } = generateCandidates(normalTree, protoResult.handResult, effectiveCtx);
    const added1 = candidates.find(c => c.bidName === "added-1");
    const added2 = candidates.find(c => c.bidName === "added-2");
    expect(added1).toBeDefined();
    expect(added2).toBeDefined();
    const idx1 = candidates.findIndex(c => c.bidName === "added-1");
    const idx2 = candidates.findIndex(c => c.bidName === "added-2");
    expect(idx1).toBeLessThan(idx2);
  });

  test("overrideResolver first non-null wins", () => {
    const bid2D: Call = { type: "bid", level: 2, strain: BidSuit.Diamonds };
    const o1: ConventionOverlayPatch = {
      id: "override-1", roundName: "opening", matches: () => true,
      overrideResolver: () => null,
    };
    const o2: ConventionOverlayPatch = {
      id: "override-2", roundName: "opening", matches: () => true,
      overrideResolver: () => ({ status: "resolved", calls: [{ call: bid2D }] }),
    };
    const config = makeConfig([o1, o2]);
    const ctx = makeContext(["1NT", "P"]);
    const protoResult = makeProtocolResult("opening");
    const effectiveCtx = buildEffectiveContext(ctx, config, protoResult);

    const { candidates } = generateCandidates(normalTree, protoResult.handResult, effectiveCtx);
    const matched = candidates.find(c => c.isMatched);
    expect(matched!.resolvedCall).toEqual(bid2D);
    expect(matched!.isDefaultCall).toBe(false);
  });

  test("hook error in one overlay doesn't block others", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const bid2D: Call = { type: "bid", level: 2, strain: BidSuit.Diamonds };
    const o1: ConventionOverlayPatch = {
      id: "error-overlay", roundName: "opening", matches: () => true,
      addIntents: () => { throw new Error("boom"); },
    };
    const o2: ConventionOverlayPatch = {
      id: "working-overlay", roundName: "opening", matches: () => true,
      addIntents: () => [{
        intent: { type: SemanticIntentType.EscapeRescue, params: {} },
        nodeName: "from-working", meaning: "Working", defaultCall: () => bid2D, pathConditions: [],
      }],
    };
    const config = makeConfig([o1, o2]);
    const ctx = makeContext(["1NT", "P"]);
    const protoResult = makeProtocolResult("opening");
    const effectiveCtx = buildEffectiveContext(ctx, config, protoResult);

    const { candidates } = generateCandidates(normalTree, protoResult.handResult, effectiveCtx);
    expect(candidates.find(c => c.bidName === "from-working")).toBeDefined();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  test("single-overlay backward compat", () => {
    const overlay = makeOverlay("o1", "opening", () => true);
    const config = makeConfig([overlay]);
    const ctx = makeContext(["1NT", "P"]);
    const protoResult = makeProtocolResult("opening");
    const effectiveCtx = buildEffectiveContext(ctx, config, protoResult);

    expect(effectiveCtx.activeOverlays).toHaveLength(1);
    const { candidates } = generateCandidates(normalTree, protoResult.handResult, effectiveCtx);
    const matched = candidates.find(c => c.isMatched);
    expect(matched!.bidName).toBe("overlay-bid");
  });
});

// ─── Overlay priority sorting ─────────────────────────────────

describe("overlay priority sorting", () => {
  test("two overlays match, no priority → first wins (insertion order)", () => {
    const secondTree = handDecision("alt-check", hcpMin(3),
      intentBid("second-bid", "Second bid",
        { type: SemanticIntentType.Signoff, params: {} },
        (): Call => ({ type: "bid", level: 3, strain: BidSuit.Clubs })),
      fallback("alt-weak"));

    const o1 = makeOverlay("o1", "opening", () => true, overlayTree);
    const o2 = makeOverlay("o2", "opening", () => true, secondTree);
    const config = makeConfig([o1, o2]);
    const ctx = makeContext(["1NT", "P"]);
    const result = buildEffectiveContext(ctx, config, makeProtocolResult("opening"));

    // No priority set → insertion order preserved → o1 first
    expect(result.activeOverlays[0]!.id).toBe("o1");
    expect(result.activeOverlays[1]!.id).toBe("o2");
  });

  test("second overlay has lower priority number → sorted first (higher precedence)", () => {
    const secondTree = handDecision("alt-check", hcpMin(3),
      intentBid("second-bid", "Second bid",
        { type: SemanticIntentType.Signoff, params: {} },
        (): Call => ({ type: "bid", level: 3, strain: BidSuit.Clubs })),
      fallback("alt-weak"));

    const o1: ConventionOverlayPatch = {
      ...makeOverlay("o1", "opening", () => true, overlayTree),
      priority: 10,
    };
    const o2: ConventionOverlayPatch = {
      ...makeOverlay("o2", "opening", () => true, secondTree),
      priority: 1,
    };
    const config = makeConfig([o1, o2]);
    const ctx = makeContext(["1NT", "P"]);
    const result = buildEffectiveContext(ctx, config, makeProtocolResult("opening"));

    // Lower priority number → higher precedence → o2 first
    expect(result.activeOverlays[0]!.id).toBe("o2");
    expect(result.activeOverlays[1]!.id).toBe("o1");
  });

  test("default priority is 0", () => {
    const o1: ConventionOverlayPatch = {
      ...makeOverlay("o1", "opening", () => true),
      priority: 1, // explicit 1 → lower precedence than default 0
    };
    const o2 = makeOverlay("o2", "opening", () => true); // default priority (0)
    const config = makeConfig([o1, o2]);
    const ctx = makeContext(["1NT", "P"]);
    const result = buildEffectiveContext(ctx, config, makeProtocolResult("opening"));

    // o2 (priority 0) sorts before o1 (priority 1)
    expect(result.activeOverlays[0]!.id).toBe("o2");
    expect(result.activeOverlays[1]!.id).toBe("o1");
  });
});

// ─── Protocol trigger overlays (triggerOverrides) ─────────────

describe("protocol trigger overlays (triggerOverrides)", () => {
  // Hand tree that produces a 3C bid (legal after both 1NT and 2NT openings)
  const threeLevelTree = handDecision(
    "hcp-check",
    hcpMin(8),
    intentBid("trigger-test-bid", "Trigger test bid",
      { type: SemanticIntentType.Signoff, params: {} },
      (): Call => ({ type: "bid", level: 3, strain: BidSuit.Clubs })),
    fallback("too-weak"),
  );

  // Protocol where "opening" triggers on 1NT
  const triggerProtocol = protocol("trigger-test", [
    round("opening", {
      triggers: [semantic(bidMade(1, BidSuit.NoTrump), {})],
      handTree: threeLevelTree,
      seatFilter: isResponder(),
    }),
  ]);

  function makeTriggerConfig(overlays?: readonly ConventionOverlayPatch[]): ConventionConfig {
    return {
      id: "trigger-test",
      name: "Trigger Test Convention",
      description: "Test",
      category: ConventionCategory.Asking,
      dealConstraints: { seats: [] },
      protocol: triggerProtocol,
      overlays,
    };
  }

  test("overlay replaces round triggers -> protocol uses overlay triggers", () => {
    // Overlay with triggerOverrides: replace "opening" triggers with bidMade(2, NT)
    const overlay: ConventionOverlayPatch = {
      id: "trigger-override",
      roundName: "opening",
      matches: () => true,
      triggerOverrides: new Map([
        ["opening", [semantic(bidMade(2, BidSuit.NoTrump), {})]],
      ]),
    };
    const config = makeTriggerConfig([overlay]);

    // With 2NT auction: normal protocol triggers on 1NT, so would NOT match.
    // But with trigger override to 2NT, it SHOULD match.
    const ctx = makeContext(["2NT", "P"]);
    const result = evaluateBiddingRules(ctx, config);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 3, strain: BidSuit.Clubs });
  });

  test("no overlay -> original triggers work", () => {
    const config = makeTriggerConfig();
    // 1NT auction should match normal triggers
    const ctx = makeContext(["1NT", "P"]);
    const result = evaluateBiddingRules(ctx, config);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 3, strain: BidSuit.Clubs });
  });

  test("non-matching overlay -> original triggers used", () => {
    const overlay: ConventionOverlayPatch = {
      id: "non-matching-trigger",
      roundName: "opening",
      matches: () => false,
      triggerOverrides: new Map([
        ["opening", [semantic(bidMade(2, BidSuit.NoTrump), {})]],
      ]),
    };
    const config = makeTriggerConfig([overlay]);

    // 1NT auction: overlay doesn't match (matches() returns false),
    // so original triggers should be used and 1NT should match.
    const ctx = makeContext(["1NT", "P"]);
    const result = evaluateBiddingRules(ctx, config);
    expect(result).not.toBeNull();
  });

  test("non-matching overlay -> overridden triggers not used", () => {
    const overlay: ConventionOverlayPatch = {
      id: "non-matching-trigger",
      roundName: "opening",
      matches: () => false,
      triggerOverrides: new Map([
        ["opening", [semantic(bidMade(2, BidSuit.NoTrump), {})]],
      ]),
    };
    const config = makeTriggerConfig([overlay]);

    // 2NT auction: overlay doesn't match, so overridden triggers not used.
    // Original triggers expect 1NT, so should NOT match.
    const ctx = makeContext(["2NT", "P"]);
    const result = evaluateBiddingRules(ctx, config);
    expect(result).toBeNull();
  });

  test("validateOverlayPatches accepts overlays with triggerOverrides", () => {
    const overlay: ConventionOverlayPatch = {
      id: "valid-trigger-overlay",
      roundName: "opening",
      matches: () => true,
      triggerOverrides: new Map([
        ["opening", [semantic(bidMade(2, BidSuit.NoTrump), {})]],
      ]),
    };
    expect(() => validateOverlayPatches([overlay], triggerProtocol)).not.toThrow();
  });

  test("validateOverlayPatches throws when triggerOverrides key references non-existent round", () => {
    const overlay: ConventionOverlayPatch = {
      id: "bad-trigger-override",
      roundName: "opening",
      matches: () => true,
      triggerOverrides: new Map([
        ["nonexistent-round", [semantic(bidMade(2, BidSuit.NoTrump), {})]],
      ]),
    };
    expect(() => validateOverlayPatches([overlay], triggerProtocol)).toThrow(/nonexistent-round/);
  });

  test("validateOverlayPatches allows triggerOverrides with valid round names", () => {
    // triggerProtocol has round "opening"
    const overlay: ConventionOverlayPatch = {
      id: "valid-trigger-keys",
      roundName: "opening",
      matches: () => true,
      triggerOverrides: new Map([
        ["opening", [semantic(bidMade(2, BidSuit.NoTrump), {})]],
      ]),
    };
    expect(() => validateOverlayPatches([overlay], triggerProtocol)).not.toThrow();
  });

  test("collectTriggerOverrides: two overlays for different round names both contribute", () => {
    const overlay1: ConventionOverlayPatch = {
      id: "override-round1",
      roundName: "opening",
      matches: () => true,
      triggerOverrides: new Map([
        ["opening", [semantic(bidMade(2, BidSuit.NoTrump), {})]],
      ]),
    };
    const overlay2: ConventionOverlayPatch = {
      id: "override-round2",
      roundName: "opening",
      matches: () => true,
      triggerOverrides: new Map([
        ["response", [semantic(bidMade(3, BidSuit.Clubs), {})]],
      ]),
    };

    const mockState = { familyId: "1nt" } as DialogueState;
    const result = collectTriggerOverrides([overlay1, overlay2], mockState);

    // Both overlays match, both contribute unique round name keys
    expect(result).not.toBeUndefined();
    expect(result!.has("opening")).toBe(true);
    expect(result!.has("response")).toBe(true);
  });

  test("collectTriggerOverrides: same round name — lower priority number wins", () => {
    const highPriority: ConventionOverlayPatch = {
      id: "high-priority",
      roundName: "opening",
      priority: 1,
      matches: () => true,
      triggerOverrides: new Map([
        ["opening", [semantic(bidMade(2, BidSuit.NoTrump), {})]],
      ]),
    };
    const lowPriority: ConventionOverlayPatch = {
      id: "low-priority",
      roundName: "opening",
      priority: 10,
      matches: () => true,
      triggerOverrides: new Map([
        ["opening", [semantic(bidMade(3, BidSuit.NoTrump), {})]],
      ]),
    };

    const mockState = { familyId: "1nt" } as DialogueState;
    // Even if low-priority is first in array, high-priority wins after sorting
    const result = collectTriggerOverrides([lowPriority, highPriority], mockState);

    expect(result).not.toBeUndefined();
    const triggers = result!.get("opening")!;
    expect(triggers).toHaveLength(1);
    // High priority overlay's trigger (bidMade 2NT) should win, not low priority's (3NT)
    // Check via the condition's label — bidMade(2, NT) produces a different label from bidMade(3, NT)
    expect(triggers[0]!.condition.label).toContain("2NT");
  });

  test("collectTriggerOverrides: non-matching overlays excluded", () => {
    const overlay: ConventionOverlayPatch = {
      id: "non-matching",
      roundName: "opening",
      matches: () => false,
      triggerOverrides: new Map([
        ["opening", [semantic(bidMade(2, BidSuit.NoTrump), {})]],
      ]),
    };

    const mockState = { familyId: "1nt" } as DialogueState;
    const result = collectTriggerOverrides([overlay], mockState);

    expect(result).toBeUndefined();
  });
});
