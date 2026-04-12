import { describe, expect, it } from "vitest";
import { render } from "@testing-library/svelte";
import SummaryCard from "../../../shared/reference/SummaryCard.svelte";
import { summaryCardFixture } from "./test-fixtures";

describe("SummaryCard", () => {
  it("renders the six-line quick-reference summary", () => {
    const { getByText } = render(SummaryCard, {
      props: {
        moduleId: "stayman",
        summaryCard: summaryCardFixture,
      },
    });

    expect(getByText("Summary Card")).toBeTruthy();
    expect(getByText("Trigger")).toBeTruthy();
    expect(getByText("Convention bid")).toBeTruthy();
    expect(getByText("Guiding idea")).toBeTruthy();
    expect(getByText("Notrump Responses")).toBeTruthy();
    expect(getByText("Use Stayman to uncover a 4-4 major fit before settling in notrump.")).toBeTruthy();
  });
});
