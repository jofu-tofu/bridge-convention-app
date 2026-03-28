import type { BiddingViewport, AuctionEntryView, Seat } from "../../../service";
import { partnerSeat, nextSeat } from "../../../service";

/**
 * Build a plain-English summary of the pre-filled auction context.
 * Only shown in Decision Drill mode when there are pre-filled bids.
 */
export function buildContextSummary(viewport: BiddingViewport): string | null {
  if (viewport.practiceMode !== "decision-drill") return null;
  if (viewport.auctionEntries.length === 0) return null;

  const userSeat = viewport.seat;

  // Only summarize entries before the user's first turn
  const preFilled = getPreFilledEntries(viewport.auctionEntries, userSeat);
  if (preFilled.length === 0) return null;

  const parts: string[] = [];
  let firstNonPass = true;

  let i = 0;
  while (i < preFilled.length) {
    const entry = preFilled[i]!;
    const seatName = seatRelation(entry.seat, userSeat);

    if (entry.call.type === "pass") {
      // Collect consecutive passes
      const passSeats = [seatName];
      while (i + 1 < preFilled.length && preFilled[i + 1]!.call.type === "pass") {
        i++;
        passSeats.push(seatRelation(preFilled[i]!.seat, userSeat));
      }
      if (passSeats.length === 1) {
        parts.push(`${passSeats[0]} passed.`);
      } else {
        const last = passSeats.pop()!;
        parts.push(`${passSeats.join(", ")} and ${last} passed.`);
      }
    } else {
      const action = firstNonPass ? "opened" : "bid";
      firstNonPass = false;
      const annotation = entry.alertLabel ? ` (${entry.alertLabel})` : "";
      parts.push(`${seatName} ${action} ${entry.callDisplay}${annotation}.`);
    }
    i++;
  }

  // Final sentence
  const partnerBid = preFilled.some(
    (e) => e.seat === partnerSeat(userSeat) && e.call.type !== "pass",
  );
  parts.push(partnerBid ? "Your turn to respond." : "Your turn to bid.");

  const result = parts.join(" ");
  // Truncate if too long (keep first + last sentence, ellipsis in middle)
  if (result.length > 150 && parts.length > 3) {
    return `${parts[0]} … ${parts[parts.length - 1]}`;
  }
  return result;
}

/** Get auction entries before the user's first bidding opportunity. */
function getPreFilledEntries(
  entries: readonly AuctionEntryView[],
  userSeat: Seat,
): readonly AuctionEntryView[] {
  const idx = entries.findIndex((e) => e.seat === userSeat);
  return idx === -1 ? entries : entries.slice(0, idx);
}

/** Map a compass seat to a relationship label relative to the user. */
function seatRelation(seat: Seat, userSeat: Seat): string {
  if (seat === partnerSeat(userSeat)) return "Partner";
  // LHO = seat to the left of user (next in clockwise order)
  if (seat === nextSeat(userSeat)) return "LHO";
  // RHO = seat to the right of user
  if (seat === nextSeat(nextSeat(nextSeat(userSeat)))) return "RHO";
  return seat; // fallback (shouldn't happen — user's own seat is filtered)
}
