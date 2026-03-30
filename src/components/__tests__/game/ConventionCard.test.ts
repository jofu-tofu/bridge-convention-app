import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/svelte";
import ConventionCardPanel from "../../game/ConventionCardPanel.svelte";
import type { ConventionCardPanelView } from "../../../service";

// Build a minimal panel view for testing (WASM not available in unit tests)
const panelView: ConventionCardPanelView = {
  partnership: "N-S",
  systemName: "SAYC",
  sections: [
    {
      id: "general" as never,
      title: "General",
      compactSummary: "SAYC \u00b7 5-card majors",
      items: [
        { label: "System", value: "SAYC" },
        { label: "Majors", value: "5-card majors" },
      ],
      modules: [],
    },
    {
      id: "notrump-opening" as never,
      title: "1NT Opening & Responses",
      compactSummary: "15\u201317 \u00b7 Stayman",
      items: [{ label: "1NT Range", value: "15\u201317" }],
      modules: [],
    },
  ],
};

describe("ConventionCardPanel", () => {
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
    expect(text).toContain("15\u201317");
  });
});
