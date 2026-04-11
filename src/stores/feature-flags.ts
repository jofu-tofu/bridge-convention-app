/**
 * Feature flags — single registry for all gated features.
 *
 * Each flag resolves to a boolean constant at module load time.
 * Flags gated on `import.meta.env.DEV` are dead-code-eliminated
 * in production builds by Vite.
 *
 * To add a flag:
 *   1. Add it to the FEATURES object below
 *   2. Use `FEATURES.yourFlag` at all gate points
 *   3. Document the flag's purpose in the comment
 *
 * To graduate a flag: change its assignment to `true`, then remove
 * all `if (FEATURES.x)` gates in a follow-up since they're unconditionally true.
 */

/** Workshop: convention editor, system editor, practice pack editor (dev only). */
const workshop: boolean = import.meta.env.DEV;

export const FEATURES = {
  workshop,
} as const;

export type FeatureFlag = keyof typeof FEATURES;
