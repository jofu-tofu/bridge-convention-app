/**
 * Single-open registry for bid-annotation popovers.
 *
 * One canonical `openEntryId` shared by every auction-rendering surface
 * (AuctionTable, RoundBidList, PlayHistoryPanel's minimal auction) and the
 * AuctionTable legend. Opening any closes all the others.
 *
 * The invariant is intentional, not accidental coupling: the user chose
 * "one popover open at a time across the whole screen" so two overlays
 * never clutter the view simultaneously.
 */

let openEntryId = $state<string | null>(null);

export function isOpen(id: string): boolean {
  return openEntryId === id;
}

export function requestOpen(id: string): void {
  openEntryId = id;
}

export function requestClose(id: string): void {
  if (openEntryId === id) openEntryId = null;
}

export function closeAll(): void {
  openEntryId = null;
}

export function currentOpenId(): string | null {
  return openEntryId;
}

if (typeof document !== "undefined") {
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && openEntryId !== null) {
      closeAll();
    }
  });

  document.addEventListener(
    "click",
    (event) => {
      if (openEntryId === null) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-bid-badge]")) return;
      if (target.closest("[data-auction-legend]")) return;
      closeAll();
    },
    true,
  );
}
