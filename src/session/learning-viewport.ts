/**
 * Learning viewport builder — projects convention bundle and module internals
 * into viewport response types for UI consumption.
 *
 * Lives in session/ because it reads from conventions/ (ConventionBundle,
 * ConventionModule) and writes to service response types. The UI never
 * imports this file — it calls service methods.
 */

import type { Call } from "../engine/types";
import type { ConventionModule, LocalFsm, ExplanationEntry, BidMeaningClause, SystemConfig, ObsPattern, RouteExpr } from "../conventions";
import {
  moduleSurfaces, getModule, getAllModules, listBundleInputs,
  getBundleInput, AVAILABLE_BASE_SYSTEMS, deriveNeutralDescription,
} from "../conventions";
import { getSystemConfig } from "../conventions/definitions/system-config";
import { callKey } from "../engine/call-helpers";
import { formatCall, formatBidReferences } from "../service/display/format";
import type {
  ModuleCatalogEntry,
  ModuleLearningViewport,
  PhaseGroupView,
  SurfaceDetailView,
  SurfaceClauseView,
  ClauseSystemVariant,
  FlowTreeNode,
  BundleFlowTreeViewport,
} from "../service/response-types";

/** Known bridge abbreviations that should be fully uppercased. */
const BRIDGE_ABBREVIATIONS = new Set(["nt", "sayc", "hcp"]);

