// TraceCollector — mutable builder that collects trace events during convention
// evaluation and produces an immutable EvaluationTrace DTO.

import type { EvaluationTrace } from "../../core/contracts";

export class TraceCollector {
  private conventionId = "";
  private protocolMatched = false;
  private activeRound?: string;
  private overlaysActivated: string[] = [];
  private overlayErrors: { overlayId: string; hook: string; error: string }[] = [];
  private resolverOutcome?: EvaluationTrace["resolverOutcome"];
  private candidateCount = 0;
  private selectedTier?: EvaluationTrace["selectedTier"];
  private effectivePath?: EvaluationTrace["effectivePath"];
  private forcingFiltered?: boolean;
  private practicalError?: string;
  private tierPeerCount?: number;
  private tierPeerBidNames?: readonly string[];
  private preRankingPeerCount?: number;
  private preRankingPeerBidNames?: readonly string[];
  private rankerResolved?: boolean;
  private strategyChainPath: { strategyId: string; result: "suggested" | "declined" | "filtered" | "error" }[] = [];

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

  setEffectivePath(path: NonNullable<EvaluationTrace["effectivePath"]>): void {
    this.effectivePath = path;
  }

  setForcingFiltered(value: boolean): void {
    this.forcingFiltered = value;
  }

  setPracticalError(error: string): void {
    this.practicalError = error;
  }

  setTierPeerCount(count: number): void {
    this.tierPeerCount = count;
  }

  setTierPeerBidNames(names: readonly string[]): void {
    this.tierPeerBidNames = names;
  }

  setPreRankingPeerCount(count: number): void {
    this.preRankingPeerCount = count;
  }

  setPreRankingPeerBidNames(names: readonly string[]): void {
    this.preRankingPeerBidNames = names;
  }

  setRankerResolved(value: boolean): void {
    this.rankerResolved = value;
  }

  addStrategyAttempt(strategyId: string, result: "suggested" | "declined" | "filtered" | "error"): void {
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
      forcingFiltered: this.forcingFiltered,
      practicalError: this.practicalError,
      tierPeerCount: this.tierPeerCount,
      tierPeerBidNames: this.tierPeerBidNames,
      preRankingPeerCount: this.preRankingPeerCount,
      preRankingPeerBidNames: this.preRankingPeerBidNames,
      rankerResolved: this.rankerResolved,
      effectivePath: this.effectivePath,
      strategyChainPath: [...this.strategyChainPath],
    };
  }
}
