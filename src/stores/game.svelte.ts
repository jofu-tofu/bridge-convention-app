import type { EnginePort } from "../engine/port";
import type { Deal, Call, Auction, Seat, Contract } from "../engine/types";
import type { DrillSession } from "../ai/types";
import { nextSeat } from "../engine/constants";

export type GamePhase = "BIDDING" | "PLAYING" | "EXPLANATION";

export interface BidHistoryEntry {
  readonly seat: Seat;
  readonly call: Call;
  readonly ruleName: string | null;
  readonly explanation: string;
  readonly isUser: boolean;
}

export function createGameStore(engine: EnginePort) {
  let deal = $state<Deal | null>(null);
  let auction = $state<Auction>({ entries: [], isComplete: false });
  let phase = $state<GamePhase>("BIDDING");
  let currentTurn = $state<Seat | null>(null);
  let bidHistory = $state<BidHistoryEntry[]>([]);
  let contract = $state<Contract | null>(null);
  let isProcessing = $state(false);
  let legalCalls = $state<Call[]>([]);
  let drillSession = $state<DrillSession | null>(null);

  const isUserTurn = $derived(
    currentTurn !== null &&
    drillSession !== null &&
    drillSession.isUserSeat(currentTurn) &&
    !isProcessing,
  );

  async function completeAuction() {
    const result = await engine.getContract(auction);
    contract = result;
    // PLAYING phase = stub, immediately transition to EXPLANATION
    phase = "EXPLANATION";
  }

  async function runAiBids() {
    if (!drillSession || !deal) return;
    isProcessing = true;
    try {
      while (currentTurn && !drillSession.isUserSeat(currentTurn)) {
        const hand = deal.hands[currentTurn];
        const result = drillSession.getNextBid(currentTurn, hand, auction);

        // Safety: null from AI means no bid possible
        if (!result) break;

        auction = await engine.addCall(auction, { seat: currentTurn, call: result.call });
        bidHistory = [...bidHistory, {
          seat: currentTurn,
          call: result.call,
          ruleName: result.ruleName,
          explanation: result.explanation,
          isUser: false,
        }];

        currentTurn = nextSeat(currentTurn);

        const complete = await engine.isAuctionComplete(auction);
        if (complete) {
          await completeAuction();
          return;
        }
      }

      // Update legal calls for user's turn
      if (currentTurn) {
        legalCalls = await engine.getLegalCalls(auction, currentTurn);
      }
    } finally {
      isProcessing = false;
    }
  }

  return {
    get deal() { return deal; },
    get auction() { return auction; },
    get phase() { return phase; },
    get currentTurn() { return currentTurn; },
    get bidHistory() { return bidHistory; },
    get contract() { return contract; },
    get isProcessing() { return isProcessing; },
    get isUserTurn() { return isUserTurn; },
    get legalCalls() { return legalCalls; },

    async startDrill(
      newDeal: Deal,
      session: DrillSession,
      initialAuction?: Auction,
    ) {
      deal = newDeal;
      drillSession = session;
      contract = null;
      phase = "BIDDING";

      if (initialAuction) {
        auction = initialAuction;
        // Replay initial auction entries into bid history with generic explanations
        bidHistory = initialAuction.entries.map((entry) => ({
          seat: entry.seat,
          call: entry.call,
          ruleName: null,
          explanation: entry.call.type === "bid"
            ? `Opening ${entry.call.level}${entry.call.strain} bid`
            : "Pass",
          isUser: false,
        }));
        // Current turn is the next seat after the last entry
        const lastEntry = initialAuction.entries[initialAuction.entries.length - 1];
        currentTurn = lastEntry ? nextSeat(lastEntry.seat) : newDeal.dealer;
      } else {
        auction = { entries: [], isComplete: false };
        bidHistory = [];
        currentTurn = newDeal.dealer;
      }

      await runAiBids();
    },

    async userBid(call: Call) {
      if (isProcessing) return;
      if (!currentTurn || !drillSession?.isUserSeat(currentTurn)) return;

      auction = await engine.addCall(auction, { seat: currentTurn, call });
      bidHistory = [...bidHistory, {
        seat: currentTurn,
        call,
        ruleName: null,
        explanation: "User bid",
        isUser: true,
      }];

      currentTurn = nextSeat(currentTurn);

      const complete = await engine.isAuctionComplete(auction);
      if (complete) {
        await completeAuction();
        return;
      }

      await runAiBids();
    },

    async reset() {
      deal = null;
      auction = { entries: [], isComplete: false };
      phase = "BIDDING";
      currentTurn = null;
      bidHistory = [];
      contract = null;
      isProcessing = false;
      legalCalls = [];
      drillSession = null;
    },
  };
}
