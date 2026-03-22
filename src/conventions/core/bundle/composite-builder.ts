import type { ConventionBundle } from "./bundle-types";
import { ConventionCategory } from "../../../core/contracts/convention";
import type { SystemProfile, ModuleEntry } from "../../../core/contracts/agreement-module";
import type { DealConstraints, SeatConstraint } from "../../../engine/types";

/**
 * Compose multiple convention bundles into a single composite bundle.
 *
 * Profile merge: concatenates module arrays from all profiles.
 * DerivedTeaching merge: concatenates acceptableAlternatives and surfaceGroups.
 *
 * Prerequisite: bundles must have non-overlapping activation contexts
 * (e.g., Bergen on 1H/1S, Stayman on 1NT — no conflict).
 */
export function composeBundles(
  compositeId: string,
  name: string,
  bundles: readonly ConventionBundle[],
): ConventionBundle {
  if (bundles.length === 0) {
    throw new Error("composeBundles requires at least one bundle");
  }

  // ── Member IDs (union) ──────────────────────────────────────
  const memberIds = bundles.flatMap((b) => b.memberIds);

  // ── System profile (merge modules from all profiles) ────────
  const systemProfile = mergeSystemProfiles(bundles);

  // ── Deal constraints (merge — most restrictive) ─────────────
  const dealConstraints = mergeDealConstraints(bundles);

  // ── Declared capabilities (merge all) ───────────────────────
  const capBundles = bundles.filter((b) => b.declaredCapabilities);
  const declaredCapabilities: Readonly<Record<string, string>> | undefined =
    capBundles.length > 0
      ? Object.assign({}, ...capBundles.map((b) => b.declaredCapabilities)) as Readonly<Record<string, string>>
      : undefined;

  return {
    id: compositeId,
    name,
    description: bundles.map((b) => b.description).filter(Boolean).join("; ") || "",
    category: bundles[0]!.category ?? ConventionCategory.Constructive,
    memberIds,
    modules: bundles.flatMap((b) => b.modules),
    dealConstraints,
    systemProfile,
    declaredCapabilities,
    derivedTeaching: {
      acceptableAlternatives: bundles.flatMap((b) => b.derivedTeaching.acceptableAlternatives),
      surfaceGroups: bundles.flatMap((b) => b.derivedTeaching.surfaceGroups),
      relations: bundles.flatMap((b) => b.derivedTeaching.relations),
    },
  };
}

// ── Helpers ─────────────────────────────────────────────────────

function mergeSystemProfiles(
  bundles: readonly ConventionBundle[],
): SystemProfile | undefined {
  const withProfiles = bundles.filter((b) => b.systemProfile);
  if (withProfiles.length === 0) return undefined;

  const base = withProfiles[0]!.systemProfile!;
  const allModules: ModuleEntry[] = withProfiles.flatMap(
    (b) => b.systemProfile!.modules,
  );

  // Deduplicate modules by moduleId (first occurrence wins)
  const seen = new Set<string>();
  const dedupedModules: ModuleEntry[] = [];
  for (const mod of allModules) {
    if (!seen.has(mod.moduleId)) {
      seen.add(mod.moduleId);
      dedupedModules.push(mod);
    }
  }

  // Merge exclusivity groups from all profiles' conflict policies
  const allExclusivityGroups = withProfiles.flatMap(
    (b) => b.systemProfile!.conflictPolicy.exclusivityGroups ?? [],
  );

  return {
    profileId: base.profileId,
    baseSystem: base.baseSystem,
    modules: dedupedModules,
    conflictPolicy: {
      ...base.conflictPolicy,
      exclusivityGroups:
        allExclusivityGroups.length > 0 ? allExclusivityGroups : undefined,
    },
  };
}

function mergeDealConstraints(
  bundles: readonly ConventionBundle[],
): DealConstraints {
  if (bundles.length === 1) return bundles[0]!.dealConstraints;

  // Merge seat constraints: collect all constraints, merge by seat
  const seatMap = new Map<string, SeatConstraint[]>();

  for (const bundle of bundles) {
    for (const sc of bundle.dealConstraints.seats) {
      const existing = seatMap.get(sc.seat) ?? [];
      existing.push(sc);
      seatMap.set(sc.seat, existing);
    }
  }

  const mergedSeats: SeatConstraint[] = [];
  for (const [, constraints] of seatMap) {
    if (constraints.length === 1) {
      mergedSeats.push(constraints[0]!);
    } else {
      // Take most restrictive: highest minHcp, lowest maxHcp, etc.
      mergedSeats.push(mergeSeatConstraints(constraints));
    }
  }

  // Take the first defined dealer/vulnerability
  const dealer = bundles.find((b) => b.dealConstraints.dealer)?.dealConstraints.dealer;
  const vulnerability = bundles.find((b) => b.dealConstraints.vulnerability)?.dealConstraints
    .vulnerability;

  return {
    seats: mergedSeats,
    ...(dealer !== undefined && { dealer }),
    ...(vulnerability !== undefined && { vulnerability }),
  };
}

function mergeSeatConstraints(constraints: SeatConstraint[]): SeatConstraint {
  const seat = constraints[0]!.seat;

  // Most restrictive: highest minHcp
  const minHcps = constraints.map((c) => c.minHcp).filter((v): v is number => v !== undefined);
  const minHcp = minHcps.length > 0 ? Math.max(...minHcps) : undefined;

  // Most restrictive: lowest maxHcp
  const maxHcps = constraints.map((c) => c.maxHcp).filter((v): v is number => v !== undefined);
  const maxHcp = maxHcps.length > 0 ? Math.min(...maxHcps) : undefined;

  return {
    seat,
    ...(minHcp !== undefined && { minHcp }),
    ...(maxHcp !== undefined && { maxHcp }),
  };
}
