/**
 * Typed constants for Jacoby Transfers module-derived fact IDs.
 *
 * These are module-intrinsic facts — they belong in the module's
 * FactCatalogExtension, not in the shared vocabulary.
 */

export const TRANSFER_FACT_IDS = {
  ELIGIBLE: "module.transfer.eligible",
  OPENER_HAS_HEART_FIT: "module.transfer.openerHasHeartFit",
  OPENER_HAS_SPADES_FIT: "module.transfer.openerHasSpadesFit",
  PREFERRED: "module.transfer.preferred",
  TARGET_SUIT: "module.transfer.targetSuit",
} as const;

/** Union type of all Jacoby Transfers fact IDs. */
export type TransferFactId = (typeof TRANSFER_FACT_IDS)[keyof typeof TRANSFER_FACT_IDS];
