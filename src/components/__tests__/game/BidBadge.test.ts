import { describe, it, expect, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/svelte";
import BidBadge from "../../game/BidBadge.svelte";
import BidAnnotationBadge from "../../game/BidAnnotationBadge.svelte";
import { displayBidText } from "../../game/BidBadge";
import { closeAll, isOpen, currentOpenId } from "../../game/bid-badge-state.svelte";

describe("displayBidText", () => {
  it("abbreviates Pass to P", () => {
    expect(displayBidText("Pass")).toBe("P");
  });

  it("passes through numbered bids unchanged", () => {
    expect(displayBidText("1\u2660")).toBe("1\u2660");
    expect(displayBidText("3NT")).toBe("3NT");
  });

  it("passes through Dbl/Rdbl unchanged", () => {
    expect(displayBidText("Dbl")).toBe("Dbl");
    expect(displayBidText("Rdbl")).toBe("Rdbl");
  });

  it("passes through em-dash placeholder", () => {
    expect(displayBidText("\u2014")).toBe("\u2014");
  });
});

describe("BidBadge", () => {
  beforeEach(() => {
    closeAll();
  });

  it("renders bid text", () => {
    const { container } = render(BidBadge, {
      props: { id: "test-1", text: "1\u2660" },
    });
    expect(container.textContent).toContain("1\u2660");
  });

  it("abbreviates Pass to P", () => {
    const { container } = render(BidBadge, {
      props: { id: "test-1", text: "Pass" },
    });
    const box = container.querySelector("[data-bid-box]");
    expect(box?.textContent?.trim()).toBe("P");
  });

  it("renders no badge when alertLabel is undefined", () => {
    const { container } = render(BidBadge, {
      props: { id: "test-1", text: "1\u2660" },
    });
    const badge = container.querySelector("[data-bid-badge]");
    expect(badge).toBeNull();
  });

  it("renders badge with correct type attribute for alert", () => {
    const { container } = render(BidBadge, {
      props: {
        id: "test-2",
        text: "2\u2663",
        alertLabel: "Stayman",
        annotationType: "alert",
      },
    });
    const badge = container.querySelector("[data-bid-badge][data-annotation-type='alert']");
    expect(badge).not.toBeNull();
  });

  it("renders badge with announce type", () => {
    const { container } = render(BidBadge, {
      props: {
        id: "test-3",
        text: "2\u2666",
        alertLabel: "Transfer",
        annotationType: "announce",
      },
    });
    const badge = container.querySelector("[data-bid-badge][data-annotation-type='announce']");
    expect(badge).not.toBeNull();
  });

  it("renders educational badge with i glyph", () => {
    const { container } = render(BidBadge, {
      props: {
        id: "test-4",
        text: "1NT",
        alertLabel: "Opening NT",
        annotationType: "educational",
      },
    });
    const button = container.querySelector("[data-bid-badge] button");
    expect(button?.textContent?.trim()).toBe("i");
  });

  it("renders placeholder without border or badge", () => {
    const { container } = render(BidBadge, {
      props: { id: "test-5", text: "\u2014", isPlaceholder: true },
    });
    expect(container.querySelector("[data-bid-box]")).toBeNull();
    expect(container.querySelector("[data-bid-badge]")).toBeNull();
  });
});

describe("BidAnnotationBadge popover interaction", () => {
  beforeEach(() => {
    closeAll();
  });

  it("renders alertLabel and each publicConditions entry in popover", () => {
    const { container } = render(BidAnnotationBadge, {
      props: {
        id: "test-popover-1",
        type: "announce",
        label: "15 to 17",
        publicConditions: ["15-17 HCP", "Balanced shape"],
      },
    });
    const tooltip = container.querySelector("[role='tooltip']");
    expect(tooltip?.textContent).toContain("15 to 17");
    expect(tooltip?.textContent).toContain("15-17 HCP");
    expect(tooltip?.textContent).toContain("Balanced shape");
  });

  it("starts with data-open=false and aria-expanded=false", () => {
    const { container } = render(BidAnnotationBadge, {
      props: { id: "test-popover-2", type: "alert", label: "Convention" },
    });
    const badge = container.querySelector("[data-bid-badge]");
    expect(badge?.getAttribute("data-open")).toBe("false");
    const button = badge?.querySelector("button");
    expect(button?.getAttribute("aria-expanded")).toBe("false");
  });

  it("clicking the button sets data-open=true and aria-expanded=true", async () => {
    const { container } = render(BidAnnotationBadge, {
      props: { id: "test-popover-3", type: "alert", label: "Convention" },
    });
    const button = container.querySelector("[data-bid-badge] button") as HTMLButtonElement;
    await fireEvent.click(button);
    const badge = container.querySelector("[data-bid-badge]");
    expect(badge?.getAttribute("data-open")).toBe("true");
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(isOpen("test-popover-3")).toBe(true);
  });

  it("clicking the button a second time closes it", async () => {
    const { container } = render(BidAnnotationBadge, {
      props: { id: "test-popover-4", type: "alert", label: "Convention" },
    });
    const button = container.querySelector("[data-bid-badge] button") as HTMLButtonElement;
    await fireEvent.click(button);
    await fireEvent.click(button);
    expect(isOpen("test-popover-4")).toBe(false);
  });

  it("aria-describedby points to popover id", () => {
    const { container } = render(BidAnnotationBadge, {
      props: { id: "test-popover-5", type: "alert", label: "Convention" },
    });
    const button = container.querySelector("[data-bid-badge] button");
    const tooltip = container.querySelector("[role='tooltip']");
    expect(button?.getAttribute("aria-describedby")).toBe(tooltip?.getAttribute("id"));
  });
});

describe("single-open invariant across badges", () => {
  beforeEach(() => {
    closeAll();
  });

  it("opening badge B closes badge A", async () => {
    const a = render(BidAnnotationBadge, {
      props: { id: "badge-a", type: "alert", label: "A" },
    });
    const b = render(BidAnnotationBadge, {
      props: { id: "badge-b", type: "alert", label: "B" },
    });
    const buttonA = a.container.querySelector("[data-bid-badge] button") as HTMLButtonElement;
    const buttonB = b.container.querySelector("[data-bid-badge] button") as HTMLButtonElement;

    await fireEvent.click(buttonA);
    expect(currentOpenId()).toBe("badge-a");

    await fireEvent.click(buttonB);
    expect(currentOpenId()).toBe("badge-b");
    expect(isOpen("badge-a")).toBe(false);
  });

  it("outside click via document closes the open badge", async () => {
    const { container } = render(BidAnnotationBadge, {
      props: { id: "badge-outside", type: "alert", label: "label" },
    });
    const button = container.querySelector("[data-bid-badge] button") as HTMLButtonElement;
    await fireEvent.click(button);
    expect(isOpen("badge-outside")).toBe(true);

    // Simulate click on an unrelated element outside any badge
    const outside = document.createElement("div");
    document.body.appendChild(outside);
    await fireEvent.click(outside);
    expect(isOpen("badge-outside")).toBe(false);
    outside.remove();
  });

  it("Escape keydown closes the open badge", async () => {
    const { container } = render(BidAnnotationBadge, {
      props: { id: "badge-escape", type: "alert", label: "label" },
    });
    const button = container.querySelector("[data-bid-badge] button") as HTMLButtonElement;
    await fireEvent.click(button);
    expect(isOpen("badge-escape")).toBe(true);

    await fireEvent.keyDown(document, { key: "Escape" });
    expect(isOpen("badge-escape")).toBe(false);
  });
});
