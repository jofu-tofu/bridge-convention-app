import { Suit, BidSuit } from "../../service";

/*──────────────────────────────────────────────────────────────────────────────
 * Typography tokens
 *
 * The app's em-relative type scale.  Every text element in game screens
 * should use one of these tokens (via Tailwind `text-[--text-*]` or
 * inline `font-size: var(--text-*)`) instead of hardcoded Tailwind size
 * classes like text-xs / text-sm / text-base.
 *
 * Values are defined in app.css :root and cascade from the local font-size:
 *   * In panels -- cascades from --panel-font (set on <aside> by GameScreen)
 *   * In the table -- cascades from a compensated font-size on
 *     ScaledTableArea that accounts for the CSS transform scale
 *
 * This means the SAME token produces the same apparent pixel size in both
 * panels and on the CSS-transformed table.
 *─────────────────────────────────────────────────────────────────────────── */

/** Typography token names -- CSS custom property names for the app's type scale. */
export type TextToken =
  | "--text-annotation"
  | "--text-label"
  | "--text-detail"
  | "--text-body"
  | "--text-value"
  | "--text-heading"
  | "--text-title";

/** Suit colors for dark backgrounds (panels, trick history). */
export const SUIT_COLOR_CLASS: Record<Suit, string> = {
  [Suit.Spades]: "text-suit-spades",
  [Suit.Hearts]: "text-suit-hearts",
  [Suit.Diamonds]: "text-suit-diamonds",
  [Suit.Clubs]: "text-suit-clubs",
};

/** Suit colors for white card faces (Card component). */
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
