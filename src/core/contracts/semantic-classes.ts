/**
 * Convenience catalog of platform-owned canonical semantic class IDs.
 * Modules declare their own semantic classes as plain string constants.
 * This file is a convenience catalog, not a gating registry — adding a
 * new convention MUST NOT require editing this file.
 * (Frozen Contract #14 from Agreement Module IR spec)
 */
export const BRIDGE_SEMANTIC_CLASSES = {
  PASS: "bridge:pass",
  NT_INVITE: "bridge:nt-invite",
  NT_GAME: "bridge:to-3nt",
} as const;

/**
 * @deprecated Use BRIDGE_SEMANTIC_CLASSES for platform IDs or module-local constants
 * for convention-specific IDs. Kept for backward compatibility during migration.
 */
export const SEMANTIC_CLASSES = {
  ...BRIDGE_SEMANTIC_CLASSES,
  STAYMAN_ASK: "stayman:ask-major",
  TRANSFER_HEARTS: "transfer:to-hearts",
  TRANSFER_SPADES: "transfer:to-spades",
  STAYMAN_SHOW_HEARTS: "stayman:show-hearts",
  STAYMAN_SHOW_SPADES: "stayman:show-spades",
  STAYMAN_DENY_MAJOR: "stayman:deny-major",
  JACOBY_ACCEPT: "transfer:accept",
  INTERFERENCE_REDOUBLE: "interference:redouble-strength",
} as const;

export type SemanticClassKey = keyof typeof SEMANTIC_CLASSES;
