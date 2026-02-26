import { tick } from "svelte";
import type { EnginePort } from "../engine/port";
import type { Deal, Call, Auction, AuctionEntry } from "../engine/types";
import { Seat } from "../engine/types";
import type { DrillSession } from "../drill/types";
import type {
  BiddingStrategy,
  BidResult,
  TreeEvalSummary,
  ConditionDetail,
} from "../shared/types";
import { nextSeat } from "../engine/constants";
import { evaluateHand } from "../engine/hand-evaluator";
import { callsMatch } from "../engine/call-helpers";
import { createBiddingContext } from "../conventions/core/context-factory";
import type { GameStoreOptions } from "./game.svelte";

export interface BidHistoryEntry {
  readonly seat: Seat;
  readonly call: Call;
  readonly ruleName: string | null;
  readonly explanation: string;
  readonly isUser: boolean;
  readonly conditions?: readonly ConditionDetail[];
  readonly isCorrect?: boolean;
  readonly expectedResult?: BidResult;
  readonly treePath?: TreeEvalSummary;
}

export interface BidFeedback {
  readonly isCorrect: boolean;
  readonly userCall: Call;
  readonly expectedResult: BidResult | null;
}

const AI_BID_DELAY = 300;

function defaultDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface BiddingStoreConfig {
  deal: Deal;
  session: DrillSession;
  strategy: BiddingStrategy | null;
  initialAuction?: Auction;
  onAuctionComplete: (auction: Auction) => Promise<void>;
  onSkipToExplanation: (auction: Auction) => Promise<void>;
  onProcessBid?: (bid: AuctionEntry, auctionBefore: Auction) => void;
}

