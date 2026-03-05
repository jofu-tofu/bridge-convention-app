// Neutral helper for overlay tree-replacement logic.
// Shared by both registry.ts (evaluateBiddingRules) and candidate-generator.ts.
// Imports only from leaf modules (tree-evaluator, rule-tree) to avoid coupling direction issues.

import type { RuleNode } from "./rule-tree";
import type { TreeEvalResult } from "./tree-evaluator";
import { evaluateTree } from "./tree-evaluator";
import type { BiddingContext } from "./types";
import type { ConventionOverlayPatch } from "./overlay";

export interface OverlayTreeReplacementResult {
  readonly root: RuleNode;
  readonly result: TreeEvalResult;
  readonly overlayId?: string;
}

/** Apply first overlay's replacementTree to re-evaluate the hand tree.
 *  Returns original root/result if no overlay has a replacementTree. */
export function applyOverlayTreeReplacement(
  overlays: readonly ConventionOverlayPatch[],
  root: RuleNode,
  context: BiddingContext,
  originalResult: TreeEvalResult,
): OverlayTreeReplacementResult {
  for (const overlay of overlays) {
    if (overlay.replacementTree) {
      return {
        root: overlay.replacementTree,
        result: evaluateTree(overlay.replacementTree, context),
        overlayId: overlay.id,
      };
    }
  }
  return { root, result: originalResult };
}
