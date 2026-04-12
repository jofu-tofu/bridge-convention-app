import { describe, expect, it } from "vitest";
import { render } from "@testing-library/svelte";
import SystemCompatRow from "../../../shared/reference/SystemCompatRow.svelte";
import { systemCompatFixture } from "./test-fixtures";

describe("SystemCompatRow", () => {
  it("renders the fixed system columns", () => {
    const { getByText } = render(SystemCompatRow, {
      props: {
        systemCompat: systemCompatFixture,
      },
    });

    expect(getByText("SAYC")).toBeTruthy();
    expect(getByText("2/1")).toBeTruthy();
    expect(getByText("Acol")).toBeTruthy();
    expect(getByText("Custom")).toBeTruthy();
    expect(getByText("Standard Stayman over 1NT.")).toBeTruthy();
  });
});