export function createBiddingStore(engine: EnginePort, options?: GameStoreOptions) {
  const delay = options?.delayFn ?? defaultDelay;
  let auction = $state<Auction>({ entries: [], isComplete: false });
  let currentTurn = $state<Seat | null>(null);
  let bidHistory = $state<BidHistoryEntry[]>([]);
  let isProcessing = $state(false);
  let legalCalls = $state<Call[]>([]);
  let bidFeedback = $state<BidFeedback | null>(null);
  let conventionStrategy = $state<BiddingStrategy | null>(null);

  // Retry state
  let preBidAuction = $state<Auction | null>(null);
  let preBidTurn = $state<Seat | null>(null);
  let preBidHistory = $state<BidHistoryEntry[] | null>(null);

  // Config set at init time — needs to be $state for $derived to track
  let activeDeal = $state<Deal | null>(null);
  let activeSession = $state<DrillSession | null>(null);
  let onAuctionComplete: ((auction: Auction) => Promise<void>) | null = null;
  let onSkipToExplanation: ((auction: Auction) => Promise<void>) | null = null;
  let onProcessBid: ((bid: AuctionEntry, auctionBefore: Auction) => void) | null = null;

  const isUserTurn = $derived(
    currentTurn !== null &&
      activeSession !== null &&
      activeSession.isUserSeat(currentTurn) &&
      !isProcessing,
  );

  async function runAiBids() {
    if (!activeSession || !activeDeal) return;
    isProcessing = true;
    try {
      while (currentTurn && !activeSession.isUserSeat(currentTurn)) {
        await delay(AI_BID_DELAY);

        const hand = activeDeal.hands[currentTurn];
        const result = activeSession.getNextBid(currentTurn, hand, auction);

        if (!result) break;

        const bidEntry = { seat: currentTurn, call: result.call };
        const auctionBefore = auction;
        let newAuction: Auction;
        try {
          newAuction = await engine.addCall(auction, bidEntry);
        } catch {
          break; // Stop AI bid loop — state stays consistent (bidHistory matches auction)
        }
        auction = newAuction;

        onProcessBid?.(bidEntry, auctionBefore);

        bidHistory = [
          ...bidHistory,
          {
            seat: currentTurn,
            call: result.call,
            ruleName: result.ruleName,
            explanation: result.explanation,
            isUser: false,
            conditions: result.conditions,
            treePath: result.treePath,
          },
        ];

        currentTurn = nextSeat(currentTurn);

        const complete = await engine.isAuctionComplete(auction);
        if (complete) {
          await onAuctionComplete?.(auction);
          return;
        }
      }

      if (currentTurn) {
        legalCalls = await engine.getLegalCalls(auction, currentTurn);
      }
    } finally {
      isProcessing = false;
      await tick();
    }
  }

  async function userBidImpl(call: Call) {
    if (!activeDeal || !activeSession) {
      if (import.meta.env.DEV) {
        throw new Error("userBid called but store not initialized (no active deal/session)");
      }
      return;
    }
    if (isProcessing) return;
    if (!currentTurn || !activeSession.isUserSeat(currentTurn)) return;

    let expectedResult: BidResult | null = null;
    if (conventionStrategy) {
      const hand = activeDeal.hands[currentTurn];
      const evaluation = evaluateHand(hand);
      expectedResult = conventionStrategy.suggest(
        createBiddingContext({ hand, auction, seat: currentTurn, evaluation }),
      );
    }

    const isCorrect = callsMatch(
      call,
      expectedResult?.call ?? { type: "pass" },
    );

    bidFeedback = {
      isCorrect,
      userCall: call,
      expectedResult: expectedResult ?? {
        call: { type: "pass" },
        ruleName: null,
        explanation: "No convention bid applies — pass",
      },
    };

    const auctionBeforeUser = auction;
    if (!isCorrect) {
      preBidAuction = auction;
      preBidTurn = currentTurn;
      preBidHistory = [...bidHistory];
    } else {
      preBidAuction = null;
      preBidTurn = null;
      preBidHistory = null;
    }

    const userBidEntry = { seat: currentTurn, call };
    auction = await engine.addCall(auction, userBidEntry);

    onProcessBid?.(userBidEntry, auctionBeforeUser);

    bidHistory = [
      ...bidHistory,
      {
        seat: currentTurn,
        call,
        ruleName: null,
        explanation: "User bid",
        isUser: true,
        isCorrect,
        expectedResult: !isCorrect ? (expectedResult ?? undefined) : undefined,
        treePath: expectedResult?.treePath,
      },
    ];

    currentTurn = nextSeat(currentTurn);

    if (isCorrect) {
      const complete = await engine.isAuctionComplete(auction);
      if (complete) {
        await onAuctionComplete?.(auction);
        bidFeedback = null;
        await tick();
        return;
      }
      await runAiBids();
      bidFeedback = null;
      await tick();
      return;
    }

    await tick();
  }

  async function dismissBidFeedbackImpl() {
    bidFeedback = null;

    const complete = await engine.isAuctionComplete(auction);
    if (complete) {
      await onAuctionComplete?.(auction);
      return;
    }

    await runAiBids();
    await tick();
  }

  async function retryBidImpl() {
    if (isProcessing) return;
    if (!preBidAuction || !preBidTurn || !preBidHistory) return;
    auction = preBidAuction;
    currentTurn = preBidTurn;
    bidHistory = preBidHistory;
    bidFeedback = null;
    preBidAuction = null;
    preBidTurn = null;
    preBidHistory = null;

    if (currentTurn) {
      legalCalls = await engine.getLegalCalls(auction, currentTurn);
    }

    await tick();
  }

  async function skipFromFeedbackImpl() {
    bidFeedback = null;

    const complete = await engine.isAuctionComplete(auction);
    if (!complete) {
      await runAiBids();
    }

    await onSkipToExplanation?.(auction);
    await tick();
  }

  async function init(config: BiddingStoreConfig) {
    const { deal, session, strategy, initialAuction } = config;
    activeDeal = deal;
    activeSession = session;
    conventionStrategy = strategy;
    onAuctionComplete = config.onAuctionComplete;
    onSkipToExplanation = config.onSkipToExplanation;
    onProcessBid = config.onProcessBid ?? null;

    bidFeedback = null;
    preBidAuction = null;
    preBidTurn = null;
    preBidHistory = null;

    if (initialAuction) {
      auction = initialAuction;
      bidHistory = initialAuction.entries.map((entry) => {
        let explanation: string;
        switch (entry.call.type) {
          case "bid":
            explanation = `Opening ${entry.call.level}${entry.call.strain} bid`;
            break;
          case "double":
            explanation = "Double";
            break;
          case "redouble":
            explanation = "Redouble";
            break;
          default:
            explanation = "Pass";
        }
        return {
          seat: entry.seat,
          call: entry.call,
          ruleName: null,
          explanation,
          isUser: false,
        };
      });
      const lastEntry =
        initialAuction.entries[initialAuction.entries.length - 1];
      currentTurn = lastEntry ? nextSeat(lastEntry.seat) : deal.dealer;
    } else {
      auction = { entries: [], isComplete: false };
      bidHistory = [];
      currentTurn = deal.dealer;
    }

    await tick();
    await runAiBids();
  }

  function reset() {
    auction = { entries: [], isComplete: false };
    currentTurn = null;
    bidHistory = [];
    isProcessing = false;
    legalCalls = [];
    bidFeedback = null;
    conventionStrategy = null;
    preBidAuction = null;
    preBidTurn = null;
    preBidHistory = null;
    activeDeal = null;
    activeSession = null;
    onAuctionComplete = null;
    onSkipToExplanation = null;
    onProcessBid = null;
  }

  return {
    get auction() { return auction; },
    get currentTurn() { return currentTurn; },
    get bidHistory() { return bidHistory; },
    get isProcessing() { return isProcessing; },
    get isUserTurn() { return isUserTurn; },
    get legalCalls() { return legalCalls; },
    get bidFeedback() { return bidFeedback; },
    init,
    reset,
    userBid(call: Call): void {
      userBidImpl(call).catch(() => {});
    },
    dismissBidFeedback(): void {
      dismissBidFeedbackImpl().catch(() => {});
    },
    retryBid(): void {
      retryBidImpl().catch(() => {});
    },
    skipFromFeedback(): void {
      skipFromFeedbackImpl().catch(() => {});
    },
    /** DEV: returns the expected bid result for the current user turn, or null */
    getExpectedBid(): BidResult | null {
      if (!activeDeal || !activeSession || !conventionStrategy || !currentTurn) return null;
      if (!activeSession.isUserSeat(currentTurn)) return null;
      const hand = activeDeal.hands[currentTurn];
      const evaluation = evaluateHand(hand);
      return conventionStrategy.suggest(
        createBiddingContext({ hand, auction, seat: currentTurn, evaluation }),
      );
    },
  };
}
