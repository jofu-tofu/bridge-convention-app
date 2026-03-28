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
  getBaseModuleIds, getSystemConfig, normalizeIntent, matchObs,
  getPrimaryCapability,
} from "../conventions";
import { formatTransitionLabel } from "./format-obs-label";
import { callKey } from "../engine/call-helpers";
import { parsePatternCall } from "../engine/auction-helpers";
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
  ModuleFlowTreeViewport,
  BaseModuleInfo,
} from "../service/response-types";
import type { BaseSystemId } from "../conventions";

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
 * Returns the HCP description + optional trump/NT total-point descriptions, or null for unrecognized facts.
 */
function describeSystemFactValue(
  factId: string,
  sys: SystemConfig,
): { hcp: string; trumpTp?: string; ntTp?: string } | null {
  switch (factId) {
    case "system.responder.weakHand": {
      const t = sys.responderThresholds;
      return { hcp: `< ${t.inviteMin}`, trumpTp: `< ${t.inviteMinTp.trump}`, ntTp: `< ${t.inviteMinTp.nt}` };
    }
    case "system.responder.inviteValues": {
      const t = sys.responderThresholds;
      return {
        hcp: `${t.inviteMin}\u2013${t.inviteMax}`,
        trumpTp: `${t.inviteMinTp.trump}\u2013${t.inviteMaxTp.trump}`,
        ntTp: `${t.inviteMinTp.nt}\u2013${t.inviteMaxTp.nt}`,
      };
    }
    case "system.responder.gameValues": {
      const t = sys.responderThresholds;
      return { hcp: `${t.gameMin}+`, trumpTp: `${t.gameMinTp.trump}+`, ntTp: `${t.gameMinTp.nt}+` };
    }
    case "system.responder.slamValues": {
      const t = sys.responderThresholds;
      return { hcp: `${t.slamMin}+`, trumpTp: `${t.slamMinTp.trump}+`, ntTp: `${t.slamMinTp.nt}+` };
    }
    case "system.opener.notMinimum": {
      const r = sys.openerRebid;
      return { hcp: `${r.notMinimum}+`, trumpTp: `${r.notMinimumTp.trump}+`, ntTp: `${r.notMinimumTp.nt}+` };
    }
    case "system.responder.twoLevelNewSuit":
      return { hcp: `${sys.suitResponse.twoLevelMin}+ HCP` };
    case "system.suitResponse.isGameForcing":
      return { hcp: sys.suitResponse.twoLevelForcingDuration === "game" ? "Game-forcing" : "One-round forcing" };
    case "system.oneNtResponseAfterMajor.forcing":
      return { hcp: `1NT is ${sys.oneNtResponseAfterMajor.forcing}` };
    case "system.responder.oneNtRange":
      return { hcp: `${sys.oneNtResponseAfterMajor.minHcp}\u2013${sys.oneNtResponseAfterMajor.maxHcp} HCP` };
    case "system.dontOvercall.inRange":
      return { hcp: `${sys.dontOvercall.minHcp}\u2013${sys.dontOvercall.maxHcp} HCP` };
    default:
      return null;
  }
}

