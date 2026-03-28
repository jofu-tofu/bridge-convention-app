/**
 * Phase coordinator — stateless phase transition decisions.
 *
 * Maps (currentPhase, event) -> TransitionDescriptor for store consumption.
 * No Svelte, no service calls, no side effects. Pure decision logic.
 */

import type { GamePhase } from "./phase-machine";
import type { PlayPreference } from "./drill-types";
import type { Seat } from "../engine/types";

// ── Event types ────────────────────────────────────────────────────

export type PhaseEvent =
  | { type: "AUCTION_COMPLETE"; servicePhase: GamePhase }
  | { type: "PROMPT_ENTERED"; playPreference: PlayPreference }
  | { type: "ACCEPT_PLAY"; seat?: Seat }
  | { type: "DECLINE_PLAY" }
  | { type: "SKIP_TO_REVIEW" }
  | { type: "PLAY_COMPLETE" }
  | { type: "PLAY_THIS_HAND"; seat: Seat }
  | { type: "RESTART_PLAY" };

// ── Service action descriptors ─────────────────────────────────────

export type ServiceAction =
  | { type: "acceptPrompt"; mode: "play" | "skip" | "replay"; seat?: Seat }
  | { type: "skipToReview" }
  | { type: "restartPlay" };

// ── Viewport identifiers ───────────────────────────────────────────

export type ViewportNeeded = "bidding" | "declarerPrompt" | "playing" | "explanation";

// ── Transition descriptor ──────────────────────────────────────────

export interface TransitionDescriptor {
  /** Target phase after this transition completes (null = no phase change). */
  readonly targetPhase: GamePhase | null;
  /** Viewports the store should fetch from service. */
  readonly viewportsNeeded: readonly ViewportNeeded[];
  /** Whether to fire-and-forget DDS solve. */
  readonly triggerDDS: boolean;
  /** Whether to capture play inferences before transitioning. */
  readonly captureInferences: boolean;
  /** Service calls to execute in order. */
  readonly serviceActions: readonly ServiceAction[];
  /** Whether to reset play state (freshPlayState + clear animation). */
  readonly resetPlay: boolean;
  /** Auto-follow-up event. Only PROMPT_ENTERED produces this — structurally bounded. */
  readonly chainedEvent: PhaseEvent | null;
}

// ── Internal helpers ───────────────────────────────────────────────

function noTransition(): TransitionDescriptor {
  return {
    targetPhase: null,
    viewportsNeeded: [],
    triggerDDS: false,
    captureInferences: false,
    serviceActions: [],
    resetPlay: false,
    chainedEvent: null,
  };
}

// ── Coordinator entry point ────────────────────────────────────────

export function resolveTransition(currentPhase: GamePhase, event: PhaseEvent): TransitionDescriptor {
  switch (event.type) {
    case "AUCTION_COMPLETE":
      return resolveAuctionComplete(event.servicePhase);
    case "PROMPT_ENTERED":
      return resolvePromptEntered(event.playPreference);
    case "ACCEPT_PLAY":
      if (currentPhase !== "DECLARER_PROMPT") return noTransition();
      return resolveAcceptPlay(event.seat);
    case "DECLINE_PLAY":
      if (currentPhase !== "DECLARER_PROMPT") return noTransition();
      return resolveDeclinePlay();
    case "SKIP_TO_REVIEW":
      if (currentPhase !== "PLAYING") return noTransition();
      return resolveSkipToReview();
    case "PLAY_COMPLETE":
      if (currentPhase !== "PLAYING") return noTransition();
      return resolvePlayComplete();
    case "PLAY_THIS_HAND":
      if (currentPhase !== "EXPLANATION") return noTransition();
      return resolvePlayThisHand(event.seat);
    case "RESTART_PLAY":
      if (currentPhase !== "PLAYING") return noTransition();
      return resolveRestartPlay();
  }
}

// ── Event resolvers ────────────────────────────────────────────────

function resolveAuctionComplete(servicePhase: GamePhase): TransitionDescriptor {
  switch (servicePhase) {
    case "DECLARER_PROMPT":
      return {
        ...noTransition(),
        captureInferences: true,
        targetPhase: "DECLARER_PROMPT",
        viewportsNeeded: ["declarerPrompt"],
      };
    case "PLAYING":
      return {
        ...noTransition(),
        captureInferences: true,
        targetPhase: "PLAYING",
        viewportsNeeded: ["playing"],
        resetPlay: true,
      };
    case "EXPLANATION":
      return {
        ...noTransition(),
        captureInferences: true,
        targetPhase: "EXPLANATION",
        viewportsNeeded: ["explanation"],
        triggerDDS: true,
      };
    default:
      return noTransition();
  }
}

function resolvePromptEntered(playPreference: PlayPreference): TransitionDescriptor {
  if (playPreference === "always") {
    return { ...noTransition(), chainedEvent: { type: "ACCEPT_PLAY" } };
  }
  if (playPreference === "skip") {
    return { ...noTransition(), chainedEvent: { type: "DECLINE_PLAY" } };
  }
  return noTransition();
}

function resolveAcceptPlay(seat?: Seat): TransitionDescriptor {
  return {
    targetPhase: "PLAYING",
    viewportsNeeded: ["playing"],
    triggerDDS: false,
    captureInferences: false,
    serviceActions: [{ type: "acceptPrompt", mode: "play", seat }],
    resetPlay: true,
    chainedEvent: null,
  };
}

function resolveDeclinePlay(): TransitionDescriptor {
  return {
    targetPhase: "EXPLANATION",
    viewportsNeeded: ["explanation"],
    triggerDDS: true,
    captureInferences: false,
    serviceActions: [{ type: "acceptPrompt", mode: "skip" }],
    resetPlay: false,
    chainedEvent: null,
  };
}

function resolveSkipToReview(): TransitionDescriptor {
  return {
    targetPhase: "EXPLANATION",
    viewportsNeeded: ["explanation"],
    triggerDDS: true,
    captureInferences: false,
    serviceActions: [{ type: "skipToReview" }],
    resetPlay: false,
    chainedEvent: null,
  };
}

function resolvePlayComplete(): TransitionDescriptor {
  return {
    targetPhase: "EXPLANATION",
    viewportsNeeded: ["explanation"],
    triggerDDS: true,
    captureInferences: false,
    serviceActions: [],
    resetPlay: false,
    chainedEvent: null,
  };
}

function resolvePlayThisHand(seat: Seat): TransitionDescriptor {
  return {
    targetPhase: "PLAYING",
    viewportsNeeded: ["playing"],
    triggerDDS: false,
    captureInferences: false,
    serviceActions: [
      { type: "acceptPrompt", mode: "replay" },
      { type: "acceptPrompt", mode: "play", seat },
    ],
    resetPlay: true,
    chainedEvent: null,
  };
}

function resolveRestartPlay(): TransitionDescriptor {
  return {
    targetPhase: null,
    viewportsNeeded: ["playing"],
    triggerDDS: false,
    captureInferences: false,
    serviceActions: [{ type: "restartPlay" }],
    resetPlay: true,
    chainedEvent: null,
  };
}
