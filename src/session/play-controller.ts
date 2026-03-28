/**
 * Play controller -- pure logic extracted from play.svelte.ts.
 *
 * No Svelte dependencies. No $state. No tick(). No delays.
 * The service runs the full play cycle atomically and returns a snapshot
 * plus an aiPlays list. The store owns animation timing.
 */

import type { Card, Trick, Seat } from "../engine/types";
import type { EnginePort } from "../engine/port";
import type { PlayContext, PlayResult } from "../conventions";
import { nextSeat, partnerSeat } from "../engine/constants";
import { randomPlayStrategy } from "../session/heuristics/random-play";
import type { SessionState } from "./session-state";
import type { AiPlayEntry, PlayCardResult } from "../service/response-types";
import { isValidTransition } from "./phase-machine";

// ── Public API ──────────────────────────────────────────────────────

/**
 * Process a user's card play: validate, play it, run AI plays to completion
 * or next user turn, return result.
 *
 * Analogous to processBid() in bidding-controller.ts.
 * No delays -- service is transport-neutral. The store iterates through
 * aiPlays with local delays for animation.
 */
export async function processPlayCard(
  state: SessionState,
  card: Card,
  seat: Seat,
  engine: EnginePort,
): Promise<PlayCardResult> {
  // Guard: must have an active player and contract
  if (!state.currentPlayer || !state.contract) {
    return emptyPlayResult();
  }

  // Guard: card must be from the correct seat
  if (seat !== state.currentPlayer) {
    return emptyPlayResult();
  }

  // Guard: seat must be user-controlled
  if (!state.isUserControlledPlay(seat)) {
    return emptyPlayResult();
  }

  // Validate the card is legal
  const remaining = state.getRemainingCards(seat);
  const legalPlays = await engine.getLegalPlays(
    { cards: remaining },
    state.getLeadSuit(),
  );
  const isLegal = legalPlays.some(
    (c) => c.suit === card.suit && c.rank === card.rank,
  );
  if (!isLegal) {
    return emptyPlayResult();
  }

  // Capture position BEFORE mutating state, start world-class eval in parallel
  const trickIndex = state.tricks.length;
  const playIndex = state.currentTrick.length;
  const recPromise = (state.worldClassAdvisor && legalPlays.length > 1)
    ? state.worldClassAdvisor.suggest(buildPlayContext(state, seat, legalPlays))
    : null;

  // Play the user's card
  addCardToTrick(state, card, seat);

  // Check if trick is complete after user's play
  if (state.currentTrick.length === 4) {
    await scoreTrick(state, engine);

    if (state.tricks.length === 13) {
      await completePlay(state, engine);
      state.pendingRecommendation = resolveRecommendation(state, recPromise, trickIndex, playIndex, seat, card);
      return {
        accepted: true,
        trickComplete: true,
        playComplete: true,
        score: state.playScore,
        aiPlays: [],
        legalPlays: null,
        currentPlayer: null,
      };
    }

    // Trick complete, next player is the winner (set by scoreTrick)
    if (!state.isUserControlledPlay(state.currentPlayer)) {
      // AI leads next trick -- run AI plays
      const aiPlays = await runAiPlayLoop(state, engine);
      state.pendingRecommendation = resolveRecommendation(state, recPromise, trickIndex, playIndex, seat, card);
      return buildResult(state, true, aiPlays);
    }

    // User leads next trick
    const nextLegalPlays = await getNextLegalPlays(state, engine);
    state.pendingRecommendation = resolveRecommendation(state, recPromise, trickIndex, playIndex, seat, card);
    return {
      accepted: true,
      trickComplete: true,
      playComplete: false,
      score: null,
      aiPlays: [],
      legalPlays: nextLegalPlays,
      currentPlayer: state.currentPlayer,
    };
  }

  // Trick not complete -- advance to next player
  state.currentPlayer = nextSeat(state.currentPlayer);

  // If next player is AI, run AI plays
  if (!state.isUserControlledPlay(state.currentPlayer)) {
    const aiPlays = await runAiPlayLoop(state, engine);
    state.pendingRecommendation = resolveRecommendation(state, recPromise, trickIndex, playIndex, seat, card);
    return buildResult(state, false, aiPlays);
  }

  // Next player is user-controlled
  const nextLegalPlays = await getNextLegalPlays(state, engine);
  state.pendingRecommendation = resolveRecommendation(state, recPromise, trickIndex, playIndex, seat, card);
  return {
    accepted: true,
    trickComplete: false,
    playComplete: false,
    score: null,
    aiPlays: [],
    legalPlays: nextLegalPlays,
    currentPlayer: state.currentPlayer,
  };
}

