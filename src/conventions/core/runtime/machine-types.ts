import type { PublicSnapshot } from "../../../core/contracts/module-surface";
import type { CandidateTransform } from "../../../core/contracts/meaning";
import type { ForcingState } from "../../../core/contracts/bidding";
import type { Call, Seat, BidSuit, Auction } from "../../../engine/types";
import { areSamePartnership } from "../../../engine/constants";
import type { RuntimeDiagnostic } from "./types";
import type { HandoffTrace } from "../../../core/contracts/provenance";

export interface MachineState {
  readonly stateId: string;
  readonly parentId: string | null; // null = root; children inherit parent transitions
  readonly transitions: readonly MachineTransition[];
  readonly entryEffects?: MachineEffect; // applied on state entry
  readonly surfaceGroupId?: string; // which surface group to emit
  readonly transforms?: readonly CandidateTransform[];
  readonly submachineRef?: {
    readonly machineId: string; // Which submachine to invoke
    readonly returnTarget: string; // Where to go when submachine completes
  };
  readonly loopConfig?: {
    readonly maxIterations: number; // Safety limit
    readonly exitTarget: string; // Where to go when loop exits
  };
}

export interface MachineTransition {
  readonly transitionId: string;
  readonly match: TransitionMatch;
  readonly target: string; // target stateId
  readonly effects?: MachineEffect;
  readonly guard?: (snapshot: PublicSnapshot) => boolean;
  readonly exitLoop?: boolean; // When true, this transition exits the current loop
}

export type TransitionMatch =
  | { readonly kind: "call"; readonly level: number; readonly strain: BidSuit }
  | { readonly kind: "any-bid" }
  | { readonly kind: "pass" }
  | {
      readonly kind: "opponent-action";
      readonly callType?: "bid" | "double" | "redouble";
      readonly level?: number; // Optional: filter to specific bid level
      readonly strain?: BidSuit; // Optional: filter to specific bid strain
    }
  | {
      readonly kind: "predicate";
      readonly test: (call: Call, seat: Seat, snapshot: PublicSnapshot) => boolean;
    }
  | { readonly kind: "submachine-return" }; // matches when a submachine completes

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
  readonly handoffTraces: readonly HandoffTrace[];
}

export interface MachineContext {
  readonly currentStateId: string;
  readonly registers: MachineRegisters;
  readonly stateHistory: readonly string[];
  readonly transitionHistory: readonly string[];
  readonly submachineStack: readonly SubmachineFrame[];
}

export interface SubmachineFrame {
  readonly parentMachineId: string;
  readonly returnStateId: string;
  readonly parentRegisters: MachineRegisters;
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

/** Default seatRole: self for own bids, partner for partnership, opponent otherwise. */
function defaultSeatRole(
  _auction: Auction,
  seat: Seat,
  callSeat: Seat,
): "self" | "partner" | "opponent" {
  if (seat === callSeat) return "self";
  return areSamePartnership(seat, callSeat) ? "partner" : "opponent";
}

/** Build a ConversationMachine from an array of states with standard defaults. */
export function buildConversationMachine(
  machineId: string,
  states: readonly MachineState[],
  initialStateId = "idle",
): ConversationMachine {
  const stateMap = new Map<string, MachineState>();
  for (const s of states) stateMap.set(s.stateId, s);
  return {
    machineId,
    states: stateMap,
    initialStateId,
    seatRole: defaultSeatRole,
  };
}
