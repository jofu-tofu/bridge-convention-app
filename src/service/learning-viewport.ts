/**
 * Learning viewport builder — projects convention bundle internals
 * into the LearningViewport response type for UI consumption.
 *
 * Lives in service/ because it reads from conventions/ (ConventionBundle,
 * ConventionModule) and writes to service response types. The UI never
 * imports this file — it calls service.getLearningViewport().
 */

import type { ConventionBundle } from "../conventions/core/bundle/bundle-types";
import type { ConventionModule } from "../conventions/core/convention-module";
import { moduleSurfaces } from "../conventions/core/convention-module";
import { formatCall } from "./display/format";
import type { LearningViewport, ModuleView } from "./response-types";

/** Known bridge abbreviations that should be fully uppercased. */
const BRIDGE_ABBREVIATIONS = new Set(["nt", "sayc", "hcp"]);

/** Convert kebab-case module ID to display name. */
function formatModuleName(moduleId: string): string {
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

/** Format a clause into a human-readable string. */
function formatClause(clause: { factId: string; operator: string; value: unknown; description?: string }): string {
  if (clause.description) return clause.description;

  const fact = clause.factId.replace(/^(hand|bridge)\./, "");
  const op = clause.operator;
  const val = clause.value;

  if (op === "boolean") return val ? fact : `no ${fact}`;
  if (op === "gte") return `${fact} >= ${val}`;
  if (op === "lte") return `${fact} <= ${val}`;
  if (op === "eq") return `${fact} = ${val}`;
  if (op === "range" && typeof val === "object" && val !== null && "min" in val && "max" in val) {
    return `${fact}: ${(val as { min: number; max: number }).min}-${(val as { min: number; max: number }).max}`;
  }
  return `${fact} ${op} ${String(val)}`;
}

/** Build a LearningViewport from a resolved ConventionBundle. */
export function buildLearningViewport(bundle: ConventionBundle): LearningViewport {
  const teaching = bundle.teaching;

  return {
    id: bundle.id,
    name: bundle.name.replace(/\s*\(Bundle\)\s*$/i, ""),
    description: bundle.description,
    category: bundle.category,

    purpose: teaching?.purpose ?? null,
    whenToUse: teaching?.whenToUse ?? null,
    whenNotToUse: teaching?.whenNotToUse ?? [],
    tradeoff: teaching?.tradeoff ?? null,
    principle: teaching?.principle ?? null,
    roles: teaching?.roles ?? null,

    modules: bundle.modules.map((mod) => buildModuleView(mod)),
  };
}

function buildModuleView(mod: ConventionModule): ModuleView {
  const surfaces = moduleSurfaces(mod);
  return {
    moduleId: mod.moduleId,
    displayName: formatModuleName(mod.moduleId),
    description: mod.description,
    purpose: mod.purpose,
    surfaceCount: surfaces.length,
    surfaces: surfaces.map((s) => ({
      meaningId: s.meaningId,
      teachingLabel: s.teachingLabel,
      call: s.encoding.defaultCall,
      callDisplay: formatCall(s.encoding.defaultCall),
      disclosure: s.disclosure,
      recommendation: s.ranking.recommendationBand ?? null,
      constraints: s.clauses.map((c) => ({
        factId: c.factId,
        description: formatClause(c),
      })),
    })),
  };
}
