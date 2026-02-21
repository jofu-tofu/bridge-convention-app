import { describe, it, expect } from "vitest";
import { render } from "@testing-library/svelte";
import HandDisplay from "../HandDisplay.svelte";
import { createDeck, createHand } from "../../engine/constants";
import { Rank } from "../../engine/types";
import type { Hand } from "../../engine/types";

function makeTestHand(): Hand {
  return createHand(createDeck().slice(0, 13));
}

describe("HandDisplay", () => {
  it("renders four suit rows when visible", () => {
    const hand = makeTestHand();
    const { container } = render(HandDisplay, { props: { hand } });

    // Should have all 4 suit symbols
    expect(container.textContent).toContain("\u2663"); // clubs
    expect(container.textContent).toContain("\u2666"); // diamonds
    expect(container.textContent).toContain("\u2665"); // hearts
    expect(container.textContent).toContain("\u2660"); // spades
  });

  it("renders 13 cards across all suits", () => {
    const hand = makeTestHand();
    const { container } = render(HandDisplay, { props: { hand } });

    // Count individual rank characters — each of the 13 cards should appear
    const text = container.textContent ?? "";
    let rankCount = 0;
    for (const rank of Object.values(Rank)) {
      const matches = text.split(rank).length - 1;
      rankCount += matches;
    }
    expect(rankCount).toBeGreaterThanOrEqual(13);
  });

  it("shows hidden text when visible is false", () => {
    const hand = makeTestHand();
    const { container } = render(HandDisplay, { props: { hand, visible: false } });
    expect(container.textContent).toContain("Hidden");
  });
});
