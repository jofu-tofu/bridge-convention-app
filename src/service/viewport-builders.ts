/**
 * Viewport builder helpers.
 *
 * Pure functions that adapt SessionState into service-layer response types
 * (BiddingViewport, DeclarerPromptViewport, PlayingViewport, ExplanationViewport).
 *
 * Extracted from local-service.ts to keep the service file focused on
 * orchestration and state management.
 */

import type { Card } from "../engine/types";
import { Seat } from "../engine/types";
import type { EnginePort } from "../engine/port";
import type { BiddingViewport, DeclarerPromptViewport, PlayingViewport, ExplanationViewport } from "./response-types";
import { buildBiddingViewport, buildDeclarerPromptViewport, buildPlayingViewport, buildExplanationViewport } from "../session/build-viewport";
import { partnerSeat } from "../engine/constants";
import { PromptMode } from "../session/drill-types";
import { SessionState, getCurrentTurn as getCurrentTurnFromState } from "../session/session-state";

/** Build a BiddingViewport from session state. */
export function buildBiddingViewportFromState(state: SessionState): BiddingViewport | null {
  const currentTurn = getCurrentTurnFromState(state);
  if (!currentTurn) return null;

  const seat = state.userSeat;
  const faceUpSeats = new Set<Seat>([seat]);

  // In DECLARER_PROMPT, show additional seats
  if (state.phase === "DECLARER_PROMPT" && state.contract) {
    if (state.contract.declarer === seat) {
      faceUpSeats.add(partnerSeat(state.contract.declarer));
    } else if (partnerSeat(state.contract.declarer) === seat) {
      faceUpSeats.add(state.contract.declarer);
    }
  }

  return buildBiddingViewport({
    deal: state.deal,
    userSeat: seat,
    auction: state.auction,
    bidHistory: state.bidHistory,
    legalCalls: state.legalCalls,
    faceUpSeats,
    conventionName: state.conventionId,
    isUserTurn: state.isUserSeat(currentTurn) && state.phase === "BIDDING",
    currentBidder: currentTurn,
    practiceMode: state.practiceMode,
  });
}

/** Determine the prompt mode from session state. */
export function getPromptMode(state: SessionState): PromptMode | null {
  if (state.phase !== "DECLARER_PROMPT" || !state.contract) return null;
  const userSeat = state.userSeat;
  if (state.contract.declarer !== userSeat && partnerSeat(state.contract.declarer) !== userSeat) return PromptMode.Defender;
  if (state.contract.declarer === userSeat) return PromptMode.SouthDeclarer;
  return PromptMode.DeclarerSwap;
}

/** Compute face-up seats for the declarer prompt phase. */
export function getDeclarerPromptFaceUpSeats(state: SessionState): Set<Seat> {
  const seat = state.effectiveUserSeat ?? state.userSeat;
  const seats = new Set<Seat>([seat]);

  if (state.contract) {
    const mode = getPromptMode(state);
    if (mode === PromptMode.SouthDeclarer) {
      seats.add(partnerSeat(state.contract.declarer));
    } else if (mode === PromptMode.DeclarerSwap) {
      seats.add(state.contract.declarer);
    }
  }

  return seats;
}

/** Build a DeclarerPromptViewport from session state. */
export function buildDeclarerPromptViewportFromState(state: SessionState): DeclarerPromptViewport | null {
  if (!state.contract || state.phase !== "DECLARER_PROMPT") return null;

  const mode = getPromptMode(state);
  if (!mode) return null;

  return buildDeclarerPromptViewport({
    deal: state.deal,
    userSeat: state.userSeat,
    faceUpSeats: getDeclarerPromptFaceUpSeats(state),
    auction: state.auction,
    bidHistory: state.bidHistory,
    contract: state.contract,
    promptMode: mode,
  });
}

/** Build a PlayingViewport from session state. Requires engine for legal plays. */
export async function buildPlayingViewportFromState(state: SessionState, engine: EnginePort): Promise<PlayingViewport | null> {
  if (state.phase !== "PLAYING") return null;

  const effectiveSeat = state.effectiveUserSeat ?? state.userSeat;
  const contract = state.contract;

  // Compute face-up seats: user + dummy (dummy is always visible in bridge)
  const faceUpSeats = new Set<Seat>([effectiveSeat]);
  if (contract) {
    const dummy = partnerSeat(contract.declarer);
    faceUpSeats.add(dummy);
  }

  // Compute user-controlled seats
  const userControlledSeats: Seat[] = [effectiveSeat];
  if (contract && state.effectiveUserSeat) {
    const dummy = partnerSeat(contract.declarer);
    if (dummy !== state.effectiveUserSeat && contract.declarer === state.effectiveUserSeat) {
      userControlledSeats.push(dummy);
    }
  }

  // Compute remaining cards per seat
  const remainingCards: Partial<Record<Seat, readonly Card[]>> = {};
  for (const s of [Seat.North, Seat.East, Seat.South, Seat.West] as Seat[]) {
    remainingCards[s] = state.getRemainingCards(s);
  }

  // Compute legal plays for the current player
  let legalPlays: readonly Card[] = [];
  if (state.currentPlayer) {
    const remaining = state.getRemainingCards(state.currentPlayer);
    legalPlays = await engine.getLegalPlays({ cards: remaining }, state.getLeadSuit());
  }

  return buildPlayingViewport({
    deal: state.deal,
    userSeat: effectiveSeat,
    faceUpSeats,
    auction: state.auction,
    bidHistory: state.bidHistory,
    rotated: state.effectiveUserSeat === Seat.North,
    contract,
    currentPlayer: state.currentPlayer,
    currentTrick: state.currentTrick,
    trumpSuit: state.trumpSuit,
    legalPlays,
    userControlledSeats,
    remainingCards,
    tricks: state.tricks,
    declarerTricksWon: state.declarerTricksWon,
    defenderTricksWon: state.defenderTricksWon,
  });
}

/** Build an ExplanationViewport from session state. */
export function buildExplanationViewportFromState(state: SessionState): ExplanationViewport | null {
  if (state.phase !== "EXPLANATION") return null;

  return buildExplanationViewport({
    deal: state.deal,
    userSeat: state.userSeat,
    auction: state.auction,
    bidHistory: state.bidHistory,
    contract: state.contract,
    score: state.playScore,
    declarerTricksWon: state.declarerTricksWon,
    defenderTricksWon: state.defenderTricksWon,
    tricks: state.tricks,
    playRecommendations: state.playRecommendations,
  });
}
