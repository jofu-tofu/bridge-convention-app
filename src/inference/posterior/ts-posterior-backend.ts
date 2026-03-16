import type { Hand } from "../../engine/types";
import type { PosteriorBackend, PosteriorState, WeightedParticle, PosteriorQueryIR } from "../../core/contracts/posterior-backend";
import type { ConditioningContext, PosteriorQueryResult, InferenceHealth, FactorIntrospection } from "../../core/contracts/posterior-query";
import type { HandFactResolverFn } from "../../core/contracts/fact-catalog";
import { sampleDeals } from "./posterior-sampler";
import { compilePublicHandSpace } from "./posterior-compiler";
import { calculateHcpAndShape, isBalanced } from "../../engine/hand-evaluator";
import { HCP_VALUES, SUIT_NAME_MAP } from "../../engine/constants";

const DEFAULT_SAMPLE_COUNT = 200;
const DEFAULT_SEED = 12345;

export function createTsBackend(options?: {
  sampleCount?: number;
  seed?: number;
  factResolver?: HandFactResolverFn;
}): PosteriorBackend {
  const sampleCount = options?.sampleCount ?? DEFAULT_SAMPLE_COUNT;
  const seed = options?.seed ?? DEFAULT_SEED;
  const factResolver = options?.factResolver;

  return {
    initialize(context: ConditioningContext): PosteriorState {
      // Use the old compilation path for now — sampler still expects PublicHandSpace[]
      const handSpaces = compilePublicHandSpace(context.snapshot);
      const ownHand = context.ownHand ?? { cards: [] as never };
      const ownSeat = context.observerSeat;

      const samples = sampleDeals(handSpaces, ownHand, ownSeat as any, sampleCount, seed, factResolver);

      // Convert WeightedDealSample[] to WeightedParticle[]
      const particles: WeightedParticle[] = samples.map((sample) => ({
        world: {
          hiddenDeal: sample.hands,
          branchAssignment: new Map(),
        },
        weight: sample.weight,
      }));

      return { particles, context };
    },

    query(state: PosteriorState, query: PosteriorQueryIR): PosteriorQueryResult {
      const health = buildHealth(state);
      const particles = state.particles;

      if (particles.length === 0) {
        return { value: 0, health };
      }

      switch (query.kind) {
        case "marginal-hcp": {
          let totalHcp = 0;
          for (const p of particles) {
            const hand = p.world.hiddenDeal.get(query.seat);
            if (hand) {
              totalHcp += hand.cards.reduce((sum, c) => sum + HCP_VALUES[c.rank], 0);
            }
          }
          return { value: totalHcp / particles.length, health };
        }

        case "suit-length": {
          const suit = SUIT_NAME_MAP[query.suit];
          let totalLen = 0;
          for (const p of particles) {
            const hand = p.world.hiddenDeal.get(query.seat);
            if (hand && suit !== undefined) {
              totalLen += hand.cards.filter((c) => c.suit === suit).length;
            }
          }
          return { value: totalLen / particles.length, health };
        }

        case "fit-probability": {
          // P(combined length >= threshold)
          let count = 0;
          const suit = SUIT_NAME_MAP[query.suit];
          if (suit === undefined) return { value: 0, health };
          for (const p of particles) {
            let combined = 0;
            for (const seatId of query.seats) {
              const hand = p.world.hiddenDeal.get(seatId);
              if (hand) {
                combined += hand.cards.filter((c) => c.suit === suit).length;
              }
            }
            if (combined >= query.threshold) count++;
          }
          return { value: count / particles.length, health };
        }

        case "is-balanced": {
          let count = 0;
          for (const p of particles) {
            const hand = p.world.hiddenDeal.get(query.seat);
            if (hand) {
              const { shape } = calculateHcpAndShape(hand);
              if (isBalanced(shape)) count++;
            }
          }
          return { value: count / particles.length, health };
        }

        case "joint-hcp": {
          let count = 0;
          for (const p of particles) {
            let total = 0;
            for (const seatId of query.seats) {
              const hand = p.world.hiddenDeal.get(seatId);
              if (hand) {
                total += hand.cards.reduce((sum, c) => sum + HCP_VALUES[c.rank], 0);
              }
            }
            if (total >= query.min && total <= query.max) count++;
          }
          return { value: count / particles.length, health };
        }

        case "branch-probability": {
          // Not yet wired — return 0
          return { value: 0, health };
        }
      }
    },

    conditionOnHand(state: PosteriorState, seat: string, hand: Hand): PosteriorState {
      // Filter particles to only those consistent with the given hand at the given seat
      const filtered = state.particles.filter((p) => {
        const existing = p.world.hiddenDeal.get(seat);
        if (!existing) return true;
        // Check if the hand matches (same card set)
        const existingCards = new Set(existing.cards.map((c) => `${c.suit}${c.rank}`));
        const newCards = new Set(hand.cards.map((c) => `${c.suit}${c.rank}`));
        if (existingCards.size !== newCards.size) return false;
        for (const card of newCards) {
          if (!existingCards.has(card)) return false;
        }
        return true;
      });
      return { particles: filtered, context: state.context };
    },

    introspect(state: PosteriorState): readonly FactorIntrospection[] {
      return state.context.factorGraph.factors.map((factor) => ({
        factor,
        satisfactionRate: state.particles.length > 0 ? 1 : 0,
        effectiveWeight: 1,
      }));
    },
  };
}

function buildHealth(state: PosteriorState): InferenceHealth {
  const totalParticles = state.particles.length;
  const totalWeight = state.particles.reduce((sum, p) => sum + p.weight, 0);
  const acceptanceRate = totalParticles > 0 ? totalWeight / totalParticles : 0;
  return {
    effectiveSampleSize: totalParticles,
    totalParticles,
    acceptanceRate,
  };
}
