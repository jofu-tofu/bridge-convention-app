import { Suit } from "../engine/types";
import type {
  Deal,
  Hand,
  HandEvaluation,
  Seat,
} from "../engine/types";
import { SUIT_ORDER } from "../engine/constants";
import { calculateHcp } from "../engine/hand-evaluator";
import type { CommandResult, OutputFormat } from "./types";

interface FormatOptions {
  unicode?: boolean;
}

const SUIT_SYMBOLS: Record<Suit, string> = {
  [Suit.Spades]: "♠",
  [Suit.Hearts]: "♥",
  [Suit.Diamonds]: "♦",
  [Suit.Clubs]: "♣",
};

const SUIT_LETTERS: Record<Suit, string> = {
  [Suit.Spades]: "S",
  [Suit.Hearts]: "H",
  [Suit.Diamonds]: "D",
  [Suit.Clubs]: "C",
};

function suitDisplay(suit: Suit, unicode: boolean): string {
  return unicode ? SUIT_SYMBOLS[suit] : SUIT_LETTERS[suit];
}

function formatHandCards(hand: Hand, unicode: boolean): string {
  const bySuit: Record<Suit, string[]> = {
    [Suit.Spades]: [],
    [Suit.Hearts]: [],
    [Suit.Diamonds]: [],
    [Suit.Clubs]: [],
  };
  for (const card of hand.cards) {
    bySuit[card.suit].push(card.rank);
  }
  return SUIT_ORDER.map(
    (suit) => `${suitDisplay(suit, unicode)} ${bySuit[suit].join("")}`,
  ).join("  ");
}

export function formatDeal(
  deal: Deal,
  options: FormatOptions = {},
): string {
  const unicode = options.unicode !== false;
  const lines: string[] = [];
  const seats: Seat[] = ["N", "E", "S", "W"] as Seat[];
  for (const seat of seats) {
    const hand = deal.hands[seat];
    const hcp = calculateHcp(hand);
    lines.push(`${seat}: ${formatHandCards(hand, unicode)}  (${hcp} HCP)`);
  }
  lines.push(`Dealer: ${deal.dealer}  Vulnerability: ${deal.vulnerability}`);
  return lines.join("\n");
}

export function formatHandEvaluation(
  evaluation: HandEvaluation,
  options: FormatOptions = {},
): string {
  const _unicode = options.unicode !== false;
  const lines: string[] = [
    `HCP: ${evaluation.hcp}`,
    `Distribution: +${evaluation.distribution.shortness} shortness, +${evaluation.distribution.length} length = ${evaluation.distribution.total} dist pts`,
    `Total Points: ${evaluation.totalPoints}`,
    `Shape: ${evaluation.shape.join("-")}`,
    `Strategy: ${evaluation.strategy}`,
  ];
  return lines.join("\n");
}

export function formatResult(
  result: CommandResult,
  format: OutputFormat,
  options: FormatOptions = {},
): string {
  if (format === "json") {
    return JSON.stringify(result.data, null, 2);
  }

  switch (result.type) {
    case "deal":
      return formatDeal(result.data as Deal, options);
    case "evaluation":
      return formatHandEvaluation(result.data as HandEvaluation, options);
    default:
      return JSON.stringify(result.data, null, 2);
  }
}
