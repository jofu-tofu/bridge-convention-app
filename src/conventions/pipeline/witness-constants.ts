import { Seat, Suit, Vulnerability } from "../../engine/types";

// ─── Seat ordering (clockwise) ────────────────────────────────
export const CLOCKWISE: readonly Seat[] = [Seat.North, Seat.East, Seat.South, Seat.West];

// ─── Suit fact-ID → engine Suit (short keys) ─────────────────
export const SUIT_FACT_MAP: Record<string, Suit> = {
  spades: Suit.Spades,
  hearts: Suit.Hearts,
  diamonds: Suit.Diamonds,
  clubs: Suit.Clubs,
};

// ─── Vulnerability string → engine Vulnerability ──────────────
export const VULNERABILITY_MAP: Record<string, Vulnerability> = {
  none: Vulnerability.None,
  ns: Vulnerability.NorthSouth,
  ew: Vulnerability.EastWest,
  both: Vulnerability.Both,
};
