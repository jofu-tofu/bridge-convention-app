import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/svelte";
import BidPanel from "../BidPanel.svelte";
import { BidSuit } from "../../engine/types";
import type { Call } from "../../engine/types";

describe("BidPanel", () => {
  it("renders legal calls as buttons", () => {
    const calls: Call[] = [
      { type: "pass" },
      { type: "bid", level: 1, strain: BidSuit.NoTrump },
    ];
    const { container } = render(BidPanel, {
      props: { legalCalls: calls, onBid: () => {} },
    });

    const buttons = container.querySelectorAll("button");
    expect(buttons).toHaveLength(2);
  });

  it("fires onBid callback when clicked", async () => {
    const onBid = vi.fn();
    const calls: Call[] = [{ type: "pass" }];
    const { container } = render(BidPanel, {
      props: { legalCalls: calls, onBid },
    });

    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    await fireEvent.click(button!);
    expect(onBid).toHaveBeenCalledWith({ type: "pass" });
  });

  it("disables buttons when disabled prop is true", () => {
    const calls: Call[] = [{ type: "pass" }];
    const { container } = render(BidPanel, {
      props: { legalCalls: calls, onBid: () => {}, disabled: true },
    });

    const button = container.querySelector("button");
    expect(button?.disabled).toBe(true);
  });

  it("shows message when no legal calls", () => {
    const { container } = render(BidPanel, {
      props: { legalCalls: [], onBid: () => {} },
    });
    expect(container.textContent).toContain("No legal calls");
  });
});