/** Build system variants for a system.* fact — one entry per known base system. */
function buildSystemVariants(factId: string): readonly ClauseSystemVariant[] {
  return ALL_SYSTEMS.map(({ sys, label }) => {
    const result = describeSystemFactValue(factId, sys);
    if (!result) return { systemLabel: label, description: factId };
    return {
      systemLabel: label,
      description: result.hcp,
      trumpTpDescription: result.trumpTp,
      ntTpDescription: result.ntTp,
    };
  });
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

/** Build read-only metadata for base system modules (for settings display). */
export function buildBaseModuleInfos(baseSystemId: BaseSystemId): readonly BaseModuleInfo[] {
  const ids = getBaseModuleIds(baseSystemId);
  return ids.map((id) => {
    const mod = getModule(id);
    return {
      id,
      displayName: formatModuleName(id),
      description: mod?.description ?? id,
    };
  });
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

/** Entry condition info for a module's root: label + optional trigger call. */
interface EntryCondition {
  readonly label: string;
  readonly call: Call | null;
  readonly turn: "opener" | "responder" | null;
}

const CAP_ENTRY_CONDITIONS: Record<string, EntryCondition> = {
  "opening.1nt": { label: "Partner opened 1NT", call: parsePatternCall("1NT"), turn: "opener" },
  "opening.major": { label: "Partner opened a major", call: null, turn: "opener" },
  "opening.weak-two": { label: "Partner opened a weak two", call: null, turn: "opener" },
  "opponent.1nt": { label: "Opponent opened 1NT", call: parsePatternCall("1NT"), turn: null },
};

/**
 * Derive root phase label from the module's host capability.
 */
function deriveRootPhaseLabel(moduleId: string): string | null {
  const entry = deriveEntryCondition(moduleId);
  return entry?.label ?? null;
}

/** Derive full entry condition (label + trigger call) from the module's host capability. */
function deriveEntryCondition(moduleId: string): EntryCondition | null {
  for (const input of listBundleInputs()) {
    if (!input.memberIds.includes(moduleId)) continue;
    const capId = getPrimaryCapability(input.declaredCapabilities);
    if (capId && CAP_ENTRY_CONDITIONS[capId]) return CAP_ENTRY_CONDITIONS[capId];
  }
  return null;
}

function findTriggerCall(mod: ConventionModule, fromPhase: string, obs: ObsPattern): Call | null {
  for (const entry of mod.states ?? []) {
    const entryPhases: readonly string[] = Array.isArray(entry.phase) ? entry.phase : [entry.phase];
    if (!entryPhases.includes(fromPhase)) continue;
    for (const surface of entry.surfaces) {
      const actions = normalizeIntent(surface.sourceIntent);
      if (actions.some((a) => matchObs(obs, a))) return surface.encoding.defaultCall;
    }
  }
  return null;
}

/** Build PhaseGroupView[] from a module's states, ordered by FSM topology. */
function buildPhaseGroups(mod: ConventionModule): readonly PhaseGroupView[] {
  const states = mod.states ?? [];
  if (states.length === 0) return [];

  const phaseOrder = derivePhaseOrder(mod.local);

  const incomingMap = new Map<string, { obs: ObsPattern; fromPhase: string }[]>();
  for (const t of mod.local.transitions) {
    const froms: readonly string[] = Array.isArray(t.from) ? t.from : [t.from];
    for (const f of froms) {
      const existing = incomingMap.get(t.to) ?? [];
      existing.push({ obs: t.on, fromPhase: f });
      incomingMap.set(t.to, existing);
    }
  }

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
          teachingLabel: {
            name: formatBidReferences(surface.teachingLabel.name),
            summary: formatBidReferences(surface.teachingLabel.summary),
          },
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

  const visiblePhases = phaseOrder.filter((p) => {
    const g = phaseMap.get(p);
    return g && g.surfaces.length > 0;
  });
  const suppressLabels = visiblePhases.length < 3;

  const result: PhaseGroupView[] = [];
  for (const phase of phaseOrder) {
    const group = phaseMap.get(phase);
    if (!group || group.surfaces.length === 0) continue;

    let transitionLabel: string | null = null;
    if (!suppressLabels) {
      if (phase === mod.local.initial) {
        transitionLabel = deriveRootPhaseLabel(mod.moduleId);
      } else {
        const incoming = incomingMap.get(phase);
        if (incoming && incoming.length > 0) {
          const { obs, fromPhase } = incoming[0]!;
          const triggerCall = findTriggerCall(mod, fromPhase, obs);
          const fromGroup = phaseMap.get(fromPhase);
          const sourceTurn = fromGroup?.turn ?? null;
          transitionLabel = formatTransitionLabel(obs, triggerCall, sourceTurn);
        }
      }
    }

    result.push({
      phase,
      phaseDisplay: formatPhaseDisplay(phase, group.turn),
      turn: group.turn,
      transitionLabel,
      surfaces: group.surfaces,
    });
  }

  return result;
}

// ── Flow Tree Shared Types & Helpers ─────────────────────────────────

interface SourceIntent {
  readonly type: string;
  readonly params: Readonly<Record<string, string | number | boolean>>;
}

interface TaggedSurface {
  meaningId: string;
  ck: string;
  call: Call;
  teachingLabel: string;
  moduleId: string;
  sourceIntent: SourceIntent;
  recommendation: "must" | "should" | "may" | "avoid" | null;
  disclosure: "alert" | "announcement" | "natural" | "standard";
  explanationText: string | null;
  clauses: readonly SurfaceClauseView[];
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
  recommendation: "must" | "should" | "may" | "avoid" | null;
  disclosure: "alert" | "announcement" | "natural" | "standard" | null;
  explanationText: string | null;
  clauses: readonly SurfaceClauseView[];
}

interface ModulePhaseState {
  moduleId: string;
  turn: string | null;
  route: RouteExpr | undefined;
  surfaces: TaggedSurface[];
}

type TransitionEntry = { from: readonly string[]; to: string; on: ObsPattern };

/** Mutable counter passed by reference to track node count across recursive calls. */
interface NodeCounter { value: number }

function mkNode(
  surface: TaggedSurface | null,
  phase: string,
  turn: string | null,
  depth: number,
  counter: NodeCounter,
  label?: string,
  transObs?: ObsPattern,
): MutableNode {
  const idx = counter.value++;
  return {
    id: surface ? `${surface.moduleId}:${surface.meaningId}:${idx}` : `root:${phase}:${idx}`,
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
    recommendation: surface?.recommendation ?? null,
    disclosure: surface?.disclosure ?? null,
    explanationText: surface?.explanationText ?? null,
    clauses: surface?.clauses ?? [],
  };
}

/** Create a synthetic root node from an entry condition (label + trigger call). */
function mkEntryConditionRoot(entry: EntryCondition, phase: string, counter: NodeCounter): MutableNode {
  const idx = counter.value++;
  return {
    id: `root:${phase}:${idx}`,
    callKey: entry.call ? callKey(entry.call) : null,
    call: entry.call,
    turn: entry.turn,
    label: entry.label,
    moduleId: null,
    moduleDisplayName: null,
    children: [],
    depth: 0,
    phase,
    transitionObs: null,
    recommendation: null,
    disclosure: null,
    explanationText: null,
    clauses: [],
  };
}

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
    recommendation: node.recommendation,
    disclosure: node.disclosure,
    explanationText: node.explanationText,
    clauses: node.clauses,
  };
}

