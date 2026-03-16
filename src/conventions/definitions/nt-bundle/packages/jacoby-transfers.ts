/**
 * Jacoby Transfers ModulePackage — add-on module providing transfer bids
 * (2D→hearts, 2H→spades), opener accepts, and R3 continuations.
 */
import type { ModulePackage } from "../../../core/composition/module-package";
import type { MachineFragment } from "../../../core/composition/machine-fragment";
import {
  jacobyTransfersModule,
  transferFacts,
  OPENER_TRANSFER_HEARTS_SURFACES,
  OPENER_TRANSFER_SPADES_SURFACES,
  TRANSFER_R3_HEARTS_SURFACES,
  TRANSFER_R3_SPADES_SURFACES,
} from "../modules/jacoby-transfers";

function buildTransferFragment(): MachineFragment {
  return {
    states: jacobyTransfersModule.machineStates,
    entryTransitions: jacobyTransfersModule.entryTransitions,
  };
}

export const jacobyTransfersPackage: ModulePackage = {
  moduleId: "jacoby-transfers",

  meta: {
    description: "Jacoby Transfers: 2D→hearts, 2H→spades after 1NT",
    kind: "add-on",
  },

  exports: {
    facts: transferFacts,

    surfaces: [
      // Entry surfaces go into the dispatch group
      { groupId: "responder-r1", surfaces: [...jacobyTransfersModule.entrySurfaces] },
      // Post-entry surface groups
      { groupId: "opener-transfer-accept", surfaces: [...OPENER_TRANSFER_HEARTS_SURFACES] },
      { groupId: "opener-transfer-accept-spades", surfaces: [...OPENER_TRANSFER_SPADES_SURFACES] },
      { groupId: "responder-r3-after-transfer-hearts", surfaces: [...TRANSFER_R3_HEARTS_SURFACES] },
      { groupId: "responder-r3-after-transfer-spades", surfaces: [...TRANSFER_R3_SPADES_SURFACES] },
    ],

    explanationEntries: jacobyTransfersModule.explanationEntries,

    pedagogicalRelations: jacobyTransfersModule.pedagogicalRelations,
  },

  runtime: {
    machineFragment: buildTransferFragment(),
  },
};
