/**
 * Derives ALL pedagogical content (relations, alternatives, intent families)
 * from `teachingTags` on MeaningSurfaces.
 *
 * Scans all surfaces across all modules, groups by (tagId, scope),
 * validates, and produces the output. Supports:
 * - Symmetric relations: all-pairs within group
 * - Directed relations with roles: cartesian product of a × b
 * - Directed relations with ordinals: adjacent pairs sorted by ordinal
 * - Alternative groups: scope string becomes the group label
 */

import type { ConventionModule } from "../core/convention-module";
import type { BidMeaning } from "../../core/contracts/meaning";
import type { TeachingTagDef } from "../../core/contracts/teaching-tag";
import type { TeachingRelation } from "../../core/contracts/teaching-projection";
import type { AlternativeGroup, IntentFamily, IntentRelationship } from "../../core/contracts/tree-evaluation";

// ── Internal types ──────────────────────────────────────────────────

interface TagMember {
  readonly tagDef: TeachingTagDef;
  readonly meaningId: string;
  readonly semanticClassId: string;
  readonly scope: string;
  readonly role?: "a" | "b";
  readonly ordinal?: number;
}

// ── Collection ──────────────────────────────────────────────────────

function collectTagMembers(modules: readonly ConventionModule[]): TagMember[] {
  const members: TagMember[] = [];

  function processSurface(surface: BidMeaning): void {
    if (!surface.teachingTags) return;
    for (const ref of surface.teachingTags) {
      members.push({
        tagDef: ref.tag,
        meaningId: surface.meaningId,
        semanticClassId: surface.semanticClassId,
        scope: ref.scope,
        role: ref.role,
        ordinal: ref.ordinal,
      });
    }
  }

  for (const mod of modules) {
    const seenMeaningIds = new Set<string>();
    for (const surface of mod.surfaces) {
      if (seenMeaningIds.has(surface.meaningId)) continue;
      seenMeaningIds.add(surface.meaningId);
      processSurface(surface);
    }
  }

  return members;
}

// ── Validation ──────────────────────────────────────────────────────

/**
 * Validate a tag group. Returns true if the group is complete and should be
 * derived, false if it is incomplete (e.g., missing members from modules not
 * present in a sub-bundle). Structural errors (duplicates, mixed roles/ordinals)
 * still throw — those indicate authoring bugs, not module subsetting.
 */
function validateTagGroup(groupKey: string, members: readonly TagMember[]): boolean {
  const first = members[0];
  if (!first) throw new Error(`Empty tag group: ${groupKey}`);
  const derives = first.tagDef.derives;

  // Check for duplicate (tagId, scope, meaningId) tuples
  const seen = new Set<string>();
  for (const m of members) {
    const key = `${m.tagDef.id}:${m.scope}:${m.meaningId}`;
    if (seen.has(key)) {
      throw new Error(`Duplicate (tag, scope, meaningId): ${key}`);
    }
    seen.add(key);
  }

  // Cannot mix roles and ordinals
  const hasRoles = members.some((m) => m.role !== undefined);
  const hasOrdinals = members.some((m) => m.ordinal !== undefined);
  if (hasRoles && hasOrdinals) {
    throw new Error(
      `Tag group "${groupKey}" mixes roles and ordinals — use one or the other`,
    );
  }

  if (derives.type === "relation") {
    if (derives.symmetric) {
      if (hasRoles) {
        const withRole = members.find((m) => m.role !== undefined)!;
        throw new Error(
          `Symmetric relation tag group "${groupKey}" must not use roles, ` +
          `but "${withRole.meaningId}" has role "${withRole.role}"`,
        );
      }
      if (hasOrdinals) {
        throw new Error(
          `Symmetric relation tag group "${groupKey}" must not use ordinals`,
        );
      }
    } else {
      // Directed: need either roles or ordinals
      if (!hasRoles && !hasOrdinals) {
        throw new Error(
          `Directed relation tag group "${groupKey}" requires roles or ordinals`,
        );
      }
      if (hasRoles) {
        // Incomplete directed group — skip when a role is missing (module not in bundle)
        if (!members.some((m) => m.role === "a")) return false;
        if (!members.some((m) => m.role === "b")) return false;
      }
      // Incomplete ordinal chain — skip when only 1 member present
      if (hasOrdinals && members.length < 2) return false;
    }
  } else {
    // Alternative-group and intent-family tags need ≥2 members; skip if incomplete
    if (members.length < 2) return false;
  }

  return true;
}

