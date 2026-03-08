import { beforeEach, describe, expect, test } from "vitest";
import { BidSuit, Seat } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import { hand } from "../../../engine/__tests__/fixtures";
import { evaluateHand } from "../../../engine/hand-evaluator";
import { buildAuction } from "../../../engine/auction-helpers";
import {
  clearRegistry,
  evaluateBiddingRules,
  getDiagnostics,
  registerConvention,
} from "../../core/registry";
import { staymanConfig } from "../../definitions/stayman";
import { round1AskAfterDouble } from "../../definitions/stayman/tree";
import { bergenConfig } from "../../definitions/bergen-raises";
import { weakTwosConfig } from "../../definitions/weak-twos";
import { saycConfig } from "../../definitions/sayc";
import { lebensohlLiteConfig } from "../../definitions/lebensohl-lite";
import { buildEffectiveContext } from "../../core/effective-context";
import { generateCandidates } from "../../core/candidate-generator";
import type { ResolvedCandidate } from "../../core/candidate-generator";
import { selectMatchedCandidate } from "../../core/candidate-selector";
import type { BiddingContext, ConventionConfig } from "../../core/types";
import { ConventionCategory } from "../../core/types";
import { computeDialogueState } from "../../core/dialogue/dialogue-manager";
import type { TransitionRule } from "../../core/dialogue/dialogue-transitions";
import { protocol, round, semantic } from "../../core/protocol";
import {
  and,
  bidMade,
  hcpMin,
  isResponder,
  or,
  partnerBidMade,
  suitMin,
} from "../../core/conditions";
import { handDecision, fallback } from "../../core/rule-tree";
import { intentBid } from "../../core/intent/intent-node";
import { SemanticIntentType } from "../../core/intent/semantic-intent";
import { evaluateProtocol } from "../../core/protocol-evaluator";
import { evaluateTree } from "../../core/tree-evaluator";
import { ForcingState, CompetitionMode, PendingAction } from "../../core/dialogue/dialogue-state";
import type { ConventionOverlayPatch } from "../../core/overlay";
import { protocolInferenceExtractor } from "../../../inference/protocol-inference-extractor";
import { createFitConfidenceRanker } from "../../../strategy/bidding/fit-ranker";

beforeEach(() => {
  clearRegistry();
});

