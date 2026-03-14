/**
 * Synthetic convention fixtures for testing the meaning pipeline.
 *
 * These fixtures exercise the meaning-centric pipeline (surfaces → facts →
 * evaluation → arbitration → machine → profile) WITHOUT depending on any
 * real convention definition. Use these for infrastructure tests that validate
 * pipeline mechanics, not convention-specific bridge semantics.
 *
 * Convention-specific integration tests should import from definitions/ directly.
 *
 * The old tree pipeline (protocol → tree → intent → resolver → candidate → selection)
 * is intentionally excluded — it is being retired.
 */

import { BidSuit, Seat } from "../../../engine/types";
import type { Call, Hand } from "../../../engine/types";
import { evaluateHand } from "../../../engine/hand-evaluator";
import { hand } from "../../../engine/__tests__/fixtures";
import { buildAuction } from "../../../engine/auction-helpers";
import { createBiddingContext } from "../../core/context-factory";
import { ForcingState } from "../../../core/contracts/bidding";

// ── Meaning types ────────────────────────────────────────────
import type { MeaningSurface } from "../../../core/contracts/meaning-surface";
import type {
  MeaningProposal,
  CandidateTransform,
} from "../../../core/contracts/meaning";

// ── Fact types ───────────────────────────────────────────────
import type {
  FactDefinition,
  FactCatalog,
  FactCatalogExtension,
  FactValue,
  EvaluatedFacts,
  FactEvaluatorFn,
} from "../../../core/contracts/fact-catalog";

// ── Module types ─────────────────────────────────────────────
import type { PublicSnapshot } from "../../../core/contracts/module-surface";
import { buildPublicSnapshot } from "../../../core/contracts/module-surface";
import type {
  SystemProfileIR,
  FactConstraintIR,
} from "../../../core/contracts/agreement-module";

// ── Machine types ────────────────────────────────────────────
import type {
  ConversationMachine,
  MachineState,
} from "../../core/runtime/machine-types";

// ── Runtime types ────────────────────────────────────────────
import type { RuntimeModule } from "../../core/runtime/types";

// ── Bundle types ─────────────────────────────────────────────
import type { ConventionBundle } from "../../core/bundle/bundle-types";

// ── Pipeline imports ─────────────────────────────────────────
import { createSharedFactCatalog } from "../../core/pipeline/fact-evaluator";
import type { ArbitrationInput } from "../../core/pipeline/meaning-arbitrator";

// ── Core types (for BiddingContext) ──────────────────────────
import type { BiddingContext } from "../../core/types";
import { ConventionCategory } from "../../core/types";

// ═══════════════════════════════════════════════════════════════
// Calls
// ═══════════════════════════════════════════════════════════════

/** Reusable call constants for tests. */
export const CALLS = {
  bid1NT: { type: "bid", level: 1, strain: BidSuit.NoTrump } as Call,
  bid2C: { type: "bid", level: 2, strain: BidSuit.Clubs } as Call,
  bid2D: { type: "bid", level: 2, strain: BidSuit.Diamonds } as Call,
  bid2H: { type: "bid", level: 2, strain: BidSuit.Hearts } as Call,
  bid2S: { type: "bid", level: 2, strain: BidSuit.Spades } as Call,
  bid2NT: { type: "bid", level: 2, strain: BidSuit.NoTrump } as Call,
  bid3C: { type: "bid", level: 3, strain: BidSuit.Clubs } as Call,
  bid3NT: { type: "bid", level: 3, strain: BidSuit.NoTrump } as Call,
  pass: { type: "pass" } as Call,
  double: { type: "double" } as Call,
} as const;

// ═══════════════════════════════════════════════════════════════
// Hands
// ═══════════════════════════════════════════════════════════════

/** Strong balanced hand: ~16 HCP, 4=4=3=2. */
export const strongHand = () =>
  hand("SA", "SK", "SQ", "S5", "HA", "HK", "HQ", "H3", "DK", "D5", "D2", "C5", "C2");

/** Medium hand: ~10 HCP, 4=3=3=3. */
export const mediumHand = () =>
  hand("SK", "SQ", "S5", "S2", "HK", "H5", "H3", "DQ", "D7", "D2", "C5", "C3", "C2");

/** Weak hand: ~5 HCP, 4=3=3=3. */
export const weakHand = () =>
  hand("SQ", "SJ", "S5", "S2", "H5", "H3", "H2", "DQ", "D7", "D2", "C5", "C3", "C2");

/** Hand with 4 hearts: 10 HCP. For testing major-related surfaces. */
export const fourHeartHand = () =>
  hand("SK", "SQ", "S5", "HA", "HK", "HJ", "H3", "DQ", "D7", "D2", "C5", "C3", "C2");

