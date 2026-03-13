import type {
  PosteriorEngine,
  PublicHandSpace,
  SeatPosterior,
  PosteriorFactRequest,
  PosteriorFactValue,
  LikelihoodModel,
} from "../../core/contracts/posterior";
import type { PublicSnapshot } from "../../core/contracts/module-surface";
import type { Hand, Seat } from "../../engine/types";
import { compilePublicHandSpace } from "./posterior-compiler";
import { sampleDeals } from "./posterior-sampler";
import { POSTERIOR_FACT_HANDLERS } from "./posterior-facts";

const DEFAULT_SAMPLE_COUNT = 200;
const DEFAULT_SEED = 12345;

/**
 * Create a PosteriorEngine that compiles PublicSnapshot into PublicHandSpace[],
 * conditions on a seat's hand, and answers posterior-derived fact queries via
 * Monte Carlo sampling.
 */
export function createPosteriorEngine(options?: {
  sampleCount?: number;
  seed?: number;
}): PosteriorEngine {
  const sampleCount = options?.sampleCount ?? DEFAULT_SAMPLE_COUNT;
  const seed = options?.seed ?? DEFAULT_SEED;

  return {
    compilePublic(snapshot: PublicSnapshot): PublicHandSpace[] {
      return compilePublicHandSpace(snapshot);
    },

    conditionOnHand(
      space: PublicHandSpace,
      seat: Seat,
      hand: Hand,
    ): SeatPosterior {
      // Run sampler to get deal samples satisfying constraints
      const samples = sampleDeals([space], hand, seat, sampleCount, seed);

      // Extract per-sample hand maps for fact computation
      const sampleHandMaps: ReadonlyMap<string, Hand>[] = samples.map((s) => s.hands);

      const likelihoodModel: LikelihoodModel = {
        factors: [],
        combinationRule: "independent",
      };

      return {
        seatId: space.seatId,
        handSpace: space,
        likelihoodModel,
        effectiveSampleSize: samples.length,

        probability(query: PosteriorFactRequest): number {
          const handler = POSTERIOR_FACT_HANDLERS.get(query.factId);
          if (!handler) return 0;
          const result = handler(query, sampleHandMaps, hand, sampleCount);
          return result.expectedValue;
        },

        distribution(target: string): readonly { value: number; probability: number }[] {
          // Basic distribution: count occurrences of each value
          const counts = new Map<number, number>();
          for (const sampleHands of sampleHandMaps) {
            const partnerHand = sampleHands.get(space.seatId);
            if (!partnerHand) continue;
            // Compute the target fact value
            let val = 0;
            if (target === "hcp") {
              val = partnerHand.cards.reduce((sum, c) => {
                const hcpMap: Record<string, number> = { J: 1, Q: 2, K: 3, A: 4 };
                return sum + (hcpMap[c.rank] ?? 0);
              }, 0);
            }
            counts.set(val, (counts.get(val) ?? 0) + 1);
          }

          const total = sampleHandMaps.length || 1;
          return Array.from(counts.entries())
            .sort(([a], [b]) => a - b)
            .map(([value, count]) => ({
              value,
              probability: count / total,
            }));
        },
      };
    },

    deriveActingHandFacts(
      handSpace: PublicHandSpace,
      factIds: readonly string[],
    ): readonly PosteriorFactValue[] {
      // Use a default hand-independent sampling approach:
      // Sample deals with empty own hand conditioning (use all 52 cards distributed)
      // Since we don't have the acting hand here, we sample unconditioned
      const samples = sampleDeals([handSpace], { cards: [] as never }, "S" as Seat, sampleCount, seed);
      const sampleHandMaps: ReadonlyMap<string, Hand>[] = samples.map((s) => s.hands);

      return factIds.map((factId) => {
        const handler = POSTERIOR_FACT_HANDLERS.get(factId);
        if (!handler) {
          return {
            factId,
            seatId: handSpace.seatId,
            expectedValue: 0,
            confidence: 0,
          };
        }
        return handler(
          { factId, seatId: handSpace.seatId },
          sampleHandMaps,
          { cards: [] } as unknown as Hand, // any: no own hand for unconditioned sampling
          sampleCount,
        );
      });
    },
  };
}
