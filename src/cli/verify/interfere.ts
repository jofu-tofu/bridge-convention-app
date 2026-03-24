/**
 * Pairwise interference analysis for convention module composition.
 *
 * Static analysis over ConventionModule pairs to detect potential conflicts:
 * - Activation overlap: rules that could fire at the same snapshot
 * - Encoding collision: claims that encode to the same bid
 * - Observation crosstalk: claims whose observations trigger foreign transitions
 * - Kernel conflict: claims that write the same kernel state field
 */

import type { ConventionModule, ResolvedSurface, ObsPattern, TurnRole, NegotiationExpr, RouteExpr } from "../../conventions";
import type { InterferenceEdge, PairInteraction } from "./types";
import { normalizeIntent, matchObs } from "../../conventions";
import { callKey } from "../../engine/call-helpers";

/** Normalized rule view for interference analysis. */
interface NormalizedRule {
  readonly match: {
    readonly turn?: TurnRole;
    readonly kernel?: NegotiationExpr;
    readonly route?: RouteExpr;
    readonly local?: string | readonly string[];
  };
  readonly resolved: readonly ResolvedSurface[];
}

/** Convert a module's state entries into normalized rules for analysis. */
function getVirtualRules(mod: ConventionModule): readonly NormalizedRule[] {
  return (mod.states ?? []).map((entry) => ({
    match: {
      turn: entry.turn,
      local: entry.phase,
      kernel: entry.kernel,
      route: entry.route,
    },
    resolved: entry.surfaces.map((surface): ResolvedSurface =>
      entry.negotiationDelta
        ? { surface, negotiationDelta: entry.negotiationDelta }
        : { surface },
    ),
  }));
}

// ── Risk ordering ─────────────────────────────────────────────────

const RISK_ORDER: Record<InterferenceEdge["risk"], number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
};

// ── Helpers ───────────────────────────────────────────────────────

/** Summarize a rule's match block for diagnostic output. */
function summarizeMatch(rule: NormalizedRule, ruleIndex: number): string {
  const parts: string[] = [`rule[${ruleIndex}]`];
  if (rule.match.turn) parts.push(`turn=${rule.match.turn}`);
  if (rule.match.local) {
    const phases = Array.isArray(rule.match.local) ? rule.match.local : [rule.match.local];
    parts.push(`phase=${phases.join("|")}`);
  }
  return parts.join(" ");
}

/** Extract the set of phase strings from a rule's local match guard. */
function getPhases(rule: NormalizedRule): readonly string[] {
  const local = rule.match.local;
  if (local === undefined) return ["idle"];
  if (typeof local === "string") return [local];
  return local;
}

/** Check whether two turn guards are compatible (could both fire). */
function turnsCompatible(
  turnA: NormalizedRule["match"]["turn"],
  turnB: NormalizedRule["match"]["turn"],
): boolean {
  // Undefined = wildcard, compatible with anything
  if (turnA === undefined || turnB === undefined) return true;
  return turnA === turnB;
}

/** Check whether two phase guard sets overlap. */
function phasesCompatible(
  phasesA: readonly string[],
  phasesB: readonly string[],
): boolean {
  // Both include "idle" (every module starts idle)
  if (phasesA.includes("idle") && phasesB.includes("idle")) return true;
  // Any shared phase name
  return phasesA.some((p) => phasesB.includes(p));
}

// ── Activation overlap ──────────────────────────────────────────

/**
 * Detect rule pairs where both could fire at the same snapshot.
 *
 * Conservative over-approximation: compatible turn + phase guards.
 */
export function detectActivationOverlap(a: ConventionModule, b: ConventionModule): InterferenceEdge[] {
  const edges: InterferenceEdge[] = [];
  const rulesA = getVirtualRules(a);
  const rulesB = getVirtualRules(b);

  for (let ai = 0; ai < rulesA.length; ai++) {
    const ruleA = rulesA[ai]!;
    const phasesA = getPhases(ruleA);

    for (let bi = 0; bi < rulesB.length; bi++) {
      const ruleB = rulesB[bi]!;
      const phasesB = getPhases(ruleB);

      if (turnsCompatible(ruleA.match.turn, ruleB.match.turn) && phasesCompatible(phasesA, phasesB)) {
        edges.push({
          kind: "activation-overlap",
          description: `Rules could co-fire: ${a.moduleId}[${ai}] and ${b.moduleId}[${bi}]`,
          risk: "low",
          ruleA: { ruleIndex: ai, matchSummary: summarizeMatch(ruleA, ai) },
          ruleB: { ruleIndex: bi, matchSummary: summarizeMatch(ruleB, bi) },
        });
      }
    }
  }

  return edges;
}