// ═══════════════════════════════════════════════════════════════
// MeaningSurface Factories
// ═══════════════════════════════════════════════════════════════

let surfaceCounter = 0;

/**
 * Build a MeaningSurface with sensible defaults.
 * Override any field via the overrides parameter.
 */
export function makeSurface(
  overrides: Partial<MeaningSurface> = {},
): MeaningSurface {
  surfaceCounter++;
  return {
    meaningId: `synth:surface-${surfaceCounter}`,
    moduleId: "synth-module",
    encoding: {
      defaultCall: CALLS.bid2C,
    },
    clauses: [],
    ranking: {
      recommendationBand: "should",
      specificity: 1,
      modulePrecedence: 0,
      intraModuleOrder: 0,
    },
    sourceIntent: { type: "synth-intent", params: {} },
    ...overrides,
  };
}

/**
 * Build a MeaningSurface with HCP-gated clauses.
 * The surface is satisfied when hand.hcp >= minHcp.
 */
export function makeHcpSurface(
  minHcp: number,
  call: Call,
  overrides: Partial<MeaningSurface> = {},
): MeaningSurface {
  return makeSurface({
    clauses: [
      {
        clauseId: "hcp-min",
        factId: "hand.hcp",
        operator: "gte",
        value: minHcp,
        description: `${minHcp}+ HCP`,
      },
    ],
    encoding: { defaultCall: call },
    ...overrides,
  });
}

/**
 * Build a MeaningSurface with boolean clause (e.g., hasFourCardMajor).
 */
export function makeBooleanSurface(
  factId: string,
  expectedValue: boolean,
  call: Call,
  overrides: Partial<MeaningSurface> = {},
): MeaningSurface {
  return makeSurface({
    clauses: [
      {
        clauseId: `check-${factId}`,
        factId,
        operator: "boolean",
        value: expectedValue,
        description: `${factId} = ${expectedValue}`,
      },
    ],
    encoding: { defaultCall: call },
    ...overrides,
  });
}

// ═══════════════════════════════════════════════════════════════
// Fact Factories
// ═══════════════════════════════════════════════════════════════

/**
 * Build an EvaluatedFacts from a simple key-value record.
 * Values can be number, boolean, or string.
 */
export function buildFacts(
  entries: Record<string, number | boolean | string>,
): EvaluatedFacts {
  const map = new Map<string, FactValue>();
  for (const [id, value] of Object.entries(entries)) {
    map.set(id, { factId: id, value });
  }
  return { world: "acting-hand", facts: map };
}

/**
 * Build a minimal FactCatalog with custom evaluators.
 * Extends the shared catalog by default.
 */
export function makeSyntheticFactCatalog(
  customFacts?: {
    definitions: readonly FactDefinition[];
    evaluators: ReadonlyMap<string, FactEvaluatorFn>;
  },
): FactCatalog {
  const shared = createSharedFactCatalog();
  if (!customFacts) return shared;

  const mergedDefs = [...shared.definitions, ...customFacts.definitions];
  const mergedEvaluators = new Map([...shared.evaluators, ...customFacts.evaluators]);
  return {
    definitions: mergedDefs,
    evaluators: mergedEvaluators,
    relationalEvaluators: shared.relationalEvaluators,
  };
}

/**
 * Build a FactCatalogExtension with synthetic module-derived facts.
 */
export function makeSyntheticFactExtension(
  facts: { id: string; description: string; evaluator: FactEvaluatorFn }[],
): FactCatalogExtension {
  return {
    definitions: facts.map(f => ({
      id: f.id,
      layer: "module-derived" as const,
      world: "acting-hand" as const,
      description: f.description,
      valueType: "boolean" as const,
    })),
    evaluators: new Map(facts.map(f => [f.id, f.evaluator])),
  };
}

// ═══════════════════════════════════════════════════════════════
// Machine Factories
// ═══════════════════════════════════════════════════════════════

/**
 * Build a minimal ConversationMachine from an array of states.
 */
export function buildMachine(
  states: MachineState[],
  initialStateId: string,
): ConversationMachine {
  const stateMap = new Map<string, MachineState>();
  for (const s of states) {
    stateMap.set(s.stateId, s);
  }
  return {
    machineId: "synth-machine",
    states: stateMap,
    initialStateId,
    seatRole: (_auction, seat, callSeat) => {
      if (seat === callSeat) return "self";
      const samePartnership =
        (seat === Seat.North || seat === Seat.South) ===
        (callSeat === Seat.North || callSeat === Seat.South);
      return samePartnership ? "partner" : "opponent";
    },
  };
}

