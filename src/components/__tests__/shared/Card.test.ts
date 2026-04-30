import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/svelte";
import Card from "../../shared/Card.svelte";
import CardTestWrapper from "./CardTestWrapper.svelte";
import { Suit, Rank } from "../../../service";
import { createAppStore } from "../../../stores/app.svelte";

function createStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
}

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

  describe("ten notation preference", () => {
    beforeEach(() => {
      vi.stubGlobal("localStorage", createStorage());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("renders the ten as '10' by default", () => {
      const appStore = createAppStore();
      const { container } = render(CardTestWrapper, {
        props: {
          appStore,
          card: { suit: Suit.Spades, rank: Rank.Ten },
        },
      });
      expect(container.textContent).toContain("10");
      expect(container.textContent).not.toMatch(/(^|[^1])T(?!en)/);
    });

    it("renders the ten as 'T' when tenNotation is 't'", () => {
      const appStore = createAppStore();
      appStore.setTenNotation("t");
      const { container } = render(CardTestWrapper, {
        props: {
          appStore,
          card: { suit: Suit.Spades, rank: Rank.Ten },
        },
      });
      expect(container.textContent).toContain("T");
      expect(container.textContent).not.toContain("10");
    });
  });
});