function maxDepthOf(node: MutableNode): number {
  if (node.children.length === 0) return node.depth;
  return Math.max(...node.children.map(maxDepthOf));
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

/**
 * Check if a surface's sourceIntent produces observations that match a transition's `on` pattern.
 * Uses normalizeIntent to derive BidActions from the surface, then matchObs for comparison.
 */
function surfaceMatchesTransition(surface: TaggedSurface, transOn: ObsPattern): boolean {
  const actions = normalizeIntent(surface.sourceIntent);
  return actions.some((action) => matchObs(transOn, action));
}

/** Build a subtree for one module starting from a given phase. */
function buildModuleSubtree(
  modId: string,
  phase: string,
  parentDepth: number,
  visited: Set<string>,
  modulePhaseMap: Map<string, Map<string, ModulePhaseState[]>>,
  moduleTransitions: Map<string, TransitionEntry[]>,
  counter: NodeCounter,
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
  const nodeSurfaces: TaggedSurface[] = [];
  const seenCK = new Set<string>();

  for (const state of normalStates) {
    for (const surface of state.surfaces) {
      if (seenCK.has(surface.ck)) continue;
      seenCK.add(surface.ck);
      const node = mkNode(surface, phase, state.turn, parentDepth + 1, counter, undefined, transObs);
      nodes.push(node);
      nodeSurfaces.push(surface);
    }
  }

  const outTrans = transitions.filter((t) => t.from.includes(phase));
  for (const trans of outTrans) {
    const childNodes = buildModuleSubtree(modId, trans.to, parentDepth + 1, visited, modulePhaseMap, moduleTransitions, counter, trans.on);
    if (childNodes.length === 0) continue;

    // Match transition to the surface that produces the matching observation
    const matchIdx = nodeSurfaces.findIndex((s) => surfaceMatchesTransition(s, trans.on));
    const parent = matchIdx >= 0 ? nodes[matchIdx]! : nodes[0];
    if (parent) {
      parent.children.push(...childNodes);
    }
  }

  return nodes;
}

/** Collect phase map and transitions for a single module. */
function collectModuleData(mod: ConventionModule): {
  phaseMap: Map<string, ModulePhaseState[]>;
  transitions: TransitionEntry[];
} {
  const transitions: TransitionEntry[] = [];
  for (const t of mod.local.transitions) {
    const froms: readonly string[] = Array.isArray(t.from) ? t.from : [t.from];
    transitions.push({ from: froms, to: t.to, on: t.on });
  }

  const phaseMap = new Map<string, ModulePhaseState[]>();
  for (const entry of mod.states ?? []) {
    const phases: readonly string[] = Array.isArray(entry.phase)
      ? entry.phase as readonly string[]
      : [entry.phase as string];
    const surfaces: TaggedSurface[] = entry.surfaces.map((s) => {
      const rawExplanation = findExplanationText(mod.explanationEntries, s.meaningId);
      return {
        meaningId: s.meaningId,
        ck: callKey(s.encoding.defaultCall),
        call: s.encoding.defaultCall,
        teachingLabel: s.teachingLabel.name,
        moduleId: mod.moduleId,
        sourceIntent: s.sourceIntent,
        recommendation: s.ranking.recommendationBand ?? null,
        disclosure: s.disclosure,
        explanationText: rawExplanation ? formatBidReferences(rawExplanation) : null,
        clauses: mapClauses(s.clauses),
      };
    });
    for (const phase of phases) {
      const existing = phaseMap.get(phase);
      const state: ModulePhaseState = {
        moduleId: mod.moduleId,
        turn: (entry.turn as string) ?? null,
        route: entry.route,
        surfaces,
      };
      if (existing) existing.push(state);
      else phaseMap.set(phase, [state]);
    }
  }

  return { phaseMap, transitions };
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

  const counter: NodeCounter = { value: 0 };

  // ── Collect module data ─────────────────────────────────────────
  const modulePhaseMap = new Map<string, Map<string, ModulePhaseState[]>>();
  const moduleTransitions = new Map<string, TransitionEntry[]>();

  for (const mod of modules) {
    const { phaseMap, transitions } = collectModuleData(mod);
    modulePhaseMap.set(mod.moduleId, phaseMap);
    moduleTransitions.set(mod.moduleId, transitions);
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
      rootNode = mkNode(firstSurface, mod.local.initial, "opener", 0, counter);

      // Attach R1 responder surfaces from this module first
      const respStates = states.filter((s) => s.turn === "responder" && !s.route);
      const openingR1: { node: MutableNode; surface: TaggedSurface }[] = [];
      for (const state of respStates) {
        for (const surface of state.surfaces) {
          const node = mkNode(surface, mod.local.initial, "responder", 1, counter);
          rootNode.children.push(node);
          openingR1.push({ node, surface });
        }
      }

      // Build the opening module's own subtree from initial phase
      const visited = new Set<string>();
      visited.add(mod.local.initial);
      const transitions = moduleTransitions.get(mod.moduleId) ?? [];
      const outTrans = transitions.filter((t) => t.from.includes(mod.local.initial));
      for (const trans of outTrans) {
        const childNodes = buildModuleSubtree(mod.moduleId, trans.to, 1, visited, modulePhaseMap, moduleTransitions, counter, trans.on);
        if (childNodes.length === 0) continue;

        const matchingR1 = openingR1.find(({ surface }) => surfaceMatchesTransition(surface, trans.on));
        if (matchingR1) {
          matchingR1.node.children.push(...childNodes);
        } else {
          rootNode.children.push(...childNodes);
        }
      }
      break;
    }
  }

  if (!rootNode) {
    // Derive entry condition from the first module's capability
    const firstModuleId = modules[0]?.moduleId;
    const entry = firstModuleId ? deriveEntryCondition(firstModuleId) : null;
    if (entry) {
      rootNode = mkEntryConditionRoot(entry, "root", counter);
    } else {
      rootNode = mkNode(null, "root", null, 0, counter, input.name);
    }
  }

  // Attach other modules' subtrees under root.
  for (const mod of modules) {
    if (mod.moduleId === rootNode.moduleId) continue;
    const phMap = modulePhaseMap.get(mod.moduleId);
    const states = phMap?.get(mod.local.initial);
    if (!states) continue;

    const respStates = states.filter((s) => s.turn === "responder" && !s.route);
    const r1Entries: { node: MutableNode; surface: TaggedSurface }[] = [];
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
        const r1Node = mkNode(surface, mod.local.initial, "responder", 1, counter, undefined, firstActiveTrans?.on);
        r1Entries.push({ node: r1Node, surface });
        rootNode.children.push(r1Node);
      }
    }

    // Build the module subtree once with a shared visited set
    const visited = new Set<string>();
    visited.add(mod.local.initial);
    const modTrans = moduleTransitions.get(mod.moduleId) ?? [];
    const outTrans = modTrans.filter((t) => t.from.includes(mod.local.initial));

    for (const trans of outTrans) {
      const childNodes = buildModuleSubtree(mod.moduleId, trans.to, 1, visited, modulePhaseMap, moduleTransitions, counter, trans.on);
      if (childNodes.length === 0) continue;

      // Match transition to the R1 surface that produces the matching observation
      const matchingR1 = r1Entries.find(({ surface }) => surfaceMatchesTransition(surface, trans.on));
      if (matchingR1) {
        matchingR1.node.children.push(...childNodes);
      } else if (r1Entries.length > 0) {
        r1Entries[0]!.node.children.push(...childNodes);
      }
    }
  }

  // ── Second pass: route-constrained surfaces ─────────────────────
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
            rootNode.children.push(mkNode(surface, "route-fallback", state.turn, rootNode.depth + 1, counter));
          }
          continue;
        }

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
                mkNode(surface, "route-attached", state.turn, attachPoint.depth + 1, counter)
              );
            }
          }
        } else {
          // eslint-disable-next-line no-console -- deliberate warning for unresolved routes
          console.warn(`[flow-tree] Route unresolved for module ${state.moduleId} — attaching at root`);
          for (const surface of state.surfaces) {
            rootNode.children.push(mkNode(surface, "route-fallback", state.turn, rootNode.depth + 1, counter));
          }
        }
      }
    }
  }

  return {
    bundleId: input.id,
    bundleName: input.name,
    root: toFlowTreeNode(rootNode),
    nodeCount: counter.value,
    maxDepth: maxDepthOf(rootNode),
  };
}

