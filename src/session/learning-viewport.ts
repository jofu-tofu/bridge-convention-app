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

  // ── Types ───────────────────────────────────────────────────────
  interface TaggedSurface {
    meaningId: string;
    ck: string;
    call: Call;
    teachingLabel: string;
    moduleId: string;
  }

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
    /** The transition observation that leads INTO this node's phase. */
    transitionObs: ObsPattern | null;
  }

  let nodeCount = 0;
  function mkNode(
    surface: TaggedSurface | null,
    phase: string,
    turn: string | null,
    depth: number,
    label?: string,
    transObs?: ObsPattern,
  ): MutableNode {
    nodeCount++;
    return {
      id: surface ? `${surface.moduleId}:${surface.meaningId}` : `root:${phase}`,
      callKey: surface ? surface.ck : null,
      call: surface ? surface.call : null,
      turn: (turn === "opener" || turn === "responder") ? turn : null,
      label: label ?? (surface ? surface.teachingLabel : phase),
      moduleId: surface ? surface.moduleId : null,
      moduleDisplayName: surface ? formatModuleName(surface.moduleId) : null,
      children: [],
      depth,
      phase,
      transitionObs: transObs ?? null,
    };
  }

  // ── Collect module data ─────────────────────────────────────────
  interface ModulePhaseState {
    moduleId: string;
    turn: string | null;
    route: RouteExpr | undefined;
    surfaces: TaggedSurface[];
  }

  // Per-module: phase → states at that phase
  const modulePhaseMap = new Map<string, Map<string, ModulePhaseState[]>>();
  // Per-module: transitions
  const moduleTransitions = new Map<string, Array<{ from: readonly string[]; to: string; on: ObsPattern }>>();

  for (const mod of modules) {
    const transArr: Array<{ from: readonly string[]; to: string; on: ObsPattern }> = [];
    for (const t of mod.local.transitions) {
      const froms: readonly string[] = Array.isArray(t.from) ? t.from : [t.from];
      transArr.push({ from: froms, to: t.to, on: t.on });
    }
    moduleTransitions.set(mod.moduleId, transArr);

    const phMap = new Map<string, ModulePhaseState[]>();
    for (const entry of mod.states ?? []) {
      const phases: readonly string[] = Array.isArray(entry.phase)
        ? entry.phase as readonly string[]
        : [entry.phase as string];
      const surfaces: TaggedSurface[] = entry.surfaces.map((s) => ({
        meaningId: s.meaningId,
        ck: callKey(s.encoding.defaultCall),
        call: s.encoding.defaultCall,
        teachingLabel: s.teachingLabel,
        moduleId: mod.moduleId,
      }));
      for (const phase of phases) {
        const existing = phMap.get(phase);
        const state: ModulePhaseState = {
          moduleId: mod.moduleId,
          turn: (entry.turn as string) ?? null,
          route: entry.route,
          surfaces,
        };
        if (existing) existing.push(state);
        else phMap.set(phase, [state]);
      }
    }
    modulePhaseMap.set(mod.moduleId, phMap);
  }

  // ── Build per-module subtrees ───────────────────────────────────
  // Each module's FSM defines a tree: idle → phase1 → phase2 → ...
  // Build each module's tree independently, then merge.

  /** Build a subtree for one module starting from a given phase. */
  function buildModuleSubtree(
    modId: string,
    phase: string,
    parentDepth: number,
    visited: Set<string>,
    transObs?: ObsPattern,
  ): MutableNode[] {
    if (visited.has(phase)) return [];
    visited.add(phase);

    const phMap = modulePhaseMap.get(modId);
    const transitions = moduleTransitions.get(modId) ?? [];
    const states = phMap?.get(phase);
    if (!states) return [];

    // Collect surfaces at this phase (excluding route-constrained ones)
    const normalStates = states.filter((s) => !s.route);
    const nodes: MutableNode[] = [];
    const seenCK = new Set<string>();

    for (const state of normalStates) {
      for (const surface of state.surfaces) {
        if (seenCK.has(surface.ck)) continue;
        seenCK.add(surface.ck);
        nodes.push(mkNode(surface, phase, state.turn, parentDepth + 1, undefined, transObs));
      }
    }

    // For each outgoing transition from this phase, recurse into child phases.
    // Match children to the correct parent node: each transition creates its own
    // branch. When there are N transitions and N parent nodes (e.g., Stayman's
    // "asked" phase: 2H/2S/2D and show-hearts/show-spades/denied), match by
    // transition observation using obsMatchesStep against each parent's transitionObs.
    // Fall back to the first parent if no match found.
    const outTrans = transitions.filter((t) => t.from.includes(phase));
    for (const trans of outTrans) {
      const childNodes = buildModuleSubtree(modId, trans.to, parentDepth + 1, visited, trans.on);
      if (childNodes.length === 0) continue;

      if (nodes.length > 0) {
        // Try to match this transition to a specific parent node.
        // Each node at this phase has its own transitionObs. We check if
        // the child transition's `on` pattern corresponds to what a specific
        // parent "becomes" — but we don't have that mapping directly.
        // Instead, attach all children to nodes[0] for now, then redistribute.
        nodes[0]!.children.push(...childNodes);
      }
    }

    return nodes;
  }

  // ── Merge module subtrees under a shared root ───────────────────

  // Find the root: opening bid at the initial phase (opener turn)
  let rootNode: MutableNode | null = null;
  for (const mod of modules) {
    const phMap = modulePhaseMap.get(mod.moduleId);
    const states = phMap?.get(mod.local.initial);
    if (!states) continue;
    const openerStates = states.filter((s) => s.turn === "opener" && !s.route);
    if (openerStates.length === 0) continue;
    const firstSurface = openerStates[0]!.surfaces[0];
    if (firstSurface) {
      rootNode = mkNode(firstSurface, mod.local.initial, "opener", 0);

      // Build the opening module's own subtree from initial phase
      const visited = new Set<string>();
      visited.add(mod.local.initial);
      const transitions = moduleTransitions.get(mod.moduleId) ?? [];
      const outTrans = transitions.filter((t) => t.from.includes(mod.local.initial));
      for (const trans of outTrans) {
        const childNodes = buildModuleSubtree(mod.moduleId, trans.to, 0, visited, trans.on);
        rootNode.children.push(...childNodes);
      }

      // Also attach R1 responder surfaces from this module
      const respStates = states.filter((s) => s.turn === "responder" && !s.route);
      for (const state of respStates) {
        for (const surface of state.surfaces) {
          rootNode.children.push(mkNode(surface, mod.local.initial, "responder", 1));
        }
      }
      break;
    }
  }

  if (!rootNode) {
    rootNode = mkNode(null, "root", null, 0, input.name);
  }

  // Attach other modules' subtrees under root.
  // For each module, build the full subtree once from initial transitions,
  // then attach each subtree branch to the correct R1 node.
  for (const mod of modules) {
    if (mod.moduleId === rootNode.moduleId) continue;
    const phMap = modulePhaseMap.get(mod.moduleId);
    const states = phMap?.get(mod.local.initial);
    if (!states) continue;

    // Collect R1 surfaces.
    // Set transitionObs to the module's first non-deactivation transition from
    // initial phase, so route matching can identify this node as the observation.
    const respStates = states.filter((s) => s.turn === "responder" && !s.route);
    const r1Nodes: MutableNode[] = [];
    const seenCK = new Set<string>();
    const transitions = moduleTransitions.get(mod.moduleId) ?? [];
    const firstActiveTrans = transitions.find(
      (t) => t.from.includes(mod.local.initial) && t.to !== "inactive"
    );

    for (const state of respStates) {
      for (const surface of state.surfaces) {
        const existingChild = rootNode.children.find((c) => c.callKey === surface.ck);
        if (existingChild) {
          if (!existingChild.label.includes(surface.teachingLabel)) {
            existingChild.label += ` / ${surface.teachingLabel}`;
          }
          continue;
        }
        if (seenCK.has(surface.ck)) continue;
        seenCK.add(surface.ck);
        const r1Node = mkNode(surface, mod.local.initial, "responder", 1, undefined, firstActiveTrans?.on);
        r1Nodes.push(r1Node);
        rootNode.children.push(r1Node);
      }
    }

    // Build the module subtree once with a shared visited set
    const visited = new Set<string>();
    visited.add(mod.local.initial);
    const modTrans = moduleTransitions.get(mod.moduleId) ?? [];
    const outTrans = modTrans.filter((t) => t.from.includes(mod.local.initial));

    for (const trans of outTrans) {
      const childNodes = buildModuleSubtree(mod.moduleId, trans.to, 1, visited, trans.on);
      if (childNodes.length === 0) continue;

      // Attach to the first R1 node (they all share the same module)
      if (r1Nodes.length > 0) {
        r1Nodes[0]!.children.push(...childNodes);
      }
    }
  }

  // ── Second pass: route-constrained surfaces ─────────────────────
  // Handle cross-module dependencies (e.g., Smolen under Stayman's denial branch).
  // Only `subseq` RouteExpr is supported; other kinds fall back to root.
  for (const mod of modules) {
    const phMap = modulePhaseMap.get(mod.moduleId);
    if (!phMap) continue;

    for (const [, states] of phMap) {
      for (const state of states) {
        if (!state.route) continue;
        const route = state.route;

        if (route.kind !== "subseq") {
          // eslint-disable-next-line no-console -- deliberate warning for unsupported route kinds
          console.warn(`[flow-tree] Unsupported RouteExpr kind "${route.kind}" for module ${state.moduleId} — attaching at root`);
          for (const surface of state.surfaces) {
            rootNode.children.push(mkNode(surface, "route-fallback", state.turn, rootNode.depth + 1));
          }
          continue;
        }

        // Walk the tree from root, matching edges by transitionObs.
        // Also search recursively within children to handle nested structures
        // where the matching node isn't a direct child.
        let currentNodes: MutableNode[] = [rootNode];
        let matched = true;

        for (const step of route.steps) {
          const nextNodes: MutableNode[] = [];
          const searchQueue = [...currentNodes];
          const searched = new Set<string>();
          while (searchQueue.length > 0) {
            const node = searchQueue.shift()!;
            if (searched.has(node.id)) continue;
            searched.add(node.id);
            for (const child of node.children) {
              if (obsMatchesStep(child.transitionObs, step)) {
                nextNodes.push(child);
              } else {
                // Search deeper in case the matching node is nested
                searchQueue.push(child);
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
            if (!attachPoint.children.some((c) => c.callKey === surface.ck)) {
              attachPoint.children.push(
                mkNode(surface, "route-attached", state.turn, attachPoint.depth + 1)
              );
            }
          }
        } else {
          // eslint-disable-next-line no-console -- deliberate warning for unresolved routes
          console.warn(`[flow-tree] Route unresolved for module ${state.moduleId} — attaching at root`);
          for (const surface of state.surfaces) {
            rootNode.children.push(mkNode(surface, "route-fallback", state.turn, rootNode.depth + 1));
          }
        }
      }
    }
  }

  // ── Convert to immutable output ─────────────────────────────────
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
 * Check if a tree node's incoming observation matches the given ObsPattern step.
 */
function obsMatchesStep(obs: ObsPattern | null, step: ObsPattern): boolean {
  if (!obs) return false;
  if (step.act !== "any" && obs.act !== step.act) return false;
  if (step.feature !== undefined && obs.feature !== step.feature) return false;
  if (step.suit !== undefined && obs.suit !== step.suit) return false;
  if (step.strain !== undefined && obs.strain !== step.strain) return false;
  return true;
}
