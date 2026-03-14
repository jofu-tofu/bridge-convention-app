/**
 * Smoke test for synthetic fixtures — verifies the fixtures compile,
 * produce valid structures, and exercise the meaning pipeline.
 */
import { describe, test, expect } from "vitest";
import { Seat } from "../../../engine/types";
import { evaluateHand } from "../../../engine/hand-evaluator";
import { evaluateMeaningSurface, evaluateAllSurfaces } from "../../core/pipeline/meaning-evaluator";
import { arbitrateMeanings, zipProposalsWithSurfaces } from "../../core/pipeline/meaning-arbitrator";
import { composeSurfaces } from "../../core/pipeline/surface-composer";
import { evaluateFacts } from "../../core/pipeline/fact-evaluator";
import { evaluateMachine } from "../../core/runtime/machine-evaluator";
import { buildAuction } from "../../../engine/auction-helpers";

import {
  CALLS,
  strongHand,
  mediumHand,
  weakHand,
  fourHeartHand,
  makeSurface,
  makeHcpSurface,
  makeBooleanSurface,
  buildFacts,
  makeSyntheticFactCatalog,
  makeSyntheticFactExtension,
  buildMachine,
  makeSyntheticMachine,
  makeSyntheticProfile,
  makeSnapshot,
  makeRuntimeModule,
  makeSyntheticBundle,
  makeArbitrationInput,
  makeSuppressTransform,
  makeInjectTransform,
  makeSyntheticContext,
  makeSyntheticInterferenceContext,
} from "./_synthetic-fixtures";

