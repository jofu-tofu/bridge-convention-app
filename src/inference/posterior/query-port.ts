import type { PosteriorQueryPort, PosteriorQueryResult, FactorIntrospection } from "./posterior-boundary";
import type { PosteriorBackend, PosteriorState } from "./posterior-boundary";
import type { SuitName } from "../../engine/types";

export function createQueryPort(
  backend: PosteriorBackend,
  state: PosteriorState,
): PosteriorQueryPort {
  return {
    marginalHcp(seat: string): PosteriorQueryResult<number> {
      const result = backend.query(state, { kind: "marginal-hcp", seat });
      return result;
    },
    suitLength(seat: string, suit: SuitName): PosteriorQueryResult<number> {
      return backend.query(state, { kind: "suit-length", seat, suit });
    },
    fitProbability(seats: readonly string[], suit: SuitName, threshold: number): PosteriorQueryResult<number> {
      return backend.query(state, { kind: "fit-probability", seats, suit, threshold });
    },
    isBalanced(seat: string): PosteriorQueryResult<number> {
      return backend.query(state, { kind: "is-balanced", seat });
    },
    jointHcp(seats: readonly string[], min: number, max: number): PosteriorQueryResult<number> {
      return backend.query(state, { kind: "joint-hcp", seats, min, max });
    },
    branchProbability(familyId: string, branchId: string): PosteriorQueryResult<number> {
      return backend.query(state, { kind: "branch-probability", familyId, branchId });
    },
    activeFactors(): readonly FactorIntrospection[] {
      return backend.introspect(state);
    },
  };
}
