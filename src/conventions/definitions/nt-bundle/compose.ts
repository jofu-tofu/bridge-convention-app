import type { MeaningSurface } from "../../../core/contracts/meaning-surface";
import type { Auction, Seat } from "../../../engine/types";
import { BidSuit } from "../../../engine/types";
import type {
  ConversationMachine,
  MachineState,
  MachineTransition,
} from "../../core/runtime/machine-types";
import { buildConversationMachine } from "../../core/runtime/machine-types";
import { evaluateMachine } from "../../core/runtime/machine-evaluator";
import type { FactCatalogExtension } from "../../../core/contracts/fact-catalog";
import {
  createExplanationCatalog,
  type ExplanationCatalogIR,
} from "../../../core/contracts/explanation-catalog";
import type { PedagogicalRelation } from "../../../core/contracts/pedagogical-relations";
import type { RoutedSurfaceGroup } from "../../core/bundle/bundle-types";
import type { NtConventionModule } from "./modules/module-types";

export interface ComposedNtResult {
  readonly r1Surfaces: readonly MeaningSurface[];
  readonly surfaceGroups: readonly {
    readonly groupId: string;
    readonly surfaces: readonly MeaningSurface[];
  }[];
  readonly conversationMachine: ConversationMachine;
  readonly factExtensions: readonly FactCatalogExtension[];
  readonly explanationCatalog: ExplanationCatalogIR;
  readonly pedagogicalRelations: readonly PedagogicalRelation[];
  readonly surfaceRouter: (auction: Auction, seat: Seat) => readonly MeaningSurface[];
}

/**
 * Compose NtConventionModules bottom-up into a complete bundle.
 *
 * Handles:
 * - Merging R1 surfaces from all modules
 * - Merging surface groups (same groupId = concatenated)
 * - Building the shared FSM (idle, nt-opened, responder-r1, terminal, nt-contested)
 * - Composing R1 transitions from all modules
 * - Applying hookTransitions (prepend to target state's transitions)
 * - Collecting submachines
 * - Collecting fact extensions
 * - Building explanation catalog from all module entries
 * - Merging pedagogical relations (intra-module + cross-module)
 * - Building surface router
 */
