/**
 * Learning viewport builder — projects convention bundle and module internals
 * into viewport response types for UI consumption.
 *
 * Lives in session/ because it reads from conventions/ (ConventionBundle,
 * ConventionModule) and writes to service response types. The UI never
 * imports this file — it calls service methods.
 */

import type { Call } from "../engine/types";
import type { ConventionModule, LocalFsm, ExplanationEntry, BidMeaningClause, SystemConfig, ObsPattern } from "../conventions";
import {
  moduleSurfaces, getModule, getAllModules, listBundleInputs,
  AVAILABLE_BASE_SYSTEMS, deriveNeutralDescription,
  getBaseModuleIds, getSystemConfig, normalizeIntent, matchObs,
  getPrimaryCapability,
} from "../conventions";
import { formatTransitionLabel } from "./format-obs-label";
import { parsePatternCall } from "../engine/auction-helpers";
import { formatCall, formatBidReferences } from "../service/display/format";
import type {
  ModuleCatalogEntry,
  ModuleLearningViewport,
  PhaseGroupView,
  SurfaceDetailView,
  SurfaceClauseView,
  ClauseSystemVariant,
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
): { hcp: string; trumpTp?: string } | null {
  switch (factId) {
    case "system.responder.weakHand": {
      const t = sys.responderThresholds;
      return { hcp: `< ${t.inviteMin}`, trumpTp: `< ${t.inviteMinTp.trump}` };
    }
    case "system.responder.inviteValues": {
      const t = sys.responderThresholds;
      return {
        hcp: `${t.inviteMin}\u2013${t.inviteMax}`,
        trumpTp: `${t.inviteMinTp.trump}\u2013${t.inviteMaxTp.trump}`,
      };
    }
    case "system.responder.gameValues": {
      const t = sys.responderThresholds;
      return { hcp: `${t.gameMin}+`, trumpTp: `${t.gameMinTp.trump}+` };
    }
    case "system.responder.slamValues": {
      const t = sys.responderThresholds;
      return { hcp: `${t.slamMin}+`, trumpTp: `${t.slamMinTp.trump}+` };
    }
    case "system.opener.notMinimum": {
      const r = sys.openerRebid;
      return { hcp: `${r.notMinimum}+`, trumpTp: `${r.notMinimumTp.trump}+` };
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

/**
 * Compute the set of post-fit phases for a module.
 * A phase is post-fit if any StateEntry at that phase has `negotiationDelta.fitAgreed` truthy,
 * or if it's reachable downstream from such a phase via FSM transitions.
 */
export function computePostFitPhases(mod: ConventionModule): Set<string> {
  const fitPhases = new Set<string>();
  for (const entry of mod.states ?? []) {
    if (entry.negotiationDelta?.fitAgreed) {
      const phases: readonly string[] = Array.isArray(entry.phase) ? entry.phase : [entry.phase];
      for (const p of phases) fitPhases.add(p);
    }
  }

  // Build adjacency map from transitions
  const adjacency = new Map<string, string[]>();
  for (const t of mod.local.transitions) {
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

  // BFS from fit-establishing phases to find all reachable downstream phases
  const result = new Set(fitPhases);
  const queue = [...fitPhases];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of adjacency.get(current) ?? []) {
      if (!result.has(next)) {
        result.add(next);
        queue.push(next);
      }
    }
  }

  return result;
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
export function findExplanationText(entries: readonly ExplanationEntry[], meaningId: string): string | null {
  for (const entry of entries) {
    if ("meaningId" in entry && entry.meaningId === meaningId) {
      return entry.displayText;
    }
  }
  return null;
}

/** Map raw BidMeaningClause[] to SurfaceClauseView[] for the learning viewport.
 *  system.* facts automatically get neutral descriptions + per-system variants.
 *  When `metric` is provided, system-fact clauses get a `relevantMetric` field. */
export function mapClauses(
  clauses: readonly BidMeaningClause[],
  metric?: "hcp" | "trumpTp",
): readonly SurfaceClauseView[] {
  return clauses.map((c) => {
    const isSystemFact = c.factId.startsWith("system.");
    return {
      factId: c.factId,
      operator: c.operator as unknown as SurfaceClauseView["operator"],
      value: c.value,
      description: isSystemFact
        ? deriveNeutralDescription(c.factId, c.rationale)
        : readClauseDescription(c),
      isPublic: c.isPublic ?? false,
      ...(isSystemFact ? { systemVariants: buildSystemVariants(c.factId), relevantMetric: metric } : {}),
    };
  });
}

/** Entry condition info for a module's root: label + optional trigger call. */
export interface EntryCondition {
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
export function deriveEntryCondition(moduleId: string): EntryCondition | null {
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
  const postFitPhases = computePostFitPhases(mod);

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

      const metric = postFitPhases.has(phase) ? "trumpTp" as const : "hcp" as const;
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
          clauses: mapClauses(surface.clauses, metric),
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