/**
 * Run initial AI plays when entering the play phase.
 * If the opening leader (or subsequent players) are AI-controlled,
 * play cards until it's a user-controlled seat's turn.
 */
export async function runInitialAiPlays(
  state: SessionState,
  engine: EnginePort,
): Promise<AiPlayEntry[]> {
  if (!state.currentPlayer || !state.contract) return [];
  if (state.isUserControlledPlay(state.currentPlayer)) return [];
  return runAiPlayLoop(state, engine);
}

// ── Internal helpers ────────────────────────────────────────────────

/** Add a card to the current trick. */
function addCardToTrick(state: SessionState, card: Card, seat: Seat): void {
  state.currentTrick = [...state.currentTrick, { card, seat }];
}

/** Score a completed trick: determine winner, update counts, append to tricks. */
async function scoreTrick(state: SessionState, engine: EnginePort): Promise<void> {
  if (!state.contract) return;

  const trick: Trick = {
    plays: [...state.currentTrick],
    trumpSuit: state.trumpSuit,
  };
  const winner = await engine.getTrickWinner(trick);
  const completedTrick: Trick = { ...trick, winner };

  const declarerSide = new Set<Seat>([
    state.contract.declarer,
    partnerSeat(state.contract.declarer),
  ]);
  if (declarerSide.has(winner)) {
    state.declarerTricksWon++;
  } else {
    state.defenderTricksWon++;
  }

  state.tricks = [...state.tricks, completedTrick];
  state.currentTrick = [];
  state.currentPlayer = winner;
}

/** Complete the play: calculate score, transition to EXPLANATION. */
async function completePlay(state: SessionState, engine: EnginePort): Promise<void> {
  if (!state.contract) return;

  const result = await engine.calculateScore(
    state.contract,
    state.declarerTricksWon,
    state.deal.vulnerability,
  );
  state.playScore = result;
  state.currentPlayer = null;

  if (isValidTransition(state.phase, "EXPLANATION")) {
    state.phase = "EXPLANATION";
  }
}

/** Build PlayContext for AI card selection. */
function buildPlayContext(state: SessionState, seat: Seat, legalCards: readonly Card[]): PlayContext {
  if (!state.contract) {
    throw new Error("buildPlayContext called without an active contract");
  }
  const remaining = state.getRemainingCards(seat);
  const dummyVisible = state.tricks.length > 0 || state.currentTrick.length > 0;
  const dummySeat = state.dummySeat;
  const isDummyPlaying = dummySeat !== null && seat === dummySeat;
  // dummyHand = "the other visible hand in the partnership"
  // When declarer plays → dummy's hand. When dummy plays → declarer's hand.
  const otherVisibleHand = dummyVisible && dummySeat && state.contract
    ? isDummyPlaying
      ? { cards: state.getRemainingCards(state.contract.declarer) }
      : { cards: state.getRemainingCards(dummySeat) }
    : undefined;
  return {
    hand: { cards: remaining },
    currentTrick: [...state.currentTrick],
    previousTricks: [...state.tricks],
    contract: state.contract,
    seat,
    trumpSuit: state.trumpSuit,
    legalPlays: legalCards,
    dummyHand: otherVisibleHand,
    inferences: state.playInferences ?? undefined,
  };
}

