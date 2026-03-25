import type { Auction, Seat } from "../../../engine/types";
import type { BidMeaning } from "../../pipeline/evaluation/meaning";
import type { PublicSnapshot } from "../module-surface";

/** A runtime module that can emit decision surfaces for evaluation. */
export interface RuntimeModule {
  readonly id: string;
  readonly capabilities: readonly string[];
  readonly isActive: (auction: Auction, seat: Seat) => boolean;
  readonly emitSurfaces: (
    snapshot: PublicSnapshot,
    auction: Auction,
    seat: Seat,
  ) => readonly BidMeaning[];
  readonly updatePublicState?: (
    snapshot: PublicSnapshot,
    auction: Auction,
  ) => Partial<PublicSnapshot>;
}

/** One module's emitted surfaces, grouped by module ID. */
export interface DecisionSurfaceEntry {
  readonly moduleId: string;
  readonly surfaces: readonly BidMeaning[];
}

/** Diagnostic emitted during runtime evaluation. */
export interface RuntimeDiagnostic {
  readonly level: "info" | "warn" | "error";
  readonly moduleId?: string;
  readonly message: string;
}

/** Complete evaluation result: public snapshot + decision surfaces + diagnostics. */
export interface EvaluationResult {
  readonly publicSnapshot: PublicSnapshot;
  readonly decisionSurfaces: readonly DecisionSurfaceEntry[];
  readonly diagnostics: readonly RuntimeDiagnostic[];
}
