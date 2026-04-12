import { describe, expect, it } from "vitest";
import { render } from "@testing-library/svelte";
import DecisionGrid from "../../../shared/reference/DecisionGrid.svelte";
import { decisionGridFixture } from "./test-fixtures";

describe("DecisionGrid", () => {
  it("renders nothing when no grid is provided", () => {
    const { queryByText } = render(DecisionGrid, {
      props: {
        decisionGrid: null,
      },
    });

    expect(queryByText("Decision Grid")).toBeNull();
  });

  it("renders family labels alongside color-coded cells", () => {
    const { getAllByText, getByText } = render(DecisionGrid, {
      props: {
        decisionGrid: decisionGridFixture,
      },
    });

    expect(getByText("Decision Grid")).toBeTruthy();
    expect(getAllByText("Asking").length).toBeGreaterThanOrEqual(1);
    expect(getByText("Force")).toBeTruthy();
  });
});