// ── Module Flow Tree ──────────────────────────────────────────────────

/**
 * Build a conversation flow tree scoped to a single module.
 *
 * Unlike `buildBundleFlowTree` which merges all modules in a bundle,
 * this produces a standalone tree rooted at the module's own FSM topology.
 * Cross-module route attachments are intentionally excluded.
 */
export function buildModuleFlowTree(moduleId: string): ModuleFlowTreeViewport | null {
  const mod = getModule(moduleId);
  if (!mod) return null;

  const counter: NodeCounter = { value: 0 };
  const { phaseMap, transitions } = collectModuleData(mod);

  // Wrap in the same Map<moduleId, ...> shape expected by buildModuleSubtree
  const modulePhaseMap = new Map<string, Map<string, ModulePhaseState[]>>();
  modulePhaseMap.set(moduleId, phaseMap);
  const moduleTransitions = new Map<string, TransitionEntry[]>();
  moduleTransitions.set(moduleId, transitions);

  // Find root: opener surface at initial phase
  const initialStates = phaseMap.get(mod.local.initial);
  let rootNode: MutableNode | null = null;

  if (initialStates) {
    const openerStates = initialStates.filter((s) => s.turn === "opener" && !s.route);
    const firstOpenerSurface = openerStates[0]?.surfaces[0];
    if (firstOpenerSurface) {
      rootNode = mkNode(firstOpenerSurface, mod.local.initial, "opener", 0, counter);
    }
  }

  // If no opener surface, create synthetic root from entry condition (e.g., "Partner opened 1NT")
  if (!rootNode) {
    const entry = deriveEntryCondition(moduleId);
    if (entry) {
      rootNode = mkEntryConditionRoot(entry, mod.local.initial, counter);
    } else {
      rootNode = mkNode(null, mod.local.initial, null, 0, counter, formatModuleName(moduleId));
    }
  }

  // Attach R1 responder surfaces from initial phase first, then match transitions to them
  const r1Nodes: { node: MutableNode; surface: TaggedSurface }[] = [];
  if (initialStates) {
    const respStates = initialStates.filter((s) => s.turn === "responder" && !s.route);
    const seenCK = new Set<string>();
    for (const state of respStates) {
      for (const surface of state.surfaces) {
        const existing = rootNode.children.find((c) => c.callKey === surface.ck);
        if (existing) {
          if (!existing.label.includes(surface.teachingLabel)) {
            existing.label += ` / ${surface.teachingLabel}`;
          }
          continue;
        }
        if (seenCK.has(surface.ck)) continue;
        seenCK.add(surface.ck);
        const node = mkNode(surface, mod.local.initial, "responder", 1, counter);
        rootNode.children.push(node);
        r1Nodes.push({ node, surface });
      }
    }
  }

  // Build subtrees from initial phase transitions and attach to matching R1 surfaces
  const visited = new Set<string>();
  visited.add(mod.local.initial);
  const outTrans = transitions.filter((t) => t.from.includes(mod.local.initial));
  for (const trans of outTrans) {
    const childNodes = buildModuleSubtree(moduleId, trans.to, 1, visited, modulePhaseMap, moduleTransitions, counter, trans.on);
    if (childNodes.length === 0) continue;

    // Match transition to the R1 surface that produces the matching observation
    const matchingR1 = r1Nodes.find(({ surface }) => surfaceMatchesTransition(surface, trans.on));
    if (matchingR1) {
      matchingR1.node.children.push(...childNodes);
    } else {
      rootNode.children.push(...childNodes);
    }
  }

  // Route-constrained surfaces (within same module)
  for (const [, states] of phaseMap) {
    for (const state of states) {
      if (!state.route) continue;
      const route = state.route;

      if (route.kind !== "subseq") {
        // eslint-disable-next-line no-console -- deliberate warning for unsupported route kinds
        console.warn(`[flow-tree] Unsupported RouteExpr kind "${route.kind}" for module ${state.moduleId} — attaching at root`);
        for (const surface of state.surfaces) {
          rootNode.children.push(mkNode(surface, "route-fallback", state.turn, rootNode.depth + 1, counter));
        }
        continue;
      }

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
              mkNode(surface, "route-attached", state.turn, attachPoint.depth + 1, counter)
            );
          }
        }
      } else {
        // eslint-disable-next-line no-console -- deliberate warning for unresolved routes
        console.warn(`[flow-tree] Route unresolved for module ${state.moduleId} — attaching at root`);
        for (const surface of state.surfaces) {
          rootNode.children.push(mkNode(surface, "route-fallback", state.turn, rootNode.depth + 1, counter));
        }
      }
    }
  }

  return {
    moduleId,
    moduleName: formatModuleName(moduleId),
    root: toFlowTreeNode(rootNode),
    nodeCount: counter.value,
    maxDepth: maxDepthOf(rootNode),
  };
}