/**
 * A synthetic 2-state machine:
 *   idle → opened (on 1NT) → responder-action (on any bid)
 * surfaceGroupId is set on each state for surface routing.
 */
export function makeSyntheticMachine(): ConversationMachine {
  const states: MachineState[] = [
    {
      stateId: "idle",
      parentId: null,
      transitions: [
        {
          transitionId: "detect-1nt",
          match: { kind: "call", level: 1, strain: BidSuit.NoTrump },
          target: "opened",
          effects: {
            setForcingState: ForcingState.ForcingOneRound,
            setCaptain: "responder",
          },
        },
      ],
    },
    {
      stateId: "opened",
      parentId: null,
      surfaceGroupId: "responder-r1",
      transitions: [
        {
          transitionId: "opponent-action",
          match: { kind: "opponent-action", callType: "bid" },
          target: "contested",
          effects: { setCompetitionMode: "contested" },
        },
        {
          transitionId: "opponent-double",
          match: { kind: "opponent-action", callType: "double" },
          target: "contested",
          effects: { setCompetitionMode: "doubled" },
        },
        {
          transitionId: "responder-bids",
          match: { kind: "any-bid" },
          target: "terminal",
        },
        {
          transitionId: "responder-passes",
          match: { kind: "pass" },
          target: "terminal",
        },
      ],
    },
    {
      stateId: "contested",
      parentId: null,
      surfaceGroupId: "responder-contested",
      transitions: [
        {
          transitionId: "contested-bid",
          match: { kind: "any-bid" },
          target: "terminal",
        },
      ],
    },
    {
      stateId: "terminal",
      parentId: null,
      transitions: [],
    },
  ];
  return buildMachine(states, "idle");
}

// ═══════════════════════════════════════════════════════════════
// Profile Factories
// ═══════════════════════════════════════════════════════════════

/**
 * Build a minimal SystemProfileIR with synthetic modules.
 */
