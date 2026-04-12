import { describe, expect, it } from "vitest";
import { render } from "@testing-library/svelte";
import { BidSuit, Seat } from "../../../../service";
import BidCode from "../../../shared/reference/BidCode.svelte";

describe("BidCode", () => {
  it("formats call objects with suit styling", () => {
    const { container } = render(BidCode, {
      props: {
        value: { type: "bid", level: 2, strain: BidSuit.Hearts },
      },
    });

    expect(container.textContent).toContain("2\u2665");
    expect(container.querySelector(".text-suit-hearts")).not.toBeNull();
  });

  it("renders seat labels alongside the bid", () => {
    const { container } = render(BidCode, {
      props: {
        value: { type: "pass" },
        seat: Seat.South,
      },
    });

    expect(container.textContent).toContain("S");
    expect(container.textContent).toContain("Pass");
  });
});