describe("synthetic fixtures smoke tests", () => {
  describe("surface factories", () => {
    test("makeSurface produces valid MeaningSurface", () => {
      const s = makeSurface();
      expect(s.meaningId).toContain("synth:");
      expect(s.moduleId).toBe("synth-module");
      expect(s.encoding.defaultCall).toBeDefined();
      expect(s.ranking.recommendationBand).toBe("should");
    });

    test("makeHcpSurface creates surface with HCP clause", () => {
      const s = makeHcpSurface(8, CALLS.bid2C);
      expect(s.clauses).toHaveLength(1);
      expect(s.clauses[0]!.factId).toBe("hand.hcp");
      expect(s.clauses[0]!.operator).toBe("gte");
      expect(s.clauses[0]!.value).toBe(8);
    });

    test("makeBooleanSurface creates surface with boolean clause", () => {
      const s = makeBooleanSurface("bridge.hasFourCardMajor", true, CALLS.bid2C);
      expect(s.clauses).toHaveLength(1);
      expect(s.clauses[0]!.operator).toBe("boolean");
    });

    test("unique meaningIds across calls", () => {
      const s1 = makeSurface();
      const s2 = makeSurface();
      expect(s1.meaningId).not.toBe(s2.meaningId);
    });
  });

  describe("fact factories", () => {
    test("buildFacts creates evaluable facts map", () => {
      const facts = buildFacts({ "hand.hcp": 15, "hand.isBalanced": true });
      expect(facts.world).toBe("acting-hand");
      expect(facts.facts.get("hand.hcp")!.value).toBe(15);
      expect(facts.facts.get("hand.isBalanced")!.value).toBe(true);
    });

    test("makeSyntheticFactCatalog extends shared catalog", () => {
      const catalog = makeSyntheticFactCatalog();
      expect(catalog.definitions.length).toBeGreaterThan(0);
      expect(catalog.evaluators.size).toBeGreaterThan(0);
    });

    test("makeSyntheticFactExtension creates module-derived facts", () => {
      const ext = makeSyntheticFactExtension([
        { id: "synth.custom", description: "Test fact", evaluator: () => ({ factId: "synth.custom", value: true }) },
      ]);
      expect(ext.definitions).toHaveLength(1);
      expect(ext.evaluators.size).toBe(1);
    });
  });

  describe("meaning evaluation pipeline", () => {
    test("evaluateMeaningSurface with synthetic surface + facts", () => {
      const surface = makeHcpSurface(8, CALLS.bid2C);
      const facts = buildFacts({ "hand.hcp": 10 });
      const proposal = evaluateMeaningSurface(surface, facts);
      expect(proposal.clauses[0]!.satisfied).toBe(true);
      expect(proposal.meaningId).toBe(surface.meaningId);
    });

    test("surface not satisfied when fact below threshold", () => {
      const surface = makeHcpSurface(12, CALLS.bid3NT);
      const facts = buildFacts({ "hand.hcp": 8 });
      const proposal = evaluateMeaningSurface(surface, facts);
      expect(proposal.clauses[0]!.satisfied).toBe(false);
    });

    test("evaluateAllSurfaces + arbitrateMeanings end-to-end", () => {
      const surfaces = [
        makeHcpSurface(12, CALLS.bid3NT, { meaningId: "strong", ranking: { recommendationBand: "should", specificity: 2, modulePrecedence: 0, intraModuleOrder: 0 } }),
        makeHcpSurface(8, CALLS.bid2C, { meaningId: "medium", ranking: { recommendationBand: "should", specificity: 1, modulePrecedence: 0, intraModuleOrder: 1 } }),
      ];
      const facts = buildFacts({ "hand.hcp": 15 });
      const proposals = evaluateAllSurfaces(surfaces, facts);
      expect(proposals).toHaveLength(2);

      const inputs = zipProposalsWithSurfaces(proposals, surfaces);
      const result = arbitrateMeanings(inputs);
      expect(result.selected).not.toBeNull();
      // Higher specificity surface should win when both satisfied
      expect(result.truthSet.length).toBe(2);
    });
  });

  describe("surface composition", () => {
    test("suppress transform removes surface", () => {
      const s1 = makeSurface({ meaningId: "keep" });
      const s2 = makeSurface({ meaningId: "remove" });
      const transform = makeSuppressTransform("remove");
      const { composedSurfaces } = composeSurfaces([s1, s2], [transform]);
      expect(composedSurfaces).toHaveLength(1);
      expect(composedSurfaces[0]!.meaningId).toBe("keep");
    });

    test("inject transform adds surface", () => {
      const s1 = makeSurface({ meaningId: "original" });
      const injected = makeSurface({ meaningId: "injected" });
      const transform = makeInjectTransform(injected);
      const { composedSurfaces } = composeSurfaces([s1], [transform]);
      expect(composedSurfaces).toHaveLength(2);
    });
  });

  describe("machine factories", () => {
    test("buildMachine creates valid machine", () => {
      const m = buildMachine([
        { stateId: "a", parentId: null, transitions: [{ transitionId: "t1", match: { kind: "pass" }, target: "b" }] },
        { stateId: "b", parentId: null, transitions: [] },
      ], "a");
      expect(m.machineId).toBe("synth-machine");
      expect(m.states.size).toBe(2);
    });

    test("makeSyntheticMachine creates multi-state machine", () => {
      const m = makeSyntheticMachine();
      expect(m.states.size).toBe(4); // idle, opened, contested, terminal
      expect(m.initialStateId).toBe("idle");
    });

    test("evaluateMachine transitions on 1NT opening", () => {
      const m = makeSyntheticMachine();
      // Only 1NT — no pass, so machine stays in 'opened' state
      const auction = buildAuction(Seat.North, ["1NT"]);
      const result = evaluateMachine(m, auction, Seat.South);
      expect(result.context.currentStateId).toBe("opened");
      expect(result.activeSurfaceGroupIds).toContain("responder-r1");
    });
  });

  describe("profile factories", () => {
    test("makeSyntheticProfile produces valid profile", () => {
      const p = makeSyntheticProfile();
      expect(p.profileId).toBe("synth-profile");
      expect(p.modules).toHaveLength(2);
    });
  });

  describe("snapshot factories", () => {
    test("makeSnapshot produces valid snapshot", () => {
      const s = makeSnapshot();
      expect(s.forcingState).toBeDefined();
      expect(s.activeModuleIds).toContain("synth-base");
    });
  });

  describe("runtime module factories", () => {
    test("makeRuntimeModule produces active module", () => {
      const surface = makeSurface();
      const m = makeRuntimeModule("test-mod", [surface]);
      expect(m.id).toBe("test-mod");
      expect(m.isActive({} as never, {} as never)).toBe(true);
      expect(m.emitSurfaces({} as never, {} as never, {} as never)).toHaveLength(1);
    });
  });

  describe("bundle factories", () => {
    test("makeSyntheticBundle produces complete bundle", () => {
      const b = makeSyntheticBundle();
      expect(b.id).toBe("synth-bundle");
      expect(b.meaningSurfaces).toBeDefined();
      expect(b.meaningSurfaces!.length).toBeGreaterThan(0);
      expect(b.conversationMachine).toBeDefined();
    });
  });

  describe("arbitration input factories", () => {
    test("makeArbitrationInput produces valid input", () => {
      const input = makeArbitrationInput();
      expect(input.proposal.meaningId).toBe("synth:test");
      expect(input.surface.encoding.defaultCall).toBeDefined();
    });

    test("allSatisfied flag controls clause satisfaction", () => {
      const satisfied = makeArbitrationInput({ allSatisfied: true });
      const unsatisfied = makeArbitrationInput({ allSatisfied: false });
      expect(satisfied.proposal.clauses[0]!.satisfied).toBe(true);
      expect(unsatisfied.proposal.clauses[0]!.satisfied).toBe(false);
    });
  });

  describe("context factories", () => {
    test("makeSyntheticContext produces valid context", () => {
      const ctx = makeSyntheticContext();
      expect(ctx.seat).toBe(Seat.South);
      expect(ctx.auction.entries.length).toBe(2); // 1NT, P
    });

    test("makeSyntheticInterferenceContext has double in auction", () => {
      const ctx = makeSyntheticInterferenceContext();
      expect(ctx.auction.entries.some(e => e.call.type === "double")).toBe(true);
    });
  });

  describe("hands produce valid 13-card hands", () => {
    test("all hands have 13 cards", () => {
      expect(strongHand().cards).toHaveLength(13);
      expect(mediumHand().cards).toHaveLength(13);
      expect(weakHand().cards).toHaveLength(13);
      expect(fourHeartHand().cards).toHaveLength(13);
    });
  });

  describe("end-to-end: facts from real hand → surface evaluation → arbitration", () => {
    test("evaluateFacts + evaluateAllSurfaces + arbitrateMeanings", () => {
      const h = mediumHand();
      const catalog = makeSyntheticFactCatalog();
      const facts = evaluateFacts(h, evaluateHand(h), catalog);

      const surfaces = [
        makeHcpSurface(12, CALLS.bid3NT, { meaningId: "game" }),
        makeHcpSurface(8, CALLS.bid2C, { meaningId: "invite" }),
        makeHcpSurface(0, CALLS.pass, { meaningId: "pass" }),
      ];
      const proposals = evaluateAllSurfaces(surfaces, facts);
      const inputs = zipProposalsWithSurfaces(proposals, surfaces);
      const result = arbitrateMeanings(inputs);

      // With ~10 HCP, game (12+) should fail, invite (8+) and pass (0+) should be in truthSet
      expect(result.selected).not.toBeNull();
      expect(result.truthSet.length).toBe(2); // invite + pass
    });
  });
});
