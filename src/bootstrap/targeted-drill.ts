// ── Targeted Drill ─────────────────────────────────────────────────
//
// Generates a drill that drops the user into a specific state.
// Used by ?targetState= URL param and the BridgeExpertReview skill.
//
// TODO: Port targeting to use protocol frame coverage enumeration
// instead of the old FSM topology system.

import type { EnginePort } from "../engine/port";
import type { ConventionConfig } from "../conventions/core";
import type { Seat } from "../engine/types";
import type { DrillBundle, OpponentMode } from "./types";
import { getConventionSpec } from "../conventions/spec-registry";

/**
 * Start a drill targeting a specific state.
 *
 * Returns null if the state can't be targeted.
 * The caller should fall back to a normal drill in that case.
 *
 * NOTE: State targeting currently requires the old FSM topology system which
 * has been removed. This function returns null until targeting is ported to
 * the protocol frame coverage enumeration system.
 */
export function startTargetedDrill(
  _engine: EnginePort,
  convention: ConventionConfig,
  userSeat: Seat,
  _targetStateId: string,
  _options?: {
    opponentMode?: OpponentMode;
    targetSurfaceId?: string;
  },
): DrillBundle | null {
  // State targeting not yet ported to protocol frame architecture.
  // Fall back to null so caller can start a normal drill.
  const spec = getConventionSpec(convention.id);
  if (!spec) return null;

  // TODO: Use protocol coverage enumeration to compute path to target state
  // and generate appropriate deal constraints + auction prefix.
  return null;
}
