// DialogueState types — protocol memory for what the auction means
// under the partnership agreement, independent of any specific hand.

import type { BidSuit, Suit, Call, Seat } from "../../../engine/types";
import { ForcingState } from "../../../shared/types";

// Re-export from canonical location for backward compatibility
export { ForcingState } from "../../../shared/types";

export enum PendingAction {
  None = "none",
  ShowMajor = "show-major",
  ShowSuit = "show-suit",
}

export enum CompetitionMode {
  Uncontested = "uncontested",
  Doubled = "doubled",
  Overcalled = "overcalled",
  Balancing = "balancing",
}

export enum CaptainRole {
  Opener = "opener",
  Responder = "responder",
  Neither = "neither",
}

export enum SystemMode {
  On = "on",
  Off = "off",
  Modified = "modified",
}

export enum InterferenceKind {
  NaturalOvercall = "natural-overcall",
  PenaltyDouble = "penalty-double",
  TakeoutDouble = "takeout-double",
  ArtificialBid = "artificial-bid",
  Unknown = "unknown",
}

export interface InterferenceDetail {
  readonly call: Call;
  readonly seat: Seat;
  /** Whether the interference bid is natural (true) or conventional (false).
   *  Currently always true — future phases may use opponent convention info. */
  readonly isNatural: boolean;
  /** Classification of the interference. Optional for backward compat. */
  readonly kind?: InterferenceKind;
}

export interface AgreedStrain {
  readonly type: "none" | "suit" | "notrump";
  readonly suit?: Suit;
  readonly confidence?: "tentative" | "agreed" | "forced";
}

/** Open set of frame kinds. Convention definitions own specific string values. */
export type FrameKind = string;

/** Conversation frame stack entry for multi-step convention obligations. */
export interface DialogueFrame {
  readonly kind: FrameKind;
  readonly owner: "opener" | "responder";
  readonly targetStrain?: BidSuit;
  readonly targetLevel?: number;
  readonly pushedAt: number;
}

export interface DialogueState {
  readonly familyId: string | null;
  readonly forcingState: ForcingState;
  readonly agreedStrain: AgreedStrain;
  readonly pendingAction: PendingAction;
  readonly competitionMode: CompetitionMode;
  readonly captain: CaptainRole;
  readonly systemMode: SystemMode;
  readonly systemCapabilities?: Readonly<Record<string, SystemMode>>;
  readonly conventionData: Readonly<Record<string, unknown>>;
  readonly interferenceDetail?: InterferenceDetail;
  readonly frames?: readonly DialogueFrame[];
}

/** Get effective system mode for a specific capability.
 *  Checks systemCapabilities first, falls back to systemMode. */
export function getSystemModeFor(state: DialogueState, capability: string): SystemMode {
  return state.systemCapabilities?.[capability] ?? state.systemMode;
}
