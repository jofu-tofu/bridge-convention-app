/**
 * Phase state machine — pure logic extracted from game.svelte.ts.
 *
 * No $state, no import.meta.env, no Svelte dependencies.
 * The game store wraps this with reactive state and DEV-mode error handling.
 */

export type GamePhase =
  | "BIDDING"
  | "DECLARER_PROMPT"
  | "PLAYING"
  | "EXPLANATION";

/** Valid phase transitions. Key = source phase, value = allowed target phases. */
export const VALID_TRANSITIONS: Record<GamePhase, readonly GamePhase[]> = {
  BIDDING: ["DECLARER_PROMPT", "PLAYING", "EXPLANATION"],
  DECLARER_PROMPT: ["PLAYING", "EXPLANATION"],
  PLAYING: ["EXPLANATION"],
  EXPLANATION: ["DECLARER_PROMPT"],
};

/** Check if a phase transition is valid. */
export function isValidTransition(from: GamePhase, to: GamePhase): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}
