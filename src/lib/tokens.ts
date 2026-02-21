import { Suit, BidSuit } from "../engine/types";

export const SUIT_COLOR_CLASS: Record<Suit, string> = {
  [Suit.Spades]: "text-suit-spades",
  [Suit.Hearts]: "text-suit-hearts",
  [Suit.Diamonds]: "text-suit-diamonds",
  [Suit.Clubs]: "text-suit-clubs",
};

export const SUIT_CARD_COLOR_CLASS: Record<Suit, string> = {
  [Suit.Spades]: "text-suit-card-spades",
  [Suit.Hearts]: "text-suit-card-hearts",
  [Suit.Diamonds]: "text-suit-card-diamonds",
  [Suit.Clubs]: "text-suit-card-clubs",
};

export const BID_SUIT_COLOR_CLASS: Record<BidSuit, string> = {
  [BidSuit.Spades]: "text-suit-spades",
  [BidSuit.Hearts]: "text-suit-hearts",
  [BidSuit.Diamonds]: "text-suit-diamonds",
  [BidSuit.Clubs]: "text-suit-clubs",
  [BidSuit.NoTrump]: "text-text-primary",
};