/** Convert kebab-case module ID to display name. */
export function formatModuleName(moduleId: string): string {
  if (moduleId === "") return "";
  return moduleId
    .split("-")
    .map((w) => {
      const lower = w.toLowerCase();
      if (BRIDGE_ABBREVIATIONS.has(lower)) return w.toUpperCase();
      const match = lower.match(/^(\d+)(.+)$/);
      if (match && BRIDGE_ABBREVIATIONS.has(match[2]!)) {
        return match[1] + match[2]!.toUpperCase();
      }
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

// ── Module-centric viewport ──────────────────────────────────────────

// ── System-fact clause helpers ───────────────────────────────────────

/** All system configs, paired with short UI labels. */
const ALL_SYSTEMS: readonly { sys: SystemConfig; label: string }[] =
  AVAILABLE_BASE_SYSTEMS.map((meta) => ({
    sys: getSystemConfig(meta.id),
    label: meta.shortLabel,
  }));

/**
 * Describe what a system-derived fact concretely means for a given SystemConfig.
 * Returns the human-readable threshold/value, or null for unrecognized facts.
 */
function describeSystemFactValue(factId: string, sys: SystemConfig): string | null {
  switch (factId) {
    case "system.responder.weakHand":
      return `< ${sys.responderThresholds.inviteMin} HCP`;
    case "system.responder.inviteValues":
      return `${sys.responderThresholds.inviteMin}\u2013${sys.responderThresholds.inviteMax} HCP`;
    case "system.responder.gameValues":
      return `${sys.responderThresholds.gameMin}+ HCP`;
    case "system.responder.slamValues":
      return `${sys.responderThresholds.slamMin}+ HCP`;
    case "system.opener.notMinimum":
      return `${sys.openerRebid.notMinimum}+ HCP`;
    case "system.responder.twoLevelNewSuit":
      return `${sys.suitResponse.twoLevelMin}+ HCP`;
    case "system.suitResponse.isGameForcing":
      return sys.suitResponse.twoLevelForcingDuration === "game" ? "Game-forcing" : "One-round forcing";
    case "system.oneNtResponseAfterMajor.forcing":
      return `1NT is ${sys.oneNtResponseAfterMajor.forcing}`;
    case "system.responder.oneNtRange":
      return `${sys.oneNtResponseAfterMajor.minHcp}\u2013${sys.oneNtResponseAfterMajor.maxHcp} HCP`;
    case "system.dontOvercall.inRange":
      return `${sys.dontOvercall.minHcp}\u2013${sys.dontOvercall.maxHcp} HCP`;
    default:
      return null;
  }
}

/** Build system variants for a system.* fact — one entry per known base system. */
function buildSystemVariants(factId: string): readonly ClauseSystemVariant[] {
  return ALL_SYSTEMS.map(({ sys, label }) => ({
    systemLabel: label,
    description: describeSystemFactValue(factId, sys) ?? factId,
  }));
}

/** Read the description runtime-property from a BidMeaningClause (set by createSurface). */
function readClauseDescription(c: BidMeaningClause): string {
  return (c as BidMeaningClause & { description?: string }).description
    ?? `${c.factId} ${c.operator} ${JSON.stringify(c.value)}`;
}

// ── Module catalog ──────────────────────────────────────────────────

/** Build module catalog entries for all registered modules. */
export function buildModuleCatalog(): readonly ModuleCatalogEntry[] {
  const allModules = getAllModules();
  const bundleInputs = listBundleInputs();

  // Build reverse map: moduleId → bundleIds that contain it
  const moduleBundles = new Map<string, string[]>();
  for (const input of bundleInputs) {
    for (const memberId of input.memberIds) {
      const existing = moduleBundles.get(memberId);
      if (existing) existing.push(input.id);
      else moduleBundles.set(memberId, [input.id]);
    }
  }

  return allModules.map((mod) => ({
    moduleId: mod.moduleId,
    displayName: formatModuleName(mod.moduleId),
    description: formatBidReferences(mod.description),
    purpose: formatBidReferences(mod.purpose),
    surfaceCount: moduleSurfaces(mod).length,
    bundleIds: moduleBundles.get(mod.moduleId) ?? [],
  }));
}

/** Build a full learning viewport for a single module. */
export function buildModuleLearningViewport(moduleId: string): ModuleLearningViewport | null {
  const mod = getModule(moduleId);
  if (!mod) return null;

  const bundleInputs = listBundleInputs();
  const bundleIds = bundleInputs
    .filter((b) => b.memberIds.includes(moduleId))
    .map((b) => b.id);

  const teaching = mod.teaching;
  const phases = buildPhaseGroups(mod);

  return {
    moduleId: mod.moduleId,
    displayName: formatModuleName(mod.moduleId),
    description: formatBidReferences(mod.description),
    purpose: formatBidReferences(mod.purpose),
    teaching: {
      tradeoff: teaching?.tradeoff ? formatBidReferences(teaching.tradeoff) : null,
      principle: teaching?.principle ? formatBidReferences(teaching.principle) : null,
      commonMistakes: (teaching?.commonMistakes ?? []).map(formatBidReferences),
    },
    phases,
    bundleIds,
  };
}

// ── Phase grouping ──────────────────────────────────────────────────

/**
 * Derive topological phase order from LocalFsm transitions.
 * Walks from initial state through transitions to produce ordered phases.
 */
export function derivePhaseOrder(fsm: LocalFsm): string[] {
  const phases: string[] = [fsm.initial];
  const seen = new Set<string>([fsm.initial]);

  // BFS from initial following transition edges
  const adjacency = new Map<string, string[]>();
  for (const t of fsm.transitions) {
    const froms: readonly string[] = Array.isArray(t.from) ? t.from : [t.from];
    for (const f of froms) {
      const existing = adjacency.get(f);
      if (existing) {
        if (!existing.includes(t.to)) existing.push(t.to);
      } else {
        adjacency.set(f, [t.to]);
      }
    }
  }

  const queue = [fsm.initial];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adjacency.get(current) ?? [];
    for (const next of neighbors) {
      if (!seen.has(next)) {
        seen.add(next);
        phases.push(next);
        queue.push(next);
      }
    }
  }

  return phases;
}

/** Format a phase string for display. "asked" → "Asked", "shown-hearts" → "Shown Hearts". */
function formatPhaseDisplay(phase: string, turn: string | null): string {
  const phaseTitle = formatModuleName(phase);
  if (turn) {
    const turnTitle = turn.charAt(0).toUpperCase() + turn.slice(1);
    return `${phaseTitle} — ${turnTitle}`;
  }
  return phaseTitle;
}

/** Find explanation text for a meaningId from module explanation entries. */
function findExplanationText(entries: readonly ExplanationEntry[], meaningId: string): string | null {
  for (const entry of entries) {
    if ("meaningId" in entry && entry.meaningId === meaningId) {
      return entry.displayText;
    }
  }
  return null;
}

/** Map raw BidMeaningClause[] to SurfaceClauseView[] for the learning viewport.
 *  system.* facts automatically get neutral descriptions + per-system variants. */
function mapClauses(
  clauses: readonly BidMeaningClause[],
): readonly SurfaceClauseView[] {
  return clauses.map((c) => {
    const isSystemFact = c.factId.startsWith("system.");
    return {
      factId: c.factId,
      operator: c.operator,
      value: c.value,
      description: isSystemFact
        ? deriveNeutralDescription(c.factId, c.rationale)
        : readClauseDescription(c),
      isPublic: c.isPublic ?? false,
      ...(isSystemFact ? { systemVariants: buildSystemVariants(c.factId) } : {}),
    };
  });
}

/** Build PhaseGroupView[] from a module's states, ordered by FSM topology. */
function buildPhaseGroups(mod: ConventionModule): readonly PhaseGroupView[] {
  const states = mod.states ?? [];
  if (states.length === 0) return [];

  const phaseOrder = derivePhaseOrder(mod.local);

  // Group states by phase string (flatten multi-phase entries)
  const phaseMap = new Map<string, { turn: string | null; surfaces: SurfaceDetailView[] }>();

  for (const entry of states) {
    const entryPhases: readonly string[] = Array.isArray(entry.phase)
      ? entry.phase
      : [entry.phase];

    for (const phase of entryPhases) {
      let group = phaseMap.get(phase);
      if (!group) {
        group = { turn: entry.turn ?? null, surfaces: [] };
        phaseMap.set(phase, group);
      }

      const seen = new Set(group.surfaces.map((s) => s.meaningId));
      for (const surface of entry.surfaces) {
        if (seen.has(surface.meaningId)) continue;
        seen.add(surface.meaningId);

        const rawExplanation = findExplanationText(mod.explanationEntries, surface.meaningId);
        group.surfaces.push({
          meaningId: surface.meaningId,
          teachingLabel: formatBidReferences(surface.teachingLabel),
          call: surface.encoding.defaultCall,
          callDisplay: formatCall(surface.encoding.defaultCall),
          disclosure: surface.disclosure,
          recommendation: surface.ranking.recommendationBand ?? null,
          explanationText: rawExplanation ? formatBidReferences(rawExplanation) : null,
          clauses: mapClauses(surface.clauses),
        });
      }
    }
  }

  // Build ordered result following FSM topology
  const result: PhaseGroupView[] = [];
  for (const phase of phaseOrder) {
    const group = phaseMap.get(phase);
    if (!group || group.surfaces.length === 0) continue;

    result.push({
      phase,
      phaseDisplay: formatPhaseDisplay(phase, group.turn),
      turn: group.turn,
      surfaces: group.surfaces,
    });
  }

  return result;
}

// ── Bundle Flow Tree ──────────────────────────────────────────────────

/**
 * Build a unified conversation flow tree for a bundle.
 *
 * Algorithm:
 * 1. Resolve all modules in the bundle.
 * 2. For each module, read its LocalFsm (phases + transitions) and states.
 * 3. Build a tree by walking FSM topology:
 *    - Root = the opening bid surface (from whichever module has phase=initial, turn="opener").
 *    - Each PhaseTransition says "from phase X, on observation P, go to phase Y."
 *      Surfaces at phase Y become children of whichever surface at phase X
 *      emitted observation P (matched by the transition's `on` pattern).
 * 4. Merge across modules: deduplicate by callKey at the same auction point.
 * 5. Handle cross-module route constraints (e.g., Smolen under Stayman's denial)
 *    in a second pass.
 *
 * Heuristic limitations:
 * - Only `subseq` RouteExpr is implemented for cross-module attachment.
 * - Other RouteExpr kinds fall back to root-level placement.
 * - If new RouteExpr kinds are added to modules, extend the matcher or
 *   accept root-level placement.
 */
export function buildBundleFlowTree(bundleId: string): BundleFlowTreeViewport | null {
  const input = getBundleInput(bundleId);
  if (!input) return null;

  const modules = input.memberIds
    .map((id) => getModule(id))
    .filter((m): m is ConventionModule => m !== undefined);
  if (modules.length === 0) return null;

  // Collect all states and transitions across modules, tagging with moduleId
  interface TaggedState {
    moduleId: string;
    phase: string;
    turn: string | null;
    route: RouteExpr | undefined;
    surfaces: ReadonlyArray<{
      meaningId: string;
      callKey: string;
      call: Call;
      teachingLabel: string;
      moduleId: string;
    }>;
  }

  const taggedStates: TaggedState[] = [];
  const allTransitions: Array<{
    moduleId: string;
    from: readonly string[];
    to: string;
    on: ObsPattern;
  }> = [];

  for (const mod of modules) {
    // Collect transitions
    for (const t of mod.local.transitions) {
      const froms: readonly string[] = Array.isArray(t.from) ? t.from : [t.from];
      allTransitions.push({
        moduleId: mod.moduleId,
        from: froms,
        to: t.to,
        on: t.on,
      });
    }

    // Collect states
    for (const entry of mod.states ?? []) {
      const phases: readonly string[] = Array.isArray(entry.phase)
        ? entry.phase as readonly string[]
        : [entry.phase as string];

      for (const phase of phases) {
        taggedStates.push({
          moduleId: mod.moduleId,
          phase,
          turn: (entry.turn as string) ?? null,
          route: entry.route,
          surfaces: entry.surfaces.map((s) => ({
            meaningId: s.meaningId,
            callKey: callKey(s.encoding.defaultCall),
            call: s.encoding.defaultCall,
            teachingLabel: s.teachingLabel,
            moduleId: mod.moduleId,
          })),
        });
      }
    }
  }

  // Separate states with and without route constraints
  const normalStates = taggedStates.filter((s) => !s.route);
  const routeStates = taggedStates.filter((s) => s.route);

  // Group normal states by phase
  const phaseStates = new Map<string, TaggedState[]>();
  for (const s of normalStates) {
    const existing = phaseStates.get(s.phase);
    if (existing) existing.push(s);
    else phaseStates.set(s.phase, [s]);
  }

  // Find the initial phase (opening bid — idle phase with opener turn)
  const initialPhases = new Set(modules.map((m) => m.local.initial));

  // Build mutable tree nodes
  interface MutableNode {
    id: string;
    callKey: string | null;
    call: Call | null;
    turn: "opener" | "responder" | null;
    label: string;
    moduleId: string | null;
    moduleDisplayName: string | null;
    children: MutableNode[];
    depth: number;
    phase: string;
    /** The observation pattern that created this node (from the parent transition's `on`). */
    incomingObs: ObsPattern | null;
  }

  let nodeCount = 0;
  function createNode(
    surface: TaggedState["surfaces"][number] | null,
    phase: string,
    turn: string | null,
    depth: number,
    label?: string,
    incomingObs?: ObsPattern,
  ): MutableNode {
    nodeCount++;
    return {
      id: surface ? `${surface.moduleId}:${surface.meaningId}` : `root:${phase}`,
      callKey: surface ? surface.callKey : null,
      call: surface ? surface.call : null,
      turn: (turn === "opener" || turn === "responder") ? turn : null,
      label: label ?? (surface ? surface.teachingLabel : phase),
      moduleId: surface ? surface.moduleId : null,
      moduleDisplayName: surface ? formatModuleName(surface.moduleId) : null,
      children: [],
      depth,
      phase,
      incomingObs: incomingObs ?? null,
    };
  }

  // Build root from initial phase opener surfaces
  let rootNode: MutableNode | null = null;
  for (const initPhase of initialPhases) {
    const states = phaseStates.get(initPhase);
    if (!states) continue;
    const openerStates = states.filter((s) => s.turn === "opener");
    if (openerStates.length === 0) continue;
    // Use the first opener surface as root
    const firstSurface = openerStates[0]!.surfaces[0];
    if (firstSurface) {
      rootNode = createNode(firstSurface, initPhase, "opener", 0);
      // If multiple opener surfaces at root (rare), merge labels
      for (let i = 1; i < openerStates.length; i++) {
        for (const s of openerStates[i]!.surfaces) {
          if (s.callKey === rootNode.callKey) {
            rootNode.label += ` / ${s.teachingLabel}`;
          }
        }
      }
      break;
    }
  }

  if (!rootNode) {
    // Fallback: create a synthetic root
    const firstInit = [...initialPhases][0] ?? "root";
    rootNode = createNode(null, firstInit, null, 0, input.name);
  }

  // Attach responder surfaces at the initial phase as direct children of root.
  // These are R1 bids from other modules (e.g., Stayman 2C, Jacoby Transfer 2D/2H)
  // that live at the initial phase but with turn="responder".
  const r1Children: MutableNode[] = [];
  const seenR1CallKeys = new Set<string>();
  for (const initPhase of initialPhases) {
    const states = phaseStates.get(initPhase);
    if (!states) continue;
    const responderStates = states.filter((s) => s.turn === "responder");
    for (const state of responderStates) {
      for (const surface of state.surfaces) {
        if (seenR1CallKeys.has(surface.callKey)) {
          const existing = r1Children.find((n) => n.callKey === surface.callKey);
          if (existing && !existing.label.includes(surface.teachingLabel)) {
            existing.label += ` / ${surface.teachingLabel}`;
          }
          continue;
        }
        seenR1CallKeys.add(surface.callKey);
        const node = createNode(surface, initPhase, "responder", 1);
        r1Children.push(node);
        rootNode.children.push(node);
      }
    }
  }

  // Map: phase → nodes at that phase (for attaching children)
  const phaseNodes = new Map<string, MutableNode[]>();
  phaseNodes.set(rootNode.phase, [rootNode, ...r1Children]);

  // Track visited transitions to avoid infinite loops
  const visitedTransitions = new Set<string>();

  // BFS through transitions to build the tree
  const queue: string[] = [...initialPhases];
  const visitedPhases = new Set<string>(initialPhases);

  while (queue.length > 0) {
    const currentPhase = queue.shift()!;
    const parentNodes = phaseNodes.get(currentPhase) ?? [];

    // Find transitions FROM this phase
    const outTransitions = allTransitions.filter((t) =>
      t.from.includes(currentPhase)
    );

    for (const trans of outTransitions) {
      const transKey = `${currentPhase}→${trans.to}:${trans.on.act}:${trans.on.feature ?? ""}:${trans.on.suit ?? ""}`;
      if (visitedTransitions.has(transKey)) continue;
      visitedTransitions.add(transKey);

      // Find surfaces at the target phase
      const targetStates = phaseStates.get(trans.to);
      if (!targetStates) {
        if (!visitedPhases.has(trans.to)) {
          visitedPhases.add(trans.to);
          queue.push(trans.to);
        }
        continue;
      }

      // Create child nodes for each surface at the target phase
      const childNodes: MutableNode[] = [];
      const seenCallKeys = new Set<string>();

      for (const state of targetStates) {
        for (const surface of state.surfaces) {
          if (seenCallKeys.has(surface.callKey)) {
            // Deduplicate: merge label into existing node
            const existing = childNodes.find((n) => n.callKey === surface.callKey);
            if (existing && !existing.label.includes(surface.teachingLabel)) {
              existing.label += ` / ${surface.teachingLabel}`;
            }
            continue;
          }
          seenCallKeys.add(surface.callKey);
          const depth = parentNodes.length > 0 ? parentNodes[0]!.depth + 1 : 1;
          const node = createNode(surface, trans.to, state.turn, depth);
          childNodes.push(node);
        }
      }

      // Attach children to the best parent node.
      // Prefer an R1 child from the same module as the transition (e.g., Stayman 2C
      // is the parent for Stayman's "asked" phase surfaces). Fall back to the root.
      if (parentNodes.length > 0) {
        const bestParent =
          parentNodes.find((p) => p.moduleId === trans.moduleId && p !== rootNode)
          ?? parentNodes[0]!;
        const depth = bestParent.depth + 1;
        for (const child of childNodes) {
          child.depth = depth;
          // Avoid duplicate children (same callKey already attached)
          const alreadyAttached = bestParent.children.some(
            (c) => c.callKey === child.callKey && c.phase === child.phase
          );
          if (!alreadyAttached) {
            bestParent.children.push(child);
          }
        }
      }

      // Register target phase nodes
      const existing = phaseNodes.get(trans.to);
      if (existing) {
        for (const c of childNodes) {
          if (!existing.some((e) => e.callKey === c.callKey)) existing.push(c);
        }
      } else {
        phaseNodes.set(trans.to, childNodes);
      }

      if (!visitedPhases.has(trans.to)) {
        visitedPhases.add(trans.to);
        queue.push(trans.to);
      }
    }
  }

  // Second pass: attach route-constrained states (e.g., Smolen under Stayman denial)
  for (const state of routeStates) {
    const route = state.route!;
    if (route.kind !== "subseq") {
      // eslint-disable-next-line no-console -- deliberate warning for unsupported route kinds
      console.warn(`[flow-tree] Unsupported RouteExpr kind "${route.kind}" for module ${state.moduleId} — attaching at root`);
      for (const surface of state.surfaces) {
        rootNode.children.push(createNode(surface, state.phase, state.turn, rootNode.depth + 1));
      }
      continue;
    }

    // Walk the tree matching the subseq steps against transition observations
    let currentNodes: MutableNode[] = [rootNode];
    let matched = true;

    for (const step of route.steps) {
      const nextNodes: MutableNode[] = [];
      for (const node of currentNodes) {
        for (const child of node.children) {
          // Check if this child was created by a transition whose `on` matches the step
          if (obsPatternMatches(child, step, allTransitions)) {
            nextNodes.push(child);
          }
        }
      }
      if (nextNodes.length === 0) {
        matched = false;
        break;
      }
      currentNodes = nextNodes;
    }

    if (matched && currentNodes.length > 0) {
      const attachPoint = currentNodes[0]!;
      for (const surface of state.surfaces) {
        const seenCallKeys = new Set(attachPoint.children.map((c) => c.callKey));
        if (!seenCallKeys.has(surface.callKey)) {
          attachPoint.children.push(
            createNode(surface, state.phase, state.turn, attachPoint.depth + 1)
          );
        }
      }
    } else {
      // eslint-disable-next-line no-console -- deliberate warning for unresolved routes
      console.warn(`[flow-tree] Route unresolved for module ${state.moduleId} — attaching at root`);
      for (const surface of state.surfaces) {
        rootNode.children.push(createNode(surface, state.phase, state.turn, rootNode.depth + 1));
      }
    }
  }

  // Convert mutable tree to readonly FlowTreeNode
  function toFlowTreeNode(node: MutableNode): FlowTreeNode {
    return {
      id: node.id,
      call: node.call,
      callDisplay: node.call ? formatCall(node.call) : null,
      turn: node.turn,
      label: node.label,
      moduleId: node.moduleId,
      moduleDisplayName: node.moduleDisplayName,
      children: node.children.map(toFlowTreeNode),
      depth: node.depth,
    };
  }

  // Compute max depth
  function maxDepth(node: MutableNode): number {
    if (node.children.length === 0) return node.depth;
    return Math.max(...node.children.map(maxDepth));
  }

  return {
    bundleId: input.id,
    bundleName: input.name,
    root: toFlowTreeNode(rootNode),
    nodeCount,
    maxDepth: maxDepth(rootNode),
  };
}

/**
 * Check if a tree node was reached via a transition whose `on` pattern
 * matches the given ObsPattern step.
 */
function obsPatternMatches(
  node: { phase: string; callKey: string | null },
  step: ObsPattern,
  transitions: ReadonlyArray<{ from: readonly string[]; to: string; on: ObsPattern }>,
): boolean {
  // Find transitions that lead TO this node's phase
  for (const t of transitions) {
    if (t.to !== node.phase) continue;
    if (t.on.act !== step.act && step.act !== "any") continue;
    if (step.feature !== undefined && t.on.feature !== step.feature) continue;
    if (step.suit !== undefined && t.on.suit !== step.suit) continue;
    if (step.strain !== undefined && t.on.strain !== step.strain) continue;
    return true;
  }
  return false;
}
