/**
 * Service request types — shapes the client provides to the service.
 *
 * Separated from response types so the "what you send" contract is
 * distinct from the "what you get back" contract. When this grows
 * (auth, pagination, etc.) it can be promoted to a requests/ folder.
 */

import type { Seat, Vulnerability } from "../engine/types";
import type { OpponentMode, PlayPreference, PracticeMode, PracticeRole } from "./session-types";

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
  /** Practice mode — controls auction entry point and play coupling. */
  readonly practiceMode?: PracticeMode;
  /** Target module for practice focus derivation (which module is being drilled). */
  readonly targetModuleId?: string;
  /** Practice role — opener, responder, or both (random per deal). */
  readonly practiceRole?: PracticeRole;
  /** Play preference — whether to skip, prompt, or always play after bidding. */
  readonly playPreference?: PlayPreference;
  /** Opponent behavior mode. */
  readonly opponentMode?: OpponentMode;
  /** Vulnerability override. */
  readonly vulnerability?: Vulnerability;
}
