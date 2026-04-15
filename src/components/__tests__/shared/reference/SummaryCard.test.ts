import { describe, expect, it } from "vitest";
import { render } from "@testing-library/svelte";
import SummaryCard from "../../../shared/reference/SummaryCard.svelte";
import { summaryCardFixture } from "./test-fixtures";

describe("SummaryCard", () => {
  it("renders hero text above a single-bid tile for conventions without peers", () => {
    const { getByTestId, getByText } = render(SummaryCard, {
      props: {
        moduleId: "stayman",
        summaryCard: summaryCardFixture,
      },
    });

    expect(getByTestId("summary-hero-bid").textContent).toContain("2♣");
    expect(getByText("Summary Card")).toBeTruthy();
    expect(getByText("Trigger")).toBeTruthy();
    expect(getByText("Convention bid")).toBeTruthy();
    expect(getByText("Guiding idea")).toBeTruthy();
    expect(getByText("Notrump Responses")).toBeTruthy();
    expect(getByText("Use Stayman to uncover a 4-4 major fit before settling in notrump.")).toBeTruthy();
  });

  it("omits Denies line inside the bid tile when denies is empty", () => {
    const { queryByText } = render(SummaryCard, {
      props: {
        moduleId: "stayman",
        summaryCard: { ...summaryCardFixture, denies: "" },
      },
    });
    expect(queryByText(/^Denies\.?$/)).toBeNull();
  });
});
