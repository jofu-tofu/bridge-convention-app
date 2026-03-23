/**
 * Typed ID constants for all Natural NT meaning IDs.
 *
 * Each constant corresponds to a meaningId used in Natural NT meaning surfaces.
 */

export const NATURAL_NT_MEANING_IDS = {
  NT_OPENING: "bridge:1nt-opening",
  NT_INVITE: "bridge:nt-invite",
  TO_3NT: "bridge:to-3nt",
} as const;

export type NaturalNtMeaningId = (typeof NATURAL_NT_MEANING_IDS)[keyof typeof NATURAL_NT_MEANING_IDS];
