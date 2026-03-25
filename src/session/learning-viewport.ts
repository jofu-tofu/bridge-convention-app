/**
 * Learning viewport builder — projects convention bundle and module internals
 * into viewport response types for UI consumption.
 *
 * Lives in session/ because it reads from conventions/ (ConventionBundle,
 * ConventionModule) and writes to service response types. The UI never
 * imports this file — it calls service methods.
 */

import type { ConventionModule, LocalFsm, ExplanationEntry, BidMeaningClause } from "../conventions";
import { moduleSurfaces, getModule, getAllModules, listBundleInputs } from "../conventions";
import { formatCall } from "../service/display/format";
import type {
  ModuleCatalogEntry,
  ModuleLearningViewport,
  PhaseGroupView,
  SurfaceDetailView,
  SurfaceClauseView,
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
    description: mod.description,
    purpose: mod.purpose,
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
    description: mod.description,
    purpose: mod.purpose,
    teaching: {
      tradeoff: teaching?.tradeoff ?? null,
      principle: teaching?.principle ?? null,
      commonMistakes: teaching?.commonMistakes ?? [],
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

/** Map raw BidMeaningClause[] to SurfaceClauseView[] for the learning viewport. */
function mapClauses(clauses: readonly BidMeaningClause[]): readonly SurfaceClauseView[] {
  return clauses.map((c) => ({
    factId: c.factId,
    operator: c.operator,
    value: c.value,
    description: (c as BidMeaningClause & { description?: string }).description ?? `${c.factId} ${c.operator} ${JSON.stringify(c.value)}`,
    isPublic: c.isPublic ?? false,
  }));
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

        group.surfaces.push({
          meaningId: surface.meaningId,
          teachingLabel: surface.teachingLabel,
          call: surface.encoding.defaultCall,
          callDisplay: formatCall(surface.encoding.defaultCall),
          disclosure: surface.disclosure,
          recommendation: surface.ranking.recommendationBand ?? null,
          explanationText: findExplanationText(mod.explanationEntries, surface.meaningId),
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
