// ─── Meaning IDs ────────────────────────────────────────────

/**
 * Typed ID constants for all Natural Bids meaning IDs.
 *
 * Each constant corresponds to a meaningId used in Natural Bids meaning surfaces.
 */

export const NATURAL_NT_MEANING_IDS = {
  NT_OPENING: "bridge:1nt-opening",
  NT_INVITE: "bridge:nt-invite",
  TO_3NT: "bridge:to-3nt",
  OPEN_1C: "bridge:1c-opening",
  OPEN_1D: "bridge:1d-opening",
  OPEN_1H: "bridge:1h-opening",
  OPEN_1S: "bridge:1s-opening",
} as const;

export type NaturalNtMeaningId = (typeof NATURAL_NT_MEANING_IDS)[keyof typeof NATURAL_NT_MEANING_IDS];
