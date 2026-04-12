import { describe, expect, it } from "vitest";
import { render } from "@testing-library/svelte";
import QuickRefCard from "../../../shared/reference/QuickRefCard.svelte";
import { responseTableFixture, summaryCardFixture } from "./test-fixtures";

describe("QuickRefCard", () => {
  it("composes the summary card and response table", () => {
    const { getByText } = render(QuickRefCard, {
      props: {
        moduleId: "stayman",
        summaryCard: summaryCardFixture,
        responseTableRows: responseTableFixture,
      },
    });

    expect(getByText("Summary Card")).toBeTruthy();
    expect(getByText("Response Table")).toBeTruthy();
    expect(getByText("Use Stayman to uncover a 4-4 major fit before settling in notrump.")).toBeTruthy();
  });
});