describe("edge cases red team", () => {
  test("A: generated candidates include unsatisfied alternatives, and selected candidate is satisfiable", () => {
    registerConvention(staymanConfig);

    const h = hand(
      "SA",
      "SK",
      "S3",
      "HK",
      "HQ",
      "HJ",
      "H2",
      "DK",
      "D5",
      "D3",
      "C7",
      "C5",
      "C2",
    );
    const context: BiddingContext = {
      hand: h,
      auction: buildAuction(Seat.North, ["1NT", "P", "2C", "P"]),
      seat: Seat.North,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };

    const evaluated = evaluateBiddingRules(context, staymanConfig);
    expect(evaluated).not.toBeNull();
    expect(evaluated!.treeRoot).toBeDefined();
    expect(evaluated!.treeEvalResult).toBeDefined();
    expect(evaluated!.protocolResult).toBeDefined();

    const effective = buildEffectiveContext(context, staymanConfig, evaluated!.protocolResult!);
    const generated = generateCandidates(
      evaluated!.treeRoot!,
      evaluated!.treeEvalResult!,
      effective,
    );
    expect(generated.candidates.length).toBeGreaterThan(0);

    const unsatisfied = generated.candidates.filter(c => c.failedConditions.length > 0);
    expect(unsatisfied.length).toBeGreaterThan(0);

    const selected = selectMatchedCandidate(generated.candidates);
    expect(selected === null || selected.failedConditions.length === 0).toBe(true);
  });

  test("A: unsatisfied generated candidate promoted to preferred still cannot be selected", () => {
    registerConvention(staymanConfig);

    const h = hand(
      "SA",
      "SK",
      "S3",
      "HK",
      "HQ",
      "HJ",
      "H2",
      "DK",
      "D5",
      "D3",
      "C7",
      "C5",
      "C2",
    );
    const context: BiddingContext = {
      hand: h,
      auction: buildAuction(Seat.North, ["1NT", "P", "2C", "P"]),
      seat: Seat.North,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };

    const evaluated = evaluateBiddingRules(context, staymanConfig);
    expect(evaluated).not.toBeNull();

    const effective = buildEffectiveContext(context, staymanConfig, evaluated!.protocolResult!);
    const generated = generateCandidates(
      evaluated!.treeRoot!,
      evaluated!.treeEvalResult!,
      effective,
    );

    const unsatisfied = generated.candidates.find(c => c.failedConditions.length > 0);
    expect(unsatisfied).toBeDefined();

    const promoted = { ...unsatisfied!, priority: "preferred" as const };
    const selected = selectMatchedCandidate([promoted]);
    expect(selected).toBeNull();
  });

  test("B: Stayman doubled path re-evaluates with overlay replacement tree", () => {
    registerConvention(staymanConfig);

    const responder = hand(
      "SA", "S7", "S4", "S2",
      "HK", "H7", "H3",
      "DQ", "DJ", "D7", "D4",
      "C8", "C6",
    );
    const context: BiddingContext = {
      hand: responder,
      auction: buildAuction(Seat.North, ["1NT", "X"]),
      seat: Seat.South,
      evaluation: evaluateHand(responder),
      opponentConventionIds: [],
    };

    const evaluated = evaluateBiddingRules(context, staymanConfig);
    expect(evaluated).not.toBeNull();
    expect(evaluated!.treeRoot).toBe(round1AskAfterDouble);
  });

  test("C: mid-conversation Stayman interference sets competitionMode Overcalled", () => {
    registerConvention(staymanConfig);

    const opener = hand(
      "SA", "SK", "S3",
      "HK", "HQ", "HJ", "H2",
      "DK", "D5", "D3",
      "C7", "C5", "C2",
    );
    const context: BiddingContext = {
      hand: opener,
      auction: buildAuction(Seat.North, ["1NT", "P", "2C", "2D", "P"]),
      seat: Seat.North,
      evaluation: evaluateHand(opener),
      opponentConventionIds: [],
    };

    const proto = evaluateProtocol(staymanConfig.protocol!, context);
    const effective = buildEffectiveContext(context, staymanConfig, proto);

    expect(proto.activeRound?.name).toBe("stayman-ask");
    expect(effective.dialogueState.competitionMode).toBe(CompetitionMode.Overcalled);
  });

  test("E: later-round Bergen interference keeps family and detects competition (openerSeat now tracked)", () => {
    registerConvention(bergenConfig);

    const opener = hand(
      "SA", "SK", "S8", "S5", "S2",
      "HK", "HQ", "H3",
      "DK", "D5",
      "C7", "C5", "C2",
    );
    const context: BiddingContext = {
      hand: opener,
      auction: buildAuction(Seat.North, ["1S", "P", "3C", "X", "P"]),
      seat: Seat.North,
      evaluation: evaluateHand(opener),
      opponentConventionIds: [],
    };

    const proto = evaluateProtocol(bergenConfig.protocol!, context);
    const effective = buildEffectiveContext(context, bergenConfig, proto);

    expect(effective.dialogueState.familyId).toBe("bergen");
    // Bergen now tracks openerSeat → baseline detects opponent double
    expect(effective.dialogueState.competitionMode).toBe(CompetitionMode.Doubled);
  });

  test("F: interrupted Ogust preserves pending action (competition remains uncontested without openerSeat)", () => {
    registerConvention(weakTwosConfig);

    const opener = hand(
      "S5", "S3", "S2",
      "HK", "HQ", "H9", "H7", "H5", "H3",
      "DQ", "C5", "C3", "C2",
    );
    const context: BiddingContext = {
      hand: opener,
      auction: buildAuction(Seat.North, ["2H", "P", "2NT", "3C"]),
      seat: Seat.North,
      evaluation: evaluateHand(opener),
      opponentConventionIds: [],
    };

    const proto = evaluateProtocol(weakTwosConfig.protocol!, context);
    const effective = buildEffectiveContext(context, weakTwosConfig, proto);

    expect(effective.dialogueState.familyId).toBe("weak-two");
    expect(effective.dialogueState.pendingAction).toBe(PendingAction.ShowSuit);
    expect(effective.dialogueState.competitionMode).toBe(CompetitionMode.Uncontested);
  });

  test("G: equal-priority overlay conflict yields diagnostic warning", () => {
    const baseTree = handDecision(
      "has-values",
      hcpMin(8),
      intentBid("ask", "Ask",
        { type: SemanticIntentType.AskForMajor, params: {} },
        () => ({ type: "bid", level: 2, strain: BidSuit.Clubs })),
      fallback("too-weak"),
    );
    const overlays: ConventionOverlayPatch[] = [
      { id: "o1", roundName: "opening", priority: 0, matches: () => true },
      { id: "o2", roundName: "opening", priority: 0, matches: () => true },
    ];
    const config: ConventionConfig = {
      id: "overlay-conflict-redteam",
      name: "Overlay Conflict Redteam",
      description: "Overlay conflict diagnostic fixture",
      category: ConventionCategory.Asking,
      dealConstraints: { seats: [] },
      protocol: protocol("overlay-conflict-redteam", [
        round("opening", {
          triggers: [semantic(bidMade(1, BidSuit.NoTrump), {})],
          handTree: baseTree,
          seatFilter: isResponder(),
        }),
      ]),
      overlays,
    };

    registerConvention(config);
    const diagnostics = getDiagnostics(config.id);
    const conflicts = diagnostics.filter(d => d.type === "overlay-priority-conflict");
    expect(conflicts.length).toBeGreaterThan(0);
  });

  test("H: same call from different intents keeps dialogue replay stable", () => {
    const sameCallConfig: ConventionConfig = {
      id: "same-call-intents",
      name: "Same Call Intents",
      description: "Two intents map to same call",
      category: ConventionCategory.Asking,
      dealConstraints: { seats: [] },
      protocol: protocol("same-call-intents", [
        round("opening", {
          triggers: [semantic(bidMade(1, BidSuit.NoTrump), {})],
          handTree: handDecision(
            "high-values",
            hcpMin(10),
            intentBid("intent-a", "Intent A",
              { type: SemanticIntentType.ForceGame, params: { branch: "a" } },
              () => ({ type: "bid", level: 3, strain: BidSuit.NoTrump })),
            intentBid("intent-b", "Intent B",
              { type: SemanticIntentType.Signoff, params: { branch: "b" } },
              () => ({ type: "bid", level: 3, strain: BidSuit.NoTrump })),
          ),
          seatFilter: isResponder(),
        }),
      ]),
    };
    registerConvention(sameCallConfig);

    const high = hand(
      "SA", "SK", "SQ", "SJ",
      "HK", "H7", "H3",
      "D7", "D6", "D4",
      "C8", "C6", "C2",
    );
    const low = hand(
      "S9", "S8", "S7", "S6",
      "H9", "H8", "H7",
      "DQ", "DJ", "D7",
      "CQ", "C7", "C2",
    );

    const highCtx: BiddingContext = {
      hand: high,
      auction: buildAuction(Seat.North, ["1NT", "P"]),
      seat: Seat.South,
      evaluation: evaluateHand(high),
      opponentConventionIds: [],
    };
    const lowCtx: BiddingContext = {
      hand: low,
      auction: buildAuction(Seat.North, ["1NT", "P"]),
      seat: Seat.South,
      evaluation: evaluateHand(low),
      opponentConventionIds: [],
    };

    const highResult = evaluateBiddingRules(highCtx, sameCallConfig);
    const lowResult = evaluateBiddingRules(lowCtx, sameCallConfig);

    expect(highResult).not.toBeNull();
    expect(lowResult).not.toBeNull();
    expect(highResult!.call).toEqual({ type: "bid", level: 3, strain: BidSuit.NoTrump });
    expect(lowResult!.call).toEqual({ type: "bid", level: 3, strain: BidSuit.NoTrump });
  });

  describe("Phase 0 characterization — pre-existing behaviors", () => {
    test("pendingAction overwrite is single-slot: last write wins", () => {
      const rules: readonly TransitionRule[] = [
        {
          id: "set-show-major",
          matches: (_state, entry) => { const { call } = entry; return call.type === "bid" && call.level === 2 && call.strain === BidSuit.Clubs; },
          effects: () => ({ setPendingAction: PendingAction.ShowMajor }),
        },
        {
          id: "set-show-suit",
          matches: (_state, entry) => { const { call } = entry; return call.type === "bid" && call.level === 2 && call.strain === BidSuit.Diamonds; },
          effects: () => ({ setPendingAction: PendingAction.ShowSuit }),
        },
      ];

      const state = computeDialogueState(buildAuction(Seat.North, ["1NT", "P", "2C", "P", "2D"]), rules);

      expect(state.pendingAction).toBe(PendingAction.ShowSuit);
      expect(state.pendingAction).not.toBe(PendingAction.ShowMajor);
    });

    test("rejected or() disjunction does not imply all branches failed (no forced inversion)", () => {
      const disjunction = or(hcpMin(10), suitMin(1, "hearts", 5));
      const context: BiddingContext = {
        hand: hand("S9", "S8", "S7", "S6", "H9", "H8", "H7", "D9", "D8", "D7", "C9", "C8", "C7"),
        auction: buildAuction(Seat.North, ["1NT", "P"]),
        seat: Seat.South,
        evaluation: evaluateHand(hand("S9", "S8", "S7", "S6", "H9", "H8", "H7", "D9", "D8", "D7", "C9", "C8", "C7")),
        opponentConventionIds: [],
      };

      const result = {
        call: { type: "pass" as const },
        rule: "disjunction-rejected",
        explanation: "Rejected disjunction",
        treeEvalResult: {
          matched: null,
          path: [],
          rejectedDecisions: [
            {
              node: {
                type: "decision" as const,
                name: "either-strength-or-suit",
                condition: disjunction,
                yes: { type: "fallback" as const },
                no: { type: "fallback" as const },
              },
              passed: false,
              description: "Need 10+ HCP or 5+ hearts",
            },
          ],
          visited: [],
        },
      };

      const inferences = protocolInferenceExtractor.extractInferences(result, context.seat);
      expect(inferences).toEqual([]);
    });

    test("conventionData and hand decision are independent even when semantically contradictory", () => {
      const contradictionConfig: ConventionConfig = {
        id: "contradiction-char",
        name: "Contradiction Characterization",
        description: "Locks independent dialogue and hand evaluation behavior",
        category: ConventionCategory.Asking,
        dealConstraints: { seats: [] },
        transitionRules: [
          {
            id: "set-convention-data",
            matches: (state, entry) => {
              const { call } = entry;
              return state.familyId === null
                && call.type === "bid"
                && call.level === 1
                && call.strain === BidSuit.NoTrump;
            },
            effects: (_state, entry) => {
              const { seat } = entry;
              return {
                setFamilyId: "contradiction-char",
                setForcingState: ForcingState.ForcingOneRound,
                mergeConventionData: { openerSeat: seat, declaredStrain: "clubs" },
              };
            },
          },
        ],
        protocol: protocol("contradiction-char", [
          round("opening", {
            triggers: [semantic(bidMade(1, BidSuit.NoTrump), {})],
            handTree: handDecision(
              "has-4-hearts",
              suitMin(1, "hearts", 4),
              intentBid(
                "show-hearts",
                "Shows hearts",
                { type: SemanticIntentType.ShowHeldSuit, params: { suit: "hearts" } },
                () => ({ type: "bid", level: 2, strain: BidSuit.Hearts }),
              ),
              fallback("deny-hearts"),
            ),
            seatFilter: and(isResponder()),
          }),
        ]),
      };

      const h = hand(
        "SA", "S7", "S4", "S2",
        "HK", "H7", "H3", "H2",
        "DQ", "D7", "D4",
        "C8", "C6",
      );
      const context: BiddingContext = {
        hand: h,
        auction: buildAuction(Seat.North, ["1NT", "P"]),
        seat: Seat.South,
        evaluation: evaluateHand(h),
        opponentConventionIds: [],
      };

      const evaluated = evaluateBiddingRules(context, contradictionConfig);
      expect(evaluated).not.toBeNull();
      expect(evaluated!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Hearts });
      const effective = buildEffectiveContext(context, contradictionConfig, evaluated!.protocolResult!);
      expect(effective.dialogueState.conventionData["declaredStrain"]).toBe("clubs");
    });

    test("seatFilter skip then later round activation occurs (Bergen opener round)", () => {
      const opener = hand(
        "SA", "SK", "S8", "S5", "S2",
        "HK", "HQ", "H3",
        "DK", "D5",
        "C7", "C5", "C2",
      );
      const context: BiddingContext = {
        hand: opener,
        auction: buildAuction(Seat.North, ["1H", "P", "3C", "P"]),
        seat: Seat.North,
        evaluation: evaluateHand(opener),
        opponentConventionIds: [],
      };

      const protocolResult = evaluateProtocol(bergenConfig.protocol!, context);

      expect(protocolResult.matchedRounds.map(r => r.round.name)).toContain("opening");
      expect(protocolResult.activeRound?.name).toBe("response");
    });

    test("wrong actor milestone: opponent 1NT does not satisfy partnerBidMade", () => {
      const partnerOpened1NT = partnerBidMade(1, BidSuit.NoTrump);
      const contextAsOpponent: BiddingContext = {
        hand: hand("SA", "S7", "S4", "S2", "HK", "H7", "H3", "DQ", "D7", "D4", "C8", "C6", "C2"),
        auction: buildAuction(Seat.North, ["1NT"]),
        seat: Seat.East,
        evaluation: evaluateHand(hand("SA", "S7", "S4", "S2", "HK", "H7", "H3", "DQ", "D7", "D4", "C8", "C6", "C2")),
        opponentConventionIds: [],
      };
      const contextAsPartner: BiddingContext = {
        ...contextAsOpponent,
        seat: Seat.South,
      };

      expect(partnerOpened1NT.test(contextAsOpponent)).toBe(false);
      expect(partnerOpened1NT.test(contextAsPartner)).toBe(true);
    });

    test("double modifies system mode but keeps familyId=1nt", () => {
      const state = computeDialogueState(
        buildAuction(Seat.North, ["1NT", "X"]),
        staymanConfig.transitionRules ?? [],
        staymanConfig.baselineRules,
      );

      expect(state.familyId).toBe("1nt");
      expect(state.competitionMode).toBe(CompetitionMode.Doubled);
    });
  });
});

