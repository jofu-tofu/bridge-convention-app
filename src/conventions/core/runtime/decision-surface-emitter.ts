import type { Auction, Seat } from "../../../engine/types";
import type { PublicSnapshot } from "../../../core/contracts/module-surface";
import type {
  RuntimeModule,
  DecisionSurfaceEntry,
  RuntimeDiagnostic,
} from "./types";

/** Emit decision surfaces from all active modules. */
export function emitDecisionSurfaces(
  modules: readonly RuntimeModule[],
  snapshot: PublicSnapshot,
  auction: Auction,
  seat: Seat,
): {
  entries: readonly DecisionSurfaceEntry[];
  diagnostics: readonly RuntimeDiagnostic[];
} {
  const entries: DecisionSurfaceEntry[] = [];
  const diagnostics: RuntimeDiagnostic[] = [];

  for (const mod of modules) {
    if (!mod.isActive(auction, seat)) continue;

    const surfaces = mod.emitSurfaces(snapshot, auction, seat);
    entries.push({ moduleId: mod.id, surfaces });

    if (surfaces.length === 0) {
      diagnostics.push({
        level: "warn",
        moduleId: mod.id,
        message: `Module "${mod.id}" is active but emitted no surfaces`,
      });
    }
  }

  return { entries, diagnostics };
}
