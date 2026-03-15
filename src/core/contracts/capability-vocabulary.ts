/**
 * Capability Vocabulary
 *
 * Stable IDs for host-attachment capabilities. Modules declare which capabilities
 * they provide (via `declaredCapabilities`) and which they require (via
 * `requiresCapabilities` on attachments).
 *
 * Naming convention: `{scope}.{context-description}`
 *   - `opening.*`  — partnership opening bid contexts
 *   - `opponent.*` — opponent action contexts
 *   - `context.*`  — mid-auction positional contexts
 *
 * These IDs are the stable contract between host modules and add-on modules.
 * Renaming a capability is a breaking change — all modules that require it must
 * update. Prefer descriptive, auction-state-oriented names over convention names.
 *
 * Value semantics: capability values are opaque strings. The activation system
 * checks for key presence (`cap in capabilities`), not value equality. Values
 * like "active" are conventional but not enforced — a host may set a value to
 * provide additional context (e.g., HCP range) in future extensions.
 */

// ─── Partnership opening contexts ───────────────────────────
// These describe what kind of opening bid the partnership has made.

/** Partner opened 1NT (strong notrump, typically 15-17 HCP balanced). */
export const CAP_OPENING_1NT = "opening.1nt";

/** Partner opened a natural suit at the 1-level (1C, 1D, 1H, or 1S). */
export const CAP_OPENING_NATURAL_SUIT = "opening.natural-suit";

/** Partner opened a major suit (1H or 1S). */
export const CAP_OPENING_MAJOR = "opening.major";

/** Partner opened a minor suit (1C or 1D). */
export const CAP_OPENING_MINOR = "opening.minor";

/** Partner opened a weak two (2D, 2H, or 2S). */
export const CAP_OPENING_WEAK_TWO = "opening.weak-two";

/** Partner opened a strong artificial 2C. */
export const CAP_OPENING_STRONG_2C = "opening.strong-2c";

// ─── Opponent action contexts ───────────────────────────────
// These describe what the opponents have done.

/** Opponent opened 1NT. */
export const CAP_OPPONENT_1NT = "opponent.1nt";

/** Opponent made a natural overcall after our opening. */
export const CAP_OPPONENT_OVERCALL = "opponent.overcall";

/** Opponent opened a weak two. */
export const CAP_OPPONENT_WEAK_TWO = "opponent.weak-two";

// ─── Mid-auction positional contexts ────────────────────────
// These describe auction positions that arise mid-conversation.

/** Opener has rebid 1NT (e.g., 1m-1M-1NT). Context for New Minor Forcing. */
export const CAP_CONTEXT_NT_REBID = "context.nt-rebid";

/** Opening bid was made in 3rd or 4th seat. Context for Drury. */
export const CAP_CONTEXT_PASSED_HAND = "context.passed-hand";

// ─── All capabilities (for validation/documentation) ────────

/** All defined capability IDs for validation and introspection. */
export const ALL_CAPABILITIES = [
  CAP_OPENING_1NT,
  CAP_OPENING_NATURAL_SUIT,
  CAP_OPENING_MAJOR,
  CAP_OPENING_MINOR,
  CAP_OPENING_WEAK_TWO,
  CAP_OPENING_STRONG_2C,
  CAP_OPPONENT_1NT,
  CAP_OPPONENT_OVERCALL,
  CAP_OPPONENT_WEAK_TWO,
  CAP_CONTEXT_NT_REBID,
  CAP_CONTEXT_PASSED_HAND,
] as const;

export type CapabilityId = (typeof ALL_CAPABILITIES)[number];
