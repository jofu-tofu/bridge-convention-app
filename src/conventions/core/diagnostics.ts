// Diagnostics — registration-time analysis for convention structural issues.
// Returns warnings/errors, not enforcement. Consumed by tests and dev tools.

import type { ConventionConfig } from "./types";
import type { ConventionOverlayPatch } from "./overlay";
import type { RuleNode } from "./rule-tree";

export interface DiagnosticWarning {
  readonly type:
    | "duplicate-node-id"
    | "overlay-priority-conflict"
    | "trigger-overlap"
    | "unreachable-node";
  readonly severity: "error" | "warning";
  readonly message: string;
}

/** Collect all IntentNode nodeIds from a tree, detecting duplicates. */
function collectNodeIds(node: RuleNode, seen: Map<string, string[]>): void {
  switch (node.type) {
    case "intent": {
      const existing = seen.get(node.nodeId);
      if (existing) {
        existing.push(node.name);
      } else {
        seen.set(node.nodeId, [node.name]);
      }
      return;
    }
    case "decision":
      collectNodeIds(node.yes, seen);
      collectNodeIds(node.no, seen);
      return;
    case "fallback":
      return;
  }
}

/** Check for duplicate nodeIds across all trees in a protocol. */
export function analyzeNodeIdUniqueness(config: ConventionConfig): DiagnosticWarning[] {
  if (!config.protocol) return [];

  const seen = new Map<string, string[]>();
  for (const round of config.protocol.rounds) {
    // handTree can be a function or a static node — call if function
    const tree = typeof round.handTree === "function" ? round.handTree({}) : round.handTree;
    if (tree) collectNodeIds(tree as RuleNode, seen);
  }

  // Also check overlay replacement trees
  if (config.overlays) {
    for (const overlay of config.overlays) {
      if (overlay.replacementTree) {
        collectNodeIds(overlay.replacementTree as RuleNode, seen);
      }
    }
  }

  const warnings: DiagnosticWarning[] = [];
  for (const [nodeId, names] of seen) {
    if (names.length > 1) {
      warnings.push({
        type: "duplicate-node-id",
        severity: "error",
        message: `Duplicate nodeId "${nodeId}" found across nodes: ${names.join(", ")}`,
      });
    }
  }
  return warnings;
}

/** Check for overlay priority conflicts (same roundName + same priority). */
export function analyzeOverlayConflicts(overlays: readonly ConventionOverlayPatch[]): DiagnosticWarning[] {
  const warnings: DiagnosticWarning[] = [];
  const byRound = new Map<string, ConventionOverlayPatch[]>();

  for (const overlay of overlays) {
    const existing = byRound.get(overlay.roundName);
    if (existing) {
      existing.push(overlay);
    } else {
      byRound.set(overlay.roundName, [overlay]);
    }
  }

  for (const [roundName, group] of byRound) {
    if (group.length < 2) continue;

    // Check for same-priority pairs
    const byPriority = new Map<number, ConventionOverlayPatch[]>();
    for (const overlay of group) {
      const p = overlay.priority ?? 0;
      const existing = byPriority.get(p);
      if (existing) {
        existing.push(overlay);
      } else {
        byPriority.set(p, [overlay]);
      }
    }

    for (const [priority, sameP] of byPriority) {
      if (sameP.length >= 2) {
        warnings.push({
          type: "overlay-priority-conflict",
          severity: "error",
          message: `Overlays ${sameP.map(o => `"${o.id}"`).join(", ")} on round "${roundName}" ` +
            `share priority ${priority}. Precedence is undefined — assign distinct priorities.`,
        });
      }
    }
  }
  return warnings;
}

/** Run all diagnostic analyzers on a convention config. */
export function analyzeConvention(config: ConventionConfig): DiagnosticWarning[] {
  const warnings: DiagnosticWarning[] = [];

  warnings.push(...analyzeNodeIdUniqueness(config));

  if (config.overlays) {
    warnings.push(...analyzeOverlayConflicts(config.overlays));
  }

  return warnings;
}
