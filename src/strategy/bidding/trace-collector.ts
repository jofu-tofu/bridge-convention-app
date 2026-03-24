// TraceCollector — mutable builder that collects trace events during convention
// evaluation and produces an immutable EvaluationTrace DTO.

import type { EvaluationTrace } from "../../conventions/pipeline/tree-evaluation";

export class TraceCollector {
  private conventionId = "";
  private candidateCount = 0;
  private forcingFiltered?: boolean;
  private strategyChainPath: { strategyId: string; result: "suggested" | "declined" | "filtered" | "error" }[] = [];

  setConventionId(id: string): void {
    this.conventionId = id;
  }

  setCandidateCount(count: number): void {
    this.candidateCount = count;
  }

  setForcingFiltered(value: boolean): void {
    this.forcingFiltered = value;
  }

  addStrategyAttempt(strategyId: string, result: "suggested" | "declined" | "filtered" | "error"): void {
    this.strategyChainPath.push({ strategyId, result });
  }

  build(): EvaluationTrace {
    return {
      conventionId: this.conventionId,
      candidateCount: this.candidateCount,
      forcingFiltered: this.forcingFiltered,
      strategyChainPath: [...this.strategyChainPath],
    };
  }
}
