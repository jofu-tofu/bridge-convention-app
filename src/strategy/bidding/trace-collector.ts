// TraceCollector — mutable builder that collects trace events during convention
// evaluation and produces an immutable EvaluationTrace DTO.

import type { EvaluationTrace } from "../../core/contracts";

export class TraceCollector {
  private conventionId = "";
  private protocolMatched = false;
  private candidateCount = 0;
  private selectedTier?: EvaluationTrace["selectedTier"];
  private forcingFiltered?: boolean;
  private practicalError?: string;
  private strategyChainPath: { strategyId: string; result: "suggested" | "declined" | "filtered" | "error" }[] = [];

  setConventionId(id: string): void {
    this.conventionId = id;
  }

  setProtocolMatched(matched: boolean): void {
    this.protocolMatched = matched;
  }

  setCandidateCount(count: number): void {
    this.candidateCount = count;
  }

  setSelectedTier(tier: EvaluationTrace["selectedTier"]): void {
    this.selectedTier = tier;
  }

  setForcingFiltered(value: boolean): void {
    this.forcingFiltered = value;
  }

  setPracticalError(error: string): void {
    this.practicalError = error;
  }

  addStrategyAttempt(strategyId: string, result: "suggested" | "declined" | "filtered" | "error"): void {
    this.strategyChainPath.push({ strategyId, result });
  }

  build(): EvaluationTrace {
    return {
      conventionId: this.conventionId,
      protocolMatched: this.protocolMatched,
      candidateCount: this.candidateCount,
      selectedTier: this.selectedTier,
      forcingFiltered: this.forcingFiltered,
      practicalError: this.practicalError,
      strategyChainPath: [...this.strategyChainPath],
    };
  }
}
