// Dialogue transition rules — how each bid changes the dialogue state.

import type { AuctionEntry, Auction, BidSuit } from "../../../engine/types";
import type { DialogueState, DialogueFrame, InterferenceDetail, Obligation } from "./dialogue-state";
import type {
  ForcingState,
  CompetitionMode,
  CaptainRole,
  SystemMode,
} from "./dialogue-state";
import type { AgreedStrain } from "./dialogue-state";
import { ObligationKind } from "./dialogue-state";

/**
 * A typed update to DialogueState. Uses `set*` prefix to prevent accidental
 * pass-through of a DialogueState object as an effect, and makes merge vs
 * replace intent explicit (`mergeConventionData` merges, not replaces).
 *
 * `activateOverlay` is a future seam — accepted by the type but ignored by
 * `applyEffect()`. DialogueState does NOT get an `activeOverlay` field.
 */
export interface DialogueEffect {
  readonly setFamilyId?: string | null;
  readonly setForcingState?: ForcingState;
  readonly setAgreedStrain?: AgreedStrain;
  readonly setObligation?: Obligation;
  readonly setCompetitionMode?: CompetitionMode;
  readonly setCaptain?: CaptainRole;
  readonly setSystemMode?: SystemMode;
  readonly setSystemCapability?: Readonly<Record<string, SystemMode>>;
  readonly mergeConventionData?: Readonly<Record<string, unknown>>;
  readonly setInterferenceDetail?: InterferenceDetail;
  readonly pushFrame?: DialogueFrame;
  readonly popFrame?: boolean;
  readonly activateOverlay?: string | null;
}

/**
 * A rule that tests whether it applies to a given state+bid,
 * and if so produces an effect (partial state update).
 * Rules are tested in order; first match wins.
 *
 * `entryIndex` is the 0-based position of the current entry being processed.
 * Rules MUST NOT examine auction entries beyond `entryIndex` — doing so
 * violates the causality contract (no peeking at future bids).
 */
/** Structured descriptor for transition rule overlap analysis. */
export interface TransitionRuleDescriptor {
  readonly familyId?: string | null;
  readonly obligationKind?: ObligationKind;
  readonly callType?: "bid" | "pass" | "double" | "redouble";
  readonly level?: number;
  readonly strain?: BidSuit;
  readonly actorRelation?: "opener" | "partner-of-opener" | "opponent" | "any";
}

export interface TransitionRule {
  readonly id: string;
  /** Structured metadata for overlap analysis. Optional — rules without
   *  descriptors are silently skipped by diagnostics. */
  readonly matchDescriptor?: TransitionRuleDescriptor;
  matches(state: DialogueState, entry: AuctionEntry, auction: Auction, entryIndex: number): boolean;
  effects(state: DialogueState, entry: AuctionEntry, auction: Auction, entryIndex: number): DialogueEffect;
}

/**
 * Returns the set of `set*`-prefixed keys with non-undefined values in an effect.
 * Used by two-pass backfill to know which fields the convention pass already set.
 */
export function getEffectKeys(effect: DialogueEffect): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const [key, value] of Object.entries(effect)) {
    if (key.startsWith("set") && value !== undefined) {
      keys.add(key);
    }
  }
  // mergeConventionData is not `set*`-prefixed but is a field that can conflict
  if (effect.mergeConventionData !== undefined) {
    keys.add("mergeConventionData");
  }
  if (effect.pushFrame !== undefined) {
    keys.add("pushFrame");
  }
  if (effect.popFrame !== undefined) {
    keys.add("popFrame");
  }
  return keys;
}

/**
 * Derive an obligation from the top frame on the stack.
 * Used after frame push/pop to automatically set obligation from frame context.
 */
export function obligationFromFrame(frame: DialogueFrame | undefined): Obligation {
  if (!frame) return { kind: ObligationKind.None, obligatedSide: "opener" };
  switch (frame.kind) {
    case "relay":
      return { kind: ObligationKind.CompleteRelay, obligatedSide: frame.owner };
    case "place-contract":
      return { kind: ObligationKind.PlaceContract, obligatedSide: frame.owner };
    default:
      return { kind: ObligationKind.None, obligatedSide: frame.owner };
  }
}

/**
 * Apply a DialogueEffect as a backfill — only sets fields NOT in `alreadySet`.
 * Used in two-pass mode: convention rules run first, baseline rules backfill gaps.
 *
 * For `mergeConventionData`: convention keys win over baseline keys (shallow merge).
 * Both passes contribute unique keys. If convention set `{ a: 1 }` and baseline
 * sets `{ a: 2, b: 3 }`, result is `{ a: 1, b: 3 }` — convention's `a` wins.
 */
