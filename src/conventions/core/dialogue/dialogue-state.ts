// DialogueState types — protocol memory for what the auction means
// under the partnership agreement, independent of any specific hand.

import type { BidSuit, Suit, Call, Seat } from "../../../engine/types";
import type { ForcingState } from "../../../core/contracts";

// Re-export from canonical location for backward compatibility
export { ForcingState } from "../../../core/contracts";

export enum ObligationKind {
  None = "none",
  /** Show a 4+ card major (Stayman). */
  ShowMajor = "show-major",
  /** Show a suit (general, e.g., Weak Twos Ogust). */
  ShowSuit = "show-suit",
  /**
   * Act constructively — excludes Pass, allows NT for strong hands.
   * Context-dependent: the obligation means "act constructively", not literally
   * "bid a suit". Pass is excluded by the candidate filter, but NT is allowed.
   * The tree/resolver handles suit preference; the obligation is a safety net.
   */
  BidSuit = "bid-suit",
  /** Choose final contract (Lebensohl). */
  PlaceContract = "place-contract",
  /** Make a specific relay bid (Lebensohl opener). */
  CompleteRelay = "complete-relay",
  /** General: answer partner's question. */
  RespondToAsk = "respond-to-ask",
}

export interface Obligation {
  readonly kind: ObligationKind;
  /** Which partnership role must fulfill this obligation.
   *  Uses existing "opener" | "responder" role labels (same type as DialogueFrame.owner). */
  readonly obligatedSide: "opener" | "responder";
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
  /**
   * Controls pass-exclusion mechanics. Set independently by transition rules.
   * Coexists with `obligation` — they are independent concerns:
   * `forcingState` says "can you pass?", `obligation` says "what should you do?"
   * The mapping is not 1:1 (e.g., Lebensohl's place-contract is nonforcing
   * despite having an obligation).
   */
  readonly forcingState: ForcingState;
  readonly agreedStrain: AgreedStrain;
  /**
   * Describes what the obligated player should do (semantic obligation).
   * Set independently from `forcingState` by transition rules or derived
   * from the frame stack. See `ObligationKind` for the full taxonomy.
   */
  readonly obligation: Obligation;
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
