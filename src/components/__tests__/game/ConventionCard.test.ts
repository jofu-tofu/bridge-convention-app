import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/svelte";
import ConventionCardPanel from "../../game/ConventionCardPanel.svelte";
import type { ConventionCardPanelView, AcblCardPanelView } from "../../../service";

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

const acblPanelView: AcblCardPanelView = {
  partnership: "N-S",
  systemName: "SAYC",
  sections: [
    { id: "acbl-special-doubles", title: "Special Doubles", available: true, items: [{ label: "Negative", value: "Through 2\u2660" }], modules: [] },
    { id: "acbl-notrump-opening", title: "Notrump Opening Bids", available: true, items: [{ label: "1NT Range", value: "15\u201317" }], modules: [] },
    { id: "acbl-major-opening", title: "Major Opening", available: true, items: [{ label: "Min Length", value: "5+ cards" }], modules: [] },
    { id: "acbl-minor-opening", title: "Minor Opening", available: true, items: [{ label: "Style", value: "Standard" }], modules: [] },
    { id: "acbl-two-level-openings", title: "2-Level Openings", available: false, items: [], modules: [] },
    { id: "acbl-other-conventional", title: "Other Conventional Calls", available: false, items: [], modules: [] },
    { id: "acbl-defensive-competitive", title: "Defensive & Competitive", available: true, items: [{ label: "vs 1NT", value: "Natural" }], modules: [] },
    { id: "acbl-leads", title: "Leads", available: false, items: [], modules: [] },
    { id: "acbl-signals", title: "Signals", available: false, items: [], modules: [] },
    { id: "acbl-slam-conventions", title: "Slam Conventions", available: true, items: [{ label: "Slam Zone", value: "33+ HCP" }], modules: [] },
    { id: "acbl-important-notes", title: "Important Notes", available: false, items: [], modules: [] },
  ],
};

const defaultProps = { panelView, acblPanelView, open: true, onclose: () => {} };

describe("ConventionCardPanel", () => {
  it("renders nothing when closed", () => {
    const { queryByTestId } = render(ConventionCardPanel, {
      props: { ...defaultProps, open: false },
    });
    expect(queryByTestId("cc-panel")).toBeNull();
  });

  it("renders panel when open", () => {
    const { getByTestId } = render(ConventionCardPanel, {
      props: defaultProps,
    });
    expect(getByTestId("cc-panel")).toBeTruthy();
  });

  it("displays system name badge", () => {
    const { getByTestId } = render(ConventionCardPanel, {
      props: defaultProps,
    });
    const panel = getByTestId("cc-panel");
    expect(panel.textContent).toContain("SAYC");
  });

  it("displays section titles in App mode", () => {
    const { getByTestId } = render(ConventionCardPanel, {
      props: defaultProps,
    });
    const text = getByTestId("cc-panel").textContent ?? "";
    expect(text).toContain("General");
    expect(text).toContain("1NT Opening & Responses");
  });

  it("calls onclose when close button clicked", async () => {
    let closed = false;
    const { getByTestId } = render(ConventionCardPanel, {
      props: { ...defaultProps, onclose: () => { closed = true; } },
    });
    await fireEvent.click(getByTestId("cc-panel-close"));
    expect(closed).toBe(true);
  });

  it("calls onclose when backdrop clicked", async () => {
    let closed = false;
    const { getByTestId } = render(ConventionCardPanel, {
      props: { ...defaultProps, onclose: () => { closed = true; } },
    });
    await fireEvent.click(getByTestId("cc-panel-backdrop"));
    expect(closed).toBe(true);
  });

  it("shows compact summaries in App mode by default", () => {
    const { getByTestId } = render(ConventionCardPanel, {
      props: defaultProps,
    });
    const text = getByTestId("cc-panel").textContent ?? "";
    expect(text).toContain("15\u201317");
  });

  // ── Format toggle tests ──────────────────────────────────────

  it("renders format toggle with App and ACBL options", () => {
    const { getByTestId } = render(ConventionCardPanel, {
      props: defaultProps,
    });
    expect(getByTestId("cc-format-app")).toBeTruthy();
    expect(getByTestId("cc-format-acbl")).toBeTruthy();
  });

  it("defaults to App format", () => {
    const { getByTestId } = render(ConventionCardPanel, {
      props: defaultProps,
    });
    const appBtn = getByTestId("cc-format-app");
    expect(appBtn.getAttribute("aria-pressed")).toBe("true");
  });

  it("shows Expand All button in App mode", () => {
    const { getByTestId } = render(ConventionCardPanel, {
      props: defaultProps,
    });
    expect(getByTestId("cc-expand-all")).toBeTruthy();
  });

  // ── ACBL mode tests ──────────────────────────────────────────

  it("switching to ACBL shows all 11 sections", async () => {
    const { getByTestId } = render(ConventionCardPanel, {
      props: defaultProps,
    });
    await fireEvent.click(getByTestId("cc-format-acbl"));
    const container = getByTestId("acbl-card-sections");
    expect(container.children).toHaveLength(11);
  });

  it("unavailable ACBL sections show 'Not yet configured'", async () => {
    const { getByTestId, getAllByTestId } = render(ConventionCardPanel, {
      props: defaultProps,
    });
    await fireEvent.click(getByTestId("cc-format-acbl"));
    const notConfigured = getAllByTestId("acbl-not-configured");
    // 5 unavailable sections: 2-level, other conventional, leads, signals, important notes
    expect(notConfigured).toHaveLength(5);
  });

  it("Expand All button hidden in ACBL mode", async () => {
    const { getByTestId, queryByTestId } = render(ConventionCardPanel, {
      props: defaultProps,
    });
    await fireEvent.click(getByTestId("cc-format-acbl"));
    expect(queryByTestId("cc-expand-all")).toBeNull();
  });

  it("switching back to App restores accordion behavior", async () => {
    const { getByTestId, queryByTestId } = render(ConventionCardPanel, {
      props: defaultProps,
    });
    // Switch to ACBL
    await fireEvent.click(getByTestId("cc-format-acbl"));
    expect(queryByTestId("acbl-card-sections")).toBeTruthy();

    // Switch back to App
    await fireEvent.click(getByTestId("cc-format-app"));
    expect(queryByTestId("acbl-card-sections")).toBeNull();
    expect(getByTestId("cc-expand-all")).toBeTruthy();
  });

  it("ACBL sections display expected content", async () => {
    const { getByTestId } = render(ConventionCardPanel, {
      props: defaultProps,
    });
    await fireEvent.click(getByTestId("cc-format-acbl"));
    const text = getByTestId("cc-panel").textContent ?? "";
    expect(text).toContain("Special Doubles");
    expect(text).toContain("Notrump Opening Bids");
    expect(text).toContain("Slam Conventions");
    expect(text).toContain("15\u201317");
  });
});
