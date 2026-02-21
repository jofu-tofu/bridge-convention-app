import type { DrillConfig, DrillSession } from "./types";
import type { BidResult } from "../shared/types";
import type { Hand, Auction, Seat } from "../engine/types";
import { evaluateHand } from "../engine/hand-evaluator";

/**
 * Creates a DrillSession that manages bidding for a drill.
 *
 * Null contract for `getNextBid`:
 * - **User seat** (`seatStrategies[seat] === "user"`): returns `null` immediately.
 *   This signals the UI to wait for user input.
 * - **AI seat** where `strategy.suggest()` returns `null`: wraps as a pass BidResult
 *   with `{call: {type:"pass"}, ruleName: null, explanation: "No matching rule — defaulting to pass"}`.
 * - **AI seat** where `strategy.suggest()` returns a `BidResult`: returns it directly.
 */
export function createDrillSession(config: DrillConfig): DrillSession {
  return {
    config,

    getNextBid(seat: Seat, hand: Hand, auction: Auction): BidResult | null {
      const strategy = config.seatStrategies[seat];

      // User seat — return null to signal UI should wait for input
      if (strategy === "user") {
        return null;
      }

      // AI seat — delegate to strategy
      const evaluation = evaluateHand(hand);
      const context = { hand, auction, seat, evaluation };
      const result = strategy.suggest(context);

      // Strategy returned null — wrap as pass
      if (!result) {
        return {
          call: { type: "pass" },
          ruleName: null,
          explanation: "No matching rule — defaulting to pass",
        };
      }

      return result;
    },

    isUserSeat(seat: Seat): boolean {
      return config.seatStrategies[seat] === "user";
    },
  };
}
