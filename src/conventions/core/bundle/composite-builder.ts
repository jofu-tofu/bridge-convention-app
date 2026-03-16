import type { ConventionBundle } from "./bundle-types";
import type { MeaningSurface } from "../../../core/contracts/meaning";
import type { SystemProfileIR, ModuleEntryIR } from "../../../core/contracts/agreement-module";
import type { ExplanationCatalogIR, ExplanationEntry } from "../../../core/contracts/explanation-catalog";
import type { DealConstraints, SeatConstraint, Auction, Seat } from "../../../engine/types";

/**
 * Compose multiple convention bundles into a single composite bundle.
 *
 * Surface merge: concatenates all modules' surface groups.
 * Fact merge: concatenates all fact extensions (namespaced by module, so no conflicts).
 * Profile merge: concatenates module arrays from all profiles.
 * Machine merge: parallel composition — first bundle's machine wins; warns if multiple exist.
 * Explanation merge: merges all explanation catalog entries (deduplicates by explanationId).
 * Pedagogical merge: concatenates all relations.
 *
 * Prerequisite: bundles must have non-overlapping activation contexts
 * (e.g., Bergen on 1H/1S, Stayman on 1NT — no FSM conflict).
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

  // ── Meaning surfaces (concatenate groups) ───────────────────
  const meaningSurfaces = bundles.some((b) => b.meaningSurfaces)
    ? bundles.flatMap((b) => b.meaningSurfaces ?? [])
    : undefined;

  // ── Fact extensions (concatenate) ───────────────────────────
  const factExtensions = bundles.some((b) => b.factExtensions)
    ? bundles.flatMap((b) => b.factExtensions ?? [])
    : undefined;

  // ── Pedagogical relations (concatenate) ─────────────────────
  const pedagogicalRelations = bundles.some((b) => b.pedagogicalRelations)
    ? bundles.flatMap((b) => b.pedagogicalRelations ?? [])
    : undefined;

  // ── Acceptable alternatives (concatenate) ───────────────────
  const acceptableAlternatives = bundles.some((b) => b.acceptableAlternatives)
    ? bundles.flatMap((b) => b.acceptableAlternatives ?? [])
    : undefined;

  // ── Intent families (concatenate) ───────────────────────────
  const intentFamilies = bundles.some((b) => b.intentFamilies)
    ? bundles.flatMap((b) => b.intentFamilies ?? [])
    : undefined;

  // ── Explanation catalog (merge entries, deduplicate) ─────────
  const explanationCatalog = mergeExplanationCatalogs(bundles);

  // ── System profile (merge modules from all profiles) ────────
  const systemProfile = mergeSystemProfiles(bundles);

  // ── Conversation machine (first wins, warn on multiple) ─────
  const machinesWithBundles = bundles
    .filter((b) => b.conversationMachine)
    .map((b) => ({ machine: b.conversationMachine!, bundleId: b.id }));

  if (machinesWithBundles.length > 1) {
    console.warn(
      `[composeBundles] Multiple conversation machines found in composite "${compositeId}". ` +
        `Using machine from "${machinesWithBundles[0]!.bundleId}". ` +
        `Bundles with machines: ${machinesWithBundles.map((m) => m.bundleId).join(", ")}`,
    );
  }
  const conversationMachine = machinesWithBundles[0]?.machine;

  // ── Deal constraints (merge — most restrictive) ─────────────
  const dealConstraints = mergeDealConstraints(bundles);

  // ── Surface router (compose — try each in order) ────────────
  const surfaceRouter = composeSurfaceRouters(bundles);

  // ── Declared capabilities (merge all) ───────────────────────
  const capBundles = bundles.filter((b) => b.declaredCapabilities);
  const declaredCapabilities =
    capBundles.length > 0
      ? Object.assign({}, ...capBundles.map((b) => b.declaredCapabilities))
      : undefined;

  return {
    id: compositeId,
    name,
    memberIds,
    dealConstraints,
    meaningSurfaces,
    factExtensions,
    surfaceRouter,
    systemProfile,
    conversationMachine,
    declaredCapabilities,
    explanationCatalog,
    pedagogicalRelations,
    acceptableAlternatives,
    intentFamilies,
  };
}

// ── Helpers ─────────────────────────────────────────────────────

function mergeExplanationCatalogs(
  bundles: readonly ConventionBundle[],
): ExplanationCatalogIR | undefined {
  const withCatalogs = bundles.filter((b) => b.explanationCatalog);
  if (withCatalogs.length === 0) return undefined;

  const seen = new Set<string>();
  const merged: ExplanationEntry[] = [];

  for (const bundle of withCatalogs) {
    for (const entry of bundle.explanationCatalog!.entries) {
      if (!seen.has(entry.explanationId)) {
        seen.add(entry.explanationId);
        merged.push(entry);
      }
    }
  }

  return {
    version: withCatalogs[0]!.explanationCatalog!.version,
    entries: merged,
  };
}

function mergeSystemProfiles(
  bundles: readonly ConventionBundle[],
): SystemProfileIR | undefined {
  const withProfiles = bundles.filter((b) => b.systemProfile);
  if (withProfiles.length === 0) return undefined;

  const base = withProfiles[0]!.systemProfile!;
  const allModules: ModuleEntryIR[] = withProfiles.flatMap(
    (b) => b.systemProfile!.modules,
  );

  // Deduplicate modules by moduleId (first occurrence wins)
  const seen = new Set<string>();
  const dedupedModules: ModuleEntryIR[] = [];
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
    priorityClassMapping: base.priorityClassMapping,
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

function composeSurfaceRouters(
  bundles: readonly ConventionBundle[],
): ((auction: Auction, seat: Seat) => readonly MeaningSurface[]) | undefined {
  const routers = bundles
    .filter((b) => b.surfaceRouter)
    .map((b) => b.surfaceRouter!);

  if (routers.length === 0) return undefined;
  if (routers.length === 1) return routers[0];

  // Compose: try each router in order, concatenate results
  return (auction: Auction, seat: Seat): readonly MeaningSurface[] =>
    routers.flatMap((router) => router(auction, seat));
}
