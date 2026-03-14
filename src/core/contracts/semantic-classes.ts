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
  ASK_MAJOR: "bridge:ask-major",
  MAJOR_RAISE_GAME: "bridge:major-raise-game",
  MAJOR_RAISE_INVITE: "bridge:major-raise-invite",
  MINOR_RAISE: "bridge:minor-raise",
} as const;
