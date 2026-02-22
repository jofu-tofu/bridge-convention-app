import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/svelte";
import HandFan from "../../game/HandFan.svelte";
import { Suit, Rank } from "../../../engine/types";
import type { Card } from "../../../engine/types";

function card(suit: Suit, rank: Rank): Card {
  return { suit, rank };
}

const testCards: Card[] = [
  card(Suit.Spades, Rank.Ace),
  card(Suit.Hearts, Rank.King),
  card(Suit.Diamonds, Rank.Queen),
  card(Suit.Clubs, Rank.Jack),
];

describe("HandFan", () => {
  it("renders correct number of Card children", () => {
    const { container } = render(HandFan, {
      props: { cards: testCards },
    });
    const cards = container.querySelectorAll("[data-testid='card']");
    expect(cards).toHaveLength(4);
  });

  it("renders all cards face up when faceUp=true", () => {
    const { container } = render(HandFan, {
      props: { cards: testCards, faceUp: true },
    });
    const faceUpCards = container.querySelectorAll("[data-testid='card']");
    const faceDownCards = container.querySelectorAll(
      "[data-testid='card-back']",
    );
    expect(faceUpCards).toHaveLength(4);
    expect(faceDownCards).toHaveLength(0);
  });

  it("renders all cards face down when faceUp=false", () => {
    const { container } = render(HandFan, {
      props: { cards: testCards, faceUp: false },
    });
    const faceUpCards = container.querySelectorAll("[data-testid='card']");
    const faceDownCards = container.querySelectorAll(
      "[data-testid='card-back']",
    );
    expect(faceUpCards).toHaveLength(0);
    expect(faceDownCards).toHaveLength(4);
  });

  it("applies vertical CSS class when vertical=true", () => {
    const { container } = render(HandFan, {
      props: { cards: testCards, vertical: true },
    });
    const fan = container.querySelector("[data-testid='hand-fan']");
    expect(fan?.className).toContain("flex-col");
  });

  it("marks cards in legalPlays as clickable", () => {
    const legalCard = card(Suit.Spades, Rank.Ace);
    const { container } = render(HandFan, {
      props: {
        cards: testCards,
        legalPlays: [legalCard],
        onPlayCard: () => {},
      },
    });
    const cards = container.querySelectorAll("[data-testid='card']");
    const clickableCards = Array.from(cards).filter((c) =>
      c.className.includes("cursor-pointer"),
    );
    expect(clickableCards).toHaveLength(1);
  });

  it("fires onPlayCard with correct card when legal card clicked", async () => {
    const legalCard = card(Suit.Spades, Rank.Ace);
    const onPlayCard = vi.fn();
    const { container } = render(HandFan, {
      props: {
        cards: testCards,
        legalPlays: [legalCard],
        onPlayCard,
      },
    });
    const clickableCard = container.querySelector(
      "[data-testid='card'].cursor-pointer",
    );
    expect(clickableCard).not.toBeNull();
    await fireEvent.click(clickableCard!);
    expect(onPlayCard).toHaveBeenCalledWith(
      expect.objectContaining({ suit: Suit.Spades, rank: Rank.Ace }),
    );
  });

  it("does not fire onPlayCard for non-legal cards", async () => {
    const legalCard = card(Suit.Spades, Rank.Ace);
    const onPlayCard = vi.fn();
    const { container } = render(HandFan, {
      props: {
        cards: testCards,
        legalPlays: [legalCard],
        onPlayCard,
      },
    });
    // Click a non-clickable card (hearts king)
    const allCards = container.querySelectorAll("[data-testid='card']");
    const nonClickable = Array.from(allCards).find(
      (c) => !c.className.includes("cursor-pointer"),
    );
    if (nonClickable) {
      await fireEvent.click(nonClickable);
    }
    expect(onPlayCard).not.toHaveBeenCalled();
  });

  it("sorts cards by suit then rank when sorted=true", () => {
    const unsorted = [
      card(Suit.Clubs, Rank.Two),
      card(Suit.Spades, Rank.Ace),
      card(Suit.Hearts, Rank.King),
    ];
    const { container } = render(HandFan, {
      props: { cards: unsorted, sorted: true },
    });
    const cardEls = container.querySelectorAll("[data-testid='card']");
    // Sort order: Spades first, then Hearts, then Clubs
    expect(cardEls[0]?.getAttribute("data-suit")).toBe(Suit.Spades);
    expect(cardEls[1]?.getAttribute("data-suit")).toBe(Suit.Hearts);
    expect(cardEls[2]?.getAttribute("data-suit")).toBe(Suit.Clubs);
  });
});
