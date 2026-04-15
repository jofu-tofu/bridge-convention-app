import { describe, expect, it } from "vitest";
import { render } from "@testing-library/svelte";
import SummaryCard from "../../../shared/reference/SummaryCard.svelte";
import { summaryCardFixture } from "./test-fixtures";

describe("SummaryCard", () => {
  it("renders the hero bid above the detailed summary rows", () => {
    const { getAllByText, getByTestId, getByText } = render(SummaryCard, {
      props: {
        moduleId: "stayman",
        summaryCard: summaryCardFixture,
      },
    });

    expect(getByTestId("summary-hero-bid").textContent).toContain("2♣");
    expect(getByText("Summary Card")).toBeTruthy();
    expect(getByText("Trigger")).toBeTruthy();
    expect(getAllByText("Convention bid")).toHaveLength(2);
    expect(getByText("Guiding idea")).toBeTruthy();
    expect(getByText("Notrump Responses")).toBeTruthy();
    expect(getByText("Use Stayman to uncover a 4-4 major fit before settling in notrump.")).toBeTruthy();
  });

  it("omits rows with empty string values instead of rendering an empty value", () => {
    const { queryByText } = render(SummaryCard, {
      props: {
        moduleId: "stayman",
        summaryCard: { ...summaryCardFixture, denies: "" },
      },
    });
    expect(queryByText("Denies")).toBeNull();
  });
});