// ── Derivation ──────────────────────────────────────────────────────

function deriveRelations(
  members: readonly TagMember[],
  derives: { readonly type: "relation"; readonly kind: TeachingRelation["kind"]; readonly symmetric?: boolean },
): TeachingRelation[] {
  const relations: TeachingRelation[] = [];

  if (derives.symmetric) {
    // All-pairs: a[i] × a[j] where i < j
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        relations.push({
          kind: derives.kind,
          a: members[i]!.semanticClassId,
          b: members[j]!.semanticClassId,
        } as TeachingRelation);
      }
    }
  } else if (members.some((m) => m.ordinal !== undefined)) {
    // Ordinal chain: sort by ordinal, produce adjacent pairs
    const sorted = [...members].sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0));
    for (let i = 0; i < sorted.length - 1; i++) {
      relations.push({
        kind: derives.kind,
        a: sorted[i]!.semanticClassId,
        b: sorted[i + 1]!.semanticClassId,
      } as TeachingRelation);
    }
  } else {
    // Directed with roles: cartesian product of role "a" × role "b"
    const aMembers = members.filter((m) => m.role === "a");
    const bMembers = members.filter((m) => m.role === "b");
    for (const a of aMembers) {
      for (const b of bMembers) {
        relations.push({
          kind: derives.kind,
          a: a.semanticClassId,
          b: b.semanticClassId,
        } as TeachingRelation);
      }
    }
  }

  return relations;
}

function deriveAlternativeGroup(
  scope: string,
  members: readonly TagMember[],
  derives: { readonly type: "alternative-group"; readonly tier: "preferred" | "alternative" },
): AlternativeGroup {
  return {
    label: scope,
    members: members.map((m) => m.meaningId),
    tier: derives.tier,
  };
}

function deriveIntentFamily(
  groupKey: string,
  scope: string,
  members: readonly TagMember[],
  derives: { readonly type: "intent-family"; readonly relationship: IntentRelationship; readonly description: string },
): IntentFamily {
  return {
    id: groupKey,
    label: scope,
    members: members.map((m) => m.meaningId),
    relationship: derives.relationship,
    description: derives.description,
  };
}

// ── Public API ──────────────────────────────────────────────────────

export interface DerivedPedagogicalContent {
  readonly relations: readonly TeachingRelation[];
  readonly alternatives: readonly AlternativeGroup[];
  readonly intentFamilies: readonly IntentFamily[];
}

/**
 * Derive all pedagogical content from `teachingTags` on surfaces.
 * Scans all surfaces across all modules, groups by (tagId, scope),
 * validates, and produces relations, alternative groups, and intent families.
 */
export function deriveTeachingContent(
  modules: readonly ConventionModule[],
): DerivedPedagogicalContent {
  const allMembers = collectTagMembers(modules);

  // Group by (tagId, scope)
  const groups = new Map<string, TagMember[]>();
  for (const m of allMembers) {
    const groupKey = `${m.tagDef.id}::${m.scope}`;
    const existing = groups.get(groupKey);
    if (existing) {
      existing.push(m);
    } else {
      groups.set(groupKey, [m]);
    }
  }

  const relations: TeachingRelation[] = [];
  const alternatives: AlternativeGroup[] = [];
  const intentFamilies: IntentFamily[] = [];

  for (const [groupKey, members] of groups) {
    if (!validateTagGroup(groupKey, members)) continue;

    const derives = members[0]!.tagDef.derives;
    const scope = members[0]!.scope;

    switch (derives.type) {
      case "relation":
        relations.push(...deriveRelations(members, derives));
        break;
      case "alternative-group":
        alternatives.push(deriveAlternativeGroup(scope, members, derives));
        break;
      case "intent-family":
        intentFamilies.push(deriveIntentFamily(groupKey, scope, members, derives));
        break;
    }
  }

  return { relations, alternatives, intentFamilies };
}

