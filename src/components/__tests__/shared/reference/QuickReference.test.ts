import { describe, expect, it } from "vitest";
import { render } from "@testing-library/svelte";
import QuickReference from "../../../shared/reference/QuickReference.svelte";
import {
  quickReferenceDenseGridFixture,
  quickReferenceGridFixture,
  quickReferenceListFixture,
} from "./test-fixtures";

describe("QuickReference", () => {
  it("renders a 2-D grid with axis labels for kind=grid", () => {
    const { getByText, getAllByText, getByTitle } = render(QuickReference, {
      props: { quickReference: quickReferenceGridFixture },
    });

    expect(getByText("Quick Reference")).toBeTruthy();
    expect(getAllByText("Responder strength").length).toBeGreaterThan(0);
    expect(getAllByText("2♣").length).toBeGreaterThan(0);
    expect(getAllByText("Ask, then bid game").length).toBeGreaterThan(0);
    expect(getByText("—")).toBeTruthy();
    expect(
      getByTitle(
        "Both 4-card majors with game values are shown through the Smolen branch instead.",
      ),
    ).toBeTruthy();
  });

  it("marks not-app-heavy grids as dense", () => {
    const { getByTestId } = render(QuickReference, {
      props: { quickReference: quickReferenceDenseGridFixture },
    });

    expect(getByTestId("quick-reference-grid").getAttribute("data-density")).toBe("dense");
  });

  it("renders a single-axis list for kind=list", () => {
    const { getByText, getAllByText } = render(QuickReference, {
      props: { quickReference: quickReferenceListFixture },
    });

    expect(getByText("Quick Reference")).toBeTruthy();
    expect(getAllByText("Keycards held").length).toBeGreaterThan(0);
    expect(getByText("Recommendation")).toBeTruthy();
    expect(getByText("5C")).toBeTruthy();
  });
});
