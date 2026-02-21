import { describe, it, expect } from "vitest";
import { render } from "@testing-library/svelte";
import BridgeTableTestWrapper from "../BridgeTableTestWrapper.svelte";
import { Seat } from "../../../engine/types";
import { makeDeal } from "../test-helpers";

describe("BridgeTable", () => {
  const deal = makeDeal();
  const defaultProps = {
    hands: deal.hands,
    userSeat: Seat.South,
  };

  it("renders 4 hand fan areas", () => {
    const { container } = render(BridgeTableTestWrapper, {
      props: defaultProps,
    });
    const fans = container.querySelectorAll("[data-testid='hand-fan']");
    expect(fans).toHaveLength(4);
  });

  it("shows user seat hand face up", () => {
    const { container } = render(BridgeTableTestWrapper, {
      props: defaultProps,
    });
    // South is user seat — should have face-up cards
    const faceUpCards = container.querySelectorAll("[data-testid='card']");
    expect(faceUpCards.length).toBeGreaterThan(0);
  });

  it("shows opponent hands face down", () => {
    const { container } = render(BridgeTableTestWrapper, {
      props: defaultProps,
    });
    // Other seats should have face-down cards
    const faceDownCards = container.querySelectorAll("[data-testid='card-back']");
    expect(faceDownCards.length).toBeGreaterThan(0);
  });

  it("renders center snippet content", () => {
    const { container } = render(BridgeTableTestWrapper, {
      props: defaultProps,
    });
    expect(container.querySelector("[data-testid='center-content']")).not.toBeNull();
    expect(container.textContent).toContain("Center");
  });

  it("displays seat labels N, E, S, W", () => {
    const { container } = render(BridgeTableTestWrapper, {
      props: defaultProps,
    });
    expect(container.querySelector("[data-testid='seat-label-N']")).not.toBeNull();
    expect(container.querySelector("[data-testid='seat-label-E']")).not.toBeNull();
    expect(container.querySelector("[data-testid='seat-label-S']")).not.toBeNull();
    expect(container.querySelector("[data-testid='seat-label-W']")).not.toBeNull();
  });
});
