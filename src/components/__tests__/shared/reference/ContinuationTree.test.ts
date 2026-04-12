import { describe, expect, it } from "vitest";
import { render } from "@testing-library/svelte";
import ContinuationTree from "../../../shared/reference/ContinuationTree.svelte";
import { continuationPhasesFixture } from "./test-fixtures";

describe("ContinuationTree", () => {
  it("preserves phase grouping and anchors each surface", () => {
    const { container, getByText } = render(ContinuationTree, {
      props: {
        moduleId: "stayman",
        phases: continuationPhasesFixture,
      },
    });

    expect(getByText("Response")).toBeTruthy();
    expect(getByText("Continuation")).toBeTruthy();
    expect(getByText("After 1NT-2♣, opener clarifies major-suit holdings.")).toBeTruthy();
    expect(getByText("No 4-card major in opener's hand.")).toBeTruthy();
    expect(container.querySelector("#stayman-ask-major")).not.toBeNull();
    expect(container.querySelector("details")).not.toBeNull();
  });
});