export function applyBackfillEffect(
  state: DialogueState,
  effect: DialogueEffect,
  alreadySet: ReadonlySet<string>,
): DialogueState {
  let frames = [...(state.frames ?? [])];
  const hasFrameOp = (!alreadySet.has("popFrame") && effect.popFrame)
    || (!alreadySet.has("pushFrame") && effect.pushFrame);
  if (!alreadySet.has("popFrame") && effect.popFrame) {
    frames = frames.slice(0, -1);
  }
  if (!alreadySet.has("pushFrame") && effect.pushFrame) {
    frames = [...frames, effect.pushFrame];
  }

  // Obligation precedence: explicit setObligation > frame-derived > existing
  let obligation = state.obligation;
  if (!alreadySet.has("setObligation")) {
    if (effect.setObligation) {
      obligation = effect.setObligation;
    } else if (hasFrameOp) {
      obligation = obligationFromFrame(frames[frames.length - 1]);
    }
  }

  return {
    familyId: !alreadySet.has("setFamilyId") && effect.setFamilyId !== undefined
      ? effect.setFamilyId
      : state.familyId,
    forcingState: !alreadySet.has("setForcingState") && effect.setForcingState !== undefined
      ? effect.setForcingState
      : state.forcingState,
    agreedStrain: !alreadySet.has("setAgreedStrain") && effect.setAgreedStrain !== undefined
      ? effect.setAgreedStrain
      : state.agreedStrain,
    obligation,
    competitionMode: !alreadySet.has("setCompetitionMode") && effect.setCompetitionMode !== undefined
      ? effect.setCompetitionMode
      : state.competitionMode,
    captain: !alreadySet.has("setCaptain") && effect.setCaptain !== undefined
      ? effect.setCaptain
      : state.captain,
    systemMode: !alreadySet.has("setSystemMode") && effect.setSystemMode !== undefined
      ? effect.setSystemMode
      : state.systemMode,
    systemCapabilities: effect.setSystemCapability
      ? (alreadySet.has("setSystemCapability")
        // Convention already set capabilities — baseline fills only NEW keys
        ? { ...effect.setSystemCapability, ...state.systemCapabilities }
        : { ...state.systemCapabilities, ...effect.setSystemCapability })
      : state.systemCapabilities,
    conventionData: effect.mergeConventionData
      ? (alreadySet.has("mergeConventionData")
        // Convention already merged data — baseline contributes only NEW keys
        ? { ...state.conventionData, ...effect.mergeConventionData, ...extractConventionDataFromState(state, effect.mergeConventionData) }
        : { ...state.conventionData, ...effect.mergeConventionData })
      : state.conventionData,
    interferenceDetail: !alreadySet.has("setInterferenceDetail") && effect.setInterferenceDetail !== undefined
      ? effect.setInterferenceDetail
      : state.interferenceDetail,
    frames,
    // activateOverlay: intentionally ignored — future seam
  };
}

/**
 * Extract keys from state.conventionData that exist in both state and baseline effect,
 * preserving the convention (state) values over baseline values.
 */
function extractConventionDataFromState(
  state: DialogueState,
  baselineData: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(baselineData)) {
    if (key in state.conventionData) {
      result[key] = state.conventionData[key];
    }
  }
  return result;
}

/** Apply a DialogueEffect to produce a new DialogueState (immutable). */
export function applyEffect(state: DialogueState, effect: DialogueEffect): DialogueState {
  let frames = [...(state.frames ?? [])];
  const hasFrameOp = !!effect.popFrame || !!effect.pushFrame;
  if (effect.popFrame) {
    frames = frames.slice(0, -1);
  }
  if (effect.pushFrame) {
    frames = [...frames, effect.pushFrame];
  }

  // Obligation precedence: explicit setObligation > frame-derived > existing
  let obligation: typeof state.obligation;
  if (effect.setObligation) {
    obligation = effect.setObligation;
  } else if (hasFrameOp) {
    obligation = obligationFromFrame(frames[frames.length - 1]);
  } else {
    obligation = state.obligation;
  }

  return {
    familyId: effect.setFamilyId !== undefined ? effect.setFamilyId : state.familyId,
    forcingState: effect.setForcingState ?? state.forcingState,
    agreedStrain: effect.setAgreedStrain ?? state.agreedStrain,
    obligation,
    competitionMode: effect.setCompetitionMode ?? state.competitionMode,
    captain: effect.setCaptain ?? state.captain,
    systemMode: effect.setSystemMode ?? state.systemMode,
    systemCapabilities: effect.setSystemCapability
      ? { ...state.systemCapabilities, ...effect.setSystemCapability }
      : state.systemCapabilities,
    conventionData: effect.mergeConventionData
      ? { ...state.conventionData, ...effect.mergeConventionData }
      : state.conventionData,
    interferenceDetail: effect.setInterferenceDetail !== undefined
      ? effect.setInterferenceDetail
      : state.interferenceDetail,
    frames,
    // activateOverlay: intentionally ignored — future seam
  };
}
