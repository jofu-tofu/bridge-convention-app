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
  Suit,
} from "../service";
import type { DevServicePort, SessionHandle, SessionConfig } from "../service";
import type { ServicePublicBeliefs, ServiceGamePhase, ServiceInferenceSnapshot, ServicePublicBeliefState, PracticeMode, PlayPreference } from "../service";
import type { BiddingViewport, DeclarerPromptViewport, PlayingViewport, ExplanationViewport, ViewportBidFeedback, TeachingDetail } from "../service";
import type { PlaySuggestions } from "../service/debug-types";
import type {
  BidFeedback,
  BidHistoryEntry,
  DebugSnapshot,
  DebugLogEntry,
  PlayLogEntry,
} from "./game.svelte";

// ── Game Store ──────────────────────────────────────────────────────

type PromptMode = "defender" | "south-declarer" | "declarer-swap";

export interface GameStore {
  // Session identity
  readonly activeHandle: SessionHandle | null;

  /** True when a drill has been started (deal is loaded). Prefer over `deal !== null`. */
  readonly isInitialized: boolean;

  // Coordinator state
  readonly deal: Deal | null;
  readonly phase: ServiceGamePhase;
  readonly contract: Contract | null;
  readonly effectiveUserSeat: Seat | null;
  readonly practiceMode: PracticeMode;
  readonly playPreference: PlayPreference;
  readonly playUserSeat: Seat;
  readonly rotated: boolean;

  // Bidding state
  readonly auction: Auction;
  readonly currentTurn: Seat | null;
  readonly bidHistory: BidHistoryEntry[];
  readonly isProcessing: boolean;
  readonly isTransitioning: boolean;
  readonly isUserTurn: boolean;
  readonly legalCalls: Call[];
  readonly bidFeedback: BidFeedback | null;
  readonly isFeedbackBlocking: boolean;

  // Play state
  readonly tricks: readonly Trick[];
  readonly currentTrick: readonly PlayedCard[];
  readonly currentPlayer: Seat | null;
  readonly declarerTricksWon: number;
  readonly defenderTricksWon: number;
  readonly dummySeat: Seat | null;
  readonly score: number | null;
  readonly trumpSuit: Suit | undefined;
  readonly legalPlaysForCurrentPlayer: readonly Card[];
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
  readonly publicBeliefState: ServicePublicBeliefState;

  // Debug observability
  readonly debugLog: DebugLogEntry[];
  readonly playLog: PlayLogEntry[];
  readonly playSuggestions: PlaySuggestions;
  readonly playInferences: Record<Seat, ServicePublicBeliefs> | null;
  readonly inferenceTimeline: readonly ServiceInferenceSnapshot[];
  readonly ewInferenceTimeline: readonly ServiceInferenceSnapshot[];

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
    readonly tricks: readonly Trick[];
    readonly currentTrick: readonly PlayedCard[];
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
  userPlayCard(card: Card, seat: Seat): void;
  skipToReview(): void;
  restartPlay(): void;
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
  startNewDrill(config: SessionConfig): void;
  startDrillFromHandle(handle: SessionHandle, service?: DevServicePort): Promise<void>;
  /** Instantly auto-complete bidding and advance to target phase. */
  skipToPhase(targetPhase: "review" | "playing" | "declarer"): Promise<boolean>;
  userBid(call: Call): void;
  retryBid(): void;
  getExpectedBid(): Promise<{ call: Call } | null>;
  getDebugSnapshot(): Promise<DebugSnapshot>;
  reset(): void;
}
