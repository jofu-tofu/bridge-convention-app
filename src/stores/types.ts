// ── Store Facade Interfaces ──────────────────────────────────────────
//
// Explicit interfaces for each store's public API. Consumers (components,
// context.ts) depend on these interfaces rather than ReturnType<typeof ...>,
// so store internals can evolve without breaking callers.

import type {
  Deal,
  Auction,
  Contract,
  Call,
  Card,
  Trick,
  PlayedCard,
  Seat,
  DDSolution,
} from "../engine/types";
import type { Suit } from "../engine/types";
import type { DrillBundle } from "../bootstrap/types";
import type { DevServicePort, SessionHandle } from "../service";
import type { PublicBeliefs } from "../core/contracts";
import type { BiddingViewport, ViewportBidFeedback, TeachingDetail } from "../core/viewport";
import type { BiddingStoreConfig } from "./bidding.svelte";
import type { PlayStoreConfig } from "./play.svelte";
import type {
  BidFeedback,
  BidHistoryEntry,
  DebugSnapshot,
  DebugLogEntry,
} from "./bidding.svelte";
import type { PlayLogEntry } from "./play.svelte";
import type { InferenceSnapshot, PublicBeliefState } from "../inference/types";
import type { GamePhase } from "./phase-machine";

// ── Bidding Store ───────────────────────────────────────────────────

export interface BiddingStore {
  readonly auction: Auction;
  readonly currentTurn: Seat | null;
  readonly bidHistory: BidHistoryEntry[];
  readonly isProcessing: boolean;
  readonly isUserTurn: boolean;
  readonly isFeedbackBlocking: boolean;
  readonly legalCalls: Call[];
  readonly bidFeedback: BidFeedback | null;
  readonly error: string | null;
  readonly debugLog: DebugLogEntry[];
  init(config: BiddingStoreConfig): Promise<void>;
  reset(): void;
  userBid(call: Call): void;
  retryBid(): void;
  getExpectedBid(): Promise<{ call: Call } | null>;
  getDebugSnapshot(): Promise<DebugSnapshot>;
}

// ── Play Store ──────────────────────────────────────────────────────

export interface PlayStore {
  readonly tricks: Trick[];
  readonly currentTrick: PlayedCard[];
  readonly currentPlayer: Seat | null;
  readonly declarerTricksWon: number;
  readonly defenderTricksWon: number;
  readonly dummySeat: Seat | null;
  readonly score: number | null;
  readonly trumpSuit: Suit | undefined;
  readonly isShowingTrickResult: boolean;
  readonly isProcessing: boolean;
  readonly playLog: PlayLogEntry[];
  readonly playAborted: boolean;
  readonly legalPlaysForCurrentPlayer: Card[];
  readonly userControlledSeats: readonly Seat[];
  readonly remainingCardsPerSeat: Partial<Record<Seat, readonly Card[]>>;
  getRemainingCards(seat: Seat): Card[];
  refreshLegalPlays(): Promise<void>;
  getLegalPlaysForSeat(seat: Seat): Promise<Card[]>;
  startPlay(config: PlayStoreConfig): void;
  userPlayCard(card: Card, seat: Seat): void;
  skipToReview(): void;
  reset(): void;
}

// ── DDS Store ───────────────────────────────────────────────────────

export interface DDSStore {
  readonly ddsSolution: DDSolution | null;
  readonly ddsSolving: boolean;
  readonly ddsError: string | null;
  triggerSolve(deal: Deal, contract: Contract): Promise<void>;
  reset(): void;
}

// ── Game Store ──────────────────────────────────────────────────────

type PromptMode = "defender" | "south-declarer" | "declarer-swap";

export interface GameStore {
  // Coordinator state
  readonly deal: Deal | null;
  readonly phase: GamePhase;
  readonly contract: Contract | null;
  readonly effectiveUserSeat: Seat | null;
  readonly playUserSeat: Seat;
  readonly rotated: boolean;