export function makeSyntheticProfile(
  overrides: Partial<SystemProfileIR> = {},
): SystemProfileIR {
  return {
    profileId: "synth-profile",
    baseSystem: "synth-system",
    modules: [
      {
        moduleId: "synth-base",
        kind: "base-system",
        attachments: [{ requiresCapabilities: [] }],
      },
      {
        moduleId: "synth-addon",
        kind: "add-on",
        attachments: [{ requiresCapabilities: ["synthing"] }],
      },
    ],
    conflictPolicy: { activationDefault: "simultaneous" },
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// PublicSnapshot Factories
// ═══════════════════════════════════════════════════════════════

/**
 * Build a minimal PublicSnapshot with defaults for all required fields.
 */
export function makeSnapshot(
  overrides: Partial<PublicSnapshot> = {},
): PublicSnapshot {
  return buildPublicSnapshot({
    activeModuleIds: ["synth-base"],
    forcingState: ForcingState.Nonforcing,
    obligation: { kind: "none", obligatedSide: "opener" },
    agreedStrain: { type: "none" },
    competitionMode: "uncontested",
    captain: "neither",
    ...overrides,
  });
}

// ═══════════════════════════════════════════════════════════════
// RuntimeModule Factories
// ═══════════════════════════════════════════════════════════════

/**
 * Build a minimal RuntimeModule that emits the given surfaces.
 */
export function makeRuntimeModule(
  id: string,
  surfaces: readonly MeaningSurface[] = [],
  overrides: Partial<RuntimeModule> = {},
): RuntimeModule {
  return {
    id,
    capabilities: [],
    isActive: () => true,
    emitSurfaces: () => surfaces,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// Bundle Factories
// ═══════════════════════════════════════════════════════════════

/**
 * Build a minimal ConventionBundle with synthetic surfaces and machine.
 */
export function makeSyntheticBundle(
  overrides: Partial<ConventionBundle> = {},
): ConventionBundle {
  const askSurface = makeHcpSurface(8, CALLS.bid2C, {
    meaningId: "synth:ask",
    moduleId: "synth-asking",
    ranking: { recommendationBand: "should", specificity: 2, modulePrecedence: 0, intraModuleOrder: 0 },
    sourceIntent: { type: "ask-intent", params: {} },
  });
  const signoffSurface = makeSurface({
    meaningId: "synth:signoff",
    moduleId: "synth-natural",
    encoding: { defaultCall: CALLS.bid3NT },
    clauses: [
      { clauseId: "hcp-game", factId: "hand.hcp", operator: "gte", value: 10, description: "10+ HCP" },
      { clauseId: "balanced", factId: "hand.isBalanced", operator: "boolean", value: true, description: "Balanced" },
    ],
    ranking: { recommendationBand: "should", specificity: 1, modulePrecedence: 1, intraModuleOrder: 0 },
    sourceIntent: { type: "signoff-intent", params: {} },
  });

  return {
    id: "synth-bundle",
    name: "Synthetic Bundle",
    memberIds: ["synth-asking", "synth-natural"],
    dealConstraints: { seats: [] },
    activationFilter: () => ["synth-asking", "synth-natural"],
    meaningSurfaces: [
      { groupId: "responder-r1", surfaces: [askSurface, signoffSurface] },
    ],
    category: ConventionCategory.Asking,
    description: "Synthetic test bundle",
    conversationMachine: makeSyntheticMachine(),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// ArbitrationInput Factories
// ═══════════════════════════════════════════════════════════════

/**
 * Build an ArbitrationInput from a proposal + surface encoding.
 */
export function makeArbitrationInput(
  overrides: Partial<ArbitrationInput> & { allSatisfied?: boolean } = {},
): ArbitrationInput {
  const { allSatisfied = true, ...rest } = overrides;
  const proposal: MeaningProposal = overrides.proposal ?? {
    meaningId: "synth:test",
    moduleId: "synth-module",
    clauses: [
      {
        factId: "hand.hcp",
        operator: "gte",
        value: 8,
        satisfied: allSatisfied,
        description: "8+ HCP",
      },
    ],
    ranking: {
      recommendationBand: "should",
      specificity: 1,
      modulePrecedence: 0,
      intraModuleOrder: 0,
    },
    evidence: {
      factDependencies: ["hand.hcp"],
      evaluatedConditions: [{ name: "hcp", passed: allSatisfied, description: "8+ HCP" }],
      provenance: { moduleId: "synth-module", nodeName: "synth-test", origin: "tree" },
    },
    sourceIntent: { type: "synth-intent", params: {} },
  };

  return {
    proposal,
    surface: { encoding: { defaultCall: CALLS.bid2C } },
    ...rest,
  };
}

// ═══════════════════════════════════════════════════════════════
// Transform Factories
// ═══════════════════════════════════════════════════════════════

/**
 * Build a suppress transform targeting a meaningId.
 */
export function makeSuppressTransform(
  targetMeaningId: string,
  sourceModuleId = "synth-module",
): CandidateTransform {
  return {
    transformId: `suppress-${targetMeaningId}`,
    kind: "suppress",
    targetId: targetMeaningId,
    sourceModuleId,
    reason: `Suppressed ${targetMeaningId} in test`,
  };
}

/**
 * Build an inject transform with a new surface.
 */
export function makeInjectTransform(
  surface: MeaningSurface,
  sourceModuleId = "synth-module",
): CandidateTransform {
  return {
    transformId: `inject-${surface.meaningId}`,
    kind: "inject",
    targetId: surface.meaningId,
    sourceModuleId,
    reason: `Injected ${surface.meaningId} in test`,
    surface,
  };
}

// ═══════════════════════════════════════════════════════════════
// PublicConsequences / Commitment Factories
// ═══════════════════════════════════════════════════════════════

/**
 * Build a surface with publicConsequences for commitment extraction testing.
 */
export function makeSurfaceWithCommitments(
  meaningId: string,
  promises: FactConstraintIR[],
  overrides: Partial<MeaningSurface> = {},
): MeaningSurface {
  return makeSurface({
    meaningId,
    publicConsequences: { promises },
    ...overrides,
  });
}

// ═══════════════════════════════════════════════════════════════
// BiddingContext Factories
// ═══════════════════════════════════════════════════════════════

/**
 * Create a BiddingContext for meaning pipeline tests.
 * Defaults: South seat, North opens 1NT, P, South to bid.
 */
export function makeSyntheticContext(
  overrides?: {
    hand?: () => Hand;
    bids?: string[];
    seat?: Seat;
    dealer?: Seat;
  },
): BiddingContext {
  const h = (overrides?.hand ?? mediumHand)();
  return createBiddingContext({
    hand: h,
    auction: buildAuction(overrides?.dealer ?? Seat.North, overrides?.bids ?? ["1NT", "P"]),
    seat: overrides?.seat ?? Seat.South,
    evaluation: evaluateHand(h),
  });
}

/**
 * Create a context with opponent interference (double after 1NT).
 */
export function makeSyntheticInterferenceContext(): BiddingContext {
  const h = mediumHand();
  return createBiddingContext({
    hand: h,
    auction: buildAuction(Seat.North, ["1NT", "X"]),
    seat: Seat.South,
    evaluation: evaluateHand(h),
  });
}
