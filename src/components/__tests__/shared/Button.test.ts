import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/svelte";
import ButtonTestWrapper from "../ButtonTestWrapper.svelte";

describe("Button", () => {
  it("renders as a button element", () => {
    const { container } = render(ButtonTestWrapper);
    const button = container.querySelector("button");
    expect(button).not.toBeNull();
  });

  it("renders children text content", () => {
    const { container } = render(ButtonTestWrapper, {
      props: { text: "Start Drill" },
    });
    expect(container.textContent).toContain("Start Drill");
  });

  it("sets disabled attribute when disabled=true", () => {
    const { container } = render(ButtonTestWrapper, {
      props: { disabled: true },
    });
    const button = container.querySelector("button");
    expect(button?.disabled).toBe(true);
  });

  it("fires onclick when clicked", async () => {
    const onclick = vi.fn();
    const { container } = render(ButtonTestWrapper, {
      props: { onclick },
    });
    const button = container.querySelector("button")!;
    await fireEvent.click(button);
    expect(onclick).toHaveBeenCalledOnce();
  });

  it("does not fire onclick when disabled", async () => {
    const onclick = vi.fn();
    const { container } = render(ButtonTestWrapper, {
      props: { onclick, disabled: true },
    });
    const button = container.querySelector("button")!;
    await fireEvent.click(button);
    expect(onclick).not.toHaveBeenCalled();
  });
});
