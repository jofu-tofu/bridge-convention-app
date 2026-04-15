import { describe, expect, it } from "vitest";
import { render } from "@testing-library/svelte";
import FlowSummary from "../../../shared/reference/FlowSummary.svelte";
import { flowTreeFixture } from "./test-fixtures";

describe("FlowSummary", () => {
  it("renders the root call and depth-1 continuation label", () => {
    const { getByText } = render(FlowSummary, {
      props: { tree: flowTreeFixture },
    });

    expect(getByText("Partner opened 1NT")).toBeTruthy();
    expect(getByText("Stayman 2♣")).toBeTruthy();
  });

  it("collapses descendants beyond maxDepth into a +N continuations badge", () => {
    const { getByText } = render(FlowSummary, {
      props: { tree: flowTreeFixture, maxDepth: 1 },
    });

    // Depth-2 opener-shows are hidden; counted instead.
    expect(getByText(/\+2 continuations/)).toBeTruthy();
  });
});
