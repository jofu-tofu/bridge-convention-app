import type { BiddingStrategy, BidResult } from "../../core/contracts";
import type { BiddingContext } from "../../conventions/core/types";
import { TraceCollector } from "./trace-collector";

export interface StrategyChainOptions {
  /** When provided, results failing this predicate are treated as "declined". */
  resultFilter?: (result: BidResult, context: BiddingContext) => boolean;
}

export function createStrategyChain(
  strategies: readonly BiddingStrategy[],
  options?: StrategyChainOptions,
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
            if (options?.resultFilter && !options.resultFilter(result, context)) {
              trace.addStrategyAttempt(strategy.id, "filtered");
              trace.setForcingFiltered(true);
              continue;
            }
            trace.addStrategyAttempt(strategy.id, "suggested");

            // Merge: if the result already has a trace (from conventionToStrategy),
            // augment it with the chain path. Otherwise, build a new one.
            const existingTrace = result.evaluationTrace;
            const builtTrace = trace.build();

            return {
              ...result,
              evaluationTrace: existingTrace
                ? {
                    ...existingTrace,
                    strategyChainPath: [...builtTrace.strategyChainPath],
                    forcingFiltered: builtTrace.forcingFiltered,
                  }
                : builtTrace,
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
