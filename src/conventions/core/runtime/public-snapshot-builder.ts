import type { Auction, Seat } from "../../../engine/types";
import type { PublicSnapshot } from "../../../core/contracts/module-surface";
import { buildPublicSnapshot } from "../../../core/contracts/module-surface";
import type { PublicEvent } from "../../../core/contracts/agreement-module";
import type { MeaningSurface } from "../../../core/contracts/meaning-surface";
import type { PosteriorEngine } from "../../../core/contracts/posterior";
import type { BeliefView, PosteriorSourceRef } from "../../../core/contracts/posterior";
import { SHARED_POSTERIOR_FACT_IDS } from "../../../core/contracts/posterior";
import type { FactConstraintIR } from "../../../core/contracts/agreement-module";
import type { MachineRegisters } from "./machine-types";
import { ForcingState } from "../../../core/contracts/bidding";
import { formatCallString } from "./commitment-extractor";
import { extractCommitments } from "./commitment-extractor";

/** Build a hand-independent PublicSnapshot from auction state and active modules.
 *
 * When `machineRegisters` is provided, uses machine-computed values for
 * forcing, obligation, agreedStrain, competition, captain, systemCapabilities.
 * Otherwise, uses stub defaults. */
export function buildSnapshotFromAuction(
  auction: Auction,
  seat: Seat,
  activeModuleIds: readonly string[],
  options?: {
    machineRegisters?: MachineRegisters;
    surfaceRouter?: (auction: Auction, seat: Seat) => readonly MeaningSurface[];
    posteriorEngine?: PosteriorEngine;
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

  // Populate publicBeliefs from posterior engine when available
  let publicBeliefs: BeliefView[] = [];
  if (options?.posteriorEngine) {
    const partialSnapshot = buildPublicSnapshot({
      activeModuleIds,
      forcingState: registers?.forcingState ?? ForcingState.Nonforcing,
      obligation: registers?.obligation ?? { kind: "None", obligatedSide: "responder" },
      agreedStrain: (registers?.agreedStrain ?? { type: "none" }) as PublicSnapshot["agreedStrain"],
      competitionMode,
      captain: registers?.captain ?? "responder",
      systemCapabilities: registers?.systemCapabilities,
      publicRecord,
      publicCommitments,
      publicBeliefs: [],
    });
    const handSpaces = options.posteriorEngine.compilePublic(partialSnapshot);
    const evidenceGroupId = `posterior:${seat}`;
    publicBeliefs = handSpaces.map((space) => {
      const factValues = options.posteriorEngine!.deriveActingHandFacts(space, SHARED_POSTERIOR_FACT_IDS);
      const leadFact = factValues[0];
      const constraint: FactConstraintIR | undefined = leadFact
        ? { factId: leadFact.factId, operator: "gte", value: leadFact.expectedValue }
        : undefined;
      const provenance: PosteriorSourceRef[] = [
        { sourceKind: "posterior-engine", confidence: leadFact?.confidence },
      ];
      return {
        seatId: space.seatId,
        observerSeat: seat,
        facts: factValues,
        staleness: 0,
        beliefId: `posterior:${space.seatId}`,
        subject: { seatId: space.seatId },
        constraint,
        provenance,
        evidenceGroupId,
      };
    });
  }

  return buildPublicSnapshot({
    activeModuleIds,
    forcingState: registers?.forcingState ?? ForcingState.Nonforcing,
    obligation: registers?.obligation ?? { kind: "None", obligatedSide: "responder" },
    agreedStrain: (registers?.agreedStrain ?? { type: "none" }) as PublicSnapshot["agreedStrain"],
    competitionMode,
    captain: registers?.captain ?? "responder",
    systemCapabilities: registers?.systemCapabilities,
    publicRecord,
    publicCommitments,
    publicBeliefs,
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
