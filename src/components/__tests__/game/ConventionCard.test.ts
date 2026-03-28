import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/svelte";
import ConventionCardPanel from "../../game/ConventionCardPanel.svelte";
import { buildConventionCardPanel, getSystemConfig } from "../../../service";

// Side-effect: register all bundles
import "../../../conventions/registration";

const saycConfig = getSystemConfig("sayc");

describe("ConventionCardPanel", () => {
  const panelView = buildConventionCardPanel(saycConfig, "nt-bundle");

  it("renders nothing when closed", () => {
    const { queryByTestId } = render(ConventionCardPanel, {
      props: { panelView, open: false, onclose: () => {} },
    });
    expect(queryByTestId("cc-panel")).toBeNull();
  });

  it("renders panel when open", () => {
    const { getByTestId } = render(ConventionCardPanel, {
      props: { panelView, open: true, onclose: () => {} },
    });
    expect(getByTestId("cc-panel")).toBeTruthy();
  });

  it("displays system name badge", () => {
    const { getByTestId } = render(ConventionCardPanel, {
      props: { panelView, open: true, onclose: () => {} },
    });
    const panel = getByTestId("cc-panel");
    expect(panel.textContent).toContain("SAYC");
  });

  it("displays section titles", () => {
    const { getByTestId } = render(ConventionCardPanel, {
      props: { panelView, open: true, onclose: () => {} },
    });
    const text = getByTestId("cc-panel").textContent ?? "";
    expect(text).toContain("General");
    expect(text).toContain("1NT Opening & Responses");
  });

  it("calls onclose when close button clicked", async () => {
    let closed = false;
    const { getByTestId } = render(ConventionCardPanel, {
      props: { panelView, open: true, onclose: () => { closed = true; } },
    });
    await fireEvent.click(getByTestId("cc-panel-close"));
    expect(closed).toBe(true);
  });

  it("calls onclose when backdrop clicked", async () => {
    let closed = false;
    const { getByTestId } = render(ConventionCardPanel, {
      props: { panelView, open: true, onclose: () => { closed = true; } },
    });
    await fireEvent.click(getByTestId("cc-panel-backdrop"));
    expect(closed).toBe(true);
  });

  it("shows compact summaries by default", () => {
    const { getByTestId } = render(ConventionCardPanel, {
      props: { panelView, open: true, onclose: () => {} },
    });
    const text = getByTestId("cc-panel").textContent ?? "";
    // NT section compact summary should contain the range
    expect(text).toContain("15\u201317");
  });
});
