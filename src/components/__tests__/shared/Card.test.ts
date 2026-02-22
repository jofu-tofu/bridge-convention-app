import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/svelte";
import Card from "../../shared/Card.svelte";
import { Suit, Rank } from "../../../engine/types";

describe("Card", () => {
  it("renders rank and suit symbol when face up", () => {
    const { container } = render(Card, {
      props: { card: { suit: Suit.Spades, rank: Rank.Ace } },
    });
    expect(container.textContent).toContain("A");
    expect(container.textContent).toContain("\u2660");
  });

  it("uses suit-card-spades color class for spades", () => {
    const { container } = render(Card, {
      props: { card: { suit: Suit.Spades, rank: Rank.Ace } },
    });
    const spans = container.querySelectorAll("span");
    const hasClass = Array.from(spans).some((s) =>
      s.className.includes("text-suit-card-spades"),
    );
    expect(hasClass).toBe(true);
  });

  it("uses suit-card-hearts color class for hearts", () => {
    const { container } = render(Card, {
      props: { card: { suit: Suit.Hearts, rank: Rank.King } },
    });
    const spans = container.querySelectorAll("span");
    const hasClass = Array.from(spans).some((s) =>
      s.className.includes("text-suit-card-hearts"),
    );
    expect(hasClass).toBe(true);
  });

  it("uses suit-card-diamonds color class for diamonds", () => {
    const { container } = render(Card, {
      props: { card: { suit: Suit.Diamonds, rank: Rank.Queen } },
    });
    const spans = container.querySelectorAll("span");
    const hasClass = Array.from(spans).some((s) =>
      s.className.includes("text-suit-card-diamonds"),
    );
    expect(hasClass).toBe(true);
  });

  it("uses suit-card-clubs color class for clubs", () => {
    const { container } = render(Card, {
      props: { card: { suit: Suit.Clubs, rank: Rank.Jack } },
    });
    const spans = container.querySelectorAll("span");
    const hasClass = Array.from(spans).some((s) =>
      s.className.includes("text-suit-card-clubs"),
    );
    expect(hasClass).toBe(true);
  });

  it("does not show rank or suit when face down", () => {
    const { container } = render(Card, {
      props: { card: { suit: Suit.Spades, rank: Rank.Ace }, faceUp: false },
    });
    expect(container.textContent).not.toContain("A");
    expect(container.textContent).not.toContain("\u2660");
    expect(container.querySelector("[data-testid='card-back']")).not.toBeNull();
  });

  it("applies clickable cursor class when clickable=true", () => {
    const { container } = render(Card, {
      props: { card: { suit: Suit.Spades, rank: Rank.Ace }, clickable: true },
    });
    const cardEl = container.querySelector("[data-testid='card']");
    expect(cardEl?.className).toContain("cursor-pointer");
  });

  it("fires onclick when clicked and clickable", async () => {
    const onclick = vi.fn();
    const { container } = render(Card, {
      props: {
        card: { suit: Suit.Spades, rank: Rank.Ace },
        clickable: true,
        onclick,
      },
    });
    const cardEl = container.querySelector("[data-testid='card']")!;
    await fireEvent.click(cardEl);
    expect(onclick).toHaveBeenCalledOnce();
  });

  it("does not fire onclick when not clickable", async () => {
    const onclick = vi.fn();
    const { container } = render(Card, {
      props: {
        card: { suit: Suit.Spades, rank: Rank.Ace },
        clickable: false,
        onclick,
      },
    });
    const cardEl = container.querySelector("[data-testid='card']")!;
    await fireEvent.click(cardEl);
    expect(onclick).not.toHaveBeenCalled();
  });
});
