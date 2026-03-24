/**
 * Call View Builder
 *
 * Extracted from teaching-projection-builder.ts — builds CallProjection[] from
 * truth set and acceptable set.
 */

import type { Call } from "../../engine/types";

import type {
  ArbitrationResult,
  EncodedProposal,
} from "../pipeline/pipeline-types";

import type {
  CallProjection,
} from "./teaching-types";

// -- Call Views --

/**
 * Build CallProjection[] from truth set and acceptable set.
 *
 * Projection rules (per spec):
 *   - Same call + same semanticClassId -> "merged-equivalent"
 *   - Same call + different semanticClassIds -> "multi-rationale-same-call"
 *   - Single meaning for a call -> "single-rationale"
 */
export function buildCallViews(arbitration: ArbitrationResult): CallProjection[] {
  const views: CallProjection[] = [];

  const truthCallGroups = groupByCall(arbitration.truthSet);
  for (const [, encodeds] of truthCallGroups) {
    views.push(buildProjection(encodeds, "truth"));
  }

  const truthCallKeys = new Set([...truthCallGroups.keys()]);
  const acceptableCallGroups = groupByCall(arbitration.acceptableSet);
  for (const [key, encodeds] of acceptableCallGroups) {
    if (truthCallKeys.has(key)) continue;
    views.push(buildProjection(encodeds, "acceptable"));
  }

  return views;
}

/** Build a single CallProjection from a group of encoded proposals. */
function buildProjection(
  encodeds: readonly EncodedProposal[],
  status: CallProjection["status"],
): CallProjection {
  return {
    call: encodeds[0]!.call,
    status,
    supportingMeanings: encodeds.map(e => e.proposal.meaningId),
    primaryMeaning: selectPrimaryMeaning(encodeds),
    projectionKind: classifyProjectionKind(encodeds),
  };
}

/** Group encoded proposals by their concrete call. */
function groupByCall(
  encoded: readonly EncodedProposal[],
): Map<string, EncodedProposal[]> {
  const groups = new Map<string, EncodedProposal[]>();
  for (const e of encoded) {
    const key = formatCallKey(e.call);
    const group = groups.get(key);
    if (group) {
      group.push(e);
    } else {
      groups.set(key, [e]);
    }
  }
  return groups;
}

/** Produce a stable string key for call grouping. */
function formatCallKey(call: Call): string {
  if (call.type === "bid") {
    return `${call.level}${call.strain}`;
  }
  return call.type;
}

/** Classify the projectionKind for a group of proposals encoding to the same call. */
function classifyProjectionKind(
  encodeds: readonly EncodedProposal[],
): CallProjection["projectionKind"] {
  if (encodeds.length <= 1) return "single-rationale";

  const semanticClassIds = new Set(
    encodeds.map(e => e.proposal.semanticClassId).filter(Boolean),
  );

  // All share the same semanticClassId (or none have one, but there are multiple)
  if (semanticClassIds.size <= 1) return "merged-equivalent";

  return "multi-rationale-same-call";
}

/**
 * Select the primary meaning for display.
 * Per spec: prefer alphabetically by meaningId as a stable tiebreak.
 */
function selectPrimaryMeaning(encodeds: readonly EncodedProposal[]): string | undefined {
  if (encodeds.length === 0) return undefined;
  const sorted = [...encodeds].sort((a, b) =>
    a.proposal.meaningId.localeCompare(b.proposal.meaningId),
  );
  return sorted[0]!.proposal.meaningId;
}
