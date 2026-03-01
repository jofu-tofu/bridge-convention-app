// Intent resolver — maps semantic intents to concrete calls + dialogue effects.
// Resolvers are plain data (ReadonlyMap), not global registries.

import type { Call } from "../../../engine/types";
import type { BiddingContext } from "../types";
import type { SemanticIntent } from "./semantic-intent";
import type { DialogueState } from "../dialogue/dialogue-state";

export interface ResolvedIntent {
  readonly call: Call;
}

/**
 * Discriminated union for resolver outcomes.
 * - "resolved": one or more concrete encodings (tried in order, first legal wins)
 * - "use_default": no special encoding, use the IntentNode's defaultCall
 * - "declined": intent is invalid in this context, exclude the candidate entirely
 */
export type ResolverResult =
  | { readonly status: "resolved"; readonly calls: readonly ResolvedIntent[] }
  | { readonly status: "use_default" }
  | { readonly status: "declined" };

/**
 * A function that resolves a semantic intent to a typed outcome.
 * Returns ResolverResult describing what to do with this intent.
 */
export type IntentResolverFn = (
  intent: SemanticIntent,
  state: DialogueState,
  context: BiddingContext,
) => ResolverResult;

/** Map from SemanticIntentType value to resolver function. Plain data, no global state. */
export type IntentResolverMap = ReadonlyMap<string, IntentResolverFn>;

/**
 * Look up and call the resolver for an intent.
 * Returns null if no resolver registered (Map miss).
 * Returns the ResolverResult from the resolver function otherwise.
 */
export function resolveIntent(
  intent: SemanticIntent,
  state: DialogueState,
  context: BiddingContext,
  resolvers: IntentResolverMap,
): ResolverResult | null {
  const resolver = resolvers.get(intent.type);
  if (!resolver) return null;
  return resolver(intent, state, context);
}
