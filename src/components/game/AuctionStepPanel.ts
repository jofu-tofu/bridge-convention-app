import type { Hand, Seat } from "../../service";
import type { BidHistoryEntry } from "../../service";

/**
 * Compute which seats' hands should be visible at a given bid step.
 *
 * - User seat (South) is always visible.
 * - Dummy seat (if provided) is always visible.
 * - step === null → user + dummy visible (opponent hands hidden).
 * - step === 0 → only user's hand + dummy.
 * - step >= 1 → a seat is revealed once it has made at least one bid
 *   within the first `step` bids.
 */
export function computeVisibleSeats(
  allHands: Record<Seat, Hand>,
  userSeat: Seat,
  bidHistory: readonly BidHistoryEntry[],
  step: number | null,
  dummySeat?: Seat,
): Partial<Record<Seat, Hand>> {
  const visible: Partial<Record<Seat, Hand>> = {
    [userSeat]: allHands[userSeat],
  };
  if (dummySeat !== undefined) {
    visible[dummySeat] = allHands[dummySeat];
  }

  if (step === null) return visible;

  for (let i = 0; i < step && i < bidHistory.length; i++) {
    const entry = bidHistory[i];
    if (!entry) continue;
    const seat = entry.seat;
    if (!(seat in visible)) {
      visible[seat] = allHands[seat];
    }
  }

  return visible;
}
