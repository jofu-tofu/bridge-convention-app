// Intent resolver — maps semantic intents to concrete calls + dialogue effects.
// Resolvers are plain data (ReadonlyMap), not global registries.

import type { Call } from "../../../engine/types";
import type { BiddingContext } from "../types";
import type { SemanticIntent } from "./semantic-intent";
import type { DialogueState } from "../dialogue/dialogue-state";

export interface ResolvedIntent {
  readonly call: Call;
}

/** A function that resolves a semantic intent to concrete call(s).
 *  May return a single result, an array of alternatives (tried in order), or null. */
export type IntentResolverFn = (
  intent: SemanticIntent,
  state: DialogueState,
  context: BiddingContext,
) => ResolvedIntent | readonly ResolvedIntent[] | null;

/** Map from SemanticIntentType value to resolver function. Plain data, no global state. */
export type IntentResolverMap = ReadonlyMap<string, IntentResolverFn>;

/**
 * Look up and call the resolver for an intent.
 * Normalizes result to array. Returns null if no resolver or resolver declines.
 */
export function resolveIntent(
  intent: SemanticIntent,
  state: DialogueState,
  context: BiddingContext,
  resolvers: IntentResolverMap,
): readonly ResolvedIntent[] | null {
  const resolver = resolvers.get(intent.type);
  if (!resolver) return null;
  const result = resolver(intent, state, context);
  if (result === null) return null;
  if ("call" in result) return [result];
  return result.length === 0 ? null : result;
}
