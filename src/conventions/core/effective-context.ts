// EffectiveConventionContext — bundles raw BiddingContext + protocol result + dialogue state.
// Replaces ad-hoc construction in conventionToStrategy.

import type { Seat, Suit } from "../../engine/types";
import type { BiddingContext, ConventionConfig } from "./types";
import type { ProtocolEvalResult } from "./protocol";
import type { DialogueState } from "./dialogue/dialogue-state";
import { computeDialogueState } from "./dialogue/dialogue-manager";
import { baselineTransitionRules } from "./dialogue/baseline-transitions";
import type { ConventionOverlayPatch } from "./overlay";

/** Belief data passed from inference layer. Structural match avoids import coupling. */
export interface BeliefData {
  readonly beliefs: Record<Seat, {
    readonly hcpRange: { readonly min: number; readonly max: number };
    readonly suitLengths: Record<Suit, { readonly min: number; readonly max: number }>;
  }>;
}

export interface EffectiveConventionContext {
  readonly raw: BiddingContext;
  readonly config: ConventionConfig;
  readonly protocolResult: ProtocolEvalResult;
  readonly dialogueState: DialogueState;
  readonly activeOverlays: readonly ConventionOverlayPatch[];
  /** Public belief state from inference layer. Optional — no consumer reads it yet. */
  readonly publicBelief?: BeliefData;
}

/**
 * Build an EffectiveConventionContext by computing DialogueState from the auction.
 * Uses config.transitionRules if present, otherwise falls back to baseline transitions.
 * Resolves active overlays (all matching) if config.overlays is present.
 */
export function buildEffectiveContext(
  raw: BiddingContext,
  config: ConventionConfig,
  protocolResult: ProtocolEvalResult,
  publicBelief?: BeliefData,
): EffectiveConventionContext {
  const dialogueState = config.baselineRules
    ? computeDialogueState(raw.auction, config.transitionRules ?? [], config.baselineRules)
    : computeDialogueState(raw.auction, config.transitionRules ?? baselineTransitionRules);

  const filtered = config.overlays?.filter(
    o => o.roundName === protocolResult.activeRound?.name && o.matches(dialogueState),
  ) ?? [];
  const activeOverlays = [...filtered].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

  return {
    raw,
    config,
    protocolResult,
    dialogueState,
    activeOverlays,
    publicBelief,
  };
}
