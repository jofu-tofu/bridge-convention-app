// SAYC intent resolvers — all bids are deterministic via defaultCall.
// Empty resolver map: every IntentNode in SAYC has a defaultCall that
// produces the correct concrete call. No resolver logic needed because
// SAYC bids don't depend on DialogueState — they depend on BiddingContext
// (hand + auction), which is already encoded in the defaultCall functions.

import type { IntentResolverFn, IntentResolverMap } from "../../core/intent/intent-resolver";

export const saycResolvers: IntentResolverMap = new Map<string, IntentResolverFn>();
