// Diagnostics — registration-time analysis for convention structural issues.
// Returns warnings/errors, not enforcement. Consumed by tests and dev tools.

import type { AuctionCondition, ConventionConfig } from "./types";
import type { ConventionOverlayPatch } from "./overlay/overlay";
import type { RuleNode } from "./tree/rule-tree";
import type { TransitionRuleDescriptor } from "./dialogue/dialogue-transitions";
import { descriptorSubsumes, descriptorsDisjoint } from "./trigger-descriptor";

export interface DiagnosticWarning {
  readonly type:
    | "duplicate-node-id"
    | "overlay-priority-conflict"
    | "trigger-shadow"
    | "missing-resolver"
    | "unreachable-node"
    | "full-scope-trigger"
    | "transition-rule-overlap";
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

/** Detect when an earlier trigger in a round subsumes a later one (intra-round shadowing). */
export function analyzeIntraRoundShadowing(config: ConventionConfig): DiagnosticWarning[] {
  if (!config.protocol) return [];

  const warnings: DiagnosticWarning[] = [];
  for (const round of config.protocol.rounds) {
    for (let i = 0; i < round.triggers.length; i++) {
      for (let j = i + 1; j < round.triggers.length; j++) {
        const descA = round.triggers[i]!.condition.descriptor;
        const descB = round.triggers[j]!.condition.descriptor;
        if (descriptorSubsumes(descA, descB)) {
          warnings.push({
            type: "trigger-shadow",
            severity: "warning",
            message: `Protocol "${config.id}" round "${round.name}": trigger[${i}] "${round.triggers[i]!.condition.name}" ` +
              `subsumes trigger[${j}] "${round.triggers[j]!.condition.name}" — trigger[${j}] is shadowed and unreachable.`,
          });
        }
      }
    }
  }
  return warnings;
}

/** Check if two seatFilters are provably disjoint via their descriptors. */
function seatFilterDisjoint(a?: AuctionCondition, b?: AuctionCondition): boolean {
  if (!a || !b) return false;
  return descriptorsDisjoint(a.descriptor, b.descriptor);
}

/** Detect when a later round's triggers are all subsumed by an earlier round (cross-round unreachable). */
export function analyzeCrossRoundUnreachable(config: ConventionConfig): DiagnosticWarning[] {
  if (!config.protocol) return [];

  const warnings: DiagnosticWarning[] = [];
  const rounds = config.protocol.rounds;

  for (let i = 0; i < rounds.length; i++) {
    for (let j = i + 1; j < rounds.length; j++) {
      const roundI = rounds[i]!;
      const roundJ = rounds[j]!;

      // Check if every trigger in round j is subsumed by some trigger in round i
      const allSubsumed = roundJ.triggers.every(trigJ =>
        roundI.triggers.some(trigI =>
          descriptorSubsumes(trigI.condition.descriptor, trigJ.condition.descriptor),
        ),
      );

      if (!allSubsumed) continue;

      // Suppress if seatFilters are disjoint (intentional pattern, e.g., Bergen opener vs responder)
      if (seatFilterDisjoint(roundI.seatFilter, roundJ.seatFilter)) continue;

      warnings.push({
        type: "unreachable-node",
        severity: "warning",
        message: `Protocol "${config.id}" round "${roundJ.name}" is unreachable — ` +
          `all its triggers are subsumed by earlier round "${roundI.name}".`,
      });
    }
  }
  return warnings;
}

/** Check if two transition rule descriptors could match the same (state, entry) pair. */
function transitionDescriptorsOverlap(a: TransitionRuleDescriptor, b: TransitionRuleDescriptor): boolean {
  // Two descriptors are disjoint if any shared field has different non-undefined values
  if (a.familyId !== undefined && b.familyId !== undefined && a.familyId !== b.familyId) return false;
  if (a.obligationKind !== undefined && b.obligationKind !== undefined && a.obligationKind !== b.obligationKind) return false;
  if (a.callType !== undefined && b.callType !== undefined && a.callType !== b.callType) return false;
  if (a.level !== undefined && b.level !== undefined && a.level !== b.level) return false;
  if (a.strain !== undefined && b.strain !== undefined && a.strain !== b.strain) return false;
  if (a.actorRelation !== undefined && b.actorRelation !== undefined && a.actorRelation !== b.actorRelation) return false;
  return true;
}

/** Detect when two transition rules could match the same (state, entry) pair. */
export function analyzeTransitionRuleOverlap(config: ConventionConfig): DiagnosticWarning[] {
  if (!config.transitionRules) return [];

  const warnings: DiagnosticWarning[] = [];
  const rules = config.transitionRules;

  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const descA = rules[i]!.matchDescriptor;
      const descB = rules[j]!.matchDescriptor;
      if (!descA || !descB) continue;

      if (transitionDescriptorsOverlap(descA, descB)) {
        warnings.push({
          type: "transition-rule-overlap",
          severity: "warning",
          message: `Transition rule "${rules[i]!.id}" may shadow "${rules[j]!.id}" — ` +
            `their match descriptors overlap.`,
        });
      }
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
  warnings.push(...analyzeIntraRoundShadowing(config));
  warnings.push(...analyzeCrossRoundUnreachable(config));
  warnings.push(...analyzeTransitionRuleOverlap(config));
  warnings.push(...analyzeTriggerScope(config));

  if (config.overlays) {
    warnings.push(...analyzeOverlayConflicts(config.overlays));
    warnings.push(...analyzeOverlayTriggerScope(config.overlays));
  }

  return warnings;
}
