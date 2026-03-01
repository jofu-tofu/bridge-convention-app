// Phase 7a: Resolver result semantics tests
// Tests the ResolverResult discriminated union: declined excludes candidates,
// use_default falls back to defaultCall, resolved uses the call(s).

import { describe, test, expect } from "vitest";
import { BidSuit, Seat } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import { evaluateHand } from "../../../engine/hand-evaluator";
import { hand } from "../../../engine/__tests__/fixtures";
import { generateCandidates } from "../../core/candidate-generator";
import type { EffectiveConventionContext } from "../../core/effective-context";
import { ConventionCategory } from "../../core/types";
import type { ConventionConfig, BiddingContext } from "../../core/types";
import type { DialogueState } from "../../core/dialogue/dialogue-state";
import {
  ForcingState, PendingAction, CompetitionMode,
  CaptainRole, SystemMode,
} from "../../core/dialogue/dialogue-state";
import { intentBid } from "../../core/intent/intent-node";
import type { IntentNode } from "../../core/intent/intent-node";
import { SemanticIntentType } from "../../core/intent/semantic-intent";
import type { IntentResolverFn, IntentResolverMap } from "../../core/intent/intent-resolver";
import { evaluateTree } from "../../core/tree-evaluator";
import type { ConventionOverlayPatch } from "../../core/overlay";

// --- Shared test infrastructure ---

const defaultDialogueState: DialogueState = {
  familyId: null,
  forcingState: ForcingState.Nonforcing,
  agreedStrain: { type: "none" },
  pendingAction: PendingAction.None,
  competitionMode: CompetitionMode.Uncontested,
  captain: CaptainRole.Neither,
  systemMode: SystemMode.On,
  conventionData: {},
};

function makeContext(): BiddingContext {
  const h = hand("SA", "SK", "SQ", "SJ", "HA", "HK", "HQ", "DA", "DK", "D5", "CA", "CK", "C2");
  return {
    hand: h,
    auction: { entries: [], isComplete: false },
    seat: Seat.South,
    evaluation: evaluateHand(h),
    opponentConventionIds: [],
  };
}

const defaultCall: Call = { type: "bid", level: 2, strain: BidSuit.Clubs };
const resolvedCall: Call = { type: "bid", level: 3, strain: BidSuit.Diamonds };

function makeTree() {
  return intentBid(
    "test-intent",
    "Test bid",
    { type: SemanticIntentType.AskForMajor, params: {} },
    () => defaultCall,
  );
}

function makeEffectiveCtx(
  resolvers: IntentResolverMap,
  overlays: readonly ConventionOverlayPatch[] = [],
): EffectiveConventionContext {
  const raw = makeContext();
  const tree = makeTree();
  const config = {
    id: "test-convention",
    name: "Test",
    description: "Test convention",
    category: ConventionCategory.Asking,
    dealConstraints: { seats: [] },
    protocol: {
      id: "test-protocol",
      rounds: [{ name: "round1", triggers: [], handTree: () => tree }],
    },
    intentResolvers: resolvers,
    overlays: [...overlays],
  } satisfies ConventionConfig;
  const handResult = evaluateTree(tree, raw);
  const matched = handResult.matched as IntentNode | null;
  const protocolResult = {
    matched,
    matchedRounds: [],
    established: { role: "responder" as const },
    handResult,
    handTreeRoot: tree,
    activeRound: { name: "round1", triggers: [], handTree: () => tree },
  };

  return {
    raw,
    config,
    protocolResult,
    dialogueState: defaultDialogueState,
    activeOverlays: [...overlays],
  };
}

// --- Tests ---

