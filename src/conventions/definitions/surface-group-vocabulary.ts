/**
 * Shared surface group vocabulary — constants for groupIds referenced
 * by multiple modules. Typos caught at compile time.
 *
 * Only groupIds that are shared across module boundaries belong here.
 * Module-internal groupIds remain as string literals in the owning module.
 */

/** Stayman R3 after 2D denial — Smolen contributes surfaces here too. */
export const GROUP_RESPONDER_R3_STAYMAN_2D = "responder-r3-after-stayman-2d" as const;

/** Terminal pass — auction settled. Used by natural-nt's terminal pass surface. */
export const GROUP_TERMINAL_PASS = "terminal-pass" as const;

/** 1NT opener surface — emitted at the opened state. */
export const GROUP_OPENER_1NT = "opener-1nt" as const;