  // Bidding state (delegated)
  readonly auction: Auction;
  readonly currentTurn: Seat | null;
  readonly bidHistory: BidHistoryEntry[];
  readonly isProcessing: boolean;
  readonly isUserTurn: boolean;
  readonly legalCalls: Call[];
  readonly bidFeedback: BidFeedback | null;
  readonly isFeedbackBlocking: boolean;

  // Play state (delegated)
  readonly tricks: Trick[];
  readonly currentTrick: PlayedCard[];
  readonly currentPlayer: Seat | null;
  readonly declarerTricksWon: number;
  readonly defenderTricksWon: number;
  readonly dummySeat: Seat | null;
  readonly score: number | null;
  readonly trumpSuit: Suit | undefined;
  readonly legalPlaysForCurrentPlayer: Card[];
  readonly userControlledSeats: readonly Seat[];
  readonly remainingCardsPerSeat: Partial<Record<Seat, readonly Card[]>>;

  // DDS state (delegated)
  readonly ddsSolution: DDSolution | null;
  readonly ddsSolving: boolean;
  readonly ddsError: string | null;

  // Prompt state
  readonly isDefenderPrompt: boolean;
  readonly isSouthDeclarerPrompt: boolean;
  readonly promptMode: PromptMode | null;
  readonly faceUpSeats: ReadonlySet<Seat>;

  // Viewport getters
  readonly biddingViewport: BiddingViewport | null;
  readonly viewportFeedback: ViewportBidFeedback | null;
  readonly teachingDetail: TeachingDetail | null;

  // Public belief state
  readonly publicBeliefState: PublicBeliefState;

  // Debug observability
  readonly debugLog: DebugLogEntry[];
  readonly playLog: PlayLogEntry[];
  readonly playInferences: Record<Seat, PublicBeliefs> | null;
  readonly inferenceTimeline: readonly InferenceSnapshot[];
  readonly ewInferenceTimeline: readonly InferenceSnapshot[];

  // Namespaced sub-store accessors
  readonly bidding: {
    readonly auction: Auction;
    readonly bidHistory: BidHistoryEntry[];
    readonly bidFeedback: BidFeedback | null;
    readonly legalCalls: Call[];
    readonly currentTurn: Seat | null;
    readonly isUserTurn: boolean;
  };
  readonly play: {
    readonly tricks: Trick[];
    readonly currentTrick: PlayedCard[];
    readonly currentPlayer: Seat | null;
    readonly declarerTricksWon: number;
    readonly defenderTricksWon: number;
    readonly dummySeat: Seat | null;
    readonly score: number | null;
    readonly trumpSuit: Suit | undefined;
  };
  readonly dds: {
    readonly solution: DDSolution | null;
    readonly solving: boolean;
    readonly error: string | null;
  };

  // Methods
  setConventionName(name: string): void;
  getLegalPlaysForSeat(seat: Seat): Promise<Card[]>;
  refreshLegalPlays(): Promise<void>;
  getRemainingCards(seat: Seat): Card[];
  userPlayCard(card: Card, seat: Seat): void;
  skipToReview(): void;
  acceptPlay(seatOverride?: Seat): void;
  declinePlay(): void;
  acceptPrompt(): void;
  declinePrompt(): void;
  acceptDeclarerSwap(): void;
  declineDeclarerSwap(): void;
  acceptDefend(): void;
  declineDefend(): void;
  acceptSouthPlay(): void;
  declineSouthPlay(): void;
  playThisHand(): void;
  startDrill(bundle: DrillBundle, service?: DevServicePort, handle?: SessionHandle): Promise<void>;
  userBid(call: Call): void;
  retryBid(): void;
  getExpectedBid(): Promise<{ call: Call } | null>;
  getDebugSnapshot(): Promise<DebugSnapshot>;
  reset(): void;
}
