import { describe, expect, it } from "vitest";
import { render } from "@testing-library/svelte";
import WhenNotTable from "../../../shared/reference/WhenNotTable.svelte";
import { whenNotToUseFixture, whenToUseFixture } from "./test-fixtures";

describe("WhenNotTable", () => {
  it("renders the positive and negative usage columns with reasons", () => {
    const { getByText } = render(WhenNotTable, {
      props: {
        whenToUse: whenToUseFixture,
        whenNotToUse: whenNotToUseFixture,
      },
    });

    expect(getByText("When to use")).toBeTruthy();
    expect(getByText("When not to use")).toBeTruthy();
    expect(
      getByText("Do not use Stayman with 4-3-3-3 and a 4-card major"),
    ).toBeTruthy();
    expect(getByText("(there is no ruffing value to justify searching for a thin fit)")).toBeTruthy();
  });
});