// ── Encoding collision ──────────────────────────────────────────

/**
 * Detect claims across modules that encode to the same bid.
 *
 * Cross-product of all claims from A and B; flags when callKey matches
 * and turn guards are compatible.
 */
export function detectEncodingCollision(a: ConventionModule, b: ConventionModule): InterferenceEdge[] {
  const edges: InterferenceEdge[] = [];
  const rulesA = getVirtualRules(a);
  const rulesB = getVirtualRules(b);

  for (let ai = 0; ai < rulesA.length; ai++) {
    const ruleA = rulesA[ai]!;

    for (let bi = 0; bi < rulesB.length; bi++) {
      const ruleB = rulesB[bi]!;

      if (!turnsCompatible(ruleA.match.turn, ruleB.match.turn)) continue;

      for (const entryA of ruleA.resolved) {
        const keyA = callKey(entryA.surface.encoding.defaultCall);

        for (const entryB of ruleB.resolved) {
          const keyB = callKey(entryB.surface.encoding.defaultCall);

          if (keyA === keyB) {
            // Same band and compatible turn → high risk; otherwise medium
            const sameBand =
              entryA.surface.ranking.recommendationBand ===
              entryB.surface.ranking.recommendationBand;
            const risk = sameBand ? "high" : "medium";

            edges.push({
              kind: "encoding-collision",
              description: `Both claim ${keyA}: ${a.moduleId}/${entryA.surface.meaningId} vs ${b.moduleId}/${entryB.surface.meaningId}`,
              risk,
              ruleA: { ruleIndex: ai, matchSummary: summarizeMatch(ruleA, ai) },
              ruleB: { ruleIndex: bi, matchSummary: summarizeMatch(ruleB, bi) },
              detail: `band A=${entryA.surface.ranking.recommendationBand}, band B=${entryB.surface.ranking.recommendationBand}`,
            });
          }
        }
      }
    }
  }

  return edges;
}

// ── Observation crosstalk ───────────────────────────────────────

/**
 * Detect when a claim's canonical observations could trigger another module's
 * phase transitions.
 *
 * For each claim in A, normalizes sourceIntent → BidAction[], then checks
 * against B's transitions. Also checks reverse (B→A).
 */
export function detectObservationCrosstalk(a: ConventionModule, b: ConventionModule): InterferenceEdge[] {
  const edges: InterferenceEdge[] = [];

  // A's claims → B's transitions
  detectCrosstalkDirection(a, b, edges);
  // B's claims → A's transitions
  detectCrosstalkDirection(b, a, edges);

  return edges;
}

function detectCrosstalkDirection(
  source: ConventionModule,
  target: ConventionModule,
  edges: InterferenceEdge[],
): void {
  const sourceRules = getVirtualRules(source);
  for (let ri = 0; ri < sourceRules.length; ri++) {
    const rule = sourceRules[ri]!;

    for (const entry of rule.resolved) {
      const canonicalObs = normalizeIntent(entry.surface.sourceIntent);
      if (canonicalObs.length === 0) continue;

      for (const obs of canonicalObs) {
        for (const transition of target.local.transitions) {
          if (matchObs(transition.on, obs)) {
            edges.push({
              kind: "observation-crosstalk",
              description: `${source.moduleId}/${entry.surface.meaningId} obs could trigger ${target.moduleId} transition ${formatTransition(transition.on)}`,
              risk: "medium",
              ruleA: { ruleIndex: ri, matchSummary: summarizeMatch(rule, ri) },
              detail: `obs act=${obs.act}, transition from=${String(transition.from)} to=${transition.to}`,
            });
          }
        }
      }
    }
  }
}

