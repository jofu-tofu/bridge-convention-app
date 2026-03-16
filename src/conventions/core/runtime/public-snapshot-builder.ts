import type { Auction, Seat } from "../../../engine/types";
import type { PublicSnapshot } from "../../../core/contracts/module-surface";
import { buildPublicSnapshot } from "../../../core/contracts/module-surface";
import type { PublicEvent } from "../../../core/contracts/agreement-module";
import type { MeaningSurface } from "../../../core/contracts/meaning-surface";
import type { MachineRegisters } from "./machine-types";
import { ForcingState } from "../../../core/contracts/bidding";
import { formatCallString } from "./commitment-extractor";
import { extractCommitments } from "./commitment-extractor";

export function buildSnapshotFromAuction(
  auction: Auction,
  seat: Seat,
  activeModuleIds: readonly string[],
  options?: {
    machineRegisters?: MachineRegisters;
    surfaceRouter?: (auction: Auction, seat: Seat) => readonly MeaningSurface[];
  },
): PublicSnapshot {
  const registers = options?.machineRegisters;
  const competitionMode = registers
    ? registers.competitionMode
    : detectCompetitionMode(auction);

  const publicRecord = buildPublicRecord(auction);
  const publicCommitments = options?.surfaceRouter
    ? extractCommitments(auction, seat, options.surfaceRouter)
    : undefined;

  return buildPublicSnapshot({
    activeModuleIds,
    forcingState: registers?.forcingState ?? ForcingState.Nonforcing,
    obligation: registers?.obligation ?? { kind: "None", obligatedSide: "responder" },
    agreedStrain: registers?.agreedStrain ?? { type: "none" },
    competitionMode,
    captain: registers?.captain ?? "responder",
    systemCapabilities: registers?.systemCapabilities,
    publicRecord,
    publicCommitments,
  });
}

/** Map auction entries to PublicEvent[]. */
function buildPublicRecord(auction: Auction): readonly PublicEvent[] {
  return auction.entries.map((entry, index) => ({
    eventIndex: index,
    call: formatCallString(entry.call),
    seat: entry.seat,
  }));
}

function detectCompetitionMode(auction: Auction): string {
  for (let i = auction.entries.length - 1; i >= 0; i--) {
    const entry = auction.entries[i]!;
    if (entry.call.type === "double") return "Doubled";
    if (entry.call.type === "redouble") return "Redoubled";
    if (entry.call.type === "pass") continue;
    break;
  }
  return "Uncontested";
}
