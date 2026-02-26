import { tick } from "svelte";
import type { EnginePort } from "../engine/port";
import type {
  Deal,
  Contract,
  Card,
  PlayedCard,
  Trick,
  Hand,
} from "../engine/types";
import { BidSuit, Suit, Seat } from "../engine/types";
import { nextSeat, partnerSeat } from "../engine/constants";
import type {
  PlayStrategy,
  PlayContext,
  InferredHoldings,
} from "../shared/types";
import { randomPlayStrategy } from "../strategy/play/random-play";
import { delay } from "../util/delay";

const AI_PLAY_DELAY = 500;
const TRICK_PAUSE = 1000;

/** Map BidSuit to Suit for trump. NoTrump returns undefined. */
function bidSuitToSuit(strain: BidSuit): Suit | undefined {
  const map: Partial<Record<BidSuit, Suit>> = {
    [BidSuit.Clubs]: Suit.Clubs,
    [BidSuit.Diamonds]: Suit.Diamonds,
    [BidSuit.Hearts]: Suit.Hearts,
    [BidSuit.Spades]: Suit.Spades,
  };
  return map[strain];
}

/** Determine who controls a seat: 'user' or 'ai'. */
export function seatController(
  seat: Seat,
  declarer: Seat,
  userSeat: Seat,
): "user" | "ai" {
  if (seat === userSeat) return "user";
  if (seat === partnerSeat(declarer) && declarer === userSeat) return "user";
  return "ai";
}

export interface PlayLogEntry {
  readonly seat: Seat;
  readonly card: Card;
  readonly reason: string;
  readonly trickIndex: number;
}

export interface PlayStoreConfig {
  deal: Deal;
  contract: Contract;
  effectiveUserSeat: Seat;
  playStrategy: PlayStrategy | null;
  inferences: Record<Seat, InferredHoldings> | null;
  onPlayComplete: (score: number | null) => void;
}

