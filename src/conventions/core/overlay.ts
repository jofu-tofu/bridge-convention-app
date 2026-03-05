import { validateTree } from "./rule-tree";
import type { HandNode } from "./rule-tree";
import type { DialogueState } from "./dialogue/dialogue-state";
import type { ConventionProtocol, SemanticTrigger } from "./protocol";
import type { CollectedIntent } from "./intent-collector";
import type { EffectiveConventionContext } from "./effective-context";
import type { SemanticIntent } from "./intent/semantic-intent";
import type { ResolverResult } from "./intent/intent-resolver";

export interface ConventionOverlayPatch {
  readonly id: string;
  /** Which protocol round this overlay applies to (must match a ProtocolRound.name). */
  readonly roundName: string;
  /** Sort order when multiple overlays match. Lower number = higher precedence. Default 0. */
  readonly priority?: number;
  /** Test whether this overlay should activate. Pure function of dialogue state. */
  matches(state: DialogueState): boolean;

  /** Full tree replacement (backward compat, renamed from handTree). */
  readonly replacementTree?: HandNode;

  /** Remove specific intents from candidate list. Returns true to suppress. */
  suppressIntent?(intent: CollectedIntent, ctx: EffectiveConventionContext): boolean;
  /** Add intents not in the tree. Returned intents have no sourceNode. */
  addIntents?(ctx: EffectiveConventionContext): CollectedIntent[];
  /** Override standard resolver for an intent. Return ResolverResult to override, null to fallthrough. */
  overrideResolver?(intent: SemanticIntent, ctx: EffectiveConventionContext): ResolverResult | null;

  /** Override triggers for protocol rounds. When present and overlay matches,
   *  these triggers replace the round's original triggers during protocol evaluation. */
  readonly triggerOverrides?: ReadonlyMap<string, readonly SemanticTrigger[]>;
}

/** @deprecated Use ConventionOverlayPatch instead. */
export type ConventionOverlay = ConventionOverlayPatch;

/**
 * Validate overlay patches against a protocol at registration time.
 * Throws if any overlay references a round name not in the protocol.
 */
export function validateOverlayPatches(
  overlays: readonly ConventionOverlayPatch[],
  proto: ConventionProtocol,
): void {
  const roundNames = new Set(proto.rounds.map(r => r.name));
  for (const overlay of overlays) {
    if (!roundNames.has(overlay.roundName)) {
      throw new Error(
        `Overlay "${overlay.id}" references round "${overlay.roundName}" ` +
        `which does not exist in protocol "${proto.id}". ` +
        `Available rounds: ${[...roundNames].join(", ")}`,
      );
    }
    if (overlay.replacementTree) {
      validateTree(overlay.replacementTree);
    }
    if (overlay.triggerOverrides) {
      for (const key of overlay.triggerOverrides.keys()) {
        if (!roundNames.has(key)) {
          throw new Error(
            `Overlay "${overlay.id}" triggerOverrides references round "${key}" ` +
            `which does not exist in protocol "${proto.id}". ` +
            `Available rounds: ${[...roundNames].join(", ")}`,
          );
        }
      }
    }
  }
}

/**
 * Collect trigger overrides from matching overlays, unified with priority sorting.
 * Filters overlays by `matches(dialogueState)`, sorts by `priority ?? 0`,
 * and merges trigger maps with first-wins per round-name key.
 *
 * Returns undefined when no matching overlay has trigger overrides.
 */
export function collectTriggerOverrides(
  overlays: readonly ConventionOverlayPatch[],
  dialogueState: DialogueState,
): ReadonlyMap<string, readonly SemanticTrigger[]> | undefined {
  const matching = overlays
    .filter(o => o.matches(dialogueState) && o.triggerOverrides)
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

  if (matching.length === 0) return undefined;

  const merged = new Map<string, readonly SemanticTrigger[]>();
  for (const overlay of matching) {
    for (const [roundName, triggers] of overlay.triggerOverrides!) {
      if (!merged.has(roundName)) {
        merged.set(roundName, triggers);
      }
    }
  }
  return merged;
}

/** @deprecated Use validateOverlayPatches instead. */
export const validateOverlays = validateOverlayPatches;
