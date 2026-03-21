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

/** Partner opened 1NT (range defined by system profile). */
export const CAP_OPENING_1NT = "opening.1nt";

/** Partner opened a major suit (1H or 1S). */
export const CAP_OPENING_MAJOR = "opening.major";

/** Partner opened a weak two (2D, 2H, or 2S). */
export const CAP_OPENING_WEAK_TWO = "opening.weak-two";

// ─── Opponent action contexts ───────────────────────────────
// These describe what the opponents have done.

/** Opponent opened 1NT. */
export const CAP_OPPONENT_1NT = "opponent.1nt";