// ─── Phase 4: red-team tests for new behavior (Phases 1-3) ───────────

describe("Phase 4: red-team tests for new behavior", () => {
  // ─── Helpers ─────────────────────────────────────────────────

  const bid1C: Call = { type: "bid", level: 1, strain: BidSuit.Clubs };
  const bid1D: Call = { type: "bid", level: 1, strain: BidSuit.Diamonds };
  const bid1H: Call = { type: "bid", level: 1, strain: BidSuit.Hearts };
  const bid1S: Call = { type: "bid", level: 1, strain: BidSuit.Spades };
  const bid2H: Call = { type: "bid", level: 2, strain: BidSuit.Hearts };
  const passCall: Call = { type: "pass" };

  function makeCandidate(
    overrides: Partial<ResolvedCandidate> & { isMatched: boolean; legal: boolean },
  ): ResolvedCandidate {
    const call: Call = { type: "bid", level: 2, strain: BidSuit.Clubs };
    return {
      bidName: "test-bid",
      nodeId: overrides.bidName ?? "test-bid",
      meaning: "Test",
      call,
      failedConditions: [],
      intent: { type: "Signoff", params: {} },
      source: { conventionId: "test", nodeName: "test-bid" },
      resolvedCall: call,
      isDefaultCall: true,
      ...overrides,
    };
  }

  function makeStrongHand() {
    return hand("SA", "SK", "SQ", "SJ", "HA", "HK", "DA", "D5", "D3", "C5", "C4", "C3", "C2");
  }

  function makeProtocolFor(handTree: ReturnType<typeof intentBid>) {
    return protocol("redteam-test", [
      round("opening", {
        triggers: [semantic(bidMade(1, BidSuit.NoTrump), {})],
        handTree,
        seatFilter: isResponder(),
      }),
    ]);
  }

  // ─── Candidate Provenance (Phase 1) ──────────────────────────

  describe("candidate provenance", () => {
    test("all four provenance origins are set correctly for a convention with overlay hooks", () => {
      // Tree with two branches: strong -> bid1C, weak -> bid1D
      const treeNode = intentBid("tree-node", "Tree node",
        { type: SemanticIntentType.NaturalBid, params: {} },
        () => bid1C);
      const replacementNode = intentBid("replacement-node", "Replacement node",
        { type: SemanticIntentType.NaturalBid, params: {} },
        () => bid1D);

      const overlay: ConventionOverlayPatch = {
        id: "multi-hook-overlay",
        roundName: "opening",
        matches: () => true,
        replacementTree: replacementNode,
        addIntents: () => [{
          intent: { type: SemanticIntentType.NaturalBid, params: {} },
          nodeName: "injected-node",
          meaning: "Injected",
          defaultCall: () => bid1H,
          pathConditions: [],
          priority: "preferred",
        }],
        overrideResolver: (intent) => {
          // Only override the replacement-tree intent
          if (intent.type === SemanticIntentType.NaturalBid) {
            return { status: "resolved", calls: [{ call: bid1S }] };
          }
          return null;
        },
      };

      const config: ConventionConfig = {
        id: "provenance-all-origins",
        name: "Provenance All Origins",
        description: "Tests all provenance origins",
        category: ConventionCategory.Asking,
        dealConstraints: { seats: [] },
        protocol: makeProtocolFor(treeNode),
        overlays: [overlay],
      };
      registerConvention(config);

      const h = makeStrongHand();
      const context: BiddingContext = {
        hand: h,
        auction: buildAuction(Seat.North, ["1NT", "P"]),
        seat: Seat.South,
        evaluation: evaluateHand(h),
        opponentConventionIds: [],
      };

      const protoResult = evaluateProtocol(config.protocol!, context);
      const effective = buildEffectiveContext(context, config, protoResult);
      const { candidates } = generateCandidates(treeNode, protoResult.handResult, effective);

      // The replacement tree replaces the original tree, so candidates come from there.
      // overrideResolver fires on all intents (returns resolved), so matched gets overlay-override.
      // addIntents adds an injected candidate.
      expect(candidates.length).toBeGreaterThanOrEqual(2);

      // The matched candidate from the replacement tree gets overridden by the resolver
      const matched = candidates.find(c => c.isMatched);
      expect(matched).toBeDefined();
      expect(matched!.provenance).toEqual({ origin: "overlay-override", overlayId: "multi-hook-overlay" });

      // The injected candidate
      const injected = candidates.find(c => c.bidName === "injected-node");
      expect(injected).toBeDefined();
      // Injected node also gets overrideResolver applied (it returns non-null for NaturalBid)
      // so it gets overlay-override provenance
      expect(injected!.provenance).toEqual({ origin: "overlay-override", overlayId: "multi-hook-overlay" });
    });

    test("tree candidates without overlay have origin=tree", () => {
      const treeNode = intentBid("plain-tree", "Plain tree",
        { type: SemanticIntentType.NaturalBid, params: {} },
        () => bid1C);
      const config: ConventionConfig = {
        id: "provenance-plain",
        name: "Provenance Plain",
        description: "No overlay",
        category: ConventionCategory.Asking,
        dealConstraints: { seats: [] },
        protocol: makeProtocolFor(treeNode),
      };
      registerConvention(config);

      const h = makeStrongHand();
      const context: BiddingContext = {
        hand: h,
        auction: buildAuction(Seat.North, ["1NT", "P"]),
        seat: Seat.South,
        evaluation: evaluateHand(h),
        opponentConventionIds: [],
      };

      const protoResult = evaluateProtocol(config.protocol!, context);
      const effective = buildEffectiveContext(context, config, protoResult);
      const { candidates } = generateCandidates(treeNode, protoResult.handResult, effective);

      expect(candidates).toHaveLength(1);
      expect(candidates[0]!.provenance).toEqual({ origin: "tree" });
    });
  });

  // ─── Candidate Selection Edge Cases (Phase 1) ────────────────

  describe("candidate selection edge cases", () => {
    test("no-priority + no-matched invariant: returns null (Tier 4)", () => {
      const candidates = [
        makeCandidate({ bidName: "plain-a", isMatched: false, legal: true }),
        makeCandidate({ bidName: "plain-b", isMatched: false, legal: true }),
      ];
      const result = selectMatchedCandidate(candidates);
      expect(result).toBeNull();
    });

    test("PassForcing: only Pass allowed, non-Pass matched is excluded", () => {
      const passCand = makeCandidate({
        bidName: "pass",
        isMatched: false,
        legal: true,
        priority: "preferred",
        resolvedCall: passCall,
      });
      const bidCand = makeCandidate({
        bidName: "bid-matched",
        isMatched: true,
        legal: true,
        resolvedCall: bid2H,
      });

      const result = selectMatchedCandidate(
        [bidCand, passCand],
        undefined,
        ForcingState.PassForcing,
      );
      expect(result).toBe(passCand);
    });

    test("ForcingOneRound: Pass excluded even when matched+legal", () => {
      const passCand = makeCandidate({
        bidName: "pass-forced",
        isMatched: true,
        legal: true,
        resolvedCall: passCall,
      });
      const result = selectMatchedCandidate(
        [passCand],
        undefined,
        ForcingState.ForcingOneRound,
      );
      expect(result).toBeNull();
    });
  });

  // ─── Overlay Edge Cases (Phase 1 provenance) ─────────────────

  describe("overlay edge cases", () => {
    test("competing replacement trees: first by priority wins, provenance records winning overlayId", () => {
      const treeNode = intentBid("original", "Original",
        { type: SemanticIntentType.NaturalBid, params: {} },
        () => bid1C);
      const replA = intentBid("repl-a", "Replacement A",
        { type: SemanticIntentType.NaturalBid, params: {} },
        () => bid1D);
      const replB = intentBid("repl-b", "Replacement B",
        { type: SemanticIntentType.NaturalBid, params: {} },
        () => bid1H);

      const overlayA: ConventionOverlayPatch = {
        id: "overlay-a",
        roundName: "opening",
        priority: 0,
        matches: () => true,
        replacementTree: replA,
      };
      const overlayB: ConventionOverlayPatch = {
        id: "overlay-b",
        roundName: "opening",
        priority: 1,
        matches: () => true,
        replacementTree: replB,
      };

      const config: ConventionConfig = {
        id: "competing-replacement",
        name: "Competing Replacement",
        description: "Two overlays with replacement trees",
        category: ConventionCategory.Asking,
        dealConstraints: { seats: [] },
        protocol: makeProtocolFor(treeNode),
        overlays: [overlayB, overlayA], // intentionally out of order; sorted by priority
      };
      registerConvention(config);

      const h = makeStrongHand();
      const context: BiddingContext = {
        hand: h,
        auction: buildAuction(Seat.North, ["1NT", "P"]),
        seat: Seat.South,
        evaluation: evaluateHand(h),
        opponentConventionIds: [],
      };

      const protoResult = evaluateProtocol(config.protocol!, context);
      const effective = buildEffectiveContext(context, config, protoResult);
      const { candidates } = generateCandidates(treeNode, protoResult.handResult, effective);

      // overlay-a has priority 0 (higher precedence), so its replacement tree wins
      expect(candidates[0]!.bidName).toBe("repl-a");
      expect(candidates[0]!.provenance).toEqual({
        origin: "replacement-tree",
        overlayId: "overlay-a",
      });
    });

    test("suppressIntent hook throws: matched candidate still selected, no crash", () => {
      const bid2C: Call = { type: "bid", level: 2, strain: BidSuit.Clubs };
      const treeNode = intentBid("survive-throw", "Survive throw",
        { type: SemanticIntentType.NaturalBid, params: {} },
        () => bid2C);

      const throwingOverlay: ConventionOverlayPatch = {
        id: "throwing-overlay",
        roundName: "opening",
        matches: () => true,
        suppressIntent: () => { throw new Error("hook exploded"); },
      };

      const config: ConventionConfig = {
        id: "suppress-throw-test",
        name: "Suppress Throw Test",
        description: "Overlay with throwing suppressIntent",
        category: ConventionCategory.Asking,
        dealConstraints: { seats: [] },
        protocol: makeProtocolFor(treeNode),
        overlays: [throwingOverlay],
      };
      registerConvention(config);

      const h = makeStrongHand();
      const context: BiddingContext = {
        hand: h,
        auction: buildAuction(Seat.North, ["1NT", "P"]),
        seat: Seat.South,
        evaluation: evaluateHand(h),
        opponentConventionIds: [],
      };

      const protoResult = evaluateProtocol(config.protocol!, context);
      const effective = buildEffectiveContext(context, config, protoResult);

      // Should NOT throw — graceful degradation
      const overlayErrors: string[] = [];
      const { candidates } = generateCandidates(
        treeNode, protoResult.handResult, effective,
        (overlayId, hook, error) => { overlayErrors.push(`${overlayId}:${hook}:${error}`); },
      );

      // Error was captured via callback
      expect(overlayErrors.length).toBe(1);
      expect(overlayErrors[0]).toContain("throwing-overlay");
      expect(overlayErrors[0]).toContain("suppressIntent");

      // Matched candidate is still present and selected
      const matched = candidates.find(c => c.isMatched);
      expect(matched).toBeDefined();
      const selected = selectMatchedCandidate(candidates);
      expect(selected).toBe(matched);
    });
  });

  // ─── Belief Integration (Phase 2) ────────────────────────────

  describe("belief integration", () => {
    test("missing belief = no ranking effect (candidates unchanged)", () => {
      const ranker = createFitConfidenceRanker();
      const candA = makeCandidate({
        bidName: "cand-a",
        isMatched: false,
        legal: true,
        priority: "preferred",
        resolvedCall: { type: "bid", level: 2, strain: BidSuit.Hearts },
      });
      const candB = makeCandidate({
        bidName: "cand-b",
        isMatched: false,
        legal: true,
        priority: "preferred",
        resolvedCall: { type: "bid", level: 2, strain: BidSuit.Spades },
      });

      const h = makeStrongHand();
      const context: BiddingContext = {
        hand: h,
        auction: buildAuction(Seat.North, ["1NT", "P"]),
        seat: Seat.South,
        evaluation: evaluateHand(h),
        opponentConventionIds: [],
      };

      // Build effective context without publicBelief
      const treeNode = intentBid("dummy", "Dummy",
        { type: SemanticIntentType.NaturalBid, params: {} },
        () => bid1C);
      const protoResult = {
        matched: null,
        matchedRounds: [],
        established: { role: "opener" as const },
        handResult: evaluateTree(treeNode, context),
        activeRound: null,
        handTreeRoot: treeNode,
      };
      const effective = buildEffectiveContext(context, staymanConfig, protoResult);

      // No publicBelief → ranker returns candidates unchanged
      const ranked = ranker([candA, candB], effective);
      expect(ranked[0]!.bidName).toBe("cand-a");
      expect(ranked[1]!.bidName).toBe("cand-b");
    });

    test("ranker reorders within tier only: matched+legal always wins regardless of rank", () => {
      const matchedCand = makeCandidate({
        bidName: "matched-winner",
        isMatched: true,
        legal: true,
        resolvedCall: { type: "bid", level: 2, strain: BidSuit.Clubs },
      });
      const preferredCand = makeCandidate({
        bidName: "preferred-high-score",
        isMatched: false,
        legal: true,
        priority: "preferred",
        resolvedCall: { type: "bid", level: 2, strain: BidSuit.Hearts },
      });

      // Ranker that puts preferred first (reverses order)
      const reverseRanker = (cs: readonly ResolvedCandidate[]) => [...cs].reverse();

      // Even though ranker reverses, Tier 1 (matched+legal) still wins
      const selected = selectMatchedCandidate(
        [preferredCand, matchedCand],
        reverseRanker,
      );
      expect(selected!.bidName).toBe("matched-winner");
    });
  });

  // ─── Frame Stack (Phase 3) ───────────────────────────────────

  describe("frame stack", () => {
    test("relay + continuation frame sequencing: push relay -> pop+push place-contract -> pop = empty", () => {
      registerConvention(lebensohlLiteConfig);

      // Simulate: 1NT - (2D overcall) - 2NT relay - P - 3C completion - P - 3D place
      // Auction: N:1NT  E:2D  S:2NT  W:P  N:3C  E:P  S:3D
      const auction = buildAuction(Seat.North, ["1NT", "2D", "2NT", "P", "3C", "P", "3D"]);

      const state = computeDialogueState(
        auction,
        lebensohlLiteConfig.transitionRules ?? [],
        lebensohlLiteConfig.baselineRules,
      );

      // After full relay sequence completes, frames should be empty
      expect(state.frames).toBeDefined();
      expect(state.frames!.length).toBe(0);
    });

    test("relay frame is pushed and popped correctly at intermediate steps", () => {
      registerConvention(lebensohlLiteConfig);

      // After 2NT relay request: relay frame should be on the stack
      const afterRelay = computeDialogueState(
        buildAuction(Seat.North, ["1NT", "2D", "2NT"]),
        lebensohlLiteConfig.transitionRules ?? [],
        lebensohlLiteConfig.baselineRules,
      );
      expect(afterRelay.frames).toBeDefined();
      expect(afterRelay.frames!.length).toBe(1);
      expect(afterRelay.frames![0]!.kind).toBe("relay");
      expect(afterRelay.forcingState).toBe(ForcingState.ForcingOneRound);

      // After 3C completion: relay popped, place-contract pushed
      const afterComplete = computeDialogueState(
        buildAuction(Seat.North, ["1NT", "2D", "2NT", "P", "3C"]),
        lebensohlLiteConfig.transitionRules ?? [],
        lebensohlLiteConfig.baselineRules,
      );
      expect(afterComplete.frames).toBeDefined();
      expect(afterComplete.frames!.length).toBe(1);
      expect(afterComplete.frames![0]!.kind).toBe("place-contract");
      expect(afterComplete.forcingState).toBe(ForcingState.Nonforcing);
    });

    test("cross-convention isolation: Stayman, Bergen, Weak Twos, SAYC all have empty frames", () => {
      registerConvention(staymanConfig);
      registerConvention(bergenConfig);
      registerConvention(weakTwosConfig);
      registerConvention(saycConfig);

      // Stayman: 1NT - P - 2C - P - 2H
      const staymanState = computeDialogueState(
        buildAuction(Seat.North, ["1NT", "P", "2C", "P", "2H"]),
        staymanConfig.transitionRules ?? [],
        staymanConfig.baselineRules,
      );
      expect(staymanState.frames ?? []).toEqual([]);

      // Bergen: 1H - P - 3C (constructive raise)
      const bergenState = computeDialogueState(
        buildAuction(Seat.North, ["1H", "P", "3C"]),
        bergenConfig.transitionRules ?? [],
        bergenConfig.baselineRules,
      );
      expect(bergenState.frames ?? []).toEqual([]);

      // Weak Twos: 2H - P - 2NT - P - 3C (Ogust response)
      const weakTwoState = computeDialogueState(
        buildAuction(Seat.North, ["2H", "P", "2NT", "P", "3C"]),
        weakTwosConfig.transitionRules ?? [],
        weakTwosConfig.baselineRules,
      );
      expect(weakTwoState.frames ?? []).toEqual([]);

      // SAYC: 1S - P - 2S (simple raise)
      const saycState = computeDialogueState(
        buildAuction(Seat.South, ["1S", "P", "2S"]),
        saycConfig.transitionRules ?? [],
        saycConfig.baselineRules,
      );
      expect(saycState.frames ?? []).toEqual([]);
    });
  });
});
