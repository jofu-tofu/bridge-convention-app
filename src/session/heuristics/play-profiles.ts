import type { PlayStrategy } from "../../conventions";
import type { PublicBeliefs } from "../../inference/inference-types";
import type { Seat } from "../../engine/types";

// ── Profile identity ────────────────────────────────────────────────

export type PlayProfileId = "beginner" | "club-player" | "expert" | "world-class";

// ── Profile configuration ───────────────────────────────────────────

export interface PlayProfile {
  readonly id: PlayProfileId;
  /** Display name for settings UI. */
  readonly name: string;
  /** Tooltip description. */
  readonly description: string;
  /** Probability (0.0–0.3) of skipping eligible heuristics. */
  readonly heuristicSkipRate: number;
  /** Heuristic names eligible for random skip (beginner errors). */
  readonly skippableHeuristics: readonly string[];
  /** Whether L1 inference-enhanced heuristics are active. */
  readonly useInferences: boolean;
  /** Blur (0.0–0.5) on probability estimates for inference decisions. */
  readonly inferenceNoise: number;
  /** Whether L2 posterior queries are active. */
  readonly usePosterior: boolean;
  /** Whether to track played cards for distribution updates. */
  readonly useCardCounting: boolean;
}

// ── PlayStrategyProvider DI interface ────────────────────────────────

/** DI interface — session owns the provider, controller calls it per-play. */
export interface PlayStrategyProvider {
  /** Returns the active play strategy. May change between calls. */
  getStrategy(): PlayStrategy;
  /** Called at auction end to condition on the completed auction. */
  onAuctionComplete?(inferences: Record<Seat, PublicBeliefs>): void;
}

// ── Profile constants ───────────────────────────────────────────────

export const BEGINNER_PROFILE: PlayProfile = {
  id: "beginner",
  name: "Beginner",
  description: "Follows maxims mechanically. Occasionally misses correct technique.",
  heuristicSkipRate: 0.15,
  skippableHeuristics: ["cover-honor-with-honor", "trump-management"],
  useInferences: false,
  inferenceNoise: 0,
  usePosterior: false,
  useCardCounting: false,
};

export const CLUB_PLAYER_PROFILE: PlayProfile = {
  id: "club-player",
  name: "Club Player",
  description: "Remembers the auction, counts cards, tracks voids, exploits restricted choice.",
  heuristicSkipRate: 0,
  skippableHeuristics: [],
  useInferences: true,
  inferenceNoise: 0.25,
  usePosterior: false,
  useCardCounting: true,
};

export const EXPERT_PROFILE: PlayProfile = {
  id: "expert",
  name: "Expert",
  description: "Monte Carlo + DDS solving with void tracking. No auction belief filtering.",
  heuristicSkipRate: 0,
  skippableHeuristics: [],
  useInferences: true,
  inferenceNoise: 0,
  usePosterior: false,
  useCardCounting: true,
};

export const WORLD_CLASS_PROFILE: PlayProfile = {
  id: "world-class",
  name: "World Class",
  description: "Monte Carlo sampling + DDS solving. Plays optimally given available information.",
  heuristicSkipRate: 0,
  skippableHeuristics: [],
  useInferences: true,
  inferenceNoise: 0,
  usePosterior: true,
  useCardCounting: true,
};

export const PLAY_PROFILES: Record<PlayProfileId, PlayProfile> = {
  beginner: BEGINNER_PROFILE,
  "club-player": CLUB_PLAYER_PROFILE,
  expert: EXPERT_PROFILE,
  "world-class": WORLD_CLASS_PROFILE,
};
