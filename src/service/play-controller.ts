/**
 * Play controller -- pure logic extracted from play.svelte.ts.
 *
 * No Svelte dependencies. No $state. No tick(). No delays.
 * The service runs the full play cycle atomically and returns a snapshot
 * plus an aiPlays list. The store owns animation timing.
 */

import type { Card, Trick, Seat } from "../engine/types";
import type { EnginePort } from "../engine/port";
import type { PlayContext } from "../core/contracts";
import { nextSeat, partnerSeat } from "../engine/constants";
import { randomPlayStrategy } from "../strategy/play/random-play";
import type { SessionState } from "./session-state";
import type { AiPlayEntry, PlayCardResult } from "./response-types";
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

  // Play the user's card
  addCardToTrick(state, card, seat);

  // Check if trick is complete after user's play
  if (state.currentTrick.length === 4) {
    await scoreTrick(state, engine);

    if (state.tricks.length === 13) {
      await completePlay(state, engine);
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
      return buildResult(state, true, aiPlays);
    }

    // User leads next trick
    const nextLegalPlays = await getNextLegalPlays(state, engine);
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
    return buildResult(state, false, aiPlays);
  }

  // Next player is user-controlled
  const nextLegalPlays = await getNextLegalPlays(state, engine);
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
  return {
    hand: { cards: remaining },
    currentTrick: [...state.currentTrick],
    previousTricks: [...state.tricks],
    contract: state.contract,
    seat,
    trumpSuit: state.trumpSuit,
    legalPlays: legalCards,
    dummyHand: dummyVisible && state.dummySeat
      ? state.deal.hands[state.dummySeat]
      : undefined,
    inferences: state.playInferences ?? undefined,
  };
}

/** Select a card using the play strategy or fall back to random. */
function selectAiCard(state: SessionState, seat: Seat, legalCards: readonly Card[]): { card: Card; reason: string } {
  const ctx = buildPlayContext(state, seat, legalCards);
  const strategy = state.playStrategy ?? randomPlayStrategy;
  const result = strategy.suggest(ctx);
  return { card: result.card, reason: result.reason };
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

    const { card, reason } = selectAiCard(state, seat, legalPlays);
    addCardToTrick(state, card, seat);
    aiPlays.push({ seat, card, reason });

    // Check if trick is complete
    if (state.currentTrick.length === 4) {
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
