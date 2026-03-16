import type { Auction, Seat } from "../../../engine/types";
import type { MeaningSurface } from "../../../core/contracts/meaning-surface";
import type { ConversationMachine } from "../../core/runtime/machine-types";
import type { RoutedSurfaceGroup } from "../../core/bundle/bundle-types";
import { evaluateMachine } from "../../core/runtime/machine-evaluator";
import {
  RESPONDER_SURFACES,
  OPENER_STAYMAN_SURFACES,
  OPENER_TRANSFER_HEARTS_SURFACES,
  OPENER_TRANSFER_SPADES_SURFACES,
  STAYMAN_R3_AFTER_2H_SURFACES,
  STAYMAN_R3_AFTER_2S_SURFACES,
  STAYMAN_R3_AFTER_2D_SURFACES,
  TRANSFER_R3_HEARTS_SURFACES,
  TRANSFER_R3_SPADES_SURFACES,
  OPENER_SMOLEN_HEARTS_SURFACES,
  OPENER_SMOLEN_SPADES_SURFACES,
} from "./meaning-surfaces";
import { createSmolenSubmachine } from "./machine";

/**
 * All NT routed surface groups — static mapping from groupId to surfaces.
 * Activation logic is handled by the conversation machine, not by predicates here.
 */
export const NT_ROUTED_SURFACES: readonly RoutedSurfaceGroup[] = [
  { groupId: "responder-r1", surfaces: RESPONDER_SURFACES },
  { groupId: "opener-stayman-response", surfaces: OPENER_STAYMAN_SURFACES },
  { groupId: "opener-transfer-accept", surfaces: OPENER_TRANSFER_HEARTS_SURFACES },
  { groupId: "opener-transfer-accept-spades", surfaces: OPENER_TRANSFER_SPADES_SURFACES },
  { groupId: "responder-r3-after-stayman-2h", surfaces: STAYMAN_R3_AFTER_2H_SURFACES },
  { groupId: "responder-r3-after-stayman-2s", surfaces: STAYMAN_R3_AFTER_2S_SURFACES },
  { groupId: "responder-r3-after-stayman-2d", surfaces: STAYMAN_R3_AFTER_2D_SURFACES },
  { groupId: "responder-r3-after-transfer-hearts", surfaces: TRANSFER_R3_HEARTS_SURFACES },
  { groupId: "responder-r3-after-transfer-spades", surfaces: TRANSFER_R3_SPADES_SURFACES },
  { groupId: "opener-smolen-hearts", surfaces: OPENER_SMOLEN_HEARTS_SURFACES },
  { groupId: "opener-smolen-spades", surfaces: OPENER_SMOLEN_SPADES_SURFACES },
];

/**
 * Create a surface router that delegates auction matching to a ConversationMachine.
 *
 * The machine encodes all auction-matching logic (state transitions on bids/passes).
 * `evaluateMachine()` returns `activeSurfaceGroupIds` — the router filters
 * surfaces by matching `groupId` against those active IDs.
 */
export function createNtSurfaceRouter(
  routedGroups: readonly RoutedSurfaceGroup[],
  machine?: ConversationMachine,
): (auction: Auction, seat: Seat) => readonly MeaningSurface[] {
  // Build a lookup map from groupId to surfaces for O(1) access
  const groupMap = new Map<string, readonly MeaningSurface[]>();
  for (const group of routedGroups) {
    groupMap.set(group.groupId, group.surfaces);
  }

  const smolenSub = createSmolenSubmachine();
  const submachines = new Map([["smolen-continuation", smolenSub]]);

  return (auction, seat) => {
    if (!machine) {
      return [];
    }

    const result = evaluateMachine(machine, auction, seat, submachines);
    const activeSurfaces: MeaningSurface[] = [];

    for (const groupId of result.activeSurfaceGroupIds) {
      const surfaces = groupMap.get(groupId);
      if (surfaces) {
        activeSurfaces.push(...surfaces);
      }
    }

    return activeSurfaces;
  };
}
