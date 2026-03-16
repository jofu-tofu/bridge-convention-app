import type { Auction, Seat } from "../../../engine/types";
import type { ConventionBundle } from "../bundle/bundle-types";
import type { RuntimeModule } from "./types";
import type { PublicSnapshot } from "../../../core/contracts/module-surface";
import type { MeaningSurface } from "../../../core/contracts/meaning";
import { resolveActiveModules } from "./profile-activation";

/**
 * Resolve active module/convention IDs for a bundle at a given auction position.
 *
 * Activation: systemProfile → resolveActiveModules (declarative).
 * Returns empty when no systemProfile is present.
 */
function resolveActivation(
  bundle: ConventionBundle,
  auction: Auction,
  seat: Seat,
): readonly string[] {
  if (bundle.systemProfile) {
    const capabilities: Record<string, string> = {
      ...(bundle.declaredCapabilities ?? {}),
    };
    return resolveActiveModules(bundle.systemProfile, auction, seat, capabilities);
  }
  return [];
}

/** Convert a ConventionBundle into RuntimeModule[] for the evaluation runtime. */
export function bundleToRuntimeModules(
  bundle: ConventionBundle,
): {
  modules: readonly RuntimeModule[];
  getActiveIds: (auction: Auction, seat: Seat) => readonly string[];
} {
  const getActiveIds = (auction: Auction, seat: Seat): readonly string[] =>
    resolveActivation(bundle, auction, seat);

  if (!bundle.meaningSurfaces) {
    return { modules: [], getActiveIds };
  }

  const modules: RuntimeModule[] = bundle.meaningSurfaces.map((group) => ({
    id: group.groupId,
    capabilities: [],
    isActive: (auction: Auction, seat: Seat): boolean => {
      if (bundle.surfaceRouter) {
        const routedSurfaces = bundle.surfaceRouter(auction, seat);
        return group.surfaces.some((s) => routedSurfaces.includes(s));
      }
      // Without router, all groups are active when bundle is active
      const activeIds = resolveActivation(bundle, auction, seat);
      return activeIds.length > 0;
    },
    emitSurfaces: (
      _snapshot: PublicSnapshot,
      auction: Auction,
      seat: Seat,
    ): readonly MeaningSurface[] => {
      if (bundle.surfaceRouter) {
        const routedSurfaces = bundle.surfaceRouter(auction, seat);
        return group.surfaces.filter((s) => routedSurfaces.includes(s));
      }
      return group.surfaces;
    },
  }));

  return { modules, getActiveIds };
}
