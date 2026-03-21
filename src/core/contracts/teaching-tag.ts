/**
 * Pedagogical tag types — general-purpose vocabulary for deriving
 * pedagogical relations, alternative groups, and intent families
 * from surface-level annotations.
 *
 * There are exactly 6 general tags (one per relation kind + alternatives).
 * Modules use `scope` to group surfaces within a tag, and `ordinal` to
 * express ordered chains (e.g., strength progressions).
 *
 * Design: modules are portable building blocks. When composed into any
 * bundle, the derivation function scans all surfaces, groups by (tag, scope),
 * and produces the appropriate pedagogical content automatically.
 */

import type { TeachingRelationKind } from "./teaching-projection";
import type { IntentRelationship } from "./tree-evaluation";

/** What a single tag derives. Each tag derives exactly one kind of output. */
export type TagDerivation =
  | {
      readonly type: "relation";
      readonly kind: TeachingRelationKind;
      readonly symmetric?: boolean;
    }
  | {
      readonly type: "alternative-group";
      readonly tier: "preferred" | "alternative";
    }
  | {
      readonly type: "intent-family";
      readonly relationship: IntentRelationship;
      readonly description: string;
    };

/** A tag definition in the shared vocabulary. */
export interface TeachingTagDef {
  readonly id: string;
  readonly label: string;
  readonly derives: TagDerivation;
}

/**
 * A surface-level annotation referencing a vocabulary tag.
 *
 * - `scope`: Groups surfaces within the same tag. Only surfaces sharing
 *   the same (tagId, scope) form a derivation group. Required for all tags.
 *   Use descriptive names: "r1-major-fit" for cross-module concepts,
 *   "stayman:r3-2h-strength" for module-local families.
 *
 * - `role`: For directed (non-symmetric) relation tags. "a" = stronger/source,
 *   "b" = weaker/target. Cannot be used with `ordinal`.
 *
 * - `ordinal`: For directed relation tags expressing ordered chains.
 *   Lower ordinal = stronger/first. Adjacent pairs (0→1, 1→2, etc.) are
 *   derived. Cannot be used with `role`.
 */
export interface TeachingTagRef {
  readonly tag: TeachingTagDef;
  readonly scope: string;
  readonly role?: "a" | "b";
  readonly ordinal?: number;
}
