/**
 * Convenience catalog of platform-owned canonical semantic class IDs.
 * Modules declare their own semantic classes as plain string constants.
 * This file is a convenience catalog, not a gating registry — adding a
 * new convention MUST NOT require editing this file.
 * (Frozen Contract #14 from Agreement Module IR spec)
 */
export const BRIDGE_SEMANTIC_CLASSES = {
  NT_INVITE: "bridge:nt-invite",
  NT_GAME: "bridge:to-3nt",
} as const;
