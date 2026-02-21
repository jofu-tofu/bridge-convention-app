import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/svelte";
import BidPanel from "../../game/BidPanel.svelte";
import { BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";

describe("BidPanel", () => {
  it("always renders all 35 level bid buttons plus 3 special buttons", () => {
    const calls: Call[] = [
      { type: "pass" },
      { type: "bid", level: 1, strain: BidSuit.NoTrump },
    ];
    const { container } = render(BidPanel, {
      props: { legalCalls: calls, onBid: () => {} },
    });
    const levelBids = container.querySelector("[data-testid='level-bids']");
    const specialBids = container.querySelector("[data-testid='special-bids']");
    expect(levelBids?.querySelectorAll("button")).toHaveLength(35);
    expect(specialBids?.querySelectorAll("button")).toHaveLength(3);
  });

  it("enables legal bids and disables illegal bids", () => {
    const calls: Call[] = [
      { type: "pass" },
      { type: "bid", level: 1, strain: BidSuit.NoTrump },
    ];
    const { container } = render(BidPanel, {
      props: { legalCalls: calls, onBid: () => {} },
    });
    const levelBids = container.querySelector("[data-testid='level-bids']");
    const buttons = levelBids?.querySelectorAll("button");
    // 1NT (5th button, index 4) should be enabled
    expect(buttons?.[4]?.disabled).toBe(false);
    // 1C (1st button, index 0) should be disabled (not in legalCalls)
    expect(buttons?.[0]?.disabled).toBe(true);
  });

  it("fires onBid callback when legal bid is clicked", async () => {
    const onBid = vi.fn();
    const calls: Call[] = [{ type: "pass" }];
    const { container } = render(BidPanel, {
      props: { legalCalls: calls, onBid },
    });
    const specialBids = container.querySelector("[data-testid='special-bids']");
    const passButton = specialBids?.querySelector("button");
    expect(passButton).not.toBeNull();
    await fireEvent.click(passButton!);
    expect(onBid).toHaveBeenCalledWith({ type: "pass" });
  });

  it("disables all buttons when disabled prop is true", () => {
    const calls: Call[] = [
      { type: "pass" },
      { type: "bid", level: 1, strain: BidSuit.Clubs },
    ];
    const { container } = render(BidPanel, {
      props: { legalCalls: calls, onBid: () => {}, disabled: true },
    });
    const buttons = container.querySelectorAll("button");
    buttons.forEach((btn) => {
      expect(btn.disabled).toBe(true);
    });
  });

  it("separates level bids from special calls into two containers", () => {
    const calls: Call[] = [
      { type: "pass" },
      { type: "bid", level: 1, strain: BidSuit.Clubs },
    ];
    const { container } = render(BidPanel, {
      props: { legalCalls: calls, onBid: () => {} },
    });
    expect(container.querySelector("[data-testid='level-bids']")).not.toBeNull();
    expect(container.querySelector("[data-testid='special-bids']")).not.toBeNull();
  });

  it("displays bids in order: level 1-7, each level C/D/H/S/NT", () => {
    const calls: Call[] = [{ type: "pass" }];
    const { container } = render(BidPanel, {
      props: { legalCalls: calls, onBid: () => {} },
    });
    const levelBids = container.querySelector("[data-testid='level-bids']");
    const buttons = levelBids?.querySelectorAll("button");
    // First 5 buttons are level 1: C, D, H, S, NT
    expect(buttons?.[0]?.textContent).toContain("1\u2663"); // 1C
    expect(buttons?.[1]?.textContent).toContain("1\u2666"); // 1D
    expect(buttons?.[2]?.textContent).toContain("1\u2665"); // 1H
    expect(buttons?.[3]?.textContent).toContain("1\u2660"); // 1S
    expect(buttons?.[4]?.textContent).toContain("1NT");
    // Last 5 buttons are level 7
    expect(buttons?.[30]?.textContent).toContain("7\u2663"); // 7C
    expect(buttons?.[34]?.textContent).toContain("7NT");
  });

  it("applies compact styling when compact=true", () => {
    const calls: Call[] = [{ type: "pass" }];
    const { container } = render(BidPanel, {
      props: { legalCalls: calls, onBid: () => {}, compact: true },
    });
    const button = container.querySelector("button");
    expect(button?.className).toContain("text-xs");
  });
});
