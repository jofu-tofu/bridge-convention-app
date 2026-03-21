/**
 * Explanation catalog types and builder.
 *
 * Sibling artifact to FactCatalog. Convention modules contribute entries
 * for their module-local facts and meanings. Platform-owned entries cover
 * shared facts and well-known semantic classes.
 *
 * Governance: explanation IDs are stable across versions. Removing an entry
 * is a breaking change. Adding or updating a template key is non-breaking.
 */

/** Role an explanation plays in a given context. */
export type ExplanationRole = "supporting" | "blocking" | "inferential" | "pedagogical";

/** Explanation level preference. */
export type ExplanationLevel = "semantic" | "mechanical";

/** A single explanation entry in the catalog. */
export interface ExplanationEntry {
  /** Stable, versioned ID. */
  readonly explanationId: string;
  /** Links to fact catalog (if explaining a fact). */
  readonly factId?: string;
  /** Links to meaning vocabulary (if explaining a meaning). */
  readonly meaningId?: string;
  /** i18n-ready template reference for the primary explanation. */
  readonly templateKey: string;
  /** Human-readable display text. When present, used directly by the teaching projection builder.
   *  Prefer this over templateKey for immediate rendering; templateKey is reserved for i18n. */
  readonly displayText?: string;
  /** i18n-ready template reference for "why this, not that" explanations. */
  readonly contrastiveTemplateKey?: string;
  /** Human-readable contrastive display text (for "why not" explanations). */
  readonly contrastiveDisplayText?: string;
  /** Whether the explanation focuses on "why" (semantic) or "what" (mechanical). */
  readonly preferredLevel: ExplanationLevel;
  /** Contexts in which this explanation is used. */
  readonly roles: readonly ExplanationRole[];
}

/** Versioned explanation catalog. */
export interface ExplanationCatalog {
  readonly version: string;
  readonly entries: readonly ExplanationEntry[];
}

/**
 * Create a frozen ExplanationCatalog from a list of entries.
 * Throws if any explanationId appears more than once.
 */
export function createExplanationCatalog(
  entries: ExplanationEntry[],
): ExplanationCatalog {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.explanationId)) {
      throw new Error(`Duplicate explanationId: ${entry.explanationId}`);
    }
    seen.add(entry.explanationId);
  }

  const catalog: ExplanationCatalog = {
    version: "1.0.0",
    entries: Object.freeze([...entries]),
  };

  return Object.freeze(catalog);
}