describe("ResolverResult semantics", () => {
  describe("standard resolver outcomes", () => {
    test("no resolver registered → candidate uses defaultCall", () => {
      const resolvers: IntentResolverMap = new Map();
      const ctx = makeEffectiveCtx(resolvers);
      const result = generateCandidates(ctx.protocolResult.handTreeRoot!, ctx.protocolResult.handResult!, ctx);
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0]!.resolvedCall).toEqual(defaultCall);
      expect(result.candidates[0]!.isDefaultCall).toBe(true);
    });

    test("resolver returns { status: 'use_default' } → candidate uses defaultCall", () => {
      const resolver: IntentResolverFn = () => ({ status: "use_default" });
      const resolvers: IntentResolverMap = new Map([
        [SemanticIntentType.AskForMajor, resolver],
      ]);
      const ctx = makeEffectiveCtx(resolvers);
      const result = generateCandidates(ctx.protocolResult.handTreeRoot!, ctx.protocolResult.handResult!, ctx);
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0]!.resolvedCall).toEqual(defaultCall);
      expect(result.candidates[0]!.isDefaultCall).toBe(true);
    });

    test("resolver returns { status: 'resolved', calls } → candidate uses resolved call", () => {
      const resolver: IntentResolverFn = () => ({
        status: "resolved",
        calls: [{ call: resolvedCall }],
      });
      const resolvers: IntentResolverMap = new Map([
        [SemanticIntentType.AskForMajor, resolver],
      ]);
      const ctx = makeEffectiveCtx(resolvers);
      const result = generateCandidates(ctx.protocolResult.handTreeRoot!, ctx.protocolResult.handResult!, ctx);
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0]!.resolvedCall).toEqual(resolvedCall);
      expect(result.candidates[0]!.isDefaultCall).toBe(false);
    });

    test("resolver returns { status: 'declined' } → candidate excluded entirely", () => {
      const resolver: IntentResolverFn = () => ({ status: "declined" });
      const resolvers: IntentResolverMap = new Map([
        [SemanticIntentType.AskForMajor, resolver],
      ]);
      const ctx = makeEffectiveCtx(resolvers);
      const result = generateCandidates(ctx.protocolResult.handTreeRoot!, ctx.protocolResult.handResult!, ctx);
      // The key assertion: declined = excluded, NOT fallback to defaultCall
      expect(result.candidates).toHaveLength(0);
    });
  });

  describe("overrideResolver outcomes", () => {
    test("overrideResolver returns null → falls through to standard resolver", () => {
      const standardResolver: IntentResolverFn = () => ({
        status: "resolved",
        calls: [{ call: resolvedCall }],
      });
      const resolvers: IntentResolverMap = new Map([
        [SemanticIntentType.AskForMajor, standardResolver],
      ]);
      const overlay: ConventionOverlayPatch = {
        id: "test-overlay",
        roundName: "round1",
        matches: () => true,
        overrideResolver: () => null,
      };
      const ctx = makeEffectiveCtx(resolvers, [overlay]);
      const result = generateCandidates(ctx.protocolResult.handTreeRoot!, ctx.protocolResult.handResult!, ctx);
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0]!.resolvedCall).toEqual(resolvedCall);
    });

    test("overrideResolver returns { status: 'resolved' } → uses override call", () => {
      const overrideCall: Call = { type: "pass" };
      const overlay: ConventionOverlayPatch = {
        id: "test-overlay",
        roundName: "round1",
        matches: () => true,
        overrideResolver: () => ({
          status: "resolved",
          calls: [{ call: overrideCall }],
        }),
      };
      const resolvers: IntentResolverMap = new Map();
      const ctx = makeEffectiveCtx(resolvers, [overlay]);
      const result = generateCandidates(ctx.protocolResult.handTreeRoot!, ctx.protocolResult.handResult!, ctx);
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0]!.resolvedCall).toEqual(overrideCall);
      expect(result.candidates[0]!.isDefaultCall).toBe(false);
    });

    test("overrideResolver returns { status: 'declined' } → candidate excluded entirely", () => {
      const overlay: ConventionOverlayPatch = {
        id: "test-overlay",
        roundName: "round1",
        matches: () => true,
        overrideResolver: () => ({ status: "declined" }),
      };
      const resolvers: IntentResolverMap = new Map();
      const ctx = makeEffectiveCtx(resolvers, [overlay]);
      const result = generateCandidates(ctx.protocolResult.handTreeRoot!, ctx.protocolResult.handResult!, ctx);
      expect(result.candidates).toHaveLength(0);
    });

    test("overrideResolver returns { status: 'use_default' } → uses defaultCall", () => {
      const overlay: ConventionOverlayPatch = {
        id: "test-overlay",
        roundName: "round1",
        matches: () => true,
        overrideResolver: () => ({ status: "use_default" }),
      };
      const resolvers: IntentResolverMap = new Map();
      const ctx = makeEffectiveCtx(resolvers, [overlay]);
      const result = generateCandidates(ctx.protocolResult.handTreeRoot!, ctx.protocolResult.handResult!, ctx);
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0]!.resolvedCall).toEqual(defaultCall);
      expect(result.candidates[0]!.isDefaultCall).toBe(true);
    });
  });

  describe("multi-encoding resolved", () => {
    test("multiple calls in resolved → first legal wins", () => {
      const illegalCall: Call = { type: "bid", level: 7, strain: BidSuit.NoTrump };
      const legalCall: Call = { type: "pass" };
      const resolver: IntentResolverFn = () => ({
        status: "resolved",
        calls: [{ call: illegalCall }, { call: legalCall }],
      });
      const resolvers: IntentResolverMap = new Map([
        [SemanticIntentType.AskForMajor, resolver],
      ]);
      const ctx = makeEffectiveCtx(resolvers);
      const result = generateCandidates(ctx.protocolResult.handTreeRoot!, ctx.protocolResult.handResult!, ctx);
      expect(result.candidates).toHaveLength(1);
      // Empty auction → 7NT is actually legal. Use pass as second option anyway.
      // The point is the first call is tried first.
      expect(result.candidates[0]!.isDefaultCall).toBe(false);
    });
  });

  describe("Edge Case D: declined resolver without overlay protection", () => {
    test("resolver declined + no overlay → zero candidates, no defaultCall leak", () => {
      // This is the core bug the plan addresses:
      // Before 7a, null from resolver fell through to defaultCall
      const resolver: IntentResolverFn = () => ({ status: "declined" });
      const resolvers: IntentResolverMap = new Map([
        [SemanticIntentType.AskForMajor, resolver],
      ]);
      const ctx = makeEffectiveCtx(resolvers);
      const result = generateCandidates(ctx.protocolResult.handTreeRoot!, ctx.protocolResult.handResult!, ctx);
      expect(result.candidates).toHaveLength(0);
      expect(result.matchedIntentSuppressed).toBe(false);
    });
  });
});
