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
import type { BiddingViewport, DeclarerPromptViewport, PlayingViewport, ExplanationViewport, ViewportBidFeedback, TeachingDetail } from "../service";
import type {
  BidFeedback,
  BidHistoryEntry,
  DebugSnapshot,
  DebugLogEntry,
  PlayLogEntry,
} from "./game.svelte";
import type { InferenceSnapshot, PublicBeliefState } from "../inference/types";
import type { GamePhase } from "../service/phase-machine";

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

  // Bidding state
  readonly auction: Auction;
  readonly currentTurn: Seat | null;
  readonly bidHistory: BidHistoryEntry[];
  readonly isProcessing: boolean;
  readonly isUserTurn: boolean;
  readonly legalCalls: Call[];
  readonly bidFeedback: BidFeedback | null;
  readonly isFeedbackBlocking: boolean;

  // Play state
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

  // DDS state
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
  readonly declarerPromptViewport: DeclarerPromptViewport | null;
  readonly playingViewport: PlayingViewport | null;
  readonly explanationViewport: ExplanationViewport | null;
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

  // Namespaced sub-store accessors (backward compat)
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
