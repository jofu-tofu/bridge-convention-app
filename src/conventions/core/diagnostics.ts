// Diagnostics — registration-time analysis for convention structural issues.
// Returns warnings/errors, not enforcement. Consumed by tests and dev tools.

import type { ConventionConfig } from "./types";
import type { ConventionOverlayPatch } from "./overlay/overlay";
import type { RuleNode } from "./tree/rule-tree";

export interface DiagnosticWarning {
  readonly type:
    | "duplicate-node-id"
    | "overlay-priority-conflict"
    | "trigger-overlap"
    | "missing-resolver"
    | "unreachable-node"
    | "full-scope-trigger";
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

/** Collect all semantic intent types referenced by IntentNode leaves. */
function collectIntentTypes(node: RuleNode, seen: Set<string>): void {
  switch (node.type) {
    case "intent":
      seen.add(node.intent.type);
      return;
    case "decision":
      collectIntentTypes(node.yes, seen);
      collectIntentTypes(node.no, seen);
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

/** Check for intent types in protocol trees that have no configured resolver. */
export function analyzeMissingResolvers(config: ConventionConfig): DiagnosticWarning[] {
  if (!config.protocol || config.intentResolvers === undefined) return [];

  const intentTypes = new Set<string>();

  for (const round of config.protocol.rounds) {
    const tree = typeof round.handTree === "function" ? round.handTree({}) : round.handTree;
    collectIntentTypes(tree as RuleNode, intentTypes);
  }

  if (config.overlays) {
    for (const overlay of config.overlays) {
      if (overlay.replacementTree) {
        collectIntentTypes(overlay.replacementTree as RuleNode, intentTypes);
      }
    }
  }

  const warnings: DiagnosticWarning[] = [];
  for (const intentType of intentTypes) {
    if (!config.intentResolvers.has(intentType)) {
      warnings.push({
        type: "missing-resolver",
        severity: "warning",
        message: `Intent type "${intentType}" has no resolver in convention "${config.id}"`,
      });
    }
  }
  return warnings;
}

/** Check whether two or more rounds reuse the same trigger condition name. */
export function analyzeTriggerOverlaps(config: ConventionConfig): DiagnosticWarning[] {
  if (!config.protocol) return [];

  const triggerToRounds = new Map<string, Set<string>>();
  for (const round of config.protocol.rounds) {
    for (const trigger of round.triggers) {
      const existing = triggerToRounds.get(trigger.condition.name);
      if (existing) {
        existing.add(round.name);
      } else {
        triggerToRounds.set(trigger.condition.name, new Set([round.name]));
      }
    }
  }

  const warnings: DiagnosticWarning[] = [];
  for (const [triggerName, rounds] of triggerToRounds) {
    if (rounds.size > 1) {
      warnings.push({
        type: "trigger-overlap",
        severity: "warning",
        message: `Trigger "${triggerName}" appears in multiple rounds: ${[...rounds].join(", ")}`,
      });
    }
  }
  return warnings;
}

/** Check for full-scope conditions used as protocol triggers. */
export function analyzeTriggerScope(config: ConventionConfig): DiagnosticWarning[] {
  if (!config.protocol) return [];

  const warnings: DiagnosticWarning[] = [];
  for (const r of config.protocol.rounds) {
    for (const trigger of r.triggers) {
      if (trigger.condition.triggerScope === "full") {
        warnings.push({
          type: "full-scope-trigger",
          severity: "warning",
          message: `Protocol "${config.id}" round "${r.name}" trigger "${trigger.condition.name}" ` +
            `has triggerScope "full" — protocol triggers should use event-local conditions. ` +
            `Use seatFilter for full-history conditions.`,
        });
      }
    }
  }
  return warnings;
}

/** Check for full-scope conditions used as overlay trigger overrides. */
export function analyzeOverlayTriggerScope(overlays: readonly ConventionOverlayPatch[]): DiagnosticWarning[] {
  const warnings: DiagnosticWarning[] = [];
  for (const overlay of overlays) {
    if (!overlay.triggerOverrides) continue;
    for (const [_roundName, triggers] of overlay.triggerOverrides) {
      for (const trigger of triggers) {
        if (trigger.condition.triggerScope === "full") {
          warnings.push({
            type: "full-scope-trigger",
            severity: "warning",
            message: `Overlay "${overlay.id}" trigger "${trigger.condition.name}" ` +
              `has triggerScope "full" — protocol triggers should use event-local conditions.`,
          });
        }
      }
    }
  }
  return warnings;
}

/** Run all diagnostic analyzers on a convention config. */
export function analyzeConvention(config: ConventionConfig): DiagnosticWarning[] {
  const warnings: DiagnosticWarning[] = [];

  warnings.push(...analyzeNodeIdUniqueness(config));
  warnings.push(...analyzeMissingResolvers(config));
  warnings.push(...analyzeTriggerOverlaps(config));
  warnings.push(...analyzeTriggerScope(config));

  if (config.overlays) {
    warnings.push(...analyzeOverlayConflicts(config.overlays));
    warnings.push(...analyzeOverlayTriggerScope(config.overlays));
  }

  return warnings;
}