function formatTransition(pattern: ObsPattern): string {
  const parts = [`act=${pattern.act}`];
  if (pattern.feature) parts.push(`feature=${pattern.feature}`);
  if (pattern.suit) parts.push(`suit=${pattern.suit}`);
  return parts.join(",");
}

// ── Kernel conflict ─────────────────────────────────────────────

/**
 * Detect when both modules write the same kernel state field.
 */
export function detectKernelConflict(a: ConventionModule, b: ConventionModule): InterferenceEdge[] {
  const edges: InterferenceEdge[] = [];

  // Collect all (ruleIndex, field, value) tuples from each module
  const deltasA = collectKernelDeltas(a);
  const deltasB = collectKernelDeltas(b);

  for (const entryA of deltasA) {
    for (const entryB of deltasB) {
      if (entryA.field === entryB.field) {
        const sameValue = JSON.stringify(entryA.value) === JSON.stringify(entryB.value);
        edges.push({
          kind: "kernel-conflict",
          description: `Both write kernel.${entryA.field}: ${a.moduleId}[${entryA.ruleIndex}] vs ${b.moduleId}[${entryB.ruleIndex}]`,
          risk: sameValue ? "low" : "medium",
          ruleA: { ruleIndex: entryA.ruleIndex, matchSummary: entryA.meaningId },
          ruleB: { ruleIndex: entryB.ruleIndex, matchSummary: entryB.meaningId },
          detail: sameValue
            ? `same value: ${JSON.stringify(entryA.value)}`
            : `A=${JSON.stringify(entryA.value)}, B=${JSON.stringify(entryB.value)}`,
        });
      }
    }
  }

  return edges;
}

interface KernelDeltaEntry {
  readonly ruleIndex: number;
  readonly meaningId: string;
  readonly field: string;
  readonly value: unknown;
}

function collectKernelDeltas(mod: ConventionModule): KernelDeltaEntry[] {
  const entries: KernelDeltaEntry[] = [];

  const modRules = getVirtualRules(mod);
  for (let ri = 0; ri < modRules.length; ri++) {
    const rule = modRules[ri]!;
    for (const entry of rule.resolved) {
      if (!entry.negotiationDelta) continue;
      for (const [field, value] of Object.entries(entry.negotiationDelta)) {
        if (value !== undefined) {
          entries.push({
            ruleIndex: ri,
            meaningId: entry.surface.meaningId,
            field,
            value,
          });
        }
      }
    }
  }

  return entries;
}

// ── Pair analysis ───────────────────────────────────────────────

/**
 * Full pairwise analysis of two modules across all interference dimensions.
 */
export function analyzeModulePair(a: ConventionModule, b: ConventionModule): InterferenceEdge[] {
  return [
    ...detectActivationOverlap(a, b),
    ...detectEncodingCollision(a, b),
    ...detectObservationCrosstalk(a, b),
    ...detectKernelConflict(a, b),
  ];
}

// ── Risk classification ─────────────────────────────────────────

/**
 * Classify overall risk from a set of interference edges.
 * Returns the maximum risk level found.
 */
export function classifyPairRisk(edges: readonly InterferenceEdge[]): "high" | "medium" | "low" | "none" {
  let maxRisk: InterferenceEdge["risk"] = "none";

  for (const edge of edges) {
    if (RISK_ORDER[edge.risk] > RISK_ORDER[maxRisk]) {
      maxRisk = edge.risk;
    }
  }

  return maxRisk;
}

// ── Bundle analysis ─────────────────────────────────────────────

/**
 * All-pairs interference analysis across a bundle's modules.
 */
export function analyzeBundle(modules: readonly ConventionModule[]): PairInteraction[] {
  const interactions: PairInteraction[] = [];

  for (let i = 0; i < modules.length; i++) {
    for (let j = i + 1; j < modules.length; j++) {
      const a = modules[i]!;
      const b = modules[j]!;
      const edges = analyzeModulePair(a, b);

      interactions.push({
        moduleA: a.moduleId,
        moduleB: b.moduleId,
        edges,
        riskLevel: classifyPairRisk(edges),
      });
    }
  }

  return interactions;
}