export function createPlayStore(engine: EnginePort) {
  let tricks = $state<Trick[]>([]);
  let currentTrick = $state<PlayedCard[]>([]);
  let currentPlayer = $state<Seat | null>(null);
  let declarerTricksWon = $state(0);
  let defenderTricksWon = $state(0);
  let dummySeat = $state<Seat | null>(null);
  let score = $state<number | null>(null);
  let playAborted = $state(false);
  let trumpSuit = $state<Suit | undefined>(undefined);
  let isShowingTrickResult = $state(false);
  let isProcessing = $state(false);
  let playLog = $state<PlayLogEntry[]>([]);
  let activePlayStrategy = $state<PlayStrategy | null>(null);

  // Config set at startPlay time — not reactive, plain vars
  let activeDeal: Deal | null = null;
  let activeContract: Contract | null = null;
  let activeUserSeat: Seat | null = null;
  let activeInferences: Record<Seat, InferredHoldings> | null = null;
  let onPlayComplete: ((score: number | null) => void) | null = null;

  /** Check if a seat is user-controlled during play. */
  function isUserControlled(seat: Seat): boolean {
    if (!activeContract || !activeUserSeat) return false;
    return seatController(seat, activeContract.declarer, activeUserSeat) === "user";
  }

  /** Get remaining cards for a seat (original hand minus played cards). */
  function getRemainingCards(seat: Seat): Card[] {
    if (!activeDeal) return [];
    const played = new Set<string>();
    for (const trick of tricks) {
      for (const p of trick.plays) {
        if (p.seat === seat) played.add(`${p.card.suit}${p.card.rank}`);
      }
    }
    for (const p of currentTrick) {
      if (p.seat === seat) played.add(`${p.card.suit}${p.card.rank}`);
    }
    return activeDeal.hands[seat].cards.filter(
      (c) => !played.has(`${c.suit}${c.rank}`),
    );
  }

  /** Get lead suit of current trick (undefined if no cards played yet). */
  function getLeadSuit(): Suit | undefined {
    return currentTrick.length > 0 ? currentTrick[0]!.card.suit : undefined;
  }

  /** Build a PlayContext for AI card selection. */
  function buildPlayContext(
    seat: Seat,
    hand: Hand,
    legalCards: readonly Card[],
  ): PlayContext {
    const dummyVisible = tricks.length > 0 || currentTrick.length > 0;
    return {
      hand,
      currentTrick: [...currentTrick],
      previousTricks: [...tricks],
      contract: activeContract!,
      seat,
      trumpSuit,
      legalPlays: legalCards,
      dummyHand: dummyVisible && dummySeat && activeDeal ? activeDeal.hands[dummySeat] : undefined,
      inferences: activeInferences ?? undefined,
    };
  }

  /** Select a card using the active play strategy or fall back to random. */
  function selectAiCard(seat: Seat, legalCards: readonly Card[]): Card {
    const remaining = getRemainingCards(seat);
    const ctx = buildPlayContext(seat, { cards: remaining }, legalCards);
    const result = (activePlayStrategy && activeContract)
      ? activePlayStrategy.suggest(ctx)
      : randomPlayStrategy.suggest(ctx);
    playLog = [...playLog, { seat, card: result.card, reason: result.reason, trickIndex: tricks.length }];
    return result.card;
  }

  function addCardToTrick(card: Card, seat: Seat) {
    currentTrick = [...currentTrick, { card, seat }];
  }

  /** Score a completed trick: determine winner, update counts, append to tricks. */
  async function scoreTrick() {
    if (!activeContract) return;
    const trick: Trick = {
      plays: [...currentTrick],
      trumpSuit,
    };
    const winner = await engine.getTrickWinner(trick);
    const completedTrick: Trick = { ...trick, winner };

    const declarerSide = new Set([
      activeContract.declarer,
      partnerSeat(activeContract.declarer),
    ]);
    if (declarerSide.has(winner)) {
      declarerTricksWon++;
    } else {
      defenderTricksWon++;
    }

    tricks = [...tricks, completedTrick];
    currentTrick = [];
    currentPlayer = winner;
  }

  async function completeTrick() {
    await scoreTrick();
    const winner = currentPlayer!;

    // Brief pause to show completed trick (separate from isProcessing to avoid race)
    isShowingTrickResult = true;
    await delay(TRICK_PAUSE);
    isShowingTrickResult = false;

    if (playAborted) return;

    if (tricks.length === 13) {
      await completePlay();
      return;
    }

    // If next leader is AI, continue
    if (!isUserControlled(winner)) {
      await runAiPlays();
    }
  }

  async function runAiPlays() {
    isProcessing = true;
    try {
      while (currentPlayer && !isUserControlled(currentPlayer) && !playAborted) {
        await delay(AI_PLAY_DELAY);
        if (playAborted) break;

        const remaining = getRemainingCards(currentPlayer);
        const legalPlays = await engine.getLegalPlays(
          { cards: remaining },
          getLeadSuit(),
        );
        const card = selectAiCard(currentPlayer, legalPlays);
        addCardToTrick(card, currentPlayer);

        if (currentTrick.length === 4) {
          await completeTrick();
          // After completeTrick, currentPlayer is set to winner
          // Loop continues checking if winner is AI and not aborted
          continue;
        }

        currentPlayer = nextSeat(currentPlayer);
      }
    } finally {
      isProcessing = false;
    }
  }

  async function completePlay() {
    if (!activeContract || !activeDeal) return;
    const result = await engine.calculateScore(
      activeContract,
      declarerTricksWon,
      activeDeal.vulnerability,
    );
    score = result;
    currentPlayer = null;
    onPlayComplete?.(result);
  }

  async function userPlayCardImpl(card: Card, seat: Seat) {
    if (isProcessing || !currentPlayer || !activeDeal) return;
    if (seat !== currentPlayer) return;
    if (!isUserControlled(seat)) return;

    const remaining = getRemainingCards(seat);
    const legalPlays = await engine.getLegalPlays(
      { cards: remaining },
      getLeadSuit(),
    );
    const isLegal = legalPlays.some(
      (c) => c.suit === card.suit && c.rank === card.rank,
    );
    if (!isLegal) return;

    addCardToTrick(card, seat);
    await tick();

    if (currentTrick.length === 4) {
      await completeTrick();
    } else {
      currentPlayer = nextSeat(currentPlayer);
      await tick();
      if (!isUserControlled(currentPlayer)) {
        await runAiPlays();
      }
    }
  }

  async function skipToReviewImpl() {
    playAborted = true;
    if (!activeContract || !activeDeal) return;

    try {
      // Finish all remaining tricks without delays
      while (tricks.length < 13) {
        // Fill current trick to 4 cards
        while (currentTrick.length < 4) {
          if (!currentPlayer) return;
          const seat =
            currentTrick.length === 0
              ? currentPlayer
              : nextSeat(currentTrick[currentTrick.length - 1]!.seat);
          const remaining = getRemainingCards(seat);
          const leadSuit = getLeadSuit();
          const legalPlays = await engine.getLegalPlays(
            { cards: remaining },
            leadSuit,
          );
          // Use first legal play and log as "skip" — not AI-attributed
          const card = legalPlays[0]!;
          playLog = [...playLog, { seat, card, reason: "skip", trickIndex: tricks.length }];
          currentTrick = [...currentTrick, { card, seat }];
        }

        await scoreTrick();
      }

      await completePlay();
    } catch {
      // Engine failure during skip — still transition so game isn't stuck
      currentPlayer = null;
      onPlayComplete?.(null);
    }
  }

  function startPlay(config: PlayStoreConfig) {
    const { deal, contract, effectiveUserSeat, playStrategy, inferences } = config;
    activeDeal = deal;
    activeContract = contract;
    activeUserSeat = effectiveUserSeat;
    activePlayStrategy = playStrategy;
    activeInferences = inferences;
    onPlayComplete = config.onPlayComplete;

    playAborted = false;
    tricks = [];
    currentTrick = [];
    declarerTricksWon = 0;
    defenderTricksWon = 0;
    dummySeat = partnerSeat(contract.declarer);
    trumpSuit = bidSuitToSuit(contract.strain);
    score = null;
    isShowingTrickResult = false;
    isProcessing = false;

    // Opening leader: left of declarer
    currentPlayer = nextSeat(contract.declarer);

    // If opening leader is AI, start AI plays
    if (!isUserControlled(currentPlayer)) {
      isProcessing = true;
      runAiPlays().catch(() => {
        // Error in AI play loop — ensure isProcessing is cleared
        isProcessing = false;
      });
    }
  }

  function reset() {
    playAborted = true;
    tricks = [];
    currentTrick = [];
    currentPlayer = null;
    declarerTricksWon = 0;
    defenderTricksWon = 0;
    dummySeat = null;
    score = null;
    trumpSuit = undefined;
    isShowingTrickResult = false;
    isProcessing = false;
    playLog = [];
    activePlayStrategy = null;
    activeDeal = null;
    activeContract = null;
    activeUserSeat = null;
    activeInferences = null;
    onPlayComplete = null;
  }

  return {
    get tricks() { return tricks; },
    get currentTrick() { return currentTrick; },
    get currentPlayer() { return currentPlayer; },
    get declarerTricksWon() { return declarerTricksWon; },
    get defenderTricksWon() { return defenderTricksWon; },
    get dummySeat() { return dummySeat; },
    get score() { return score; },
    get trumpSuit() { return trumpSuit; },
    get isShowingTrickResult() { return isShowingTrickResult; },
    get isProcessing() { return isProcessing; },
    get playLog() { return playLog; },
    get playAborted() { return playAborted; },
    set playAborted(v: boolean) { playAborted = v; },
    getRemainingCards,
    async getLegalPlaysForSeat(seat: Seat): Promise<Card[]> {
      if (!activeDeal || currentPlayer !== seat) return [];
      const remaining = getRemainingCards(seat);
      return engine.getLegalPlays({ cards: remaining }, getLeadSuit());
    },
    startPlay,
    userPlayCard(card: Card, seat: Seat): void {
      userPlayCardImpl(card, seat).catch(() => {});
    },
    skipToReview(): void {
      skipToReviewImpl().catch(() => {});
    },
    reset,
  };
}