/** Select a card using the play strategy provider, play strategy, or fall back to random. */
async function selectAiCard(state: SessionState, seat: Seat, legalCards: readonly Card[]): Promise<{ card: Card; reason: string }> {
  const ctx = buildPlayContext(state, seat, legalCards);
  const strategy = state.playStrategyProvider?.getStrategy()
    ?? state.playStrategy
    ?? randomPlayStrategy;
  const result = await strategy.suggest(ctx);
  return { card: result.card, reason: result.reason };
}

/** Resolve a pending world-class recommendation and store it. Non-fatal on failure. */
async function resolveRecommendation(
  state: SessionState,
  recPromise: Promise<PlayResult> | null,
  trickIndex: number,
  playIndex: number,
  seat: Seat,
  card: Card,
): Promise<void> {
  if (!recPromise) {
    state.pendingRecommendation = null;
    return;
  }
  try {
    const rec = await recPromise;
    state.playRecommendations.push({
      trickIndex, playIndex, seat, cardPlayed: card,
      recommendedCard: rec.card, reason: rec.reason,
      isOptimal: card.suit === rec.card.suit && card.rank === rec.card.rank,
    });
  } catch { /* MC+DDS failure is non-fatal — trick gets no recommendation */ }
  state.pendingRecommendation = null;
}

/**
 * Run AI play loop from the current player until a user-controlled seat
 * or play completion. Returns list of AI plays for animation.
 */
async function runAiPlayLoop(
  state: SessionState,
  engine: EnginePort,
): Promise<AiPlayEntry[]> {
  if (!state.contract) {
    console.error("runAiPlayLoop called without an active contract");
    return [];
  }

  const aiPlays: AiPlayEntry[] = [];

  while (state.currentPlayer && !state.isUserControlledPlay(state.currentPlayer)) {
    const seat = state.currentPlayer;
    const remaining = state.getRemainingCards(seat);
    const legalPlays = await engine.getLegalPlays(
      { cards: remaining },
      state.getLeadSuit(),
    );

    if (legalPlays.length === 0) break;

    const { card, reason } = await selectAiCard(state, seat, legalPlays);
    addCardToTrick(state, card, seat);
    const isTrickComplete = state.currentTrick.length === 4;
    aiPlays.push({ seat, card, reason, trickComplete: isTrickComplete || undefined });

    // Check if trick is complete
    if (isTrickComplete) {
      await scoreTrick(state, engine);

      if (state.tricks.length === 13) {
        await completePlay(state, engine);
        return aiPlays;
      }

      // After scoring, currentPlayer is the winner.
      // If winner is user-controlled, stop loop; otherwise continue.
      continue;
    }

    state.currentPlayer = nextSeat(state.currentPlayer);
  }

  return aiPlays;
}

/** Get legal plays for the current player. */
async function getNextLegalPlays(state: SessionState, engine: EnginePort): Promise<Card[]> {
  if (!state.currentPlayer) return [];
  const remaining = state.getRemainingCards(state.currentPlayer);
  return engine.getLegalPlays({ cards: remaining }, state.getLeadSuit());
}

/** Build a PlayCardResult from state after AI play loop. */
function buildResult(
  state: SessionState,
  trickCompletedBefore: boolean,
  aiPlays: AiPlayEntry[],
): PlayCardResult {
  const playComplete = state.currentPlayer === null;

  return {
    accepted: true,
    trickComplete: trickCompletedBefore,
    playComplete,
    score: playComplete ? state.playScore : null,
    aiPlays,
    legalPlays: null, // Caller should fetch legal plays if needed
    currentPlayer: state.currentPlayer,
  };
}

function emptyPlayResult(): PlayCardResult {
  return {
    accepted: false,
    trickComplete: false,
    playComplete: false,
    score: null,
    aiPlays: [],
    legalPlays: null,
    currentPlayer: null,
  };
}
