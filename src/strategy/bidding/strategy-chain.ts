import type { BiddingStrategy, BidResult } from "../../shared/types";
import type { BiddingContext } from "../../conventions/core/types";
import { TraceCollector } from "./trace-collector";

export function createStrategyChain(
  strategies: readonly BiddingStrategy[],
): BiddingStrategy {
  return {
    id: `chain:${strategies.map((s) => s.id).join("+")}`,
    name: `Chain(${strategies.map((s) => s.name).join(", ")})`,
    suggest(context: BiddingContext): BidResult | null {
      const trace = new TraceCollector();

      for (const strategy of strategies) {
        try {
          const result = strategy.suggest(context);
          if (result !== null) {
            trace.addStrategyAttempt(strategy.id, "suggested");

            // Merge: if the result already has a trace (from conventionToStrategy),
            // augment it with the chain path. Otherwise, build a new one.
            const existingTrace = result.evaluationTrace;
            const chainPath = trace.build().strategyChainPath;

            return {
              ...result,
              evaluationTrace: existingTrace
                ? {
                    ...existingTrace,
                    strategyChainPath: [...chainPath],
                  }
                : trace.build(),
            };
          }
          trace.addStrategyAttempt(strategy.id, "declined");
        } catch {
          trace.addStrategyAttempt(strategy.id, "error");
        }
      }
      return null;
    },
  };
}
