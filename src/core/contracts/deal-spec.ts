import type { HandPredicate, DealConstraint, PublicGuard } from "./predicates";

export type SeatRole = "self" | "partner" | "lho" | "rho" | "openingSide";

export interface DealSeatConstraint {
  readonly kind: "seat";
  readonly role: SeatRole;
  readonly predicate: HandPredicate;
}
export interface JointConstraint {
  readonly kind: "joint";
  readonly roles: [SeatRole, SeatRole];
  readonly predicate: DealConstraint;
}
interface PublicGuardConstraint {
  readonly kind: "public-guard";
  readonly guard: PublicGuard;
}
interface ExclusionConstraint {
  readonly kind: "exclusion";
  readonly meaningIds: readonly string[];
}
type ConstraintLayer = DealSeatConstraint | JointConstraint | PublicGuardConstraint | ExclusionConstraint;

export interface TeachingControls {
  readonly ambiguityPreference?: "allow" | "prefer-low" | "require-low";
  readonly maxLiveAlternatives?: number;
  readonly weightingMode?: "positiveOnly" | "teachingDefault" | "balanced" | "adaptive";
}

type GeneratorStrategy = "handFirst" | "publicFirst" | "hybrid";

type DealSpecTarget =
  | { readonly tier: "stable"; readonly kind: "module-active"; readonly moduleId: string }
  | { readonly tier: "stable"; readonly kind: "public-state"; readonly field: string; readonly value: unknown }
  | { readonly tier: "stable"; readonly kind: "meaning-available"; readonly meaningId: string }
  | { readonly tier: "stable"; readonly kind: "recommended-call"; readonly call: string }
  | { readonly tier: "stable"; readonly kind: "candidate-shape"; readonly minAlternatives: number; readonly maxAlternatives?: number }
  | { readonly tier: "debug"; readonly kind: "state-path"; readonly path: string }
  | { readonly tier: "debug"; readonly kind: "transition-id"; readonly transitionId: string };

export interface DealSpec {
  readonly specId: string;
  readonly moduleId: string;
  readonly layers: readonly ConstraintLayer[];
  readonly targets: readonly DealSpecTarget[];
  readonly teachingControls?: TeachingControls;
  readonly generatorStrategy?: GeneratorStrategy;
  readonly maxAttempts?: number;
  readonly setup?: {
    readonly dealerRole?: SeatRole;
    readonly vulnerability?: "none" | "ns" | "ew" | "both";
    readonly prefillAuction?: readonly string[];
  };
  readonly diagnosticMode?: boolean;
}

export interface UnsatisfiableResult {
  readonly specId: string;
  readonly unsatCore: readonly string[];
  readonly nearestSatisfiable?: {
    readonly relaxedConstraintId: string;
    readonly delta: string;
  };
}
