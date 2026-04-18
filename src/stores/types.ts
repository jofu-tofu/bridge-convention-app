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
import type { DevServicePort, DrillHandle, SessionConfig } from "../service";
import type { ConventionInfo, GamePhase, ServicePublicBeliefState, PracticeMode, PracticeRole, PromptMode, SystemSelectionId } from "../service";
import type { BiddingViewport, DeclarerPromptViewport, PlayingViewport, ExplanationViewport, ViewportBidFeedback, TeachingDetail } from "../service";
import type {
  BidFeedback,
  BidHistoryEntry,
  DebugLogEntry,
  PlayLogEntry,
} from "./game.svelte";

// ── Session Stats ───────────────────────────────────────────────────

export interface SessionStats {
  readonly correct: number;
  readonly incorrect: number;
  readonly streak: number;
}

export interface DrillLaunchConfig {
  moduleIds: string[];
  practiceMode: PracticeMode;
  practiceRole: PracticeRole | "auto";
  systemSelectionId: SystemSelectionId;
  sourceDrillId: string | null;
}

// ── Game Store ──────────────────────────────────────────────────────


export interface GameStore {
  // Session identity
  readonly activeHandle: DrillHandle | null;

  /** True when a drill has been started (deal is loaded). Prefer over `deal !== null`. */
  readonly isInitialized: boolean;

  // Coordinator state
  readonly deal: Deal | null;
  readonly phase: GamePhase;
  readonly contract: Contract | null;
  readonly practiceMode: PracticeMode;
  readonly currentModuleId: string;

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

  // DDS state
  readonly ddsSolution: DDSolution | null;
  readonly ddsSolving: boolean;
  readonly ddsError: string | null;

  // Prompt state
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

  // Session stats (in-memory, per-bid, resets on menu navigation)
  readonly sessionStats: SessionStats;

  // Debug observability
  readonly debugLog: DebugLogEntry[];
  readonly playLog: PlayLogEntry[];

  // Methods
  userPlayCard(card: Card, seat: Seat): void;
  skipToReview(): void;
  restartPlay(): void;
  acceptPrompt(): void;
  declinePrompt(): void;
  playThisHand(): void;
  startNewDrill(config: SessionConfig): void;
  startDrillFromHandle(handle: DrillHandle, service?: DevServicePort): Promise<void>;
  /** Instantly auto-complete bidding and advance to target phase. */
  skipToPhase(targetPhase: "review" | "playing" | "declarer"): Promise<boolean>;
  userBid(call: Call): void;
  retryBid(): void;
  dismissFeedback(): void;
  getExpectedBid(): Promise<{ call: Call } | null>;
  reset(): void;
}

export interface DrillLaunchStore {
  readonly activeLaunch: DrillLaunchConfig | null;
  applyDrillSession(
    config: DrillLaunchConfig,
    conventions: readonly ConventionInfo[],
  ): void;
}
