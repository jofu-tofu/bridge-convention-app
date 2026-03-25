import type { ForcingState } from "./strategy-types";
import type { PublicEvent, PublicConstraint } from "./agreement-module";
import type { LatentBranchSet } from "../../inference/posterior/posterior-types";

/** Conversation machine register state — shared by PublicSnapshot and debug views. */
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

/** Hand-independent public state derived from conversation machine registers.
 *  Pure DTO — caller extracts fields from machine state to avoid
 *  contracts/ importing from conventions/. */
export interface PublicSnapshot extends MachineRegisters {
  readonly activeModuleIds: readonly string[];
  readonly publicRegisters: Readonly<Record<string, unknown>>;
  readonly publicRecord?: readonly PublicEvent[];
  readonly publicCommitments?: readonly PublicConstraint[];
  readonly latentBranches?: readonly LatentBranchSet[];
}

/** Build a PublicSnapshot from machine state fields.
 *  Takes plain fields to avoid importing from conventions/. */

export function buildPublicSnapshot(params: {
  activeModuleIds: readonly string[];
  forcingState: ForcingState;
  obligation: {
    kind: string;
    obligatedSide: "opener" | "responder";
  };
  agreedStrain: {
    type: "none" | "suit" | "notrump";
    suit?: string;
    confidence?: string;
  };
  competitionMode: string;
  captain: string;
  systemCapabilities?: Readonly<Record<string, string>>;
  conventionData?: Readonly<Record<string, unknown>>;
  publicRecord?: readonly PublicEvent[];
  publicCommitments?: readonly PublicConstraint[];
}): PublicSnapshot {
  return {
    activeModuleIds: params.activeModuleIds,
    forcingState: params.forcingState,
    obligation: params.obligation,
    agreedStrain: params.agreedStrain,
    competitionMode: params.competitionMode,
    captain: params.captain,
    systemCapabilities: params.systemCapabilities ?? {},
    publicRegisters: params.conventionData ?? {},
    publicRecord: params.publicRecord,
    publicCommitments: params.publicCommitments,
  };
}
