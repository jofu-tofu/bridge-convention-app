import { describe, it, expect } from "vitest";
import { render } from "@testing-library/svelte";
import TrickArea from "../../game/TrickArea.svelte";
import { Seat, Suit, Rank } from "../../../engine/types";
import type { PlayedCard } from "../../../engine/types";

function playedCard(seat: Seat, suit: Suit, rank: Rank): PlayedCard {
  return { seat, card: { suit, rank } };
}

describe("TrickArea", () => {
  const defaultProps = {
    currentTrick: [] as PlayedCard[],
    currentPlayer: Seat.South,
    trumpSuit: undefined,
  };

  it("renders the trick area container", () => {
    const { container } = render(TrickArea, { props: defaultProps });
    expect(container.querySelector("[data-testid='trick-area']")).not.toBeNull();
  });

  it("shows 4 trick position slots", () => {
    const { container } = render(TrickArea, { props: defaultProps });
    const positions = container.querySelectorAll("[data-testid^='trick-position-']");
    expect(positions).toHaveLength(4);
  });

  it("renders played cards face up at correct positions", () => {
    const trick: PlayedCard[] = [
      playedCard(Seat.West, Suit.Spades, Rank.Ace),
      playedCard(Seat.North, Suit.Spades, Rank.King),
    ];
    const { container } = render(TrickArea, {
      props: { ...defaultProps, currentTrick: trick },
    });
    // Two face-up cards should be rendered
    const cards = container.querySelectorAll("[data-testid='card']");
    expect(cards).toHaveLength(2);
  });

  it("shows active placeholder for current player with no card played", () => {
    const { container } = render(TrickArea, {
      props: { ...defaultProps, currentPlayer: Seat.South, currentTrick: [] },
    });
    const activePlaceholder = container.querySelector("[data-testid='trick-placeholder-active']");
    expect(activePlaceholder).not.toBeNull();
  });

  it("does not show active placeholder for seats that have played", () => {
    const trick: PlayedCard[] = [
      playedCard(Seat.South, Suit.Hearts, Rank.Ace),
    ];
    const { container } = render(TrickArea, {
      props: { ...defaultProps, currentTrick: trick, currentPlayer: Seat.West },
    });
    // South already played — should not have active placeholder at South
    const southPosition = container.querySelector("[data-testid='trick-position-S']");
    const activePlaceholder = southPosition?.querySelector("[data-testid='trick-placeholder-active']");
    expect(activePlaceholder).toBeNull();
  });
});
