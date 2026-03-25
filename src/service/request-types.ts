/**
 * Service request types — shapes the client provides to the service.
 *
 * Separated from response types so the "what you send" contract is
 * distinct from the "what you get back" contract. When this grows
 * (auth, pagination, etc.) it can be promoted to a requests/ folder.
 */

import type { Seat } from "../engine/types";
import type { DrillSettings } from "../session/drill-types";

// ── Session Handle ──────────────────────────────────────────────────

/** Opaque session identifier. */
export type SessionHandle = string;

// ── Session Config ──────────────────────────────────────────────────

/** Configuration for creating a new drill session. */
export interface SessionConfig {
  readonly conventionId: string;
  readonly userSeat?: Seat;
  readonly seed?: number;
  /** Base system for convention resolution (e.g. "sayc", "two-over-one"). */
  readonly baseSystemId?: string;
  /** Drill execution parameters (opponent behavior + deal generation). */
  readonly drill?: DrillSettings;
}