export function composeNtModules(
  modules: readonly NtConventionModule[],
  crossModuleRelations: readonly PedagogicalRelation[] = [],
): ComposedNtResult {
  // ── 1. Merge R1 surfaces ────────────────────────────────────
  const r1Surfaces: MeaningSurface[] = [];
  for (const m of modules) {
    r1Surfaces.push(...m.r1Surfaces);
  }

  // ── 2. Merge surface groups ─────────────────────────────────
  const groupMap = new Map<string, MeaningSurface[]>();
  for (const m of modules) {
    for (const g of m.surfaceGroups) {
      const existing = groupMap.get(g.groupId);
      if (existing) {
        existing.push(...g.surfaces);
      } else {
        groupMap.set(g.groupId, [...g.surfaces]);
      }
    }
  }
  const surfaceGroups = [...groupMap.entries()].map(([groupId, surfaces]) => ({
    groupId,
    surfaces: surfaces as readonly MeaningSurface[],
  }));

  // ── 3. Compose R1 transitions ───────────────────────────────
  const r1Transitions: MachineTransition[] = [];
  for (const m of modules) {
    r1Transitions.push(...m.r1Transitions);
  }

  // ── 4. Collect module machine states ────────────────────────
  const moduleStates: MachineState[] = [];
  for (const m of modules) {
    moduleStates.push(...m.machineStates);
  }

  // ── 5. Apply hookTransitions ────────────────────────────────
  const hookMap = new Map<string, MachineTransition[]>();
  for (const m of modules) {
    if (m.hookTransitions) {
      for (const hook of m.hookTransitions) {
        const existing = hookMap.get(hook.targetStateId);
        if (existing) {
          existing.push(...hook.transitions);
        } else {
          hookMap.set(hook.targetStateId, [...hook.transitions]);
        }
      }
    }
  }

  // Apply hooks by prepending transitions to target states
  const finalStates: MachineState[] = moduleStates.map((state) => {
    const hooks = hookMap.get(state.stateId);
    if (hooks) {
      return {
        ...state,
        transitions: [...hooks, ...state.transitions],
      };
    }
    return state;
  });

  // ── 6. Build shared FSM infrastructure ──────────────────────
  const idleState: MachineState = {
    stateId: "idle",
    parentId: null,
    transitions: [
      {
        transitionId: "idle-to-nt-opened",
        match: { kind: "call", level: 1, strain: BidSuit.NoTrump },
        target: "nt-opened",
      },
    ],
    surfaceGroupId: "opener-1nt",
  };

  const ntOpenedState: MachineState = {
    stateId: "nt-opened",
    parentId: null,
    transitions: [
      {
        transitionId: "nt-opened-opponent-double",
        match: { kind: "opponent-action", callType: "double" },
        target: "nt-contested",
      },
      {
        transitionId: "nt-opened-pass",
        match: { kind: "pass" },
        target: "responder-r1",
      },
    ],
  };

  const responderR1State: MachineState = {
    stateId: "responder-r1",
    parentId: "nt-opened",
    transitions: r1Transitions,
    surfaceGroupId: "responder-r1",
    entryEffects: {
      setCaptain: "responder",
    },
  };

  const terminalState: MachineState = {
    stateId: "terminal",
    parentId: "nt-opened",
    transitions: [],
  };

  const ntContestedState: MachineState = {
    stateId: "nt-contested",
    parentId: "nt-opened",
    transitions: [],
    entryEffects: {
      setCompetitionMode: "Doubled",
    },
  };

  const allStates: MachineState[] = [
    idleState,
    ntOpenedState,
    responderR1State,
    ...finalStates,
    terminalState,
    ntContestedState,
  ];

  const conversationMachine = buildConversationMachine("nt-conversation", allStates);

  // ── 7. Collect submachines ──────────────────────────────────
  const submachines = new Map<string, ConversationMachine>();
  for (const m of modules) {
    if (m.submachines) {
      for (const [id, sub] of m.submachines) {
        submachines.set(id, sub);
      }
    }
  }

  // ── 8. Collect fact extensions ──────────────────────────────
  const factExtensions: FactCatalogExtension[] = [];
  for (const m of modules) {
    factExtensions.push(m.facts);
  }

  // ── 9. Build explanation catalog ────────────────────────────
  const allEntries = modules.flatMap((m) => m.explanationEntries);
  const explanationCatalog = createExplanationCatalog(allEntries);

  // ── 10. Merge pedagogical relations ─────────────────────────
  const pedagogicalRelations: PedagogicalRelation[] = [];
  for (const m of modules) {
    pedagogicalRelations.push(...m.pedagogicalRelations);
  }
  pedagogicalRelations.push(...crossModuleRelations);

  // ── 11. Build routed surfaces & router ──────────────────────
  const routedGroups: RoutedSurfaceGroup[] = [
    { groupId: "opener-1nt", surfaces: groupMap.get("opener-1nt") ?? [] },
    { groupId: "responder-r1", surfaces: r1Surfaces },
    ...surfaceGroups.filter((g) => g.groupId !== "opener-1nt"),
  ];

  const routeMap = new Map<string, readonly MeaningSurface[]>();
  for (const group of routedGroups) {
    routeMap.set(group.groupId, group.surfaces);
  }

  const surfaceRouter = (auction: Auction, seat: Seat): readonly MeaningSurface[] => {
    const result = evaluateMachine(conversationMachine, auction, seat, submachines);
    const activeSurfaces: MeaningSurface[] = [];
    for (const groupId of result.activeSurfaceGroupIds) {
      const surfaces = routeMap.get(groupId);
      if (surfaces) activeSurfaces.push(...surfaces);
    }
    return activeSurfaces;
  };

  return {
    r1Surfaces,
    surfaceGroups,
    conversationMachine,
    factExtensions,
    explanationCatalog,
    pedagogicalRelations,
    surfaceRouter,
  };
}
