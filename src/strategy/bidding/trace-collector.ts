// TraceCollector — mutable builder that collects trace events during convention
// evaluation and produces an immutable EvaluationTrace DTO.

import type { EvaluationTrace } from "../../shared/types";

export class TraceCollector {
  private conventionId = "";
  private protocolMatched = false;
  private activeRound?: string;
  private overlaysActivated: string[] = [];
  private overlayErrors: { overlayId: string; hook: string; error: string }[] = [];
  private resolverOutcome?: EvaluationTrace["resolverOutcome"];
  private candidateCount = 0;
  private selectedTier?: EvaluationTrace["selectedTier"];
  private strategyChainPath: { strategyId: string; result: "suggested" | "declined" | "error" }[] = [];

  setConventionId(id: string): void {
    this.conventionId = id;
  }

  setProtocolMatched(matched: boolean): void {
    this.protocolMatched = matched;
  }

  setActiveRound(round: string): void {
    this.activeRound = round;
  }

  addOverlayActivated(overlayId: string): void {
    this.overlaysActivated.push(overlayId);
  }

  addOverlayError(overlayId: string, hook: string, error: string): void {
    this.overlayErrors.push({ overlayId, hook, error });
  }

  setResolverOutcome(outcome: EvaluationTrace["resolverOutcome"]): void {
    this.resolverOutcome = outcome;
  }

  setCandidateCount(count: number): void {
    this.candidateCount = count;
  }

  setSelectedTier(tier: EvaluationTrace["selectedTier"]): void {
    this.selectedTier = tier;
  }

  addStrategyAttempt(strategyId: string, result: "suggested" | "declined" | "error"): void {
    this.strategyChainPath.push({ strategyId, result });
  }

  build(): EvaluationTrace {
    return {
      conventionId: this.conventionId,
      protocolMatched: this.protocolMatched,
      activeRound: this.activeRound,
      overlaysActivated: [...this.overlaysActivated],
      overlayErrors: [...this.overlayErrors],
      resolverOutcome: this.resolverOutcome,
      candidateCount: this.candidateCount,
      selectedTier: this.selectedTier,
      strategyChainPath: [...this.strategyChainPath],
    };
  }
}
