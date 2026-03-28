// ── Protocol Types ──────────────────────────────────────────────────
//
// Top-level ConventionSpec composition type.

// ── Convention Spec (Top-Level Composition) ─────────────────────────

/**
 * A fully composed convention specification.
 * This is what gets compiled into a runnable convention system.
 *
 * All convention behavior flows through modules — declarative
 * convention modules with local FSM, rules, facts, and explanations.
 */
export interface ConventionSpec {
  readonly id: string;
  readonly name: string;
  /** Convention modules for rule-based surface selection. */
  readonly modules: readonly ConventionModule[];
  /** System config for parameterized fact evaluation. When omitted, defaults to SAYC. */
  readonly systemConfig?: SystemConfig;
}

import type { ConventionModule } from "../convention-module";
import type { SystemConfig } from "../../definitions/system-config";


