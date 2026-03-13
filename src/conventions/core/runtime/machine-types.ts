import type { PublicSnapshot } from "../../../core/contracts/module-surface";
import type { CandidateTransform } from "../../../core/contracts/meaning";
import type { ForcingState } from "../../../core/contracts/bidding";
import type { Call, Seat, BidSuit, Auction } from "../../../engine/types";
import type { RuntimeDiagnostic } from "./types";

export interface MachineState {
  readonly stateId: string;
  readonly parentId: string | null; // null = root; children inherit parent transitions
  readonly transitions: readonly MachineTransition[];
  readonly entryEffects?: MachineEffect; // applied on state entry
  readonly surfaceGroupId?: string; // which surface group to emit
  readonly transforms?: readonly CandidateTransform[];
}

export interface MachineTransition {
  readonly transitionId: string;
  readonly match: TransitionMatch;
  readonly target: string; // target stateId
  readonly effects?: MachineEffect;
  readonly guard?: (snapshot: PublicSnapshot) => boolean;
}

export type TransitionMatch =
  | { readonly kind: "call"; readonly level: number; readonly strain: BidSuit }
  | { readonly kind: "any-bid" }
  | { readonly kind: "pass" }
  | {
      readonly kind: "opponent-action";
      readonly callType?: "bid" | "double" | "redouble";
    }
  | {
      readonly kind: "predicate";
      readonly test: (call: Call, seat: Seat, snapshot: PublicSnapshot) => boolean;
    };

export interface MachineEffect {
  readonly setForcingState?: ForcingState;
  readonly setObligation?: {
    readonly kind: string;
    readonly obligatedSide: "opener" | "responder";
  };
  readonly setAgreedStrain?: {
    readonly type: "none" | "suit" | "notrump";
    readonly suit?: string;
    readonly confidence?: string;
  };
  readonly setCompetitionMode?: string;
  readonly setCaptain?: string;
  readonly mergeRegisters?: Readonly<Record<string, unknown>>;
  readonly setSystemCapabilities?: Readonly<Record<string, string>>;
}

export interface ConversationMachine {
  readonly machineId: string;
  readonly states: ReadonlyMap<string, MachineState>;
  readonly initialStateId: string;
  readonly seatRole: (
    auction: Auction,
    seat: Seat,
    callSeat: Seat,
  ) => "self" | "partner" | "opponent";
}

export interface MachineEvalResult {
  readonly context: MachineContext;
  readonly activeSurfaceGroupIds: readonly string[];
  readonly collectedTransforms: readonly CandidateTransform[];
  readonly diagnostics: readonly RuntimeDiagnostic[];
}

export interface MachineContext {
  readonly currentStateId: string;
  readonly registers: MachineRegisters;
  readonly stateHistory: readonly string[];
  readonly transitionHistory: readonly string[];
}

// Machine registers are the subset of PublicSnapshot that the machine owns
export interface MachineRegisters {
  readonly forcingState: ForcingState;
  readonly obligation: {
    readonly kind: string;
    readonly obligatedSide: "opener" | "responder";
  };
  readonly agreedStrain: {
    readonly type: "none" | "suit" | "notrump";
    readonly suit?: string;
    readonly confidence?: string;
  };
  readonly competitionMode: string;
  readonly captain: string;
  readonly systemCapabilities: Readonly<Record<string, string>>;
}
